import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { getSiteSetting, setSiteSetting } from '@/lib/db';
import { DEFAULT_ROTATION_CONFIG, validateRotationConfig } from '@/lib/scheduling-rotation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTING_KEY = 'scheduling_rotation_config';
/** 旧版权重模型的存储 key，仅用于一次性迁移读取 */
const LEGACY_SETTING_KEY = 'scheduling_weights_config';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminFromRequest(req);
    if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

    // 优先读新 key；缺失时回退到旧 key 做平滑迁移（validateRotationConfig 兼容旧字段名）
    const saved = await getSiteSetting(SETTING_KEY);
    const legacy = saved ? null : await getSiteSetting(LEGACY_SETTING_KEY);
    const config = validateRotationConfig(saved ?? legacy);

    return NextResponse.json({ data: config || DEFAULT_ROTATION_CONFIG });
  } catch (e) {
    console.error('[scheduling-config GET]', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? `加载失败: ${msg}` : '加载配置失败' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAdminFromRequest(req);
    if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
    }

    const config = validateRotationConfig(body);
    if (!config) {
      return NextResponse.json({ error: '配置格式不正确' }, { status: 400 });
    }

    if (config.dailySlots < 1 || config.dailySlots > 10) {
      return NextResponse.json({ error: '每日名额必须在 1-10 之间' }, { status: 400 });
    }

    await setSiteSetting(SETTING_KEY, config);
    return NextResponse.json({ ok: true, data: config });
  } catch (e) {
    console.error('[scheduling-config PUT]', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? `保存失败: ${msg}` : '保存配置失败' },
      { status: 500 },
    );
  }
}
