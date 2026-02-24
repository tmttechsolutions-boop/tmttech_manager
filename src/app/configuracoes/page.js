export default function Settings() {
    return (
        <div className="settings-container">
            <header className="page-header">
                <div>
                    <h1>Configurações e Integrações</h1>
                    <p className="text-muted">Gerencie seus Webhooks e substitua Make/ManyChat.</p>
                </div>
            </header>

            <div className="settings-grid">
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
