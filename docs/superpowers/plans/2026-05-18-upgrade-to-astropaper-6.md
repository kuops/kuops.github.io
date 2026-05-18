# AstroPaper 6.0 功能对齐升级计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前项目对齐 AstroPaper 6.0 的架构改进和 UX 增强，同时保留 Books 系统、Mermaid 渲染、中文优化等自定义功能。

**Architecture:** 渐进式升级，分为 5 个独立阶段：配置架构、Tailwind 集成、i18n 系统、UX 组件增强、样式对齐。每个阶段独立可测，完成后全量验证。

**Tech Stack:** Astro 6 + Tailwind CSS 4 (Vite plugin) + TypeScript + Pagefind

---

## 阶段概览

| 阶段 | 任务数 | 风险 | 预计时间 |
|------|--------|------|----------|
| Phase 1: 配置架构重构 | 3 | 中 | 30min |
| Phase 2: Tailwind 集成迁移 | 2 | 中 | 15min |
| Phase 3: i18n 国际化系统 | 3 | 低 | 25min |
| Phase 4: UX 组件增强 | 5 | 低 | 40min |
| Phase 5: 样式对齐 + 清理 | 3 | 低 | 20min |

---

## Phase 1: 配置架构重构

将 `src/config.ts` 拆分为用户配置文件 + 内部解析配置，引入类型安全辅助函数。

### Task 1.1: 创建类型定义文件

**Files:**
- Create: `src/types/config.ts`

- [ ] **Step 1: 创建类型定义**

```typescript
// src/types/config.ts

interface SiteConfig {
  url: string;
  title: string;
  description: string;
  author: string;
  profile?: string;
  ogImage?: string;
  lang: string;
  timezone: string;
  dir: "ltr" | "rtl";
  googleVerification?: string;
}

interface PostsConfig {
  perPage: number;
  perIndex: number;
  scheduledPostMargin: number;
}

interface FeaturesConfig {
  lightAndDarkMode: boolean;
  dynamicOgImage: boolean;
  showArchives: boolean;
  showBackButton: boolean;
  editPost: {
    enabled: boolean;
    text: string;
    url: string;
  };
  search: boolean;
}

interface SocialLink {
  name: string;
  url: string;
  linkTitle?: string;
}

interface ShareLink {
  name: string;
  url: string;
  linkTitle?: string;
}

interface AstroPaperConfig {
  site: SiteConfig;
  posts: PostsConfig;
  features: FeaturesConfig;
  socials: SocialLink[];
  shareLinks: ShareLink[];
}

type ResolvedAstroPaperConfig = Required<AstroPaperConfig>;

function defineAstroPaperConfig(config: AstroPaperConfig): AstroPaperConfig {
  return config;
}

export type {
  SiteConfig,
  PostsConfig,
  FeaturesConfig,
  SocialLink,
  ShareLink,
  AstroPaperConfig,
  ResolvedAstroPaperConfig,
};

export { defineAstroPaperConfig };
```

- [ ] **Step 2: 验证类型检查通过**

Run: `npx astro check`
Expected: 无新增错误

---

### Task 1.2: 创建 astro-paper.config.ts 用户配置文件

**Files:**
- Create: `astro-paper.config.ts`

- [ ] **Step 1: 创建用户配置文件**

将当前 `src/config.ts` 的 SITE 内容迁移到新文件，使用 `defineAstroPaperConfig` 包装：

```typescript
// astro-paper.config.ts
import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://blog.example.com/",
    title: "My Blog",
    description: "一个基于 Astro 的个人博客。",
    author: "Blog Author",
    profile: "https://blog.example.com/",
    ogImage: "astropaper-og.jpg",
    lang: "zh",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: false,
      text: "Edit page",
      url: "",
    },
    search: true,
  },
  socials: [
    { name: "github", url: "https://github.com/satnaing/astro-paper" },
    { name: "x", url: "https://x.com/username" },
    {
      name: "linkedin",
      url: "https://www.linkedin.com/in/username/",
    },
    { name: "mail", url: "mailto:yourmail@gmail.com" },
  ],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    {
      name: "pinterest",
      url: "https://pinterest.com/pin/create/button/?url=",
    },
    {
      name: "mail",
      url: "mailto:?subject=See%20this%20post&body=",
    },
  ],
});
```

---

### Task 1.3: 重写 src/config.ts 为解析后的内部配置

