# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Project Overview

**Hexo 8.x** static blog (Chinese-language, `zh-CN`) using the **Stellar** theme (`hexo-theme-stellar` 1.33.x), authored by `webgua`, deployed to GitHub Pages at `https://webgua.github.io`. All content and front matter is written in Chinese.

There is no lint step, no test suite, and no application source code — this repo is a content + configuration site. Work here is almost always: write/edit Markdown posts, tweak theme config, or adjust custom CSS.

## Commands

```bash
npm run server      # Local dev server: hexo server (http://localhost:4000)
npm run build       # Generate static site into ./public (hexo generate)
npm run clean       # Wipe Hexo cache (db.json) and ./public (hexo clean)
npm run deploy      # hexo deploy — see caveat below
```

Content scaffolding (no npm script wraps these — call Hexo directly):

```bash
npx hexo new "文章标题"          # -> source/_posts/文章标题.md (from scaffolds/post.md)
npx hexo new page "页面名"       # -> source/页面名/index.md (from scaffolds/page.md)
npx hexo new draft "标题"        # -> source/_drafts/标题.md
```

**Deploy caveat:** `_config.yml` has `deploy.type: ''` (empty), so `npm run deploy` / `hexo deploy` is effectively dead despite `hexo-deployer-git` being installed. Real deployment happens only via GitHub Actions — see below.

**Typical edit loop:** `npm run clean && npm run build` before committing, because `npm run build` alone reuses the `db.json` cache and can miss changes to `_config*.yml` or theme files.

## Architecture

### Dual config system

Configuration is split across two files, and knowing which one owns a setting is the main source of confusion:

- `_config.yml` — Hexo core: site identity, URL/permalink scheme, directory layout, writing options, generators, `theme: stellar`.
- `_config.stellar.yml` — Stellar theme: logo, nav menu, `site_tree`, article defaults, footer, `style` tokens, `plugins`, default placeholder images.

`_config.landscape.yml` is leftover default-theme config and is not used (`theme` is `stellar`).

### Theme resolution

`themes/` contains only `.gitkeep` — the theme is **not** a git submodule. Hexo resolves `stellar` from `node_modules/hexo-theme-stellar`. Do not add files to `themes/` expecting them to be picked up; theme overrides belong in `source/` or `_config.stellar.yml`.

### Source layout

```
source/
  _posts/                 blog posts (Markdown + YAML front matter)
  about/index.md          About page  (layout: page, menu_id: explore)
  wiki/index.md           Projects page (layout: page, menu_id: wiki)
  wiki/projects/          (empty, reserved)
  _data/icons.yml         custom SVG icons referenced by _config.stellar.yml
  css/custom.styl         Stylus source -> compiled to /css/custom.css
_data/widgets.yml         sidebar widgets (welcome, recent, ghuser, tagcloud)
scripts/papermod.js       HTML post-processing for the PaperMod layout (see below)
scaffolds/                post.md / page.md / draft.md front-matter templates
public/                   generated output, GITIGNORED — never edit by hand
db.json                   Hexo cache, GITIGNORED
```

`source/css/custom.styl` is compiled by `hexo-renderer-stylus` to `/css/custom.css`, which is loaded via `inject.head` in `_config.yml`. **Edit the `.styl` file, never a generated `.css`.**

### How the theme wires things together

Three config blocks in `_config.stellar.yml` interlock, and changing one usually requires changing another:

1. `menubar.items` defines nav entries, each with a stable `id` (`post`, `wiki`, `explore`).
2. `site_tree.<layout>` maps each page type to a `menu_id` (which nav item highlights) plus `leftbar`/`rightbar` widget lists.
3. **`source/_data/widgets.yml`** defines those widgets by key (`welcome`, `recent`, `ghuser`, `tagcloud`).

A page opts into a nav/tree branch by setting `menu_id` in its front matter (see `source/about/index.md`, `source/wiki/index.md`).

**Widget gotchas** (verified empirically, cost real debugging time):
- Widgets are read from Hexo site data, so the file **must** be `source/_data/widgets.yml`. A `_data/widgets.yml` at the repo root is *not* loaded — the repo has one and it is dead config.
- A `widgets:` block in `_config.stellar.yml` is also ignored: the theme overwrites `theme.config.widgets` with its merged set.
- `leftbar` must be non-empty or the header search box disappears — Stellar renders the search partial inside `if (page.leftbar)`. Setting `leftbar:` to nothing silently kills search.

### Styling

`source/css/custom.styl` (Stylus) compiles to `/css/custom.css`, which is loaded via `inject.head` in `_config.yml`. **Edit the `.styl` file, never the generated `.css`.**

It loads *after* the theme's `main.css`, so overrides win at equal specificity — `!important` is usually unnecessary. The one exception: to recolor the theme you must redefine the palette under all three of `:root`, `:root[data-theme="light"]` and `:root[data-theme="dark"]`, because `main.css` sets the same variables at the same specificity in each. Stellar's dark mode is driven by both `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark) :root:not([data-theme])`.

The site is styled to resemble **Lil'Log** (Hugo + PaperMod): single 720px column, no sidebars, no card shadows. `custom.styl` achieves this by collapsing `.l_body` (normally a 3-column grid) to `display: block`, hiding `aside.l_right`, and turning `aside.l_left` into a horizontal top bar — a flex row whose logo carries `margin-inline-end: auto` so it pins left while nav and search sit right. Keep this in mind before touching the sidebar markup.

