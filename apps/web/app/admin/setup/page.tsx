'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';

type Gate = 'loading' | 'redirect-login' | 'status-failed' | 'form';

export default function AdminSetupPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gate, setGate] = useState<Gate>('loading');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/setup-status', { cache: 'no-store' });
        const j = (await res.json()) as { needsSetup?: boolean; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setStatusMessage(j.error || '无法确认初始化状态');
          setGate('status-failed');
          return;
        }
        if (!j.needsSetup) {
          setGate('redirect-login');
          window.location.assign('/admin/login');
          return;
        }
        setGate('form');
      } catch {
        if (!cancelled) {
          setStatusMessage('网络错误');
          setGate('status-failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get('username') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    const passwordConfirm = String(fd.get('passwordConfirm') ?? '');
    try {
      const res = await fetch('/api/admin/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, passwordConfirm }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(data.error || '初始化失败');
        return;
      }
      window.location.assign('/admin/site');
    } catch {
      setFormError('网络错误');
    } finally {
      setLoading(false);
    }
  }

  if (gate === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0E14] text-white/70">
        检查部署状态…
      </div>
    );
  }

  if (gate === 'redirect-login') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0E14] text-white/70">
        已有管理员，正在跳转登录页…
      </div>
    );
  }

  if (gate === 'status-failed') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0A0E14] px-4 text-center">
        <p className="max-w-md text-sm text-red-300">{statusMessage ?? '未知错误'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/10">
          刷新重试
        </button>
        <Link href="/admin/login" className="text-sm text-[#E8B84B] hover:underline">
          前往登录
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0E14] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
        <h1 className="text-xl font-bold text-white">首次部署 · 创建管理员</h1>
        <p className="mt-2 text-sm text-white/60">
          仅在数据库中<strong className="text-[#E8B84B]">尚无管理员</strong>时可提交一次。成功后请妥善保管账号密码；重置需有服务器与数据库文件访问权限。
        </p>
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-xs leading-relaxed text-amber-100/90">
          请确认已在运行环境配置 <code className="text-white/90">ADMIN_SESSION_SECRET</code>（至少 16 位随机字符串），否则无法完成登录态签发。
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4" autoComplete="off">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-white/80">
              管理员账号
            </label>
            <input
              id="username"
              name="username"
              required
              minLength={1}
              maxLength={64}
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none ring-[#E8B84B]/40 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/80">
              密码（至少 6 位）
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none ring-[#E8B84B]/40 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="passwordConfirm" className="block text-sm font-medium text-white/80">
              确认密码
            </label>
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none ring-[#E8B84B]/40 focus:ring-2"
            />
          </div>
          {formError ? <p className="text-sm text-red-400">{formError}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#E8B84B] py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50">
            {loading ? '创建中…' : '创建并进入后台'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-white/50">
          已有账号？{' '}
          <Link href="/admin/login" className="text-[#E8B84B] hover:underline">
            前往登录
          </Link>
        </p>
      </div>
    </div>
  );
}