**Files:**
- Modify: `src/config.ts`
- Modify: `src/constants.ts` (删除，社交链接移入配置)
- Modify: `src/components/Socials.astro` (从配置读取 socials)
- Modify: `src/components/ShareLinks.astro` (从配置读取 shareLinks)
- Modify: 所有 import `@/constants` 的文件

- [ ] **Step 1: 重写 src/config.ts**

将 SITE 改为从 `astro-paper.config.ts` 读取并解析，保持向后兼容（SITE 对象结构不变，所有现有代码继续工作）：

```typescript
// src/config.ts
import type { ResolvedAstroPaperConfig } from "@/types/config";
import config from "../astro-paper.config";
import { PUBLIC_GOOGLE_SITE_VERIFICATION } from "astro:env/client";

const resolvedConfig: ResolvedAstroPaperConfig = {
  site: {
    url: config.site.url,
    title: config.site.title,
    description: config.site.description,
    author: config.site.author,
    profile: config.site.profile ?? config.site.url,
    ogImage: config.site.ogImage ?? "astropaper-og.jpg",
    lang: config.site.lang ?? "en",
    timezone: config.site.timezone ?? "UTC",
    dir: config.site.dir ?? "ltr",
    googleVerification:
      config.site.googleVerification ?? PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
  },
  posts: {
    perPage: config.posts.perPage,
    perIndex: config.posts.perIndex,
    scheduledPostMargin: config.posts.scheduledPostMargin,
  },
  features: {
    lightAndDarkMode: config.features.lightAndDarkMode,
    dynamicOgImage: config.features.dynamicOgImage,
    showArchives: config.features.showArchives,
    showBackButton: config.features.showBackButton,
    editPost: config.features.editPost,
    search: config.features.search,
  },
  socials: config.socials,
  shareLinks: config.shareLinks,
};

// Backward-compatible SITE object (flat structure)
export const SITE = {
  website: resolvedConfig.site.url,
  author: resolvedConfig.site.author,
  profile: resolvedConfig.site.profile,
  desc: resolvedConfig.site.description,
  title: resolvedConfig.site.title,
  ogImage: resolvedConfig.site.ogImage,
  lightAndDarkMode: resolvedConfig.features.lightAndDarkMode,
  postPerIndex: resolvedConfig.posts.perIndex,
  postPerPage: resolvedConfig.posts.perPage,
  scheduledPostMargin: resolvedConfig.posts.scheduledPostMargin,
  showArchives: resolvedConfig.features.showArchives,
  showBackButton: resolvedConfig.features.showBackButton,
  editPost: resolvedConfig.features.editPost,
  dynamicOgImage: resolvedConfig.features.dynamicOgImage,
  dir: resolvedConfig.site.dir,
  lang: resolvedConfig.site.lang,
  timezone: resolvedConfig.site.timezone,
  googleVerification: resolvedConfig.site.googleVerification,
} as const;

export const SOCIALS = resolvedConfig.socials;
export const SHARE_LINKS = resolvedConfig.shareLinks;
export const FEATURES = resolvedConfig.features;
```

- [ ] **Step 2: 更新 Socials.astro — 改为动态图标导入**

替换当前的静态 SVG 导入方式，改用 `import.meta.glob` 动态匹配图标（与 6.0 对齐）：

```astro
---
import { SOCIALS } from "@/config";

const socialIcons = import.meta.glob<{ default: any }>(
  "@/assets/icons/socials/*.svg",
  { eager: true }
);

function getSocialIcon(name: string) {
  const key = Object.keys(socialIcons).find(k =>
    k.toLowerCase().endsWith(`/${name.toLowerCase()}.svg`)
  );
  return key ? socialIcons[key].default : null;
}
---

<div class="flex flex-wrap items-center gap-1">
  {
    SOCIALS.map(social => {
      const Icon = getSocialIcon(social.name);
      const linkTitle =
        social.linkTitle ?? `${SITE.title} on ${social.name}`;
      return (
        Icon && (
          <LinkButton
            href={social.url}
            class="p-2 hover:rotate-6 sm:p-1"
            title={linkTitle}
          >
            <Icon class="inline-block size-6 scale-125 fill-transparent stroke-current stroke-2 opacity-90 group-hover:fill-transparent sm:scale-110" />
            <span class="sr-only">{linkTitle}</span>
          </LinkButton>
        )
      );
    })
  }
</div>
```

- [ ] **Step 3: 将社交图标 SVG 移入 socials 子目录**

