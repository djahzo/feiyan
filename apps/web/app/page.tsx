'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BilibiliUserInfo, BilibiliVideo, BilibiliLiveStatus } from '@/types/bilibili';

const SITE_NAME = '斐延';
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@example.com';

const navLinks = [
  { href: '#intro', label: '简介' },
  { href: '#biz', label: '商务合作' },
  { href: '#trust', label: '合作说明' },
  { href: '#videos', label: '精选投稿' },
  { href: '#contact', label: '联系' },
];

const DEFAULT_SIGN = '《三角洲行动》战术射击赛道内容创作：版本与枪械理解、地图与撤离节奏、搜打撤实战复盘。既做给玩家看，也方便品牌评估是否同频。';
const heroPills = ['三角洲行动', '攻略 · 实况 · 复盘', '战术博弈', '直播 / 长线合作'];

const bizBlocks = [
  { k: '01', title: '需求简报与排期', body: '先对齐品牌目标、受众画像、内容禁忌与档期窗口；再匹配植入、定制、直播专场等形式，避免「先拍脑袋再改脚本」。' },
  { k: '02', title: '内容共创与露出', body: '脚本、口播、画面与弹幕引导可逐条确认；长线合作可包含版本更新节点、赛事/活动联动等节奏。' },
  { k: '03', title: '交付与复盘', body: '上线后按约定数据维度复盘；支持多轮迭代的年度框架，也接受单项目试水。' },
];

const trustPoints = [
  { title: '社区与规则优先', body: '商业合作内容会按平台与社区规范标注，尊重玩家体验；不搞隐瞒式硬广。' },
  { title: '可写入合同的颗粒度', body: '交付物、修改轮次、上线节点与违约条款均可前置对齐，减少口头扯皮。' },
];

