'use client';

import { useEffect } from 'react';

export default function HostingTodosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin/hosting-todos]', error);
  }, [error]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-[#080a0d] px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#c8aa6e]">上号托管待办</p>
      <h1 className="text-lg font-semibold text-[#ece8df]">页面加载异常</h1>
      <p className="max-w-md text-sm leading-relaxed text-[#9aa5b4]">
        请尝试刷新；若仍失败，可清除浏览器缓存后重试，或换用 Chrome / Edge 最新版访问。
      </p>
      {process.env.NODE_ENV === 'development' ? (
        <pre className="max-w-lg overflow-auto rounded border border-red-900/40 bg-red-950/30 p-3 text-left text-xs text-red-200">
          {error.message}
        </pre>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded border border-[#c8aa6e]/40 bg-[#c8aa6e]/15 px-4 py-2 text-sm font-medium text-[#c8aa6e] hover:bg-[#c8aa6e]/25">
        重试
      </button>
    </div>
  );
}
