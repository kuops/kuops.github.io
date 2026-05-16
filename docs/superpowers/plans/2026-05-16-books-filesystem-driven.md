# Books 文件系统驱动重设计 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去掉 `books.config.ts`，书籍结构完全从文件系统和 markdown frontmatter 自动推导。

**Architecture:** 目录结构即数据源 — 子目录 = 分组，`_index.md` = 分组元数据，`index.md` = 书籍元数据。新增 `src/utils/books.ts` 工具模块封装 sidebar 构建逻辑。`SidebarGroup` 类型迁移到独立文件。

**Tech Stack:** Astro 5 Content Collections (glob loader), TypeScript, Zod

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/books.ts` | Create | `SidebarGroup` 类型定义 |
| `src/utils/books.ts` | Create | `buildSidebar`, `getBookMeta`, `getChapterList` 等工具函数 |
| `src/content.config.ts` | Modify | schema 加 `group`/`draft`，glob 改 `**/*.md` |
| `src/books.config.ts` | Delete | 被 utils/books.ts 和 types/books.ts 替代 |
| `src/components/BookCard.astro` | Modify | Props 从 BookConfig 改为简化类型 |
| `src/components/BookSidebar.astro` | Modify | import 路径改为 types/books.ts |
| `src/layouts/BookLayout.astro` | Modify | import 路径改为 types/books.ts |
| `src/pages/books/index.astro` | Modify | 从 getCollection 聚合书籍列表 |
| `src/pages/books/[book]/index.astro` | Modify | 从文件系统自动查找首章 |
| `src/pages/books/[book]/[...slug].astro` | Modify | 用 utils/books.ts 构建 sidebar |
| `src/data/books/getting-started/*` | Restructure | 语义化文件名 |
| `src/data/books/astro-guide/*` | Restructure | 子目录分组 + 语义化文件名 |

---

### Task 1: 创建类型定义文件

**Files:**
- Create: `src/types/books.ts`

- [ ] **Step 1: 创建 `src/types/books.ts`**

```ts
export interface SidebarGroup {
  text: string;
  items: string[];
}
```

从 `src/books.config.ts` 提取 `SidebarGroup` 接口。

- [ ] **Step 2: Commit**

```bash
git add src/types/books.ts
git commit -m "feat: extract SidebarGroup type to dedicated types file"
```

---

### Task 2: 创建工具模块 `src/utils/books.ts`

**Files:**
- Create: `src/utils/books.ts`

核心工具函数，封装所有文件系统推导逻辑。

- [ ] **Step 1: 创建 `src/utils/books.ts`**

```ts
import { getCollection, type CollectionEntry } from "astro:content";
import type { SidebarGroup } from "@/types/books";

type BookEntry = CollectionEntry<"books">;

interface BookMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
}

function isIndex(id: string) {
  return id.endsWith("/index") || id === "index";
}

function isGroupIndex(id: string) {
  return /\/_index$/.test(id);
}

function getBookSlug(id: string) {
  return id.split("/")[0];
}

function getRelativePath(id: string) {
  return id.split("/").slice(1).join("/");
}

function getGroupDir(id: string) {
  const parts = id.split("/");
  return parts.length >= 3 ? parts[1] : null;
}

export async function getAllBooks(): Promise<BookMeta[]> {
  const entries = await getCollection("books", ({ id }) => isIndex(id));
  return entries
    .map(e => ({
      slug: getBookSlug(e.id),
      title: e.data.title,
      description: e.data.description,
      order: e.data.order ?? 0,
    }))
    .sort((a, b) => a.order - b.order);
}

export async function getBookMeta(
  bookSlug: string
): Promise<BookMeta | undefined> {
  const books = await getAllBooks();
  return books.find(b => b.slug === bookSlug);
}

export async function getBookEntries(
  bookSlug: string
): Promise<BookEntry[]> {
  const prefix = bookSlug + "/";
  return getCollection("books", ({ id }) => id.startsWith(prefix));
}

interface GroupMeta {
  dir: string;
  title: string;
  order: number;
}

export async function buildSidebar(
  bookSlug: string,
  entries: BookEntry[]
): Promise<SidebarGroup[]> {
  const groupIndexEntries = entries.filter(
    e => getBookSlug(e.id) === bookSlug && isGroupIndex(e.id)
  );

  const groupMap = new Map<string, GroupMeta>();
  for (const e of groupIndexEntries) {
    const dir = getGroupDir(e.id)!;
    groupMap.set(dir, {
      dir,
      title: e.data.group || dir,
      order: e.data.order ?? 0,
    });
  }

  const chapters = entries.filter(
    e =>
      getBookSlug(e.id) === bookSlug &&
      !isIndex(e.id) &&
      !isGroupIndex(e.id)
  );

  const hasGroups = groupMap.size > 0;

    if (!hasGroups) {
    const sorted = chapters.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
    return [
      {
        text: "",
        items: sorted.map(e => getRelativePath(e.id)),
      },
    ];
  }

  const groupsByDir = new Map<string, BookEntry[]>();
  const rootChapters: BookEntry[] = [];

  for (const ch of chapters) {
    const dir = getGroupDir(ch.id);
    if (dir && groupMap.has(dir)) {
      if (!groupsByDir.has(dir)) groupsByDir.set(dir, []);
      groupsByDir.get(dir)!.push(ch);
    } else {
      rootChapters.push(ch);
    }
  }

  const result: SidebarGroup[] = [];

  if (rootChapters.length > 0) {
    const sorted = rootChapters.sort(
      (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)
    );
    result.push({
      text: "",
      items: sorted.map(e => getRelativePath(e.id)),
    });
  }

  const sortedGroups = [...groupMap.values()].sort(
    (a, b) => a.order - b.order
  );

  for (const g of sortedGroups) {
    const items = (groupsByDir.get(g.dir) || []).sort(
      (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)
    );
    if (items.length > 0) {
      result.push({
        text: g.title,
        items: items.map(e => getRelativePath(e.id)),
      });
    }
  }

  return result;
}

export function buildTitleMap(entries: BookEntry[], bookSlug: string) {
  const map: Record<string, string> = {};
  const prefix = bookSlug + "/";
  for (const e of entries) {
    if (!isIndex(e.id) && !isGroupIndex(e.id) && e.id.startsWith(prefix)) {
      map[getRelativePath(e.id)] = e.data.title;
    }
  }
  return map;
}

export function getFlatItems(sidebar: SidebarGroup[]) {
  return sidebar.flatMap(g => g.items);
}

export async function getFirstChapter(
  bookSlug: string,
  entries: BookEntry[]
): Promise<string | null> {
  const sidebar = await buildSidebar(bookSlug, entries);
  const flat = getFlatItems(sidebar);
  return flat.length > 0 ? flat[0] : null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/books.ts
git commit -m "feat: add books utility module for filesystem-driven structure"
```

---

### Task 3: 更新 content.config.ts schema

**Files:**
- Modify: `src/content.config.ts`

- [ ] **Step 1: 更新 books collection 的 glob pattern 和 schema**

将 `src/content.config.ts` 的 books collection 改为：

```ts
const books = defineCollection({
  loader: glob({ pattern: "**/*.md", base: `./${BOOKS_PATH}` }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().default(0),
    group: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});
