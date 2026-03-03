"use client";
import React, { useState, useEffect } from 'react';
import { useEmpresa } from "@/hooks/useEmpresa";
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export default function Settings() {
    const { empresaId } = useEmpresa();
    const [storeName, setStoreName] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const supabase = createBrowserSupabaseClient();

    useEffect(() => {
        if (!empresaId) return;
        async function fetchEmpresa() {
            const { data } = await supabase.from('empresas').select('store_name').eq('id', empresaId).single();
            if (data?.store_name) setStoreName(data.store_name);
        }
        fetchEmpresa();
    }, [empresaId]);

    const handleSave = async () => {
        if (!empresaId || !storeName) return;
        setLoading(true);
        setSuccess(false);
        const { error } = await supabase.from('empresas').update({ store_name: storeName }).eq('id', empresaId);
        setLoading(false);
        if (!error) setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
    };

    return (
        <div className="settings-container">
            <header className="page-header">
                <div>
                    <h1>Configurações e Integrações</h1>
                    <p className="text-muted">Gerencie os dados da sua empresa e conexões de sistema.</p>
                </div>
            </header>

            <div className="settings-grid">

                {/* DADOS DA EMPRESA */}
                <div className="settings-card glass-panel" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header">
                        <h2>🏢 Dados da Barbearia / Empresa</h2>
                    </div>
                    <p className="text-muted mb-4">Essas informações identificam o seu negócio no sistema.</p>

                    <div className="form-group" style={{ maxWidth: '400px' }}>
                        <label>Nome do Estabelecimento:</label>
                        <input
                            type="text"
                            className="form-input"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            placeholder="Ex: Impar Barbearia"
                        />
                    </div>

                    <div className="mt-4">
                        <button
                            className="brand-button"
                            onClick={handleSave}
                            disabled={loading || !storeName}
                        >
                            {loading ? 'Salvando...' : '💾 Salvar Alterações'}
                        </button>
                        {success && <span style={{ marginLeft: '16px', color: 'var(--success)' }}>✅ Salvo com sucesso!</span>}
                    </div>
                </div>

                <div className="settings-card glass-panel">
                    <div className="card-header">
                        <h2>WhatsApp (Evolution API)</h2>
                    </div>
                    <p className="text-muted">Status do motor de disparos automáticos.</p>

                    <div className="status-indicator mt-4">
                        <span className="dot dot-success"></span> Online & Autenticado
                    </div>
                    <div className="mt-4">
                        <button className="brand-button">Sincronizar QR Code</button>
                    </div>
                </div>

                <div className="settings-card glass-panel">
                    <div className="card-header">
                        <h2>Seus Webhooks (Substituindo o Make)</h2>
                    </div>
                    <p className="text-muted mb-4">Aponte o seu site de agendamentos para estas URLs exclusivas do seu CRM.</p>

                    <div className="webhook-item">
                        <label>Novo Agendamento (Gatilho)</label>
                        <div className="url-box">
                            <code>https://api.tmttech.com.br/v1/webhook/agendamento</code>
                            <button className="copy-btn">📋</button>
                        </div>
                        <p className="text-small text-muted">Recebe o agendamento e programa o envio do alerta de 2 horas automaticamente.</p>
                    </div>

                    <div className="webhook-item mt-4">
                        <label>Novo Lead (Gatilho)</label>
                        <div className="url-box">
                            <code>https://api.tmttech.com.br/v1/webhook/lead</code>
                            <button className="copy-btn">📋</button>
                        </div>
                        <p className="text-small text-muted">Recebe o contato do site, insere no Pipe Kanban e dispara o Oi automático.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
