import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { listCaptains, listHostingTodos, getSiteSetting } from '@/lib/db';
import { DEFAULT_ROTATION_CONFIG, validateRotationConfig } from '@/lib/scheduling-rotation';
import { generateMultiplePeriods } from '@/lib/scheduling-calendar';
import { todayIsoDate } from '@/lib/hosting-week-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTING_KEY = 'scheduling_rotation_config';
const LEGACY_SETTING_KEY = 'scheduling_weights_config';

/**
 * GET /api/admin/schedule-calendar
 * 生成多个周期的排班日历
 *
 * Query params:
 *   - startDate: ISO 日期（默认今天）
 *   - periods: 生成几个周期（默认 1）
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminFromRequest(req);
    if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || todayIsoDate();
    const periods = parseInt(searchParams.get('periods') || '1', 10);

    const captains = await listCaptains();
    const todos = await listHostingTodos();

    const saved = await getSiteSetting(SETTING_KEY);
    const legacy = saved ? null : await getSiteSetting(LEGACY_SETTING_KEY);
    const config = validateRotationConfig(saved ?? legacy) || DEFAULT_ROTATION_CONFIG;

    if (!config.enabled) {
      return NextResponse.json({
        data: [],
        message: '智能排期功能已禁用',
      });
    }

    const calendar = generateMultiplePeriods(captains, todos, config, periods, startDate);

    return NextResponse.json({ data: calendar, config });
  } catch (e) {
    console.error('[schedule-calendar GET]', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? `生成日历失败: ${msg}` : '生成日历失败' },
      { status: 500 },
    );
  }
}
