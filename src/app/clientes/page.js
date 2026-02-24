"use client";
import { useState, useEffect } from "react";
import { createSupabaseClient } from '@/lib/supabase';

export default function Clientes() {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClientes();
    }, []);

    const fetchClientes = async () => {
        setLoading(true);
        const supabase = createSupabaseClient();
        // Busca os clientes e seus agendamentos mais recentes
        const { data, error } = await supabase
            .from('leads')
            .select('*, agendamentos(service, date_time)')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setClientes(data);
        }
        setLoading(false);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'novo': return <span className="trigger-badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>Novo</span>;
            case 'contato': return <span className="trigger-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>Em Contato</span>;
            case 'agendado': return <span className="trigger-badge" style={{ background: 'rgba(126, 34, 206, 0.2)', color: 'var(--brand-purple-light)' }}>Agendado</span>;
            case 'concluido': return <span className="trigger-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)' }}>Concluído</span>;
            default: return <span className="trigger-badge">{status}</span>;
        }
    };

    return (
        <div className="clientes-container">
            <header className="page-header">
                <div>
                    <h1>Base de Clientes</h1>
                    <p className="text-muted">Gerencie todos os seus contatos e o histórico de agendamentos.</p>
                </div>
            </header>

            <div className="glass-panel mt-4" style={{ overflowX: 'auto' }}>
                {loading ? (
                    <p style={{ padding: '24px' }}>Carregando base de clientes...</p>
                ) : clientes.length === 0 ? (
                    <p style={{ padding: '24px' }}>Nenhum cliente cadastrado ainda.</p>
                ) : (
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th style={{ padding: '16px' }}>Nome do Cliente</th>
                                <th style={{ padding: '16px' }}>Telefone</th>
                                <th style={{ padding: '16px' }}>Status Atual</th>
                                <th style={{ padding: '16px' }}>Último Serviço</th>
                                <th style={{ padding: '16px' }}>Data Entrada</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientes.map(cliente => {
                                const ultimoAgendamento = cliente.agendamentos && cliente.agendamentos.length > 0
                                    ? cliente.agendamentos[0]
                                    : null;

                                return (
                                    <tr key={cliente.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                        <td style={{ padding: '16px', fontWeight: 'bold' }}>{cliente.nome}</td>
                                        <td style={{ padding: '16px' }}>{cliente.telefone}</td>
                                        <td style={{ padding: '16px' }}>{getStatusBadge(cliente.status)}</td>
                                        <td style={{ padding: '16px' }}>
                                            {ultimoAgendamento ? ultimoAgendamento.service : <span className="text-muted">Sem Oportunidade</span>}
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                                            {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
