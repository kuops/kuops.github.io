# AGENTS.md

详细指南已拆分到 `agents-md/` 目录：

- **[`agents-md/astro.md`](agents-md/astro.md)** — 开发指南：命令、验证、架构、部署、字体、Git、代码风格
- **[`agents-md/writing.md`](agents-md/writing.md)** — 内容创作：篇幅指南、frontmatter、书籍结构、写作质量
- **[`agents-md/tutorial-markdown.md`](agents-md/tutorial-markdown.md)** — 教程 Markdown 排版规范：标题、列表、callout、表格、代码块、图片、Mermaid
- **[`agents-md/tutorial-svg.md`](agents-md/tutorial-svg.md)** — 教程 SVG 插图规范：调色板、透明度、圆角、字体、结构模板、转换命令、检查清单

**必须遵守的规则（无论任务类型）：**

- 修改代码后必须按 CI 步逐一验证：`npm run lint` → `npm run format:check` → `npm run build`，全部通过才算完成（CI 顺序即如此；format:check 不通过时先 `npm run format` 修复）
- **仅修改 Markdown / SVG 内容**时可跳过 `npm run build`，只跑 `lint` → `format:check`；如果改了 SVG，还要重新生成同名 PNG
- 禁止 push —— 只有用户明确说"推送"时才执行 `git push`
- commit 风格：`type: short description`

**按任务类型加载对应指南：**

- 涉及代码修改（组件、样式、配置、构建）→ 先读 `agents-md/astro.md`
- 涉及内容创作（写文章、写章节）→ 先读 `agents-md/writing.md`
- 涉及 Markdown 排版（callout、表格、代码块等）→ 先读 `agents-md/tutorial-markdown.md`
- 涉及 SVG 插图（画图、生成 PNG）→ 先读 `agents-md/tutorial-svg.md`
- 多种都涉及 → 都读
