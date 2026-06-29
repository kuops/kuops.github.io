---
title: switch 与跳转表
draft: false
description: switch 在 Debug 汇编里有两种形态：少 case 用 cmp+je 链，连续 case 自动生成跳转表。两种都要认得。
order: 14
---

上一章学了 if/else 分支的汇编形态。这一章学 `switch`，即多路分支。

switch 和 if/else if 在 C 语言层面做的事情很像：根据一个变量的不同值，走不同的分支。但编译器对 switch 有专门的优化手段：**跳转表**（jump table）。逆向时认出跳转表，就能快速还原出完整的 switch 结构。

和前几章一样，编译 Debug x86，用 x64dbg 断到函数对照。

## 小型 switch：cmp + je 链

case 少的时候，编译器把 switch 当 if/else if 处理：

```c
int classify(int x) {
    int result = 0;
    switch (x) {
        case 1:
            result = 10;
            break;
        case 2:
            result = 20;
            break;
        default:
            result = -1;
            break;
    }
    return result;
}
```

过滤掉 Debug 噪音，核心汇编如下：

```asm
mov  dword ptr [ebp-4], 0           ; result = 0
mov  eax, dword ptr [ebp+8]         ; eax = x
mov  dword ptr [ebp-0xD0], eax      ; 复制到临时变量（Debug 特性）
cmp  dword ptr [ebp-0xD0], 1        ; x == 1?
je   case_1
cmp  dword ptr [ebp-0xD0], 2        ; x == 2?
je   case_2
jmp  default_case                   ; 都不匹配 -> default
case_1:
mov  dword ptr [ebp-4], 0xA         ; result = 10
jmp  end
case_2:
mov  dword ptr [ebp-4], 0x14        ; result = 20
jmp  end
default_case:
mov  dword ptr [ebp-4], 0xFFFFFFFF  ; result = -1
end:
mov  eax, dword ptr [ebp-4]
```

每个 case 对应一次 `cmp` + `je`，线性排列。和 if/else if 几乎一模一样，无法区分。唯一的线索是：所有比较都针对**同一个变量的不同常量值**，这是 switch 的语义特征。

> [!NOTE] Debug 模式的临时变量
> 你可能注意到编译器把 `x` 先复制到 `[ebp-0xD0]` 再反复比较，而不是直接 `cmp [ebp+8], 1`。这是 Debug 模式（`/Od`）的特性：它把 `switch(x)` 的 `x` 计算一次存到临时变量，之后所有 case 比较都用这个临时变量。Release 模式不会这样。

## 中型 switch：跳转表

case 数量多且值连续时，编译器生成**跳转表**：一个地址数组，一次查表就跳到对应 case：

```c
int day_name_small(int n) {
    switch (n) {
        case 1: return 10;
        case 2: return 20;
        case 3: return 30;
        case 4: return 40;
        case 5: return 50;
        default: return -1;
    }
}
```

核心汇编：

```asm
; ── 第一步：取 n 的值，复制到临时变量 ──
mov  eax, dword ptr [ebp+8]         ; eax = n（参数）
mov  dword ptr [ebp-0xC4], eax      ; 存到临时变量（Debug 特性）

; ── 第二步：把 case 值转成 0 起始的索引 ──
mov  ecx, dword ptr [ebp-0xC4]
sub  ecx, 1                         ; ecx = n - 1
                                    ;   n=1 → 索引 0
                                    ;   n=2 → 索引 1
                                    ;   n=3 → 索引 2
                                    ;   n=4 → 索引 3
                                    ;   n=5 → 索引 4
mov  dword ptr [ebp-0xC4], ecx

; ── 第三步：范围检查 ──
cmp  dword ptr [ebp-0xC4], 4        ; 索引 > 4？（即 n < 1 或 n > 5）
ja   default_case                   ; 超出范围 → default

; ── 第四步：查表跳转 ──
mov  edx, dword ptr [ebp-0xC4]      ; edx = 索引
jmp  dword ptr [edx*4+0x00AB43D0]   ; 跳转到 表基址 + 索引×4 处存的地址

; ── 各 case 的代码块 ──
case_1:                             ; n == 1
mov  eax, 0xA                       ; return 10
jmp  end
case_2:                             ; n == 2
mov  eax, 0x14                      ; return 20
jmp  end
case_3:                             ; n == 3
mov  eax, 0x1E                      ; return 30
jmp  end
case_4:                             ; n == 4
mov  eax, 0x28                      ; return 40
jmp  end
case_5:                             ; n == 5
mov  eax, 0x32                      ; return 50
jmp  end
default_case:                       ; n 不在 1~5 之间
or   eax, 0xFFFFFFFF                ; return -1
end:
```

