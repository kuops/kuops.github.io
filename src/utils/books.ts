import { getCollection, type CollectionEntry } from "astro:content";
import type { SidebarGroup } from "@/types/books";

type BookEntry = CollectionEntry<"books">;

interface BookMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
}

export function isBookIndex(e: BookEntry) {
  return e.filePath?.endsWith("/index.md") || e.filePath === "index.md";
}

export function isGroupIndex(e: BookEntry) {
  return e.filePath?.endsWith("/_index.md");
}

function getBookSlug(id: string) {
  return id.split("/")[0];
}

function getRelativePath(id: string) {
  return id.split("/").slice(1).join("/");
}

function getGroupDir(id: string) {
  const parts = id.split("/");
  return parts.length >= 3 ? parts[1] : null;
}

export async function getAllBooks(): Promise<BookMeta[]> {
  const entries = await getCollection(
    "books",
    e => isBookIndex(e) && !e.data.draft
  );
  return entries
    .map(e => ({
      slug: getBookSlug(e.id),
      title: e.data.title,
      description: e.data.description,
      order: e.data.order ?? 0,
    }))
    .sort((a, b) => a.order - b.order);
}

export async function getBookEntries(bookSlug: string): Promise<BookEntry[]> {
  const prefix = bookSlug + "/";
  return getCollection(
    "books",
    ({ id, data }) => (id === bookSlug || id.startsWith(prefix)) && !data.draft
  );
}

interface GroupMeta {
  dir: string;
  title: string;
  order: number;
}

export function buildSidebar(
  bookSlug: string,
  entries: BookEntry[]
): SidebarGroup[] {
  const groupIndexEntries = entries.filter(
    e => getBookSlug(e.id) === bookSlug && isGroupIndex(e)
  );

  const groupMap = new Map<string, GroupMeta>();
  for (const e of groupIndexEntries) {
    const dir = getGroupDir(e.id)!;
    groupMap.set(dir, {
      dir,
      title: e.data.group || dir,
      order: e.data.order ?? 0,
    });
  }

  const chapters = entries.filter(
    e => getBookSlug(e.id) === bookSlug && !isBookIndex(e) && !isGroupIndex(e)
  );

  const hasGroups = groupMap.size > 0;

  if (!hasGroups) {
    const sorted = [...chapters].sort(
      (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)
    );
    return [
      {
        text: "",
        items: sorted.map(e => getRelativePath(e.id)),
      },
    ];
  }

  const groupsByDir = new Map<string, BookEntry[]>();
  const rootChapters: BookEntry[] = [];

  for (const ch of chapters) {
    const dir = getGroupDir(ch.id);
    if (dir && groupMap.has(dir)) {
      if (!groupsByDir.has(dir)) groupsByDir.set(dir, []);
      groupsByDir.get(dir)!.push(ch);
    } else {
      rootChapters.push(ch);
    }
  }

  const result: SidebarGroup[] = [];

  if (rootChapters.length > 0) {
    const sorted = [...rootChapters].sort(
      (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)
    );
    result.push({
      text: "",
      items: sorted.map(e => getRelativePath(e.id)),
    });
  }

  const sortedGroups = [...groupMap.values()].sort((a, b) => a.order - b.order);

  for (const g of sortedGroups) {
    const items = [...(groupsByDir.get(g.dir) || [])].sort(
      (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)
    );
    if (items.length > 0) {
      result.push({
        text: g.title,
        items: items.map(e => getRelativePath(e.id)),
      });
    }
  }

  return result;
}

export function buildTitleMap(entries: BookEntry[], bookSlug: string) {
  const map: Record<string, string> = {};
  const prefix = bookSlug + "/";
  for (const e of entries) {
    if (!isBookIndex(e) && !isGroupIndex(e) && e.id.startsWith(prefix)) {
      map[getRelativePath(e.id)] = e.data.title;
    }
  }
  return map;
}

export function getFlatItems(sidebar: SidebarGroup[]) {
  return sidebar.flatMap(g => g.items);
}

export function getFirstChapter(
  bookSlug: string,
  entries: BookEntry[]
): string | null {
  const sidebar = buildSidebar(bookSlug, entries);
  const flat = getFlatItems(sidebar);
  return flat.length > 0 ? flat[0] : null;
}
