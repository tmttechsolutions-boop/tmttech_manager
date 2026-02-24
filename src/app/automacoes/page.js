"use client";
import React, { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useEmpresa } from "@/hooks/useEmpresa";
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AutomacoesList() {
    const { empresaId, loadingEmpresa } = useEmpresa();
    const router = useRouter();
    const supabase = createBrowserSupabaseClient();
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (empresaId) {
            fetchRules();
        } else if (!loadingEmpresa) {
            // Se terminou de carregar a empresa e não achou ID, libera o loading pra mostrar erro
            setLoading(false);
        }
    }, [empresaId, loadingEmpresa]);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('empresa_id', empresaId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Erro Supabase:", error);
                alert("Erro ao buscar automações: " + error.message);
            }
            if (data) setRules(data);
        } catch (err) {
            console.error("Erro catastrófico:", err);
            alert("Erro inesperado ao carregar fluxos.");
        } finally {
            setLoading(false);
        }
    };

    const toggleRuleActive = async (id, currentStatus) => {
        if (!empresaId) return alert("Erro: Identificação da empresa não encontrada.");
        const { error } = await supabase
            .from('automation_rules')
            .update({ is_active: !currentStatus })
            .eq('id', id)
            .eq('empresa_id', empresaId);

        if (!error) {
            setRules(rules.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
        } else {
            alert('Falha ao alterar status da regra: ' + error.message);
        }
    };

    const deleteRule = async (id) => {
        if (!empresaId) return alert("Erro: Identificação da empresa não encontrada.");
        if (!confirm('Tem certeza que deseja apagar permanentemente este fluxo?')) return;

        const { error } = await supabase
            .from('automation_rules')
            .delete()
            .eq('id', id)
            .eq('empresa_id', empresaId);

        if (!error) {
            setRules(rules.filter(r => r.id !== id));
        } else {
            alert('Falha ao excluir o fluxo: ' + error.message);
        }
    };

    const handleCreateNew = async () => {
        if (!empresaId) {
            alert("Erro crítico: Não foi possível identificar seu Negócio/Empresa. Tente fazer logout e login novamente.");
            return;
        }

        const newRuleName = prompt("Qual o nome do novo Fluxo de Automação?");
        if (!newRuleName) return;

        // Criamos o rascunho no banco
        const { data: newRule, error } = await supabase
            .from('automation_rules')
            .insert([{
                empresa_id: empresaId,
                name: newRuleName,
                description: 'Novo Fluxo Visual',
                trigger_type: 'mensagem_qualquer', // Padrão
                offset_minutes: 0,
                message_template: 'Sua mensagem aqui',
                is_active: false,
                flow_data: {}
            }])
            .select()
            .single();

        if (error) {
            alert('Erro ao criar fluxo: ' + error.message);
            return;
        }

        router.push(`/automacoes/${newRule.id}`);
    };

    if (loadingEmpresa) {
        return (
            <div className="pipeline-container">
                <header className="page-header">
                    <h1>Carregando Automações...</h1>
                </header>
            </div>
        );
    }

    if (!empresaId && !loadingEmpresa) {
        return (
            <div className="pipeline-container">
                <header className="page-header">
                    <h1>Ops! Algo deu errado.</h1>
                </header>
                <div className="glass-panel" style={{ textAlign: 'center', padding: '64px 32px' }}>
                    <h3 style={{ marginBottom: '16px', color: '#ef4444' }}>Identificação da Empresa Não Encontrada</h3>
                    <p className="text-muted" style={{ marginBottom: '24px' }}>
                        Não conseguimos vincular sua conta a uma Empresa. <br />
                        Isso acontece se o seu cadastro estiver incompleto no sistema multi-tenant.
                    </p>
                    <button onClick={() => window.location.reload()} className="brand-button">Tentar Novamente</button>
                    <button onClick={() => router.push('/login')} className="brand-button" style={{ marginLeft: '12px', background: 'transparent', border: '1px solid var(--border-subtle)' }}>Ir para Login</button>
                </div>
            </div>
        );
    }

    return (
        <div className="pipeline-container">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1>Automações (Flows)</h1>
                    <p className="text-muted">Gerencie seus fluxos ativos de comunicação no WhatsApp.</p>
                </div>
                <button onClick={handleCreateNew} className="brand-button">
                    + Novo Fluxo
                </button>
            </header>

            {loading ? (
                <p>Carregando fluxos...</p>
            ) : rules.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '64px 32px' }}>
                    <h3 style={{ marginBottom: '16px' }}>Nenhuma automação criada ainda</h3>
                    <p className="text-muted" style={{ marginBottom: '24px' }}>Crie seu primeiro fluxo visual para responder clientes automaticamente.</p>
                    <button onClick={handleCreateNew} className="brand-button">+ Construir Primeiro Fluxo</button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                    {rules.map((rule) => (
                        <div key={rule.id} className="glass-panel" style={{ padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>{rule.name || 'Fluxo sem nome'}</h3>

                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: rule.is_active ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {rule.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                    <div style={{
                                        width: '40px', height: '22px', borderRadius: '12px',
                                        background: rule.is_active ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                                        position: 'relative', transition: '0.3s'
                                    }} onClick={(e) => { e.preventDefault(); toggleRuleActive(rule.id, rule.is_active); }}>
                                        <div style={{
                                            width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                                            position: 'absolute', top: '2px', left: rule.is_active ? '20px' : '2px', transition: '0.3s'
                                        }}></div>
                                    </div>
                                </label>
                            </div>

                            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px', flexGrow: 1 }}>
                                {rule.description || 'Nenhuma descrição fornecida.'}
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px' }}>
                                <span style={{ color: '#c084fc' }}>⚡ Gatilho: </span>
                                <span>{
                                    rule.trigger_type === 'palavra_chave' ? `Palavra '${rule.trigger_keyword}'` :
                                        rule.trigger_type === 'agendamento' ? `Agendamento (${rule.offset_minutes}m)` :
                                            rule.trigger_type === 'resposta_story' ? 'Resposta a Story' :
                                                'Qualquer Mensagem'
                                }</span>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <Link href={`/automacoes/${rule.id}`} style={{ flexGrow: 1 }}>
                                    <button className="brand-button" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}>
                                        ✏️ Editar Fluxo
                                    </button>
                                </Link>
                                <button onClick={() => deleteRule(rule.id)} style={{ width: '40px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
