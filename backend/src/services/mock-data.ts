// 模拟B站数据，用于演示
export const mockBilibiliData = {
  userInfo: {
    mid: 14636839,
    name: "斐延",
    face: "https://i1.hdslb.com/bfs/face/60291ce0490ec7e8d742844bf70fe7b976555d4f.jpg",
    sign: "直播时间：晚九点基本都在~\nQQ群给你们建好了！1090781536",
    level: 6,
    birthday: "09-07",
    sex: "保密"
  },

  videos: [
    {
      aid: 123456,
      bvid: "BV1xx411c7mD",
      title: "【游戏实况】精彩游戏时刻合集",
      pic: "https://i0.hdslb.com/bfs/archive/placeholder1.jpg",
      description: "这是一期精彩的游戏实况内容，欢迎观看！",
      created: Math.floor(Date.now() / 1000) - 86400 * 7,
      length: "15:30",
      play: 125000,
      video_review: 856
    },
    {
      aid: 123457,
      bvid: "BV1yy411c7mE",
      title: "【直播回放】深夜游戏直播精华",
      pic: "https://i0.hdslb.com/bfs/archive/placeholder2.jpg",
      description: "深夜直播的精彩瞬间回放",
      created: Math.floor(Date.now() / 1000) - 86400 * 14,
      length: "45:20",
      play: 89000,
      video_review: 432
    },
    {
      aid: 123458,
      bvid: "BV1zz411c7mF",
      title: "【教程】新手入门指南",
      pic: "https://i0.hdslb.com/bfs/archive/placeholder3.jpg",
      description: "适合新手的入门教程，从零开始学习",
      created: Math.floor(Date.now() / 1000) - 86400 * 21,
      length: "28:15",
      play: 156000,
      video_review: 1203
    },
    {
      aid: 123459,
      bvid: "BV1aa411c7mG",
      title: "【合作】与朋友的联动直播",
      pic: "https://i0.hdslb.com/bfs/archive/placeholder4.jpg",
      description: "和好朋友一起的欢乐时光",
      created: Math.floor(Date.now() / 1000) - 86400 * 28,
      length: "52:40",
      play: 203000,
      video_review: 1567
    },
    {
      aid: 123460,
      bvid: "BV1bb411c7mH",
      title: "【日常】生活Vlog分享",
      pic: "https://i0.hdslb.com/bfs/archive/placeholder5.jpg",
      description: "日常生活的点点滴滴",
      created: Math.floor(Date.now() / 1000) - 86400 * 35,
      length: "12:30",
      play: 67000,
      video_review: 389
    },
    {
      aid: 123461,
      bvid: "BV1cc411c7mI",
      title: "【攻略】游戏通关技巧分享",
      pic: "https://i0.hdslb.com/bfs/archive/placeholder6.jpg",
      description: "详细的游戏攻略和技巧讲解",
      created: Math.floor(Date.now() / 1000) - 86400 * 42,
      length: "35:45",
      play: 178000,
      video_review: 923
    }
  ],

  dynamics: [
    {
      id_str: "1001",
      type: "DYNAMIC_TYPE_DRAW",
      modules: {
        module_author: {
          name: "斐延",
          face: "https://i1.hdslb.com/bfs/face/60291ce0490ec7e8d742844bf70fe7b976555d4f.jpg",
          pub_time: "2小时前"
        },
        module_dynamic: {
          desc: {
            text: "今天的直播很开心！感谢大家的支持~ 明天晚上9点继续！"
          },
          major: {
            draw: {
              items: [
                { src: "https://i0.hdslb.com/bfs/new_dyn/placeholder1.jpg" },
                { src: "https://i0.hdslb.com/bfs/new_dyn/placeholder2.jpg" }
              ]
            }
          }
        }
      }
    },
    {
      id_str: "1002",
      type: "DYNAMIC_TYPE_FORWARD",
      modules: {
        module_author: {
          name: "斐延",
          face: "https://i1.hdslb.com/bfs/face/60291ce0490ec7e8d742844bf70fe7b976555d4f.jpg",
          pub_time: "1天前"
        },
        module_dynamic: {
          desc: {
            text: "新视频更新啦！这次带来了超级精彩的内容，快来看看吧！"
          }
        }
      }
    },
    {
      id_str: "1003",
      type: "DYNAMIC_TYPE_DRAW",
      modules: {
        module_author: {
          name: "斐延",
          face: "https://i1.hdslb.com/bfs/face/60291ce0490ec7e8d742844bf70fe7b976555d4f.jpg",
          pub_time: "3天前"
        },
        module_dynamic: {
          desc: {
            text: "周末愉快！今天休息一天，明天继续直播~"
          },
          major: {
            draw: {
              items: [
                { src: "https://i0.hdslb.com/bfs/new_dyn/placeholder3.jpg" }
              ]
            }
          }
        }
      }
    }
  ]
};
