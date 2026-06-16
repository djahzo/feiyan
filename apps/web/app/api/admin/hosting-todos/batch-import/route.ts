import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { createHostingTodo, listHostingTodos } from '@/lib/db';
import { analyzeRoleScheduleConflict } from '@/lib/hosting-todo-schedule';
import { DEFAULT_HOST_TYPE } from '@/lib/hosting-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type BatchImportItem = {
  date: string;
  roleName: string;
  hostType?: string;
};

/**
 * POST /api/admin/hosting-todos/batch-import
 * 批量导入排班（来自智能排期日历）
 *
 * Body:
 *   - items: BatchImportItem[]
 *   - skipConflicts: boolean (冲突时跳过该条，默认 false = 遇冲突整体回滚)
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
    const items = Array.isArray(o.items) ? o.items : [];
    const skipConflicts = Boolean(o.skipConflicts);

    if (items.length === 0) {
      return NextResponse.json({ error: '导入列表为空' }, { status: 400 });
    }

    const parsed: BatchImportItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i] as Record<string, unknown>;
      const date = String(it.date ?? '').trim();
      const roleName = String(it.roleName ?? '').trim();
      if (!DATE_RE.test(date)) {
        return NextResponse.json({ error: `第 ${i + 1} 条日期格式错误: ${date}` }, { status: 400 });
      }
      if (!roleName) {
        return NextResponse.json({ error: `第 ${i + 1} 条角色名为空` }, { status: 400 });
      }
      parsed.push({
        date,
        roleName,
        hostType: typeof it.hostType === 'string' ? it.hostType : DEFAULT_HOST_TYPE,
      });
    }

    const existingTodos = await listHostingTodos();
    const results: Array<{ date: string; roleName: string; status: 'created' | 'skipped'; reason?: string }> = [];
    const created: number[] = [];

    for (const item of parsed) {
      const conflict = analyzeRoleScheduleConflict(existingTodos, {
        targetDate: item.date,
        roleName: item.roleName,
      });

      if (conflict.sameDayBlocked) {
        if (skipConflicts) {
          results.push({ ...item, status: 'skipped', reason: '当日已有该舰长' });
          continue;
        } else {
          return NextResponse.json(
            { error: `${item.date} 当日已有 ${item.roleName}，导入失败（可启用"跳过冲突"选项）` },
            { status: 409 },
          );
        }
      }

      // weekNeedsAck 不阻止批量导入（允许密集排班）
      const hostType = item.hostType || DEFAULT_HOST_TYPE;
      const id = await createHostingTodo({
        todo_date: item.date,
        role_name: item.roleName,
        host_type: hostType,
        stuck_task: 0,
      });

      created.push(id);
      results.push({ ...item, status: 'created' });

      // 模拟追加到 existingTodos，避免同一批次内重复
      existingTodos.push({
        id,
        todo_date: item.date,
        role_name: item.roleName,
        host_type: hostType,
        stuck_task: 0,
        sort_order: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    }

    return NextResponse.json({
      ok: true,
      message: `成功导入 ${created.length} 条，跳过 ${results.filter((r) => r.status === 'skipped').length} 条`,
      results,
    });
  } catch (e) {
    console.error('[batch-import POST]', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? `导入失败: ${msg}` : '批量导入失败' },
      { status: 500 },
    );
  }
}
