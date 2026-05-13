# Astro + AstroPaper 博客设计方案

## 概述

使用 Astro 框架 + AstroPaper 主题创建个人博客，部署到 GitHub Pages，内容以中文为主。

## 技术栈

- **框架**: Astro
- **主题**: AstroPaper (satnaing/astro-paper)
- **包管理器**: npm
- **部署**: GitHub Pages
- **语言**: TypeScript + TailwindCSS

## 实施步骤

### 1. 项目初始化

使用 Astro 模板命令初始化项目：

```bash
npm create astro@latest -- --template satnaing/astro-paper
```

在 `/root/blog` 目录下执行，选择默认配置。

### 2. 中文本地化配置

修改 `src/config.ts`：
- 站点标题设为中文
- 站点描述设为中文
- 社交链接按需配置

清理示例博客文章（`src/data/blog/` 下的英文示例），添加一篇中文示例文章。

### 3. GitHub Pages 适配

修改 `astro.config.ts`：
- 设置 `site` 为 GitHub Pages URL
- 根据仓库名决定是否设置 `base` 路径
  - 如果仓库名为 `<username>.github.io`，不需要 base
  - 否则设置 `base: '/<repo-name>/'`

添加 `.github/workflows/deploy.yml` 用于 GitHub Actions 自动部署。

### 4. 个性化定制

- 替换 `public/favicon.svg`
- 替换 `public/astropaper-og.jpg`
- 配色方案可通过修改 TailwindCSS 主题自定义

## 项目结构

```
/root/blog/
├── public/           # 静态资源
├── src/
│   ├── assets/       # 图标、图片
│   ├── components/   # UI 组件
│   ├── data/blog/    # 博客文章 (Markdown)
│   ├── layouts/      # 页面布局
│   ├── pages/        # 页面路由
│   ├── styles/       # 样式
│   ├── config.ts     # 站点配置
│   └── ...
├── astro.config.ts   # Astro 配置
└── package.json
```
