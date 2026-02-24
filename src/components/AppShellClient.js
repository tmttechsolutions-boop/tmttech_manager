'use client';
import { usePathname } from 'next/navigation';
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function AppShellClient({ children }) {
    const pathname = usePathname();
    const isAuthRoute = pathname.startsWith('/login');

    if (isAuthRoute) {
        return <main>{children}</main>;
    }

    return (
        <div className="app-container">
            <Sidebar />
            <div className="main-content">
                <Header />
                <main className="page-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
