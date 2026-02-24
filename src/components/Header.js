'use client';
import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function Header() {
    const [user, setUser] = useState(null);
    const router = useRouter();
    const supabase = createBrowserSupabaseClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, [supabase]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <header className="main-header glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="header-search">
                <input type="text" placeholder="Buscar clientes ou agendamentos..." className="search-input" />
            </div>

            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button className="action-button" title="Notificações">
                    🔔
                </button>
                <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="avatar" style={{ background: 'var(--brand-purple)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="user-name" style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {user?.email || 'Carregando...'}
                    </span>
                </div>
                <button
                    onClick={handleSignOut}
                    className="action-button"
                    title="Sair"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    Sair
                </button>
            </div>
        </header>
    );
}
