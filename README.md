# ashrafhanyy.github.io

Personal website of Ashraf Hany, built with [Hugo](https://gohugo.io) and a small custom theme (no Hugo modules).
Pushing to `main` deploys to GitHub Pages via `.github/workflows/publish.yaml`.

## Run locally

```bash
hugo server          # http://localhost:1313, live reload
hugo --gc --minify   # production build into public/
```

Requires Hugo **0.169.0** or newer (the version pinned in the deploy workflow).

## Where things live

| What | File |
| --- | --- |
| Navigation (About, Technical Blog, Non-Technical, Service) | `config/_default/menus.yaml` |
| Site description, contact links, CV link | `config/_default/params.yaml` |
| About page hero, biography and banner | `content/_index.md` |
| Publications on the About page | `data/publications.yaml` |
| Research focus, awards, skills, courses | `data/profile.yaml` |
| Service timeline ("where I've been") | `data/timeline.yaml` |
| Portrait | `assets/media/avatar.jpg` |
| CV PDF | `static/uploads/resume.pdf` |
| Styles (accent colour is `--accent` at the top) | `assets/css/main.css` |
| Templates | `layouts/` |

## Writing a post

Create a folder in `content/blog/` with an `index.md` and its images/videos next to it:

```yaml
---
title: "My new post"
date: 2026-11-10
summary: "One or two sentences shown on the listing pages."
category: technical        # or: non-technical
---

Body in Markdown. ![A caption](./photo.jpg "Optional caption shown under the image")
```

- `category` decides whether the post appears under **Technical Blog** or **Non-Technical**.
- An image named `featured.*` in the folder is used as the thumbnail and social preview.
- Large photos are resized automatically at build time; raw HTML such as `<video>` works.
- File names with spaces need angle brackets: `![x](<./my photo.jpg>)`.
