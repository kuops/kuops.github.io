---
title: 环境搭建 + 破解第一个程序
description: 搭建逆向工作环境，5 分钟破解第一个 CrackMe，直接体验逆向的快感。
order: 1
draft: true
---

# 环境搭建 + 破解第一个程序

## 动手目标

今天结束时，你会：

1. 拥有一套完整的逆向工作环境
2. **亲手破解一个程序**，弹出"注册成功"

不需要任何基础，照着做就行。

## 步骤一：搭建虚拟机

逆向要在 Windows 环境下进行。为了不搞乱你的主系统，我们用虚拟机。

### 下载安装 VirtualBox

1. 打开 https://www.virtualbox.org/wiki/Downloads
2. 下载对应你系统的版本（Windows/macOS/Linux），安装
3. 打开 VirtualBox，点"新建"

### 创建 Windows 虚拟机

1. 名称随便填，比如 `ReverseBox`
2. 类型选 `Microsoft Windows`，版本选 `Windows 10 (64-bit)`
3. 内存分配 **4096 MB**（4G）
4. 虚拟硬盘选"现在创建虚拟硬盘"，大小 \*\*60 GB`
5. 创建完成后，点"设置" → "系统" → "处理器"，CPU 核心数给 2

### 安装 Windows

你需要一个 Windows 10/11 的 ISO 镜像。微软官网可以免费下载：

https://www.microsoft.com/zh-cn/software-download/windows10ISO

加载 ISO → 启动虚拟机 → 按提示安装 Windows。装完之后进系统，确认能正常使用。

> 如果你已经有 Windows 系统（实体机或已有虚拟机），跳过这步，直接在 Windows 上操作。

## 步骤二：安装逆向工具

以下工具全部安装到你的 Windows 环境中。

### Visual Studio Community（写代码用）

1. 打开 https://visualstudio.microsoft.com/zh-hans/vs/community/
2. 下载安装器，运行
3. 勾选"使用 C++ 的桌面开发"
4. 安装（大概 5-8 GB，等一会）
5. 装完打开，确认能新建 C++ 控制台项目

### x64dbg（动态调试器，核心工具）

1. 打开 https://x64dbg.com/
2. 下载最新版（snapshot 版本即可）
3. 解压到一个**不含中文和空格**的路径，比如 `C:\ReverseTools\x64dbg`
4. 进入 `release` 目录，你会看到 `x32dbg.exe` 和 `x64dbg.exe`
   - `x32dbg.exe` 用于调试 32 位程序
   - `x64dbg.exe` 用于调试 64 位程序
5. 双击 `x32dbg.exe` 打开，确认能正常启动

### CheatEngine（内存搜索修改工具）

1. 打开 https://cheatengine.org/downloads.php
2. 下载安装版，安装时注意：**取消勾选附带软件**（它会捆绑一些没用的东西）
3. 安装完成，打开确认能运行

### IDA Free（静态分析工具）

1. 打开 https://hex-rays.com/ida-free/
2. 下载 IDA Free
3. 安装，打开确认能运行

### 010 Editor（十六进制编辑器）

1. 打开 https://www.sweetscape.com/010editor/
2. 下载安装（有免费试用版）
3. 打开确认能运行

### 验证工具安装

装完之后，你的工具文件夹应该有：

```
C:\ReverseTools\
  x64dbg\          ← 动态调试
  CheatEngine\     ← 内存修改
  IDA Free\        ← 静态分析
  010 Editor\      ← 十六进制编辑
```

## 步骤三：写一个密码验证程序

现在我们要写一个最简单的密码验证程序，然后用 x64dbg 破解它。

打开 Visual Studio，新建一个 C++ 控制台项目：

```cpp
#include <stdio.h>
#include <string.h>

