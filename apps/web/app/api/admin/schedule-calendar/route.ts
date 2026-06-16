import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { listCaptains, listHostingTodos, getSiteSetting } from '@/lib/db';
import type { HostingTodoRow } from '@/lib/db';
import { DEFAULT_ROTATION_CONFIG, validateRotationConfig } from '@/lib/scheduling-rotation';
import { generateSinglePeriod } from '@/lib/scheduling-calendar';
import { todayIsoDate } from '@/lib/hosting-week-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTING_KEY = 'scheduling_rotation_config';
const LEGACY_SETTING_KEY = 'scheduling_weights_config';

/**
 * POST /api/admin/schedule-calendar
 * 生成单个周期的排班日历（支持传入累积虚拟待办）
 *
 * Body:
 *   - startDate: ISO 日期（默认今天）
 *   - virtualTodos: 前序周期的虚拟待办数组（用于更新债务）
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminFromRequest(req);
    if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
    }

    const o = body as Record<string, unknown>;
    const startDate = typeof o.startDate === 'string' ? o.startDate : todayIsoDate();
    const virtualTodos = Array.isArray(o.virtualTodos) ? (o.virtualTodos as HostingTodoRow[]) : [];

    const captains = await listCaptains();
    const todos = await listHostingTodos();

    const saved = await getSiteSetting(SETTING_KEY);
    const legacy = saved ? null : await getSiteSetting(LEGACY_SETTING_KEY);
    const config = validateRotationConfig(saved ?? legacy) || DEFAULT_ROTATION_CONFIG;

    if (!config.enabled) {
      return NextResponse.json({
        data: { days: [], newVirtualTodos: [] },
        message: '智能排期功能已禁用',
      });
    }

    const result = generateSinglePeriod(captains, todos, virtualTodos, config, startDate);

    return NextResponse.json({ data: result, config });
  } catch (e) {
    console.error('[schedule-calendar POST]', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? `生成日历失败: ${msg}` : '生成日历失败' },
      { status: 500 },
    );
  }
}