关键在第二步和第四步。`sub ecx, 1` 把 case 值转成 0 起始的索引：case 1 变成索引 0，case 5 变成索引 4。然后 `jmp dword ptr [edx*4+0x00AB43D0]` 拿这个索引去查表，`edx*4` 是因为每个表项占 4 字节（32 位地址），`0x00AB43D0` 是表基址。

跳转表在内存中长这样（基址 `0x00AB43D0`）：

```
地址              内存字节 (小端序)      指向的地址
0x00AB43D0       94 43 AB 00           0x00AB4394 (case_1)    索引 0 (n=1)
0x00AB43D4       9B 43 AB 00           0x00AB439B (case_2)    索引 1 (n=2)
0x00AB43D8       A2 43 AB 00           0x00AB43A2 (case_3)    索引 2 (n=3)
0x00AB43DC       A9 43 AB 00           0x00AB43A9 (case_4)    索引 3 (n=4)
0x00AB43E0       B0 43 AB 00           0x00AB43B0 (case_5)    索引 4 (n=5)
```

> [!NOTE] 小端序怎么看跳转表
> 内存里存的是 `94 43 AB 00`，但实际地址要**倒着读**：`0x00AB4394`。这就是第 9 章讲过的小端序——低字节在低地址。x64dbg 的内存窗口默认按字节显示，你看到 `94 43 AB 00` 要在脑子里翻转成 `00AB4394`。如果觉得麻烦，x64dbg 的数据窗口可以切换显示模式，按 DWORD 查看，就能直接看到 `00AB4394`。

假如 `n = 3`：`sub ecx, 1` 得到索引 2，范围检查通过，`jmp dword ptr [2*4+0x00AB43D0]` 即 `jmp dword ptr [0x00AB43D8]`，从表的第 3 项取出 `0x00AB43A2`（case_3 的地址），跳过去执行 `return 30`。

![连续 switch 跳转表流程](c-asm-4-images/switch-jump-table-flow.png)

> [!NOTE] `or eax, 0xFFFFFFFF` 为什么不是 `mov eax, 0xFFFFFFFF`
> 两条指令效果一样（`eax` 都变成 `-1`），但 `or eax, 0xFFFFFFFF` 只需 5 字节，`mov eax, 0xFFFFFFFF` 需要 3 字节。等等，`mov` 不是更短吗？没错，但 MSVC Debug（`/Od`）不优化指令长度，编译器在 `return -1` 时恰好生成了 `or`。逆向时看到 `or eax, 0xFFFFFFFF` 就知道在返回 `-1`。

编译器为什么用跳转表？5 个 case 用 `cmp+je` 链，最坏情况要比较 5 次。用跳转表，不管匹配哪个 case，都是一次减法 + 一次范围检查 + 一次查表跳转，O(1) 时间复杂度。

> [!NOTE] 为什么是 ja 而不是 jg
> 范围检查用 `ja`（无符号大于），不是 `jg`（有符号大于）。因为 `sub ecx, 1` 后如果 `n` 是 0 或负数，`ecx` 会变成很大的正数（如 `0 - 1 = 0xFFFFFFFF`），用无符号比较就能正确识别为"超出范围"，直接走 default。

