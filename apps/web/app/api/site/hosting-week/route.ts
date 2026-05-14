import { NextResponse } from 'next/server';
import { captainAvatarUrlForPublicSite, captainRowToDto, type CaptainApiDto } from '@/lib/captain-dto';
import { captainScheduleName } from '@/lib/captain-schedule-name';
import { listCaptains, listHostingLeaveDates, listHostingTodos } from '@/lib/db';
import { DEFAULT_HOST_TYPE, isHostType } from '@/lib/hosting-types';
import { isoDatesCurrentWeek, todayIsoDate } from '@/lib/hosting-week-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const weekDates = isoDatesCurrentWeek(todayIsoDate());
    const set = new Set(weekDates);
    const [rows, capRows, leaveAll] = await Promise.all([listHostingTodos(), listCaptains(), listHostingLeaveDates()]);
    const captains = capRows.map(captainRowToDto);

    function findCaptain(roleName: string): CaptainApiDto | null {
      const n = roleName.trim();
      for (const c of captains) {
        if (captainScheduleName(c) === n) return c;
      }
      return null;
    }

    const todos = rows
      .filter(r => set.has(r.todo_date))
      .map(r => {
        const hostType = isHostType(r.host_type) ? r.host_type : DEFAULT_HOST_TYPE;
        const cap = findCaptain(r.role_name);
        const captainId = cap?.id ?? null;
        return {
          id: r.id,
          todoDate: r.todo_date,
          roleName: r.role_name,
          hostType,
          stuckTask: !!r.stuck_task,
          sortOrder: r.sort_order,
          captainId,
          avatarUrl: cap ? captainAvatarUrlForPublicSite(cap) : null,
          avatarUpdatedAt: cap ? cap.updatedAt : null,
        };
      })
      .sort(
        (a, b) =>
          a.todoDate.localeCompare(b.todoDate) || a.sortOrder - b.sortOrder || a.id - b.id,
      );

    const leaveDates = leaveAll.filter(d => set.has(d));

    return NextResponse.json({ data: { weekDates, todos, leaveDates } });
  } catch (e) {
    console.error('[site/hosting-week]', e);
    return NextResponse.json({ error: '加载失败' }, { status: 500 });
  }
}
