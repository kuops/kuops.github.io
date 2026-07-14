# 《逆向工程实战入门》写作计划

> 最后更新：2026-07-06

## 一、全书结构

```
src/data/books/reverse-engineering/
├── index.md                          ← 书籍入口 (order 1)
├── getting-started/                  ← 第一大分类：入门篇 (order 1)
├── assembly-basics/                  ← 第二大分类：汇编基础 (order 2)
├── c-asm/                            ← 第三大分类：C 与汇编 (order 3)
├── cracking/                         ← 第四大分类：破解篇 (order 2，待定)
└── game/                             ← 第五大分类：游戏篇 (order 3，待定)
```

## 二、当前进度总览

| 分类 | 章节数 | 已发布 (draft: false) | 草稿 (draft: true) | 完成度 |
|------|--------|----------------------|---------------------|--------|
| 入门篇 | 3 章 | 3 章 | 0 | 100% |
| 汇编基础 | 9 章 | 9 章 | 0 | 100% |
| C 与汇编 | 18 章 | 18 章 | 0 | 100% |
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
| 12 | asm-float-sse.md | 浮点数与 SSE 指令 |

### 待完成分类详情

#### C 与汇编 (order 11-21) — 18/18 已发布 ✅

| Order | 文件 | 标题 | 状态 | 备注 |
|-------|------|------|------|------|
| 11 | c-asm-1.md | 变量与赋值 | ✅ 已发布 | 原 binary-file-basics 已并入此章 |
| 12 | c-asm-2.md | 运算与位操作 | ✅ 已发布 | |
| 13 | c-asm-3.md | if/Else 分支 | ✅ 已发布 | |
| 14 | c-asm-4.md | switch 与跳转表 | ✅ 已发布 | |
| 15 | c-asm-5.md | 循环 | ✅ 已发布 | 4 张流程图 SVG |
| 16 | c-asm-6.md | 指针 | ✅ 已发布 | 原计划"数组与字符串"，改为指针 |
| 17 | c-asm-7.md | 数组 | ✅ 已发布 | 原计划"指针与内存"，改为数组 |
| 18 | c-asm-8.md | 字符串 | ✅ 已发布 | 新增章，含 ASCII/GBK/UTF-8/UTF-16 编码 |
| 19 | c-asm-9.md | 函数调用 | ✅ 已发布 | 重构完成，与 asm-function-call 差异化：返回值机制、可变参数、fastcall 内部、递归、反推签名 |
| 20 | c-asm-10.md | 结构体 | ✅ 已发布 | 重构完成，含对齐/padding/嵌套/柔性数组/反推结构体，3 张 SVG |
| — | ~~asm-memory.md~~ | ~~字符串、内存与交叉引用~~ | 🗑️ 已删除 | 内容属逆向实操，移至破解篇 |
| 34 | c-asm-11.md | 枚举与类型转换 | ✅ 已发布 | 新增章，枚举/隐式转换/强转/指针强转/函数指针强转/UB，汇编全部 dumpbin 验证 |
| 35 | c-asm-12.md | 位域与联合体 | ✅ 已发布 | 位域(读-改-写/shr+and)/联合体(同一地址混用ptr)/结构体里联合体/反推，汇编全部 dumpbin 验证 |
| 36 | c-asm-13.md | x86-64 汇编形态 | ✅ 已发布 | 寄存器扩展/fastcall前4参数走寄存器/shadow space/64位栈帧/movsxd/RIP相对寻址/结构体按值传递，汇编全部 dumpbin x64 验证 |
| 37 | c-asm-14.md | C++ this 指针与成员访问 | ✅ 已发布 | thiscall 约定、[ecx+offset] 访问成员、构造/析构函数、堆对象 new/delete（??2/??3/??_G）、bool 成员、引用 vs 指针、继承属性布局，汇编全部 dumpbin 验证 |
| 38 | c-asm-15.md | 虚函数表与多态 | ✅ 已发布 | vtable 内存布局、vptr 在偏移 +0、单继承覆盖 vptr、部分重写槽位替换、多继承多 vptr、this 指针调整、RTTI/dynamic_cast、非虚方法没有多态、5 张 SVG，汇编全部 dumpbin 验证 |
| 39 | c-asm-16.md | 编译器优化与 Release 形态 | ✅ 已发布 | 常量折叠/死代码消除/内联/寄存器分配/循环展开/尾递归/虚调用逻辑岛，dumpbin 验证 |
| 40 | c-asm-17.md | STL 与 C++ 逆向实战 | ✅ 已发布 | string SSO 28 字节/vector 三指针 16 字节/map 树结构 12 字节/迭代器即指针/模板修饰名/偏移还原结构，dumpbin 验证 |
| 41 | c-asm-18.md | 异常处理：try/catch 与 SEH | ✅ 已发布 | SEH 帧注册/try 状态变量/throw 复制对象/catch 块跳转/栈展开状态变量/无符号识别，dumpbin 验证 |

