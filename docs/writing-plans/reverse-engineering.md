# 《逆向工程实战入门》写作计划

> 最后更新：2026-06-23

## 一、全书结构

```
src/data/books/reverse-engineering/
├── index.md                          ← 书籍入口 (order 1)
├── getting-started/                  ← 第一大分类：入门篇 (order 1)
├── assembly-basics/                  ← 第二大分类：汇编基础 (order 2)
├── c-asm/                            ← 第三大分类：C 与汇编对照 (order 3)
├── cracking/                         ← 第四大分类：破解篇 (order 2，待定)
└── game/                             ← 第五大分类：游戏篇 (order 3，待定)
```

## 二、当前进度总览

| 分类 | 章节数 | 已发布 (draft: false) | 草稿 (draft: true) | 完成度 |
|------|--------|----------------------|---------------------|--------|
| 入门篇 | 3 章 | 3 章 | 0 | 100% |
| 汇编基础 | 8 章 | 8 章 | 0 | 100% |
| C 与汇编对照 | 11 章 | 0 | 11 章 | 0% (草稿已有内容) |
| 破解篇 | 0 章 | 0 | 0 | 未开始 |
| 游戏篇 | 0 章 | 0 | 0 | 未开始 |

### 已完成分类详情

#### 入门篇 (order 1-3) — 100% ✅

| Order | 文件 | 标题 |
|-------|------|------|
| 1 | first-crack.md | 破解第一个 CrackMe |
| 2 | number-basics.md | 数字基础与十六进制 |
| 3 | asm-navigation.md | x64dbg 导航与寄存器 |

#### 汇编基础 (order 4-11) — 100% ✅

| Order | 文件 | 标题 |
|-------|------|------|
| 4 | asm-memory-access.md | 内存寻址与大小端 |
| 5 | asm-data-instructions.md | 数据操作指令 |
| 6 | asm-arithmetic.md | 算术指令与标志位 |
| 7 | asm-logic.md | 逻辑与移位指令 |
| 8 | asm-branch.md | 比较跳转与条件分支 |
| 9 | asm-stack.md | 栈与 push/pop |
| 10 | asm-function-call.md | 函数调用与栈帧 |
| 11 | asm-string.md | 字符串指令与 REP 前缀 |

### 待完成分类详情

#### C 与汇编对照 (order 10-20) — 草稿已存在，待审查发布

| Order | 文件 | 标题 | 草稿行数 | 备注 |
|-------|------|------|----------|------|
| 10 | binary-file-basics.md | 二进制文件基础 | ~150 | 短，可能需扩充 |
| 11 | c-asm-1.md | 变量与赋值 | ~440 | |
| 12 | c-asm-2.md | 运算与位操作 | ~600 | |
| 13 | c-asm-3.md | if/else 分支 | ~420 | |
| 14 | c-asm-4.md | switch 与跳转表 | ~440 | |
| 15 | c-asm-5.md | 循环 | ~800 | |
| 16 | c-asm-6.md | 数组与字符串 | ~760 | |
| 17 | c-asm-7.md | 指针与内存 | ~550 | |
| 18 | c-asm-8.md | 函数调用 | ~630 | |
| 19 | c-asm-9.md | 结构体 | ~620 | |
| 20 | asm-memory.md | 字符串、内存与交叉引用 | ~320 | order 已从 8 调整为 20 |

**c-asm 章节的待办事项：**
- [ ] 逐一审查内容质量、技术准确性
- [ ] 统一风格 (callout 格式、代码块语言标签、破折号/括号规范)
- [ ] 补充 SVG 图表 (目前几乎无配图)
- [ ] 将 draft: true 改为 draft: false 逐章发布
- [ ] 评估 binary-file-basics.md 是否需要大幅扩充
- [ ] 确认 c-asm-6 与 asm-string 的字符串内容不重复

#### 破解篇 — 未开始

v3 计划了 7 章 (keygen-easy / keygen-advanced / ida-basics / cpp-reversing / pe-analysis / ida-x64dbg-combo / unpacking)，但目录只有 `_index.md`。

**待规划：**
- [ ] 确定章节列表和顺序
- [ ] 确定每章的 CrackMe 目标
- [ ] 是否需要调整 v3 计划中的案例选题

#### 游戏篇 — 未开始

v3 计划了 5 章 (ce-pvz / external-trainer / dll-inject / inline-hook / full-tool)，全部围绕植物大战僵尸。目录只有 `_index.md`。

**待规划：**
- [ ] 确定游戏版本和可用性
- [ ] 确认 CE → 外部修改器 → DLL 注入 → Hook → 全功能工具的渐进路线
- [ ] 是否需要调整章节拆分

## 三、已完成的关键工作

### 近期 (2026-06-22 ~ 06-23)

- **第 9/10 章拆分**：原 asm-stack 拆为"栈与 push/pop" + "函数调用与栈帧"
- **第 4 章扩充**：新增内存布局概览 + memory-layout.svg、段前缀 NOTE、内存保护 NOTE
- **第 11 章完整重写**：字符串指令与 REP 前缀
  - 新增 CMPS 章节，四种指令全覆盖 (MOVS/STOS/SCAS/CMPS)
  - REP 前缀从章末移到 MOVS 之前
  - 现代 strlen 不用 repne scasb (用 magic number 0x7EFEFEFF)
  - 内联映射速查表只留 memcpy/memset (实际会被内联的)
  - 7 个 SVG 图表全部重做 (movsb/stosb/stosd/rep-movsd/repne-scasb/string-registers/cmpsb)
  - B/W/D/Q 后缀说明
- **x64dbg 验证**：rep stosd 在 main 序言、UCRT memcpy 内部用 rep movsb、strlen 用 magic number
- **占位符清理**：第 9/10 章 7 个 `<!-- 🎨 -->` 占位符移除

### 历史关键工作

- v1-v3 书籍结构演进：从 10 章 MVP → 18 章三篇 → 当前多分类结构
- v4 指令补全：MOVSX/MOVZX、XCHG、MUL、PUSHA/POPA、字符串指令三件套
- 全书 SVG 规范化：调色板统一、字体栈、透明度、圆角、font-weight
- 写作规范建立：agents-md/ 下 4 份规范文档
- AstrePaper 6 升级 + filesystem-driven books 架构

## 四、下一步优先级

1. **C 与汇编对照 (c-asm) 审查发布** — 11 章草稿已有内容，是距离发布最近的分类
2. **破解篇规划与写作** — v3 已有详细计划，需要确认案例选题后开始
3. **游戏篇规划与写作** — 最后一个分类，依赖破解篇完成

## 五、写作规范参考

- `agents-md/writing.md` — 篇幅指南、frontmatter、书籍结构
- `agents-md/tutorial-markdown.md` — Markdown 排版 (callout、表格、代码块)
- `agents-md/tutorial-svg.md` — SVG 插图规范 (调色板、字体、viewBox)
- `agents-md/astro.md` — 开发指南 (命令、验证、架构)
