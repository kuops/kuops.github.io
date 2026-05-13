export interface SidebarGroup {
  text: string;
  items: string[];
}

export interface BookConfig {
  title: string;
  description: string;
  slug: string;
  sidebar: SidebarGroup[];
}

export const BOOKS: BookConfig[] = [
  {
    title: "入门指南",
    description: "一份帮助你快速上手的入门指南。",
    slug: "getting-started",
    sidebar: [
      {
        text: "开始",
        items: ["ch01", "ch02", "ch03"],
      },
    ],
  },
  {
    title: "Astro 完全指南",
    description: "从零开始学习 Astro 框架，构建高性能静态网站。",
    slug: "astro-guide",
    sidebar: [
      {
        text: "基础",
        items: ["ch01", "ch02"],
      },
      {
        text: "进阶",
        items: ["ch03", "ch04"],
      },
    ],
  },
];

export function getBookConfig(slug: string): BookConfig | undefined {
  return BOOKS.find(b => b.slug === slug);
}

export function getAllBookSlugs(): string[] {
  return BOOKS.map(b => b.slug);
}
