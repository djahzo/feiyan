import type { SiteConfig } from '@/lib/site-config-types';

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteName: '斐延',
  headerSubtitle: ' · 个人主站',
  contactEmail: '2249213654@qq.com',
  defaultSign:
    '战术射击游戏内容创作者，专注于游戏理解、地图节奏、实战复盘等内容分享。',
  heroTitlePart1: '战术射击内容，',
  heroTitleAccent: '分享给玩家',
  heroTitlePart2: '一起进步',
  heroPills: ['游戏攻略', '实况 · 复盘', '战术博弈', '直播互动'],
  navLinks: [
    { href: '#intro', label: '简介' },
    { href: '#videos', label: '精选投稿' },
    { href: '#contact', label: '联系我们' },
  ],
  bizBlocks: [],
  bizSectionTitle: '',
  bizSectionIntro: '',
  trustSectionTitle: '',
  trustSectionIntro: '',
  trustPoints: [],
  videosSectionTitle: '精选投稿',
  videosSectionIntro:
    '以下为频道内近期公开稿件，完整列表请前往 B 站空间。',
  emptyVideosTitle: '暂无视频',
  emptyVideosBody:
    '稿件加载中，或直达 B 站空间查看。',
  footerTagline: '游戏内容创作 · 交流请通过邮件或B站私信',
  footerNote: '本站为个人展示用途',
  footerIcpText: '蜀ICP备2026023536号',
  contactBarLine: '邮件回复时间：1-2个工作日',
};
