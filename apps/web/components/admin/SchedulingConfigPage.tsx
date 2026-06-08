'use client';

import { useCallback, useEffect, useState } from 'react';
import { c } from '@/components/admin/admin-theme';
import type { SchedulingWeightsConfig, CaptainRecommendation, WeightFactor } from '@/lib/scheduling-weights';

const DEFAULT_CONFIG: SchedulingWeightsConfig = {
  enabled: true,
  dailySlots: 2,
  demandScore: { enabled: true, weight: 1.0 },
  daysSinceLastHosting: { enabled: true, weight: 0.6 },
  daysSinceCreated: { enabled: false, weight: 0.3 },
  daysSinceFirstHosting: { enabled: false, weight: 0.1 },
  newCaptainBonus: { enabled: true, weight: 0.8 },
  totalFrequencyPenalty: { enabled: false, weight: 0.3 },
  weekFrequencyPenalty: { enabled: true, weight: 0.5 },
  monthFrequencyPenalty: { enabled: false, weight: 0.3 },
  recentFrequencyPenalty: { enabled: false, weight: 0.2 },
  shipTier: { enabled: false, weight: 0.2 },
  dataCompleteness: { enabled: false, weight: 0.1 },
  hasAvatar: { enabled: false, weight: 0.1 },
  stuckTaskPenalty: { enabled: false, weight: 0.3 },
  avgIntervalBonus: { enabled: false, weight: 0.2 },
  expiredPenalty: { enabled: false, weight: 0.5 },
  filterWeekScheduled: false,
  filterMonthScheduled: false,
  filterExpired: false,
};

// 因子分组定义（用于渲染）
type FactorMeta = { key: keyof SchedulingWeightsConfig; label: string; desc: string; sign: '+' | '-' };
type FactorGroup = { title: string; icon: string; hint: string; factors: FactorMeta[] };

const FACTOR_GROUPS: FactorGroup[] = [
  {
    title: '核心公平因子',
    icon: '⚖️',
    hint: '决定排队公平性，建议保持开启',
    factors: [
      { key: 'demandScore', label: '需求分数', desc: '(每日名额/舰长数)×加入天数 - 已托管次数，公平性数学基础', sign: '+' },
      { key: 'daysSinceLastHosting', label: '距上次托管天数', desc: '越久没上号越优先（60天封顶满分）', sign: '+' },
      { key: 'daysSinceCreated', label: '距入库天数', desc: '加入系统越久越优先', sign: '+' },
      { key: 'daysSinceFirstHosting', label: '距首次托管天数', desc: '首次上号后的时间跨度', sign: '+' },
      { key: 'newCaptainBonus', label: '新舰长加分', desc: '从未托管过的舰长直接加满分', sign: '+' },
    ],
  },
  {
    title: '频率惩罚',
    icon: '📊',
    hint: '避免重复安排，托管越频繁扣分越多',
    factors: [
      { key: 'totalFrequencyPenalty', label: '历史总次数', desc: '累计托管次数（10次封顶）', sign: '-' },
      { key: 'weekFrequencyPenalty', label: '本周已托管', desc: '本周已安排的扣分（3次封顶）', sign: '-' },
      { key: 'monthFrequencyPenalty', label: '本月已托管', desc: '本月已安排的扣分（8次封顶）', sign: '-' },
      { key: 'recentFrequencyPenalty', label: '最近30天', desc: '最近一个月的托管次数（8次封顶）', sign: '-' },
    ],
  },
  {
    title: '舰长身份',
    icon: '👤',
    hint: '基于舰长档案的加成',
    factors: [
      { key: 'shipTier', label: '舰长等级', desc: '总督=3/提督=2/舰长=1（都是普通舰长时关闭）', sign: '+' },
      { key: 'dataCompleteness', label: '数据完整性', desc: '备注/ID/微信/游戏ID 越全越高（4项封顶）', sign: '+' },
      { key: 'hasAvatar', label: '已上传头像', desc: '上传过头像的加满分', sign: '+' },
    ],
  },
  {
    title: '行为因子',
    icon: '🎯',
    hint: '基于历史行为的调整',
    factors: [
      { key: 'stuckTaskPenalty', label: '卡任务惩罚', desc: '有卡任务历史的扣分', sign: '-' },
      { key: 'avgIntervalBonus', label: '平均间隔加成', desc: '历史托管间隔越长越优先（60天封顶）', sign: '+' },
    ],
  },
  {
    title: '过期处理',
    icon: '🚫',
    hint: '依赖 expires_at 字段是否准确',
    factors: [{ key: 'expiredPenalty', label: '过期舰长惩罚', desc: '过期舰长扣分', sign: '-' }],
  },
];

