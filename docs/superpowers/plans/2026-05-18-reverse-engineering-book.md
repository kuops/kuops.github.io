# 《逆向工程实战入门》实施计划（v3）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在博客 books 系统中创建《逆向工程实战入门》书籍，共 18 章逆向工程实战教程

**Architecture:** 利用博客现有的 filesystem-driven books 结构，在 `src/data/books/reverse-engineering/` 下创建书籍目录，按 入门篇/破解篇/游戏篇 三个分组组织 18 章内容

**Tech Stack:** Astro + Markdown，遵循现有 books collection schema（title, description, order, group）

**参考：**
- [Game Hacking Academy](https://gamehacking.academy/) — ~40章渐进式：基础 → 调试/逆向 → 编程 → 专项实战，每章一个精确主题
- [Malware Analysis Crash Course](https://blackhat.com/us-18/training/malware-analysis-crash-course.html) (FLARE/Mandiant) — x86 汇编速成 → 静态 → 动态 → 综合
- [game-reversing](https://github.com/kovidomi/game-reversing) — 学习路径：CE → 十六进制/内存 → x86 汇编 → C++ → IDA/Ghidra → Win32 API

**设计原则（v3）：**
1. **以案例破解为主**：前面以 CrackMe / 自写程序 / 真实软件破解推进，游戏（植物大战僵尸）全篇放最后
2. **工具自然穿插**：不按工具分章，而是在案例中遇到什么就用什么（x64dbg → VS Studio → IDA → 010 Editor → CE）
3. **实战 + 原理结合**：每个案例自然引出需要的原理，涵盖到所有知识点即可
4. **每章 3000-8000 字**，分 5-8 个 `##` 小节，每个小节 400-1000 字
5. **图文并茂**：几乎每个小节都配图
   - `<!-- 📸 截图：描述 -->` — 需要实际操作截取的截图
   - `<!-- 🎨 画图：描述 -->` — 需要绘制的示意图（内存布局、跳转表、Hook 原理等）
6. **不写虚拟机搭建**：假设读者在 Windows 环境操作
7. **游戏篇全篇用植物大战僵尸**：一条线贯穿，从 CE 改内存到全功能辅助工具

---

## 文件结构总览

```
src/data/books/reverse-engineering/
  index.md                              ← 书籍入口
  getting-started/
    _index.md                           ← 分组：入门篇
    intro.md                            ← 第1章：逆向工程是什么
    first-crack.md                      ← 第2章：破解第一个 CrackMe
    number-basics.md                    ← 第3章：数字在计算机里长什么样
    c-asm-1.md                          ← 第4章：用 VS 写程序自己逆（上）
    c-asm-2.md                          ← 第5章：用 VS 写程序自己逆（中）
    c-asm-3.md                          ← 第6章：用 VS 写程序自己逆（下）
  cracking/
    _index.md                           ← 分组：破解篇
    keygen-easy.md                      ← 第7章：追注册码写 Keygen（简单）
    keygen-advanced.md                  ← 第8章：追注册码写 Keygen（进阶）
    ida-basics.md                       ← 第9章：用 IDA 重新看老朋友
    cpp-reversing.md                    ← 第10章：用 VS 写 C++ 自己逆
    pe-analysis.md                      ← 第11章：用 010 Editor 分析 PE 文件
    ida-x64dbg-combo.md                 ← 第12章：IDA + x64dbg 联合实战
    unpacking.md                        ← 第13章：打补丁与脱壳入门
  game/
    _index.md                           ← 分组：游戏篇（植物大战僵尸）
    ce-pvz.md                           ← 第14章：CE 修改植物大战僵尸
    external-trainer.md                 ← 第15章：给 PvZ 写外部修改器
    dll-inject.md                       ← 第16章：DLL 注入
    inline-hook.md                      ← 第17章：Inline Hook 实战
    full-tool.md                        ← 第18章：全功能辅助工具
```

---

### Task 1: 创建书籍目录结构与入口文件

**Files:**
- Create: `src/data/books/reverse-engineering/index.md`
- Create: `src/data/books/reverse-engineering/getting-started/_index.md`
- Create: `src/data/books/reverse-engineering/cracking/_index.md`
- Create: `src/data/books/reverse-engineering/game/_index.md`
- Delete: `src/data/books/reverse-engineering/preparation/` (旧目录，整目录删除)
- Delete: `src/data/books/reverse-engineering/tools/` (旧目录，整目录删除)
- Delete: `src/data/books/reverse-engineering/project/` (旧目录，整目录删除)

- [ ] **Step 1: 清理旧目录**

```bash
rm -rf src/data/books/reverse-engineering/preparation
rm -rf src/data/books/reverse-engineering/tools
rm -rf src/data/books/reverse-engineering/project
```

- [ ] **Step 2: 创建新目录结构**

```bash
mkdir -p src/data/books/reverse-engineering/getting-started
mkdir -p src/data/books/reverse-engineering/cracking
mkdir -p src/data/books/reverse-engineering/game
```

- [ ] **Step 3: 创建书籍入口文件 index.md**

文件 `src/data/books/reverse-engineering/index.md`:

```markdown
---
title: 逆向工程实战入门
description: 从零开始，用 x64dbg/IDA/CE/010 Editor 四个工具学会逆向工程。前半本破解程序，后半本做游戏辅助。
order: 1
---
```

- [ ] **Step 4: 创建 getting-started/_index.md**

```markdown
---
title: 入门篇
description: 从第一个 CrackMe 开始，用自己写的 C/C++ 代码建立高级语言与汇编的直觉。
group: 入门篇
order: 1
---
```

- [ ] **Step 5: 创建 cracking/_index.md**

```markdown
---
title: 破解篇
description: 从追注册码到写 Keygen，用 IDA + x64dbg + 010 Editor 完整分析真实程序，包括 PE 结构和脱壳。
group: 破解篇
order: 2
---
```

- [ ] **Step 6: 创建 game/_index.md**

```markdown
---
title: 游戏篇
description: 全部围绕植物大战僵尸，从 CE 改内存到写外部修改器、DLL 注入、Hook，最终做出全功能辅助工具。
group: 游戏篇
order: 3
---
```

- [ ] **Step 7: 验证 build 通过**

Run: `npm run build`

---

### Task 2: 第1章 — 逆向工程是什么

**Files:**
- Create: `src/data/books/reverse-engineering/getting-started/intro.md`

- [ ] **Step 1: 写第1章**

小节结构：
1. **逆向工程能做什么** — 破解程序验证、游戏修改、恶意软件分析、漏洞挖掘、CTF 竞赛
   - `<!-- 🎨 画图：逆向工程的典型应用场景 -->`
2. **合法吗？** — 简短说明：安全研究/学习用途完全合法，不要用于商业破解
3. **我们需要什么** — 工具概览（不详细讲，后面用到时再深入）
   - x64dbg：动态调试器
   - IDA：静态反汇编/反编译
   - CheatEngine：内存扫描
   - 010 Editor：二进制文件分析
   - Visual Studio：写 C/C++ 程序编译后自己逆
   - `<!-- 📸 截图：五个工具的图标/界面拼图 -->`
4. **本书怎么学** — 先做后懂，每章一个实战项目
   - `<!-- 🎨 画图：全书学习路径图（入门篇→破解篇→游戏篇） -->`
5. **第一个作业** — 下载安装 x64dbg，下章要用

字数目标：2000-3000 字（引导章，短一点）

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 3: 第2章 — 破解第一个 CrackMe

**Files:**
- Create: `src/data/books/reverse-engineering/getting-started/first-crack.md`

- [ ] **Step 1: 写第2章**

小节结构：
1. **动手目标** — 下载 x64dbg，打开一个 CrackMe，改一个字节，破解成功
2. **准备工具** — 下载 x64dbg + 一个最简单的 CrackMe
   - `<!-- 📸 截图：x64dbg 官网下载页面 -->`
   - `<!-- 📸 截图：x64dbg 解压后的目录结构 -->`
   - `<!-- 📸 截图：CrackMe 程序界面，输入框 + 注册按钮 -->`
3. **用 x64dbg 打开程序** — 拖进去就行，认识四个窗口
   - `<!-- 📸 截图：x64dbg 打开 CrackMe 后的界面，标注 CPU/寄存器/内存/堆栈四个区域 -->`
   - `<!-- 🎨 画图：x64dbg 四窗口布局示意 -->`
4. **找到关键跳转** — 搜索字符串 → 双击定位 → 看到 CMP + JNE
   - `<!-- 📸 截图：右键 → Search for → All referenced text strings -->`
   - `<!-- 📸 截图：找到 "注册失败" 字符串 -->`
   - `<!-- 📸 截图：双击跳转到 CMP + JNE 处 -->`
5. **改一个字节** — 把 JNE 改成 JE 或 NOP，运行看效果
   - `<!-- 📸 截图：修改前的 JNE 指令 -->`
   - `<!-- 📸 截图：修改后变成 JE / NOP -->`
   - `<!-- 📸 截图：破解成功弹窗 -->`
6. **你刚才做了什么** — CMP 比较指令、JNE/JE 条件跳转
   - `<!-- 🎨 画图：CMP + JNE 执行流程图 -->`
7. **练习** — 再找 2 个类似 CrackMe 自己爆破

字数目标：3000-5000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 4: 第3章 — 数字在计算机里长什么样

**Files:**
- Create: `src/data/books/reverse-engineering/getting-started/number-basics.md`

- [ ] **Step 1: 写第3章**

小节结构：
1. **动手目标** — 打开计算器，用 010 Editor 看一个二进制文件，搞懂数据在磁盘和内存里的真实样子
2. **二进制与十六进制** — 为什么逆向里到处是 0x、为什么用十六进制
   - `<!-- 🎨 画图：二进制/十进制/十六进制对照表 -->`
3. **内存模型** — 地址、字节序（大小端）、4GB 地址空间
   - `<!-- 🎨 画图：进程内存布局（代码段/数据段/堆/栈） -->`
4. **用 010 Editor 看二进制文件** — 打开一个 exe，看 PE 头、节表
   - `<!-- 📸 截图：010 Editor 打开 exe 的界面 -->`
   - `<!-- 📸 截图：010 Editor 的 PE 模板解析结果 -->`
5. **寄存器** — eax/ebx/ecx/edx/esi/edi/ebp/esp 是什么，为什么重要
   - `<!-- 🎨 画图：通用寄存器及其用途 -->`
6. **练习** — 用 010 Editor 打开 CrackMe，找到里面的字符串

字数目标：3000-5000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 5: 第4章 — 用 VS 写程序自己逆（上）：变量与运算

**Files:**
- Create: `src/data/books/reverse-engineering/getting-started/c-asm-1.md`

- [ ] **Step 1: 写第4章**

小节结构：
1. **动手目标** — 用 VS 写最简单的 C 代码，编译后用 x64dbg 单步对照看
2. **准备环境** — VS 创建 C 控制台项目，编译 Debug 版
   - `<!-- 📸 截图：VS 创建 C 控制台项目 -->`
   - `<!-- 📸 截图：编译 Debug 配置 -->`
   - `<!-- 📸 截图：x64dbg 加载编译好的 exe -->`
3. **变量和赋值** — `int a = 10` → `mov dword ptr [ebp-4], 0x0A`
   - `<!-- 📸 截图：C 代码和对应汇编的并排对照 -->`
   - `<!-- 🎨 画图：栈帧布局，ebp-X 就是局部变量 -->`
4. **加减乘除** — 运算对应的汇编，编译器优化（乘2用 shl）
   - `<!-- 📸 截图：加减运算的 C→汇编对照 -->`
5. **看→改→练** — 给 C 代码预测汇编变化，给汇编还原 C
   - `<!-- 📸 截图：修改 C 代码后汇编的变化 -->`
6. **练习** — 3 道逆向题，答案用 `<details>` 折叠

字数目标：3000-5000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 6: 第5章 — 用 VS 写程序自己逆（中）：分支

**Files:**
- Create: `src/data/books/reverse-engineering/getting-started/c-asm-2.md`

- [ ] **Step 1: 写第5章**

小节结构：
1. **动手目标** — 搞懂 if/else 和 switch 在汇编里长什么样
2. **if/else** — cmp + jxx，强调 jle 跳的是 else 分支
   - `<!-- 📸 截图：if/else 的完整汇编对照 -->`
   - `<!-- 🎨 画图：if/else 的汇编执行流程 -->`
3. **嵌套 if** — 多层条件怎么变成多层 cmp+jxx
   - `<!-- 📸 截图：嵌套 if 的汇编 -->`
4. **switch：少量 case** — 连续 cmp+je
   - `<!-- 📸 截图：3 个 case 的 switch 汇编 -->`
5. **switch：大量 case** — 跳转表
   - `<!-- 📸 截图：10 个 case 的跳转表汇编 -->`
   - `<!-- 🎨 画图：跳转表结构示意图 -->`
6. **Release 下的优化** — setcc/cmov，编译器偷偷做的优化
   - `<!-- 📸 截图：Release 编译后的条件处理 -->`
7. **练习** — 给汇编片段还原 if/else/switch，答案用 `<details>` 折叠

字数目标：3000-5000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 7: 第6章 — 用 VS 写程序自己逆（下）：循环与函数

**Files:**
- Create: `src/data/books/reverse-engineering/getting-started/c-asm-3.md`

- [ ] **Step 1: 写第6章**

小节结构：
1. **动手目标** — 搞懂 for/while 循环、数组、函数调用在汇编里长什么样
2. **for 循环** — 固定结构：初始化 → 检查 → 循环体 → 递增 → jmp 回检查
   - `<!-- 📸 截图：for 循环的汇编对照 -->`
   - `<!-- 🎨 画图：循环的汇编结构流程图 -->`
3. **while / do-while** — 和 for 的区别
   - `<!-- 📸 截图：while vs do-while 的汇编对比 -->`
4. **数组访问** — `基址 + 索引 * sizeof`，`[ecx + eax*4]`
   - `<!-- 📸 截图：数组访问的汇编 -->`
5. **函数调用完整流程** — push 参数 → call → prologue → 执行 → eax 返回 → epilogue
   - `<!-- 🎨 画图：函数调用的栈变化全过程 -->`
6. **调用约定** — cdecl vs stdcall vs fastcall
   - `<!-- 📸 截图：不同调用约定的汇编对比 -->`
7. **练习** — 给包含循环和函数调用的汇编还原 C 代码，答案用 `<details>` 折叠

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 8: 第7章 — 追注册码写 Keygen（简单）

**Files:**
- Create: `src/data/books/reverse-engineering/cracking/keygen-easy.md`

- [ ] **Step 1: 写第7章**

小节结构：
1. **动手目标** — 从爆破升级到追出注册码，第一个真正意义上的逆向分析
2. **选择目标** — 一个字符串比较验证的简单 CrackMe
3. **x64dbg 下断点** — 在字符串比较函数（strcmp/lstrcmpA）下断
   - `<!-- 📸 截图：x64dbg 在 strcmp 设断点 -->`
   - `<!-- 📸 截图：断下来后看栈上的参数 -->`
4. **从内存读到正确注册码** — 直接在内存窗口看到明文密码
   - `<!-- 📸 截图：内存中看到正确注册码 -->`
5. **你刚才做了什么** — Windows API 字符串比较、栈传参、断点技巧
   - `<!-- 🎨 画图：strcmp 调用时的栈布局 -->`
6. **练习** — 找另一个字符串比较验证的 CrackMe

字数目标：3000-5000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 9: 第8章 — 追注册码写 Keygen（进阶）

**Files:**
- Create: `src/data/books/reverse-engineering/cracking/keygen-advanced.md`

- [ ] **Step 1: 写第8章**

小节结构：
1. **动手目标** — 追出一个数学运算的注册算法，用 C 写出注册机
2. **CrackMe #2（中等）** — 数学运算验证（异或 + 位移）→ 单步跟踪 → 手工算注册码
   - `<!-- 📸 截图：XOR/SHL/SHR 指令序列 -->`
   - `<!-- 🎨 画图：算法流程图 -->`
3. **CrackMe #3（进阶）** — 复杂算法 → 记录流程 → 用 C 写注册机
   - `<!-- 📸 截图：x64dbg 单步跟踪过程 -->`
   - `<!-- 📸 截图：用 VS 写的注册机代码和运行结果 -->`
4. **如何系统记录算法** — 画流程图 / 记关键寄存器值
   - `<!-- 🎨 画图：算法记录模板 -->`
5. **你刚才做了什么** — 逆向分析核心方法论（断点 → 单步 → 观察寄存器/内存 → 记录算法）
6. **练习** — 再找一个 CrackMe 独立分析并写 Keygen

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 10: 第9章 — 用 IDA 重新看老朋友

**Files:**
- Create: `src/data/books/reverse-engineering/cracking/ida-basics.md`

- [ ] **Step 1: 写第9章**

小节结构：
1. **动手目标** — 用 IDA 重新分析第 7-8 章追过的 CrackMe，感受效率提升
2. **IDA 界面认识** — 反汇编/十六进制/函数列表，基本操作
   - `<!-- 📸 截图：IDA 打开 CrackMe 后的界面，标注各区域 -->`
   - `<!-- 🎨 画图：IDA 界面布局示意 -->`
3. **交叉引用（X键）** — 从字符串找到引用它的函数
   - `<!-- 📸 截图：Strings 窗口找到关键字符串 -->`
   - `<!-- 📸 截图：X 键交叉引用跳转 -->`
4. **函数重命名（N键）+ 注释（;键）** — 让反汇编可读
   - `<!-- 📸 截图：重命名前后的对比 -->`
5. **F5 反编译** — 直接看伪代码
   - `<!-- 📸 截图：F5 反编译结果 vs 汇编对比 -->`
6. **实战对比** — IDA 分析第 8 章的 CrackMe #3，对比 x64dbg 追了半小时，IDA 按几下就定位
   - `<!-- 📸 截图：IDA 快速定位算法的过程 -->`
7. **练习** — 用 IDA 分析一个新 CrackMe

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 11: 第10章 — 用 VS 写 C++ 自己逆

**Files:**
- Create: `src/data/books/reverse-engineering/cracking/cpp-reversing.md`

- [ ] **Step 1: 写第10章**

小节结构：
1. **动手目标** — 用 VS 写几个 C++ 类和虚函数，编译后用 IDA 打开，找到虚表和 this 指针
2. **写一个简单的类** — VS 写 C++ 类，编译后 x64dbg 看成员访问
   - `<!-- 📸 截图：VS 中的 C++ 类代码 -->`
   - `<!-- 📸 截图：x64dbg 中看到 ecx = this -->`
3. **this 指针** — ecx = this，成员访问 = `[ecx + 偏移]`
   - `<!-- 📸 截图：成员函数调用的汇编 -->`
4. **虚函数表** — 用 IDA 找到虚表
   - `<!-- 📸 截图：IDA 中看到的虚表 -->`
   - `<!-- 🎨 画图：对象内存布局 + vtable 指针 + 函数指针数组 -->`
5. **虚函数调用** — `mov edx, [eax]` → `call [edx + 偏移]`
   - `<!-- 📸 截图：虚函数调用的汇编 -->`
6. **继承与内存布局** — 单继承线性，多重继承多 vtable
   - `<!-- 🎨 画图：单继承 vs 多重继承的内存布局对比 -->`
7. **练习** — 给 IDA 截图识别 C++ 特征（找虚表、找 this），答案用 `<details>` 折叠

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 12: 第11章 — 用 010 Editor 分析 PE 文件

**Files:**
- Create: `src/data/books/reverse-engineering/cracking/pe-analysis.md`

- [ ] **Step 1: 写第11章**

小节结构：
1. **动手目标** — 用 010 Editor 深入分析一个 exe 的内部结构，搞懂程序是怎么被 Windows 加载的
2. **PE 结构概览** — DOS 头 → PE 头 → 节表 → 各节
   - `<!-- 🎨 画图：PE 文件整体结构 -->`
   - `<!-- 📸 截图：010 Editor 的 PE 模板解析结果 -->`
3. **节表详解** — .text（代码）/ .data（数据）/ .rdata（只读数据）/ .rsrc（资源）
   - `<!-- 📸 截图：节表各字段详解 -->`
4. **导入表与 IAT** — 程序怎么调用 Windows API
   - `<!-- 📸 截图：010 Editor 中看到导入表 -->`
   - `<!-- 🎨 画图：IAT 工作原理（加载前后对比） -->`
5. **用 IDA 看导入表** — 交叉验证，IDA 的 Imports 窗口
   - `<!-- 📸 截图：IDA Imports 窗口 -->`
6. **实战** — 分析第 7 章的 CrackMe，看它导入了哪些 API，猜出验证逻辑
7. **练习** — 用 010 Editor 分析另一个程序，列出它调用的关键 API

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 13: 第12章 — IDA + x64dbg 联合实战

**Files:**
- Create: `src/data/books/reverse-engineering/cracking/ida-x64dbg-combo.md`

- [ ] **Step 1: 写第12章**

小节结构：
1. **动手目标** — 完整分析一个真实小软件，IDA 静态定位 + x64dbg 动态验证
2. **选择目标** — 一个合适的真实小软件（如共享软件的试用版）
3. **IDA 静态定位** — 字符串窗口 → 交叉引用 → F5 看伪代码 → 标记可疑函数
   - `<!-- 📸 截图：IDA 中定位关键函数过程 -->`
4. **x64dbg 动态验证** — 在 IDA 标记的地址下断点 → 运行验证猜测
   - `<!-- 📸 截图：x64dbg 中设断点 -->`
   - `<!-- 📸 截图：断下来后观察寄存器和内存 -->`
5. **IDA 与 x64dbg 协同技巧** — ASLR 地址对齐、分析结果导出
   - `<!-- 🎨 画图：IDA 地址 vs x64dbg 地址对齐示意 -->`
6. **你刚才做了什么** — 真实逆向工作流（先静态后动态，先全局后细节）
7. **练习** — 独立分析另一个类似软件

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 14: 第13章 — 打补丁与脱壳入门

**Files:**
- Create: `src/data/books/reverse-engineering/cracking/unpacking.md`

- [ ] **Step 1: 写第13章**

小节结构：
1. **动手目标** — 给一个加壳程序脱壳，给一个程序打补丁
2. **什么是壳** — 压缩壳/加密壳，为什么程序要加壳
   - `<!-- 🎨 画图：加壳前后 PE 结构对比 -->`
3. **用 010 Editor 识别壳** — 看 EP 段、节名特征
   - `<!-- 📸 截图：010 Editor 看加壳程序的节名 -->`
4. **找 OEP（原始入口点）** — x64dbg 单步到 OEP
   - `<!-- 📸 截图：x64dbg 中到达 OEP 的标志 -->`
5. **dump + 修复 IAT** — 用工具 dump 内存中的程序，修复导入表
   - `<!-- 📸 截图：修复 IAT 前后对比 -->`
6. **手动打补丁** — 用 010 Editor 直接修改 exe 文件字节
   - `<!-- 📸 截图：010 Editor 中找到要修改的字节 -->`
   - `<!-- 📸 截图：修改后保存，运行验证 -->`
7. **练习** — 找一个 UPX 壳程序练习脱壳

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 15: 第14章 — CE 修改植物大战僵尸

**Files:**
- Create: `src/data/books/reverse-engineering/game/ce-pvz.md`

- [ ] **Step 1: 写第14章**

小节结构：
1. **动手目标** — 用 CheatEngine 修改植物大战僵尸的阳光、冷却、金币
2. **安装植物大战僵尸** — 版本说明（推荐 1.0 英文原版）
3. **搜阳光** — 精确搜索 → 多次过滤 → 找到动态地址
   - `<!-- 📸 截图：CE 附加 PvZ 进程 -->`
   - `<!-- 📸 截图：首次搜索阳光值 50 -->`
   - `<!-- 📸 截图：花掉阳光后再次搜索，缩小结果 -->`
4. **追到基址** — "找出是什么访问了这个地址" → 指针扫描
   - `<!-- 📸 截图："找出是什么访问了这个地址" 操作 -->`
   - `<!-- 📸 截图：指针扫描结果 -->`
   - `<!-- 🎨 画图：动态地址 vs 静态基址 + 偏移链 -->`
5. **代码注入** — CE Auto Assembler 写脚本锁定阳光
   - `<!-- 📸 截图：CE Auto Assembler 窗口 -->`
   - `<!-- 📸 截图：注入脚本内容 -->`
6. **无冷却** — 搜冷却时间浮点数 → 找到写入指令 → NOP 掉
   - `<!-- 📸 截图：搜索浮点数 -->`
   - `<!-- 📸 截图：NOP 掉冷却写入指令 -->`
7. **练习** — 找到金币地址并修改

字数目标：4000-7000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 16: 第15章 — 给 PvZ 写外部修改器

**Files:**
- Create: `src/data/books/reverse-engineering/game/external-trainer.md`

- [ ] **Step 1: 写第15章**

小节结构：
1. **动手目标** — 用 C/C++ 给植物大战僵尸写一个控制台修改器
2. **CE 复盘** — 确认阳光基址和偏移链（复习第 14 章）
   - `<!-- 📸 截图：CE 确认 PvZ 阳光基址和偏移 -->`
3. **VS 创建项目** — 控制台程序
   - `<!-- 📸 截图：VS 创建项目 -->`
4. **读取游戏数据** — FindWindow → GetWindowThreadProcessId → OpenProcess → ReadProcessMemory
   - `<!-- 📸 截图：控制台程序实时显示游戏数据 -->`
5. **修改游戏数据** — WriteProcessMemory 修改阳光值
   - `<!-- 📸 截图：修改阳光值成功 -->`
6. **菜单式修改器** — 控制台菜单，选择功能（阳光/冷却/金币）
   - `<!-- 📸 截图：菜单式修改器界面 -->`
7. **你刚才做了什么** — 外部修改器的工作原理
   - `<!-- 🎨 画图：外部修改器架构（独立进程 → OpenProcess → Read/WriteProcessMemory → 目标进程） -->`

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 17: 第16章 — DLL 注入

**Files:**
- Create: `src/data/books/reverse-engineering/game/dll-inject.md`

- [ ] **Step 1: 写第16章**

小节结构：
1. **动手目标** — 把 DLL 注入到植物大战僵尸进程，在进程内部直接操作内存
2. **为什么需要 DLL 注入** — 外部修改器的局限性（速度慢、权限受限）
   - `<!-- 🎨 画图：外部修改 vs DLL 注入对比 -->`
3. **编写 DLL** — VS 创建 DLL 项目，DllMain + 功能函数
   - `<!-- 📸 截图：VS 创建 DLL 项目 -->`
   - `<!-- 📸 截图：DllMain 代码 -->`
4. **编写注入器** — OpenProcess → VirtualAllocEx → WriteProcessMemory → CreateRemoteThread
   - `<!-- 🎨 画图：DLL 注入流程图 -->`
   - `<!-- 📸 截图：注入器代码 -->`
5. **注入后操作** — DLL 内直接读写游戏内存（不再需要 OpenProcess）
   - `<!-- 📸 截图：DLL 内直接修改阳光 -->`
6. **用 x64dbg 调试注入的 DLL** — 附加进程 → 在 DLL 代码设断点
   - `<!-- 📸 截图：x64dbg 调试注入的 DLL -->`
7. **练习** — 让注入的 DLL 弹 MessageBox 确认注入成功

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 18: 第17章 — Inline Hook 实战

**Files:**
- Create: `src/data/books/reverse-engineering/game/inline-hook.md`

- [ ] **Step 1: 写第17章**

小节结构：
1. **动手目标** — Hook 植物大战僵尸的函数，实现自动收集阳光
2. **Hook 是什么** — 不讲理论，直接看：修改函数开头 5 字节跳到自己的代码
   - `<!-- 🎨 画图：Inline Hook 原理（原始流程 vs Hook 后流程） -->`
3. **找到 Hook 点** — 用 IDA 分析阳光掉落的调用链
   - `<!-- 📸 截图：IDA 中阳光相关函数 -->`
   - `<!-- 📸 截图：x64dbg 验证调用链 -->`
4. **写 Hook 函数** — 保存原始指令 → 跳到自定义逻辑 → 跳回
   - `<!-- 📸 截图：Hook DLL 代码 -->`
5. **注入并测试** — 注入带 Hook 的 DLL → 游戏中验证自动收集阳光
   - `<!-- 📸 截图：注入后游戏自动收集阳光 -->`
6. **调试 Hook** — x64dbg 附加 → 在 Hook 函数设断点 → 单步调试
   - `<!-- 📸 截图：x64dbg 调试 Hook 逻辑 -->`
7. **练习** — Hook 另一个函数（如冷却函数）

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 19: 第18章 — 全功能辅助工具

**Files:**
- Create: `src/data/books/reverse-engineering/game/full-tool.md`

- [ ] **Step 1: 写第18章**

小节结构：
1. **动手目标** — 整合前面所有技术，做一个全功能植物大战僵尸辅助工具
2. **功能规划** — 阳光锁定 + 无冷却 + 自动收集 + 全屏爆炸，一个 DLL 搞定
   - `<!-- 📸 截图：整合后的 DLL 代码结构 -->`
3. **全屏爆炸** — 用 IDA 找到爆炸相关函数，在 DLL 中直接调用
   - `<!-- 📸 截图：IDA 找爆炸函数 -->`
4. **控制台菜单控制** — DLL 内建菜单，热键开关各功能
   - `<!-- 📸 截图：控制台菜单界面 -->`
5. **调试与排错** — 常见问题排查（注入失败、Hook 崩溃、地址偏移）
   - `<!-- 📸 截图：x64dbg 调试排错过程 -->`
6. **回顾全书** — 从第 1 章爆破 CrackMe 到第 18 章写完整辅助工具，你学会了什么
   - `<!-- 🎨 画图：全书知识体系回顾图 -->`
7. **下一步** — 推荐进阶学习资源（GHA、GuidedHacking、game-reversing 等）

字数目标：4000-6000 字

- [ ] **Step 2: 验证 format:check + lint + build**

---

### Task 20: 全书验证

- [ ] **Step 1: 运行完整验证流程**

Run: `npm run format && npm run format:check && npm run lint && npm run build`

- [ ] **Step 2: 检查所有章节 frontmatter 正确**

确认每章的 order 字段正确（1-18），group 字段与 _index.md 一致

- [ ] **Step 3: 浏览器验证**

启动 dev server，访问 books 页面，确认：
- 书籍出现在列表中
- 三个分组正确显示（入门篇 / 破解篇 / 游戏篇）
- 每章可正常访问
- 侧边栏导航正确

---

## 写作注意事项

1. **不要写废话**：每章开头就是动手目标，不写"本章将介绍..."
2. **代码要完整可运行**：C/C++ 代码给出完整可编译的版本，不是片段
3. **汇编注释要到位**：每行汇编都有中文注释解释
4. **图文标记规范**：
   - `<!-- 📸 截图：描述 -->` — 需要实际操作时截取
   - `<!-- 🎨 画图：描述 -->` — 需要绘制示意图（后续确定工具）
   - 几乎每个小节都应有配图
5. **练习题要有答案**：练习题附在章节末尾，答案用折叠块（`<details>`）
6. **每章 3000-8000 字**（第1章引导章可短至 2000-3000 字），分 5-8 个 `##` 小节
7. **遵循博客格式规范**：AGENTS.md 中的 frontmatter 格式、字数要求
8. **用什么工具讲什么**：工具在案例中自然引入，不单独铺开讲工具操作
9. **游戏篇统一用植物大战僵尸**：从第 14 章到第 18 章一条线贯穿
