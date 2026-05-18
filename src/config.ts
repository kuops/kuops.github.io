import type { ResolvedAstroPaperConfig } from "@/types/config";
import config from "../astro-paper.config";

const resolvedConfig: ResolvedAstroPaperConfig = {
  site: {
    url: config.site.url,
    title: config.site.title,
    description: config.site.description,
    author: config.site.author,
    profile: config.site.profile ?? config.site.url,
    ogImage: config.site.ogImage ?? "astropaper-og.jpg",
    lang: config.site.lang ?? "en",
    timezone: config.site.timezone ?? "UTC",
    dir: config.site.dir ?? "ltr",
    googleVerification: config.site.googleVerification ?? "",
  },
  posts: {
    perPage: config.posts.perPage,
    perIndex: config.posts.perIndex,
    scheduledPostMargin: config.posts.scheduledPostMargin,
  },
  features: {
    lightAndDarkMode: config.features.lightAndDarkMode,
    dynamicOgImage: config.features.dynamicOgImage,
    showArchives: config.features.showArchives,
    showBackButton: config.features.showBackButton,
    editPost: config.features.editPost,
    search: config.features.search,
  },
  socials: config.socials,
  shareLinks: config.shareLinks,
};

export const SITE = {
  website: resolvedConfig.site.url,
  author: resolvedConfig.site.author,
  profile: resolvedConfig.site.profile,
  desc: resolvedConfig.site.description,
  title: resolvedConfig.site.title,
  ogImage: resolvedConfig.site.ogImage,
  lightAndDarkMode: resolvedConfig.features.lightAndDarkMode,
  postPerIndex: resolvedConfig.posts.perIndex,
  postPerPage: resolvedConfig.posts.perPage,
  scheduledPostMargin: resolvedConfig.posts.scheduledPostMargin,
  showArchives: resolvedConfig.features.showArchives,
  showBackButton: resolvedConfig.features.showBackButton,
  editPost: resolvedConfig.features.editPost,
  dynamicOgImage: resolvedConfig.features.dynamicOgImage,
  dir: resolvedConfig.site.dir,
  lang: resolvedConfig.site.lang,
  timezone: resolvedConfig.site.timezone,
  googleVerification: resolvedConfig.site.googleVerification,
} as const;

export const SOCIALS = resolvedConfig.socials;
export const SHARE_LINKS = resolvedConfig.shareLinks;