> [!NOTE] x64 下的跳转表：相对偏移
> 本文以 32 位为例，跳转表里存的是 4 字节绝对地址。在 64 位程序中，为了支持 ASLR（地址空间随机化），编译器通常存**相对偏移量**（RIP-relative offset）而非绝对地址。x64 跳转表的标志性汇编变成了：
>
> ```asm
> movsxd rax, dword ptr [rax*4 + table]   ; 取出 4 字节相对偏移
> add    rax, table                        ; 加上表基址算出绝对地址
> jmp    rax                               ; 跳转
> ```
>
> 逆向 x64 程序时，看到 `movsxd` + `add` + `jmp` 的组合，就是位置无关的跳转表。

> [!NOTE] 双重跳转表（字节映射表）
> 当 case 有空洞但空洞不算特别大时（如 case 1~100，其中只有 20 个有效），编译器可能用**两级表**来省空间：
>
> ```asm
> movzx eax, byte ptr [eax + byte_table]   ; 第一级：查字节表，得到 0~N 的紧凑索引
> jmp   dword ptr [eax*4 + addr_table]     ; 第二级：查地址表跳转
> ```
>
> 一级表（字节数组）每个条目只有 1 字节，把稀疏的 case 值映射成连续的紧凑索引；二级表（地址数组）只存实际 case 的跳转地址。逆向时看到 `movzx ..., byte ptr [...]` 紧接着 `jmp [...*4+...]`，就是双重跳转表。

## 不连续的 switch

case 值不连续时（如 1, 2, 4, 5，缺了 3），编译器仍然用跳转表，但空洞位置填 default 的地址：

```c
int sparse(int x) {
    switch (x) {
        case 1: return 100;
        case 2: return 200;
        case 4: return 400;
        case 5: return 500;
        default: return -1;
    }
}
```

核心汇编：

```asm
mov  eax, dword ptr [ebp+8]         ; eax = x
mov  dword ptr [ebp-0xC4], eax
mov  ecx, dword ptr [ebp-0xC4]
sub  ecx, 1                         ; x - 1（索引）
mov  dword ptr [ebp-0xC4], ecx
cmp  dword ptr [ebp-0xC4], 4        ; 索引 > 4?
ja   default_case                   ; 超出范围 -> default
mov  edx, dword ptr [ebp-0xC4]
jmp  dword ptr [edx*4+0x004B4F68]   ; 跳转表
case_1:
mov  eax, 0x64                      ; return 100
jmp  end
case_2:
mov  eax, 0xC8                      ; return 200
jmp  end
case_4:
mov  eax, 0x190                     ; return 400
jmp  end
case_5:
mov  eax, 0x1F4                     ; return 500
jmp  end
default_case:
or   eax, 0xFFFFFFFF                ; return -1
end:
```

和连续 case 的代码**完全一样的结构**：`sub ecx, 1` → `cmp ..., 4` → `ja default` → `jmp [edx*4+表]`。区别只在跳转表内部：索引 2（对应 case 3）的表项填的是 `default_case` 的地址。

![不连续 switch 跳转流程](c-asm-4-images/sparse-switch-flow.png)

逆向时如果看到一张跳转表里有多个条目指向同一个地址，那个地址大概率就是 default 分支。

## break 和 fall-through

switch 和 if/else 有一个关键区别：**case 穿透**（fall-through）。C 的 switch 如果 case 末尾不写 `break`，会"漏"到下一个 case 继续执行。

### 有 break：每个 case 末尾都有 jmp end

```c
switch (x) {
    case 1: result = 10; break;
    case 2: result = 20; break;
}
```

```asm
case_1:
mov  dword ptr [ebp-4], 0xA
jmp  end                          ; break -> 跳到 switch 结尾
case_2:
mov  dword ptr [ebp-4], 0x14
jmp  end                          ; break -> 跳到 switch 结尾
end:
```

每个 case 末尾的 `jmp end` 就是 `break`。逆向时看到 case 代码块末尾有 `jmp` 跳到同一个汇合点，说明每个 case 都有 `break`。

### 无 break（故意 fall-through）

```c
switch (x) {
    case 1: result = 10;    // 注意：没有 break
    case 2: result = 20; break;
}
```

```asm
case_1:
mov  dword ptr [ebp-4], 0xA
                                  ; 没有 jmp end！直接掉到 case_2
case_2:
mov  dword ptr [ebp-4], 0x14
jmp  end
end:
```

