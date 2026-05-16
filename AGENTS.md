# AGENTS.md

## Commands

- `npm run dev` — dev server at `localhost:4321`
- `npm run build` — runs `astro check && astro build && pagefind --site dist && cp -r dist/pagefind public/`
- `npm run lint` — eslint
- `npm run format:check` — prettier check
- `npm run format` — prettier write

## Verification (MUST run after code changes)

写完代码后，必须按 CI 步骤逐一验证，确保全部通过：

1. `npm run format:check` — prettier 格式检查
2. `npm run lint` — eslint 检查
3. `npm run build` — astro check + build + pagefind 搜索索引

以上三项全部通过才算完成。如果 `format:check` 不通过，先运行 `npm run format` 自动修复再重新检查。

## Architecture

AstroPaper-based blog (Astro 5 + Tailwind CSS 4 + TypeScript).

- `src/config.ts` — site-wide config (title, author, lang, timezone, etc.). `lang: "zh"`, `timezone: "Asia/Shanghai"`.
- `src/content.config.ts` — blog and books collection schemas. Blog posts in `src/data/blog/`, books in `src/data/books/`.
- `src/layouts/PostDetails.astro` — article detail page with two-column layout (content + TOC sidebar).
- `src/components/TableOfContents.astro` — right-side TOC, extracts h2-h4 headings, scroll-highlighted.
- `src/styles/global.css` — Tailwind + theme variables. Font variables defined here.
- `src/utils/books.ts` — books utility module. Builds sidebar, title map, and book metadata from filesystem structure. Uses `filePath` (not `id`) to detect `index.md` and `_index.md` because Astro glob loader resolves `index.md` ids to parent directory names.
- `src/types/books.ts` — `SidebarGroup` type definition.

### Blog post frontmatter (required)

```yaml
title: string
pubDatetime: date      # NOT publishDate, NOT date
description: string    # NOT summary
tags: string[]
```

Posts prefixed with `_` are ignored by the glob loader. Set `draft: true` to exclude from production.

### Books (filesystem-driven)

Books are auto-derived from directory structure — no config file needed.

```
src/data/books/
  getting-started/            ← 一本书 = 一个顶层目录
    index.md                  ← 书籍元数据 (title, description, order)
    intro.md                  ← 扁平章节（无分组）
    installation.md
  astro-guide/
    index.md                  ← 书籍元数据
    basics/                   ← 子目录 = 分组
      _index.md               ← 分组元数据 (group: "基础", order: 1)
      intro.md
      installation.md
    advanced/
      _index.md               ← group: "进阶", order: 2
      components.md
      collections.md
```

**Book index.md frontmatter:**
```yaml
title: string
description: string
order: number
```

**Group _index.md frontmatter:**
```yaml
title: string       # 通常与 group 同值
description: string
group: string       # 分组显示名
order: number       # 分组排序
```

**Chapter frontmatter:**
```yaml
title: string
description: string
order: number       # 组内排序
draft: boolean      # 可选，排除生产构建
```

**关键：** Astro glob loader 把 `index.md` 的 id 解析为父目录名（如 `getting-started/index.md` → id `getting-started`），不是 `getting-started/index`。所以 `src/utils/books.ts` 用 `filePath` 而不是 `id` 来检测 `index.md` 和 `_index.md`。

URL 反映完整目录路径：`/books/astro-guide/basics/intro`。

## Fonts

Two fonts loaded via Astro `experimental.fonts` in `astro.config.ts`:
- Google Sans Code (English, code blocks) — fallbacks to sans-serif, NOT monospace (to allow Noto Sans SC to render CJK)
- Noto Sans SC (Chinese) — fallbacks to sans-serif

Font stack: `var(--font-google-sans-code), var(--font-noto-sans-sc), sans-serif`. Do NOT add `monospace` as fallback on Google Sans Code or Chinese will render as monospace system fonts.

## Path aliases

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Deployment

GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`). Triggers on push to `main`. Uses `npm ci` + `npm run build`. Note: upstream CI still uses pnpm but this project uses npm.

Set `src/config.ts` `website` to the actual GitHub Pages URL. If deploying to `<username>.github.io/<repo>`, add `base: "/<repo>/"` in `astro.config.ts`.

## Code style

- ESLint: `no-console: error`, astro plugin + typescript-eslint
- Prettier: astro + tailwind plugins
- No comments in code unless requested

## Content length guidelines

### Blog posts
- **Length:** 1000–2500 字（阅读 5–10 分钟）
- 太短像碎片，太长读者容易流失
- 教程/深度解析可放宽至 3000+ 字

### Book chapters
- **Length:** 3000–8000 字（阅读 15–30 分钟）
- 小说章节通常更短（2000–5000 字）
- 非虚构/技术书可更长
- **核心原则：** 一个章节只讲清楚一个主题，自然分段
