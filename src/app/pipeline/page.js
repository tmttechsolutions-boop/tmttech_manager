"use client";
import { useState, useEffect } from "react";
import { createSupabaseClient } from '@/lib/supabase';

export default function Pipeline() {
    const [columns, setColumns] = useState({});
    const [draggedItem, setDraggedItem] = useState(null);
    const [loading, setLoading] = useState(true);

    // Busca os leads reais do banco de dados na inicialização
    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        setLoading(true);
        const supabase = createSupabaseClient();
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*, agendamentos(service, date_time)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            setLoading(false);
            return;
        }

        // Organizando em colunas
        const initialKanban = {
            novo: { id: "novo", title: "Novos Leads", items: [] },
            contato: { id: "contato", title: "Em Contato", items: [] },
            agendado: { id: "agendado", title: "Agendado", items: [] },
            concluido: { id: "concluido", title: "Concluido", items: [] }
        };

        leads.forEach(lead => {
            // Pega o primeiro agendamento associado para exibir, se houver
            const servico = lead.agendamentos && lead.agendamentos.length > 0
                ? lead.agendamentos[0].service
                : "Lead (Sem Agendamento)";

            const card = {
                id: lead.id,
                name: lead.name,
                serviço: servico,
                tempo: new Date(lead.created_at).toLocaleDateString('pt-BR')
            };

            const status = lead.status || 'novo';
            if (initialKanban[status]) {
                initialKanban[status].items.push(card);
            } else {
                initialKanban.novo.items.push(card);
            }
        });

        setColumns(initialKanban);
        setLoading(false);
    };

    const handleDragStart = (e, item, sourceColId) => {
        setDraggedItem({ item, sourceColId });
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDrop = async (e, targetColId) => {
        e.preventDefault();
        if (!draggedItem) return;

        const { item, sourceColId } = draggedItem;
        if (sourceColId === targetColId) return;

        // Atualiza visualmente primeiro (Otimista)
        setColumns(prev => {
            const sourceCol = prev[sourceColId];
            const targetCol = prev[targetColId];
            const sourceItems = sourceCol.items.filter(i => i.id !== item.id);
            const targetItems = [...targetCol.items, item];

            return {
                ...prev,
                [sourceColId]: { ...sourceCol, items: sourceItems },
                [targetColId]: { ...targetCol, items: targetItems }
            };
        });

        // Atualiza o Status no Banco de Dados Real
        const supabase = createSupabaseClient();
        const { error } = await supabase
            .from('leads')
            .update({ status: targetColId })
            .eq('id', item.id);

        if (error) {
            console.error("Erro ao atualizar lead:", error);
            alert("Erro ao atualizar o status do lead.");
            fetchLeads(); // Desfaz a mudança visual buscando os dados de novo
        }

        setDraggedItem(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    if (loading) {
        return (
            <div className="pipeline-container">
                <header className="page-header">
                    <h1>Carregando Pipeline...</h1>
                </header>
            </div>
        );
    }

    return (
        <div className="pipeline-container">
            <header className="page-header">
                <div>
                    <h1>Pipeline de Agendamentos</h1>
                    <p className="text-muted">Arraste os cards para atualizar o status do Lead no banco de dados.</p>
                </div>
            </header>

            <div className="kanban-board">
                {Object.values(columns).map(col => (
                    <div
                        key={col.id}
                        className="kanban-column"
                        onDrop={(e) => handleDrop(e, col.id)}
                        onDragOver={handleDragOver}
                    >
                        <div className="column-header">
                            <h3>{col.title}</h3>
                            <span className="badge">{col.items.length}</span>
                        </div>

                        <div className="column-list">
                            {col.items.map(item => (
                                <div
                                    key={item.id}
                                    className="kanban-card glass-panel"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, item, col.id)}
                                >
                                    <h4>{item.name}</h4>
                                    <span className="card-service">{item.serviço}</span>
                                    <div className="card-footer">
                                        <span className="card-time">📅 {item.tempo}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
