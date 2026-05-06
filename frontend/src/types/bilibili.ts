export interface BilibiliUserInfo {
  mid: number;
  name: string;
  face: string;
  sign: string;
  level: number;
  birthday: string;
  sex: string;
}

export interface BilibiliLiveStatus {
  live_status: number; // 0=未开播, 1=直播中
  room_id: number;
  title: string;
  cover: string;
  url: string;
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
