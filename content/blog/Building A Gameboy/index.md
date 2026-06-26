---
title: 'Building a Custom Game Boy with the ESP32-S3'
date: 2025-08-24
summary: 'A custom ESP32-S3-N16R8 handheld game console built from scratch — custom PCB design, SPI/DMA framebuffer pipeline, button matrix, SD card ROM loading, and a full Retro-Go firmware port. NES, Game Boy, and Sega emulation at full speed. Third Place, NU UGRF Engineering Track.'
authors:
  - admin
show_related: true
# Display this page in the Featured widget?
featured: true
design:
  full_width: true
---

Over three months I built a fully working handheld retro console from scratch — wiring, firmware, and enclosure — around the **ESP32-S3-N16R8**. Every subsystem was hand-assembled: point-to-point wiring on perfboard, off-the-shelf modules, a hand-soldered input board, and a 3D-printed shell. The firmware required porting **Retro-Go** — an ESP-IDF multi-emulator launcher — to a target it was never written for, which meant writing a full `config.h` from scratch across multiple iterations to get every pin, bus, and display register right. The project earned **Third Place in the Engineering Track at NU UGRF 20th Edition**.

<br>

![image](./IMG_6588.jpeg)

<br>

First run of the system:

<video controls autoplay muted loop playsinline width="100%">
  <source src="./first.mp4" type="video/mp4">
</video>

![image](./IMG_6444.jpeg)

## SoC selection

The core is the **ESP32-S3-N16R8** — dual-core Xtensa LX7 at up to 240 MHz, 16 MB octal-SPI flash, 8 MB octal-SPI PSRAM on the same package. Three things made it the right fit:

**Dual-core task pinning.** Core 0 runs the emulator tick and audio mixing. Core 1 handles the display DMA transfer and input scanning. Separating these eliminates the scheduling jitter that causes audio glitches or dropped frames when everything competes on one timeline.

**External PSRAM.** On-chip SRAM is 512 KB — not enough to hold a 320×240 RGB565 framebuffer (150 KB) alongside ROM working memory. The 8 MB octal PSRAM, accessible at ~80 MHz via the dedicated MSPI bus, provides the headroom without requiring any swapping.

**DMA-capable SPI.** The SPI2/SPI3 controllers support DMA-linked descriptor chains. A full frame transfer is triggered once and completes without CPU involvement, which is what makes 30+ FPS achievable.

## Hardware: modules and hand-wiring

The build uses off-the-shelf modules wired point-to-point on perfboard, housed in a 3D-printed enclosure:

| Component | Module | Interface |
|---|---|---|
| 3.2″ ILI9341 TFT (320×240) | Pre-made SPI display board | SPI2 + DMA |
| SD card reader | Breakout module | SPI3 |
| D-pad (Up/Down/Left/Right) | Resistor ladder | ADC1 CH5 & CH6 |
| Action buttons (A, B, Select, Start, Menu, Option) | Hand-soldered on perfboard | GPIO pull-up |
| I2S audio amplifier | MAX98357A | I2S |
| Power regulation | MT3608 boost + LM2596 buck | — |
| Battery charging | TP4056 USB-C module | — |

