'use client';

import { useCallback, useEffect, useState } from 'react';
import { c } from '@/components/admin/admin-theme';
import type { SchedulingWeightsConfig } from '@/lib/scheduling-weights';
import type { CaptainRecommendation } from '@/lib/scheduling-weights';

export default function SchedulingConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [config, setConfig] = useState<SchedulingWeightsConfig>({
    daysSinceLastWeight: 1.0,
    shipTierWeight: 0.3,
    frequencyPenaltyWeight: 0.2,
    newCaptainScore: 99999,
    enabled: true,
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className={`border-b ${c.line} bg-white px-6 py-4`}>
        <div>
          <h1 className="text-xl font-semibold">排期权重配置</h1>
          <p className={`mt-1 text-sm ${c.sub}`}>配置智能推荐系统的权重参数</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>}

        {toast && (
          <div className="fixed right-6 top-6 z-50 rounded-md bg-green-500 px-4 py-2 text-white shadow-lg">
            {toast}
          </div>
        )}

        <div className={`${c.card} max-w-3xl`}>
          <h3 className="text-lg font-semibold">权重模型</h3>
          <p className="mt-2 text-sm text-[#61666d]">
            分数 = (距上次托管天数 × 时间因子) + (等级分数 × 等级因子) - (历史次数 × 频率惩罚)
          </p>

          <div className="mt-6 space-y-6">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">启用智能推荐</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#61666d]">
                时间因子权重 <span className="text-[#9499a0]">（推荐: 1.0）</span>
              </label>
              <p className="mt-1 text-xs text-[#9499a0]">距离上次托管的天数越多，权重分数越高</p>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={config.daysSinceLastWeight}
                onChange={(e) => setConfig({ ...config, daysSinceLastWeight: parseFloat(e.target.value) || 0 })}
                className={c.input + ' mt-2'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#61666d]">
                等级因子权重 <span className="text-[#9499a0]">（推荐: 0.3）</span>
              </label>
              <p className="mt-1 text-xs text-[#9499a0]">总督=3分、提督=2分、舰长=1分，乘以此系数</p>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={config.shipTierWeight}
                onChange={(e) => setConfig({ ...config, shipTierWeight: parseFloat(e.target.value) || 0 })}
                className={c.input + ' mt-2'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#61666d]">
                频率惩罚权重 <span className="text-[#9499a0]">（推荐: 0.2）</span>
              </label>
              <p className="mt-1 text-xs text-[#9499a0]">历史托管次数越多，扣减的分数越多，避免重复安排</p>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={config.frequencyPenaltyWeight}
                onChange={(e) => setConfig({ ...config, frequencyPenaltyWeight: parseFloat(e.target.value) || 0 })}
                className={c.input + ' mt-2'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#61666d]">
                新舰长默认分数 <span className="text-[#9499a0]">（推荐: 99999）</span>
              </label>
              <p className="mt-1 text-xs text-[#9499a0]">从未托管过的新舰长直接获得此分数，确保优先安排</p>
              <input
                type="number"
                step="1"
                min="0"
                max="999999"
                value={config.newCaptainScore}
                onChange={(e) => setConfig({ ...config, newCaptainScore: parseInt(e.target.value, 10) || 0 })}
                className={c.input + ' mt-2'}
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => void save()} disabled={saving} className={c.btnPrimary}>
              {saving ? '保存中...' : '保存配置'}
            </button>
            <button type="button" onClick={() => void preview()} className={c.btnGhost}>
              预览推荐结果
            </button>
          </div>
        </div>

        {showPreview && (
          <div className={`${c.card} mt-6 max-w-5xl`}>
            <h3 className="text-lg font-semibold">推荐结果预览（Top 20）</h3>
            <p className="mt-1 text-sm text-[#9499a0]">基于当前配置计算的舰长优先级排序</p>

            {recommendations.length === 0 ? (
              <p className="mt-4 text-center text-[#9499a0]">暂无数据</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#e3e5e7]">
                    <tr className="text-left">
                      <th className="pb-2 pr-4 font-medium text-[#61666d]">排名</th>
                      <th className="pb-2 pr-4 font-medium text-[#61666d]">舰长</th>
                      <th className="pb-2 pr-4 font-medium text-[#61666d]">等级</th>
                      <th className="pb-2 pr-4 font-medium text-[#61666d]">权重分数</th>
                      <th className="pb-2 pr-4 font-medium text-[#61666d]">距上次天数</th>
                      <th className="pb-2 pr-4 font-medium text-[#61666d]">历史次数</th>
                      <th className="pb-2 pr-4 font-medium text-[#61666d]">最近托管</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map((rec, idx) => (
                      <tr key={rec.captainId} className="border-b border-[#f6f7f8]">
                        <td className="py-2 pr-4">
                          <span className={idx < 3 ? 'font-bold text-[#fb7299]' : ''}>{idx + 1}</span>
                        </td>
                        <td className="py-2 pr-4 font-medium">{rec.displayName}</td>
                        <td className="py-2 pr-4 text-[#9499a0]">{rec.shipTier || '舰长'}</td>
                        <td className="py-2 pr-4">
                          <span className="font-semibold text-[#00a1d6]">{rec.score.toFixed(1)}</span>
                          {rec.isNewCaptain && (
                            <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">新</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {rec.daysSinceLastHosting !== null ? `${rec.daysSinceLastHosting} 天` : '-'}
                        </td>
                        <td className="py-2 pr-4">{rec.totalHostingCount} 次</td>
                        <td className="py-2 pr-4 text-[#9499a0]">{rec.lastHostingDate || '-'}</td>
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
