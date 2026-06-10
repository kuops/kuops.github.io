import fs from "node:fs";
import path from "node:path";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import config from "@/config";

export const BLOG_PATH = "src/data/blog";
export const BOOKS_PATH = "src/data/books";
export const PAGES_PATH = "src/data/pages";

function hasMarkdownEntries(dir: string): boolean {
  if (!fs.existsSync(dir)) {
    return false;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && hasMarkdownEntries(fullPath)) {
      return true;
    }

    if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      return true;
    }
  }

  return false;
}

const blogLoader = glob({
  pattern: "**/[^_]*.{md,mdx}",
  base: `./${BLOG_PATH}`,
});

const blog = defineCollection({
  loader: {
    ...blogLoader,
    name: "blog-glob-loader",
    async load(context) {
      if (!hasMarkdownEntries(path.resolve(BLOG_PATH))) {
        context.store.clear();
        return;
      }

      return blogLoader.load(context);
    },
  },
  schema: ({ image }) =>
    z.object({
      author: z.string().default(config.site.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
    }),
});

const books = defineCollection({
  loader: glob({ pattern: "**/*.md", base: `./${BOOKS_PATH}` }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().default(0),
    group: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${PAGES_PATH}` }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    ogImage: z.string().optional(),
    canonicalURL: z.string().optional(),
  }),
});

export const collections = { blog, books, pages };
