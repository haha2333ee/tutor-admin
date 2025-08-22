'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
                                            children,
                                        }: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const navItems = [
        { name: "控制台", href: "/dashboard" },
        { name: "站点", href: "/dashboard/sites" },
        { name: "谷歌流量分析", href: "/dashboard/ga" },
        { name: "留言", href: "/dashboard/needs" },
        // 以后可以再加更多表
    ];

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* 左侧导航栏 */}
            <aside className="w-60 shrink-0 bg-gray-900 text-gray-200 border-r border-gray-800 sticky top-0 h-screen overflow-y-auto">
                <h2 className="text-xl font-semibold tracking-wide px-4 py-4 border-b border-gray-800 select-none">
                    Admin
                </h2>
                <nav className="flex-1 py-2">
                    <ul className="space-y-1">
                        {navItems.map((item) => {
                            const active = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={[
                                            "block mx-2 rounded-md px-3 py-2 text-sm transition-colors duration-200 focus-visible:outline-none",
                                            "focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900",
                                            active
                                                ? "bg-gray-800 text-white font-medium"
                                                : "text-gray-300 hover:text-white hover:bg-gray-800/60"
                                        ].join(" ")}
                                    >
                                        {item.name}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>

            {/* 右侧主内容 */}
            <main className="flex-1 p-6">{children}</main>
        </div>
    );
}