**Specificity gotchas (each of these actually broke the layout once):** `main.css` writes the sidebar rules with a `.l_body` prefix — `.l_body aside` (0,1,1) and `.l_body .l_left` (0,2,0) — so overrides must also start with `.l_body` or they silently lose. The sidebar containers also carry layout-critical defaults that must be explicitly reset for a top bar: `.leftbar-container` has `height: calc(100vh - …)` + `flex-direction: column`, `.nav-area .menu .nav-item` has `width: 100%` (it is a 6-column grid), and `.widgets` has `flex-grow: 1`. Verify overrides in a real renderer, not by reading CSS.

**Menubar icon trap:** the theme's `icon()` helper only knows its built-in icon set. An unrecognized name in `menubar.items[].icon` (e.g. `solar:archive-bold-duotone`) is rendered **as literal text** in the nav. Omit `icon` entirely and the template falls back to `<span>title</span>` — plain-text nav, which is what this design wants.

Measured PaperMod tokens the stylesheet reproduces: `--gap 24px`, `--content-gap 20px`, `--nav-width 1024px`, `--main-width 720px`, `--header-height 60px`, `--radius 8px`, body 16px/1.6 system font stack, `.post-entry` = 24px padding + 1px border + 8px radius, entry title 24px, excerpt 14px clamped to 2 lines, meta 13px, code blocks dark in *both* light and dark mode.

### scripts/papermod.js — HTML post-processing

Stellar's templates live in `node_modules`, so editing them directly would be lost on `npm install`. Instead `scripts/papermod.js` (auto-loaded by Hexo) registers an `after_render:html` filter that rewrites the generated HTML:

1. **Homepage intro** — Stellar renders the `welcome` widget inside the sidebar/top bar, but PaperMod puts `<article class="first-entry home-info">` at the top of `<main>`. The script cuts the `<widget class="widget-wrapper markdown">` block and re-inserts it before `.post-list`, wrapped in that `<article>`. Content still comes from `source/_data/widgets.yml`.
2. **Reading time** — injected after the date element on both list cards and post pages, using `hexo-wordcount`'s `min2read` helper (falls back to an identical local implementation if the plugin is missing). Output is `<span class="min2read">N min</span>`.

**The script takes all its data from `data.page`, never by sniffing HTML or reverse-deriving from `data.path`.** Keep it that way if you edit it:

- Page type comes from `data.page.layout` (`'post'` for an article) and the presence of `data.page.posts` (home / category / tag pages carry the article collection).
- Reading time is computed from `page.content` (articles) or `page.posts[].content` (lists) — no global map, no `hexo.locals` / `hexo.database` fallback, no cache to invalidate.
- The date element is located by `id="post-meta"` via a tag-counting helper, because Stellar uses *different tags* for it: `<span class="cap" id="post-meta">` in list cards, `<div class="flex-row" id="post-meta">` on post pages. Never match on the tag name or on a `class` string.
- URLs are compared through `normalize()` (strip origin → drop hash/query → `decodeURIComponent` → force leading/trailing `/`), because permalinks are percent-encoded while Windows output paths are plain Chinese.
- `CARD_OPEN_RE` accepts both `"post-card"` and `'post-card'` — Stellar writes some templates with single-quoted attributes.
- If the card selector ever stops matching (e.g. after a theme upgrade), the script prints `[papermod] 首页未注入阅读时长…` instead of failing silently. Because there is no cache, this also cannot silently serve stale values in `hexo server`.

**Archive pages intentionally get no reading time** — they use a different compact list (`<a class='post fs14'>`) and PaperMod's own archive view doesn't show it either.

`hexo generate` is incremental and does **not** know this script changed — run `npm run clean && npm run build` after editing it.

## Writing conventions

- **`new_post_name: :title.md`** — post filenames are the literal (Chinese) title, not slugified.
- Front matter: `title`, `date` (`YYYY-MM-DD HH:mm:ss`), `tags`, `categories`; optionally `type` (e.g. `type: story`) to switch article presentation.
- Use `<!-- more -->` to mark the excerpt cut. `article.auto_excerpt: 128` is the fallback when it's absent.
- **`post_asset_folder: true`** — a post's images live in a folder with the same name next to the `.md` file.
- **`future: true`** — posts dated in the future are published rather than skipped.
- **`updated_option: 'mtime'`** — a post's "updated" time comes from the file's mtime, so touching a file changes its visible updated date.
- Syntax highlighting is `highlight.js` (Atom One Dark, loaded from CDN); `hljs: false` means Hexo wraps in `<pre><code>` and the theme loads highlight.js itself.

## Deployment

`.github/workflows/deploy.yml` — on push to `main` (or `workflow_dispatch`): checkout → `actions/setup-node@v4` with **Node 20** and npm cache → `npm ci` → `npx hexo generate` → `upload-pages-artifact` of `./public` → `deploy-pages@v5`.

Practical consequences: Node version is pinned to 20 in CI, and `package-lock.json` must be in sync since CI runs `npm ci`. Pushing to `main` is a live deploy — there is no staging step.

## Design tokens

Defined in `_config.stellar.yml` under `style`, and duplicated as CSS variables at the top of `source/css/custom.styl`. Changing a color means editing **both**:

- Theme color: `hsl(221 83% 53%)` (blue) / `--theme-color`
- Accent: `hsl(160 84% 39%)` (green) / `--accent-color`
`_config.stellar.yml` still declares Inter / JetBrains Mono, but `custom.styl` overrides `body` and code elements with the PaperMod system font stacks, so those declarations are effectively inert here.

Enabled theme plugins: `preload` (flying-pages), `copycode` on code blocks. `fancybox` is **disabled** — its configured loader `/js/plugins/fancybox-loader.js` does not exist and 404s.

Installed Hexo plugins: `hexo-wordcount` (reading time / word count helpers; consumed by `scripts/papermod.js`).

## Related files

`CLAUDE.md` holds the equivalent overview for Claude Code. Keep the two in sync when architecture or commands change.
