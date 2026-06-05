'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { c } from '@/components/admin/admin-theme';

function IconSite() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 6h16M4 12h10M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function IconShip() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 18h18l-2-8H5L3 18zM5 10V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9v9M8 15h8" strokeLinecap="round" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9V8a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v1" strokeLinecap="round" />
      <path d="M12 12v3" strokeLinecap="round" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" strokeLinecap="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 17V9M13 17v-4M8 17v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function navBtn(active: boolean) {
  return active
    ? `flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm ${c.activeBar} ${c.activeBg} font-medium ${c.activeText}`
    : `flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-[#61666d] ${c.hover}`;
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const siteActive = pathname === '/admin' || pathname === '/admin/site';
  const captainActive = pathname?.startsWith('/admin/captains') ?? false;
  const hostingActive = pathname?.startsWith('/admin/hosting-todos') ?? false;
  const casesActive = pathname?.startsWith('/admin/cooperation-cases') ?? false;
  const analyticsActive = pathname?.startsWith('/admin/analytics') ?? false;
  const schedulingConfigActive = pathname?.startsWith('/admin/scheduling-config') ?? false;

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  return (
    <div className={`flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden ${c.page} ${c.text}`}>
      <aside className={`flex w-[220px] shrink-0 flex-col overflow-y-auto border-r ${c.line} ${c.side}`}>
        <div className={`border-b ${c.line} px-4 py-5`}>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#fb7299] text-sm font-bold text-white">管</span>
            <div>
              <p className="text-[13px] font-semibold leading-tight">管理后台</p>
              <p className={`mt-0.5 text-[11px] ${c.sub}`}>斐延 · 控制台</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          <p className={`px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider ${c.sub}`}>功能</p>
          <Link href="/admin/site" className={navBtn(siteActive)}>
            <IconSite />
            <span>站点配置</span>
          </Link>
          <Link href="/admin/captains" className={navBtn(captainActive)}>
            <IconShip />
            <span>舰长管理</span>
          </Link>
          <Link href="/admin/hosting-todos" className={navBtn(hostingActive)}>
            <IconClipboard />
            <span>上号托管待办</span>
          </Link>
          <Link href="/admin/cooperation-cases" className={navBtn(casesActive)}>
            <IconBriefcase />
            <span>合作案例</span>
          </Link>

          <p className={`px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider ${c.sub}`}>数据与策略</p>
          <Link href="/admin/analytics" className={navBtn(analyticsActive)}>
            <IconChart />
            <span>数据分析</span>
          </Link>
          <Link href="/admin/scheduling-config" className={navBtn(schedulingConfigActive)}>
            <IconSliders />
            <span>排期权重配置</span>
          </Link>

          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm opacity-50">
            <IconSpark />
            <span>更多功能</span>
            <span className="ml-auto rounded bg-[#f6f7f8] px-1.5 py-0.5 text-[10px] text-[#9499a0]">敬请期待</span>
          </button>
        </nav>

        <div className={`border-t ${c.line} p-3`}>
          <Link href="/" className={`block rounded-md px-2 py-2 text-sm ${c.link} ${c.hover}`}>
            查看首页
          </Link>
          <button type="button" onClick={() => void logout()} className={`mt-0.5 w-full rounded-md px-2 py-2 text-left text-sm text-[#61666d] ${c.hover}`}>
            退出登录
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
