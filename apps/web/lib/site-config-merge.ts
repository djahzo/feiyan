import { DEFAULT_SITE_CONFIG } from '@/lib/site-defaults';
import type { BizBlock, NavLink, SiteConfig, TrustPoint } from '@/lib/site-config-types';

function isNavLinks(v: unknown): v is NavLink[] {
  return (
    Array.isArray(v) &&
    v.every(x => typeof x === 'object' && x !== null && 'href' in x && 'label' in x)
  );
}

function isBizBlocks(v: unknown): v is BizBlock[] {
  return (
    Array.isArray(v) &&
    v.every(x => typeof x === 'object' && x !== null && 'k' in x && 'title' in x && 'body' in x)
  );
}

function isTrustPoints(v: unknown): v is TrustPoint[] {
  return (
    Array.isArray(v) &&
    v.every(x => typeof x === 'object' && x !== null && 'title' in x && 'body' in x)
  );
}

export function mergeSiteConfig(input: unknown): SiteConfig {
  const d = DEFAULT_SITE_CONFIG;
  if (!input || typeof input !== 'object') return { ...d };

  const o = input as Record<string, unknown>;

  return {
    siteName: typeof o.siteName === 'string' ? o.siteName : d.siteName,
    headerSubtitle: typeof o.headerSubtitle === 'string' ? o.headerSubtitle : d.headerSubtitle,
    contactEmail: typeof o.contactEmail === 'string' ? o.contactEmail : d.contactEmail,
    defaultSign: typeof o.defaultSign === 'string' ? o.defaultSign : d.defaultSign,
    heroTitlePart1: typeof o.heroTitlePart1 === 'string' ? o.heroTitlePart1 : d.heroTitlePart1,
    heroTitleAccent: typeof o.heroTitleAccent === 'string' ? o.heroTitleAccent : d.heroTitleAccent,
    heroTitlePart2: typeof o.heroTitlePart2 === 'string' ? o.heroTitlePart2 : d.heroTitlePart2,
    heroPills: Array.isArray(o.heroPills) && o.heroPills.every(x => typeof x === 'string')
      ? (o.heroPills as string[])
      : d.heroPills,
    navLinks: isNavLinks(o.navLinks) ? o.navLinks : d.navLinks,
    bizBlocks: isBizBlocks(o.bizBlocks) ? o.bizBlocks : d.bizBlocks,
    bizSectionTitle: typeof o.bizSectionTitle === 'string' ? o.bizSectionTitle : d.bizSectionTitle,
    bizSectionIntro: typeof o.bizSectionIntro === 'string' ? o.bizSectionIntro : d.bizSectionIntro,
    trustSectionTitle: typeof o.trustSectionTitle === 'string' ? o.trustSectionTitle : d.trustSectionTitle,
    trustSectionIntro: typeof o.trustSectionIntro === 'string' ? o.trustSectionIntro : d.trustSectionIntro,
    trustPoints: isTrustPoints(o.trustPoints) ? o.trustPoints : d.trustPoints,
    videosSectionTitle: typeof o.videosSectionTitle === 'string' ? o.videosSectionTitle : d.videosSectionTitle,
    videosSectionIntro: typeof o.videosSectionIntro === 'string' ? o.videosSectionIntro : d.videosSectionIntro,
    emptyVideosTitle: typeof o.emptyVideosTitle === 'string' ? o.emptyVideosTitle : d.emptyVideosTitle,
    emptyVideosBody: typeof o.emptyVideosBody === 'string' ? o.emptyVideosBody : d.emptyVideosBody,
    footerTagline: typeof o.footerTagline === 'string' ? o.footerTagline : d.footerTagline,
    footerNote: typeof o.footerNote === 'string' ? o.footerNote : d.footerNote,
    footerIcpText: typeof o.footerIcpText === 'string' ? o.footerIcpText : d.footerIcpText,
    contactBarLine: typeof o.contactBarLine === 'string' ? o.contactBarLine : d.contactBarLine,
  };
}
