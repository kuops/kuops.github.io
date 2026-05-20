---
title: 栈与函数调用
draft: true
description: 函数调用是汇编里最复杂也最重要的机制。搞懂栈帧、push/pop、call/ret 的配合，你就能追踪任何函数的执行过程。
order: 5
---

# 栈与函数调用

前两章学了数据搬运和算术跳转，能看懂直线代码和 if/else 了。但程序不只是直线执行——它有函数调用、参数传递、局部变量、返回值。这些全靠**栈**来支撑。

这一章搞懂栈，你就具备了追踪任何函数调用的能力。

## 栈是什么

栈是一块**后进先出（LIFO）**的内存区域。你可以把它想象成一摞盘子——最后放上去的盘子最先拿走。

<!-- 🎨 画图：栈的生长方向（从高地址往低地址长） -->

几个关键特点：

- 栈在内存中是**从高地址往低地址增长**的。新数据放在更低的地址
- **ESP（栈指针）** 始终指向栈顶（最低地址）
- **EBP（基址指针）** 指向当前函数的栈帧底部，用来定位局部变量和参数
- 每次压入 4 字节（32 位程序），ESP 减 4
- 每次弹出 4 字节，ESP 加 4

## push：压栈

```
push eax                ; 把 eax 的值压入栈顶
```

`push` 做了**两件事**：

1. ESP 先减 4（栈顶往下移一格）
2. 把值写到 ESP 指向的新位置

等价于：

```
sub esp, 4
mov dword ptr [esp], eax
```

### 跟踪示例

假设初始 ESP = `0x012FF310`，EAX = `0x00000005`：

```
指令         ESP         栈顶[ESP]     EAX     说明
──────────────────────────────────────────────────────────
初始状态    012FF310    —             00000005
push eax   012FF30C    00000005      00000005  ESP-4，值写到新栈顶
```

内存 `0x012FF30C` 现在存着 `0x00000005`。EAX 不变。

连续 push 多个值：

```
指令          ESP         栈顶[ESP]     EAX     EBX
──────────────────────────────────────────────────────────────
初始状态     012FF310    —             00000005  0000000A
push eax    012FF30C    00000005      00000005  0000000A
push ebx    012FF308    0000000A      00000005  0000000A
```

现在栈长这样（从低地址到高地址）：

```
地址         值
012FF308    0000000A    ← ESP 指向这里（栈顶）
012FF30C    00000005
012FF310    （旧数据）
```

**后进先出**——最后 push 进去的 EBX 在栈顶。

`push` **不影响任何标志位**。

## pop：弹栈

```
pop eax                 ; 从栈顶弹出 4 字节到 eax
```

`pop` 也做了**两件事**：

1. 从 ESP 指向的位置读 4 字节到目标寄存器
2. ESP 加 4（栈顶往上移一格）

等价于：

```
mov eax, dword ptr [esp]
add esp, 4
```

### 跟踪示例

接着上面的状态——ESP = `0x012FF308`，栈顶是 `0x0000000A`：

```
指令       ESP         EAX         说明
──────────────────────────────────────────────────
初始状态  012FF308    00000005
pop eax   012FF30C    0000000A    从栈顶读出 0x0A，ESP+4
```

EAX 变成了 `0x0000000A`（之前栈顶的值）。ESP 回到了 `0x012FF30C`。

**注意**：pop 之后，`0x012FF308` 里的数据 `0x0000000A` 并没有被清除，它还在内存里。只是 ESP 移走了，那块内存会被后续的 push 覆盖。所以"弹出"不是"删除"，而是"移动指针"。

`pop` **不影响任何标志位**。

### push 和 pop 的对称性

`push` 和 `pop` 常常成对出现，用来**临时保存和恢复寄存器**：

```asm
push eax                ; 保存 eax 的当前值
push ebx                ; 保存 ebx 的当前值
...                     ; 这里随便用 eax 和 ebx
pop  ebx                ; 恢复 ebx（后 push 的先 pop）
pop  eax                ; 恢复 eax（先 push 的后 pop）
```

