"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useEmpresa } from "@/hooks/useEmpresa";

export default function ChatPage() {
    const { empresaId, loadingEmpresa } = useEmpresa();
    const supabase = createBrowserSupabaseClient();

    const [leads, setLeads] = useState([]);
    const [selectedLead, setSelectedLead] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loadingLeads, setLoadingLeads] = useState(true);
    const [sending, setSending] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (empresaId) {
            fetchActiveChats();

            // Inscreve no Realtime para NOVOS LEADS (Novas conversas que chegam)
            const leadChannel = supabase
                .channel('public:leads')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'leads',
                    filter: `empresa_id=eq.${empresaId}`
                }, (payload) => {
                    setLeads(prev => [payload.new, ...prev]);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(leadChannel);
            };
        }
    }, [empresaId]);

    useEffect(() => {
        if (selectedLead) {
            fetchMessages(selectedLead.id);
            // Inscreve no Realtime para novas mensagens deste lead
            const channel = supabase
                .channel(`chat_${selectedLead.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `lead_id=eq.${selectedLead.id}`
                }, (payload) => {
                    setMessages(prev => [...prev, payload.new]);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [selectedLead]);

    useEffect(scrollToBottom, [messages]);

    const fetchActiveChats = async () => {
        setLoadingLeads(true);
        // Busca leads que já possuem alguma mensagem ou estão no sistema
        // Ordenamos por ID descendente para os mais novos (ou criados recentemente) ficarem no topo
        const { data, error } = await supabase
            .from('leads')
            .select(`
                id, nome, telefone, status,
                chat_messages(content, created_at)
            `)
            .eq('empresa_id', empresaId)
            .order('created_at', { ascending: false });

        if (data) {
            setLeads(data);
        }
        setLoadingLeads(false);
    };

    const fetchMessages = async (leadId) => {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: true });

        if (data) setMessages(data);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedLead || sending) return;

        setSending(true);
        try {
            // 1. Dispara via API (que já vai salvar o outbound no banco)
            const res = await fetch('/api/evolution/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empresaId,
                    phone: selectedLead.telefone,
                    text: newMessage
                })
            });

            if (res.ok) {
                setNewMessage("");
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(`Falha ao enviar: ${errData.error || 'Erro desconhecido no servidor'}`);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const handleSyncHistory = async () => {
        if (!empresaId || syncing) return;
        setSyncing(true);
        try {
            const res = await fetch('/api/evolution/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empresaId })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Sucesso! ${data.details.messagesSynced} mensagens sincronizadas e ${data.details.leadsCreated} novos contatos.`);
                fetchActiveChats();
            } else {
                alert(`Erro na sincronização: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao conectar com o servidor para sincronização.");
        } finally {
            setSyncing(false);
        }
    };

    if (loadingEmpresa) return <div className="p-8">Carregando Empresa...</div>;

    return (
        <div className="chat-layout glass-panel" style={{ display: 'flex', height: 'calc(100vh - 120px)', margin: '-20px', overflow: 'hidden', borderRadius: '12px' }}>

            {/* Sidebar de Contatos */}
            <div className="chat-contacts-sidebar" style={{ width: '350px', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Conversas</h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={handleSyncHistory}
                                    disabled={syncing}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        background: 'rgba(192, 132, 252, 0.1)',
                                        border: '1px solid rgba(192, 132, 252, 0.2)',
                                        color: syncing ? 'var(--text-muted)' : 'var(--brand-purple)',
                                        cursor: syncing ? 'default' : 'pointer',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                    title="Importar do WhatsApp"
                                >
                                    {syncing ? '⌛' : '📥'} {syncing ? 'Sinc' : 'Sinc'}
                                </button>
                                <button
                                    onClick={fetchActiveChats}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                    title="Atualizar lista"
                                >
                                    🔄
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="Buscar contato..."
                                className="form-input"
                                style={{ flex: 1, fontSize: '0.85rem', padding: '10px 16px' }}
                            />
                            <button
                                style={{
                                    padding: '0 14px',
                                    borderRadius: '8px',
                                    background: 'var(--brand-purple)',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '1.4rem',
                                    fontWeight: 'bold'
                                }}
                                title="Novo Contato"
                                onClick={() => alert('Função de novo contato em breve')}
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loadingLeads ? (
                        <p style={{ padding: '20px', color: 'var(--text-muted)' }}>Buscando contatos...</p>
                    ) : leads.map(lead => (
                        <div
                            key={lead.id}
                            onClick={() => setSelectedLead(lead)}
                            style={{
                                padding: '16px 24px',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                background: selectedLead?.id === lead.id ? 'rgba(192, 132, 252, 0.1)' : 'transparent',
                                transition: '0.2s'
                            }}
                            className="chat-contact-item"
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '600' }}>{lead.nome}</h4>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {lead.status.toUpperCase()}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {lead.telefone}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Área de Mensagens */}
            <div className="chat-main-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)' }}>
                {selectedLead ? (
                    <>
                        {/* Header do Chat */}
                        <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--brand-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {selectedLead.nome.charAt(0)}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1rem' }}>{selectedLead.nome}</h3>
                                <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>● Online</span>
                            </div>
                        </div>

                        {/* Lista de Mensagens */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        alignSelf: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
                                        maxWidth: '70%',
                                        padding: '12px 18px',
                                        borderRadius: msg.direction === 'outbound' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                                        background: msg.direction === 'outbound' ? 'var(--brand-purple)' : 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        fontSize: '0.9rem',
                                        position: 'relative'
                                    }}
                                >
                                    {msg.content}
                                    <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '4px', textAlign: 'right' }}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input de Mensagem */}
                        <form onSubmit={handleSendMessage} style={{ padding: '24px 32px', display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.1)' }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Digite sua mensagem..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                style={{ flex: 1, padding: '14px 20px' }}
                            />
                            <button type="submit" className="brand-button" style={{ padding: '0 24px' }} disabled={sending}>
                                {sending ? '...' : '✈️ Enviar'}
                            </button>
                        </form>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <span style={{ fontSize: '4rem', marginBottom: '16px' }}>💬</span>
                        <h3>Selecione uma conversa para começar</h3>
                        <p>Atenda seus leads de forma rápida e centralizada.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
