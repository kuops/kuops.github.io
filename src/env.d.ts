interface Window {
  theme?: {
    themeValue: string;
    setPreference?: () => void;
    reflectPreference?: () => void;
    getTheme: () => string;
    setTheme: (val: string) => void;
  };
}

declare module "/pagefind/pagefind.js" {
  interface PagefindSearchResult {
    data: () => Promise<{
      url: string;
      title?: string;
      excerpt?: string;
      meta?: Record<string, string>;
      tags?: string[];
    }>;
  }

  function search(query: string): Promise<{ results: PagefindSearchResult[] }>;
}