function fmt(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}千`;
  return String(n);
}
function fmtDate(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HomePage() {
  const [showTop, setShowTop] = useState(false);
  const [userInfo, setUserInfo] = useState<BilibiliUserInfo | null>(null);
  const [live, setLive] = useState<BilibiliLiveStatus | null>(null);
  const [videos, setVideos] = useState<BilibiliVideo[]>([]);
  const [videoTotal, setVideoTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [u, l, v] = await Promise.all([
        fetch('/api/bilibili/user').then(r => r.json()).catch(() => null),
        fetch('/api/bilibili/live').then(r => r.json()).catch(() => null),
        fetch('/api/bilibili/videos?pageSize=9').then(r => r.json()).catch(() => null),
      ]);
      setUserInfo(u?.data || null);
      setLive(l?.data || null);
      setVideos(v?.data?.videos || []);
      setVideoTotal(v?.data?.total || 0);
    } catch {
      setLoadError('接口暂不可用，请确认已配置 BILIBILI_UID');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 380);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const spaceUrl = useMemo(() => userInfo?.mid ? `https://space.bilibili.com/${userInfo.mid}` : 'https://www.bilibili.com', [userInfo?.mid]);
  const heroSubtitle = (userInfo?.sign?.trim()) || DEFAULT_SIGN;
  const faceUrl = userInfo?.face || '';
  const displayNick = userInfo?.name || SITE_NAME;

  return (
    <div className="min-h-screen bg-white text-[#333]">
      <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 md:px-8">
          <a href="#intro" className="font-bold tracking-tight">
            {SITE_NAME}<span className="ml-2 hidden font-normal text-[#888] sm:inline">· 商务主站</span>
          </a>
          <nav className="hidden flex-1 justify-center md:flex">
            <ul className="flex gap-6 text-sm text-[#444] lg:gap-8">
              {navLinks.map(l => <li key={l.href}><a href={l.href} className="hover:text-[#00A1D6]">{l.label}</a></li>)}
            </ul>
          </nav>
          <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`【商务合作咨询】${SITE_NAME}`)}`}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#333] transition hover:border-[#00A1D6] hover:text-[#00A1D6]">
            商务询价
          </a>
        </div>
      </header>

      {loadError && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">{loadError}</div>
      )}

      {live?.live_status === 1 && live.url && (
        <a href={live.url} target="_blank" rel="noopener noreferrer"
          className="block bg-gradient-to-r from-[#1a1f2e] to-[#0A0E14] px-4 py-3 text-center text-sm text-white transition hover:opacity-95">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          正在直播：{live.title || '进入直播间'}
          <span className="ml-2 text-[#E8B84B]">→</span>
        </a>
      )}

      <section id="intro" className="relative scroll-mt-20 overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_#1a2838_0%,_#0A0E14_55%,_#06080c_100%)]">
        <div className="pointer-events-none absolute -right-24 top-16 h-64 w-64 rounded-full bg-[#E8B84B]/10 blur-3xl" />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-12 px-4 pb-20 pt-16 md:flex-row md:items-stretch md:px-8 md:pb-24 md:pt-20">
          <div className="hidden w-1 shrink-0 rounded-full bg-gradient-to-b from-[#E8B84B] via-[#E8B84B]/40 to-transparent md:block" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium tracking-wide text-[#E8B84B]/90">B站 UP 主 · {loading ? '…' : displayNick}</p>
            <h1 className="mt-4 text-[1.65rem] font-bold leading-snug text-white md:text-4xl md:leading-tight">
              战术射击内容，<span className="text-[#E8B84B]">做给玩家与品牌</span>同频对话
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75">{heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {heroPills.map(p => (
                <span key={p} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/85">{p}</span>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`【商务合作】${SITE_NAME}`)}`}
                className="inline-flex rounded-lg bg-[#E8B84B] px-6 py-3 text-sm font-semibold text-black shadow-lg transition hover:brightness-110">
                发商务邮件
              </a>
              <a href={spaceUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline">
                B 站频道
              </a>
              <a href="#biz" className="text-sm font-medium text-white/60 hover:text-white/90">合作流程 →</a>
            </div>
          </div>
          {faceUrl && (
            <div className="flex shrink-0 items-end justify-center md:w-[280px] lg:w-[320px]">
              <div className="relative w-full max-w-xs">
                <div className="absolute -inset-3 rounded-2xl bg-gradient-to-tr from-[#E8B84B]/20 to-transparent" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faceUrl} alt="" className="relative aspect-square w-full rounded-xl object-cover ring-2 ring-white/10" loading="eager" referrerPolicy="no-referrer" />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="border-y border-gray-100 bg-gray-50/80">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-8 px-4 py-6 text-center text-sm text-[#555] md:justify-between md:px-8 md:text-left">
          <div><p className="text-xs uppercase tracking-wider text-[#888]">频道昵称</p><p className="mt-1 font-semibold text-[#222]">{loading ? '加载中…' : displayNick}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-[#888]">公开稿件</p><p className="mt-1 font-semibold text-[#222]">{loading ? '…' : `${videoTotal || videos.length} 支`}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-[#888]">商务联络</p><p className="mt-1 font-semibold text-[#222]">邮件 1–2 个工作日内回复</p></div>
        </div>
      </div>

      <section id="biz" className="scroll-mt-20 px-4 py-20 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-2xl font-bold md:text-3xl">商务合作怎么推进</h2>
            <p className="mt-3 text-[#666]">面向硬件外设、游戏发行、饮料零食、电竞椅等品牌侧：可按 campaign 做单场植入，也可按版本节奏签季度框架。</p>
          </div>
          <ol className="space-y-10 border-l-2 border-gray-200 pl-8 md:pl-10">
            {bizBlocks.map(b => (
              <li key={b.k} className="relative">
                <span className="absolute -left-[2.125rem] top-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#0A0E14] text-xs font-bold text-[#E8B84B] md:-left-[2.5rem]">{b.k}</span>
                <h3 className="text-lg font-bold text-[#222]">{b.title}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#666]">{b.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="trust" className="scroll-mt-20 bg-[#0A0E14] px-4 py-20 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-white md:text-3xl">合作说明</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">三角洲玩家圈子认「真实对局与版本理解」。主站用于让品牌方在下单前确认内容风格与合作边界。</p>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {trustPoints.map(t => (
              <div key={t.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
                <h3 className="font-semibold text-[#E8B84B]">{t.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/85">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="videos" className="scroll-mt-20 px-4 py-20 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">精选投稿</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[#666]">以下为频道内近期公开稿件，供评估内容调性；完整列表请前往 B 站空间。</p>
          {loading ? (
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(k => (
                <div key={k} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <div className="aspect-video animate-pulse bg-gray-200" />
                  <div className="space-y-3 p-5">
                    <div className="h-5 w-4/5 animate-pulse rounded bg-gray-200" />
                    <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="mt-14 flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
              <h3 className="mt-5 text-xl font-bold text-[#222]">主播去找非洲之心了</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#666]">稿件暂时没在阵地上——刷新试试，或直达 B 站空间翻仓库。</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={loadData} className="rounded-lg bg-[#0A0E14] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0A0E14]/90">刷新稿件</button>
                {userInfo?.mid && <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-[#333] transition hover:bg-gray-50">去 B 站空间</a>}
              </div>
            </div>
          ) : (
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map(v => (
                <article key={v.bvid} className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
                  <a href={`https://www.bilibili.com/video/${v.bvid}`} target="_blank" rel="noopener noreferrer" className="relative aspect-video overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.pic} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" referrerPolicy="no-referrer" />
                    <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">{v.length}</span>
                  </a>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-base font-bold leading-snug text-[#222] group-hover:text-[#00A1D6]">
                      <a href={`https://www.bilibili.com/video/${v.bvid}`} target="_blank" rel="noopener noreferrer">{v.title}</a>
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-[#666]">{v.description || ' '}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#999]">
                      <span>{fmtDate(v.created)}</span>
                      <span>{fmt(v.play)} 播放</span>
                      {v.video_review > 0 && <span>{fmt(v.video_review)} 评论</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {userInfo?.mid && (
            <p className="mt-10 text-center">
              <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#00A1D6] hover:underline">进入 B 站空间看全部稿件 →</a>
            </p>
          )}
        </div>
      </section>

      <footer id="contact" className="scroll-mt-20 border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 py-14 md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-[#222]">{SITE_NAME} · 商务主站</p>
              <p className="mt-1 text-sm text-[#666]">《三角洲行动》等内容向品牌合作 · 询价请邮件并注明品牌与大致档期</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`【商务合作】${SITE_NAME}`)}`}
                className="inline-flex w-fit items-center rounded-lg bg-[#00A1D6] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">
                {CONTACT_EMAIL}
              </a>
              {userInfo?.mid && (
                <a href={spaceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex w-fit items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-[#333] hover:bg-gray-50">
                  B 站主页
                </a>
              )}
            </div>
          </div>
          <p className="mt-10 text-center text-xs text-[#999]">© {new Date().getFullYear()} {SITE_NAME} · 本站为展示用途，合作以书面确认与平台规则为准</p>
        </div>
      </footer>

      {showTop && (
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-5 z-50 rounded-full border border-gray-200 bg-white p-3 text-[#444] shadow-lg hover:bg-gray-50"
          aria-label="回到顶部">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  );
}