注意 pop 的顺序必须和 push **相反**——最后 push 的最先 pop。

## call：调用函数

```
call 0x00401100         ; 调用地址 0x00401100 处的函数
```

`call` 做了**两件事**：

1. 把**下一条指令的地址**（返回地址）压栈
2. EIP 跳到目标地址

等价于：

```
push (下一条指令的地址)
jmp 目标地址
```

为什么要压返回地址？因为函数执行完后需要知道"回到哪里继续执行"。

### 跟踪示例

假设当前 EIP = `0x00401020`，ESP = `0x012FF310`：

```
地址          指令
00401020     call 0x00401100
00401025     mov ebx, eax          ← 这是 call 之后的下一条指令
```

执行 `call 0x00401100` 后：

```
ESP         EIP         栈顶[ESP]       说明
012FF30C    00401100    00401025        返回地址 0x00401025 压栈，EIP 跳到函数入口
```

栈顶现在存着 `0x00401025`——这就是 `call` 之后那条指令的地址。函数结束后会用到它。

`call` **不影响任何标志位**。

## ret：从函数返回

```
ret                     ; 从栈顶弹出返回地址，跳回去
```

`ret` 做了**两件事**：

1. 从栈顶弹出返回地址到 EIP
2. ESP 加 4

等价于：

```
pop eip        （概念上，实际不能直接这么写）
```

### 跟踪示例

函数执行到最后，ESP = `0x012FF30C`，栈顶是 `0x00401025`（之前 call 压入的返回地址）：

```
指令    ESP         EIP         说明
ret     012FF310    00401025    弹出返回地址，EIP 跳回 call 的下一条
```

现在 EIP 回到了 `0x00401025`（`mov ebx, eax`），函数调用完成。

`ret` **不影响任何标志位**。

## 栈帧：函数的"工作台"

每个函数被调用时，都会在栈上开辟一块属于自己的空间，叫做**栈帧（Stack Frame）**。栈帧里存着：

- 函数的参数
- 返回地址
- 旧 EBP（调用者的栈帧底部）
- 局部变量

<!-- 🎨 画图：完整栈帧结构 -->

### 函数序言（Prologue）

几乎每个函数开头都有这两条指令：

```asm
push ebp                ; 保存调用者的 EBP
mov  ebp, esp           ; 设置当前函数的 EBP = 当前 ESP
```

执行后，EBP 指向刚 push 进去的"旧 EBP"的位置。从这一刻起，`[ebp+X]` 用来访问参数，`[ebp-X]` 用来访问局部变量。

### 分配局部变量空间

```asm
sub esp, 0x0C           ; 在栈上分配 12 字节（3 个 int）
```

ESP 往低地址移 12 字节，腾出空间。这 12 字节就是局部变量的家。

### 函数尾声（Epilogue）

函数结束时，恢复栈并返回：

```asm
mov esp, ebp            ; 恢复 ESP（释放局部变量空间）
pop ebp                 ; 恢复调用者的 EBP
ret                     ; 返回到调用点
```

有的编译器用 `leave` 指令代替 `mov esp, ebp` + `pop ebp`，效果一样——下一节详细讲。

## 完整函数调用过程

让我们跟踪一个完整的函数调用。C 代码：

```c
int add(int a, int b) {
    int result = a + b;
    return result;
}

int main() {
    int sum = add(3, 5);
    return sum;
}
```

### 调用方（main）

```asm
push 5                  ; 参数 2（从右往左压栈）
push 3                  ; 参数 1
call add                ; 调用函数
add esp, 8              ; 清理参数（调用方负责，cdecl 约定）
mov dword ptr [ebp-4], eax  ; sum = 返回值
```

逐行跟踪——假设调用前 ESP = `0x012FF310`，EBP = `0x012FF320`：

