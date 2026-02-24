"use client";
import { useState, useEffect } from "react";
import { useEmpresa } from "@/hooks/useEmpresa";
import Image from 'next/image';

export default function ConectarWhatsApp() {
    const { empresaId, loadingEmpresa } = useEmpresa();
    const [qrCode, setQrCode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("disconnected"); // disconnected, connecting, open
    const [error, setError] = useState("");

    useEffect(() => {
        if (empresaId) {
            checkConnectionStatus();
        }
    }, [empresaId]);

    const checkConnectionStatus = async () => {
        if (!empresaId) return;
        try {
            const res = await fetch('/api/evolution/instance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empresaId, action: 'status' })
            });
            const data = await res.json();
            if (data.state) {
                setStatus(data.state);
            }
        } catch (err) {
            console.error("Erro ao verificar status:", err);
        }
    };

    const generateQRCode = async () => {
        if (!empresaId) return;
        setLoading(true);
        setError("");

        try {
            const res = await fetch('/api/evolution/instance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empresaId, action: 'create_and_qr' })
            });

            const data = await res.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.simulated) {
                // Modo simulado para não quebrar a UI se não tiver as envs da api real
                setStatus("simulated");
                return;
            }

            if (data.base64) {
                setQrCode(data.base64);
                setStatus("connecting");
            } else if (data.state === 'open') {
                setStatus("open");
                setQrCode(null);
            }

        } catch (err) {
            setError(err.message || "Erro ao conectar com o Servidor de WhatsApp.");
        } finally {
            setLoading(false);
        }
    };

    if (loadingEmpresa) {
        return (
            <div className="pipeline-container">
                <header className="page-header">
                    <h1>Carregando Credenciais...</h1>
                </header>
            </div>
        );
    }

    return (
        <div className="pipeline-container">
            <header className="page-header">
                <div>
                    <h1>Conectar WhatsApp (Evolution API)</h1>
                    <p className="text-muted">Geração de QR Code isolado para a sua Barbearia/Agência.</p>
                </div>
            </header>

            <div className="glass-panel mt-4" style={{ maxWidth: '600px', padding: '32px' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Status da Instância</h2>

                <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '12px', height: '12px', borderRadius: '50%',
                            backgroundColor: status === 'open' || status === 'simulated' ? 'var(--success)' : status === 'connecting' ? 'var(--warning)' : 'var(--text-muted)'
                        }}></div>
                        <span style={{ fontWeight: '500' }}>
                            {status === 'open' ? '📱 WhatsApp Conectado e Pronto' :
                                status === 'connecting' ? '⏳ Aguardando leitura...' :
                                    status === 'simulated' ? '🚀 SIMULAÇÃO ATIVA (Logs no Console)' :
                                        '🔴 Desconectado'}
                        </span>
                    </div>
                </div>

                {error && (
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '24px', fontSize: '0.85rem' }}>
                        {error}
                    </div>
                )}

                {status !== 'open' && status !== 'simulated' && (
                    <div style={{ textAlign: 'center' }}>
                        {!qrCode ? (
                            <div>
                                <p className="text-muted" style={{ marginBottom: '20px' }}>
                                    Clique no botão abaixo para gerar uma nova sessão de QR Code e vincular o número de atendimento da sua Barbearia ao CRM.
                                </p>
                                <button onClick={generateQRCode} disabled={loading} className="brand-button" style={{ padding: '12px 24px', fontSize: '1rem' }}>
                                    {loading ? 'Preparando...' : '📷 Gerar QR Code'}
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <p className="text-muted" style={{ marginBottom: '16px' }}>Escaneie este código com o seu WhatsApp.</p>
                                <div style={{ background: 'white', padding: '16px', borderRadius: '12px', display: 'inline-block' }}>
                                    <img src={qrCode} alt="WhatsApp QR Code" style={{ width: '250px', height: '250px' }} />
                                </div>
                                <button onClick={checkConnectionStatus} className="brand-button" style={{ marginTop: '24px', background: 'transparent', border: '1px solid var(--brand-purple)' }}>
                                    🔄 Verificar se conectou
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {(status === 'open' || status === 'simulated') && (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                        <h3 style={{ marginBottom: '8px' }}>Tudo Certo!</h3>
                        <p className="text-muted">A sua inteligência artificial e os envios programados estão atrelados ao seu número.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
