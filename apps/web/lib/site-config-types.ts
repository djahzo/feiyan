export type NavLink = { href: string; label: string };
export type BizBlock = { k: string; title: string; body: string };
export type TrustPoint = { title: string; body: string };

export type SiteConfig = {
  siteName: string;
  headerSubtitle: string;
  contactEmail: string;
  defaultSign: string;
  heroTitlePart1: string;
  heroTitleAccent: string;
  heroTitlePart2: string;
  heroPills: string[];
  navLinks: NavLink[];
  bizBlocks: BizBlock[];
  bizSectionTitle: string;
  bizSectionIntro: string;
  trustSectionTitle: string;
  trustSectionIntro: string;
  trustPoints: TrustPoint[];
  videosSectionTitle: string;
  videosSectionIntro: string;
  emptyVideosTitle: string;
  emptyVideosBody: string;
  footerTagline: string;
  footerNote: string;
  /** 备案号文案，空字符串则不展示 */
  footerIcpText: string;
  contactBarLine: string;
};
