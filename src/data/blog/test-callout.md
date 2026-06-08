---
title: Callout 语法测试
pubDatetime: 2026-06-07T12:00:00Z
description: 测试 AstroPaper v6.1 新增的 Callout 提示框语法，包括 NOTE、TIP、WARNING、CAUTION 等类型。
tags:
  - 测试
---

Callout 是 Obsidian 风格的提示框语法，通过 `rehype-callouts` 插件支持。

## 基本语法

在 blockquote 的第一行使用 `[!TYPE]` 标记：

> [!NOTE]
> 这是一条注释提示，用于补充说明重要但非关键的信息。

> [!TIP]
> 这是一条小贴士，提供有助于更好使用功能的建议。

> [!WARNING]
> 这是一条警告信息，提醒你注意可能出问题的地方。

> [!CAUTION]
> 这是一条危险警告，提醒你操作可能导致严重后果。

> [!INFO]
> 这是一条信息提示，用于提供额外的上下文信息。

> [!IMPORTANT]
> 这是一条重要提示，强调必须注意的关键信息。

## 嵌套 Markdown

Callout 内部支持正常的 Markdown 语法：

> [!TIP]
> 你可以在 callout 内部使用 **加粗**、_斜体_、`代码` 等格式。
>
> 甚至可以列出要点：
>
> - 第一点
> - 第二点
> - 第三点

## 可折叠 Callout

> [!NOTE]+ 点击展开
> 这是一个可以折叠/展开的 callout，默认展开。
> 标题后面的 `+` 表示默认展开，`-` 表示默认折叠。

> [!WARNING]- 默认折叠的警告
> 这个 callout 默认是折叠状态，点击标题才会展开。
> 适合放一些不常用但重要的参考信息。

## 与普通引用的区别

普通 blockquote 不会触发 callout 渲染：

> 这是一条普通的引用文字，没有 callout 类型标记，所以它只是普通的引用样式。
>
> — 某人

只有以 `[!TYPE]` 开头的 blockquote 才会被渲染为 callout。
