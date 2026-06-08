# Astro 项目指南

## 命令（Commands）

- `npm run dev` — 在 `localhost:4321` 启动开发服务器
- `npm run build` — 运行 `astro check && astro build && pagefind --site dist && cp -r dist/pagefind public/`
- `npm run lint` — 运行 ESLint
- `npm run format:check` — 检查 Prettier 格式
- `npm run format` — 用 Prettier 自动格式化

## 验证（Verification）

写完代码后，必须按 CI 步骤逐一验证，确保全部通过：

1. `npm run lint` — eslint 检查
2. `npm run format:check` — prettier 格式检查
3. `npm run build` — astro check + build + pagefind 搜索索引

以上三项全部通过才算完成。如果 `format:check` 不通过，先运行 `npm run format` 自动修复再重新检查。

## 架构（Architecture）

基于 AstroPaper 的博客项目（Astro 5 + Tailwind CSS 4 + TypeScript）。

- `src/config.ts` — 站点级配置（title、author、lang、timezone 等）。默认 `lang: "zh"`、`timezone: "Asia/Shanghai"`。
- `src/content.config.ts` — blog 和 books collection 的 schema。博客文章位于 `src/data/blog/`，书籍内容位于 `src/data/books/`。
- `src/layouts/PostDetails.astro` — 文章详情页，采用双栏布局（正文 + TOC 侧边栏）。
- `src/components/TableOfContents.astro` — 右侧 TOC 组件，提取 `h2` 到 `h4` 标题并高亮当前阅读位置。
- `src/styles/global.css` — Tailwind 和主题变量定义，字体变量也在这里声明。
- `src/utils/books.ts` — books 工具模块，从文件系统结构构建 sidebar、title map 和书籍元数据。由于 Astro glob loader 会把 `index.md` 的 `id` 解析为父目录名，因此这里使用 `filePath` 而不是 `id` 检测 `index.md` 和 `_index.md`。
- `src/types/books.ts` — `SidebarGroup` 类型定义。

## 字体（Fonts）

通过 Astro `experimental.fonts` 在 `astro.config.ts` 中加载两套字体：
- Google Sans Code（英文与代码块）— fallback 使用 `sans-serif`，不要改成 `monospace`，否则 Noto Sans SC 无法正常处理中日韩字符
- Noto Sans SC（中文）— fallback 使用 `sans-serif`

字体栈为 `var(--font-google-sans-code), var(--font-noto-sans-sc), sans-serif`。不要给 Google Sans Code 追加 `monospace` fallback，否则中文会退回到系统等宽字体。

## 路径别名（Path aliases）

`@/*` 映射到 `./src/*`（在 `tsconfig.json` 中配置）。

## 部署（Deployment）

通过 GitHub Actions (`.github/workflows/deploy.yml`) 部署到 GitHub Pages。推送到 `gh-pages` 分支时触发，使用 `npm ci` 和 `npm run build`，Node 版本为 24。注意：上游 CI 仍使用 pnpm，而本项目使用 npm。

请把 `src/config.ts` 里的 `website` 设置为真实的 GitHub Pages 地址。如果部署到 `<username>.github.io/<repo>`，还需要在 `astro.config.ts` 中增加 `base: "/<repo>/"`。

## Git

- **禁止 push**——只有用户明确说"推送"时才执行 `git push`
- commit 后也不要 push，等用户自己操作
- commit 风格：`type: short description`（如 `feat: add xxx`、`fix: correct xxx`）

## 代码风格（Code style）

- ESLint：`no-console: error`，使用 Astro plugin 和 `typescript-eslint`
- Prettier：使用 Astro 和 Tailwind 插件
- 除非用户明确要求，否则不要主动添加代码注释
