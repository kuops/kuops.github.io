import type { UIStrings } from "../types";

export default {
  nav: {
    posts: "Posts",
    tags: "Tags",
    about: "About",
    archives: "Archives",
    search: "Search",
    books: "Books",
  },
  post: {
    previous: "Previous Post",
    next: "Next Post",
    share: "Share this post on:",
    edit: "Edit page",
    copyCode: "Copy",
    copied: "Copied",
    backToTop: "Back To Top",
    updated: "Updated:",
  },
  pagination: {
    prev: "Prev",
    next: "Next",
    pageOf: "Page {{current}} of {{total}}",
  },
  home: {
    featured: "Featured",
    recentPosts: "Recent Posts",
    allPosts: "All Posts",
    socialLinks: "Social Links:",
  },
  footer: {
    copyright: "All rights reserved.",
  },
  pages: {
    searchHint: "Search",
    searchHintBefore: "Click the search icon in the top right corner or press",
    searchHintAfter: "to open search",
    toc: "Table of Contents",
    openToc: "Open TOC",
    closeToc: "Close TOC",
  },
  a11y: {
    skipToContent: "Skip to content",
    toggleTheme: "Toggles light & dark",
    openMenu: "Open Menu",
    closeMenu: "Close Menu",
  },
  notFound: {
    title: "404",
    description: "Page not found",
    backHome: "Back to Home",
  },
  book: {
    previousChapter: "Previous Chapter",
    nextChapter: "Next Chapter",
    tableOfContents: "Contents",
  },
} satisfies UIStrings;