```bash
mkdir -p src/assets/icons/socials
mv src/assets/icons/IconGitHub.svg src/assets/icons/socials/github.svg
mv src/assets/icons/IconBrandX.svg src/assets/icons/socials/x.svg
mv src/assets/icons/IconLinkedin.svg src/assets/icons/socials/linkedin.svg
mv src/assets/icons/IconMail.svg src/assets/icons/socials/mail.svg
mv src/assets/icons/IconWhatsapp.svg src/assets/icons/socials/whatsapp.svg
mv src/assets/icons/IconFacebook.svg src/assets/icons/socials/facebook.svg
mv src/assets/icons/IconTelegram.svg src/assets/icons/socials/telegram.svg
mv src/assets/icons/IconPinterest.svg src/assets/icons/socials/pinterest.svg
```

- [ ] **Step 4: 更新 ShareLinks.astro — 同样改为动态导入**

```astro
---
import { SHARE_LINKS, SITE } from "@/config";
import LinkButton from "./LinkButton.astro";

const URL = Astro.url;

const socialIcons = import.meta.glob<{ default: any }>(
  "@/assets/icons/socials/*.svg",
  { eager: true }
);

function getSocialIcon(name: string) {
  const key = Object.keys(socialIcons).find(k =>
    k.toLowerCase().endsWith(`/${name.toLowerCase()}.svg`)
  );
  return key ? socialIcons[key].default : null;
}
---

{
  SHARE_LINKS.length > 0 && (
    <div class="flex flex-none flex-col items-center justify-center gap-1 md:items-start">
      <span class="italic">Share this post on:</span>
      <div class="text-center">
        {SHARE_LINKS.map(social => {
          const Icon = getSocialIcon(social.name);
          const linkTitle =
            social.linkTitle ?? `Share this post via ${social.name}`;
          return (
            Icon && (
              <LinkButton
                href={`${social.url + URL}`}
                class="scale-90 p-2 hover:rotate-6 sm:p-1"
                title={linkTitle}
              >
                <Icon class="inline-block size-6 scale-125 fill-transparent stroke-current stroke-2 opacity-90 group-hover:fill-transparent sm:scale-110" />
                <span class="sr-only">{linkTitle}</span>
              </LinkButton>
            )
          );
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 删除 src/constants.ts**

所有引用已迁移到 `src/config.ts` 导出的 `SOCIALS` / `SHARE_LINKS`。

- [ ] **Step 6: 更新所有 import 引用**

全局搜索 `from "@/constants"` 并替换为 `from "@/config"`。涉及文件：
- `src/pages/index.astro` — `SOCIALS` import
- 其他可能的引用

- [ ] **Step 7: 更新 Header.astro 中图标 SVG 引用路径**

Header 中使用的 `IconMail`、`IconGitHub` 等如果还存在于非 socials 目录，检查是否需要保留。Header 的主题/搜索/菜单图标不涉及社交链接，无需移动。

- [ ] **Step 8: 更新 Footer.astro — 从 config 读取 socials**

Footer 组件如果引用了 `@/constants`，改为从 `@/config` 导入。

- [ ] **Step 9: 验证构建通过**

Run: `npm run format:check && npm run lint && npm run build`
Expected: 全部通过

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: extract astro-paper.config.ts with typed config architecture"
```

---

## Phase 2: Tailwind 集成迁移

从 `@tailwindcss/postcss` (PostCSS) 迁移到 `@tailwindcss/vite` (Vite 原生插件)。

### Task 2.1: 切换 Tailwind 集成方式

**Files:**
- Modify: `astro.config.ts`
- Delete: `postcss.config.mjs`
- Modify: `package.json` (依赖变更)

- [ ] **Step 1: 安装 @tailwindcss/vite，移除 @tailwindcss/postcss**

```bash
npm uninstall @tailwindcss/postcss
npm install -D @tailwindcss/vite
```

- [ ] **Step 2: 更新 astro.config.ts**

在 `defineConfig` 中添加 Vite 插件：

```typescript
// astro.config.ts — 添加 import
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // ... 其他配置不变
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
});
```

- [ ] **Step 3: 删除 postcss.config.mjs**

```bash
rm postcss.config.mjs
```

- [ ] **Step 4: 验证构建通过**

