---
title: "欢迎来到我的博客"
pubDatetime: 2026-05-13
description: "这是第一篇博客文章，使用 Astro 和 AstroPaper 主题构建。"
tags: ["hello"]
---

欢迎！这是使用 [Astro](https://astro.build/) 和 [AstroPaper](https://github.com/satnaing/astro-paper) 主题搭建的个人博客。

## 开始写作

在 `src/data/blog/` 目录下创建新的 Markdown 文件即可发布文章。

### 文章格式

```markdown
---
title: "文章标题"
description: "文章描述"
pubDatetime: 2026-05-13
tags: ["标签"]
---

文章内容...
```

### 自定义配置

你可以修改 `src/config.ts` 来调整站点的标题、描述、社交链接等信息。

## 功能特性

- 响应式设计，支持移动端和桌面端
- 深色/浅色模式切换
- SEO 友好
- 文章搜索功能
- RSS 订阅

## 部署

推送到 GitHub 后，通过 GitHub Actions 自动部署到 GitHub Pages。

祝你写作愉快！
