import axios from 'axios';
import {
  BilibiliUserInfo,
  BilibiliVideo,
  BilibiliLiveStatus,
  BilibiliDynamicItem
} from '../types/bilibili';

const API_BASE = '/api/bilibili';

export const bilibiliApi = {
  // 获取用户信息
  async getUserInfo(): Promise<BilibiliUserInfo> {
    const response = await axios.get(`${API_BASE}/user`);
    return response.data.data;
  },

  // 获取开播状态
  async getLiveStatus(): Promise<BilibiliLiveStatus> {
    const response = await axios.get(`${API_BASE}/live`);
    return response.data.data;
  },

  // 获取视频列表
  async getVideoList(page: number = 1, pageSize: number = 30) {
    const response = await axios.get(`${API_BASE}/videos`, {
      params: { page, pageSize }
    });
    return response.data.data;
  },

  // 获取动态列表
  async getDynamicList(): Promise<BilibiliDynamicItem[]> {
    const response = await axios.get(`${API_BASE}/dynamics`);
    return response.data.data;
  }
};