Run: `npm run format:check && npm run lint && npm run build`
Expected: 全部通过，样式无变化

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: switch from @tailwindcss/postcss to @tailwindcss/vite"
```

---

## Phase 3: i18n 国际化系统

引入 6.0 的轻量级 i18n 系统，支持中文 UI 字符串的集中管理。

### Task 3.1: 创建 i18n 类型定义

**Files:**
- Create: `src/i18n/types.ts`

- [ ] **Step 1: 创建 UI 字符串类型接口**

```typescript
// src/i18n/types.ts

export interface UIStrings {
  nav: {
    posts: string;
    tags: string;
    about: string;
    archives: string;
    search: string;
    books: string;
  };
  post: {
    previous: string;
    next: string;
    share: string;
    edit: string;
    copyCode: string;
    copied: string;
    backToTop: string;
    updated: string;
  };
  pagination: {
    prev: string;
    next: string;
    pageOf: string;
  };
  home: {
    featured: string;
    recentPosts: string;
    allPosts: string;
    socialLinks: string;
  };
  footer: {
    copyright: string;
  };
  pages: {
    searchHint: string;
    toc: string;
    openToc: string;
    closeToc: string;
  };
  a11y: {
    skipToContent: string;
    toggleTheme: string;
    openMenu: string;
    closeMenu: string;
  };
  notFound: {
    title: string;
    description: string;
    backHome: string;
  };
  book: {
    previousChapter: string;
    nextChapter: string;
    tableOfContents: string;
  };
}
```

---

### Task 3.2: 创建中文语言文件

**Files:**
- Create: `src/i18n/lang/zh.ts`
- Create: `src/i18n/lang/en.ts`

- [ ] **Step 1: 创建中文翻译**

```typescript
// src/i18n/lang/zh.ts
import type { UIStrings } from "../types";

export default {
  nav: {
    posts: "文章",
    tags: "标签",
    about: "关于",
    archives: "归档",
    search: "搜索",
    books: "书籍",
  },
  post: {
    previous: "上一篇",
    next: "下一篇",
    share: "分享到",
    edit: "编辑",
    copyCode: "复制",
    copied: "已复制",
    backToTop: "回到顶部",
    updated: "更新于",
  },
  pagination: {
    prev: "上一页",
    next: "下一页",
    pageOf: "第 {{current}} 页，共 {{total}} 页",
  },
  home: {
    featured: "精选文章",
    recentPosts: "最新文章",
    allPosts: "所有文章",
    socialLinks: "社交链接：",
  },
  footer: {
    copyright: "版权所有",
  },
  pages: {
    searchHint: "搜索",
    toc: "目录",
    openToc: "打开目录",
    closeToc: "关闭目录",
  },
  a11y: {
    skipToContent: "跳到内容",
    toggleTheme: "切换明暗模式",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
  },
  notFound: {
    title: "404",
    description: "页面未找到",
    backHome: "返回首页",
  },
  book: {
    previousChapter: "上一章",
    nextChapter: "下一章",
    tableOfContents: "目录",
  },
} satisfies UIStrings;
```

- [ ] **Step 2: 创建英文翻译**

```typescript
// src/i18n/lang/en.ts
import type { UIStrings } from "../types";

export default {
  nav: {
    posts: "Posts",
    tags: "Tags",
    about: "About",
    archives: "Archives",
    search: "Search",
    books: "Books",
  },
  post: {
    previous: "Previous Post",
    next: "Next Post",
    share: "Share this post on:",
    edit: "Edit page",
    copyCode: "Copy",
    copied: "Copied",
    backToTop: "Back To Top",
    updated: "Updated:",
  },
  pagination: {
    prev: "Prev",
    next: "Next",
    pageOf: "Page {{current}} of {{total}}",
  },
  home: {
    featured: "Featured",
    recentPosts: "Recent Posts",
    allPosts: "All Posts",
    socialLinks: "Social Links:",
  },
  footer: {
    copyright: "All rights reserved.",
  },
  pages: {
    searchHint: "Search",
    toc: "Table of Contents",
    openToc: "Open TOC",
    closeToc: "Close TOC",
  },
  a11y: {
    skipToContent: "Skip to content",
    toggleTheme: "Toggles light & dark",
    openMenu: "Open Menu",
    closeMenu: "Close Menu",
  },
  notFound: {
    title: "404",
    description: "Page not found",
    backHome: "Back to Home",
  },
  book: {
    previousChapter: "Previous Chapter",
    nextChapter: "Next Chapter",
    tableOfContents: "Contents",
  },
} satisfies UIStrings;
```

---

### Task 3.3: 创建 i18n 核心 + 模板工具

**Files:**
- Create: `src/i18n/index.ts`
- Create: `src/i18n/format.ts`

- [ ] **Step 1: 创建模板字符串工具**

```typescript
// src/i18n/format.ts
export function tplStr(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ""));
}
```

- [ ] **Step 2: 创建 i18n 核心**

```typescript
// src/i18n/index.ts
import type { UIStrings } from "./types";
import en from "./lang/en";

