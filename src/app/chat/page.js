"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useEmpresa } from "@/hooks/useEmpresa";

export default function ChatPage() {
    const { empresaId, loadingEmpresa } = useEmpresa();
    const supabase = createBrowserSupabaseClient();

    const [leads, setLeads] = useState([]);
    const [activeTab, setActiveTab] = useState('conversas'); // 'conversas' ou 'contatos'
    const [selectedLead, setSelectedLead] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loadingLeads, setLoadingLeads] = useState(true);
    const [sending, setSending] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (empresaId) {
            fetchActiveChats();

            // Inscreve no Realtime para NOVOS LEADS e ATUALIZAÇÕES (Nomes, etc)
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
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'leads',
                    filter: `empresa_id=eq.${empresaId}`
                }, (payload) => {
                    // Atualiza o lead na lista local se ele já existir
                    setLeads(prev => prev.map(lead => lead.id === payload.new.id ? { ...lead, ...payload.new } : lead));

                    // Se o lead selecionado for o que foi atualizado, atualiza ele também
                    setSelectedLead(current => (current && current.id === payload.new.id) ? { ...current, ...payload.new } : current);
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

    const filteredLeads = leads.filter(lead => {
        const matchesSearch =
            lead.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.telefone.includes(searchQuery);

        if (!matchesSearch) return false;

        if (activeTab === 'conversas') {
            // Só mostra quem tem mensagens
            return lead.chat_messages && lead.chat_messages.length > 0;
        }
        return true; // Aba de contatos mostra todos
    });

    if (loadingEmpresa) return <div className="p-8 text-center">Carregando Empresa...</div>;

    return (
        <div className="chat-layout glass-panel" style={{ display: 'flex', height: 'calc(100vh - 120px)', margin: '-20px', overflow: 'hidden', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>

            {/* Sidebar de Contatos */}
            <div className="chat-contacts-sidebar" style={{ width: '380px', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>

                {/* Header com Abas */}
                <div style={{ padding: '24px 24px 12px 24px', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <button
                            onClick={() => setActiveTab('conversas')}
                            style={{
                                padding: '8px 0',
                                background: 'none',
                                border: 'none',
                                color: activeTab === 'conversas' ? 'var(--brand-purple)' : 'var(--text-muted)',
                                borderBottom: activeTab === 'conversas' ? '2px solid var(--brand-purple)' : '2px solid transparent',
                                fontWeight: '600',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                transition: '0.2s'
                            }}
                        >
                            💬 Conversas
                        </button>
                        <button
                            onClick={() => setActiveTab('contatos')}
                            style={{
                                padding: '8px 0',
                                background: 'none',
                                border: 'none',
                                color: activeTab === 'contatos' ? 'var(--brand-purple)' : 'var(--text-muted)',
                                borderBottom: activeTab === 'contatos' ? '2px solid var(--brand-purple)' : '2px solid transparent',
                                fontWeight: '600',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                transition: '0.2s'
                            }}
                        >
                            👥 Meus Contatos
                        </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
                                    fontSize: '0.7rem'
                                }}
                            >
                                {syncing ? '⌛ Sincronizando' : '📥 Importar'}
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
                                    fontSize: '0.7rem'
                                }}
                            >
                                🔄
                            </button>
                        </div>
                    </div>

                    <input
                        type="text"
                        placeholder="Buscar por nome ou número..."
                        className="form-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', fontSize: '0.85rem', padding: '10px 16px', background: 'rgba(255,255,255,0.03)' }}
                    />
                </div>

                {/* Lista de Leads Filtrada */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loadingLeads ? (
                        <p style={{ padding: '24px', color: 'var(--text-muted)', textAlign: 'center' }}>Buscando contatos...</p>
                    ) : filteredLeads.length === 0 ? (
                        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '12px' }}>📭</span>
                            <p style={{ fontSize: '0.9rem' }}>Nenhum lead encontrado nesta aba.</p>
                        </div>
                    ) : filteredLeads.map(lead => (
                        <div
                            key={lead.id}
                            onClick={() => setSelectedLead(lead)}
                            style={{
                                padding: '16px 24px',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                background: selectedLead?.id === lead.id ? 'rgba(192, 132, 252, 0.08)' : 'transparent',
                                borderLeft: selectedLead?.id === lead.id ? '4px solid var(--brand-purple)' : '4px solid transparent',
                                transition: '0.2s',
                                position: 'relative'
                            }}
                            className="chat-contact-item"
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: selectedLead?.id === lead.id ? 'white' : 'var(--text-main)', margin: 0 }}>
                                    {lead.nome}
                                </h4>
                                <span style={{
                                    fontSize: '0.65rem',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: lead.status === 'novo' ? 'rgba(192, 132, 252, 0.2)' : 'rgba(255,255,255,0.05)',
                                    color: lead.status === 'novo' ? 'var(--brand-purple)' : 'var(--text-muted)'
                                }}>
                                    {lead.status.toUpperCase()}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                                    {lead.telefone}
                                </p>
                                {lead.chat_messages?.length > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--brand-purple)' }}>●</span>
                                )}
                            </div>
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
