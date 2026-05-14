---
title: "Tailwind CSS v4 新特性体验"
pubDatetime: 2026-05-14
description: "体验 Tailwind CSS v4 的全新功能，包括 CSS-first 配置、@theme 指令、新的颜色系统等。"
tags: ["css", "tailwind", "前端"]
---

Tailwind CSS v4 带来了许多令人兴奋的变化。本文将介绍其中几个核心新特性，并通过实际示例展示如何使用它们。

## CSS-first 配置

v4 最大的变化之一是配置方式。过去需要在 `tailwind.config.js` 中编写 JavaScript 配置，现在可以直接在 CSS 中使用 `@theme` 指令：

```css
@import "tailwindcss";

@theme {
  --color-brand: #3b82f6;
  --font-display: "Inter", sans-serif;
  --breakpoint-3xl: 120rem;
}
```

这种方式更加直观，也更容易理解和维护。

## 新的颜色系统

v4 重新设计了颜色系统，提供了更丰富的色阶和更好的对比度。新的颜色命名更加统一：

```html
<div class="bg-blue-500 hover:bg-blue-600 text-white">
  按钮
</div>
```

## 性能提升

构建速度更快，产物更小。Vite 插件的引入使得开发体验更加流畅。

## 总结

Tailwind CSS v4 是一次重大更新，值得每个 Tailwind 用户花时间学习和迁移。
