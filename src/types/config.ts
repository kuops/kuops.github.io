interface SiteConfig {
  url: string;
  title: string;
  description: string;
  author: string;
  profile?: string;
  ogImage?: string;
  lang?: string;
  timezone?: string;
  dir?: "ltr" | "rtl";
  googleVerification?: string;
}

interface PostsConfig {
  perPage?: number;
  perIndex?: number;
  scheduledPostMargin?: number;
}

interface FeaturesConfig {
  lightAndDarkMode?: boolean;
  dynamicOgImage?: boolean;
  showArchives?: boolean;
  showBackButton?: boolean;
  editPost?:
    | {
        enabled: true;
        url: string;
      }
    | { enabled: false };
  search?: "pagefind" | false;
}

interface SocialLink {
  name: string;
  url: string;
  linkTitle?: string;
}

interface ShareLink {
  name: string;
  url: string;
  linkTitle?: string;
}

interface AstroPaperConfig {
  site: SiteConfig;
  posts?: PostsConfig;
  features?: FeaturesConfig;
  socials?: SocialLink[];
  shareLinks?: ShareLink[];
}

type ResolvedSiteConfig = Required<
  Pick<
    SiteConfig,
    | "url"
    | "title"
    | "description"
    | "author"
    | "lang"
    | "timezone"
    | "dir"
    | "ogImage"
  >
> &
  Pick<SiteConfig, "profile" | "googleVerification">;

export interface ResolvedAstroPaperConfig {
  site: ResolvedSiteConfig;
  posts: Required<PostsConfig>;
  features: Required<FeaturesConfig>;
  socials: SocialLink[];
  shareLinks: ShareLink[];
}

function defineAstroPaperConfig(config: AstroPaperConfig): AstroPaperConfig {
  return config;
}

export type {
  SiteConfig,
  PostsConfig,
  FeaturesConfig,
  SocialLink,
  ShareLink,
  AstroPaperConfig,
};

export { defineAstroPaperConfig };
