import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { listCaptains, listHostingTodos, getSiteSetting } from '@/lib/db';
import {
  getTopRecommendations,
  DEFAULT_WEIGHTS_CONFIG,
  validateWeightsConfig,
} from '@/lib/scheduling-weights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTING_KEY = 'scheduling_weights_config';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminFromRequest(req);
    if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const topN = parseInt(searchParams.get('top') || '10', 10);
    const includeExcluded = searchParams.get('includeExcluded') === '1';

    const captains = await listCaptains();
    const todos = await listHostingTodos();

    const saved = await getSiteSetting(SETTING_KEY);
    const config = saved ? validateWeightsConfig(saved) : null;
    const weightsConfig = config || DEFAULT_WEIGHTS_CONFIG;

    if (!weightsConfig.enabled) {
      return NextResponse.json({
        data: [],
        message: '智能推荐功能已禁用',
        config: weightsConfig,
      });
    }

    const recommendations = getTopRecommendations(
      captains,
      todos,
      Number.isFinite(topN) && topN > 0 ? topN : 10,
      weightsConfig,
      includeExcluded,
    );

    return NextResponse.json({
      data: recommendations,
      config: weightsConfig,
    });
  } catch (e) {
    console.error('[recommendations GET]', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? `推荐失败: ${msg}` : '获取推荐失败' },
      { status: 500 },
    );
  }
}