```
指令                    ESP         栈内容                        EIP
────────────────────────────────────────────────────────────────────────
初始状态               012FF310                                  00401000
push 5                 012FF30C    [012FF30C]=5                  00401002
push 3                 012FF308    [012FF308]=3, [012FF30C]=5    00401004
call add               012FF304    [012FF304]=00401009           00401100
```

call 之后，栈顶是返回地址 `0x00401009`（`add esp, 8` 的地址）。EIP 跳到了 `add` 函数。

### 被调用方（add 函数）

```asm
00401100  push ebp                      ; 保存旧 EBP
00401101  mov  ebp, esp                 ; 设置新 EBP
00401103  sub  esp, 4                   ; 分配局部变量 result
00401106  mov  eax, dword ptr [ebp+8]   ; eax = 参数 a（值是 3）
00401109  add  eax, dword ptr [ebp+0Ch] ; eax += 参数 b（值是 5）
0040110C  mov  dword ptr [ebp-4], eax   ; result = eax（值是 8）
0040110F  mov  eax, dword ptr [ebp-4]   ; 返回值 = result（值是 8）
00401112  mov  esp, ebp                 ; 恢复 ESP
00401114  pop  ebp                      ; 恢复旧 EBP
00401115  ret                           ; 返回
```

逐行跟踪——从 call 之后开始，ESP = `0x012FF304`：

```
指令                    EBP         ESP         EAX   栈帧布局
───────────────────────────────────────────────────────────────────
push ebp               012FF320    012FF300    ?     [012FF304]=返回地址
                                                              [012FF300]=旧EBP(012FF320)
mov ebp, esp           012FF300    012FF300    ?     EBP现在指向旧EBP
sub esp, 4             012FF300    012FF2FC    ?     腾出[ebp-4]
mov eax, [ebp+8]       012FF300    012FF2FC    3     [ebp+8]=第一个参数
add eax, [ebp+0Ch]     012FF300    012FF2FC    8     [ebp+C]=第二个参数
mov [ebp-4], eax       012FF300    012FF2FC    8     result=[ebp-4]=8
mov eax, [ebp-4]       012FF300    012FF2FC    8     返回值=8
mov esp, ebp           012FF300    012FF300    8     ESP恢复（释放局部变量）
pop ebp                012FF320    012FF304    8     恢复旧EBP
ret                    012FF320    012FF308    8     弹出返回地址，EIP跳回main
```

<!-- 🎨 画图：栈帧的完整变化过程（5 个阶段：调用前→压参数→call→进入函数→ret） -->

### 栈帧布局图

ret 之后、add esp, 8 之前，栈帧是这样的（以 EBP 为基准）：

```
地址         值               含义
──────────────────────────────────────────────────
ebp+0Ch     00000005         参数 b（第二个参数）
ebp+8       00000003         参数 a（第一个参数）
ebp+4       00401009         返回地址（call 自动压入）
ebp         012FF320         旧 EBP（push ebp 压入）
ebp-4       00000008         局部变量 result
```

**规律**：

- **`[ebp+8]`** — 第一个参数
- **`[ebp+0Ch]`** — 第二个参数（+8 + 4 = +12 = 0x0C）
- **`[ebp-4]`** — 第一个局部变量
- **`[ebp-8]`** — 第二个局部变量
- **`[ebp]`** — 保存的旧 EBP
- **`[ebp+4]`** — 返回地址

参数在 EBP 上方（高地址），局部变量在 EBP 下方（低地址）。记住这个布局，逆向时看到 `[ebp+X]` 就知道是参数，`[ebp-X]` 就是局部变量。

### 调用方清理参数

函数返回后，main 继续执行：

```asm
add esp, 8              ; ESP += 8，把之前 push 的两个参数"扔掉"
mov dword ptr [ebp-4], eax  ; sum = eax（值是 8）
```

`add esp, 8` 把 ESP 恢复到 push 参数之前的位置。这种"调用方清理参数"的约定叫做 **cdecl**（C declaration），是 C/C++ 程序最常用的调用约定。