const langModules = import.meta.glob<{ default: UIStrings }>(
  "./lang/*.ts",
  { eager: true }
);

const translations: Record<string, UIStrings> = {};

for (const [path, module] of Object.entries(langModules)) {
  const locale = path.match(/\.\/lang\/(.+)\.ts$/)?.[1] ?? "";
  translations[locale] = module.default;
}

export function useTranslations(locale: string): UIStrings {
  return translations[locale] ?? translations["en"] ?? en;
}

export { tplStr } from "./format";
export type { UIStrings } from "./types";
```

- [ ] **Step 3: 在组件中应用 i18n（示例：Header）**

在 `Header.astro` 中替换硬编码文本：

```astro
---
import { SITE } from "@/config";
import { useTranslations } from "@/i18n";

const t = useTranslations(SITE.lang);
// ...
---

<!-- 替换 -->
<a href="/books" class:list={{ "active-nav": isActive("/books") }}>
  {t.nav.books}
</a>
<a href="/posts" class:list={{ "active-nav": isActive("/posts") }}>
  {t.nav.posts}
</a>
<a href="/tags" class:list={{ "active-nav": isActive("/tags") }}>
  {t.nav.tags}
</a>
<a href="/about" class:list={{ "active-nav": isActive("/about") }}>
  {t.nav.about}
</a>
<!-- ... -->
```

- [ ] **Step 4: 在其他组件中逐步应用 i18n**

涉及替换硬编码文本的组件：
- `PostDetails.astro` — "Previous Post", "Next Post"
- `ShareLinks.astro` — "Share this post on:"
- `ArticleEnhancements.astro` — "Copy", "Copied"
- `BackToTopButton.astro` — "Back To Top"
- `index.astro` — "Featured", "Recent Posts", "All Posts"
- `Breadcrumb.astro` — "Home"
- `Pagination.astro` — "Prev", "Next"
- `MobileToc.astro` — "目录", "打开目录", "关闭目录"
- `BookChapterContent.astro` — "上一章", "下一章"
- `404.astro` — 404 文本
- `search.astro` — 搜索提示文本

每个组件添加：
```typescript
import { useTranslations } from "@/i18n";
const t = useTranslations(SITE.lang);
```

- [ ] **Step 5: 验证构建通过**

Run: `npm run format:check && npm run lint && npm run build`
Expected: 全部通过，UI 文本正确显示中文

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add i18n system with zh/en translations"
```

---

## Phase 4: UX 组件增强

移植 6.0 中的 UX 改进组件。

### Task 4.1: SVG 自动优化

**Files:**
- Modify: `astro.config.ts`

- [ ] **Step 1: 启用 experimental.svgOptimizer**

在 `astro.config.ts` 中添加：

```typescript
import { svgoOptimizer } from "astro/config";

export default defineConfig({
  // ...
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
```

- [ ] **Step 2: 验证构建通过**

Run: `npm run build`
Expected: 通过，SVG 文件更小

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: enable experimental SVG optimizer"
```

---

### Task 4.2: ResponsiveTable 组件

**Files:**
- Create: `src/components/ResponsiveTable.astro`

- [ ] **Step 1: 创建表格包装组件**

```astro
---
type Props = {
  variant?: "default" | "minimal" | "striped" | "striped-minimal";
};

const { variant = "default" } = Astro.props;
---

<div
  class:list={[
    "overflow-x-auto",
    { "rounded border border-border": variant === "default" || variant === "striped" },
  ]}
>
  <div class:list={["min-w-[500px]", { "[&>table]:mb-0": true }]}>
    <slot />
  </div>
</div>
```

- [ ] **Step 2: 在 typography.css 中添加表格样式变体**

在 `src/styles/typography.css` 的 `.app-prose` 规则内，确保 table 基础样式已有，无需额外修改（当前已有 table 样式）。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add ResponsiveTable component"
```

