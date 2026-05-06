import { Request, Response } from 'express';
import { BilibiliService } from '../services/bilibili.service';

export class BilibiliController {
  private bilibiliService: BilibiliService;

  constructor(uid: string) {
    this.bilibiliService = new BilibiliService(uid);
  }

  // 获取用户信息
  getUserInfo = async (req: Request, res: Response) => {
    try {
      const userInfo = await this.bilibiliService.getUserInfo();
      res.json({
        success: true,
        data: userInfo
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取用户信息失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  };

  // 获取开播状态
  getLiveStatus = async (req: Request, res: Response) => {
    try {
      const liveStatus = await this.bilibiliService.getLiveStatus();
      res.json({
        success: true,
        data: liveStatus
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取开播状态失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  };

  // 获取视频列表
  getVideoList = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 30;

      const result = await this.bilibiliService.getVideoList(page, pageSize);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取视频列表失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  };

  // 获取动态列表
  getDynamicList = async (req: Request, res: Response) => {
    try {
      const dynamics = await this.bilibiliService.getDynamicList();
      res.json({
        success: true,
        data: dynamics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取动态列表失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  };
}
