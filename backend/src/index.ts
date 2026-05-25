import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createBilibiliRoutes } from './routes/bilibili.routes';
import logger from './utils/logger';

// 加载环境变量
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;
const BILIBILI_UID = process.env.BILIBILI_UID || '';

// 中间件
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// B站API路由
if (BILIBILI_UID) {
  app.use('/api/bilibili', createBilibiliRoutes(BILIBILI_UID));
} else {
  logger.warn('警告: 未设置BILIBILI_UID环境变量');
}

// 404处理
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// 启动服务器
app.listen(PORT, () => {
  logger.info(`🚀 服务器运行在 http://localhost:${PORT}`);
  logger.info(`📺 B站UID: ${BILIBILI_UID || '未设置'}`);
});

export default app;
