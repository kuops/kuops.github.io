import type { UIStrings } from "../types";

export default {
  nav: {
    posts: "文章",
    tags: "标签",
    about: "关于",
    archives: "归档",
    search: "搜索",
    books: "书籍",
    home: "首页",
  },
  post: {
    previous: "上一篇",
    next: "下一篇",
    share: "分享到",
    edit: "编辑",
    copyCode: "复制",
    copied: "已复制",
    backToTop: "回到顶部",
    updated: "更新于",
  },
  pagination: {
    prev: "上一页",
    next: "下一页",
    pageOf: "第 {{current}} 页，共 {{total}} 页",
  },
  home: {
    featured: "精选文章",
    recentPosts: "最新文章",
    allPosts: "所有文章",
    socialLinks: "社交链接：",
  },
  footer: {
    copyright: "版权所有",
  },
  pages: {
    searchHint: "搜索",
    searchHintBefore: "点击右上角搜索图标或按",
    searchHintAfter: "打开搜索",
    toc: "目录",
    openToc: "打开目录",
    closeToc: "关闭目录",
  },
  a11y: {
    skipToContent: "跳到内容",
    toggleTheme: "切换明暗模式",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
  },
  notFound: {
    title: "404",
    description: "页面未找到",
    backHome: "返回首页",
  },
  book: {
    previousChapter: "上一章",
    nextChapter: "下一章",
    tableOfContents: "目录",
    chapterNav: "章节导航",
  },
  booksPage: {
    title: "书籍",
    description: "我写的所有书籍。",
  },
} satisfies UIStrings;