**c-asm 章节的待办事项：**
- [x] 逐一审查内容质量、技术准确性（c-asm-1~7 已完成）
- [x] 统一风格（callout 格式、代码块语言标签、练习用 `> [!NOTE]-` 折叠）
- [x] 补充 SVG 图表（c-asm-3~5 已有流程图）
- [x] 将 draft: true 改为 draft: false 逐章发布（c-asm-1~7 已发布）
- [x] 确认 c-asm-6 与 asm-string 的字符串内容不重复（c-asm-6 改为指针，已消解）
- [x] 重构 c-asm-9（函数调用）— 已完成，与 asm-function-call 差异化
- [x] 重构 c-asm-10（结构体）— 已完成，含对齐/padding/嵌套/柔性数组/反推结构体
- [x] 审查 asm-memory.md — 已删除，内容移至破解篇

#### 破解篇 — 待开始

> 2026-07-03 调研后规划，基于 FLARE Malware Analysis Crash Course (Ch6 调试技巧 / Ch9 Windows 逆向) 和 kovidomi/game-reversing 资源。

| Order | 文件 | 标题 | 内容要点 |
|---|---|---|---|
| 22 | cracking-1.md | 破解方法论与工具链 | 三入手点（字符串/API/算法）；IDA Pro 入门（反汇编/交叉引用/函数图/伪代码 F5）；x64dbg 进阶（条件/内存/硬件断点/trace）；010 Editor 模板；静态+动态配合 |
| 23 | cracking-2.md | PE 文件格式 | PE 结构总览（DOS头/PE头/节表/节数据）；节区（.text/.data/.rdata/.bss）；导入表/导出表；入口点与 OEP；010 Editor 模板解析；IDA Imports 窗口 |
| 24 | cracking-3.md | 脱壳 | 壳原理（压缩/加密代码段，运行时解压）；常见壳（UPX/ASPack/Themida）；脱壳三法（单步到 OEP/内存断点/ESP 定律）；Dump + 修复 IAT；Scylla |
| 25 | cracking-4.md | 注册算法逆向 | 追注册码流程（找验证函数→理解算法→逆推）；常见算法（异或/查表/CRC32/hash）；用户名绑定 vs 机器码绑定；写 Keygen；反调试（IsDebuggerPresent/PEB/时间检测）与绕过 |
| 26 | cracking-5.md | Shellcode 与 Patch | shellcode 约束（位置无关/无导入表）；x64dbg 直接写 shellcode 字节；GetProcAddress+LoadLibrary 自动解析 API；Patch 技术（改跳转/NOP 填充/改返回值）；实战 Patch CrackMe |

#### 游戏篇 — 待开始

> 2026-07-03 调研后规划，基于 kovidomi/game-reversing 学习路径和工具链。全程围绕植物大战僵尸。

| Order | 文件 | 标题 | 内容要点 |
|---|---|---|---|
| 27 | game-1.md | Cheat Engine 入门 | CE 内存扫描原理（首次扫描→改变→再扫描→缩小范围）；精确 vs 模糊扫描；数据类型选择；找阳光值；CE 内存视图；指针扫描找静态基址 |
| 28 | game-2.md | 静态地址与指针链 | ASLR；静态基址 vs 动态地址；指针链（基址+多级偏移）；CE 指针扫描器；IDA 里找静态基址（特征搜索+交叉引用）；PvZ 阳光指针链实例 |
| 29 | game-3.md | Windows 进程内存与 API | Win32 API（OpenProcess/RPM/WPM）；进程内存布局（.text/.data/堆/栈/PEB/TEB）；句柄概念；匈牙利命名；IDA 导入表定位 API；外部修改器原型 |
| 30 | game-4.md | 外部修改器开发 | C++ 写外部修改器（OpenProcess+RPM+WPM）；定时读游戏数据；一键功能（满阳光/无冷却/自动收集）；SeDebugPrivilege |
| 31 | game-5.md | DLL 注入 | 内部 vs 外部辅助；注入三法（CreateRemoteThread/SetWindowsHookEx/手动映射）；CreateRemoteThread 全流程（VirtualAllocEx→WPM→CreateRemoteThread）；注入后 DLL 生命周期；x64dbg 调试注入的 DLL |
| 32 | game-6.md | Hook 与代码注入 | Hook 原理（替换前几字节跳转）；IAT Hook vs Inline Hook；Detours/MinHook；Hook 游戏函数（阳光扣减/冷却计时）；调用原函数（保存原始指令） |
| 33 | game-7.md | 游戏实体逆向 | ReClass.NET 还原实体结构体；从阳光地址反推 Plant/Zombie/Lawn 结构；指针链遍历（对象管理器→实体列表→单个实体）；vtable 识别（C++ 多态调用）；遍历所有植物/僵尸 |

