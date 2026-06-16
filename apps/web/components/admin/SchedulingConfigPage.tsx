'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SchedulingRotationConfig, CaptainRotationStatus } from '@/lib/scheduling-rotation';
import type { DaySchedule } from '@/lib/scheduling-calendar';

const DEFAULT_CONFIG: SchedulingRotationConfig = {
  enabled: true,
  dailySlots: 2,
  excludeScheduledThisWeek: false,
  excludeScheduledThisMonth: false,
  excludeExpired: false,
};

export default function SchedulingConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [config, setConfig] = useState<SchedulingRotationConfig>(DEFAULT_CONFIG);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDays, setPreviewDays] = useState(14);
  const [calendar, setCalendar] = useState<DaySchedule[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'all' | 'day' | 'week'>('all');
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scheduling-config');
      if (!res.ok) throw new Error('加载失败');
      const json = await res.json();
      setConfig(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCalendar = useCallback(async (days: number) => {
    try {
      const res = await fetch(`/api/admin/schedule-calendar?days=${days}`);
      if (!res.ok) throw new Error('加载失败');
      const json = await res.json();
      setCalendar(json.data || []);
    } catch (err) {
      console.error('加载日历失败', err);
      setCalendar([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (showPreview) void loadCalendar(previewDays);
  }, [showPreview, previewDays, loadCalendar]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scheduling-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || '保存失败');
      }
      setToast('保存成功');
      if (showPreview) void loadCalendar(previewDays);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (calendar.length === 0) return;

    let itemsToImport: Array<{ date: string; roleName: string }> = [];

    if (importMode === 'all') {
      itemsToImport = calendar.flatMap((day) =>
        day.recommendations.map((cap) => ({ date: day.date, roleName: cap.displayName })),
      );
    } else if (importMode === 'week') {
      const firstWeek = calendar.slice(0, 7);
      itemsToImport = firstWeek.flatMap((day) =>
        day.recommendations.map((cap) => ({ date: day.date, roleName: cap.displayName })),
      );
    } else if (importMode === 'day') {
      itemsToImport = calendar
        .filter((day) => selectedDays.has(day.date))
        .flatMap((day) => day.recommendations.map((cap) => ({ date: day.date, roleName: cap.displayName })));
    }

    if (itemsToImport.length === 0) {
      setError('没有选中任何待导入的排班');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/hosting-todos/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToImport, skipConflicts: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '导入失败');
      setToast(json.message || '导入成功');
      setShowPreview(false);
      setSelectedDays(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const toggleDaySelection = (date: string) => {
    const newSet = new Set(selectedDays);
    if (newSet.has(date)) {
      newSet.delete(date);
    } else {
      newSet.add(date);
    }
    setSelectedDays(newSet);
  };

  if (loading) {
    return <div className="p-6 text-center text-[#9499a0]">加载中...</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 头部 */}
      <header className="border-b border-[#e3e5e7] bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-[#18191c]">托管排期设置</h1>
        <p className="mt-1 text-sm text-[#9499a0]">
          轮值队列模型：按「需求债务（应得 - 已得）」公平轮换，距上次托管时间作为 tiebreaker
        </p>
      </header>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto bg-[#f6f7f8] p-6">
        {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>}
        {toast && (
          <div className="fixed right-6 top-6 z-50 rounded-md bg-green-500 px-4 py-2 text-white shadow-lg">
            {toast}
          </div>
        )}

        {/* 模型说明 */}
        <div className="mb-6 max-w-4xl rounded-[10px] border border-[#e3e5e7] bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-[#18191c]">📐 排序原理</h3>
          <div className="mt-3 space-y-2 text-sm text-[#61666d]">
            <p>
              <strong className="text-[#fb7299]">主键：需求债务</strong> ={' '}
              <code className="rounded bg-[#f6f7f8] px-1.5 py-0.5 font-mono text-xs">
                (每日名额 / 舰长总数) × 加入天数 - 已托管次数
              </code>
            </p>
            <p className="text-xs text-[#9499a0]">
              正值 = 系统欠这位舰长的轮值次数；负值 = 已超额托管。债务最高的优先推荐。
            </p>
            <p className="text-xs text-[#9499a0]">
              Tiebreaker：当债务相等时，距上次托管天数长的优先。
            </p>
          </div>
        </div>

        {/* 总开关 */}
        <section className="mb-6 max-w-4xl rounded-[10px] border border-[#e3e5e7] bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-[#18191c]">⚙️ 总开关</h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#61666d]">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="h-4 w-4 cursor-pointer"
            />
            <span>启用智能排期（关闭后需完全手动排班）</span>
          </label>
        </section>

        {/* 核心参数 */}
        <section className="mb-6 max-w-4xl rounded-[10px] border border-[#e3e5e7] bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-[#18191c]">📊 轮值参数</h2>
          <p className="mb-4 text-xs text-[#9499a0]">
            债务公式中的「每日名额」，影响每位舰长的理论应得轮值次数
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#61666d]">每日排班名额</label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.dailySlots}
              onChange={(e) => setConfig({ ...config, dailySlots: parseInt(e.target.value, 10) || 1 })}
              className="w-full max-w-xs rounded-md border border-[#e3e5e7] bg-white px-3 py-2 text-sm text-[#18191c] outline-none transition focus:border-[#00a1d6] focus:shadow-[0_0_0_2px_rgba(0,161,214,0.12)]"
            />
            <p className="text-xs text-[#9499a0]">范围 1-10，推荐 2-3</p>
          </div>
        </section>

        {/* 硬过滤规则 */}
        <section className="mb-6 max-w-4xl rounded-[10px] border border-[#e3e5e7] bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-[#18191c]">🚫 排除规则</h2>
          <p className="mb-4 text-xs text-[#9499a0]">满足任一条件的舰长直接剔除，不参与排序</p>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#61666d]">
              <input
                type="checkbox"
                checked={config.excludeScheduledThisWeek}
                onChange={(e) => setConfig({ ...config, excludeScheduledThisWeek: e.target.checked })}
                className="h-4 w-4 cursor-pointer"
              />
              <span>排除本周已排过的舰长</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#61666d]">
              <input
                type="checkbox"
                checked={config.excludeScheduledThisMonth}
                onChange={(e) => setConfig({ ...config, excludeScheduledThisMonth: e.target.checked })}
                className="h-4 w-4 cursor-pointer"
              />
              <span>排除本月已排过的舰长</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#61666d]">
              <input
                type="checkbox"
                checked={config.excludeExpired}
                onChange={(e) => setConfig({ ...config, excludeExpired: e.target.checked })}
                className="h-4 w-4 cursor-pointer"
              />
              <span>排除已过期舰长</span>
            </label>
          </div>
        </section>

        {/* 操作按钮 */}
        <div className="mb-6 flex max-w-4xl gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#fb7299] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#ff7ba3] disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="rounded-md border border-[#e3e5e7] bg-white px-4 py-2 text-sm font-medium text-[#61666d] transition hover:border-[#c9ccd0] hover:bg-[#f6f7f8]"
          >
            {showPreview ? '隐藏预览' : '预览排班日历'}
          </button>
        </div>

        {/* 预览日历 */}
        {showPreview && (
          <section className="max-w-6xl rounded-[10px] border border-[#e3e5e7] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#18191c]">📅 未来排班日历</h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-[#61666d]">
                  <span>预览天数:</span>
                  <input
                    type="number"
                    min={7}
                    max={30}
                    value={previewDays}
                    onChange={(e) => setPreviewDays(parseInt(e.target.value, 10) || 14)}
                    className="w-20 rounded border border-[#e3e5e7] px-2 py-1 text-sm"
                  />
                </label>
              </div>
            </div>

            {calendar.length === 0 ? (
              <p className="text-sm text-[#9499a0]">无推荐排班</p>
            ) : (
              <>
                <div className="mb-4 space-y-3">
                  {calendar.map((day) => (
                    <div
                      key={day.date}
                      className={`rounded-md border p-3 transition ${
                        selectedDays.has(day.date)
                          ? 'border-[#fb7299] bg-[#fff5f7]'
                          : 'border-[#e3e5e7] bg-white'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedDays.has(day.date)}
                            onChange={() => toggleDaySelection(day.date)}
                            className="h-4 w-4 cursor-pointer"
                          />
                          <div>
                            <span className="text-sm font-semibold text-[#18191c]">{day.date}</span>
                            <span className="ml-2 text-xs text-[#9499a0]">{day.dayOfWeek}</span>
                          </div>
                        </div>
                        <span className="text-xs text-[#9499a0]">
                          {day.recommendations.length} 人
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {day.recommendations.map((cap) => (
                          <div
                            key={cap.captainId}
                            className="rounded bg-[#f6f7f8] px-3 py-1.5 text-sm"
                          >
                            <span className="font-medium text-[#18191c]">{cap.displayName}</span>
                            <span className="ml-2 text-xs text-[#9499a0]">
                              债务 {cap.demandDebt > 0 ? '+' : ''}
                              {cap.demandDebt.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 导入操作 */}
                <div className="border-t border-[#e3e5e7] pt-4">
                  <div className="mb-3 flex items-center gap-4">
                    <span className="text-sm font-medium text-[#61666d]">导入范围:</span>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#61666d]">
                      <input
                        type="radio"
                        name="importMode"
                        value="all"
                        checked={importMode === 'all'}
                        onChange={() => setImportMode('all')}
                      />
                      <span>全部 ({calendar.length} 天)</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#61666d]">
                      <input
                        type="radio"
                        name="importMode"
                        value="week"
                        checked={importMode === 'week'}
                        onChange={() => setImportMode('week')}
                      />
                      <span>第一周 (7 天)</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#61666d]">
                      <input
                        type="radio"
                        name="importMode"
                        value="day"
                        checked={importMode === 'day'}
                        onChange={() => setImportMode('day')}
                      />
                      <span>选中的日期 ({selectedDays.size} 天)</span>
                    </label>
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="rounded-md bg-[#00a1d6] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#00b5e5] disabled:opacity-50"
                  >
                    {importing ? '导入中...' : '批量导入到待办'}
                  </button>
                  <p className="mt-2 text-xs text-[#9499a0]">
                    导入时自动跳过已存在的同日同舰长排班，不会重复
                  </p>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
