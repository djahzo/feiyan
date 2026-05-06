# B站API接入说明文档

## 一、无需认证可获取的公开数据

根据测试和文档，以下B站API接口**无需登录认证**即可访问：

### 1. 用户基本信息
```
GET https://api.bilibili.com/x/space/acc/info?mid={用户UID}
```
**可获取数据**：
- 用户昵称、头像、签名
- 等级、性别、生日
- 会员状态
- 直播间信息

### 2. 用户关系统计
```
GET https://api.bilibili.com/x/relation/stat?vmid={用户UID}
```
**可获取数据**：
- 粉丝数（follower）
- 关注数（following）

**测试结果**：✅ 成功获取
```json
{
  "code": 0,
  "data": {
    "mid": 14636839,
    "following": 94,
    "follower": 5858
  }
}
```

### 3. 用户作品统计
```
GET https://api.bilibili.com/x/space/navnum?mid={用户UID}
```
**可获取数据**：
- 视频投稿数量
- 专栏文章数量
- 收藏夹数量
- 频道数量

**测试结果**：✅ 成功获取
```json
{
  "code": 0,
  "data": {
    "video": 48,
    "article": 1,
    "favourite": {"master": 2, "guest": 2}
  }
}
```

### 4. 视频投稿列表
```
GET https://api.bilibili.com/x/space/wbi/arc/search?mid={用户UID}&pn=1&ps=30
```
**可获取数据**：
- 视频标题、封面、简介
- 播放量、评论数
- 发布时间、时长
- BV号、AV号

**注意**：此接口可能需要WBI签名验证

### 5. 视频详细信息
```
GET https://api.bilibili.com/x/web-interface/view?bvid={BV号}
```
**可获取数据**：
- 视频完整信息
- 播放量、点赞数、投币数、收藏数
- 分P信息

### 6. 热门视频榜单
```
GET https://api.bilibili.com/x/web-interface/ranking/v2?rid=0
```
**可获取数据**：
- 全站热门视频排行

---

## 二、需要认证才能获取的数据

以下数据**必须提供登录凭证**才能访问：

### 1. 用户动态列表
```
GET https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid={用户UID}
```
**需要**：Cookie中的SESSDATA

**测试结果**：❌ 返回412错误（request was banned）

### 2. 用户行为操作
- 点赞、投币、收藏
- 发布评论、动态
- 关注/取消关注

**需要**：完整的登录凭证（SESSDATA、bili_jct等）

---

## 三、当前项目遇到的问题

### 问题1：频率限制（412错误）
**现象**：
```json
{"code": -412, "message": "request was banned"}
{"code": -799, "message": "请求过于频繁，请稍后再试"}
```

**原因**：
1. B站检测到来自服务器的请求（非浏览器）
2. 请求频率过高
3. 缺少必要的请求头或签名

**解决方案**：
- ✅ 添加完整的浏览器请求头（User-Agent、Referer）
- ✅ 控制请求频率（每次请求间隔≥2秒）
- ✅ 添加缓存机制（减少重复请求）
- ⚠️ 使用代理IP轮换（复杂，不推荐）
- ⚠️ 使用浏览器自动化工具（Puppeteer/Selenium）

### 问题2：WBI签名验证
某些接口（如视频列表）需要WBI签名，这是B站的反爬虫机制。

**需要**：
1. 获取img_key和sub_key
2. 对请求参数进行签名
3. 添加w_rid参数

---

## 四、推荐的解决方案

### 方案1：使用B站官方开放平台（推荐）⭐
**网址**：https://open.bilibili.com/

**优势**：
- 官方支持，稳定可靠
- 无频率限制问题
- 提供完整的API文档

**劣势**：
- 需要申请开发者账号
- 需要审核
- 可能有使用限制

**适用场景**：正式项目、商业用途

### 方案2：使用第三方库
**Python**：`bilibili-api-python`
**Node.js**：`bilibili-api`

**优势**：
- 已处理签名和认证问题
- 社区维护，更新及时

**劣势**：
- 依赖第三方
- 可能随B站更新而失效

### 方案3：使用模拟数据（当前采用）
**优势**：
- 快速展示效果
- 无API限制
- 适合演示和开发

**劣势**：
- 数据不是实时的
- 仅用于演示

### 方案4：浏览器端直接调用
让前端直接调用B站API，避免服务器端的反爬虫检测。

**优势**：
- 绕过服务器端限制
- 浏览器环境更容易通过验证

**劣势**：
- 跨域问题（需要CORS代理）
- 暴露API调用逻辑

---

## 五、如何获取登录凭证（SESSDATA）

如果需要访问需要认证的接口，需要提供B站登录凭证：

### 步骤：
1. 在浏览器中登录B站（https://www.bilibili.com）
2. 打开浏览器开发者工具（F12）
3. 进入Application/存储 → Cookies
4. 找到以下Cookie值：
   - `SESSDATA`：主要的会话凭证
   - `bili_jct`：CSRF令牌
   - `DedeUserID`：用户ID

### 使用方法：
```javascript
headers: {
  'Cookie': `SESSDATA=${sessdata}; bili_jct=${bili_jct}; DedeUserID=${uid}`
}
```

**注意**：
- ⚠️ 不要泄露你的SESSDATA，它相当于你的登录密码
- ⚠️ SESSDATA有过期时间，需要定期更新
- ⚠️ 在公开项目中不要硬编码SESSDATA

---

## 六、当前项目的实现状态

### ✅ 已实现（使用模拟数据）
- 用户基本信息展示
- 视频列表展示
- 动态列表展示（模拟数据）

### ⚠️ 部分可用（公开API）
- 用户关系统计（粉丝数、关注数）
- 用户作品统计

### ❌ 需要认证
- 实时动态获取
- 用户行为操作

---

## 七、下一步建议

### 短期方案（演示用）
继续使用模拟数据，确保网站功能完整可用。

### 中期方案（个人使用）
1. 手动提供SESSDATA到环境变量
2. 实现完整的API调用
3. 添加错误处理和降级方案

### 长期方案（正式项目）
1. 申请B站开放平台账号
2. 使用官方API
3. 实现完整的OAuth认证流程

---

## 八、相关资源

- B站开放平台：https://open.bilibili.com/
- B站API文档（非官方）：https://github.com/SocialSisterYi/bilibili-API-collect
- bilibili-api-python：https://github.com/Nemo2011/bilibili-api
- WBI签名算法：https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/misc/sign/wbi.md
