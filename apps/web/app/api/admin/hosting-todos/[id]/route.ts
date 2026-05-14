import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { deleteHostingTodo, getHostingTodoById, listHostingTodos, moveHostingTodoToDate, updateHostingTodo } from '@/lib/db';
import { analyzeRoleScheduleConflict } from '@/lib/hosting-todo-schedule';
import { DEFAULT_HOST_TYPE, parseHostType } from '@/lib/hosting-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function mapRow(r: Awaited<ReturnType<typeof listHostingTodos>>[number]) {
  return {
    id: r.id,
    todoDate: r.todo_date,
    roleName: r.role_name,
    hostType: r.host_type,
    stuckTask: !!r.stuck_task,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '无效 id' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const cur = await getHostingTodoById(id);
  if (!cur) return NextResponse.json({ error: '不存在' }, { status: 404 });

  const todoDateInBody = 'todoDate' in o;
  const nextDate = todoDateInBody ? String(o.todoDate ?? '').trim() : cur.todo_date;
  if (todoDateInBody && !DATE_RE.test(nextDate)) {
    return NextResponse.json({ error: '日期格式须为 YYYY-MM-DD' }, { status: 400 });
  }

  const roleNameInBody = 'roleName' in o;
  if (roleNameInBody && !String(o.roleName ?? '').trim()) {
    return NextResponse.json({ error: '角色名不能为空' }, { status: 400 });
  }
  const nextRole = roleNameInBody ? String(o.roleName ?? '').trim() : cur.role_name;

  const confirmWeek = Boolean(o.confirmWeekOverlap);
  const placementChanges =
    (todoDateInBody && nextDate !== cur.todo_date) || (roleNameInBody && nextRole !== cur.role_name);

  if (placementChanges) {
    const all = await listHostingTodos();
    const conflict = analyzeRoleScheduleConflict(all, { targetDate: nextDate, roleName: nextRole, excludeId: id });
    if (conflict.sameDayBlocked) {
      return NextResponse.json(
        { code: 'SAME_DAY_ROLE', error: '当日已有该角色/舰长安排，不可重复添加' },
        { status: 409 },
      );
    }
    if (conflict.weekNeedsAck && !confirmWeek) {
      return NextResponse.json(
        {
          code: 'WEEK_ROLE_OVERLAP',
          error: '最近一周已有该老板的宠幸计划',
          requiresConfirm: true,
        },
        { status: 409 },
      );
    }
  }

  if (todoDateInBody && nextDate !== cur.todo_date) {
    const moved = await moveHostingTodoToDate(id, nextDate);
    if (!moved) return NextResponse.json({ error: '移动失败' }, { status: 500 });
  }

  const patch: Parameters<typeof updateHostingTodo>[1] = {};
  if (roleNameInBody) patch.role_name = nextRole;
  if ('hostType' in o) {
    const ht = parseHostType(o.hostType);
    patch.host_type = ht ?? DEFAULT_HOST_TYPE;
  }
  if ('stuckTask' in o) patch.stuck_task = Boolean(o.stuckTask) ? 1 : 0;

  if (Object.keys(patch).length > 0) {
    const ok = await updateHostingTodo(id, patch);
    if (!ok) return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }

  const row = await getHostingTodoById(id);
  return NextResponse.json({ ok: true, data: row ? mapRow(row) : null });
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getAdminFromRequest(req);
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '无效 id' }, { status: 400 });
  const ok = await deleteHostingTodo(id);
  if (!ok) return NextResponse.json({ error: '不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
