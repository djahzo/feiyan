import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-session';
import { listHostingTodos, listCaptains } from '@/lib/db';
import {
  analyzeCaptainFrequency,
  analyzeDateHosting,
  analyzeHostTypeDistribution,
  getTimeRangeStats,
  exportToCsv,
} from '@/lib/analytics';
import { addDaysIso } from '@/lib/hosting-todo-schedule';
import { todayIsoDate } from '@/lib/hosting-week-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminFromRequest(req);
    if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'summary';
    const format = searchParams.get('format') || 'json';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const todos = await listHostingTodos();

    // 默认时间范围：最近90天
    const today = todayIsoDate();
    const start = startDate || addDaysIso(today, -90);
    const end = endDate || today;

    if (type === 'captain-frequency') {
      const data = analyzeCaptainFrequency(todos, start, end);

      if (format === 'csv') {
        const csv = exportToCsv(data);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="captain-frequency-${start}-${end}.csv"`,
          },
        });
      }

      return NextResponse.json({ data });
    }

    if (type === 'date-hosting') {
      const data = analyzeDateHosting(todos, start, end);

      if (format === 'csv') {
        const csv = exportToCsv(data);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="date-hosting-${start}-${end}.csv"`,
          },
        });
      }

      return NextResponse.json({ data });
    }

    if (type === 'host-type-distribution') {
      const data = analyzeHostTypeDistribution(todos, start, end);
      return NextResponse.json({ data });
    }

    if (type === 'summary') {
      const data = getTimeRangeStats(todos, start, end);
      return NextResponse.json({ data });
    }

    if (type === 'export-all') {
      // 导出所有托管记录
      const filtered = todos.filter((t) => t.todo_date >= start && t.todo_date <= end);
      const headers = ['日期', '舰长名称', '托管类型', '是否卡任务', '创建时间', '更新时间'];
      const rows = filtered.map((t) => [
        t.todo_date,
        t.role_name,
        t.host_type === 'scan' ? '扫号' : '组排',
        t.stuck_task ? '是' : '否',
        new Date(t.created_at).toLocaleString('zh-CN'),
        new Date(t.updated_at).toLocaleString('zh-CN'),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hosting-todos-${start}-${end}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: '不支持的类型' }, { status: 400 });
  } catch (e) {
    console.error('[analytics GET]', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? `分析失败: ${msg}` : '数据分析失败' },
      { status: 500 }
    );
  }
}
