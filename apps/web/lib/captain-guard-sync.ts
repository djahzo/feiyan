import { bilibiliGuardLevelToShipTier } from '@/lib/captain-ship';
import { fetchGuardTabTotalMembers } from '@/lib/bilibili-guard';
import { getLiveStatus } from '@/lib/bilibili';
import { createCaptain, getCaptainByUid, updateCaptain } from '@/lib/db';

export type GuardSyncResult = {
  created: number;
  updated: number;
  skippedNoTier: number;
  fetchedCount: number;
  /** 给运营看的说明，不存库 */
  hint: string;
};

/**
 * 从 B 站大航海总榜拉取成员并写入/更新 captains。
 * 始终保留：备注名称、备注、微信备注、游戏 ID 备注、上舰时间、本地上传头像（avatar_filename）。
 * 会更新：B 站昵称（id_name）、大航海档位（ship_tier）、B 站头像 URL（bilibili_face_url，供列表展示；有本地上传时仍以本地为准）。
 */
export async function syncCaptainsFromBilibiliGuardTab(): Promise<GuardSyncResult> {
  const uid = (process.env.BILIBILI_UID || '').trim();
  if (!uid) throw new Error('未配置环境变量 BILIBILI_UID');

  const live = await getLiveStatus(uid);
  const roomId = Number(live.room_id);
  if (!Number.isFinite(roomId) || roomId <= 0) {
    throw new Error('无法获取直播间 room_id：请确认该 UID 已开通直播间，或稍后再试');
  }

  const members = await fetchGuardTabTotalMembers(roomId, uid);
  let created = 0;
  let updated = 0;
  let skippedNoTier = 0;

  for (const m of members) {
    const tier = bilibiliGuardLevelToShipTier(m.guardLevel);
    if (tier == null) {
      skippedNoTier += 1;
      continue;
    }

    const existing = await getCaptainByUid(m.uid);
    if (!existing) {
      await createCaptain({
        uid: m.uid,
        id_name: m.name,
        remark_name: null,
        note: null,
        wechat_remark: null,
        game_id_remark: null,
        ship_tier: tier,
        shipped_at: null,
        bilibili_face_url: m.faceUrl,
      });
      created += 1;
    } else {
      await updateCaptain(existing.id, { id_name: m.name, ship_tier: tier, bilibili_face_url: m.faceUrl });
      updated += 1;
    }
  }

  return {
    created,
    updated,
    skippedNoTier,
    fetchedCount: members.length,
    hint:
      '大航海榜单接口不提供精确的「开通/续费时间」或合同到期日；本站到期仍依赖你填写的「上舰时间」+ 档位周期推算。' +
      ' 已过期且已下榜的用户不会出现在本次拉取结果中，但库里原有记录不会被自动删除，可对照「到期」列手动清理或保留归档。',
  };
}
