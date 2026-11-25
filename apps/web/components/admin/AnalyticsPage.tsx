'use client';

import { useCallback, useEffect, useState } from 'react';
import { c } from '@/components/admin/admin-theme';
import type { CaptainFrequencyStats, DateHostingStats, HostTypeDistribution, TimeRangeStats } from '@/lib/analytics';
import { addDaysIso } from '@/lib/hosting-todo-schedule';
import { todayIsoDate } from '@/lib/hosting-week-utils';

type TabType = 'summary' | 'captain-frequency' | 'date-hosting';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentGuardUids, setCurrentGuardUids] = useState<Set<string>>(new Set());
  const [currentGuardNames, setCurrentGuardNames] = useState<Set<string>>(new Set());

  const today = todayIsoDate();
  const [startDate, setStartDate] = useState(addDaysIso(today, -90));
  const [endDate, setEndDate] = useState(today);

  const [summaryData, setSummaryData] = useState<TimeRangeStats | null>(null);
  const [captainFreqData, setCaptainFreqData] = useState<CaptainFrequencyStats[]>([]);
  const [dateHostingData, setDateHostingData] = useState<DateHostingStats[]>([]);

  // 全表分页
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 并行获取当前大航海榜单
    const guardPromise = fetch('/api/admin/captains/current-guard-list', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(body => {
        if (body?.data?.guardUids) {
          setCurrentGuardUids(new Set(body.data.guardUids));
        }
        if (body?.data?.guardNames) {
          setCurrentGuardNames(new Set(body.data.guardNames));
        }
      })
      .catch(() => {}); // 失败不影响主流程

    try {
      if (activeTab === 'summary') {
        const res = await fetch(`/api/admin/analytics?type=summary&startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error('加载失败');
        const json = await res.json();
        setSummaryData(json.data);
      } else if (activeTab === 'captain-frequency') {
        const res = await fetch(`/api/admin/analytics?type=captain-frequency&startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error('加载失败');
        const json = await res.json();
        setCaptainFreqData(json.data);
        setCurrentPage(1);
      } else if (activeTab === 'date-hosting') {
        const res = await fetch(`/api/admin/analytics?type=date-hosting&startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error('加载失败');
        const json = await res.json();
        setDateHostingData(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = async (type: 'captain-frequency' | 'date-hosting') => {
    try {
      const res = await fetch(`/api/admin/analytics?type=${type}&format=csv&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error('导出失败');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${startDate}-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : '导出失败');
    }
  };

  const tabBtn = (tab: TabType, label: string) => {
    const active = activeTab === tab;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(tab)}
        className={
          active
            ? `rounded-md px-4 py-2 text-sm font-medium ${c.activeBg} ${c.activeText}`
            : `rounded-md px-4 py-2 text-sm font-medium text-[#61666d] ${c.hover}`
        }
      >
        {label}
      </button>
    );
  };

  // 分页逻辑
  const totalPages = Math.ceil(captainFreqData.length / pageSize);
  const paginatedData = captainFreqData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className={`border-b ${c.line} bg-white px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">数据分析</h1>
            <p className={`mt-1 text-sm ${c.sub}`}>托管数据统计与导出</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#61666d]">起始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-[#e3e5e7] bg-white px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#61666d]">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-[#e3e5e7] bg-white px-3 py-1.5 text-sm"
            />
          </div>
          <button type="button" onClick={() => void load()} className={c.btnPrimary}>
            查询
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          {tabBtn('summary', '总览')}
          {tabBtn('captain-frequency', '舰长频率')}
          {tabBtn('date-hosting', '日期统计')}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && <div className="text-center text-[#9499a0]">加载中...</div>}
        {error && <div className="text-center text-red-600">错误: {error}</div>}

        {!loading && !error && activeTab === 'summary' && summaryData && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className={c.card}>
                <p className={`text-sm ${c.sub}`}>总托管天数</p>
                <p className="mt-2 text-3xl font-bold">{summaryData.hostingDays}</p>
                <p className="mt-1 text-xs text-[#9499a0]">占比 {Math.round((summaryData.hostingDays / summaryData.totalDays) * 100)}%</p>
              </div>
              <div className={c.card}>
                <p className={`text-sm ${c.sub}`}>总托管次数</p>
                <p className="mt-2 text-3xl font-bold">{summaryData.totalTodos}</p>
              </div>
              <div className={c.card}>
                <p className={`text-sm ${c.sub}`}>日均托管次数</p>
                <p className="mt-2 text-3xl font-bold">{summaryData.avgTodosPerDay}</p>
              </div>
              <div className={c.card}>
                <p className={`text-sm ${c.sub}`}>参与舰长数</p>
                <p className="mt-2 text-3xl font-bold">
                  {summaryData.participatingCaptains}
                  <span className="ml-1 text-base font-normal text-[#9499a0]">/ {summaryData.totalCaptains}</span>
                </p>
                <p className="mt-1 text-xs text-[#9499a0]">
                  本期未托管 {summaryData.totalCaptains - summaryData.participatingCaptains} 位
                </p>
              </div>
            </div>

            <div className={c.card}>
              <h3 className="text-lg font-semibold">托管类型分布</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#61666d]">扫号</p>
                  <p className="mt-1 text-2xl font-bold text-pink-600">{summaryData.hostTypeDistribution.scan} 次</p>
                  <p className="text-sm text-[#9499a0]">{summaryData.hostTypeDistribution.scanPercentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-[#61666d]">组排</p>
                  <p className="mt-1 text-2xl font-bold text-blue-600">{summaryData.hostTypeDistribution.group} 次</p>
                  <p className="text-sm text-[#9499a0]">{summaryData.hostTypeDistribution.groupPercentage}%</p>
                </div>
              </div>
            </div>

            <div className={c.card}>
              <h3 className="text-lg font-semibold">数据口径核对</h3>
              <p className="mt-1 text-xs text-[#9499a0]">
                以「舰长管理」{summaryData.totalCaptains} 位舰长为主表，全部列出，0 次也保留
              </p>
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className={c.sub}>历史从未托管</p>
                  <p className="mt-1 text-2xl font-bold text-orange-500">{summaryData.neverHostedCaptains} 位</p>
                </div>
                <div>
                  <p className={c.sub}>挂不上舰长的记录</p>
                  <p className="mt-1 text-2xl font-bold text-red-500">{summaryData.unlinkedTodoCount} 条</p>
                  {summaryData.unlinkedNames.length > 0 && (
                    <p className="mt-1 text-xs text-[#9499a0] break-all">
                      {summaryData.unlinkedNames.join('、')}
                    </p>
                  )}
                </div>
                <div>
                  <p className={c.sub}>本期托管次数</p>
                  <p className="mt-1 text-2xl font-bold">{summaryData.totalTodos} 次</p>
                </div>
              </div>
            </div>

            <div className={c.card}>
              <h3 className="text-lg font-semibold">扫号频率榜单</h3>
              <p className="mt-1 text-xs text-[#9499a0]">
                舰长管理全部 {summaryData.totalCaptains} 位（含 0 次），按历史累计托管次数降序，同频率按距今最久排序
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#e3e5e7]">
                    <tr className="text-left">
                      <th className="pb-2 font-medium text-[#61666d]">排名</th>
                      <th className="pb-2 font-medium text-[#61666d]">舰长</th>
                      <th className="pb-2 font-medium text-[#61666d]">累计次数</th>
                      <th className="pb-2 font-medium text-[#61666d]">扫号</th>
                      <th className="pb-2 font-medium text-[#61666d]">组排</th>
                      <th className="pb-2 font-medium text-[#61666d]">平均间隔</th>
                      <th className="pb-2 font-medium text-[#61666d]">最近托管</th>
                      <th className="pb-2 font-medium text-[#61666d]">距今天数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.topScanFrequency.map((d, idx) => {
                      const isExpired = d.linked && currentGuardNames.size > 0 && !currentGuardNames.has(d.roleName);
                      const rowBg = !d.linked ? 'bg-red-50/60' : isExpired ? 'bg-orange-50/60' : '';
                      return (
                        <tr key={`${d.roleName}-${idx}`} className={`border-b border-[#f6f7f8] ${rowBg}`}>
                          <td className="py-2 text-[#9499a0]">#{idx + 1}</td>
                          <td className="py-2 font-medium">
                            {d.roleName}
                            {!d.linked && (
                              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-normal text-red-600">
                                未关联舰长
                              </span>
                            )}
                            {d.linked && d.neverHosted && (
                              <span className="ml-2 rounded bg-[#f6f7f8] px-1.5 py-0.5 text-xs font-normal text-[#9499a0]">
                                从未托管
                              </span>
                            )}
                          </td>
                          <td className={`py-2 font-bold ${d.totalCount > 0 ? 'text-[#fb7299]' : 'text-[#c9ccd0]'}`}>
                            {d.totalCount}
                          </td>
                          <td className="py-2 text-pink-600">{d.scanCount}</td>
                          <td className="py-2 text-blue-600">{d.groupCount}</td>
                          <td className="py-2 text-[#9499a0]">
                            {d.avgDaysInterval != null ? `${d.avgDaysInterval} 天/次` : '-'}
                          </td>
                          <td className="py-2 text-[#61666d]">{d.lastHostingDate || '-'}</td>
                          <td className="py-2 text-[#9499a0]">{d.daysSinceLastHosting ?? '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && activeTab === 'captain-frequency' && (
          <div className="space-y-6">
            <div className={c.card}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">舰长扫号全表</h3>
                  <p className="mt-1 text-xs text-[#9499a0]">
                    舰长管理全部 {captainFreqData.length} 位（含 0 次，按舰长表列出）· 当前显示第 {currentPage}/{totalPages} 页
                  </p>
                </div>
                <button type="button" onClick={() => void exportCsv('captain-frequency')} className={c.btnPrimary}>
                  导出全表 CSV
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#e3e5e7]">
                    <tr className="text-left">
                      <th className="pb-2 font-medium text-[#61666d]">舰长</th>
                      <th className="pb-2 font-medium text-[#61666d]">UID</th>
                      <th className="pb-2 font-medium text-[#61666d]">本期次数</th>
                      <th className="pb-2 font-medium text-[#61666d]">累计次数</th>
                      <th className="pb-2 font-medium text-[#61666d]">扫号</th>
                      <th className="pb-2 font-medium text-[#61666d]">组排</th>
                      <th className="pb-2 font-medium text-[#61666d]">最近托管日期</th>
                      <th className="pb-2 font-medium text-[#61666d]">距今天数</th>
                      <th className="pb-2 font-medium text-[#61666d]">平均间隔</th>
                      <th className="pb-2 font-medium text-[#61666d]">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((d, idx) => {
                      const isExpired = d.linked && currentGuardNames.size > 0 && !currentGuardNames.has(d.roleName);
                      const rowBg = !d.linked ? 'bg-red-50/60' : isExpired ? 'bg-orange-50/60' : '';
                      return (
                        <tr key={`${d.captainId ?? d.roleName}-${idx}`} className={`border-b border-[#f6f7f8] ${rowBg}`}>
                          <td className="py-2 font-medium">{d.roleName}</td>
                          <td className="py-2 text-xs text-[#9499a0]">{d.uid ?? '-'}</td>
                          <td className={`py-2 font-bold ${d.totalCount > 0 ? 'text-[#fb7299]' : 'text-[#c9ccd0]'}`}>
                            {d.totalCount}
                          </td>
                          <td className="py-2 text-[#61666d]">{d.allTimeCount}</td>
                          <td className="py-2 text-pink-600">{d.scanCount}</td>
                          <td className="py-2 text-blue-600">{d.groupCount}</td>
                          <td className="py-2 text-[#61666d]">{d.lastHostingDate || '-'}</td>
                          <td className="py-2 text-[#9499a0]">{d.daysSinceLastHosting ?? '-'}</td>
                          <td className="py-2 text-[#9499a0]">
                            {d.avgDaysInterval != null ? `${d.avgDaysInterval} 天/次` : '-'}
                          </td>
                          <td className="py-2 text-xs">
                            {!d.linked ? (
                              <span className="text-red-600">未关联舰长</span>
                            ) : d.neverHosted ? (
                              <span className="text-[#9499a0]">从未托管</span>
                            ) : isExpired ? (
                              <span className="text-orange-600">已过期</span>
                            ) : (
                              <span className="text-[#9499a0]">正常</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className={c.btnGhost + ' disabled:opacity-40'}
                  >
                    首页
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={c.btnGhost + ' disabled:opacity-40'}
                  >
                    上一页
                  </button>
                  <span className="text-sm text-[#61666d]">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={c.btnGhost + ' disabled:opacity-40'}
                  >
                    下一页
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className={c.btnGhost + ' disabled:opacity-40'}
                  >
                    末页
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !error && activeTab === 'date-hosting' && (
          <div className="space-y-6">
            <div className={c.card}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">日期托管统计</h3>
                <button type="button" onClick={() => void exportCsv('date-hosting')} className={c.btnPrimary}>
                  导出CSV
                </button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#e3e5e7]">
                    <tr className="text-left">
                      <th className="pb-2 font-medium text-[#61666d]">日期</th>
                      <th className="pb-2 font-medium text-[#61666d]">总次数</th>
                      <th className="pb-2 font-medium text-[#61666d]">扫号</th>
                      <th className="pb-2 font-medium text-[#61666d]">组排</th>
                      <th className="pb-2 font-medium text-[#61666d]">舰长列表</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dateHostingData.map((d) => (
                      <tr key={d.date} className="border-b border-[#f6f7f8]">
                        <td className="py-2">{d.date}</td>
                        <td className="py-2">{d.totalCount}</td>
                        <td className="py-2 text-pink-600">{d.scanCount}</td>
                        <td className="py-2 text-blue-600">{d.groupCount}</td>
                        <td className="py-2 text-xs text-[#9499a0]">
                          {d.roleNames.map((name, idx) => {
                            const isExpired = currentGuardNames.size > 0 && !currentGuardNames.has(name);
                            return (
                              <span
                                key={idx}
                                className={isExpired ? 'inline-block rounded bg-orange-50 px-1 py-0.5 text-orange-600' : ''}
                              >
                                {name}
                                {idx < d.roleNames.length - 1 ? ', ' : ''}
                              </span>
                            );
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