### C 与汇编篇 — 后续补章

> 2026-07-03 调研后新增。c-asm 1-10 覆盖了 C 语言层，但游戏逆向的实践目标是 C++ 游戏引擎，以下为明确缺口。

| Order | 文件 | 标题 | 内容要点 |
|---|---|---|---|
| 34 | c-asm-11.md | 枚举与类型转换 | 枚举（汇编层面就是整数，编译后和 #define 无区别）；隐式转换（整数提升、int↔double、char↔int）；显式强转语法；指针强转（int*↔char*、int(*)[N] 切行宽）；int 与字符串互转（reinterpret/union 两种路子）；函数指针强转；严格别名与 UB 边界 |
| 35 | c-asm-12.md | 位域与联合体 | 位域（游戏状态标志位高频用法，呼应 asm-logic）；联合体（同内存多种解读，呼应强转章 union 路子）；取/设/清状态位 |
| 36 | c-asm-13.md | x86-64 汇编形态 | 64 位寄存器扩展（RAX/R8-R15）；fastcall 约定（前 6 参数走寄存器）；64 位栈帧 [rsp+N]；MOVSX/MOVZX 更频繁；何时遇到 x64（现代游戏/系统 DLL/驱动） |
| 37 | c-asm-14.md | C++ this 指针与成员访问 | thiscall 约定（ecx=this）；`obj.method()`→`lea ecx,[obj]; call method`；`[ecx+offset]` 访问成员；构造/析构函数汇编；new/delete vs malloc/free；this 与多级指针 |
| 38 | c-asm-15.md | 虚函数表与多态 | vtable 内存布局（对象首 4 字节=vptr）；`virtual func()`→`mov eax,[ecx]; call [eax+offset]`；继承链内存布局；多继承 vtable；RTTI/dynamic_cast；引擎 UObject/Entity 布局 |
| 39 | c-asm-16.md | 编译器优化与 Release 形态 | Debug vs Release；常量折叠/死代码消除/循环展开；寄存器分配差异；内联/尾调用；sizeof 是编译期消除（不产生指令）；看懂 Release 反汇编的策略 |
| 40 | c-asm-17.md | STL 与 C++ 逆向实战 | std::string/vector/map 内存布局；迭代器汇编形态；模板实例化；综合实战（逆向 C++ 程序 + ReClass.NET 还原类结构） |
| 41 | c-asm-18.md | 异常处理：try/catch 与 SEH | SEH 帧注册（fs:0 链表）；try 状态变量（[ebp-4]）；throw 复制对象 + __CxxThrowException；catch 块跳转；栈展开状态变量；无符号识别 |

> **优先级**：c-asm-14 (this 指针) 是游戏逆向分水岭，FLARE 和 kovidomi 都强调 C++ 是游戏逆向必学，但按阅读顺序先写 c-asm-13 (x86-64)。

### 工具穿插策略

三大工具 (IDA Pro / x64dbg / CE) 在不同篇章各有侧重，穿插引入，首次出现时给完整界面介绍，后续只讲新功能：

| 篇 | 主力工具 | 辅助工具 |
|---|---|---|
| 入门篇 | x64dbg | — |
| 汇编基础篇 | x64dbg | — |
| C 与汇编篇 | x64dbg | IDA（伪代码对照） |
| 破解篇 | IDA Pro（静态）+ x64dbg（动态） | 010 Editor（PE/二进制模板）、Scylla（IAT 修复） |
| 游戏篇 | Cheat Engine（内存扫描） | IDA Pro（静态基址）、ReClass.NET（结构体还原）、x64dbg（DLL 调试） |

### 暂不纳入

- **游戏文件格式逆向** — 磁盘资产格式逆向（模型/纹理/存档），与本书内存逆向方向不同
- **Windows internals 深入** — 超出"实战入门"定位，需要时引用即可
- **网络逆向 / 封包** — 本书游戏篇以单机 PvZ 为主，暂不需要

## 三、已完成的关键工作

### 近期 (2026-06-29 ~ 07-14)

