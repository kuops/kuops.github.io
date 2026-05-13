# Books 功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 AstroPaper 博客中新增 Books 模块，包含卡片展示页和三栏阅读页（左侧章节导航 + 中间内容 + 右侧 TOC）。

**Architecture:** 新增 `books` 内容集合，文件目录结构映射路由。sidebar 配置集中在 `src/books.config.ts`。阅读页复用现有 Layout/Header/Footer/TableOfContents 组件，新增 BookSidebar 和 BookLayout。

**Tech Stack:** Astro 5 Content Collections (glob loader)、Tailwind CSS 4、TypeScript

---

## 文件结构

```
新建文件:
  src/books.config.ts              → sidebar 集中配置（书的元信息 + 章节目录）
  src/components/BookCard.astro    → 展示页卡片组件
  src/components/BookSidebar.astro → 左侧章节导航组件
  src/layouts/BookLayout.astro     → 三栏阅读布局
  src/data/books/getting-started/index.md    → 示例书首页
  src/data/books/getting-started/ch01.md     → 示例书章节
  src/data/books/getting-started/ch02.md     → 示例书章节
  src/data/books/getting-started/ch03.md     → 示例书章节
  src/pages/books/index.astro                → 卡片展示页
  src/pages/books/[book]/[...slug].astro     → 章节阅读页

修改文件:
  src/content.config.ts            → 新增 books 集合
  src/components/Header.astro      → 导航栏添加 Books 链接
```

---

### Task 1: 新增 books 内容集合

**Files:**
- Modify: `src/content.config.ts`

- [ ] **Step 1: 在 content.config.ts 中添加 books 集合**

在现有 `blog` 集合下方新增 `books` 集合定义：

```ts
export const BOOKS_PATH = "src/data/books";

const books = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${BOOKS_PATH}` }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().default(0),
  }),
});

export const collections = { blog, books };
```

注意：books 的 md 不需要 pubDatetime 等博客特有字段，只需要 title、description。`order` 用于在展示页排序。

- [ ] **Step 2: 创建示例书籍目录和文件**

```
src/data/books/getting-started/
  index.md
  ch01.md
  ch02.md
  ch03.md
```

`src/data/books/getting-started/index.md`:
```md
---
title: "入门指南"
description: "一份帮助你快速上手的入门指南。"
order: 1
---

# 入门指南

欢迎阅读入门指南。请从左侧选择章节开始阅读。
```

`src/data/books/getting-started/ch01.md`:
```md
---
title: "第一章 简介"
description: "了解基本概念"
order: 1
---

## 什么是这个项目

这是一个示例章节，用于演示 Books 功能。

## 核心特性

- 特性一
- 特性二
- 特性三

## 下一步

阅读 [第二章](./ch02) 了解更多。
```

`src/data/books/getting-started/ch02.md`:
```md
---
title: "第二章 安装"
description: "安装指南"
order: 2
---

## 环境要求

确保你的系统满足以下要求：

- Node.js 18+
- npm 9+

## 安装步骤

运行以下命令完成安装：

```bash
npm install
```

## 验证安装

```bash
npm run dev
```
```

`src/data/books/getting-started/ch03.md`:
```md
---
title: "第三章 配置"
description: "配置说明"
order: 3
---

## 基础配置

编辑配置文件来定制你的项目。

### 主题设置

支持深色和浅色模式。

### 字体设置

可以自定义正文字体和代码字体。

## 高级配置

详见相关文档。
```

- [ ] **Step 3: 运行 `npm run build` 验证集合定义正确**

```bash
npm run build
```

Expected: 构建成功，0 errors

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts src/data/books/
git commit -m "feat: add books content collection with sample data"
```

---

### Task 2: 创建 books sidebar 集中配置

**Files:**
- Create: `src/books.config.ts`

- [ ] **Step 1: 创建 sidebar 配置文件**

```ts
export interface SidebarGroup {
  text: string;
  items: string[];
}

export interface BookConfig {
  title: string;
  description: string;
  slug: string;
  sidebar: SidebarGroup[];
}

export const BOOKS: BookConfig[] = [
  {
    title: "入门指南",
    description: "一份帮助你快速上手的入门指南。",
    slug: "getting-started",
    sidebar: [
      {
        text: "开始",
        items: ["ch01", "ch02", "ch03"],
      },
    ],
  },
];

export function getBookConfig(slug: string): BookConfig | undefined {
  return BOOKS.find(b => b.slug === slug);
}

export function getAllBookSlugs(): string[] {
  return BOOKS.map(b => b.slug);
}
```

注意：`items` 里的字符串对应 md 文件名（不含 `.md` 后缀），与 glob loader 生成的 id 一致。

- [ ] **Step 2: Commit**

```bash
git add src/books.config.ts
git commit -m "feat: add books sidebar configuration"
```

---

### Task 3: 创建 BookCard 卡片组件

**Files:**
- Create: `src/components/BookCard.astro`

- [ ] **Step 1: 创建卡片组件**

组件接收 book 配置数据，渲染为可点击的卡片：

