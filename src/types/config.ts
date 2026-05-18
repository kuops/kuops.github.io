interface SiteConfig {
  url: string;
  title: string;
  description: string;
  author: string;
  profile?: string;
  ogImage?: string;
  lang: string;
  timezone: string;
  dir: "ltr" | "rtl";
  googleVerification?: string;
}

interface PostsConfig {
  perPage: number;
  perIndex: number;
  scheduledPostMargin: number;
}

interface FeaturesConfig {
  lightAndDarkMode: boolean;
  dynamicOgImage: boolean;
  showArchives: boolean;
  showBackButton: boolean;
  editPost: {
    enabled: boolean;
    text: string;
    url: string;
  };
  search: boolean;
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
  posts: PostsConfig;
  features: FeaturesConfig;
  socials: SocialLink[];
  shareLinks: ShareLink[];
}

type ResolvedAstroPaperConfig = Required<AstroPaperConfig>;

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
  ResolvedAstroPaperConfig,
};

export { defineAstroPaperConfig };
