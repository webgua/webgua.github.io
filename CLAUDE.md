# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Hexo 8.x** static blog (Chinese-language) using the **Stellar** theme, deployed to GitHub Pages at `webgua.github.io`. Content is written in Chinese (zh-CN).

## Commands

```bash
npm run server    # Local dev server (hexo server)
npm run build     # Generate static site to ./public (hexo generate)
npm run clean     # Clean cache and generated files (hexo clean)
npm run deploy    # Deploy via hexo deployer
```

## Architecture

**Dual config system:** Hexo core config lives in `_config.yml`; Stellar theme overrides live in `_config.stellar.yml`. The theme is `hexo-theme-stellar` (v1.33+) installed via npm, not a git submodule — `themes/` is empty.

**Content structure:**
- `source/_posts/` — Blog posts (Markdown with YAML front matter: title, date, tags, categories, optional `type`)
- `source/about/index.md` — About page (menu_id: explore)
- `source/wiki/index.md` — Projects/wiki page (menu_id: wiki)
- `source/_data/icons.yml` — Custom SVG icon definitions referenced by the theme
- `source/css/custom.styl` — Custom Stylus styles injected via the `inject.head` config

**Post conventions:**
- Filename pattern: `:title.md` (Chinese titles are used)
- Front matter includes `title`, `date`, `tags`, `categories`, and optionally `type` (e.g., `story`)
- Use `<!-- more -->` to mark the excerpt boundary (auto_excerpt is set to 128 chars as fallback)
- `post_asset_folder: true` — post assets go in a same-named folder alongside the post

**Deployment:** GitHub Actions (`.github/workflows/deploy.yml`) builds with Node 20 + `npm ci` on pushes to `main`, then deploys the `./public` directory to GitHub Pages.

## Key Configuration Details

- Theme color: `hsl(221 83% 53%)` (blue), accent: `hsl(160 84% 39%)` (green)
- Fonts: Inter (body), JetBrains Mono (code)
- Code highlighting: highlight.js with Atom One Dark theme
- Plugins enabled: fancybox (image lightbox), flying-pages (link preload), copy-to-clipboard on code blocks
- License: CC BY-NC-SA 4.0
