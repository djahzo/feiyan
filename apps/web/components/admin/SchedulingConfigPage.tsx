'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SchedulingRotationConfig } from '@/lib/scheduling-rotation';
import type { PeriodSchedule, DaySchedule } from '@/lib/scheduling-calendar';
import type { HostingTodoRow } from '@/lib/db';

const DEFAULT_CONFIG: SchedulingRotationConfig = {
  enabled: true,
  dailySlots: 2,
  periodDays: 7,
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
  const [periods, setPeriods] = useState<PeriodSchedule[]>([]);
  const [accumulatedVirtualTodos, setAccumulatedVirtualTodos] = useState<HostingTodoRow[]>([]);
  const [importing, setImporting] = useState(false);

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

  // 生成单个周期（支持传入累积虚拟待办）
  const generateNextPeriod = useCallback(
    async (startDate: string, virtualTodos: HostingTodoRow[]) => {
      try {
        const res = await fetch('/api/admin/schedule-calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, virtualTodos }),
        });
        if (!res.ok) throw new Error('生成失败');
        const json = await res.json();
        return json.data;
      } catch (err) {
        console.error('生成周期失败', err);
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

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
      if (showPreview) {
        // 重新生成演算（清空累积状态）
        await handleStartPreview();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleStartPreview = async () => {
    setShowPreview(true);
    setError(null);

    // 从今天开始生成第 1 周期，不传虚拟待办
    const result = await generateNextPeriod(new Date().toISOString().slice(0, 10), []);
    if (!result || !result.days) {
      setError('生成失败');
      return;
    }

    const firstPeriod: PeriodSchedule = {
      periodIndex: 0,
      startDate: result.days[0]?.date || new Date().toISOString().slice(0, 10),
      endDate: result.days[result.days.length - 1]?.date || new Date().toISOString().slice(0, 10),
      days: result.days,
    };

    setPeriods([firstPeriod]);
    setAccumulatedVirtualTodos(result.newVirtualTodos || []);
  };

  const handleNextPeriod = async () => {
    if (periods.length === 0) return;
    setError(null);

    const lastPeriod = periods[periods.length - 1];
    // 下一周期起始日 = 上一周期结束日 + 1 天
    const nextStartDate = new Date(lastPeriod.endDate);
    nextStartDate.setDate(nextStartDate.getDate() + 1);
    const nextStartDateStr = nextStartDate.toISOString().slice(0, 10);

    // 生成下一个周期，传入累积的虚拟待办
    const result = await generateNextPeriod(nextStartDateStr, accumulatedVirtualTodos);
    if (!result || !result.days) {
      setError('生成下一周期失败');
      return;
    }

    const newPeriod: PeriodSchedule = {
      periodIndex: periods.length,
      startDate: result.days[0]?.date || nextStartDateStr,
      endDate: result.days[result.days.length - 1]?.date || nextStartDateStr,
      days: result.days,
    };

    // 追加新周期
    setPeriods([...periods, newPeriod]);
    // 更新累积虚拟待办
    setAccumulatedVirtualTodos([...accumulatedVirtualTodos, ...(result.newVirtualTodos || [])]);
  };

  const handleImportPeriod = async (periodIndex: number) => {
    const period = periods[periodIndex];
    if (!period) return;

    const items = period.days.flatMap((day) =>
      day.recommendations.map((cap) => ({ date: day.date, roleName: cap.displayName, captainId: cap.captainId })),
    );

    if (items.length === 0) {
      setError('该周期无推荐排班');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/hosting-todos/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, skipConflicts: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '导入失败');
      setToast(json.message || '导入成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-[#9499a0]">加载中...</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 头部 */}
      <header className="border-b border-[#e3e5e7] bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-[#18191c]">排期演算</h1>
        <p className="mt-1 text-sm text-[#9499a0]">
          轮值队列模型：按「需求债务」循环推演，支持多周期累积滚动
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
            <p className="mt-2 text-xs text-[#00a1d6]">
              💡 「下一周期」会基于前面周期的预排结果更新债务，实现真正的循环轮转。
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
          <h2 className="mb-1 text-base font-semibold text-[#18191c]">📊 演算参数</h2>
          <p className="mb-4 text-xs text-[#9499a0]">
            决定每天推荐几人、每个周期多少天
          </p>
          <div className="space-y-4">
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#61666d]">每周期天数</label>
              <input
                type="number"
                min={1}
                max={30}
                value={config.periodDays}
                onChange={(e) => setConfig({ ...config, periodDays: parseInt(e.target.value, 10) || 7 })}
                className="w-full max-w-xs rounded-md border border-[#e3e5e7] bg-white px-3 py-2 text-sm text-[#18191c] outline-none transition focus:border-[#00a1d6] focus:shadow-[0_0_0_2px_rgba(0,161,214,0.12)]"
              />
              <p className="text-xs text-[#9499a0]">范围 1-30，推荐 7（一周）或 14（两周）</p>
            </div>
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
            onClick={handleStartPreview}
            disabled={showPreview}
            className="rounded-md border border-[#e3e5e7] bg-white px-4 py-2 text-sm font-medium text-[#61666d] transition hover:border-[#c9ccd0] hover:bg-[#f6f7f8] disabled:opacity-50"
          >
            {showPreview ? '演算中...' : '开始演算'}
          </button>
        </div>

        {/* 演算结果 */}
        {showPreview && (
          <section className="max-w-6xl space-y-6">
            {periods.length === 0 ? (
              <div className="rounded-[10px] border border-[#e3e5e7] bg-white p-6 text-center text-sm text-[#9499a0]">
                无推荐排班（检查配置和舰长数据）
              </div>
            ) : (
              <>
                {periods.map((period) => (
                  <div
                    key={period.periodIndex}
                    className="rounded-[10px] border border-[#e3e5e7] bg-white p-6 shadow-sm"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-[#18191c]">
                          第 {period.periodIndex + 1} 周期
                        </h3>
                        <p className="text-xs text-[#9499a0]">
                          {period.startDate} 至 {period.endDate} ({period.days.length} 天)
                        </p>
                      </div>
                      <button
                        onClick={() => handleImportPeriod(period.periodIndex)}
                        disabled={importing}
                        className="rounded-md bg-[#00a1d6] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#00b5e5] disabled:opacity-50"
                      >
                        {importing ? '导入中...' : '导入本周期'}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {period.days.map((day) => (
                        <div
                          key={day.date}
                          className="rounded-md border border-[#e3e5e7] bg-[#f6f7f8] p-3"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div>
                              <span className="text-sm font-semibold text-[#18191c]">{day.date}</span>
                              <span className="ml-2 text-xs text-[#9499a0]">{day.dayOfWeek}</span>
                            </div>
                            <span className="text-xs text-[#9499a0]">
                              {day.recommendations.length} 人
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {day.recommendations.map((cap) => (
                              <div
                                key={cap.captainId}
                                className="rounded bg-white px-3 py-1.5 text-sm shadow-sm"
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
                  </div>
                ))}

                <div className="flex justify-center">
                  <button
                    onClick={handleNextPeriod}
                    className="rounded-md border-2 border-dashed border-[#00a1d6] bg-white px-6 py-3 text-sm font-medium text-[#00a1d6] transition hover:bg-[#f0f9ff]"
                  >
                    ➕ 下一周期
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