- **c-asm-18 异常处理**：新增章，SEH 帧注册(fs:0 链表)/try 状态变量([ebp-4])/throw 复制对象 + __CxxThrowException/catch 块(__catch$)/栈展开状态变量/__ehhandler 分发/无符号识别，汇编全部 dumpbin 验证
- **c-asm-17 STL 与 C++ 逆向实战**：新增章，string SSO 28 字节(短串直接存对象内部/长串堆指针)/vector 三指针 16 字节(size=指针差/元素大小)/map 树结构 12 字节/迭代器即指针/auto 是编译期推导/模板修饰名表格/综合实战从偏移还原结构，汇编全部 dumpbin 验证。异常处理从原计划拆出独立成 c-asm-18
- **c-asm-16 编译器优化与 Release 形态**：新增章，常量折叠/死代码消除/内联/寄存器分配/循环展开/尾递归/虚调用逻辑岛，dumpbin 验证
- **c-asm-15 虚函数表与多态**：补"非虚方法没有多态"小节（hide vs override）
- **c-asm-14 C++ this 指针**：补堆对象/全局对象/继承属性布局小节
- **c-asm-9 函数调用**：补 static 局部变量小节

- **c-asm-12 位域与联合体**：新增章，位域(写=读-改-写 and/or / 读=shr+and / 布局排列 / 全1值省略and)/联合体(同一地址混用ptr大小 / float查看位模式 / 类型拆分)/结构体里联合体(tagged union)/从汇编反推位域与联合体/逆向识别清单，汇编全部 dumpbin 验证
- **c-asm-11 枚举与类型转换**：新增章，枚举就是整数/隐式转换(movsx/movzx)/整数提升/显式强转(截断扩展)/指针强转(无指令)/float-int 位模式/结构体间强转/函数指针强转/UB(有符号溢出/严格别名)/逆向识别清单/反推类型转换，汇编全部 dumpbin 验证
- **c-asm-10 结构体**：完整重构，含内存布局/对齐 padding/嵌套结构体/柔性数组/从汇编反推结构体/逆向识别清单，3 张 SVG（Player/Mixed/Rect 内存布局），汇编全部 dumpbin 验证
- **c-asm-9 函数调用**：重构完成，与 asm-function-call 差异化（返回值机制 EAX/EDX:EAX/ST(0)、可变参数与 cdecl、fastcall 被调者内部、递归栈叠加、从汇编反推函数签名），汇编全部 dumpbin 验证
- **c-asm-8 字符串**：完善编码章节（GBK 首字节/尾字节、Unicode 与 UTF-8/UTF-16 关系、GB 18030、扩展 ASCII）、补缓冲区溢出 WARNING/Release 优化 NOTE/魔术数 TIP
- **c-asm-5 循环**：完整重写，4 张流程图 SVG（for/while/dowhile/nested），MSVC Debug/Release 汇编验证
- **c-asm-6 指针**：从旧"数组与字符串"重构为"指针"，编译验证所有汇编
- **c-asm-7 数组**：从旧"指针与内存"重构为"数组"，编译验证所有汇编
- **SVG 规范更新**：补充循环流程图布局规则（回跳线分通道、箭头对齐中心、viewBox 不用负坐标等）
- **第 4 章 switch 图**：删除图例，修正底部留白

### 历史关键工作

- **c-asm-1~4 重写**：按统一风格重构（变量/运算/分支/switch）
- **第 9/10 章拆分**：原 asm-stack 拆为"栈与 push/pop" + "函数调用与栈帧"
- **第 4 章扩充**：新增内存布局概览 + memory-layout.svg、段前缀 NOTE、内存保护 NOTE
- **第 11 章完整重写**：字符串指令与 REP 前缀
  - 新增 CMPS 章节，四种指令全覆盖 (MOVS/STOS/SCAS/CMPS)
  - REP 前缀从章末移到 MOVS 之前
  - 现代 strlen 不用 repne scasb (用 magic number 0x7EFEFEFF)
  - 内联映射速查表只留 memcpy/memset (实际会被内联的)
  - 7 个 SVG 图表全部重做
- **binary-file-basics 移除**：内容并入 c-asm-1
- v1-v3 书籍结构演进：从 10 章 MVP → 18 章三篇 → 当前多分类结构
- v4 指令补全：MOVSX/MOVZX、XCHG、MUL、PUSHA/POPA、字符串指令三件套
- 全书 SVG 规范化：调色板统一、字体栈、透明度、圆角、font-weight
- 写作规范建立：agents-md/ 下 4 份规范文档
- AstroPaper 6 升级 + filesystem-driven books 架构

## 四、下一步优先级

1. **cracking-1/2** — 破解篇地基（方法论 + PE），含原 asm-memory.md 内容
2. **game-1 CE 入门** — 游戏篇起点
3. 其余按篇内顺序推进

## 五、写作规范参考

- `agents-md/writing.md` — 篇幅指南、frontmatter、书籍结构、C 代码汇编验证
- `agents-md/tutorial-markdown.md` — Markdown 排版 (callout、表格、代码块)
- `agents-md/tutorial-svg.md` — SVG 插图规范 (调色板、字体、viewBox、流程图布局)
- `agents-md/astro.md` — 开发指南 (命令、验证、架构)
