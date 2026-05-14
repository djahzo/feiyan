'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SITE_CONFIG } from '@/lib/site-defaults';
import { c } from '@/components/admin/admin-theme';
import { mergeSiteConfig } from '@/lib/site-config-merge';
import type { BizBlock, NavLink, SiteConfig, TrustPoint } from '@/lib/site-config-types';

type TabId = 'basic' | 'hero' | 'nav' | 'content' | 'json';

const SITE_TABS: { id: TabId; label: string; desc?: string }[] = [
  { id: 'basic', label: '基础信息', desc: '邮箱、页脚、备案' },
  { id: 'hero', label: '首页头图', desc: '标题与签名' },
  { id: 'nav', label: '导航菜单', desc: '顶栏链接' },
  { id: 'content', label: '区块文案', desc: '商务、说明、投稿区' },
  { id: 'json', label: 'JSON 高级', desc: '整份配置' },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <span className={`text-sm font-medium ${c.text}`}>{label}</span>
        {hint ? <p className={`mt-1 text-xs leading-relaxed ${c.sub}`}>{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default function SiteConfigEditor() {
  const [cfg, setCfg] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [jsonDraft, setJsonDraft] = useState('');
  const [active, setActive] = useState<TabId>('basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/site-config');
      const body = (await res.json()) as { data?: SiteConfig; error?: string };
      if (!res.ok) {
        setError(body.error || '加载失败');
        setCfg(DEFAULT_SITE_CONFIG);
        return;
      }
      const next = body.data ?? DEFAULT_SITE_CONFIG;
      setCfg(next);
      setJsonDraft(JSON.stringify(next, null, 2));
    } catch {
      setError('网络错误');
      setCfg(DEFAULT_SITE_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function goTab(id: TabId) {
    if (id === 'json') setJsonDraft(JSON.stringify(cfg, null, 2));
    setActive(id);
  }

  async function persist(next: SiteConfig) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/site-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const body = (await res.json()) as { error?: string; data?: SiteConfig };
      if (!res.ok) {
        setError(body.error || '保存失败');
        return;
      }
      setMessage('已保存');
      if (body.data) {
        setCfg(body.data);
        setJsonDraft(JSON.stringify(body.data, null, 2));
      }
    } catch {
      setError('网络错误');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (active === 'json') {
      try {
        const parsed = JSON.parse(jsonDraft) as unknown;
        await persist(mergeSiteConfig(parsed));
      } catch {
        setError('JSON 格式不正确，无法保存');
      }
      return;
    }
    await persist(cfg);
  }

  function resetDefaults() {
    setCfg(DEFAULT_SITE_CONFIG);
    setJsonDraft(JSON.stringify(DEFAULT_SITE_CONFIG, null, 2));
    setMessage(null);
    setError(null);
  }

  function updateNav(i: number, patch: Partial<NavLink>) {
    setCfg(c => {
      const navLinks = c.navLinks.map((l, j) => (j === i ? { ...l, ...patch } : l));
      return { ...c, navLinks };
    });
  }

  function addNav() {
    setCfg(c => ({
      ...c,
      navLinks: [...c.navLinks, { href: '#', label: '新菜单' }],
    }));
  }

  function removeNav(i: number) {
    setCfg(c => ({ ...c, navLinks: c.navLinks.filter((_, j) => j !== i) }));
  }

  function updateBiz(i: number, patch: Partial<BizBlock>) {
    setCfg(c => ({
      ...c,
      bizBlocks: c.bizBlocks.map((b, j) => (j === i ? { ...b, ...patch } : b)),
    }));
  }

  function updateTrust(i: number, patch: Partial<TrustPoint>) {
    setCfg(c => ({
      ...c,
      trustPoints: c.trustPoints.map((t, j) => (j === i ? { ...t, ...patch } : t)),
    }));
  }

  const tabMeta = SITE_TABS.find(t => t.id === active);

  function renderSitePanel() {
    if (loading) {
      return (
        <div className={`${c.card} mx-auto max-w-3xl`}>
          <p className={`text-sm ${c.sub}`}>加载中…</p>
        </div>
      );
    }

    if (active === 'basic') {
      return (
        <div className={`${c.card} mx-auto max-w-2xl space-y-8`}>
          <p className={`text-sm leading-relaxed ${c.sub}`}>配置主站顶栏、联系邮箱、页脚与备案等基础展示信息。</p>
          <Field label="站点名称" hint="顶栏左侧主标题">
            <input className={c.input} value={cfg.siteName} onChange={e => setCfg({ ...cfg, siteName: e.target.value })} />
          </Field>
          <Field label="顶栏副标题" hint="紧跟站点名称后展示，如「 · 商务主站」">
            <input className={c.input} value={cfg.headerSubtitle} onChange={e => setCfg({ ...cfg, headerSubtitle: e.target.value })} />
          </Field>
          <Field label="商务联系邮箱" hint="首页「商务询价」、邮件按钮、页脚邮箱均使用该地址">
            <input type="email" className={c.input} value={cfg.contactEmail} onChange={e => setCfg({ ...cfg, contactEmail: e.target.value })} />
          </Field>
          <Field label="统计条 · 商务联络文案" hint="首页灰色横条第三列文字">
            <input className={c.input} value={cfg.contactBarLine} onChange={e => setCfg({ ...cfg, contactBarLine: e.target.value })} />
          </Field>
          <Field label="页脚说明（主文案）" hint="页脚左侧第二行灰色小字">
            <textarea className={c.textarea} value={cfg.footerTagline} onChange={e => setCfg({ ...cfg, footerTagline: e.target.value })} rows={3} />
          </Field>
          <Field label="页脚版权旁说明" hint="© 年份 站点名 · 后面的短说明">
            <textarea className={c.textarea} value={cfg.footerNote} onChange={e => setCfg({ ...cfg, footerNote: e.target.value })} rows={2} />
          </Field>
          <Field label="ICP 备案号" hint="留空则不显示备案行">
            <input className={c.input} value={cfg.footerIcpText} onChange={e => setCfg({ ...cfg, footerIcpText: e.target.value })} />
          </Field>
        </div>
      );
    }

    if (active === 'hero') {
      return (
        <div className={`${c.card} mx-auto max-w-2xl space-y-8`}>
          <Field label="默认签名（无 B 站签名时）" hint="首页深色头图区副标题">
            <textarea className={c.textarea} value={cfg.defaultSign} onChange={e => setCfg({ ...cfg, defaultSign: e.target.value })} rows={4} />
          </Field>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="主标题 · 前段">
              <input className={c.input} value={cfg.heroTitlePart1} onChange={e => setCfg({ ...cfg, heroTitlePart1: e.target.value })} />
            </Field>
            <Field label="主标题 · 高亮段" hint="高亮色块内文字">
              <input className={c.input} value={cfg.heroTitleAccent} onChange={e => setCfg({ ...cfg, heroTitleAccent: e.target.value })} />
            </Field>
            <Field label="主标题 · 后段">
              <input className={c.input} value={cfg.heroTitlePart2} onChange={e => setCfg({ ...cfg, heroTitlePart2: e.target.value })} />
            </Field>
          </div>
          <Field label="标签 pill" hint="每行一条">
            <textarea
              className={c.textarea}
              rows={5}
              value={cfg.heroPills.join('\n')}
              onChange={e =>
                setCfg({
                  ...cfg,
                  heroPills: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                })
              }
            />
          </Field>
        </div>
      );
    }

    if (active === 'nav') {
      return (
        <div className={`${c.card} mx-auto max-w-3xl space-y-4`}>
          <p className={`text-sm ${c.sub}`}>锚点链接使用 #xxx 形式，与首页各 section 的 id 对应。</p>
          <div className="space-y-3">
            {cfg.navLinks.map((l, i) => (
              <div
                key={`nav-${i}`}
                className="flex flex-wrap items-end gap-3 rounded-[8px] border border-[#e3e5e7] bg-[#f6f7f8]/80 p-4">
                <div className="min-w-[120px] flex-1">
                  <label className={`mb-1.5 block text-xs font-medium ${c.sub}`}>链接 href</label>
                  <input className={c.input} value={l.href} onChange={e => updateNav(i, { href: e.target.value })} />
                </div>
                <div className="min-w-[120px] flex-1">
                  <label className={`mb-1.5 block text-xs font-medium ${c.sub}`}>显示文字</label>
                  <input className={c.input} value={l.label} onChange={e => updateNav(i, { label: e.target.value })} />
                </div>
                <button
                  type="button"
                  onClick={() => removeNav(i)}
                  className="shrink-0 rounded-md border border-[#ffd6d6] bg-[#fff5f5] px-3 py-2 text-sm text-[#e85a5a] transition hover:bg-[#ffecec]">
                  删除
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addNav}
            className={`rounded-md border border-dashed border-[#c9ccd0] bg-[#fafafa] px-4 py-2.5 text-sm font-medium ${c.link}`}>
            + 添加导航项
          </button>
        </div>
      );
    }

    if (active === 'content') {
      return (
        <div className={`${c.card} mx-auto max-w-2xl space-y-10`}>
          <section className="space-y-4">
            <h3 className={`border-b ${c.line} pb-2 text-sm font-semibold ${c.text}`}>商务合作区块</h3>
            <Field label="区块标题">
              <input className={c.input} value={cfg.bizSectionTitle} onChange={e => setCfg({ ...cfg, bizSectionTitle: e.target.value })} />
            </Field>
            <Field label="区块引言">
              <textarea className={c.textarea} value={cfg.bizSectionIntro} onChange={e => setCfg({ ...cfg, bizSectionIntro: e.target.value })} rows={3} />
            </Field>
            {cfg.bizBlocks.map((b, i) => (
              <div key={`biz-${i}`} className="space-y-3 rounded-[8px] border border-[#e3e5e7] bg-[#f6f7f8]/50 p-4">
                <p className={`text-xs font-semibold ${c.sub}`}>步骤 {b.k}</p>
                <input placeholder="编号/序号" className={c.input} value={b.k} onChange={e => updateBiz(i, { k: e.target.value })} />
                <input placeholder="小标题" className={c.input} value={b.title} onChange={e => updateBiz(i, { title: e.target.value })} />
                <textarea placeholder="正文" className={c.textarea} rows={3} value={b.body} onChange={e => updateBiz(i, { body: e.target.value })} />
              </div>
            ))}
          </section>
          <section className="space-y-4">
            <h3 className={`border-b ${c.line} pb-2 text-sm font-semibold ${c.text}`}>合作说明</h3>
            <Field label="区块标题">
              <input className={c.input} value={cfg.trustSectionTitle} onChange={e => setCfg({ ...cfg, trustSectionTitle: e.target.value })} />
            </Field>
            <Field label="区块引言">
              <textarea className={c.textarea} value={cfg.trustSectionIntro} onChange={e => setCfg({ ...cfg, trustSectionIntro: e.target.value })} rows={3} />
            </Field>
            {cfg.trustPoints.map((t, i) => (
              <div key={i} className="space-y-3 rounded-[8px] border border-[#e3e5e7] bg-[#f6f7f8]/50 p-4">
                <input placeholder="要点标题" className={c.input} value={t.title} onChange={e => updateTrust(i, { title: e.target.value })} />
                <textarea placeholder="要点正文" className={c.textarea} rows={3} value={t.body} onChange={e => updateTrust(i, { body: e.target.value })} />
              </div>
            ))}
          </section>
          <section className="space-y-4">
            <h3 className={`border-b ${c.line} pb-2 text-sm font-semibold ${c.text}`}>精选投稿区</h3>
            <Field label="区块标题">
              <input className={c.input} value={cfg.videosSectionTitle} onChange={e => setCfg({ ...cfg, videosSectionTitle: e.target.value })} />
            </Field>
            <Field label="区块说明">
              <textarea className={c.textarea} value={cfg.videosSectionIntro} onChange={e => setCfg({ ...cfg, videosSectionIntro: e.target.value })} rows={2} />
            </Field>
            <Field label="无稿件时 · 标题">
              <input className={c.input} value={cfg.emptyVideosTitle} onChange={e => setCfg({ ...cfg, emptyVideosTitle: e.target.value })} />
            </Field>
            <Field label="无稿件时 · 说明">
              <textarea className={c.textarea} value={cfg.emptyVideosBody} onChange={e => setCfg({ ...cfg, emptyVideosBody: e.target.value })} rows={2} />
            </Field>
          </section>
        </div>
      );
    }

    return (
      <div className={`${c.card} mx-auto max-w-3xl space-y-4`}>
        <p className={`text-sm ${c.sub}`}>直接编辑 JSON。保存前会做字段校验并与默认配置合并。</p>
        <textarea
          className="h-[min(70vh,560px)] w-full rounded-md border border-[#e3e5e7] bg-[#fafbfc] p-4 font-mono text-sm leading-relaxed text-[#18191c] outline-none focus:border-[#00a1d6] focus:shadow-[0_0_0_2px_rgba(0,161,214,0.12)]"
          spellCheck={false}
          value={jsonDraft}
          onChange={e => setJsonDraft(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-1 flex-col ${c.text}`}>
        <header className={`flex flex-wrap items-center justify-between gap-3 border-b ${c.line} bg-white px-5 py-3.5`}>
          <div>
            <h1 className="text-base font-semibold leading-tight">站点配置</h1>
            <p className={`mt-1 text-xs ${c.sub}`}>
              {tabMeta?.label}
              {tabMeta?.desc ? ` · ${tabMeta.desc}` : ''} — 修改后保存写入 <code className="rounded bg-[#f6f7f8] px-1 text-[11px]">data/site.db</code>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void load()} disabled={loading || saving} className={c.btnGhost}>
              重新加载
            </button>
            <button type="button" onClick={resetDefaults} disabled={loading || saving} className={c.btnWarn}>
              恢复默认
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={loading || saving} className={c.btnPrimary}>
              {saving ? '保存中…' : '保存到数据库'}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* 二级侧栏：站点配置子 Tab */}
          <nav className={`hidden w-[200px] shrink-0 flex-col border-r ${c.line} bg-white py-4 sm:flex`}>
            {SITE_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => goTab(t.id)}
                className={`relative border-l-[3px] py-2.5 pl-4 pr-3 text-left text-sm transition ${c.hover} ${
                  active === t.id
                    ? `border-l-[#fb7299] bg-[#fff5f7]/80 font-medium ${c.activeText}`
                    : `border-l-transparent text-[#61666d]`
                }`}>
                <span className="block leading-snug">{t.label}</span>
                {t.desc ? <span className={`mt-0.5 block text-[11px] font-normal ${active === t.id ? 'text-[#fb7299]/80' : c.sub}`}>{t.desc}</span> : null}
              </button>
            ))}
          </nav>

          {/* 小屏：横向 Tab */}
          <div className={`flex shrink-0 gap-1 overflow-x-auto border-b ${c.line} bg-white px-2 py-2 sm:hidden`}>
            {SITE_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => goTab(t.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  active === t.id ? 'bg-[#fb7299] text-white' : 'bg-[#f6f7f8] text-[#61666d]'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <main className="flex-1 overflow-auto p-5 sm:p-6">
            {message ? (
              <p className="mb-4 rounded-[8px] border border-[#b7eb8f] bg-[#f6ffed] px-3 py-2 text-sm text-[#389e0d]">{message}</p>
            ) : null}
            {error ? (
              <p className="mb-4 rounded-[8px] border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-[#cf1322]">{error}</p>
            ) : null}
            {renderSitePanel()}
          </main>
        </div>
    </div>
  );
}