## 调用约定

上面的例子中，main 调用 add 后用 `add esp, 8` 清理了参数。这不是唯一的做法。**谁来清理参数**就是"调用约定"要回答的核心问题。

调用约定规定了三件事：

1. 参数怎么传递（压栈顺序、寄存器传参）
2. 谁来清理栈上的参数
3. 返回值放在哪里（EAX）

32 位 x86 最常用的两种约定是 **cdecl** 和 **stdcall**。

### cdecl：C 语言的默认约定

cdecl 是 C/C++ 程序中最常见的调用约定：

- 参数**从右往左**压栈
- **调用方（caller）负责清理参数**——call 之后用 `add esp, N` 恢复栈
- 支持可变参数（如 `printf`），因为只有调用方知道自己压了几个参数

```asm
; 调用 foo(3, 5) — cdecl
push 5                  ; 参数 2（右边的先压）
push 3                  ; 参数 1（左边的后压）
call foo
add esp, 8              ; ← 调用方清理，ESP 恢复
```

特点：`call` 之后紧跟 `add esp, N`。每次调用同一个函数，清理代码都在调用方出现一次，代码稍大但很灵活。

### stdcall：Windows API 的标准约定

stdcall 是 Win32 API 使用的调用约定：

- 参数同样**从右往左**压栈
- **被调用方（callee）负责清理参数**——函数末尾用 `ret N` 代替 `ret`
- 调用方不需要额外的 `add esp`，代码更紧凑

```asm
; 调用 MessageBoxA(..., "title", "text", 0) — stdcall
push 0                  ; MB_OK
push offset title
push offset text
push 0                  ; hWnd = NULL
call MessageBoxA
                        ; ← 没有 add esp！被调用方已经用 ret 16 清理了
```

MessageBoxA 函数内部，结尾不是普通的 `ret`，而是：

```asm
ret 16                  ; 弹出返回地址后，ESP 再加 16（4 个参数 × 4 字节）
```

`ret N` 做了三件事：弹出返回地址到 EIP、ESP + 4、然后再 ESP += N。一步完成返回和清理。

### cdecl vs stdcall 对比

<!-- 🎨 画图：cdecl 和 stdcall 的栈清理流程对比 -->

```asm
; ===== cdecl：调用方清理 =====
; 调用方代码
push    5
push    3
call    foo_cdecl
add     esp, 8              ; ← 调用方加这句

; foo_cdecl 函数末尾
ret                         ; ← 普通 ret，不管清理

; ===== stdcall：被调用方清理 =====
; 调用方代码
push    5
push    3
call    foo_stdcall
                            ; ← 没有 add esp，干干净净

; foo_stdcall 函数末尾
ret     8                   ; ← ret N，被调用方自己清理
```

### 逆向时如何判断调用约定

看到函数调用后，看两处就能判断：

| 观察位置  | cdecl           | stdcall    |
| --------- | --------------- | ---------- |
| call 之后 | 有 `add esp, N` | 什么都没有 |
| 函数末尾  | 普通 `ret`      | `ret N`    |

<!-- 📸 截图：x64dbg 中分别展示 cdecl 和 stdcall 的典型代码片段 -->

实战中，**Windows API 函数全是 stdcall**（MessageBox、CreateFile、ReadFile、WriteFile……），而你自己写的 C/C++ 函数默认是 cdecl。如果你在 x64dbg 里看到 `ret N`（N > 0），那几乎一定是 API 函数。

注意：64 位程序用统一的 x64 调用约定（前几个参数走寄存器 RCX、RDX、R8、R9），不再区分 cdecl 和 stdcall。这些约定只在 32 位程序中出现。

## leave 指令

前面在函数尾声看到过 `mov esp, ebp` + `pop ebp` 这两条指令。编译器经常把它们合并成一条：

```asm
leave
```

`leave` 等价于：

```asm
mov esp, ebp            ; ESP 指回栈帧底部（释放所有局部变量）
pop ebp                 ; 恢复调用者的 EBP
```