int main() {
    char password[32];

    printf("请输入密码: ");
    scanf("%s", password);

    if (strcmp(password, "reverse2026") == 0) {
        printf("注册成功！\n");
    } else {
        printf("密码错误！\n");
    }

    return 0;
}
```

按 `Ctrl+F5` 运行（不要调试运行），输入 `reverse2026` 确认能弹出"注册成功"。

然后随便输个错误的密码，确认弹出"密码错误"。

**关键：把编译出来的 exe 文件找到。** 通常在项目目录的 `Debug` 或 `Release` 文件夹里。把它复制到一个方便的位置，比如 `C:\CrackMe\test.exe`。

> 编译时确认是 **Debug x86（32位）** 配置，因为我们用 x32dbg 来调试。在工具栏把平台从 x64 切换到 x86。

## 步骤四：用 x64dbg 破解它

这是今天的重头戏。

### 打开程序

1. 启动 `x32dbg.exe`
2. 菜单栏：`文件` → `打开` → 选择你刚才的 `test.exe`
3. 程序加载后，你会看到一片汇编代码，不用慌

### 找到密码比较的地方

1. 右键汇编代码区域 → `查找` → `当前模块` → `字符串引用`
2. 在弹出的窗口中，找到 `"密码错误！"` 这一行
3. 双击它，主窗口会跳到引用这个字符串的汇编代码处

你现在应该能看到类似这样的汇编：

```asm
call    <strcmp>                ; 调用字符串比较函数
add     esp, 8                  ; 清理参数
test    eax, eax                ; 检查返回值
jne     地址A                   ; 不等于0就跳转（密码错误）
push    offset "注册成功！"     ; 走到这里说明密码正确
call    <printf>
jmp     地址B                   ; 跳过错误分支
地址A:
push    offset "密码错误！"     ; 错误分支
call    <printf>
地址B:
```

### 理解你看到的东西

不需要完全看懂，只需要理解这几行：

```asm
test    eax, eax       ; 比较 strcmp 的返回值
jne     地址A          ; 如果不相等就跳到"密码错误"
```

`jne` 的意思是 **Jump if Not Equal（不相等则跳转）**。

- 密码正确 → strcmp 返回 0 → `jne` 不跳 → 执行"注册成功"
- 密码错误 → strcmp 返回非 0 → `jne` 跳转 → 执行"密码错误"

### 破解：改一个字节

1. 找到 `jne 地址A` 这一行
2. 双击这一行，弹出一个汇编编辑框
3. 把 `jne` 改成 `je`（Jump if Equal，相等则跳转）
4. 点确定

改完之后：

```asm
test    eax, eax       ; 比较返回值
je      地址A          ; 相等则跳转（反过来啦！）
```

现在逻辑反了：

- 密码正确 → strcmp 返回 0 → `je` 跳转 → 执行"密码错误"
- 密码错误 → strcmp 返回非 0 → `je` 不跳 → 执行"注册成功"

### 运行看看效果

1. 按 `F9`（运行）
2. 程序弹出一个控制台窗口，让你输入密码
3. **随便输一个错误的密码**，比如 `123`
4. 回车

看到了吗？**注册成功！**

你输入了错误密码，程序却告诉你注册成功。因为你把判断逻辑反过来了。

## 你刚才做了什么

回顾一下你做了什么：

1. 用 C 写了一个密码验证程序
2. 用 x64dbg 打开它，找到了密码比较的汇编代码
3. 把 `jne`（不相等则跳转）改成了 `je`（相等则跳转）
4. 逻辑反转，错误密码也能通过验证

你用到的汇编指令只有两个：

| 指令  | 含义              | 什么时候跳   |
| ----- | ----------------- | ------------ |
| `jne` | Jump if Not Equal | 不相等时跳转 |
| `je`  | Jump if Equal     | 相等时跳转   |

这就是"爆破" — 不去算正确的密码是什么，而是直接修改程序的判断逻辑，让它永远走"成功"的分支。

## 另一种爆破方式：NOP 掉跳转

还有另一种更常见的爆破方式：把 `jne` 整条指令删掉。

1. 重新用 x64dbg 打开 `test.exe`
2. 同样找到 `jne` 那一行
3. 双击编辑，把 `jne 地址A` 改成 `nop`
4. 确定后你会看到原来的 `jne` 变成了 `nop`

`nop` 的意思是 **No Operation（什么都不做）**。CPU 遇到 `nop` 就直接跳到下一行，不做任何跳转。

效果：不管密码对不对，都不会跳到"密码错误"的分支，直接执行"注册成功"。

按 `F9` 运行，随便输密码试试。

## 保存破解后的程序

破解完了，关掉 x64dbg 就没了。要保存成独立的 exe 文件：

1. 在 x64dbg 中完成修改后（改完 `jne` 为 `je` 或 `nop`）
2. 右键汇编区域 → `补丁` → `补丁文件`（或者在菜单栏找 Patches 窗口）
3. 在补丁窗口中确认你的修改
4. 点击"导出补丁"或"保存文件"
5. 保存为 `test_cracked.exe`

双击运行 `test_cracked.exe`，随便输密码，确认"注册成功"。

## 练习

### 练习 1：自己写一个新程序并爆破它

修改原来的 C 代码，把密码改成你自己想的一个密码，编译后用 x64dbg 爆破。

提示：步骤和上面一模一样。

### 练习 2：换一种爆破方式

如果你之前用的是 `jne` 改 `je`，这次试试 `nop` 掉跳转。如果你之前用的是 `nop`，这次试试改成 `je`。

### 练习 3：找一个真实的 CrackMe 爆破

打开 https://github.com/TonyChen56/160-Crackme，下载第一个 CrackMe，用同样的方法尝试爆破它。

提示：

- 如果字符串引用里找不到中文，试试搜英文（比如 "correct"、"wrong"、"success"、"fail"、"registered"）
- 有些 CrackMe 没有明显的字符串，这时候需要在 API 函数上下断点（比如 `MessageBoxA`），这个我们后面会学

---

**下一章**：我们会回头看看今天那个程序的汇编代码，搞懂每一行到底是什么意思。你不需要背汇编，只需要把你写的 C 代码和汇编对照着理解。