---

### Task 4.3: 改进面包屑组件

**Files:**
- Modify: `src/components/Breadcrumb.astro`

- [ ] **Step 1: 增强面包屑组件**

改进方向（对齐 6.0）：
- 添加 `<nav aria-label="breadcrumb">` 语义（已有）
- 使用 `<ol>` 替代 `<ul>` 语义化面包屑
- 添加 BreadcrumbList JSON-LD 结构化数据
- 支持 locale 前缀剥离

```astro
---
import { SITE } from "@/config";
import { useTranslations } from "@/i18n";

const t = useTranslations(SITE.lang);

const currentUrlPath = Astro.url.pathname.replace(/\/+$/, "");
const breadcrumbList = currentUrlPath.split("/").slice(1);

if (breadcrumbList[0] === "posts") {
  const pageNum = Number(breadcrumbList[1]) || 1;
  if (pageNum === 1) {
    breadcrumbList.splice(0, 2, t.nav.posts);
  } else {
    breadcrumbList.splice(0, 2, `${t.nav.posts} (${pageNum})`);
  }
}

if (breadcrumbList[0] === "books" && breadcrumbList.length > 1) {
  breadcrumbList[1] = breadcrumbList[1]
    .replace("-", " ")
    .replace(/\b\w/g, c => c.toUpperCase());
  if (breadcrumbList.length > 2) {
    breadcrumbList[2] = breadcrumbList[2]
      .replace(/-/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  breadcrumbList[0] = t.nav.books;
}

if (breadcrumbList[0] === "tags" && !isNaN(Number(breadcrumbList[2]))) {
  breadcrumbList.splice(1, 3, `${breadcrumbList[1]} ${Number(breadcrumbList[2]) === 1 ? "" : `(${breadcrumbList[2]})`}`);
}

const breadcrumbItems = breadcrumbList.map((name, index) => ({
  name: decodeURIComponent(name),
  href: "/" + breadcrumbList.slice(0, index + 1).join("/") + "/",
  isLast: index === breadcrumbList.length - 1,
}));
---

<nav class="app-layout mt-8 mb-1" aria-label="breadcrumb">
  <ol class="font-light [&>li]:inline [&>li:not(:last-child)>a]:hover:opacity-100">
    <li>
      <a href="/" class="opacity-80">Home</a>
      <span aria-hidden="true" class="opacity-80">&raquo;</span>
    </li>
    {
      breadcrumbItems.map(item =>
        item.isLast ? (
          <li>
            <span
              class:list={["capitalize opacity-75", { lowercase: !item.isLast }]}
              aria-current="page"
            >
              {item.name}
            </span>
          </li>
        ) : (
          <li>
            <a href={item.href} class="capitalize opacity-70">
              {item.name}
            </a>
            <span aria-hidden="true">&raquo;</span>
          </li>
        )
      )
    }
  </ol>
</nav>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "refactor: improve Breadcrumb with structured data"
```

---

### Task 4.4: 改进文章页 — 添加 "阅读时间" 提示

**Files:**
- Modify: `src/components/Datetime.astro`

- [ ] **Step 1: 在 Datetime 组件中添加阅读时间**

6.0 没有直接添加阅读时间，但这是一个常见的 UX 增强。如果不需要则跳过。

- [ ] **Step 2: Commit (如果执行了)**

```bash
git add -A
git commit -m "feat: add reading time to Datetime component"
```

---

### Task 4.5: 完善 View Transitions 支持

**Files:**
- Modify: `src/components/PagefindModal.astro`
- Modify: `src/layouts/Layout.astro`

- [ ] **Step 1: 检查所有组件的 View Transition 兼容性**

确保以下组件使用 `data-astro-rerun` 而非 `astro:after-swap` 监听（减少重复代码）：
- `ArticleEnhancements.astro` — 已使用 `data-astro-rerun` ✓
- `BackToTopButton.astro` — 已使用 `data-astro-rerun` ✓
- `TableOfContents.astro` — 检查是否需要 `data-astro-rerun`
- `MobileToc.astro` — 检查

- [ ] **Step 2: 确保 PagefindModal 使用 transition:persist**

```astro
<pagefind-modal transition:persist />
```

- [ ] **Step 3: 在 Layout.astro 中确认 astro:after-swap 事件处理完善**

检查当前 inline script 中的 `astro:after-swap` 处理是否需要扩展（字体加载重置已在 Layout.astro:191-196）。