`case_1` 没有 `jmp end`，直接"掉"到 `case_2` 的代码，执行完 `result = 10` 后继续执行 `result = 20`。这就是 fall-through。

**逆向时判断有没有 break，就看 case 代码块末尾有没有 `jmp`。** 有 `jmp` 是 break，没有就是 fall-through。

### 多个 case 共享代码（case 合并）

C 里常见的写法，多个 case 值走同一逻辑：

```c
switch (x) {
    case 1:
    case 2:
    case 3: result = 100; break;    // case 1、2、3 都执行这行
    case 4: result = 200; break;
}
```

跳转表里索引 0、1、2（对应 case 1、2、3）全部指向同一个代码块地址：

```
索引 0（x=1）: -> 共享代码块 (result = 100)
索引 1（x=2）: -> 共享代码块 (result = 100)
索引 2（x=3）: -> 共享代码块 (result = 100)
索引 3（x=4）: -> case_4      (result = 200)
```

逆向时看到跳转表里多个**连续的**表项指向同一地址，通常就是 case 合并，而不是 fall-through（fall-through 的表项指向不同地址，只是代码块之间没有 `jmp` 隔开）。

## 极度稀疏的 switch：退化成 cmp 链

case 值跨度太大时（如 10, 20, 30, 40, 50，间隔 10），编译器会放弃跳转表，退回比较 + 跳转。因为跳转表要覆盖 10 到 50 的所有值（41 个条目），但只有 5 个有效，太浪费空间。

```c
const char* color_name(int code) {
    switch (code) {
        case 10: return "Red";
        case 20: return "Green";
        case 30: return "Blue";
        case 40: return "Yellow";
        case 50: return "Purple";
        default: return "Invalid";
    }
}
```

这种情况编译生成的代码和"小型 switch"一样，每个 case 一条 `cmp` + `je`，线性排列：

```asm
cmp  dword ptr [ebp-0xD0], 0xA      ; code == 10?
je   case_red
cmp  dword ptr [ebp-0xD0], 0x14     ; code == 20?
je   case_green
cmp  dword ptr [ebp-0xD0], 0x1E     ; code == 30?
je   case_blue
jmp  default_invalid
case_red:
mov  eax, offset "Red"
jmp  end
...
```

逆向时无法仅从汇编区分它是 if/else if 还是不连续的 switch，要看上下文语义。

> [!NOTE] case 很多时编译器会用二分查找
> 上面只有 5 个不连续的 case，编译器用线性 `cmp+je` 链。但如果 case 数量很多且极其稀疏（如 20 个不连续的值），线性比较要查 20 次，编译器会改用**二叉决策树**（binary decision tree）进行对半查找。汇编形态类似二分查找：先 `cmp eax, 中间值`，`jl` 走左半边、`jg` 走右半边，递归缩小范围。逆向时如果看到一棵 `cmp` + `jl`/`jg` 嵌套的树形结构，就是编译器对大量稀疏 case 的二分优化。

## 怎么读跳转表

看到 `jmp dword ptr [edx*4+XXX]` 后，逆向还原 switch 的步骤：

**第一步：确定 case 范围。** 往前找 `sub` 和 `cmp`：

```asm
sub  ecx, 1          ; 基准值 = 1
cmp  ..., 4          ; 最大索引 = 4
```

→ case 值从 1 到 5（基准值 + 0 到 基准值 + 最大索引）。

**第二步：读跳转表。** 跳到表基址 `XXX`，按 DWORD 读 `最大索引 + 1` 个条目。每个条目是一个代码地址。

**第三步：对照代码块。** 每个地址指向一个 case 的代码块，读那条赋值/操作就能还原出 case 内容。

**第四步：标 default。** 范围检查的 `ja` 目标是 default。跳转表里指向同一地址的多个条目，那个地址也是 default。

## 逆向识别清单

