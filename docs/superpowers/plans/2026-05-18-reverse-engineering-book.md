# 《逆向工程实战入门》实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在博客 books 系列中创建《逆向工程实战入门》书籍，共 10 章逆向工程实战教程

**Architecture:** 利用博客现有的 filesystem-driven books 结构，在 `src/data/books/reverse-engineering/` 下创建书籍目录，按 preparation/tools/project 三个分组组织 10 章内容

**Tech Stack:** Astro + Markdown，遵循现有 books collection schema（title, description, order, group）

---

## 文件结构总览

```
src/data/books/reverse-engineering/
  index.md                          ← 书籍入口
  preparation/
    _index.md                       ← 分组：基础准备
    environment-first-crack.md      ← 第1章
    c-asm-basic.md                  ← 第2章
    c-asm-advanced.md               ← 第3章
    cpp-asm.md                      ← 第4章
  tools/
    _index.md                       ← 分组：工具实战
    ce-game.md                      ← 第5章
    x64dbg-keygen.md                ← 第6章
    ida-static.md                   ← 第7章
    ida-x64dbg-combo.md             ← 第8章
  project/
    _index.md                       ← 分组：终极项目
    pvz-cheat-tool.md               ← 第9章
    dll-hook.md                     ← 第10章
```

---

### Task 1: 创建书籍目录结构与入口文件