```astro
---
import type { BookConfig } from "@/books.config";

type Props = {
  book: BookConfig;
};

const { book } = Astro.props;
---

<a
  href={`/books/${book.slug}`}
  class="group block rounded-lg border border-border p-6 transition-colors hover:border-accent"
>
  <h2 class="text-xl font-semibold text-foreground group-hover:text-accent">
    {book.title}
  </h2>
  <p class="mt-2 text-sm text-foreground/60">{book.description}</p>
  <span class="mt-4 inline-block text-sm text-accent">
    开始阅读 →
  </span>
</a>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BookCard.astro
git commit -m "feat: add BookCard component"
```

---

### Task 4: 创建 BookSidebar 章节导航组件

**Files:**
- Create: `src/components/BookSidebar.astro`

- [ ] **Step 1: 创建章节导航组件**

```astro
---
import type { SidebarGroup } from "@/books.config";

type Props = {
  bookSlug: string;
  sidebar: SidebarGroup[];
  currentSlug: string;
};

const { bookSlug, sidebar, currentSlug } = Astro.props;
---

<nav class="book-sidebar" aria-label="章节导航">
  <ul class="space-y-1">
    {sidebar.map(group => (
      <li>
        <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
          {group.text}
        </div>
        <ul class="space-y-0.5">
          {group.items.map(item => {
            const href = `/books/${bookSlug}/${item}`;
            const isActive = currentSlug === item;
            return (
              <li>
                <a
                  href={href}
                  class:list={[
                    "block truncate rounded px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-foreground/60 hover:text-accent",
                  ]}
                >
                  {item}
                </a>
              </li>
            );
          })}
        </ul>
      </li>
    ))}
  </ul>
</nav>
```

注意：这里 `item` 直接显示文件名（如 ch01）。后续可以通过查询集合数据获取实际 title 来替代。

- [ ] **Step 2: Commit**

```bash
git add src/components/BookSidebar.astro
git commit -m "feat: add BookSidebar component"
```

---

### Task 5: 创建 BookLayout 三栏布局

**Files:**
- Create: `src/layouts/BookLayout.astro`

- [ ] **Step 1: 创建三栏布局**

布局结构：左侧 sidebar（固定宽度，sticky）+ 中间内容（flex-1）+ 右侧 TOC（复用现有组件）。宽度使用 `max-w-6xl` 以容纳三栏。

```astro
---
import Layout from "@/layouts/Layout.astro";
import Header from "@/components/Header.astro";
import Footer from "@/components/Footer.astro";
import BookSidebar from "@/components/BookSidebar.astro";
import TableOfContents from "@/components/TableOfContents.astro";
import type { SidebarGroup } from "@/books.config";

type Props = {
  title: string;
  description: string;
  bookSlug: string;
  sidebar: SidebarGroup[];
  currentSlug: string;
  headings: { depth: number; slug: string; text: string }[];
};

const {
  title,
  description,
  bookSlug,
  sidebar,
  currentSlug,
  headings,
} = Astro.props;
---

<Layout title={title} description={description} scrollSmooth>
  <Header maxWidth="mx-auto w-full max-w-6xl px-4" />
  <main
    id="main-content"
    class="mx-auto w-full max-w-6xl px-4 pb-12"
  >
    <div class="flex gap-8">
      <aside class="hidden w-48 flex-none lg:block">
        <div class="sticky top-20">
          <BookSidebar {bookSlug} {sidebar} {currentSlug} />
        </div>
      </aside>
      <div class="min-w-0 flex-1">
        <h1 class="mb-8 text-2xl font-bold text-accent sm:text-3xl">
          {title}
        </h1>
        <article
          id="article"
          class="app-prose w-full prose-pre:bg-(--shiki-light-bg) dark:prose-pre:bg-(--shiki-dark-bg)"
        >
          <slot />
        </article>
      </div>
      {headings.length > 0 && (
        <aside class="hidden w-52 flex-none xl:block">
          <div class="sticky top-20">
            <TableOfContents {headings} />
          </div>
        </aside>
      )}
    </div>
  </main>
  <Footer maxWidth="mx-auto w-full max-w-6xl px-4" />
</Layout>
```

- [ ] **Step 2: Commit**

```bash
git add src/layouts/BookLayout.astro
git commit -m "feat: add BookLayout with three-column design"
```

---

### Task 6: 创建展示页和阅读页路由

**Files:**
- Create: `src/pages/books/index.astro`
- Create: `src/pages/books/[book]/[...slug].astro`

- [ ] **Step 1: 创建卡片展示页**

```astro
---
import Layout from "@/layouts/Layout.astro";
import Header from "@/components/Header.astro";
import Footer from "@/components/Footer.astro";
import BookCard from "@/components/BookCard.astro";
import { BOOKS } from "@/books.config";
---

<Layout title="Books | My Blog" description="我的书籍收藏">
  <Header />
  <main id="main-content" class="app-layout py-12">
    <h1 class="mb-8 text-3xl font-bold">Books</h1>
    <div class="grid gap-6 sm:grid-cols-2">
      {BOOKS.map(book => <BookCard {book} />)}
    </div>
  </main>
  <Footer />
</Layout>
```

