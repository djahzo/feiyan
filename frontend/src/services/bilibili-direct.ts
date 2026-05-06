import axios from 'axios';
import {
  BilibiliUserInfo,
  BilibiliVideo,
  BilibiliDynamicItem
} from '../types/bilibili';

// B站API基础URL
const BILIBILI_API_BASE = 'https://api.bilibili.com';

// 配置的B站UID
const BILIBILI_UID = '14636839';

// 创建axios实例，配置请求头
const bilibiliRequest = axios.create({
  timeout: 10000,
  headers: {
    'Referer': 'https://www.bilibili.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

// 简单的内存缓存
interface CacheItem {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheItem>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

function getCache(key: string): any | null {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export const bilibiliApi = {
  // 获取用户基本信息
  async getUserInfo(): Promise<BilibiliUserInfo> {
    const cacheKey = `user_${BILIBILI_UID}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('从缓存获取用户信息');
      return cached;
    }

    try {
      const response = await bilibiliRequest.get(
        `${BILIBILI_API_BASE}/x/space/acc/info`,
        { params: { mid: BILIBILI_UID } }
      );

      if (response.data.code === 0) {
        const userInfo = response.data.data;
        setCache(cacheKey, userInfo);
        return userInfo;
      }

      throw new Error(response.data.message || '获取用户信息失败');
    } catch (error: any) {
      console.error('获取用户信息失败:', error);
      throw new Error('获取用户信息失败，请稍后重试');
    }
  },

  // 获取用户关系统计（粉丝数、关注数）
  async getUserStats() {
    const cacheKey = `stats_${BILIBILI_UID}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await bilibiliRequest.get(
        `${BILIBILI_API_BASE}/x/relation/stat`,
        { params: { vmid: BILIBILI_UID } }
      );

      if (response.data.code === 0) {
        const stats = response.data.data;
        setCache(cacheKey, stats);
        return stats;
      }

      return { follower: 0, following: 0 };
    } catch (error) {
      console.error('获取用户统计失败:', error);
      return { follower: 0, following: 0 };
    }
  },

  // 获取开播状态
  async getLiveStatus() {
    const cacheKey = `live_${BILIBILI_UID}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get(
        'https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids',
        {
          params: { 'uids[]': BILIBILI_UID },
          timeout: 10000
        }
      );

      if (response.data.code === 0 && response.data.data) {
        const liveInfo = response.data.data[BILIBILI_UID];
        const status = {
          live_status: liveInfo?.live_status || 0, // 0=未开播, 1=直播中
          room_id: liveInfo?.room_id || 0,
          title: liveInfo?.title || '',
          cover: liveInfo?.cover || '',
          url: liveInfo?.room_id ? `https://live.bilibili.com/${liveInfo.room_id}` : ''
        };
        setCache(cacheKey, status);
        return status;
      }

      return { live_status: 0, room_id: 0, title: '', cover: '', url: '' };
    } catch (error) {
      console.error('获取开播状态失败:', error);
      return { live_status: 0, room_id: 0, title: '', cover: '', url: '' };
    }
  },

  // 获取视频列表（使用公开API，无需WBI签名）
  async getVideoList(page: number = 1, pageSize: number = 30) {
    const cacheKey = `videos_${BILIBILI_UID}_${page}_${pageSize}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('从缓存获取视频列表');
      return cached;
    }

    try {
      // 使用公开API（无需WBI签名）
      const response = await bilibiliRequest.get(
        `${BILIBILI_API_BASE}/x/space/wbi/arc/search`,
        {
          params: {
            mid: BILIBILI_UID,
            pn: page,
            ps: Math.min(pageSize, 50), // 最大50
            order: 'pubdate' // pubdate=最新, views=播放量, favorite=收藏
          }
        }
      );

      if (response.data.code === 0 && response.data.data?.list?.vlist) {
        const result = {
          videos: response.data.data.list.vlist,
          total: response.data.data.page?.count || 0
        };
        setCache(cacheKey, result);
        return result;
      }

      throw new Error('视频列表格式错误');
    } catch (error: any) {
      console.error('获取视频列表失败:', error.message);
      throw new Error('获取视频列表失败，请稍后重试');
    }
  },

  // 获取动态列表（可能需要登录，失败时返回空数组）
  async getDynamicList(): Promise<BilibiliDynamicItem[]> {
    const cacheKey = `dynamics_${BILIBILI_UID}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('从缓存获取动态列表');
      return cached;
    }

    try {
      const response = await bilibiliRequest.get(
        `${BILIBILI_API_BASE}/x/polymer/web-dynamic/v1/feed/space`,
        { params: { host_mid: BILIBILI_UID } }
      );

      if (response.data.code === 0 && response.data.data.items) {
        const items = response.data.data.items;
        setCache(cacheKey, items);
        return items;
      }

      console.warn('动态接口返回错误，可能需要登录');
      return [];
    } catch (error) {
      console.error('获取动态列表失败:', error);
      // 动态接口失败时返回空数组，不影响其他功能
      return [];
    }
  }
};
