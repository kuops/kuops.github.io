# Books 文件系统驱动重设计

日期：2026-05-16

## 目标

去掉 `books.config.ts`，让书籍结构完全从文件系统和 markdown frontmatter 自动推导，消除手动维护配置和内容之间的同步负担。

## 目录结构

### 带分组

```
src/data/books/astro-guide/
  index.md              ← 书籍元数据 (title, description, order)
  basics/
    _index.md           ← 分组元数据 (group: "基础", order: 1)
    intro.md            ← order: 1
    installation.md     ← order: 2
  advanced/
    _index.md           ← 分组元数据 (group: "进阶", order: 2)
    components.md       ← order: 1
    collections.md      ← order: 2
```

### 不分组（扁平结构）

```
src/data/books/getting-started/
  index.md              ← 书籍元数据
  intro.md              ← order: 1
  installation.md       ← order: 2
  configuration.md      ← order: 3
```

sidebar 不显示分组头，直接平铺列出章节。

## 命名规则

- 书籍 slug = 顶层目录名（`getting-started`、`astro-guide`）
- 子目录名 = 英文/ASCII，语义化（`basics`、`advanced`）
- 章节文件名 = 全局唯一语义化名称（`intro.md`、`installation.md`）
- 不需要数字前缀排序，排序由 `order` 字段控制
- glob pattern 改为 `**/*.md`（包含 `_index.md`），逻辑中按需区分 index.md、_index.md、章节

## URL

URL 反映完整目录路径：

```
basics/intro.md       → /books/astro-guide/basics/intro
advanced/components.md → /books/astro-guide/advanced/components
intro.md (无分组)      → /books/getting-started/intro
```

路由仍使用 `[...slug]` catch-all，天然支持多级。

## Schema

```ts
// content.config.ts — books collection
schema: z.object({
  title: z.string(),
  description: z.string(),
  order: z.number().default(0),
  group: z.string().optional(),    // 仅 _index.md 使用
  draft: z.boolean().optional(),   // 草稿支持
})
```

## 数据推导规则

| 信息 | 来源 |
|------|------|
| 书籍 slug | 顶层目录名 |
| 书籍标题/描述 | `index.md` frontmatter |
| 书籍排序 | `index.md` frontmatter `order` |
| 分组标题 | `_index.md` frontmatter `group` |
| 分组排序 | `_index.md` frontmatter `order` |
| 章节标题 | 各 md frontmatter `title` |
| 章节排序 | 各 md frontmatter `order` |

## 渲染逻辑

### 首页 `/books`

从 `getCollection("books")` 中筛选 `id` 以 `/index` 结尾的条目，提取书籍元数据，按 `order` 排序后渲染 `BookCard` 列表。不再 import `BOOKS` 数组。

### 书籍落地页 `/books/:book`

扫描该书所有章节（排除 `index.md`、`_index.md`），按（分组 order, 章节 order）排序，重定向到第一章。

### Sidebar 构建

```
buildSidebar(bookSlug, entries):
  1. 找所有 _index.md → 构建 groupMap { "basics": { title: "基础", order: 1 } }
  2. 章节按所在子目录归入对应 group
  3. 根目录下的章节归入无分组列表
  4. 组内按 order 排序
  5. 组间按 _index.md 的 order 排序
  6. 返回 SidebarGroup[]
```

输出结构与现有 `BookSidebar` 组件完全兼容，组件无需改动。

### 章节页 `/books/:book/[...slug]`

`getStaticPaths` 遍历所有非 `index.md`、非 `_index.md` 的文件。slug = glob loader 返回的完整 id（去掉书籍前缀）。

## 改动范围

| 文件 | 动作 |
|------|------|
| `src/books.config.ts` | 删除 |
| `src/content.config.ts` | schema 加 `group`、`draft`，glob 改为 `**/*.md` |
| `src/pages/books/index.astro` | 改为从 getCollection 聚合 |
| `src/pages/books/[book]/index.astro` | 首章查找逻辑更新 |
| `src/pages/books/[book]/[...slug].astro` | sidebar 构建改为自动推导 |
| `src/data/books/getting-started/*` | 重命名为语义化文件名 |
| `src/data/books/astro-guide/*` | 重命名为语义化文件名，加子目录分组 |
| `BookCard.astro` | Props 微调（不再依赖 BookConfig 类型） |
| `BookSidebar.astro` | 不变 |
| `BookLayout.astro` | 不变 |

## 与当前显示效果的兼容性

- 首页卡片：外观不变，数据源从 BOOKS 数组改为 index.md 聚合
- Sidebar 分组：外观不变，数据从文件系统自动推导
- 章节内容：不变
- prev/next 导航：不变，数据源变了但渲染逻辑相同
- TOC：完全不变
- URL：变为嵌套路径（如 `/books/astro-guide/basics/intro`）