一条指令做了两件事。原理是：EBP 指向栈帧底部（旧 EBP 的位置），`mov esp, ebp` 把 ESP 拉回来，等于一次性释放了所有局部变量空间。然后 `pop ebp` 从栈上恢复旧 EBP。

所以在逆向中，函数尾声你可能看到两种写法：

```asm
; 写法一：分开写（Debug 模式常见）
mov esp, ebp
pop  ebp
ret

; 写法二：用 leave（Release 模式常见）
leave
ret
```

**它们完全等价**，只是编译器的优化选择。你两个都要认识。

<!-- 📸 截图：x64dbg 中 leave 指令执行前后 ESP/EBP 的变化 -->

## 全局变量 vs 局部变量

到目前为止，我们看到的局部变量都通过 `[ebp-X]` 访问——它们住在栈上，函数返回后就没了。但程序还有一种变量：**全局变量**，它们住在固定的内存地址，整个程序运行期间一直存在。

### 局部变量

```asm
mov dword ptr [ebp-4], 5         ; 局部变量
```

- 地址形式：`[ebp-X]`（相对于栈帧的偏移）
- 位置：栈（Stack）
- 生命周期：函数执行期间。函数返回后，这块栈空间会被其他函数覆盖
- 每次调用函数，局部变量的地址可能不同

### 全局变量

```asm
mov dword ptr ds:[0x0040A000], 5  ; 全局变量
```

- 地址形式：`ds:[固定地址]`（绝对地址，写死在程序里）
- 位置：`.data` 段（有初始值）或 `.bss` 段（未初始化，默认 0）
- 生命周期：整个程序运行期间
- 每次访问都是同一个地址

### 对比表

|          | 局部变量                   | 全局变量                           |
| -------- | -------------------------- | ---------------------------------- |
| 汇编形式 | `[ebp-X]`                  | `ds:[固定地址]`                    |
| 存储位置 | 栈                         | `.data` / `.bss` 段                |
| 生命周期 | 函数执行期间               | 整个程序                           |
| 地址特征 | 相对地址，每次可能不同     | 绝对地址，永远不变                 |
| 示例     | `mov dword ptr [ebp-4], 5` | `mov dword ptr ds:[0x0040A000], 5` |

<!-- 🎨 画图：内存布局图，展示栈（局部变量）和 .data/.bss 段（全局变量）的位置关系 -->

### 快速识别规则

逆向时看到内存访问，一眼判断：

- **`[ebp-X]`** → 局部变量（栈上）
- **`[ebp+X]`**（X > 4）→ 参数（栈上，调用者压入的）
- **`ds:[0x00XXXXXX]`** → 全局变量（固定地址段）
- **`ds:[0x00XXXXXX]`** 地址在 `0x00400000` 附近 → 程序自身的全局变量
- **`ds:[0x00XXXXXX]`** 地址很大如 `0x7XXXXXXX` → 系统DLL 里的变量或 API 地址

举个例子：

```asm
; C 代码
int g_count = 0;            ; 全局变量

void foo(int x) {           ; x 是参数
    int sum = x + g_count;  ; sum 是局部变量
    g_count = sum;          ; 写回全局变量
}

; 编译后的汇编
push ebp
mov  ebp, esp
sub  esp, 4                          ; 分配 sum
mov  eax, dword ptr [ebp+8]         ; eax = x（参数）
add  eax, dword ptr ds:[0x0040A000]  ; eax += g_count（全局变量）
mov  dword ptr [ebp-4], eax          ; sum = eax（局部变量）
mov  eax, dword ptr [ebp-4]          ; eax = sum
mov  dword ptr ds:[0x0040A000], eax  ; g_count = eax（写回全局变量）
mov  esp, ebp
pop  ebp
ret
```

同一个函数里，局部变量用 `[ebp-X]` 访问，全局变量用 `ds:[固定地址]` 访问——两种风格共存，非常好认。

