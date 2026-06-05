'use client';

import { useCallback, useEffect, useState } from 'react';
import { c } from '@/components/admin/admin-theme';
import type { SchedulingWeightsConfig, CaptainRecommendation, WeightFactor } from '@/lib/scheduling-weights';

export default function SchedulingConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [config, setConfig] = useState<SchedulingWeightsConfig>({
    enabled: true,
    daysSinceLastHosting: { enabled: true, weight: 1.0 },
    daysSinceCreated: { enabled: true, weight: 0.5 },
    daysSinceFirstHosting: { enabled: false, weight: 0.1 },
    newCaptainBonus: { enabled: true, weight: 30 },
    totalFrequencyPenalty: { enabled: true, weight: 0.2 },
    weekFrequencyPenalty: { enabled: true, weight: 10 },
    monthFrequencyPenalty: { enabled: false, weight: 3 },
    recentFrequencyPenalty: { enabled: false, weight: 1 },
    shipTier: { enabled: false, weight: 0.3 },
    dataCompleteness: { enabled: false, weight: 2 },
    hasAvatar: { enabled: false, weight: 1 },
    stuckTaskPenalty: { enabled: false, weight: 5 },
    avgIntervalBonus: { enabled: false, weight: 0.1 },
    excludeExpired: false,
    expiredPenalty: { enabled: false, weight: 20 },
  });

  const [recommendations, setRecommendations] = useState<CaptainRecommendation[]>([]);
  const [showPreview, setShowPreview] = useState(false);

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

  const loadRecommendations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/recommendations?top=20');
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

  const updateFactor = (key: keyof SchedulingWeightsConfig, updates: Partial<WeightFactor>) => {
    const factor = config[key];
    if (typeof factor === 'object' && 'enabled' in factor) {
      setConfig({ ...config, [key]: { ...factor, ...updates } });
    }
  };

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
    await loadRecommendations();
  };

  if (loading) {
    return <div className="p-6 text-center text-[#9499a0]">加载中...</div>;
  }

  const FactorRow = ({
    label,
    description,
    factorKey,
    factor,
    min = 0,
    max = 100,
    step = 0.1,
  }: {
    label: string;
    description: string;
    factorKey: keyof SchedulingWeightsConfig;
    factor: WeightFactor;
    min?: number;
    max?: number;
    step?: number;
  }) => (
    <div className="flex items-start gap-4 rounded-lg border border-[#e3e5e7] bg-[#fafafa] p-4 transition hover:bg-white">
      <input
        type="checkbox"
        checked={factor.enabled}
        onChange={(e) => updateFactor(factorKey, { enabled: e.target.checked })}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
      />
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <label className="cursor-pointer text-sm font-medium text-[#18191c]">{label}</label>
          {!factor.enabled && <span className="text-xs text-[#9499a0]">(已禁用)</span>}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[#9499a0]">{description}</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            value={factor.weight}
            onChange={(e) => updateFactor(factorKey, { weight: parseFloat(e.target.value) || 0 })}
            disabled={!factor.enabled}
            className={`w-28 rounded-md border border-[#e3e5e7] bg-white px-3 py-1.5 text-sm ${!factor.enabled ? 'opacity-50' : ''}`}
          />
          <span className="text-xs text-[#9499a0]">权重系数</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className={`border-b ${c.line} bg-white px-6 py-4`}>
        <div>
          <h1 className="text-xl font-semibold">排期权重配置</h1>
          <p className={`mt-1 text-sm ${c.sub}`}>配置智能推荐系统的多维度权重参数，每个因子可独立开关</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#f6f7f8] p-6">
        {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>}

        {toast && (
          <div className="fixed right-6 top-6 z-50 rounded-md bg-green-500 px-4 py-2 text-white shadow-lg">
            {toast}
          </div>
        )}

        <div className={`${c.card} max-w-4xl`}>
          <div className="flex items-center justify-between border-b border-[#e3e5e7] pb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="h-5 w-5"
              />
              <span className="text-base font-semibold">启用智能推荐系统</span>
            </label>
            <span className="text-xs text-[#9499a0]">共 {Object.keys(config).filter(k => typeof (config as any)[k] === 'object' && (config as any)[k]?.enabled).length} 个因子已启用</span>
          </div>

          {/* 时间因子 */}
          <div className="mt-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#18191c]">
              <span>⏰</span>
              <span>时间因子</span>
            </h3>
            <p className="mt-1 text-sm text-[#9499a0]">基于时间的公平性因子，核心推荐依据</p>
            <div className="mt-4 space-y-3">
              <FactorRow
                label="距上次托管天数"
                description="越久没上号的舰长权重越高（最核心的公平性因子，推荐值 1.0）"
                factorKey="daysSinceLastHosting"
                factor={config.daysSinceLastHosting}
                max={10}
              />
              <FactorRow
                label="距入库天数"
                description="新舰长从未托管时，按加入系统的天数计算（推荐值 0.5）"
                factorKey="daysSinceCreated"
                factor={config.daysSinceCreated}
                max={10}
              />
              <FactorRow
                label="距首次托管天数"
                description="首次上号后的时间跨度，可用于平衡老用户（推荐值 0.1）"
                factorKey="daysSinceFirstHosting"
                factor={config.daysSinceFirstHosting}
                max={10}
              />
            </div>
          </div>

          {/* 新舰长加分 */}
          <div className="mt-6 border-t border-[#e3e5e7] pt-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#18191c]">
              <span>✨</span>
              <span>新舰长加分</span>
            </h3>
            <p className="mt-1 text-sm text-[#9499a0]">确保新舰长能尽快体验托管服务</p>
            <div className="mt-4">
              <FactorRow
                label="新舰长固定加分"
                description="从未托管过的舰长直接获得此分数（推荐 30，设为 99999 则绝对优先）"
                factorKey="newCaptainBonus"
                factor={config.newCaptainBonus}
                max={99999}
                step={1}
              />
            </div>
          </div>

          {/* 频率惩罚 */}
          <div className="mt-6 border-t border-[#e3e5e7] pt-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#18191c]">
              <span>📊</span>
              <span>频率惩罚</span>
            </h3>
            <p className="mt-1 text-sm text-[#9499a0]">避免重复安排，让托管机会更均衡</p>
            <div className="mt-4 space-y-3">
              <FactorRow
                label="历史总次数惩罚"
                description="总托管次数越多，扣分越多（推荐值 0.2）"
                factorKey="totalFrequencyPenalty"
                factor={config.totalFrequencyPenalty}
                max={10}
              />
              <FactorRow
                label="本周已安排惩罚"
                description="本周已托管的舰长大幅降权，避免同周重复（推荐值 10）"
                factorKey="weekFrequencyPenalty"
                factor={config.weekFrequencyPenalty}
                max={50}
                step={1}
              />
              <FactorRow
                label="本月已安排惩罚"
                description="本月已托管的舰长适当降权（推荐值 3）"
                factorKey="monthFrequencyPenalty"
                factor={config.monthFrequencyPenalty}
                max={30}
                step={1}
              />
              <FactorRow
                label="最近30天惩罚"
                description="最近一个月频繁出现的舰长降权（推荐值 1）"
                factorKey="recentFrequencyPenalty"
                factor={config.recentFrequencyPenalty}
                max={20}
              />
            </div>
          </div>

          {/* 舰长身份因子 */}
          <div className="mt-6 border-t border-[#e3e5e7] pt-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#18191c]">
              <span>👤</span>
              <span>舰长身份因子</span>
            </h3>
            <p className="mt-1 text-sm text-[#9499a0]">基于舰长档案的额外加成</p>
            <div className="mt-4 space-y-3">
              <FactorRow
                label="舰长等级加成"
                description="总督=3分、提督=2分、舰长=1分，乘以此系数（都是普通舰长时可关闭）"
                factorKey="shipTier"
                factor={config.shipTier}
                max={5}
              />
              <FactorRow
                label="数据完整性加成"
                description="备注名、游戏ID、微信、备注越完整加分越高（0-4分，推荐权重 2）"
                factorKey="dataCompleteness"
                factor={config.dataCompleteness}
                max={10}
              />
              <FactorRow
                label="已上传头像加成"
                description="上传过头像的舰长获得额外加分（推荐值 1）"
                factorKey="hasAvatar"
                factor={config.hasAvatar}
                max={10}
                step={1}
              />
            </div>
          </div>

          {/* 行为偏好因子 */}
          <div className="mt-6 border-t border-[#e3e5e7] pt-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#18191c]">
              <span>🎯</span>
              <span>行为偏好因子</span>
            </h3>
            <p className="mt-1 text-sm text-[#9499a0]">基于历史行为的调整</p>
            <div className="mt-4 space-y-3">
              <FactorRow
                label="卡任务惩罚"
                description="历史上有卡任务记录的舰长降权（推荐值 5）"
                factorKey="stuckTaskPenalty"
                factor={config.stuckTaskPenalty}
                max={50}
                step={1}
              />
              <FactorRow
                label="平均间隔加成"
                description="历史托管间隔越长的舰长加分越高（推荐值 0.1）"
                factorKey="avgIntervalBonus"
                factor={config.avgIntervalBonus}
                max={5}
              />
            </div>
          </div>

          {/* 过期处理 */}
          <div className="mt-6 border-t border-[#e3e5e7] pt-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#18191c]">
              <span>🚫</span>
              <span>过期舰长处理</span>
            </h3>
            <p className="mt-1 text-sm text-[#9499a0]">不是所有舰长都会及时续费，可以选择处理方式</p>
            <div className="mt-4 space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.excludeExpired}
                  onChange={(e) => setConfig({ ...config, excludeExpired: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">直接排除已过期舰长（不参与推荐）</span>
              </label>

              {!config.excludeExpired && (
                <FactorRow
                  label="过期惩罚分"
                  description="过期舰长扣分（排除开关关闭时生效，推荐值 20）"
                  factorKey="expiredPenalty"
                  factor={config.expiredPenalty}
                  max={100}
                  step={1}
                />
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="mt-6 flex gap-3 border-t border-[#e3e5e7] pt-6">
            <button type="button" onClick={() => void save()} disabled={saving} className={c.btnPrimary}>
              {saving ? '保存中...' : '保存配置'}
            </button>
            <button type="button" onClick={() => void preview()} className={c.btnGhost}>
              预览推荐结果（Top 20）
            </button>
          </div>
        </div>

        {/* 预览结果 */}
        {showPreview && (
          <div className={`${c.card} mt-6 max-w-full`}>
            <h3 className="text-lg font-semibold">推荐结果预览</h3>
            <p className="mt-1 text-sm text-[#9499a0]">基于当前配置计算的舰长优先级排序，分数越高越应该优先安排</p>

            {recommendations.length === 0 ? (
              <p className="mt-4 text-center text-[#9499a0]">暂无数据</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#e3e5e7]">
                    <tr className="text-left">
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">排名</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">舰长</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">总分</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">状态</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">距上次</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">历史</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">本周</th>
                      <th className="pb-2 pr-3 font-medium text-[#61666d]">本月</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map((rec, idx) => (
                      <tr key={rec.captainId} className="border-b border-[#f6f7f8] hover:bg-[#fafafa]">
                        <td className="py-2 pr-3">
                          <span className={idx < 3 ? 'font-bold text-[#fb7299]' : ''}>{idx + 1}</span>
                        </td>
                        <td className="py-2 pr-3 font-medium">{rec.displayName}</td>
                        <td className="py-2 pr-3">
                          <span className="font-semibold text-[#00a1d6]">{rec.score.toFixed(1)}</span>
                          {rec.isNewCaptain && (
                            <span className="ml-1 rounded bg-green-100 px-1 py-0.5 text-xs text-green-700">新</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {rec.expireStatus === 'expired' && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">过期</span>
                          )}
                          {rec.expireStatus === 'active' && (
                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">正常</span>
                          )}
                          {rec.expireStatus === 'none' && <span className="text-[#9499a0]">-</span>}
                        </td>
                        <td className="py-2 pr-3 text-[#9499a0]">
                          {rec.daysSinceLastHosting !== null ? `${rec.daysSinceLastHosting}天` : '-'}
                        </td>
                        <td className="py-2 pr-3">{rec.totalHostingCount}</td>
                        <td className="py-2 pr-3">{rec.weekHostingCount}</td>
                        <td className="py-2 pr-3">{rec.monthHostingCount}</td>
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
