import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '斐延 · 商务主站',
  description: 'B站UP主斐延商务合作展示页',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
