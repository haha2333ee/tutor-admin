// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Admin',
    description: 'Admin console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="zh-CN">
        <body style={{ fontFamily: 'system-ui' }}>{children}</body>
        </html>
    );
}
