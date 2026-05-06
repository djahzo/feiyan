// B站API响应类型定义

export interface BilibiliUserInfo {
  mid: number;
  name: string;
  face: string;
  sign: string;
  level: number;
  birthday: string;
  sex: string;
}

export interface BilibiliUserInfoResponse {
  code: number;
  message: string;
  data: BilibiliUserInfo;
}

export interface BilibiliLiveStatus {
  live_status: number; // 0=未开播, 1=直播中
  room_id: number;
  title: string;
  cover: string;
  url: string;
}

export interface BilibiliLiveStatusResponse {
  code: number;
  message: string;
  data: {
    [uid: string]: {
      live_status: number;
      room_id: number;
      title: string;
      cover: string;
      cover_from_user: string;
      uid: number;
      uname: string;
    };
  };
}

export interface BilibiliVideo {
  aid: number;
  bvid: string;
  title: string;
  pic: string;
  description: string;
  created: number;
  length: string;
  play: number;
  video_review: number;
}

export interface BilibiliVideoListResponse {
  code: number;
  message: string;
  data: {
    list: {
      vlist: BilibiliVideo[];
    };
    page: {
      pn: number;
      ps: number;
      count: number;
    };
  };
}

export interface BilibiliDynamicItem {
  id_str: string;
  type: string;
  modules: {
    module_author?: {
      name: string;
      face: string;
      pub_time: string;
    };
    module_dynamic?: {
      desc?: {
        text: string;
      };
      major?: {
        archive?: {
          title: string;
          cover: string;
          desc: string;
        };
        draw?: {
          items: Array<{
            src: string;
          }>;
        };
      };
    };
  };
}

export interface BilibiliDynamicResponse {
  code: number;
  message: string;
  data: {
    items: BilibiliDynamicItem[];
  };
}