**Files:**
- Create: `src/data/books/reverse-engineering/index.md`
- Create: `src/data/books/reverse-engineering/preparation/_index.md`
- Create: `src/data/books/reverse-engineering/tools/_index.md`
- Create: `src/data/books/reverse-engineering/project/_index.md`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p src/data/books/reverse-engineering/preparation
mkdir -p src/data/books/reverse-engineering/tools
mkdir -p src/data/books/reverse-engineering/project
```

- [ ] **Step 2: 创建书籍入口文件 index.md**

文件 `src/data/books/reverse-engineering/index.md`:

```markdown
---
title: 逆向工程实战入门
description: 从零开始，用 CE/x64dbg/IDA 三个工具学会逆向工程。先做再说，每章一个实战项目。
order: 1
---
```

- [ ] **Step 3: 创建 preparation/_index.md**

文件 `src/data/books/reverse-engineering/preparation/_index.md`:

```markdown
---
title: 基础准备
description: 搭建环境，用自己写的 C/C++ 代码对照学习汇编，建立高级语言与底层的直觉。
group: 基础准备
order: 1
---
```

- [ ] **Step 4: 创建 tools/_index.md**

文件 `src/data/books/reverse-engineering/tools/_index.md`:

```markdown
---
title: 工具实战
description: 三个工具逐个上手：CE 改游戏、x64dbg 追注册码、IDA 静态分析，全程带实战。
group: 工具实战
order: 2
---
```

- [ ] **Step 5: 创建 project/_index.md**

文件 `src/data/books/reverse-engineering/project/_index.md`:

```markdown
---
title: 终极项目
description: 综合运用所学技能，给植物大战僵尸写一个完整辅助工具，从 DLL 注入到 Hook 自动化。
group: 终极项目
order: 3
---
```

- [ ] **Step 6: 验证 build 通过**

Run: `npm run build`

---

### Task 2: 第1章 — 环境搭建 + 破解第一个程序

**Files:**
- Create: `src/data/books/reverse-engineering/preparation/environment-first-crack.md`

- [ ] **Step 1: 写第1章**

文件 `src/data/books/reverse-engineering/preparation/environment-first-crack.md`:

内容要点：
- frontmatter: title, description, order: 1
- 动手目标：搭建好逆向工作环境，破解第一个 CrackMe
- 步骤一：下载安装 VMware/VBox + Windows 虚拟机
- 步骤二：下载安装 x64dbg、IDA Free、CheatEngine、Visual Studio Community、010Editor
- 步骤三：配置 x64dbg（字体、快捷键、插件）
- 步骤四：打开一个最简单的 CrackMe，照着操作爆破（下断点 → 改跳转 → 注册成功）
- 你刚才做了什么：CMP 比较指令、JNE/JE 条件跳转（就讲这两个，多了不讲）
- 练习：再找 2 个类似 CrackMe 自己爆破
- 字数目标：5000-7000 字

- [ ] **Step 2: 验证 format:check + lint + build**

Run: `npm run format && npm run format:check && npm run lint && npm run build`

---

### Task 3: 第2章 — C 语言底层长这样（上）

**Files:**
- Create: `src/data/books/reverse-engineering/preparation/c-asm-basic.md`

- [ ] **Step 1: 写第2章**

文件 `src/data/books/reverse-engineering/preparation/c-asm-basic.md`:

内容要点：
- frontmatter: title, description, order: 2
- 动手目标：写 C 代码，编译后用 x64dbg 单步看，搞懂变量、运算、if 在底层长什么样
- 知识点精讲（每个走 看→改→练 三步）：
  1. 局部变量：`int a = 10` → `mov [ebp-4], 0x0A`，讲 ebp-X 就是局部变量
  2. 赋值与运算：加减乘除对应的汇编，编译器优化（乘2用shl）
  3. if/else：cmp + jxx，强调 jle 跳的是 else 分支，Release 下的 setcc/cmov
- 每个知识点：给出 C 代码 + 汇编 + 逐行注释 → 让读者改 C 代码预测汇编变化 → 给汇编还原 C
- 练习：5 道逆向题（给汇编片段还原 C 代码）
- 字数目标：6000-8000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 4: 第3章 — C 语言底层长这样（下）

**Files:**
- Create: `src/data/books/reverse-engineering/preparation/c-asm-advanced.md`

- [ ] **Step 1: 写第3章**

文件 `src/data/books/reverse-engineering/preparation/c-asm-advanced.md`:

内容要点：
- frontmatter: title, description, order: 3
- 动手目标：搞懂 switch、循环、函数调用在汇编里长什么样
- 知识点精讲（同样走 看→改→练）：
  1. switch：少量 case = 连续 cmp+je，大量 case = 跳转表，配图解释跳转表结构
  2. for/while 循环：固定的汇编结构（初始化→检查→循环体→递增→jmp回检查）
  3. 数组访问：`基址 + 索引 * sizeof` 的汇编形态，`[ecx + eax*4]` 这种一看就是数组
  4. 函数调用完整流程：push 参数（右到左）→ call → push ebp/mov ebp,esp → 执行 → eax 返回 → add esp 清理
  5. 调用约定：cdecl（调用者清理）vs stdcall（被调清理）vs fastcall（寄存器传参）
- 练习：5 道逆向题（给汇编还原 C 代码，包含函数调用和循环）
- 字数目标：6000-8000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 5: 第4章 — C++ 底层长这样

**Files:**
- Create: `src/data/books/reverse-engineering/preparation/cpp-asm.md`

- [ ] **Step 1: 写第4章**

文件 `src/data/books/reverse-engineering/preparation/cpp-asm.md`:

内容要点：
- frontmatter: title, description, order: 4
- 动手目标：写 C++ 类和虚函数，用 IDA 打开找到虚表和 this 指针
- 知识点精讲（看→改→练）：
  1. this 指针：ecx = this，成员访问 = `[ecx + 偏移]`
  2. 虚函数表：对象头部 4 字节 = vtable 指针，虚表 = 函数指针数组
  3. 虚函数调用：`mov edx, [eax]` → `call [edx + 偏移]`，间接调用 = 虚函数
  4. 继承内存布局：单继承线性布局，多重继承多 vtable 指针 + this 调整
  5. new/delete：operator new 分配内存 → 调用构造函数
  6. STL 特征：string/vector/map 在汇编中的典型形态
- 练习：给 IDA 截图识别 C++ 特征（找虚表、找 this、识别继承关系）
- 字数目标：6000-8000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 6: 第5章 — CE 修改游戏

**Files:**
- Create: `src/data/books/reverse-engineering/tools/ce-game.md`

- [ ] **Step 1: 写第5章**

文件 `src/data/books/reverse-engineering/tools/ce-game.md`:

内容要点：
- frontmatter: title, description, order: 5
- 动手目标：用 CheatEngine 修改扫雷和植物大战僵尸
- 实战一：扫雷
  - 精确搜索雷数 → 改成 0 → 锁定
- 实战二：植物大战僵尸（重点）
  - 搜阳光 → 找到动态地址 → "找出是什么访问了这个地址" → 追到基址
  - 指针扫描：理解"基址+偏移"，为什么重启游戏地址变了
  - 代码注入：CE 的 Auto Assembler，写脚本锁定阳光
  - 无冷却：搜冷却时间浮点数 → 找到写入指令 → NOP 掉
- 你刚才做了什么：动态地址 vs 静态基址、指针扫描原理、代码注入原理
- 练习：找阳光掉落间隔并修改
- 字数目标：5000-7000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 7: 第6章 — x64dbg 追注册码

**Files:**
- Create: `src/data/books/reverse-engineering/tools/x64dbg-keygen.md`

- [ ] **Step 1: 写第6章**

文件 `src/data/books/reverse-engineering/tools/x64dbg-keygen.md`:

内容要点：
- frontmatter: title, description, order: 6
- 动手目标：从爆破升级到追出注册算法，写出注册机
- CrackMe #1（简单）：
  - 字符串比较验证 → 断点在比较处 → 从内存直接读到正确注册码
- CrackMe #2（中等）：
  - 数学运算验证（异或 + 位移） → 单步跟踪算法 → 手工计算注册码
  - 过程中自然学到 XOR、SHL/SHR、LEA 等加密常见指令
- CrackMe #3（进阶）：
  - 复杂算法 → 记录算法流程 → 用 C 写注册机（Keygen）
  - 补充：如何系统记录算法（画流程图/记关键值）
- 你刚才做了什么：逆向分析的核心方法论（断点 → 单步 → 观察寄存器/内存 → 记录算法）
- 练习：再找一个 CrackMe 独立分析
- 字数目标：5000-7000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 8: 第7章 — IDA 静态分析

**Files:**
- Create: `src/data/books/reverse-engineering/tools/ida-static.md`

- [ ] **Step 1: 写第7章**

文件 `src/data/books/reverse-engineering/tools/ida-static.md`:

内容要点：
- frontmatter: title, description, order: 7
- 动手目标：用 IDA 重新分析之前 x64dbg 追过的 CrackMe，感受效率提升
- 操作教学（穿插在实战中）：
  - 打开 IDA、加载文件、基本界面认识（反汇编/十六进制/函数列表）
  - 交叉引用（X键）：从字符串找到引用它的函数
  - 函数识别与重命名（N键）
  - F5 反编译（Hex-Rays）：直接看伪代码
  - 结构体创建与应用（T键）：给偏移命名让伪代码更可读
  - 注释与标注
- 实战：用 IDA 分析第 6 章的 CrackMe #3，对比之前 x64dbg 追了半小时，IDA 按几下就定位到算法
- 你刚才做了什么：静态分析 vs 动态分析各自优势，什么时候用哪个
- 练习：用 IDA 分析一个新程序，还原核心算法
- 字数目标：5000-7000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 9: 第8章 — IDA + x64dbg 联合实战

**Files:**
- Create: `src/data/books/reverse-engineering/tools/ida-x64dbg-combo.md`

- [ ] **Step 1: 写第8章**

文件 `src/data/books/reverse-engineering/tools/ida-x64dbg-combo.md`:

内容要点：
- frontmatter: title, description, order: 8
- 动手目标：完整分析一个真实小软件，IDA 静态定位 + x64dbg 动态验证
- 选一个合适的真实小软件作为目标
- 完整分析流程：
  1. IDA 加载 → 字符串窗口找关键字符串 → 交叉引用定位核心函数
  2. F5 看伪代码 → 理解大致逻辑 → 标记可疑函数
  3. x64dbg 加载 → 在 IDA 标记的地址下断点 → 动态运行验证猜测
  4. 两边配合，逐步还原完整逻辑
- IDA 与 x64dbg 的协同技巧：
  - IDA 地址与 x64dbg 地址对齐（ASLR 处理）
  - IDA 分析结果导出到 x64dbg 标注
- 你刚才做了什么：真实逆向的工作流程（先静态后动态，先全局后细节）
- 练习：独立分析另一个类似软件
- 字数目标：5000-7000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 10: 第9章 — 终极项目（上）：植物大战僵尸辅助

**Files:**
- Create: `src/data/books/reverse-engineering/project/pvz-cheat-tool.md`

- [ ] **Step 1: 写第9章**

文件 `src/data/books/reverse-engineering/project/pvz-cheat-tool.md`:

内容要点：
- frontmatter: title, description, order: 9
- 动手目标：用 C/C++ 给植物大战僵尸写一个独立辅助工具
- 项目一：读取游戏数据
  - CE 确认基址和偏移（复习第5章）
  - C 代码：OpenProcess → ReadProcessMemory 读取阳光/冷却等
  - 写一个控制台程序实时显示游戏数据
- 项目二：修改游戏数据
  - WriteProcessMemory 修改阳光值
  - 写一个菜单式修改器
- 项目三：DLL 注入
  - 为什么需要 DLL 注入（WriteProcessMemory 的局限性）
  - 编写 DLL：DllMain + 功能函数
  - 编写注入器：OpenProcess → VirtualAllocEx → WriteProcessMemory → CreateRemoteThread
  - 注入后在 DLL 内直接读写游戏内存
- 你刚才做了什么：Windows API 在逆向中的应用
- 练习：给 DLL 加一个新功能（如修改金币）
- 字数目标：7000-10000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 11: 第10章 — 终极项目（下）：Hook 与自动化

**Files:**
- Create: `src/data/books/reverse-engineering/project/dll-hook.md`

- [ ] **Step 1: 写第10章**

文件 `src/data/books/reverse-engineering/project/dll-hook.md`:

内容要点：
- frontmatter: title, description, order: 10
- 动手目标：Hook 游戏函数，实现自动收集阳光等自动化功能
- Hook 原理（不讲理论，直接做）：
  - Inline Hook：修改函数开头的指令跳到自己的代码
  - 实战：Hook 阳光创建函数，自动执行收集逻辑
- 自动收集阳光：
  - 用 IDA 分析阳光掉落的调用链
  - Hook 关键 CALL，在 Hook 函数内自动调用收集函数
  - 编写完整 DLL 代码
- 全功能辅助工具整合：
  - 阳光锁定 + 无冷却 + 自动收集 + 全屏爆炸
  - 编写 GUI（可选，用 ImGui 或简单控制台菜单）
- 调试注入的 DLL：
  - x64dbg 附加到游戏进程 → 在 DLL 代码设断点 → 调试 Hook 逻辑
- 回顾全书：从第 1 章爆破 CrackMe 到现在写完整辅助工具，你学会了什么
- 练习：实现一个新功能（如自动种植物/自动铲除）
- 字数目标：7000-10000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 12: 全书验证

- [ ] **Step 1: 运行完整验证流程**

Run: `npm run format && npm run format:check && npm run lint && npm run build`

- [ ] **Step 2: 检查所有章节 frontmatter 正确**

确认每章的 order 字段正确（1-10），group 字段与 _index.md 一致

- [ ] **Step 3: 浏览器验证**

启动 dev server，访问 books 页面，确认：
- 书籍出现在列表中
- 三个分组正确显示（基础准备 / 工具实战 / 终极项目）
- 每章可正常访问
- 侧边栏导航正确

---

## 写作注意事项

1. **不要写废话**：每章开头就是动手目标，不写"本章将介绍..."
2. **代码要完整可运行**：C/C++ 代码给出完整可编译的版本，不是片段
3. **汇编注释要到位**：每行汇编都有中文注释解释
4. **截图位置标记**：用 `<!-- 截图：xxx -->` 标记需要配图的位置
5. **练习题要有答案**：练习题附在章节末尾，答案用折叠块（`<details>`）
6. **遵循博客格式规范**：AGENTS.md 中的 frontmatter 格式、字数要求
