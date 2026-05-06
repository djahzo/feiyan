import { Router } from 'express';
import { BilibiliController } from '../controllers/bilibili.controller';

export function createBilibiliRoutes(uid: string): Router {
  const router = Router();
  const controller = new BilibiliController(uid);

  // 获取用户信息
  router.get('/user', controller.getUserInfo);

  // 获取开播状态
  router.get('/live', controller.getLiveStatus);

  // 获取视频列表
  router.get('/videos', controller.getVideoList);

  // 获取动态列表
  router.get('/dynamics', controller.getDynamicList);

  return router;
}
