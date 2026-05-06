# B站UP主商务展示网站

一个用于展示B站UP主商务合作内容的全栈网站项目。

## 项目结构

```
feiyan/
├── backend/          # Node.js + Express 后端
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   └── index.ts
│   └── package.json
├── frontend/         # React + TypeScript 前端
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.tsx
│   └── package.json
└── README.md
```

## 技术栈

### 前端
- React 18
- TypeScript
- Vite
- TailwindCSS
- Axios

### 后端
- Node.js
- Express
- TypeScript
- Axios (调用B站API)

## B站API接入说明

本项目使用B站公开API获取数据：

1. **用户信息**: `https://api.bilibili.com/x/space/acc/info?mid={uid}`
2. **投稿视频**: `https://api.bilibili.com/x/space/arc/search?mid={uid}&pn=1&ps=30`
3. **动态信息**: `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid={uid}`

## 快速开始

### 后端启动
```bash
cd backend
npm install
npm run dev
```

### 前端启动
```bash
cd frontend
npm install
npm run dev
```

## 功能特性

- ✅ UP主个人信息展示（头像、昵称、粉丝数等）
- ✅ 视频投稿记录展示
- ✅ 图文动态展示
- ✅ 商务合作案例展示
- ✅ 响应式设计

## 配置说明

在 `backend/.env` 中配置B站UID：
```
BILIBILI_UID=你的B站UID
PORT=3000
```