export default function SchedulingConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [config, setConfig] = useState<SchedulingWeightsConfig>(DEFAULT_CONFIG);
  const [recommendations, setRecommendations] = useState<CaptainRecommendation[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [includeExcluded, setIncludeExcluded] = useState(false);

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

  const loadRecommendations = useCallback(async (showAll: boolean) => {
    try {
      const res = await fetch(`/api/admin/recommendations?top=30&includeExcluded=${showAll ? '1' : '0'}`);
      if (!res.ok) throw new Error('加载失败');
      const json = await res.json();
      setRecommendations(json.data || []);
    } catch (err) {
      console.error('加载推荐失败', err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const save = async () => {
    setSaving(true);
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
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    setShowPreview(true);
    await loadRecommendations(includeExcluded);
  };

  const togglePreviewMode = async (showAll: boolean) => {
    setIncludeExcluded(showAll);
    if (showPreview) await loadRecommendations(showAll);
  };

  const updateFactor = (key: keyof SchedulingWeightsConfig, updates: Partial<WeightFactor>) => {
    const f = config[key];
    if (typeof f === 'object' && f !== null && 'enabled' in f) {
      setConfig({ ...config, [key]: { ...f, ...updates } });
    }
  };

  const enabledCount = FACTOR_GROUPS.reduce(
    (n, g) => n + g.factors.filter((fm) => (config[fm.key] as WeightFactor).enabled).length,
    0,
  );

  if (loading) {
    return <div className="p-6 text-center text-[#9499a0]">加载中...</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className={`border-b ${c.line} bg-white px-6 py-4`}>
        <div>
          <h1 className="text-xl font-semibold">排期推荐配置</h1>
          <p className={`mt-1 text-sm ${c.sub}`}>多维度公平排班模型，每个因子可独立开关；权重已归一化（0-1 = 0-100% 贡献）</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#f6f7f8] p-6">
        {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>}
        {toast && (
          <div className="fixed right-6 top-6 z-50 rounded-md bg-green-500 px-4 py-2 text-white shadow-lg">{toast}</div>
        )}

        {/* 模型说明 */}
        <div className={`${c.card} max-w-4xl`}>
          <h3 className="text-base font-semibold text-[#18191c]">📐 评分模型</h3>
          <div className="mt-3 rounded-md bg-[#f6f7f8] p-4 text-sm leading-relaxed text-[#61666d]">
            <p>每个因子先<strong className="text-[#fb7299]">归一化到 0-100 分</strong>，再乘以权重求和。</p>
            <p className="mt-1 font-mono text-xs">最终分数 = Σ(加分因子 × 权重) - Σ(减分因子 × 权重)</p>
            <p className="mt-2 text-xs text-[#9499a0]">
              权重 1.0 = 该因子最多贡献 100 分；权重 0.3 = 最多 30 分。
              这样不同因子的权重可以横向比较，调权重才真正有意义。
            </p>
          </div>
        </div>

        {/* 全局开关 + 每日名额 */}
        <div className={`${c.card} mt-4 max-w-4xl`}>
          <div className="flex items-center justify-between border-b border-[#e3e5e7] pb-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="h-5 w-5"
              />
              <span className="text-base font-semibold">启用智能推荐</span>
            </label>
            <span className="text-xs text-[#9499a0]">{enabledCount} 个因子已启用</span>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-[#18191c]">每日排班名额</label>
            <p className="mt-1 text-xs text-[#9499a0]">每天选取分数最高的 N 名舰长（也用于需求分数公式）</p>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={config.dailySlots}
              onChange={(e) => setConfig({ ...config, dailySlots: parseInt(e.target.value, 10) || 1 })}
              className="mt-2 w-28 rounded-md border border-[#e3e5e7] bg-white px-3 py-1.5 text-sm"
            />
          </div>

          {/* 因子分组 */}
          {FACTOR_GROUPS.map((group) => (
            <div key={group.title} className="mt-6 border-t border-[#e3e5e7] pt-6">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-[#18191c]">
                <span>{group.icon}</span>
                <span>{group.title}</span>
              </h4>
              <p className="mt-1 text-xs text-[#9499a0]">{group.hint}</p>
              <div className="mt-3 space-y-2">
                {group.factors.map((fm) => {
                  const factor = config[fm.key] as WeightFactor;
                  return (
                    <div
                      key={String(fm.key)}
                      className="flex items-start gap-3 rounded-lg border border-[#e3e5e7] bg-[#fafafa] p-3 transition hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={factor.enabled}
                        onChange={(e) => updateFactor(fm.key, { enabled: e.target.checked })}
                        className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-[#18191c]">{fm.label}</span>
                          <span
                            className={`text-xs ${fm.sign === '+' ? 'text-green-600' : 'text-orange-600'}`}
                          >
                            {fm.sign === '+' ? '加分' : '减分'}
                          </span>
                          {!factor.enabled && <span className="text-xs text-[#9499a0]">(已禁用)</span>}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#9499a0]">{fm.desc}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            step={0.1}
                            min={0}
                            max={10}
                            value={factor.weight}
                            onChange={(e) => updateFactor(fm.key, { weight: parseFloat(e.target.value) || 0 })}
                            disabled={!factor.enabled}
                            className={`w-24 rounded-md border border-[#e3e5e7] bg-white px-3 py-1 text-sm ${
                              !factor.enabled ? 'opacity-50' : ''
                            }`}
                          />
                          <span className="text-xs text-[#9499a0]">权重（最多 {(factor.weight * 100).toFixed(0)} 分）</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 过滤器 */}
          <div className="mt-6 border-t border-[#e3e5e7] pt-6">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-[#18191c]">
              <span>🚪</span>
              <span>过滤器（直接从推荐列表剔除，不影响分数）</span>
            </h4>
            <div className="mt-3 space-y-2">
              {[
                { key: 'filterWeekScheduled' as const, label: '本周已托管的不再推荐', desc: '避免同一周重复安排' },
                { key: 'filterMonthScheduled' as const, label: '本月已托管的不再推荐', desc: '人数少时会让列表变空' },
                { key: 'filterExpired' as const, label: '排除已过期舰长', desc: '依赖 expires_at 字段是否准确' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e3e5e7] bg-[#fafafa] p-3 transition hover:bg-white"
                >
                  <input
                    type="checkbox"
                    checked={config[item.key]}
                    onChange={(e) => setConfig({ ...config, [item.key]: e.target.checked })}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <div className="text-sm font-medium text-[#18191c]">{item.label}</div>
                    <p className="mt-0.5 text-xs text-[#9499a0]">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 按钮 */}
          <div className="mt-6 flex gap-3 border-t border-[#e3e5e7] pt-6">
            <button type="button" onClick={() => void save()} disabled={saving} className={c.btnPrimary}>
              {saving ? '保存中...' : '保存配置'}
            </button>
            <button type="button" onClick={() => void preview()} className={c.btnGhost}>
              预览推荐结果
            </button>
            <button type="button" onClick={() => setConfig(DEFAULT_CONFIG)} className={c.btnGhost}>
              重置为默认
            </button>
          </div>
        </div>

        {/* 预览 */}
        {showPreview && (
          <div className={`${c.card} mt-4 max-w-full`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">推荐结果预览</h3>
                <p className="mt-1 text-xs text-[#9499a0]">分数越高越应该优先安排</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeExcluded}
                  onChange={(e) => void togglePreviewMode(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>显示被过滤的舰长</span>
              </label>
            </div>

            {recommendations.length === 0 ? (
              <p className="mt-4 text-center text-[#9499a0]">暂无数据</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#e3e5e7]">
                    <tr className="text-left">
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">排名</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">舰长</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">分数</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">需求分</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">距上次</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">历史</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">本周</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">本月</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map((rec, idx) => (
                      <tr
                        key={rec.captainId}
                        className={`border-b border-[#f6f7f8] ${rec.excluded ? 'opacity-50' : 'hover:bg-[#fafafa]'}`}
                      >
                        <td className="py-2 pr-3">
                          <span className={!rec.excluded && idx < config.dailySlots ? 'font-bold text-[#fb7299]' : ''}>
                            {rec.excluded ? '-' : idx + 1}
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-medium">
                          {rec.displayName}
                          {rec.isNewCaptain && (
                            <span className="ml-1 rounded bg-green-100 px-1 py-0.5 text-xs text-green-700">新</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="font-semibold text-[#00a1d6]">{rec.score.toFixed(1)}</span>
                        </td>
                        <td className="py-2 pr-3 text-[#9499a0]">{rec.demandScoreRaw.toFixed(1)}</td>
                        <td className="py-2 pr-3 text-[#9499a0]">
                          {rec.daysSinceLastHosting !== null ? `${rec.daysSinceLastHosting}天` : '-'}
                        </td>
                        <td className="py-2 pr-3">{rec.totalHostingCount}</td>
                        <td className="py-2 pr-3">{rec.weekHostingCount}</td>
                        <td className="py-2 pr-3">{rec.monthHostingCount}</td>
                        <td className="py-2 pr-3">
                          {rec.excluded ? (
                            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
                              {rec.excludeReason}
                            </span>
                          ) : (
                            <span className="text-xs text-[#9499a0]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
