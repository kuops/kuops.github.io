import fs from "node:fs";
import path from "node:path";
import { getCollection, type CollectionEntry } from "astro:content";

const BLOG_DIR = path.resolve("src/data/blog");
const BLOG_FILE_RE = /\.mdx?$/;

let hasBlogSourcesCache: boolean | undefined;

function hasBlogSources(dir: string): boolean {
  if (!fs.existsSync(dir)) {
    return false;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && hasBlogSources(fullPath)) {
      return true;
    }

    if (entry.isFile() && BLOG_FILE_RE.test(entry.name)) {
      return true;
    }
  }

  return false;
}

function shouldLoadBlogCollection() {
  if (hasBlogSourcesCache === undefined) {
    hasBlogSourcesCache = hasBlogSources(BLOG_DIR);
  }

  return hasBlogSourcesCache;
}

export async function getBlogPosts(
  filter?: (post: CollectionEntry<"blog">) => boolean
) {
  if (!shouldLoadBlogCollection()) {
    return [] as CollectionEntry<"blog">[];
  }

  const posts = await getCollection("blog");
  return filter ? posts.filter(filter) : posts;
}
