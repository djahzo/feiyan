'use client';

import { useCallback, useEffect, useState } from 'react';
import { c } from '@/components/admin/admin-theme';

export type CooperationCaseDto = {
  id: number;
  title: string;
  brandName: string | null;
  summary: string | null;
  detailUrl: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

function formatTime(ts: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return '—';
  }
}

export default function CooperationCaseManager() {
  const [rows, setRows] = useState<CooperationCaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [brandName, setBrandName] = useState('');
  const [summary, setSummary] = useState('');
  const [detailUrl, setDetailUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/cooperation-cases', { credentials: 'include' });
      const body = (await res.json()) as { error?: string; data?: CooperationCaseDto[] };
      if (!res.ok) {
        setError(body.error || '加载失败');
        setRows([]);
        return;
      }
      setRows(body.data ?? []);
    } catch {
      setError('网络错误');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  function openCreate() {
    setEditingId(null);
    setTitle('');
    setBrandName('');
    setSummary('');
    setDetailUrl('');
    setSortOrder('');
    setError(null);
    setDrawerOpen(true);
  }

  function openEdit(row: CooperationCaseDto) {
    setEditingId(row.id);
    setTitle(row.title);
    setBrandName(row.brandName ?? '');
    setSummary(row.summary ?? '');
    setDetailUrl(row.detailUrl ?? '');
    setSortOrder(String(row.sortOrder ?? 0));
    setError(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (busy) return;
    setDrawerOpen(false);
  }

  async function submit() {
    const titleTrim = title.trim();
    if (!titleTrim) {
      setError('请填写案例标题');
      return;
    }
    const sortNum = Number(sortOrder);
    const payload: Record<string, unknown> = {
      title: titleTrim,
      brandName: brandName.trim() || null,
      summary: summary.trim() || null,
      detailUrl: detailUrl.trim() || null,
    };
    if (editingId != null) {
      payload.sortOrder = Number.isFinite(sortNum) ? Math.trunc(sortNum) : 0;
    } else if (sortOrder.trim() !== '') {
      if (Number.isFinite(sortNum)) payload.sortOrder = Math.trunc(sortNum);
    }

    setBusy(true);
    setError(null);
    try {
      if (editingId == null) {
        const res = await fetch('/api/admin/cooperation-cases', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error || '创建失败');
        setToast('已新增案例');
      } else {
        const res = await fetch(`/api/admin/cooperation-cases/${editingId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error || '保存失败');
        setToast('已保存');
      }
      setDrawerOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(id: number) {
    if (!window.confirm('确定删除该合作案例？')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cooperation-cases/${id}`, { method: 'DELETE', credentials: 'include' });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || '删除失败');
      setToast('已删除');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  const colCount = 7;

  return (
    <div className={`flex h-full min-h-0 flex-1 flex-col ${c.text}`}>
      <header className={`flex flex-wrap items-center justify-between gap-3 border-b ${c.line} bg-white px-5 py-3.5`}>
        <div>
          <h1 className="text-base font-semibold leading-tight">合作案例</h1>
          <p className={`mt-1 text-xs ${c.sub}`}>维护对外展示的合作案例条目；排序号越小越靠前，新案例默认排在末尾。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void load()} disabled={loading || busy} className={c.btnGhost}>
            刷新
          </button>
          <button type="button" onClick={openCreate} disabled={busy} className={c.btnPrimary}>
            新增案例
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-5 sm:p-6">
        {toast ? (
          <p className="mb-4 rounded-[8px] border border-[#b7eb8f] bg-[#f6ffed] px-3 py-2 text-sm text-[#389e0d]">{toast}</p>
        ) : null}
        {error && !drawerOpen ? (
          <p className="mb-4 rounded-[8px] border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-[#cf1322]">{error}</p>
        ) : null}

        <div className={`overflow-hidden rounded-[10px] border ${c.line} bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]`}>
          <div className="overflow-x-auto">
            <table className="min-w-[880px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className={`border-b ${c.line} bg-[#fafafa] text-[#61666d]`}>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">排序</th>
                  <th className="min-w-[140px] px-3 py-3 font-medium">标题</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">品牌 / 甲方</th>
                  <th className="min-w-[200px] px-3 py-3 font-medium">摘要</th>
                  <th className="min-w-[120px] px-3 py-3 font-medium">详情链接</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">更新</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={colCount} className={`px-4 py-10 text-center ${c.sub}`}>
                      加载中…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className={`px-4 py-10 text-center ${c.sub}`}>
                      暂无案例，点击「新增案例」添加
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className={`border-b ${c.line} last:border-0 ${c.hover}`}>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px]">{r.sortOrder}</td>
                      <td className={`max-w-[220px] px-3 py-3 font-medium ${c.text}`}>
                        <span className="line-clamp-2" title={r.title}>
                          {r.title}
                        </span>
                      </td>
                      <td className={`max-w-[140px] truncate px-3 py-3 ${r.brandName ? c.text : c.sub}`}>{r.brandName || '—'}</td>
                      <td className={`max-w-[280px] px-3 py-3 text-xs ${r.summary ? c.text : c.sub}`}>
                        {r.summary ? (
                          <span className="line-clamp-2" title={r.summary}>
                            {r.summary}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="max-w-[200px] px-3 py-3">
                        {r.detailUrl ? (
                          <a href={r.detailUrl} target="_blank" rel="noopener noreferrer" className={`line-clamp-1 break-all text-xs ${c.link}`}>
                            {r.detailUrl}
                          </a>
                        ) : (
                          <span className={c.sub}>—</span>
                        )}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-3 text-xs ${c.sub}`}>{formatTime(r.updatedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <button type="button" className={`mr-2 text-sm ${c.link}`} onClick={() => openEdit(r)} disabled={busy}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="text-sm text-[#e85a5a] hover:underline disabled:opacity-50"
                          onClick={() => void removeRow(r.id)}
                          disabled={busy}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/35" aria-label="关闭" onClick={closeDrawer} />
          <div
            className={`relative flex h-full w-full max-w-md flex-col border-l ${c.line} bg-white shadow-2xl`}
            role="dialog"
            aria-modal="true">
            <div className={`flex items-center justify-between border-b ${c.line} px-5 py-4`}>
              <h2 className="text-base font-semibold">{editingId == null ? '新增合作案例' : '编辑合作案例'}</h2>
              <button type="button" className={`rounded-md px-2 py-1 text-sm ${c.sub} ${c.hover}`} onClick={closeDrawer} disabled={busy}>
                关闭
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {error ? <p className="rounded-[8px] border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-[#cf1322]">{error}</p> : null}

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>
                  案例标题 <span className="text-[#e85a5a]">*</span>
                </label>
                <input className={c.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：某品牌 × 斐延 定制短片" disabled={busy} />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>品牌 / 甲方</label>
                <input className={c.input} value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="可选" disabled={busy} />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>摘要</label>
                <textarea
                  className={c.textarea}
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="合作形式、亮点一句话概括等"
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>详情链接</label>
                <p className={`text-xs ${c.sub}`}>可选，需以 http:// 或 https:// 开头</p>
                <input className={c.input} value={detailUrl} onChange={(e) => setDetailUrl(e.target.value)} placeholder="https://..." disabled={busy} />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>排序号</label>
                <p className={`text-xs ${c.sub}`}>
                  {editingId == null ? '新建时留空则自动排在列表末尾。' : null}
                  数字越小越靠前。
                </p>
                <input
                  className={c.input}
                  type="number"
                  inputMode="numeric"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  placeholder={editingId == null ? '留空自动排序' : undefined}
                  disabled={busy}
                />
              </div>
            </div>

            <div className={`flex justify-end gap-2 border-t ${c.line} px-5 py-4`}>
              <button type="button" className={c.btnGhost} onClick={closeDrawer} disabled={busy}>
                取消
              </button>
              <button type="button" className={c.btnPrimary} onClick={() => void submit()} disabled={busy}>
                {busy ? '提交中…' : editingId == null ? '创建' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