| 特征     | if/else if         | switch（cmp 链）   | switch（跳转表）      |
| -------- | ------------------ | ------------------ | --------------------- |
| 比较模式 | 不同变量/不同值    | 同一变量反复比较   | 减偏移 + 范围检查     |
| 跳转方式 | jcc 各自跳不同地址 | je 各自跳不同地址  | jmp [table + index*4] |
| default  | 最后的 else        | 最后的 jmp default | ja default（范围外）  |
| 表地址   | 无                 | 无                 | 有，在 .rdata 段      |

**最可靠的特征是 `jmp dword ptr [reg*4+XXX]`**：有这条指令一定是跳转表 switch。没有它则需要靠"同一变量反复比较不同常量"来猜是 switch 还是 if/else if。

## 练习

1. 下面这段汇编对应的 switch 有几个 case？case 值分别是什么？

   ```asm
   mov  eax, dword ptr [ebp+8]
   sub  eax, 5
   cmp  eax, 3
   ja   default_lbl
   jmp  dword ptr [eax*4+0x00403000]
   ```

   > [!NOTE]- 参考答案
   >
   > 4 个 case，值是 5、6、7、8。`sub eax, 5` 把参数减 5 得到索引，`cmp eax, 3` 检查索引是否 <= 3。跳转表在 `0x00403000`，有 4 个条目。

2. 下面这段汇编，判断它是 if/else 还是 switch？还原出 C 代码。

   ```asm
   cmp  dword ptr [ebp+8], 0x2A
   je   loc_A
   cmp  dword ptr [ebp+8], 0x63
   je   loc_B
   cmp  dword ptr [ebp+8], 0x89
   je   loc_C
   jmp  default
   loc_A:
   mov  eax, 1
   ret
   loc_B:
   mov  eax, 2
   ret
   loc_C:
   mov  eax, 3
   ret
   default:
   xor  eax, eax
   ret
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > int func(int x) {
   >     switch (x) {
   >         case 42:  return 1;
   >         case 99:  return 2;
   >         case 137: return 3;
   >         default:  return 0;
   >     }
   > }
   > ```
   >
   > 三个比较都针对**同一个变量** `[ebp+8]` 的不同常量值（`0x2A`=42, `0x63`=99, `0x89`=137），这是 switch 的 cmp 链模式。case 值跨度太大（42~137），编译器放弃跳转表，退回 cmp+je。和 if/else if 的区别只在于语义：所有分支都比较同一个变量。

3. 你在 x64dbg 里看到下面这段代码。跳转表在地址 `0x00402000`，你读了表里的 6 个 DWORD，分别是：`0x00401020`、`0x00401050`、`0x00401080`、`0x00401080`、`0x00401020`、`0x004010B0`。还原出 switch 结构。

   ```asm
   mov  eax, dword ptr [ebp+8]
   sub  eax, 10
   cmp  eax, 5
   ja   default_case
   jmp  dword ptr [eax*4+0x00402000]
   ```

   > [!NOTE]- 参考答案
   >
   > `sub eax, 10` + `cmp eax, 5` → case 值 10 到 15（6 个值）。对照跳转表：
   >
   > - case 10（索引 0）→ `0x00401020`
   > - case 11（索引 1）→ `0x00401050`
   > - case 12（索引 2）→ `0x00401080`
   > - case 13（索引 3）→ `0x00401080`（和 case 12 相同）
   > - case 14（索引 4）→ `0x00401020`（和 case 10 相同）
   > - case 15（索引 5）→ `0x004010B0`
   >
   > case 12 和 13 指向同一地址，case 10 和 14 也指向同一地址，说明这些 case 是**合并**的（共享代码块，而非 fall-through）。还原代码：
   >
   > ```c
   > // 0x00401020 是 case 10/14 的代码块
   > // 0x00401050 是 case 11 的代码块
   > // 0x00401080 是 case 12/13 的代码块
   > // 0x004010B0 是 case 15 的代码块
   > switch (x) {
   >     case 10:
   >     case 14: /* 代码块 A */ break;
   >     case 11: /* 代码块 B */ break;
   >     case 12:
   >     case 13: /* 代码块 C */ break;
   >     case 15: /* 代码块 D */ break;
   >     default:  /* default */ break;
   > }
   > ```
   >
   > 要知道每个 case 具体做什么，需要分别跟到对应的代码地址读汇编。
