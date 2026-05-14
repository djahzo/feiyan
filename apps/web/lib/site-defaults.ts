import type { SiteConfig } from '@/lib/site-config-types';

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteName: '斐延',
  headerSubtitle: ' · 商务主站',
  contactEmail: '2249213654@qq.com',
  defaultSign:
    '《三角洲行动》战术射击赛道内容创作：版本与枪械理解、地图与撤离节奏、搜打撤实战复盘。既做给玩家看，也方便品牌评估是否同频。',
  heroTitlePart1: '战术射击内容，',
  heroTitleAccent: '做给玩家与品牌',
  heroTitlePart2: '同频对话',
  heroPills: ['三角洲行动', '攻略 · 实况 · 复盘', '战术博弈', '直播 / 长线合作'],
  navLinks: [
    { href: '#intro', label: '简介' },
    { href: '#biz', label: '商务合作' },
    { href: '#trust', label: '合作说明' },
    { href: '#videos', label: '精选投稿' },
    { href: '#contact', label: '联系' },
  ],
  bizBlocks: [
    {
      k: '01',
      title: '需求简报与排期',
      body: '先对齐品牌目标、受众画像、内容禁忌与档期窗口；再匹配植入、定制、直播专场等形式，避免「先拍脑袋再改脚本」。',
    },
    {
      k: '02',
      title: '内容共创与露出',
      body: '脚本、口播、画面与弹幕引导可逐条确认；长线合作可包含版本更新节点、赛事/活动联动等节奏。',
    },
    {
      k: '03',
      title: '交付与复盘',
      body: '上线后按约定数据维度复盘；支持多轮迭代的年度框架，也接受单项目试水。',
    },
  ],
  bizSectionTitle: '商务合作怎么推进',
  bizSectionIntro:
    '面向硬件外设、游戏发行、饮料零食、电竞椅等品牌侧：可按 campaign 做单场植入，也可按版本节奏签季度框架。',
  trustSectionTitle: '合作说明',
  trustSectionIntro:
    '三角洲玩家圈子认「真实对局与版本理解」。主站用于让品牌方在下单前确认内容风格与合作边界。',
  trustPoints: [
    {
      title: '社区与规则优先',
      body: '商业合作内容会按平台与社区规范标注，尊重玩家体验；不搞隐瞒式硬广。',
    },
    {
      title: '可写入合同的颗粒度',
      body: '交付物、修改轮次、上线节点与违约条款均可前置对齐，减少口头扯皮。',
    },
  ],
  videosSectionTitle: '精选投稿',
  videosSectionIntro:
    '以下为频道内近期公开稿件，供评估内容调性；完整列表请前往 B 站空间。',
  emptyVideosTitle: '主播去找非洲之心了',
  emptyVideosBody:
    '稿件暂时没在阵地上——刷新试试，或直达 B 站空间翻仓库。',
  footerTagline: '《三角洲行动》等内容向品牌合作 · 询价请邮件并注明品牌与大致档期',
  footerNote: '本站为展示用途，合作以书面确认与平台规则为准',
  footerIcpText: '蜀ICP备2026023536号',
  contactBarLine: '邮件 1–2 个工作日内回复',
};
