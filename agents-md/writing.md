# 写作指南

> 教程章节和博客排版规范见 `agents-md/tutorial-markdown.md`。

## 篇幅指南（Content length guidelines）

### 博客文章（Blog posts）
- **推荐长度：** 1000–2500 字（阅读 5–10 分钟）
- 太短像碎片，太长读者容易流失
- 教程/深度解析可放宽至 3000+ 字

### 书籍章节（Book chapters）
- **推荐长度：** 3000–8000 字（阅读 15–30 分钟）
- 小说章节通常更短（2000–5000 字）
- 非虚构/技术书可更长
- **核心原则：** 一个章节只讲清楚一个主题，自然分段

## 博客文章 frontmatter（必填）

```yaml
title: string
pubDatetime: date      # NOT publishDate, NOT date
description: string    # NOT summary
tags: string[]
```

以 `_` 开头的文章会被 glob loader 忽略。需要排除生产构建时，请设置 `draft: true`。

## 书籍（filesystem-driven）

书籍结构会直接从目录结构自动推导，不需要额外配置文件。

```
src/data/books/
  getting-started/            ← 一本书 = 一个顶层目录
    index.md                  ← 书籍元数据 (title, description, order)
    intro.md                  ← 扁平章节（无分组）
    installation.md
  astro-guide/
    index.md                  ← 书籍元数据
    basics/                   ← 子目录 = 分组
      _index.md               ← 分组元数据 (group: "基础", order: 1)
      intro.md
      installation.md
    advanced/
      _index.md               ← group: "进阶", order: 2
      components.md
      collections.md
```

**书籍 `index.md` 的 frontmatter：**
```yaml
title: string
description: string
order: number
```

**分组 `_index.md` 的 frontmatter：**
```yaml
title: string       # 通常与 group 同值
description: string
group: string       # 分组显示名
order: number       # 分组排序
```

**章节 frontmatter：**
```yaml
title: string
description: string
order: number       # 组内排序
draft: boolean      # 可选，排除生产构建
```

章节正文不要再写 `#` 一级标题；页面会用 frontmatter 的 `title` 自动生成标题，正文从 `##` 开始。

**关键：** Astro glob loader 把 `index.md` 的 id 解析为父目录名（如 `getting-started/index.md` → id `getting-started`），不是 `getting-started/index`。所以 `src/utils/books.ts` 用 `filePath` 而不是 `id` 来检测 `index.md` 和 `_index.md`。

URL 反映完整目录路径：`/books/astro-guide/basics/intro`。

## SVG 插图

书籍章节中需要矢量图时，使用 SVG → PNG 方式：

1. **SVG 源文件**放在章节的 images 目录下（如 `asm-navigation-images/sub-register-eax.svg`）
2. **转 PNG** 后 Markdown 里用 `![](xxx.png)` 引用 PNG

为什么不直接用 SVG：
- Astro 的图片优化管线（`/_image`）处理 `src/` 下的 SVG 时有 bug，会渲染为 broken image
- `public/` 目录的文件不被优化，但不想把内容图片放 `public/`
- 内联 `<svg>` 在 `.md` 文件中会被 Markdown 解析器拆散子元素

转换命令（WSL 环境，使用 Windows 微软雅黑字体渲染中文）：

```bash
node -e "
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const svg = fs.readFileSync('src/data/books/reverse-engineering/getting-started/asm-navigation-images/sub-register-eax.svg');
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1440 }, font: { fontFiles: ['/usr/share/fonts/truetype/windows/msyh.ttc'] } });
fs.writeFileSync('src/data/books/reverse-engineering/getting-started/asm-navigation-images/sub-register-eax.png', resvg.render().asPng());
console.log('done');
"
```

SVG 规范：
- 透明背景（不设背景矩形）
- 中性色用 `#94a3b8`（slate-400），亮暗主题下都可见
- 彩色用 Tailwind 400 级别（`#60a5fa`、`#fbbf24`、`#34d399`），暗色主题也清晰
- 不要用 `currentColor`（PNG 转换后无法继承页面颜色）
- 不要用 CSS `style` 属性和 `var()`（Markdown 解析会拆散）

## 写作质量检查清单（Writing quality checklist）

写完技术内容后，按以下标准自评打分（满分 10），记录分数和扣分项，然后修正：

### 循序渐进（权重最高）
- [ ] 是否从读者已知的知识出发，逐步引入新概念？
- [ ] 每一步是否只引入一个新东西？
- [ ] 是否有概念跳跃（突然出现未解释的术语）？

### 信息密度
- [ ] 连续的表格/代码块不超过 3 个？
- [ ] 每段文字有明确的单一信息？
- [ ] 是否有"看起来专业但对新手无用"的数据（如 64 位超长数字）？

### 直观性
- [ ] 能用图/数轴/示例说的，是否避免了纯公式？
- [ ] 示例是否足够小（8 位优于 32 位）让读者能心算验证？
- [ ] 正反两个方向是否都演示了（编码 + 解码）？

### 检验方法
- [ ] 假装自己是零基础读者，能否不查任何资料一路读下来？
- [ ] 读完后能否自己推导出结论（而不是只能背）？

### 流程
1. 写完 → 按 checklist 自评打分 → 记录分数和扣分项
2. 修正后重新打分 → 直到 ≥ 8 分才提交
