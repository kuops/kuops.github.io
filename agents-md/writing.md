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

**关键：** Astro glob loader 把 `index.md` 的 id 解析为父目录名（如 `getting-started/index.md` → id `getting-started`），不是 `getting-started/index`。所以 `src/utils/books.ts` 用 `filePath` 而不是 `id` 来检测 `index.md` 和 `_index.md`。

URL 反映完整目录路径：`/books/astro-guide/basics/intro`。

## SVG 插图

书籍章节中需要矢量图时，使用 SVG → PNG 工作流。详细规范和检查清单见 **[`agents-md/tutorial-svg.md`](tutorial-svg.md)**。

**简要流程**：

1. SVG 源文件放在章节对应的 `*-images/` 目录下（如 `asm-arithmetic-images/overflow-0x7f-plus-1.svg`）
2. 用 `npm run svg2png -- path/to/foo.svg` 转 PNG，Markdown 里用带信息量的 alt 文本引用 PNG（如 `![EAX 子寄存器布局](asm-navigation-images/sub-register-eax.png)`）

为什么不直接用 SVG：Astro 图片优化管线处理 `src/` 下 SVG 有 bug；内联 `<svg>` 会被 Markdown 解析器拆散子元素。

## 写作质量检查清单（Writing quality checklist）

写完技术内容后，按以下标准自评打分（满分 100），记录分数和扣分项，然后修正：

### 技术正确性（P0：阻塞发布，每个扣 15 分）

任何 P0 问题必须修正后才能发布。有 P0 未修正直接 0 分。

- [ ] 所有代码块语法无误，无未定义变量、缺失导入、缩进错误
- [ ] 正文中描述的运算结果（标志位、寄存器值、内存地址）与实际执行结果完全吻合
- [ ] 术语定义与官方文档一致（例：PF 只看最低 8 位；cdq 全称 Convert Doubleword to Quadword）
- [ ] 章节交叉引用准确（引用"第 N 章"时检查 order 值确认被引内容确实在该章）
- [ ] 框架、库、工具版本号准确；不使用已废弃 API；有安全隐患时已标注

### 结构与逻辑（P1：体验优化，每个扣 5 分）

- [ ] 对照读者画像，当前章节难度是否突然拔高？是否出现了未在前文解释的高阶概念？
- [ ] 段落之间、小节之间的过渡是否自然？是否有跳跃性思维或上下文断层？
- [ ] 结构完整：引入背景 → 核心概念 → 代码示例/动手实践 → 常见误区/深度解析 → 小结
- [ ] 新概念引入前是否已在前文给出足够铺垫？引用前文时是否给出了具体位置？
- [ ] 哪些复杂概念仅靠文字难以表达？是否需要补充时序图/架构图？
- [ ] **跨章节风格一致性**：与同一本书的前序章节对比，练习格式（有序列表 + callout）、代码块标语言、图表使用方式、callout 惯例是否保持一致？

### 信息密度与直观性（P1：体验优化，每个扣 5 分）

- [ ] 连续的表格/代码块不超过 3 个
- [ ] 每段文字有明确的单一信息
- [ ] 没有"看起来专业但对新手无用"的数据（如不必要的 64 位超长数字）
- [ ] 能用图/数轴/示例说的，避免了纯公式
- [ ] 示例足够小（8 位优于 32 位）让读者能心算验证
- [ ] 正反两个方向都演示了（编码 + 解码）

### 语言与排版（P2：格式微调，每个扣 2 分）

- [ ] 无错别字与语病（的/地/得 用法、主谓搭配、长句拆分）
- [ ] 无翻译腔（"被……"、"为了……的目的"、"基于……的原因"等英文直译痕迹）
- [ ] 中英文混排有空格（`使用 Redis 缓存`，而不是 `使用Redis缓存`）
- [ ] 术语大小写规范（Kubernetes 不写 kubernetes）
- [ ] 中文语境下代码块外用全角标点；代码块内用半角
- [ ] 普通专业术语首次出现时可加粗；寄存器名、命令、机器码优先用行内代码，不强制再加粗

### 检验方法

- [ ] 假装自己是零基础读者，能否不查任何资料一路读下来？
- [ ] 读完后能否自己推导出结论（而不是只能背）？

### 流程

1. 写完 → 按 checklist 自评打分 → 记录分数和扣分项
2. P0 问题立即修正；P1 问题调整段落和过渡；P2 问题做文字润色
3. 修正后重新打分 → 80 分以上可提交
4. **并行审核**：章节较长或工作量较大时，可以 dispatch 子 Agent 并行执行 P0 / P1 / P2 三个维度的审核，各自独立输出结果后按优先级汇总修正

## C 代码与汇编验证（C/Assembly verification）

写作过程中涉及 C 代码示例时，必须实际编译验证，不要凭空推断汇编结果。

### 写入代码

代码文件写到 WSL 路径 `/mnt/c/Code/Cpp/Demo/`（对应 Windows 路径 `C:\Code\Cpp\Demo`）。直接写入或覆盖 `Demo.cpp`，无需手动建工程——该目录已有现成的 VS 项目文件（`.vcxproj` / `.slnx`）。

### 编译

用 MSBuild 命令行编译，固定参数如下：

```bash
MSBuild.exe 'C:\Code\Cpp\Demo' /p:Configuration=Debug /p:Platform=x86 /p:Optimization=Disabled
```

- `Configuration=Debug` — Debug 模式，和教程里用的模式一致
- `Platform=x86` — 32 位，寄存器更少、指令更短，与前 12 章汇编基础格式一致
- `Optimization=Disabled` — 关闭优化，确保汇编和 C 代码逐行对应

编译产物在 `/mnt/c/Code/Cpp/Demo/Debug/Demo.exe`。

### 汇编对照

编译后有两种方式对照汇编：

1. **dumpbin 静态反汇编** — 不启动调试器，直接看 `.obj` 的反汇编，快速核对：

   ```bash
   dumpbin.exe /disasm 'C:\Code\Cpp\Demo\Demo\Debug\Demo.obj'
   ```

   输出的是编译器生成的原始汇编（未链接），适合快速验证某段 C 代码对应的指令是否和教程描述一致。

2. **x64dbg 动态对照** — 用 x32dbg 加载 `Debug/Demo.exe`，断到 `main` 单步对照，能看到实际地址、寄存器值和运行时行为。

教程里写的每一段汇编都必须和实际反汇编结果吻合，不吻合就修教程。

> [!NOTE]
> 逆向章节默认 32 位 Debug 模式。不要切到 Release 或 x64，否则汇编输出和教程对不上。