## 回到 x64dbg 实操

打开 x64dbg，加载上一章的 CrackMe 程序。这次我们追踪一个完整的函数调用：

### 任务一：追踪一个完整的函数调用

1. 搜索字符串找到 `push <..."reverse2026"...>`
2. 在上面几行找到 `call` 指令（调用 `strcmp`）
3. 在 `call` 那行按 **F2** 设断点
4. 按 **F9** 运行，程序会在断点停下
5. 按 **F7** 步入 call，进入函数内部
6. 观察寄存器窗口：ESP 变了（返回地址压栈），EIP 跳到了函数入口
7. 继续按 F7，观察 `push ebp` → `mov ebp, esp` → 函数体 → `pop ebp` → `ret`
8. ret 之后 EIP 回到 call 的下一条指令

<!-- 📸 截图：F7 步入 call 后的寄存器和栈状态 -->

每一步都看清楚 ESP、EBP、EAX 的变化。这就是函数调用的完整流程。

### 任务二：找到 stdcall 的 Windows API 调用

Windows 程序启动时会调用大量 API。我们来找一个 stdcall 调用，观察 `ret N`：

1. 在 x64dbg 的**符号（Symbols）** 标签页，找到程序导入的 DLL 列表
2. 双击某个 DLL（比如 `user32.dll`），找到 `MessageBoxA` 或 `EnableWindow` 之类的函数
3. 双击函数名跳到它的代码
4. 按 **Ctrl+G** 输入函数名，在调用处设断点
5. 运行到断点后，F7 步入
6. 滚动到函数末尾，找到 `ret N` 指令（N 可能是 4、8、16 等）
7. 对比：你自己的函数末尾是普通 `ret`（cdecl），API 函数末尾是 `ret N`（stdcall）

<!-- 📸 截图：在 x64dbg 中找到 API 函数的 ret N 指令 -->

试着找 2-3 个不同的 API 函数，看看它们的 `ret N` 中 N 分别是多少，算算它们各有几个参数（N ÷ 4 = 参数个数）。

### 任务三：区分局部变量和全局变量

1. 在任意函数内部单步执行（F8）
2. 观察反汇编窗口中的内存访问指令
3. 看到 `[ebp-X]` 形式的 → 这是局部变量
4. 看到 `ds:[0x00XXXXXX]` 形式的 → 这是全局变量
5. 试着在**内存窗口**中跳到全局变量的地址（Ctrl+G 输入地址），看看里面存着什么值

<!-- 📸 截图：反汇编中同时出现局部变量和全局变量的代码片段 -->

## 练习

### 第一题

依次执行以下指令后，ESP 变了多少？

```
push eax
push ebx
push ecx
pop edx
pop edx
```

<details>
<summary>答案</summary>

ESP 净变化 = -4（减了 4）。

三次 push：ESP - 12。两次 pop：ESP + 8。总共 -12 + 8 = -4。

</details>

### 第二题

函数 `foo` 的栈帧中，`[ebp+8]` 是第一个参数，`[ebp+0Ch]` 是第二个参数。第三个参数在哪个位置？

<details>
<summary>答案</summary>

`[ebp+10h]`。每个参数 4 字节，第一个 +8，第二个 +8+4=+0xC，第三个 +8+4+4=+0x10。

</details>

### 第三题

为什么 `call` 要把返回地址压栈？如果不压会怎样？

<details>
<summary>答案</summary>

因为函数执行完后必须知道"回到哪里继续执行"。如果不压返回地址，`ret` 就不知道该跳回哪里，程序会崩溃。

`call` 相当于 `push (下一条指令地址)` + `jmp 目标`。`ret` 相当于 `pop eip`。两者配合，形成完整的调用-返回机制。

</details>

### 第四题

以下汇编中，`[ebp-4]` 和 `[ebp+8]` 分别是什么？