Full pin assignments are in [`config.h`](https://github.com/AshrafHanyy/GameBoy-ESP32-S3).

![image](./IMG_5831.jpeg)
![image](./IMG_5885.jpeg)

## Power supply design

The power chain uses a two-stage conversion from an **18650 LiPo cell** (3.7 V nominal, 3.0–4.2 V across the discharge curve):

![image](./power-circuit.png)

An **MT3608 DC-DC boost converter** first steps the battery voltage up to a fixed **6 V**. That regulated 6 V feeds an **LM2596 DC-DC buck converter**, which steps it down to a stable **3.3 V** for the ESP32-S3 and all peripherals.

The reason for boost-then-buck rather than a direct buck from 3.7 V: a buck converter requires its input to be higher than its output by the dropout margin. As the 18650 discharges toward 3.0 V, a direct 3.7→3.3 V buck loses regulation and browns out. By boosting to 6 V first, the LM2596 always has sufficient headroom to hold 3.3 V flat across the entire battery life.

Charging is handled by a **TP4056-based USB-C module** that feeds the 18650 directly, independent of the boost converter. A power switch on the battery output line gates the rest of the circuit.

## Porting Retro-Go to the ESP32-S3

**Retro-Go** is an ESP-IDF multi-emulator launcher that natively targets the ESP32 and ESP32-WROVER. The ESP32-S3 is not a supported target — its peripheral base addresses, GPIO matrix, PSRAM controller, and Kconfig surface all differ. There was no existing board file to adapt: the port meant writing `config.h` from scratch and iterating until every subsystem came up correctly.

### config.h: the board definition file

In Retro-Go, each hardware target is described in a single `config.h` that defines every GPIO assignment, bus host, peripheral driver, and display initialization sequence. Writing it required tracing every wire on the board, identifying which ESP32-S3 GPIO each peripheral was connected to, and encoding that into the correct Retro-Go macros. The full file is in the [GitHub repo](https://github.com/AshrafHanyy/GameBoy-ESP32-S3).

Getting a wrong GPIO means the peripheral either does nothing or corrupts the bus. The first several builds produced a black screen, no SD mount, or silent audio — each failure pointed to a specific mismatch that had to be traced and corrected.

### Display: ILI9341 init sequence and 180° rotation

The ILI9341 runs on SPI2 at 40 MHz. The display module was physically mounted inverted inside the enclosure, so the image came out upside down on first boot. Fixing this required setting `RG_SCREEN_ROTATE 2` in Retro-Go and writing the correct value to the ILI9341 MADCTL register (`0x36`) in the init sequence:

```c
ILI9341_CMD(0x36, 0xA8); // MADCTL: MY=1, MV=1, BGR=1 → 180° rotation
```

`0xA8` = `10101000` in binary: bit 7 (MY) flips row order, bit 5 (MV) exchanges rows and columns, bit 3 (BGR) sets the color filter to match the panel. The combination produces a 180° rotation with correct color output.

The rest of the init sequence sets up power control, VCOM voltage, frame rate (~119 Hz), and positive/negative gamma correction — values that had to match the specific panel variant. Any mismatch produces color corruption or a washed-out image. The full `RG_SCREEN_INIT()` macro is in [`config.h`](https://github.com/AshrafHanyy/GameBoy-ESP32-S3).

Once the init sequence was correct and rotation applied, the SPI2 DMA pipeline handled frame delivery: the emulator writes a completed 320×240 RGB565 frame into PSRAM, a display task on Core 1 kicks off the DMA descriptor chain transfer, and the DMA completion ISR signals the emulator that the buffer is free.

### Input: ADC resistor ladder + GPIO buttons

The input scheme uses two different mechanisms. The D-pad is wired as a **resistor ladder** on two ADC channels (ADC1 CH5 and CH6). Each direction pulls the line to a different voltage level; Retro-Go distinguishes directions by comparing the ADC reading against defined min/max thresholds. Up and Down share CH5, Left and Right share CH6 — four directions multiplexed onto two ADC pins.

Action buttons use standard GPIO with internal pull-ups; a pressed button pulls the pin low.

The full `RG_GAMEPAD_ADC_MAP` and `RG_GAMEPAD_GPIO_MAP` definitions are in [`config.h`](https://github.com/AshrafHanyy/GameBoy-ESP32-S3).

### Storage and ROM loading

The SD card runs on SPI3 (separate host from the display on SPI2), mounted as FAT32 via `esp_vfs_fat_sdspi_mount` at `/sd`. At boot the launcher enumerates `/sd/roms`, builds an in-memory title list grouped by system, and renders the menu. ROM data is streamed into PSRAM during emulator init rather than fully buffered at load time.

### Audio

The **MAX98357A** I2S DAC/amplifier runs in master TX mode. Emulator cores push samples into a FreeRTOS ring buffer; a dedicated task drains it into the I2S DMA TX FIFO. The internal DAC is disabled in `config.h` (`RG_AUDIO_USE_INT_DAC 0`, `RG_AUDIO_USE_EXT_DAC 1`) — GPIO assignments are in the [repo](https://github.com/AshrafHanyy/GameBoy-ESP32-S3).

With all four subsystems stable — display, input, storage, audio — the NES, Game Boy, and Sega Master System cores ran at full speed with no frame drops.

![image](./ESP32-S3HANDHELD.png)

## Engineering presentation and award

The project was submitted to the **20th NU Undergraduate Research Forum**, Egypt's largest national undergraduate research competition. The presentation covered the full system end-to-end: the power regulation chain, wiring and signal integrity, SPI/DMA pipeline architecture, HAL porting methodology, input debounce design, FAT filesystem integration, and PSRAM memory layout. Judges asked specifically about the boost-then-buck power decision and the DMA descriptor chain design — being able to explain the *why* behind each decision, not just that it worked, is what separated this from other embedded projects.

![image](./winning.jpg)

The full project — firmware source, wiring notes, and configuration — is open source.

GitHub repo: **https://github.com/AshrafHanyy/GameBoy-ESP32-S3**