```

两处改动：
1. glob pattern 从 `**/[^_]*.md` 改为 `**/*.md`（包含 `_index.md`）
2. schema 加 `group` 和 `draft` 字段

- [ ] **Step 2: Commit**

```bash
git add src/content.config.ts
git commit -m "feat: update books schema with group/draft fields, include _index.md in glob"
```

---

### Task 4: 更新组件 import 路径

**Files:**
- Modify: `src/components/BookSidebar.astro:2`
- Modify: `src/layouts/BookLayout.astro:11`

- [ ] **Step 1: 更新 `BookSidebar.astro` 的 import**

第 2 行从：
```ts
import type { SidebarGroup } from "@/books.config";
```
改为：
```ts
import type { SidebarGroup } from "@/types/books";
```

- [ ] **Step 2: 更新 `BookSidebar.astro` 的渲染逻辑**

将 sidebar.map 的渲染部分（第 19-58 行）替换为支持空 text 分组（无分组书籍）的版本：

```astro
{
  sidebar.map(group => {
    const isActive = group.items.includes(currentSlug);
    const links = group.items.map(item => {
      const href = `/books/${bookSlug}/${item}`;
      const isCurrent = currentSlug === item;
      const label = titleMap[item] || item;
      return (
        <a
          href={href}
          class:list={["book-chapter-link", { active: isCurrent }]}
        >
          {label}
        </a>
      );
    });

    if (!group.text) {
      return <div class="book-group-body space-y-0.5">{links}</div>;
    }

    return (
      <details
        open={isActive}
        class="book-group group"
        data-book-group={group.text}
      >
        <summary class="book-group-title">
          <svg
            class="book-group-arrow"
            viewBox="0 0 16 16"
            fill="currentColor"
            width="12"
            height="12"
          >
            <path d="M6 3.5L10.5 8L6 12.5z" />
          </svg>
          {group.text}
        </summary>
        <div class="book-group-body">{links}</div>
      </details>
    );
  })
}
```

当 `group.text` 为空时（无分组书籍），直接渲染章节链接列表，不显示折叠组。

- [ ] **Step 3: 更新 `BookLayout.astro` 的 import**

第 11 行从：
```ts
import type { SidebarGroup } from "@/books.config";
```
改为：
```ts
import type { SidebarGroup } from "@/types/books";
```

- [ ] **Step 4: Commit**

```bash
git add src/components/BookSidebar.astro src/layouts/BookLayout.astro
git commit -m "refactor: update SidebarGroup import to types/books.ts"
```

---

### Task 5: 更新 BookCard 组件

**Files:**
- Modify: `src/components/BookCard.astro`

- [ ] **Step 1: 简化 BookCard Props**

`src/components/BookCard.astro` 完整替换为：

```astro
---
type Props = {
  slug: string;
  title: string;
  description: string;
};

const { slug, title, description } = Astro.props;
---

<a
  href={`/books/${slug}`}
  class="group block rounded-lg border border-border p-6 transition-colors hover:border-accent"
>
  <h2 class="text-xl font-semibold text-foreground group-hover:text-accent">
    {title}
  </h2>
  <p class="mt-2 text-sm text-foreground/60">{description}</p>
  <span class="mt-4 inline-block text-sm text-accent"> 开始阅读 → </span>
</a>
```

不再依赖 `BookConfig` 类型，改为接收扁平的 slug/title/description props。

- [ ] **Step 2: Commit**

```bash
git add src/components/BookCard.astro
git commit -m "refactor: simplify BookCard props, remove BookConfig dependency"
```

---

### Task 6: 更新首页 `/books`

**Files:**
- Modify: `src/pages/books/index.astro`

- [ ] **Step 1: 改为从 getCollection 聚合**

`src/pages/books/index.astro` 完整替换为：

```astro
---
import { getCollection } from "astro:content";
import Layout from "@/layouts/Layout.astro";
import Main from "@/layouts/Main.astro";
import Header from "@/components/Header.astro";
import Footer from "@/components/Footer.astro";
import BookCard from "@/components/BookCard.astro";
import { getAllBooks } from "@/utils/books";

const books = await getAllBooks();
---

<Layout title="Books | My Blog" description="我的书籍收藏">
  <Header />
  <Main pageTitle="Books" pageDesc="All the articles I've posted.">
    <div class="grid gap-6 sm:grid-cols-2">
      {books.map(book => <BookCard slug={book.slug} title={book.title} description={book.description} />)}
    </div>
  </Main>
  <Footer />
</Layout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/books/index.astro
git commit -m "refactor: books index page uses getCollection instead of BOOKS config"
```

---

### Task 7: 更新书籍落地页 `/books/:book`

**Files:**
- Modify: `src/pages/books/[book]/index.astro`

- [ ] **Step 1: 改为从文件系统查找首章**

`src/pages/books/[book]/index.astro` 完整替换为：

```astro
---
import { getCollection } from "astro:content";
import { getAllBooks, getBookEntries, getFirstChapter } from "@/utils/books";

export async function getStaticPaths() {
  const books = await getAllBooks();
  return books.map(b => ({ params: { book: b.slug } }));
}

const { book } = Astro.params;
const entries = await getBookEntries(book!);
const first = await getFirstChapter(book!, entries);

if (first) {
  return Astro.redirect(`/books/${book}/${first}`);
}

return Astro.redirect("/books");
---
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/books/[book]/index.astro
git commit -m "refactor: book landing page uses filesystem-driven first chapter lookup"
```

---

### Task 8: 更新章节渲染页 `/books/:book/[...slug]`

**Files:**
- Modify: `src/pages/books/[book]/[...slug].astro`

这是改动最大的页面。核心变化：
1. `getStaticPaths` 从文件系统遍历所有章节（排除 index.md 和 _index.md）
2. sidebar 构建改为 `buildSidebar()`
3. titleMap 构建改为 `buildTitleMap()`
4. prev/next 计算改为从 flatItems 获取

- [ ] **Step 1: 重写页面**

`src/pages/books/[book]/[...slug].astro` 完整替换为：

```astro
---
import { render, getCollection } from "astro:content";
import BookLayout from "@/layouts/BookLayout.astro";
import {
  getBookEntries,
  buildSidebar,
  buildTitleMap,
  getFlatItems,
  getAllBooks,
} from "@/utils/books";
import IconChevronLeft from "@/assets/icons/IconChevronLeft.svg";
import IconChevronRight from "@/assets/icons/IconChevronRight.svg";

export async function getStaticPaths() {
  const books = await getAllBooks();
  const paths = [];

  for (const book of books) {
    const entries = await getBookEntries(book.slug);
    for (const entry of entries) {
      const relativePath = entry.id.replace(book.slug + "/", "");
      if (
        relativePath === "index" ||
        relativePath === "_index" ||
        relativePath.endsWith("/index") ||
        relativePath.endsWith("/_index")
      ) {
        continue;
      }
      paths.push({
        params: { book: book.slug, slug: relativePath },
        props: { chapter: entry },
      });
    }
  }

  return paths;
}

const { chapter } = Astro.props;
const { book, slug } = Astro.params;

const entries = await getBookEntries(book!);
const sidebar = await buildSidebar(book!, entries);
const titleMap = buildTitleMap(entries, book!);

const { Content, headings: allHeadings } = await render(chapter);
const headings = allHeadings.filter(h => h.depth >= 2 && h.depth <= 4);

const flatItems = getFlatItems(sidebar);
const currentIndex = flatItems.indexOf(slug!);
const prevSlug = currentIndex > 0 ? flatItems[currentIndex - 1] : null;
const nextSlug =
  currentIndex < flatItems.length - 1 ? flatItems[currentIndex + 1] : null;
---

<BookLayout
  title={chapter.data.title}
  description={chapter.data.description}
  bookSlug={book!}
  {sidebar}
  currentSlug={slug!}
  {titleMap}
  {headings}
>
  <Content />

  <hr class="my-8 border-dashed" />

  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
    {
      prevSlug ? (
        <a
          href={`/books/${book}/${prevSlug}`}
          class="flex w-full gap-1 hover:opacity-75"
        >
          <IconChevronLeft class="inline-block flex-none rtl:rotate-180" />
          <div>
            <span class="text-sm text-foreground/60">上一章</span>
            <div class="text-sm font-medium text-accent">
              {titleMap[prevSlug]}
            </div>
          </div>
        </a>
      ) : (
        <div />
      )
    }
    {
      nextSlug ? (
        <a
          href={`/books/${book}/${nextSlug}`}
          class="flex w-full justify-end gap-1 text-end hover:opacity-75"
        >
          <div>
            <span class="text-sm text-foreground/60">下一章</span>
            <div class="text-sm font-medium text-accent">
              {titleMap[nextSlug]}
            </div>
          </div>
          <IconChevronRight class="inline-block flex-none rtl:rotate-180" />
        </a>
      ) : null
    }
  </div>
</BookLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/books/[book]/[...slug].astro
git commit -m "refactor: chapter page uses filesystem-driven sidebar and titleMap"
```

---

### Task 9: 重构示例内容 — getting-started

**Files:**
- Delete: `src/data/books/getting-started/ch01.md`
- Delete: `src/data/books/getting-started/ch02.md`
- Delete: `src/data/books/getting-started/ch03.md`
- Modify: `src/data/books/getting-started/index.md`
- Create: `src/data/books/getting-started/intro.md`
- Create: `src/data/books/getting-started/installation.md`
- Create: `src/data/books/getting-started/configuration.md`

getting-started 保持扁平结构（无子目录分组）。

- [ ] **Step 1: 重命名文件**

```bash
cd src/data/books/getting-started
mv ch01.md intro.md
mv ch02.md installation.md
mv ch03.md configuration.md
```

- [ ] **Step 2: 更新 `intro.md` frontmatter**

title 从 "第一章 简介" 改为 "简介"，description 和 order 保持不变。内容中相对链接 `./ch02` 改为 `./installation`。

- [ ] **Step 3: 更新 `installation.md` frontmatter**

title 从 "第二章 安装" 改为 "安装"，内容无相对链接需改。

- [ ] **Step 4: 更新 `configuration.md` frontmatter**

title 从 "第三章 配置" 改为 "配置"，内容无相对链接需改。

- [ ] **Step 5: Commit**

```bash
git add src/data/books/getting-started/
git commit -m "refactor: rename getting-started chapters to semantic filenames"
```

---

### Task 10: 重构示例内容 — astro-guide

**Files:**
- Delete: `src/data/books/astro-guide/ch01.md` ~ `ch04.md`
- Modify: `src/data/books/astro-guide/index.md`
- Create: `src/data/books/astro-guide/basics/_index.md`
- Create: `src/data/books/astro-guide/basics/intro.md`
- Create: `src/data/books/astro-guide/basics/installation.md`
- Create: `src/data/books/astro-guide/advanced/_index.md`
- Create: `src/data/books/astro-guide/advanced/components.md`
- Create: `src/data/books/astro-guide/advanced/collections.md`

astro-guide 改为子目录分组结构。

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p src/data/books/astro-guide/basics
mkdir -p src/data/books/astro-guide/advanced
```

- [ ] **Step 2: 创建 `basics/_index.md`**

```md
---
title: "基础"
description: "基础章节"
group: "基础"
order: 1
---
```

- [ ] **Step 3: 移动 ch01.md → basics/intro.md**

将 `astro-guide/ch01.md` 移动为 `astro-guide/basics/intro.md`。更新 frontmatter：title 改为 "认识 Astro"，description 不变，order 改为 1。内容中相对链接 `./ch02` 改为 `./installation`。

- [ ] **Step 4: 移动 ch02.md → basics/installation.md**

将 `astro-guide/ch02.md` 移动为 `astro-guide/basics/installation.md`。更新 frontmatter：title 改为 "安装与创建项目"，description 不变，order 改为 2。内容中相对链接 `./ch03` 改为 `../advanced/components`。

- [ ] **Step 5: 创建 `advanced/_index.md`**

```md
---
title: "进阶"
description: "进阶章节"
group: "进阶"
order: 2
---
```

- [ ] **Step 6: 移动 ch03.md → advanced/components.md**

将 `astro-guide/ch03.md` 移动为 `astro-guide/advanced/components.md`。更新 frontmatter：title 改为 "组件与页面"，description 不变，order 改为 1。内容中相对链接 `./ch04` 改为 `./collections`。

- [ ] **Step 7: 移动 ch04.md → advanced/collections.md**

将 `astro-guide/ch04.md` 移动为 `astro-guide/advanced/collections.md`。更新 frontmatter：title 改为 "内容集合"，description 不变，order 改为 2。内容无相对链接需改。

- [ ] **Step 8: 删除旧文件**

```bash
rm src/data/books/astro-guide/ch01.md
rm src/data/books/astro-guide/ch02.md
rm src/data/books/astro-guide/ch03.md
rm src/data/books/astro-guide/ch04.md
```

- [ ] **Step 9: Commit**

```bash
git add src/data/books/astro-guide/
git commit -m "refactor: restructure astro-guide with subdirectory groups and semantic filenames"
```

---

### Task 11: 删除 books.config.ts

**Files:**
- Delete: `src/books.config.ts`

- [ ] **Step 1: 删除文件**

```bash
rm src/books.config.ts
```

- [ ] **Step 2: Commit**

```bash
git add -u src/books.config.ts
git commit -m "refactor: remove books.config.ts, replaced by filesystem-driven utils/books.ts"
```

---

### Task 12: 验证构建

- [ ] **Step 1: 运行 format 检查**

```bash
npm run format:check
```

如果不通过，先运行 `npm run format` 自动修复，再重新检查。

- [ ] **Step 2: 运行 lint 检查**

```bash
npm run lint
```

- [ ] **Step 3: 运行完整构建**

```bash
npm run build
```

构建包含 astro check + build + pagefind 索引。预期全部通过。

- [ ] **Step 4: 修复问题（如有）并提交**

```bash
git add -A
git commit -m "fix: resolve build issues after books refactor"
```

---

### Task 13: 更新文档

**Files:**
- Modify: `docs/architecture.md`（如存在）
- Modify: `AGENTS.md`

- [ ] **Step 1: 更新 AGENTS.md 中的架构描述**

在 Architecture 部分更新 books 相关描述，反映新的文件系统驱动设计。

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md docs/
git commit -m "docs: update architecture docs for filesystem-driven books"
```
