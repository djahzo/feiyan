'use client';

import { useCallback, useEffect, useState } from 'react';
import { c } from '@/components/admin/admin-theme';
import { fetchAdminCaptainsList } from '@/lib/admin-captains-list';
import type { CaptainApiDto } from '@/lib/captain-dto';
import { avatarLabelFromNote, captainAvatarImgReferrerPolicy, captainAvatarImgSrc } from '@/lib/captain-avatar-placeholder';
import { NOTE_MAX_LEN, SHIP_TIER_LABEL, SHIP_TIERS, CONTACT_REMARK_MAX_LEN, type ShipTier } from '@/lib/captain-ship';
import { validateContactRemark } from '@/lib/captain-parse';

type CaptainDto = CaptainApiDto;

function formatTime(ts: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return '—';
  }
}

function formatDateTime(ts: number | null) {
  if (ts == null || !Number.isFinite(ts)) return '—';
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function msToDatetimeLocalValue(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromDatetimeLocalValue(s: string): number | null {
  const t = s.trim() ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : null;
}

export default function CaptainManager() {
  const [rows, setRows] = useState<CaptainDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uid, setUid] = useState('');
  const [idName, setIdName] = useState('');
  const [remarkName, setRemarkName] = useState('');
  const [note, setNote] = useState('');
  const [shipTier, setShipTier] = useState<ShipTier | ''>('');
  const [shippedAtLocal, setShippedAtLocal] = useState('');
  const [wechatRemark, setWechatRemark] = useState('');
  const [gameIdRemark, setGameIdRemark] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [syncHint, setSyncHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchAdminCaptainsList();
      if (!r.ok) {
        setError(r.error);
        setRows([]);
        return;
      }
      setRows(r.data);
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
    setUid('');
    setIdName('');
    setRemarkName('');
    setNote('');
    setShipTier('');
    setShippedAtLocal('');
    setWechatRemark('');
    setGameIdRemark('');
    setFile(null);
    setError(null);
    setDrawerOpen(true);
  }

  function openEdit(row: CaptainDto) {
    setEditingId(row.id);
    setUid(row.uid);
    setIdName(row.idName ?? '');
    setRemarkName(row.remarkName ?? '');
    setNote(row.note ?? '');
    setWechatRemark(row.wechatRemark ?? '');
    setGameIdRemark(row.gameIdRemark ?? '');
    setShipTier((row.shipTier as ShipTier) || '');
    setShippedAtLocal(msToDatetimeLocalValue(row.shippedAt));
    setFile(null);
    setError(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (busy) return;
    setDrawerOpen(false);
  }

  async function uploadAvatar(captainId: number, f: File) {
    const fd = new FormData();
    fd.set('file', f);
    const res = await fetch(`/api/admin/captains/${captainId}/avatar`, { method: 'POST', body: fd });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(body.error || '头像上传失败');
  }

  function buildPayload():
    | { error: string }
    | {
        body: {
          uid: string;
          idName: string | null;
          remarkName: string | null;
          note: string | null;
          wechatRemark: string | null;
          gameIdRemark: string | null;
          shipTier: ShipTier | null;
          shippedAt: number | null;
        };
      } {
    const uidTrim = uid.trim();
    const shippedMs = fromDatetimeLocalValue(shippedAtLocal);
    const tier = shipTier === '' ? null : shipTier;
    if (shippedMs != null && tier == null) {
      return { error: '已填写上舰时间时，请选择上舰类型（舰长 / 提督 / 总督）' };
    }
    if (note.length > NOTE_MAX_LEN) {
      return { error: `备注不能超过 ${NOTE_MAX_LEN} 字` };
    }
    const wxRes = validateContactRemark(wechatRemark, '微信备注');
    if (!wxRes.ok) return { error: wxRes.error };
    const gidRes = validateContactRemark(gameIdRemark, '游戏 ID 备注');
    if (!gidRes.ok) return { error: gidRes.error };
    return {
      body: {
        uid: uidTrim,
        idName: idName.trim() || null,
        remarkName: remarkName.trim() || null,
        note: note.trim() === '' ? null : note.trim(),
        wechatRemark: wxRes.value,
        gameIdRemark: gidRes.value,
        shipTier: tier,
        shippedAt: shippedMs,
      },
    };
  }

  async function submit() {
    const uidTrim = uid.trim();
    if (!uidTrim) {
      setError('请填写 uid');
      return;
    }
    const built = buildPayload();
    if ('error' in built) {
      setError(built.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editingId == null) {
        const res = await fetch('/api/admin/captains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(built.body),
        });
        const body = (await res.json()) as { error?: string; data?: { id: number } };
        if (!res.ok) throw new Error(body.error || '创建失败');
        const newId = body.data?.id;
        if (newId != null && file) await uploadAvatar(newId, file);
        setToast('已添加舰长');
      } else {
        const res = await fetch(`/api/admin/captains/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(built.body),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error || '保存失败');
        if (file) await uploadAvatar(editingId, file);
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

  async function pullFromBilibiliGuard() {
    if (
      !window.confirm(
        '从 B 站拉取「大航海总榜」并写入数据库？\n\n· 新 uid：新增一行，昵称与档位来自榜单，上舰时间留空（需你后补才能算到期）。\n· 已有 uid：只更新 B 站昵称与档位，不覆盖备注、微信/游戏备注、上舰时间、头像。',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setSyncHint(null);
    try {
      const res = await fetch('/api/admin/captains/sync-bilibili-guard', { method: 'POST', credentials: 'include' });
      const body = (await res.json()) as {
        error?: string;
        data?: { created: number; updated: number; skippedNoTier: number; fetchedCount: number; hint: string };
      };
      if (!res.ok) throw new Error(body.error || '拉取失败');
      const d = body.data;
      if (!d) throw new Error('无返回数据');
      const skipPart = d.skippedNoTier > 0 ? `，跳过无档位 ${d.skippedNoTier} 条` : '';
      setToast(`拉取完成：新增 ${d.created}，更新 ${d.updated}，榜单共 ${d.fetchedCount} 人${skipPart}`);
      setSyncHint(d.hint);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '拉取失败');
    } finally {
      setBusy(false);
    }
  }

  async function clearAvatar() {
    if (editingId == null) return;
    if (!window.confirm('确定清除该舰长的头像？')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/captains/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAvatar: true }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || '清除失败');
      setFile(null);
      setToast('已清除头像');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(id: number) {
    if (!window.confirm('确定删除该舰长记录？头像文件会一并删除。')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/captains/${id}`, { method: 'DELETE' });
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

  function expireCell(r: CaptainDto) {
    if (r.expiresAt == null) return <span className={c.sub}>—</span>;
    const line = formatDateTime(r.expiresAt);
    if (r.expireStatus === 'expired') {
      return (
        <div className="space-y-1">
          <p className="text-xs text-[#222]">{line}</p>
          <span className="inline-block rounded bg-[#fff2f0] px-1.5 py-0.5 text-[11px] font-medium text-[#cf1322]">已过期</span>
        </div>
      );
    }
    const d = r.daysRemaining;
    return (
      <div className="space-y-1">
        <p className="text-xs text-[#222]">{line}</p>
        <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${d != null && d <= 7 ? 'bg-[#fff7e6] text-[#d46b08]' : 'bg-[#f6ffed] text-[#389e0d]'}`}>
          剩余 {d ?? '—'} 天
        </span>
      </div>
    );
  }

  const colCount = 12;

  return (
    <div className={`flex h-full min-h-0 flex-1 flex-col ${c.text}`}>
      <header className={`flex flex-wrap items-center justify-between gap-3 border-b ${c.line} bg-white px-5 py-3.5`}>
        <div>
          <h1 className="text-base font-semibold leading-tight">舰长管理</h1>
          <p className={`mt-1 text-xs ${c.sub}`}>
            无头像时占位取备注前二字或首个英文词。本地上传优先；「从 B 站拉取大航海」会写入 B 站头像用于列表展示。到期仍依赖你填的上舰时间，接口无精确到期。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void pullFromBilibiliGuard()} disabled={loading || busy} className={c.btnGhost}>
            从 B 站拉取大航海
          </button>
          <button type="button" onClick={() => void load()} disabled={loading || busy} className={c.btnGhost}>
            刷新
          </button>
          <button type="button" onClick={openCreate} disabled={busy} className={c.btnPrimary}>
            新增舰长
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-5 sm:p-6">
        {syncHint ? (
          <p className={`mb-4 rounded-[8px] border border-[#e3e5e7] bg-[#f6f7f8] px-3 py-2 text-xs leading-relaxed text-[#61666d]`}>{syncHint}</p>
        ) : null}
        {toast ? (
          <p className="mb-4 rounded-[8px] border border-[#b7eb8f] bg-[#f6ffed] px-3 py-2 text-sm text-[#389e0d]">{toast}</p>
        ) : null}
        {error && !drawerOpen ? (
          <p className="mb-4 rounded-[8px] border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-[#cf1322]">{error}</p>
        ) : null}

        <div className={`overflow-hidden rounded-[10px] border ${c.line} bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]`}>
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className={`border-b ${c.line} bg-[#fafafa] text-[#61666d]`}>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">头像</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">uid</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">ID 名称</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">备注名称</th>
                  <th className="max-w-[100px] px-3 py-3 font-medium">微信备注</th>
                  <th className="max-w-[100px] px-3 py-3 font-medium">游戏 ID</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">类型</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">上舰时间</th>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">到期</th>
                  <th className="min-w-[120px] px-3 py-3 font-medium">备注</th>
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
                      暂无舰长，点击右上角「新增舰长」添加
                    </td>
                  </tr>
                ) : (
                  rows.map(r => (
                    <tr key={r.id} className={`border-b ${c.line} last:border-0 ${c.hover}`}>
                      <td className="px-3 py-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#e3e5e7] bg-[#f6f7f8]">
                          {r.avatarUrl ? (
                            <img
                              src={captainAvatarImgSrc(r.avatarUrl, r.updatedAt)}
                              alt=""
                              referrerPolicy={captainAvatarImgReferrerPolicy(r.avatarUrl)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (() => {
                              const label = avatarLabelFromNote(r.note);
                              return label ? (
                                <span className="select-none px-0.5 text-center text-[11px] font-semibold leading-tight text-[#61666d]" title={r.note ?? ''}>
                                  {label}
                                </span>
                              ) : (
                                <span className={`text-[10px] ${c.sub}`}>无</span>
                              );
                            })()
                          )}
                        </div>
                      </td>
                      <td className={`px-3 py-3 font-mono text-[13px] ${c.text}`}>{r.uid}</td>
                      <td className={`max-w-[100px] truncate px-3 py-3 ${r.idName ? c.text : c.sub}`}>{r.idName || '—'}</td>
                      <td className={`max-w-[100px] truncate px-3 py-3 ${r.remarkName ? c.text : c.sub}`}>{r.remarkName || '—'}</td>
                      <td className={`max-w-[100px] truncate px-3 py-3 text-xs ${r.wechatRemark ? c.text : c.sub}`} title={r.wechatRemark ?? ''}>
                        {r.wechatRemark || '—'}
                      </td>
                      <td className={`max-w-[100px] truncate px-3 py-3 text-xs ${r.gameIdRemark ? c.text : c.sub}`} title={r.gameIdRemark ?? ''}>
                        {r.gameIdRemark || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {r.shipTierLabel ? (
                          <span className="rounded-md bg-[#fff5f7] px-2 py-0.5 text-xs font-medium text-[#fb7299]">{r.shipTierLabel}</span>
                        ) : (
                          <span className={c.sub}>—</span>
                        )}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-3 text-xs ${c.sub}`}>{formatDateTime(r.shippedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-3">{expireCell(r)}</td>
                      <td className={`max-w-[160px] px-3 py-3 text-xs ${r.note ? c.text : c.sub}`}>
                        {r.note ? (
                          <span className="line-clamp-2" title={r.note}>
                            {r.note}
                          </span>
                        ) : (
                          '—'
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
              <h2 className="text-base font-semibold">{editingId == null ? '新增舰长' : '编辑舰长'}</h2>
              <button type="button" className={`rounded-md px-2 py-1 text-sm ${c.sub} ${c.hover}`} onClick={closeDrawer} disabled={busy}>
                关闭
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {error ? <p className="rounded-[8px] border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-[#cf1322]">{error}</p> : null}

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>
                  uid <span className="text-[#e85a5a]">*</span>
                </label>
                <input className={c.input} value={uid} onChange={e => setUid(e.target.value)} placeholder="B 站用户 mid / uid" disabled={busy} />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>ID 名称</label>
                <p className={`text-xs ${c.sub}`}>可选</p>
                <input className={c.input} value={idName} onChange={e => setIdName(e.target.value)} placeholder="留空亦可" disabled={busy} />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>备注名称</label>
                <input className={c.input} value={remarkName} onChange={e => setRemarkName(e.target.value)} placeholder="简短称呼" disabled={busy} />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <label className={`text-sm font-medium ${c.text}`}>微信备注</label>
                  <span className={`text-xs ${wechatRemark.length > CONTACT_REMARK_MAX_LEN ? 'text-[#cf1322]' : c.sub}`}>
                    {wechatRemark.length}/{CONTACT_REMARK_MAX_LEN}
                  </span>
                </div>
                <input
                  className={c.input}
                  value={wechatRemark}
                  maxLength={CONTACT_REMARK_MAX_LEN}
                  onChange={e => setWechatRemark(e.target.value)}
                  placeholder="微信号或联系用备注"
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <label className={`text-sm font-medium ${c.text}`}>游戏 ID 备注</label>
                  <span className={`text-xs ${gameIdRemark.length > CONTACT_REMARK_MAX_LEN ? 'text-[#cf1322]' : c.sub}`}>
                    {gameIdRemark.length}/{CONTACT_REMARK_MAX_LEN}
                  </span>
                </div>
                <input
                  className={c.input}
                  value={gameIdRemark}
                  maxLength={CONTACT_REMARK_MAX_LEN}
                  onChange={e => setGameIdRemark(e.target.value)}
                  placeholder="游戏内 ID、区服等"
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>上舰类型</label>
                <p className={`text-xs ${c.sub}`}>与 B 站大航海档位一致；填写上舰时间后必选</p>
                <select
                  className={c.input}
                  value={shipTier}
                  onChange={e => setShipTier(e.target.value as ShipTier | '')}
                  disabled={busy}>
                  <option value="">未填写</option>
                  {SHIP_TIERS.map(t => (
                    <option key={t} value={t}>
                      {SHIP_TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>上舰时间</label>
                <p className={`text-xs ${c.sub}`}>本次开通/续费的起算时间，用于计算到期</p>
                <input
                  type="datetime-local"
                  className={c.input}
                  value={shippedAtLocal}
                  onChange={e => setShippedAtLocal(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <label className={`text-sm font-medium ${c.text}`}>备注</label>
                  <span className={`text-xs ${note.length > NOTE_MAX_LEN ? 'text-[#cf1322]' : c.sub}`}>
                    {note.length}/{NOTE_MAX_LEN}
                  </span>
                </div>
                <textarea
                  className={c.textarea}
                  rows={5}
                  value={note}
                  maxLength={NOTE_MAX_LEN}
                  onChange={e => setNote(e.target.value)}
                  placeholder={`最多 ${NOTE_MAX_LEN} 字`}
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${c.text}`}>头像图片</label>
                <p className={`text-xs ${c.sub}`}>支持 jpg / png / webp / gif，最大 4MB</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="text-sm text-[#61666d] file:mr-3 file:rounded-md file:border file:border-[#e3e5e7] file:bg-[#f6f7f8] file:px-3 file:py-2 file:text-sm"
                  disabled={busy}
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {editingId != null ? (
                <button type="button" className={`text-sm ${c.link}`} disabled={busy} onClick={() => void clearAvatar()}>
                  清除已有头像
                </button>
              ) : null}
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
