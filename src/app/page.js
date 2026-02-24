"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { cadastrarLeadAction } from "@/app/actions/cadastrarLead";

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', service: 'Consultoria Automotizada' });
  const [loading, setLoading] = useState(false);

  // Stats Counters
  const [statsData, setStatsData] = useState({ leads: 0, ativos: 0 });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const { count: leadsCount } = await supabase.from('leads').select('*', { count: 'exact', head: true });
    const { count: agendamentosCount } = await supabase.from('agendamentos').select('*', { count: 'exact', head: true }).eq('status', 'confirmado');

    setStatsData({
      leads: leadsCount || 0,
      ativos: agendamentosCount || 0
    });
  };

  const stats = [
    { label: "Total de Leads", value: statsData.leads, icon: "📈", color: "var(--brand-purple)" },
    { label: "Agendamentos Ativos", value: statsData.ativos, icon: "📅", color: "var(--brand-purple-light)" },
    { label: "Automações Disparadas", value: "342", icon: "⚡", color: "var(--success)" },
    { label: "Taxa de Conversão", value: "68%", icon: "🎯", color: "var(--warning)" }
  ];

  const handleCadastrarLead = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await cadastrarLeadAction(newLead);

      if (!res.success) {
        throw new Error(res.message);
      }

      setIsModalOpen(false);
      setNewLead({ name: '', phone: '', service: 'Consultoria Automotizada' });
      fetchDashboardData();
      alert("Lead & Agendamento criados com sucesso! Verifique o Kanban.");

    } catch (error) {
      console.error(error);
      alert(`Erro ao cadastrar: ${error.message || JSON.stringify(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <h1>Visão Geral</h1>
          <p className="text-muted">Acompanhe os resultados e agendamentos deste mês.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="brand-button">+ Novo Agendamento</button>
      </header>

      {/* Modal Novo Agendamento (Simples) */}
      {isModalOpen && (
        <div className="create-rule-card glass-panel mb-4" style={{ borderLeftColor: 'var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Cadastro Rápido (Lead Manual)</h2>
            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>❌</button>
          </div>
          <form className="rule-form mt-4" onSubmit={handleCadastrarLead}>
            <div className="time-inputs mb-4">
              <div style={{ flex: 1 }}>
                <label>Nome do Cliente</label>
                <input required type="text" className="form-input" value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Telefone (WhatsApp)</label>
                <input required type="text" className="form-input" placeholder="551199999999" value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} />
              </div>
            </div>
            <div className="form-group mb-4">
              <label>Serviço Interessado</label>
              <input required type="text" className="form-input" value={newLead.service} onChange={e => setNewLead({ ...newLead, service: e.target.value })} />
            </div>
            <button type="submit" className="brand-button" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar no CRM'}
            </button>
          </form>
        </div>
      )}

      <div className="stats-grid">
        {stats.map((stat, idx) => (
          <div key={idx} className="stat-card glass-panel">
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-info">
              <h3>{stat.value}</h3>
              <p>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-content">
        <div className="chart-section glass-panel">
          <h2>Próximos Agendamentos</h2>
          <div className="appointments-list">
            <p className="text-muted mt-2">Os próximos agendamentos aparecerão aqui a medida que os webhooks forem ativados.</p>
          </div>
        </div>

        <div className="activity-section glass-panel">
          <h2>Atividade Recente (Integrações)</h2>
          <ul className="activity-list">
            <li>
              <span className="dot"></span>
              <p>Novo lead capturado via Webhook do Site.</p>
              <span className="time">Recente</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