```asm
push ebp
mov  ebp, esp
sub  esp, 8
mov  dword ptr [ebp-4], 0
mov  eax, dword ptr [ebp+8]
add  eax, dword ptr [ebp-4]
mov  dword ptr [ebp-8], eax
mov  eax, dword ptr [ebp-8]
mov  esp, ebp
pop  ebp
ret
```

<details>
<summary>答案</summary>

- `[ebp-4]` — 第一个局部变量（初始化为 0）
- `[ebp-8]` — 第二个局部变量（存 `eax + [ebp-4]` 的结果）
- `[ebp+8]` — 函数的第一个参数

对应 C 大致是：

```c
int foo(int a) {
    int temp = 0;
    int result = a + temp;
    return result;
}
```

</details>

### 第五题

在反汇编中，如何区分一个函数用的是 cdecl 还是 stdcall 调用约定？

<details>
<summary>答案</summary>

看两处：

1. **call 之后**：如果有 `add esp, N` → cdecl（调用方清理）；如果没有 → 可能是 stdcall
2. **函数末尾**：如果是普通 `ret` → cdecl；如果是 `ret N`（N > 0）→ stdcall（被调用方清理）

只要看到 `ret N`，就是 stdcall。只要看到 `add esp, N`，就是 cdecl。

</details>

### 第六题

`leave` 指令做了什么？写出与它等价的两条指令。

<details>
<summary>答案</summary>

`leave` 做了两件事：

1. `mov esp, ebp` — 把 ESP 恢复到栈帧底部，一次性释放所有局部变量空间
2. `pop ebp` — 恢复调用者的 EBP

等价于：

```asm
mov esp, ebp
pop ebp
```

它用在函数尾声（Epilogue），和 `ret` 配合：`leave` → `ret`。

</details>

### 第七题

以下两个内存访问，哪个是局部变量，哪个是全局变量？

```
mov eax, dword ptr [0x0040B000]
mov ecx, dword ptr [ebp-0Ch]
```

<details>
<summary>答案</summary>

- `[0x0040B000]` — **全局变量**。绝对地址，固定不变，位于程序的 `.data` 或 `.bss` 段
- `[ebp-0Ch]` — **局部变量**。相对于 EBP 的偏移，位于栈上，函数返回后失效

识别规则：`[ebp-X]` → 局部；`ds:[固定地址]` 或 `[固定地址]` → 全局。

</details>

### 第八题

x64dbg 实操题。加载一个程序，完成以下步骤并记录观察结果：

1. 找到任意一个 `call` 指令，F2 设断点
2. F9 运行到断点，记录当前 ESP 和 EIP 的值
3. F7 步入 call，再次记录 ESP 和 EIP——ESP 变了多少？为什么？栈顶现在存着什么？
4. 继续按 F7，找到函数序言（`push ebp` + `mov ebp, esp`），观察 EBP 的变化
5. 找到函数尾声（`pop ebp` + `ret` 或 `leave` + `ret`），观察 ESP、EBP 恢复的过程
6. ret 之后，EIP 跳到了哪里？和栈顶之前存的值有关系吗？

<details>
<summary>答案</summary>

参考答案（具体数值因程序而异）：

1. 找到 call，比如 `call 0x00401200`，在 0x00401050 处。F2 设断点
2. F9 停下，假设 ESP = `0x0019F700`，EIP = `0x00401050`
3. F7 步入后：ESP = `0x0019F6FC`（减了 4，因为返回地址压栈），EIP = `0x00401200`（跳到函数入口）。栈顶 `0x0019F6FC` 存着 `0x00401055`（call 下一条指令的地址）
4. `push ebp`：ESP 再减 4，EBP 的旧值存入栈。`mov ebp, esp`：EBP 现在等于当前 ESP
5. `pop ebp` / `leave`：EBP 恢复为调用者的值，ESP 回到返回地址处。`ret`：弹出返回地址到 EIP
6. ret 之后 EIP = `0x00401055`——就是步骤 3 中栈顶存的那个返回地址。完全吻合

</details>
