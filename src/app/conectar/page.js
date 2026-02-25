"use client";
import { useState, useEffect } from "react";
import { useEmpresa } from "@/hooks/useEmpresa";
import Image from 'next/image';

export default function ConectarWhatsApp() {
    const { empresaId, loadingEmpresa } = useEmpresa();
    const [qrCode, setQrCode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("disconnected");
    const [error, setError] = useState("");
    const [showHelp, setShowHelp] = useState(false);
    const [instanceName, setInstanceName] = useState("");

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
            if (data.instanceName) {
                setInstanceName(data.instanceName);
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
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1>Conectar WhatsApp v1.1</h1>
                    <p className="text-muted">Geração de QR Code isolado para o seu Negócio/Empresa.</p>
                </div>
                <button onClick={() => setShowHelp(!showHelp)} className="brand-button" style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                    ℹ️ Como Funciona?
                </button>
            </header>

            {showHelp && (
                <div className="glass-panel mt-4" style={{ maxWidth: '600px', padding: '24px', borderLeft: '4px solid #3b82f6' }}>
                    <h3 style={{ marginBottom: '16px', color: '#60a5fa' }}>Entendendo a Conexão do seu WhatsApp</h3>
                    <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>Ao conectar a sua linha ao sistema, o CRM assume o trabalho de um atendente virtual, permitindo os disparos de automações de forma independente.</p>

                    <ul style={{ paddingLeft: '24px', lineHeight: '1.8', marginBottom: '16px' }}>
                        <li><strong>Passo 1:</strong> Clique em <span style={{ fontWeight: 'bold' }}>"Gerar QR Code"</span>. O motor construirá a sua instância virtual (isolada da matriz) no servidor e o código aparecerá abaixo.</li>
                        <li><strong>Passo 2:</strong> Abra o WhatsApp do seu negócio no celular, vá em <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Aparelhos Conectados</span>, e aponte a câmera para a tela do computador.</li>
                        <li><strong>Passo 3:</strong> Aguarde a confirmação de <strong>"Conectado e Pronto"</strong> (pode demorar alguns segundos).</li>
                    </ul>
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>⚠️ Dica: Recomendamos que você utilize um aparelho/número da loja focado no seu atendimento para que quando o Kanban for alterado de uma coluna para a outra, seja este o WhatsApp utilizado. O celular precisa ficar ligado com internet para manter o bot funcional.</p>
                </div>
            )}

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

                <div className="mb-4" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '4px' }}>
                    Instância Monitorada: <strong style={{ color: 'var(--brand-purple-light)' }}>{instanceName || "Carregando..."}</strong>
                    <br />
                    <small style={{ opacity: 0.5 }}>Versão do Sistema: 1.1 (Multi-tenant Fix)</small>
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
                                    Clique no botão abaixo para gerar uma nova sessão de QR Code e vincular o seu número de atendimento ao CRM.
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
