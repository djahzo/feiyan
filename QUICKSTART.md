# 快速启动指南

## 项目概述

这是一个用于展示B站UP主商务合作内容的全栈网站，包含前端展示页面和后端API服务。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + TailwindCSS
- **后端**: Node.js + Express + TypeScript
- **API**: B站公开API

## 安装步骤

### 1. 安装后端依赖

```bash
cd backend
npm install
```

### 2. 配置后端环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的B站UID：

```env
PORT=3000
BILIBILI_UID=你的B站UID
FRONTEND_URL=http://localhost:5173
```

**如何获取B站UID？**
- 访问你的B站个人主页
- URL格式为：`https://space.bilibili.com/UID数字`
- 例如：`https://space.bilibili.com/123456789`，UID就是 `123456789`

### 3. 启动后端服务

```bash
npm run dev
```

后端将运行在 `http://localhost:3000`

### 4. 安装前端依赖

打开新的终端窗口：

```bash
cd frontend
npm install
```

### 5. 启动前端服务

```bash
npm run dev
```

前端将运行在 `http://localhost:5173`

## 访问网站

打开浏览器访问：`http://localhost:5173`

## B站API说明

本项目使用B站公开API，无需申请开发者账号：

### 1. 用户信息API
```
GET https://api.bilibili.com/x/space/acc/info?mid={uid}
```
返回：头像、昵称、签名、等级等信息

### 2. 视频投稿API
```
GET https://api.bilibili.com/x/space/arc/search?mid={uid}&pn=1&ps=30
```
返回：视频列表、封面、标题、播放量、评论数等

### 3. 动态API
```
GET https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid={uid}
```
返回：动态列表、图文内容等

## 功能特性

✅ **用户信息展示**
- UP主头像、昵称
- 个人签名
- 等级显示
- UID展示

✅ **视频投稿展示**
- 视频封面、标题
- 播放量、评论数
- 发布时间
- 点击跳转到B站

✅ **动态展示**
- 图文动态
- 视频动态
- 发布时间

✅ **响应式设计**
- 支持桌面端和移动端
- 自适应布局

## 项目结构

```
feiyan/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── controllers/        # 控制器
│   │   │   └── bilibili.controller.ts
│   │   ├── services/           # 服务层
│   │   │   └── bilibili.service.ts
│   │   ├── routes/             # 路由
│   │   │   └── bilibili.routes.ts
│   │   ├── types/              # 类型定义
│   │   │   └── bilibili.ts
│   │   └── index.ts            # 入口文件
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/         # React组件
│   │   │   ├── UserCard.tsx
│   │   │   ├── VideoCard.tsx
│   │   │   ├── VideoList.tsx
│   │   │   └── DynamicCard.tsx
│   │   ├── pages/              # 页面
│   │   │   └── HomePage.tsx
│   │   ├── services/           # API服务
│   │   │   └── api.ts
│   │   ├── types/              # 类型定义
│   │   │   └── bilibili.ts
│   │   ├── styles/             # 样式
│   │   │   └── index.css
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── index.html
│
└── README.md
```

## API端点

后端提供以下API端点：

- `GET /api/bilibili/user` - 获取用户信息
- `GET /api/bilibili/videos?page=1&pageSize=30` - 获取视频列表
- `GET /api/bilibili/dynamics` - 获取动态列表
- `GET /health` - 健康检查

## 常见问题

### 1. 后端启动失败
- 检查是否安装了Node.js (建议v18+)
- 检查端口3000是否被占用
- 检查 `.env` 文件是否正确配置

### 2. 前端无法获取数据
- 确保后端服务正在运行
- 检查浏览器控制台是否有CORS错误
- 检查B站UID是否正确

### 3. B站API返回错误
- B站API可能有访问频率限制
- 检查UID是否存在
- 某些私密账号可能无法获取数据

## 下一步优化建议

1. **添加缓存机制** - 减少对B站API的请求频率
2. **添加数据库** - 存储商务合作案例
3. **添加后台管理** - 管理商务合作内容
4. **SEO优化** - 提升搜索引擎排名
5. **部署上线** - 使用Vercel/Netlify部署前端，使用Railway/Render部署后端

## 许可证

MIT