- [ ] **Step 4: 验证构建通过**

Run: `npm run format:check && npm run lint && npm run build`
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: improve View Transitions compatibility"
```

---

## Phase 5: 样式对齐 + 清理

### Task 5.1: 对齐 theme.css 分离

**Files:**
- Create: `src/styles/theme.css`
- Modify: `src/styles/global.css`

- [ ] **Step 1: 提取主题变量到独立文件**

将 `global.css` 中的 `:root` / `[data-theme="dark"]` 颜色变量提取到 `theme.css`：

```css
/* src/styles/theme.css */
:root,
html[data-theme="light"] {
  --background: #fdfdfd;
  --foreground: #282728;
  --accent: #006cac;
  --muted: #e6e6e6;
  --border: #ece9e9;
}

html[data-theme="dark"] {
  --background: #282c34;
  --foreground: #eaedf3;
  --accent: #c678dd;
  --muted: #353c4d;
  --border: #3e4451;
}
```

- [ ] **Step 2: 更新 global.css**

```css
/* src/styles/global.css */
@import "tailwindcss";
@import "./theme.css";
@import "./typography.css";

/* ... 其余内容不变，删除颜色变量定义 */
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: extract theme.css from global.css"
```

---

### Task 5.2: 对齐 6.0 的 accent-foreground 颜色

**Files:**
- Modify: `src/styles/theme.css`（或 `global.css` 如果未拆分）

- [ ] **Step 1: 添加 accent-foreground 和 muted-foreground 颜色变量**

6.0 新增了 `accent-foreground` 和 `muted-foreground` 两个颜色令牌，用于更好的对比度控制：

```css
:root,
html[data-theme="light"] {
  --background: #fdfdfd;
  --foreground: #282728;
  --accent: #006cac;
  --accent-foreground: #fdfdfd;
  --muted: #e6e6e6;
  --muted-foreground: #737373;
  --border: #ece9e9;
}

html[data-theme="dark"] {
  --background: #282c34;
  --foreground: #eaedf3;
  --accent: #c678dd;
  --accent-foreground: #fdfdfd;
  --muted: #353c4d;
  --muted-foreground: #a0a0a0;
  --border: #3e4451;
}
```

在 `@theme inline` 中注册：

```css
@theme inline {
  /* ... 已有变量 ... */
  --color-accent-foreground: var(--accent-foreground);
  --color-muted-foreground: var(--muted-foreground);
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add accent-foreground and muted-foreground color tokens"
```

---

### Task 5.3: 最终清理和验证

**Files:**
- 全局

- [ ] **Step 1: 清理未使用的导入**

检查所有文件是否有未使用的 import（比如旧的 `@/constants` 引用）。

- [ ] **Step 2: 全量验证**

```bash
npm run format:check
npm run lint
npm run build
```

Expected: 全部通过

- [ ] **Step 3: 本地预览验证**

```bash
npm run preview
```

手动检查：
- 首页渲染正常
- 文章详情页正常（TOC、进度条、复制按钮、上下篇导航）
- Books 章节页正常（侧边栏、TOC、上下章导航）
- 搜索功能正常（Ctrl+K）
- 暗色/亮色切换正常
- 移动端响应式正常

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: cleanup after AstroPaper 6.0 alignment"
```

---

## 不纳入本次升级的功能

以下 6.0 功能经过评估，暂不纳入本次升级：

| 功能 | 原因 |
|------|------|
| `pages` 内容集合 | 当前 `about.md` 用 MarkdownLayout 模式，功能等价，改动收益小 |
| `getPostPaths.ts` 替代 `getPath.ts` | 当前 `getPath.ts` 已支持子目录，功能对等 |
| `@astrojs/mdx` 集成 | 当前项目未使用 MDX，无需求 |
| `resolveDefaultOgImagePath.ts` | 当前 OG 图片路径解析逻辑简单，无安全风险 |
| `withBase.ts` base path 工具 | 当前项目未使用 base path 部署 |
| RTL 完整支持 | 中文博客无需 RTL |
| 代码高亮主题改为 `night-owl` | `one-dark-pro` 与当前暗色主题更协调 |
| Single font (移除 Noto Sans SC) | 中文博客必须保留 Noto Sans SC |
| `sharp` 替代 `@resvg/resvg-js` | resvg 性能更好，无需替换 |
| Docker 部署移除 | 这是当前项目的增值功能 |
