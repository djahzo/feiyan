import axios from 'axios';
import {
  BilibiliUserInfoResponse,
  BilibiliVideoListResponse,
  BilibiliDynamicResponse,
  BilibiliLiveStatusResponse
} from '../types/bilibili';

const BILIBILI_API_BASE = 'https://api.bilibili.com';
const BILIBILI_LIVE_API = 'https://api.live.bilibili.com';

// 通用请求头，模拟真实浏览器
const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://space.bilibili.com/',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
});

// 请求延迟函数，避免触发频率限制
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export class BilibiliService {
  private uid: string;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 1000; // 最小请求间隔1秒

  constructor(uid: string) {
    this.uid = uid;
  }

  // 请求前等待，确保不会过于频繁
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await delay(this.minRequestInterval - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  // 获取用户基本信息
  async getUserInfo() {
    const cacheKey = `user_${this.uid}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('从缓存获取用户信息');
      return cached;
    }

    try {
      await this.waitForRateLimit();

      const response = await axios.get<BilibiliUserInfoResponse>(
        `${BILIBILI_API_BASE}/x/space/acc/info`,
        {
          params: { mid: this.uid },
          headers: getHeaders(),
          timeout: 10000
        }
      );

      if (response.data.code === 0) {
        const userInfo = response.data.data;
        setCache(cacheKey, userInfo);
        return userInfo;
      }

      throw new Error(response.data.message || '获取用户信息失败');
    } catch (error: any) {
      console.error('获取用户信息失败:', error.message);
      throw new Error('获取用户信息失败，请稍后重试');
    }
  }

  // 获取开播状态（公开接口，无需登录）
  async getLiveStatus() {
    const cacheKey = `live_${this.uid}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('从缓存获取开播状态');
      return cached;
    }

    try {
      await this.waitForRateLimit();

      const response = await axios.get<BilibiliLiveStatusResponse>(
        `${BILIBILI_LIVE_API}/room/v1/Room/get_status_info_by_uids`,
        {
          params: { 'uids[]': this.uid },
          headers: getHeaders(),
          timeout: 10000
        }
      );

      if (response.data.code === 0 && response.data.data) {
        const liveInfo = response.data.data[this.uid];
        const status = {
          live_status: liveInfo?.live_status || 0,
          room_id: liveInfo?.room_id || 0,
          title: liveInfo?.title || '',
          cover: liveInfo?.cover_from_user || liveInfo?.cover || '',
          url: liveInfo?.room_id ? `https://live.bilibili.com/${liveInfo.room_id}` : ''
        };
        setCache(cacheKey, status);
        console.log('开播状态:', status);
        return status;
      }

      return { live_status: 0, room_id: 0, title: '', cover: '', url: '' };
    } catch (error: any) {
      console.error('获取开播状态失败:', error.message);
      return { live_status: 0, room_id: 0, title: '', cover: '', url: '' };
    }
  }

  // 获取视频列表（使用旧版公开API，无需WBI签名）
  async getVideoList(page: number = 1, pageSize: number = 30) {
    const cacheKey = `videos_${this.uid}_${page}_${pageSize}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('从缓存获取视频列表');
      return cached;
    }

    try {
      await this.waitForRateLimit();

      // 使用旧版API，无需WBI签名
      const response = await axios.get<BilibiliVideoListResponse>(
        `${BILIBILI_API_BASE}/x/space/arc/search`,
        {
          params: {
            mid: this.uid,
            pn: page,
            ps: Math.min(pageSize, 50),
            order: 'pubdate'
          },
          headers: getHeaders(),
          timeout: 10000
        }
      );

      if (response.data.code === 0 && response.data.data?.list?.vlist) {
        const result = {
          videos: response.data.data.list.vlist,
          total: response.data.data.page?.count || 0
        };
        setCache(cacheKey, result);
        console.log(`获取到 ${result.videos.length} 个视频`);
        return result;
      }

      throw new Error(response.data.message || '视频列表格式错误');
    } catch (error: any) {
      console.error('获取视频列表失败:', error.message);
      return { videos: [], total: 0 };
    }
  }

  // 获取动态列表（可能需要登录，失败时返回空数组）
  async getDynamicList() {
    const cacheKey = `dynamics_${this.uid}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('从缓存获取动态列表');
      return cached;
    }

    try {
      await this.waitForRateLimit();

      const response = await axios.get<BilibiliDynamicResponse>(
        `${BILIBILI_API_BASE}/x/polymer/web-dynamic/v1/feed/space`,
        {
          params: { host_mid: this.uid },
          headers: getHeaders(),
          timeout: 10000
        }
      );

      if (response.data.code === 0 && response.data.data?.items) {
        const items = response.data.data.items;
        setCache(cacheKey, items);
        return items;
      }

      console.warn('动态接口返回错误，可能需要登录');
      return [];
    } catch (error) {
      console.error('获取动态列表失败:', error);
      return [];
    }
  }
}
