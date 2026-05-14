'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

/** 登录成功后的跳转：仅允许站内 /admin 路径，防止开放重定向与路径穿越 */
function safeAdminNext(raw: string | null): string {
  const fallback = '/admin/site';
  if (raw == null || raw === '') return fallback;
  const n = raw.trim();
  if (n === '/admin') return fallback;
  if (!n.startsWith('/admin/')) return fallback;
  if (n.startsWith('/admin/login')) return fallback;
  if (n.includes('..') || n.includes('\\')) return fallback;
  if (/[\n\r\t]/.test(n)) return fallback;
  return n;
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/admin/setup-status', { cache: 'no-store' });
        const j = (await res.json()) as { needsSetup?: boolean };
        if (!cancelled && res.ok) setNeedsSetup(j.needsSetup === true);
      } catch {
        if (!cancelled) setNeedsSetup(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get('username') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }
      const next = safeAdminNext(searchParams.get('next'));
      router.replace(next);
      router.refresh();
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0E14] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
        <h1 className="text-xl font-bold text-white">后台管理</h1>
        <p className="mt-2 text-sm text-white/60">使用在首次部署时创建的管理员账号登录。</p>
        {needsSetup === true ? (
          <div className="mt-4 rounded-lg border border-[#E8B84B]/45 bg-[#E8B84B]/12 px-3 py-3 text-sm leading-relaxed text-amber-50">
            <p>当前库中尚无管理员，请先完成一次性初始化。</p>
            <Link href="/admin/setup" className="mt-2 inline-block font-semibold text-[#E8B84B] hover:underline">
              前往初始化（/admin/setup）→
            </Link>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="mt-8 space-y-4" autoComplete="on">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-white/80">账号</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="初始化时设定的账号"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none ring-[#E8B84B]/40 placeholder:text-white/35 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/80">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none ring-[#E8B84B]/40 focus:ring-2"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#E8B84B] py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50">
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-screen items-center justify-center bg-[#0A0E14] text-white/70">
          加载中…
        </div>
      )}>
      <AdminLoginForm />
    </Suspense>
  );
}
