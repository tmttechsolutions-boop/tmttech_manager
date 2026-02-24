"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar glass-panel">
            <div className="sidebar-header">
                <h2 className="brand-logo">
                    <span className="text-purple">TMT</span> TECH
                </h2>
                <p className="subtitle">GESTÃO DE AUTOMAÇÃO</p>
            </div>

            <nav className="sidebar-nav">
                <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
                    <span className="nav-icon">📊</span>
                    <span className="nav-text">Dashboard</span>
                </Link>
                <Link href="/pipeline" className={`nav-item ${pathname === '/pipeline' ? 'active' : ''}`}>
                    <span className="nav-icon">📋</span>
                    <span className="nav-text">Pipeline (Kanban)</span>
                </Link>
                <Link href="/clientes" className={`nav-item ${pathname === '/clientes' ? 'active' : ''}`}>
                    <span className="nav-icon">👥</span>
                    <span className="nav-text">Clientes</span>
                </Link>
                <Link href="/automacoes" className={`nav-item ${pathname === '/automacoes' ? 'active' : ''}`}>
                    <span className="nav-icon">⚡</span>
                    <span className="nav-text">Automações</span>
                </Link>
                <Link href="/configuracoes" className={`nav-item ${pathname === '/configuracoes' ? 'active' : ''}`}>
                    <span className="nav-icon">⚙️</span>
                    <span className="nav-text">Configurações</span>
                </Link>
            </nav>
        </aside>
    );
}
