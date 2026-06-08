import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { getSiteSetting, setSiteSetting } from '@/lib/db';
import { DEFAULT_WEIGHTS_CONFIG, validateWeightsConfig } from '@/lib/scheduling-weights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTING_KEY = 'scheduling_weights_config';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminFromRequest(req);
    if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const saved = await getSiteSetting(SETTING_KEY);
    const config = saved ? validateWeightsConfig(saved) : null;

    return NextResponse.json({ data: config || DEFAULT_WEIGHTS_CONFIG });
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

    const config = validateWeightsConfig(body);
    if (!config) {
      return NextResponse.json({ error: '配置格式不正确' }, { status: 400 });
    }

    // 范围二次校验（validateWeightsConfig 已校验各因子权重，这里只做名额额外检查）
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