- [ ] **Step 2: 创建章节阅读页（动态路由）**

```astro
---
import { render, getCollection } from "astro:content";
import BookLayout from "@/layouts/BookLayout.astro";
import { BOOKS_PATH } from "@/content.config";
import { getBookConfig, getAllBookSlugs } from "@/books.config";

export async function getStaticPaths() {
  const allSlugs = getAllBookSlugs();
  const paths = [];

  for (const bookSlug of allSlugs) {
    const chapters = await getCollection("books", ({ id }) =>
      id.startsWith(bookSlug + "/")
    );
    for (const chapter of chapters) {
      const chapterSlug = chapter.id.replace(bookSlug + "/", "");
      paths.push({
        params: { book: bookSlug, slug: chapterSlug },
        props: { chapter },
      });
    }
  }

  return paths;
}

const { chapter } = Astro.props;
const { book, slug } = Astro.params;

const bookConfig = getBookConfig(book!);

if (!bookConfig) {
  return Astro.redirect("/404");
}

const { Content } = await render(chapter);

const headings: { depth: number; slug: string; text: string }[] =
  (chapter.rendered as any)?.metadata?.headings
    ?.filter((h: any) => h.depth >= 2 && h.depth <= 4)
    ?.map((h: any) => ({
      depth: h.depth,
      slug: h.slug,
      text: h.text,
    })) ?? [];
---

<BookLayout
  title={chapter.data.title}
  description={chapter.data.description}
  bookSlug={book!}
  sidebar={bookConfig.sidebar}
  currentSlug={slug!}
  {headings}
>
  <Content />
</BookLayout>
```

- [ ] **Step 3: 运行 `npm run build` 验证**

```bash
npm run build
```

Expected: 0 errors, 新的 books 页面生成成功

- [ ] **Step 4: Commit**

```bash
git add src/pages/books/
git commit -m "feat: add books listing page and chapter reading routes"
```

---

### Task 7: 导航栏添加 Books 链接

**Files:**
- Modify: `src/components/Header.astro`

- [ ] **Step 1: 在导航菜单中添加 Books 链接**

在 `Header.astro` 的 `<ul id="menu-items">` 中，Posts 链接之前添加：

```astro
<li class="col-span-2">
  <a href="/books" class:list={{ "active-nav": isActive("/books") }}>
    Books
  </a>
</li>
```

插入位置：在 `<li class="col-span-2">` Posts 链接之前。

- [ ] **Step 2: 运行 `npm run build` 验证**

```bash
npm run build
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.astro
git commit -m "feat: add Books link to navigation"
```

---

### Task 8: 优化 BookSidebar 显示章节标题

**Files:**
- Modify: `src/components/BookSidebar.astro`
- Modify: `src/pages/books/[book]/[...slug].astro`

当前 sidebar 直接显示文件名（ch01），需要改为显示 md 的 title。

- [ ] **Step 1: 修改阅读页路由，传入章节标题映射**

在 `[...slug].astro` 的 frontmatter 中构建 titleMap：

```ts
const allChapters = await getCollection("books", ({ id }) =>
  id.startsWith(bookConfig.slug + "/")
);
const titleMap: Record<string, string> = {};
for (const ch of allChapters) {
  const chSlug = ch.id.replace(bookConfig.slug + "/", "");
  titleMap[chSlug] = ch.data.title;
}
```

将 `titleMap` 传入 BookLayout，BookLayout 再传给 BookSidebar。

在调用 BookLayout 时添加 `titleMap` prop：
```astro
<BookLayout
  title={chapter.data.title}
  description={chapter.data.description}
  bookSlug={book!}
  sidebar={bookConfig.sidebar}
  currentSlug={slug!}
  titleMap={titleMap}
  {headings}
>
```

- [ ] **Step 2: 更新 BookLayout 接收并传递 titleMap**

在 BookLayout 的 Props 中添加 `titleMap: Record<string, string>`，并传给 BookSidebar。

- [ ] **Step 3: 更新 BookSidebar 使用 titleMap 显示标题**

在 BookSidebar 的 Props 中添加 `titleMap: Record<string, string>`，sidebar 链接文本从 `item` 改为 `titleMap[item] || item`。

- [ ] **Step 4: 运行 `npm run build` 验证**

```bash
npm run build
```

Expected: sidebar 显示中文章节标题而非文件名

- [ ] **Step 5: Commit**

```bash
git add src/components/BookSidebar.astro src/layouts/BookLayout.astro src/pages/books/
git commit -m "feat: show chapter titles in book sidebar"
```

---

### Task 9: 最终验证

- [ ] **Step 1: 运行完整构建**

```bash
npm run build
```

Expected: 0 errors, 0 warnings

- [ ] **Step 2: 启动 dev server 验证页面**

```bash
npm run dev
```

验证以下页面：
- `/books` — 卡片展示页，显示书籍卡片
- `/books/getting-started/index` — 书的首页，左侧有章节导航
- `/books/getting-started/ch01` — 章节页，左侧导航高亮当前章节，右侧 TOC 显示
- 导航栏 Books 链接可用

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete books module with card listing and three-column reading layout"
```
