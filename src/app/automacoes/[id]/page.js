"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ReactFlow,
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    Background,
    useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useEmpresa } from "@/hooks/useEmpresa";

import TriggerNode from '@/components/flow/TriggerNode';
import ActionNode from '@/components/flow/ActionNode';
import MenuNode from '@/components/flow/MenuNode';
import DelayNode from '@/components/flow/DelayNode';
import ConditionNode from '@/components/flow/ConditionNode';
import HttpNode from '@/components/flow/HttpNode';
import CustomEdge from '@/components/flow/CustomEdge';

// Nossos blocos customizados
const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
    menu: MenuNode,
    delay: DelayNode,
    condition: ConditionNode,
    http: HttpNode,
};

const edgeTypes = {
    custom: CustomEdge,
};

// ==============================
// Componente de Textarea com Highlight
// ==============================
const HighlightedTextarea = ({ value, onChange, placeholder, rows = 3, id, className }) => {
    return (
        <textarea
            id={id}
            className={`form-input ${className || ''}`}
            rows={rows}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            style={{ width: '100%', resize: 'vertical' }}
        />
    );
};

// ==============================
// Menu Lateral Drag and Drop
// ==============================
const DragAndDropSidebar = () => {
    const onDragStart = (event, nodeType, label) => {
        event.dataTransfer.setData('application/reactflow/type', nodeType);
        event.dataTransfer.setData('application/reactflow/label', label);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="dnd-sidebar">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Construtor de Flow</h2>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '16px' }}>
                Arraste os passos para o quadro
            </p>

            <div className="dnd-category">
                <div className="dnd-category-title">Passo Inicial</div>
                <div className="dnd-node" onDragStart={(event) => onDragStart(event, 'trigger', 'Gatilho')} draggable>
                    <span className="icon" style={{ color: 'var(--success)' }}>⚡</span> Gatilho (Mensagem)
                </div>
                <div className="dnd-node" onDragStart={(event) => onDragStart(event, 'trigger', 'Webhook Externo')} draggable>
                    <span className="icon" style={{ color: '#ec4899' }}>🔗</span> Webhook Externo
                </div>
            </div>

            <div className="dnd-category">
                <div className="dnd-category-title">Integrações Genéricas</div>
                <div className="dnd-node" onDragStart={(event) => onDragStart(event, 'http', 'Requisição HTTP')} draggable>
                    <span className="icon" style={{ color: '#38bdf8' }}>🔗</span> Requisição HTTP
                </div>
            </div>

            <div className="dnd-category">
                <div className="dnd-category-title">Conteúdo / WhatsApp</div>
                <div className="dnd-node" onDragStart={(event) => onDragStart(event, 'action', 'Enviar Mensagem')} draggable>
                    <span className="icon" style={{ color: 'var(--brand-purple-light)' }}>💬</span> Enviar Mensagem
                </div>
                <div className="dnd-node" onDragStart={(event) => onDragStart(event, 'menu', 'Service Menu')} draggable>
                    <span className="icon">📱</span> Menu com Botões
                </div>
                <div className="dnd-node" onDragStart={(event) => onDragStart(event, 'action', 'Talk with Human')} draggable>
                    <span className="icon">👤</span> Falar com Atendente
                </div>
            </div>

            <div className="dnd-category">
                <div className="dnd-category-title">Lógica</div>
                <div className="dnd-node" onDragStart={(event) => onDragStart(event, 'condition', 'Condição')} draggable>
                    <span className="icon" style={{ color: '#60a5fa' }}>🔀</span> Condição (Sim/Não)
                </div>
                <div className="dnd-node" onDragStart={(event) => onDragStart(event, 'delay', 'Atraso')} draggable>
                    <span className="icon" style={{ color: 'var(--warning)' }}>⏱️</span> Atraso Inteligente
                </div>
            </div>
        </div>
    );
};

// ==============================
// Área Principal do Flow (Canvas)
// ==============================
const FlowArea = () => {
    const params = useParams();
    const router = useRouter();
    const ruleId = params.id;
    const { empresaId, loadingEmpresa } = useEmpresa();
    const supabase = createBrowserSupabaseClient();


    const reactFlowWrapper = useRef(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const { screenToFlowPosition } = useReactFlow();

    const [flowName, setFlowName] = useState("");
    const [flowDesc, setFlowDesc] = useState("");
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (ruleId && empresaId) {
            fetchFlowData();
        }
    }, [ruleId, empresaId]);

    const fetchFlowData = async () => {
        const { data, error } = await supabase
            .from('automation_rules')
            .select('*')
            .eq('id', ruleId)
            .eq('empresa_id', empresaId)
            .single();

        if (data) {
            setFlowName(data.name || 'Nova Automação');
            setFlowDesc(data.description || '');

            if (data.flow_data && data.flow_data.nodes) {
                setNodes(data.flow_data.nodes);
                setEdges(data.flow_data.edges || []);
            }
        }
        setLoadingData(false);
    };

    // Conexões de cabos
    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ ...params, type: 'custom', animated: true, style: { stroke: '#c084fc', strokeWidth: 2 } }, eds)),
        [setEdges],
    );

    // Arrastou item sobre o painel
    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    // Soltou o item no painel
    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow/type');
            const label = event.dataTransfer.getData('application/reactflow/label');

            if (!type) { return; }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: { label: label },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes],
    );

    // Seleção e Properties Sidebar
    const onNodeClick = (event, node) => setSelectedNode(node);
    const onPaneClick = () => setSelectedNode(null);

    const updateNodeData = (id, newData) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    node.data = { ...node.data, ...newData };
                }
                return node;
            })
        );
        setSelectedNode((prev) => prev && prev.id === id ? { ...prev, data: { ...prev.data, ...newData } } : prev);
    };

    const saveFlow = async () => {
        if (!empresaId) return alert("Erro de Autenticação: Empresa não identificada.");

        const triggerNodes = nodes.filter(n => n.type === 'trigger');
        if (triggerNodes.length === 0) return alert("Você precisa adicionar pelo menos um Gatilho (Passo Inicial) no quadro.");

        const mainTrigger = triggerNodes[0];

        // Pega as info do gatilho
        const triggerType = mainTrigger.data?.triggerType || 'mensagem_qualquer';
        const keyword = mainTrigger.data?.keyword || '';

        const flowPayload = {
            nodes: nodes,
            edges: edges
        };

        const { error } = await supabase
            .from('automation_rules')
            .update({
                name: flowName,
                description: flowDesc,
                flow_data: flowPayload,
                trigger_type: triggerType,
                trigger_keyword: keyword
                // TODO extrair action messages tbm
            })
            .eq('id', ruleId)
            .eq('empresa_id', empresaId);

        if (error) {
            alert("Erro ao salvar fluxo: " + error.message);
        } else {
            alert(`Fluxo Salvo com Sucesso!`);
            router.push('/automacoes');
        }
    }

    if (loadingData) return <div style={{ padding: '40px' }}>Carregando Canvas...</div>;

    return (
        <div style={{ width: '100%', height: 'calc(100vh - 100px)', position: 'relative', margin: '-32px' }} ref={reactFlowWrapper}>

            <DragAndDropSidebar />

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'custom' }}
                className="bg-main-flow"
                fitView
            >
                <Background color="#cbd5e1" gap={16} />
                <Controls position="bottom-right" />

                {/* Área Flutuante de Informações do Fluxo (Topo) */}
                <div style={{ position: 'absolute', top: '20px', left: '320px', zIndex: 10, display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '350px' }}>
                        <input
                            type="text"
                            className="form-input"
                            value={flowName}
                            onChange={(e) => setFlowName(e.target.value)}
                            placeholder="Nome da Automação (ex: Boas Vindas Story)"
                            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', borderRadius: 0, padding: '4px 0', fontSize: '1.1rem', fontWeight: 'bold' }}
                        />
                        <input
                            type="text"
                            className="form-input"
                            value={flowDesc}
                            onChange={(e) => setFlowDesc(e.target.value)}
                            placeholder="Descrição curta para você lembrar o que este robô faz..."
                            style={{ background: 'transparent', border: 'none', padding: '0', fontSize: '0.85rem', color: 'var(--text-muted)' }}
                        />
                    </div>

                    <button className="brand-button" onClick={saveFlow} style={{ padding: '16px 24px', height: 'fit-content' }}>
                        💾 Salvar Fluxo
                    </button>

                    <button className="brand-button" onClick={() => router.push('/automacoes')} style={{ padding: '16px 24px', height: 'fit-content', background: 'transparent', border: '1px solid var(--border-subtle)' }}>
                        🔙 Voltar
                    </button>
                </div>
            </ReactFlow>

            {/* Editor Lateral Direito (Ao Clicar no Bloco) */}
            {selectedNode && (
                <div className="flow-sidebar">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '1.2rem' }}>⚙️ Editar Bloco</h3>
                        <button onClick={onPaneClick} style={{ color: 'white', fontSize: '1.2rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
                    </div>

                    {selectedNode.type === 'trigger' && (
                        <div className="rule-form">
                            <div className="form-group mb-4">
                                <label>Gatilho (Quando isso acontecer):</label>
                                <select
                                    className="form-input"
                                    value={selectedNode.data.triggerType || 'mensagem_qualquer'}
                                    onChange={(e) => updateNodeData(selectedNode.id, { triggerType: e.target.value })}
                                >
                                    <option value="mensagem_qualquer">O usuário envia uma mensagem</option>
                                    <option value="palavra_chave">Mensagem contém Palavra-Chave</option>
                                    <option value="webhook">Webhook Externo (Site/App)</option>
                                    <option value="remetente_2h">⏰ Lembrete 2h (Agendamento)</option>
                                </select>
                            </div>

                            {selectedNode.data.triggerType === 'remetente_2h' && (
                                <div className="form-group mt-4">
                                    <div style={{ padding: '12px', backgroundColor: 'rgba(234, 179, 8, 0.15)', border: '1px solid var(--warning)', borderRadius: '8px' }}>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--warning)', margin: 0 }}>
                                            <strong>⏳ Disparo Automático (Cron)</strong><br />
                                            Este fluxo será iniciado automaticamente pelo sistema sempre que faltarem 2 horas para o agendamento de um cliente.<br /><br />
                                            <strong>Novas variáveis disponíveis no texto:</strong><br />
                                            <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '4px' }}>{'{data_agendamento}'}</code><br />
                                            <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '4px' }}>{'{hora_agendamento}'}</code>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedNode.data.triggerType === 'palavra_chave' && (
                                <div className="form-group">
                                    <label>Palavra-chave:</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ex: COMPRAR"
                                        value={selectedNode.data.keyword || ''}
                                        onChange={(e) => updateNodeData(selectedNode.id, { keyword: e.target.value })}
                                    />
                                </div>
                            )}

                            {selectedNode.data.triggerType === 'webhook' && (
                                <div className="form-group mt-4">
                                    <div style={{ padding: '12px', backgroundColor: 'rgba(236, 72, 153, 0.1)', border: '1px solid #ec4899', borderRadius: '8px' }}>
                                        <p style={{ fontSize: '0.8rem', color: '#ec4899', marginBottom: '8px' }}>
                                            <strong>🔗 Link de Integração Webhook</strong><br />
                                            Para disparar esta automação a partir de outro sistema (ex: site de agendamento), faça um POST HTTP para esta URL enviando <code>phone</code> e <code>name</code> no JSON.
                                        </p>
                                        <input
                                            type="text"
                                            readOnly
                                            value={`https://tmttech-manager.vercel.app/api/webhook/custom/${ruleId}?empresaId=${empresaId}`}
                                            className="form-input"
                                            style={{ fontSize: '0.75rem', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff' }}
                                            onClick={(e) => { e.target.select(); navigator.clipboard.writeText(e.target.value); alert('URL copiada!'); }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedNode.type === 'http' && (
                        <div className="rule-form">
                            <div className="form-group">
                                <label>Método de Envio:</label>
                                <select
                                    className="form-input"
                                    value={selectedNode.data.method || 'POST'}
                                    onChange={(e) => updateNodeData(selectedNode.id, { method: e.target.value })}
                                >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="PATCH">PATCH</option>
                                    <option value="DELETE">DELETE</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>URL de Destino:</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="https://sua-api.com/webhook"
                                    value={selectedNode.data.url || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { url: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Headers (JSON Opcional):</label>
                                <textarea
                                    className="form-input font-mono text-sm"
                                    rows={3}
                                    placeholder='{"Authorization": "Bearer token", "apikey": "key"}'
                                    value={selectedNode.data.headers || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { headers: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Body (JSON Opcional):</label>
                                <HighlightedTextarea
                                    id="http-body"
                                    rows={5}
                                    value={selectedNode.data.body || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { body: e.target.value })}
                                    placeholder='{ "status": "cancelado", "phone": "{Telefone}" }'
                                    className="font-mono text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {selectedNode.type === 'action' && (
                        <div className="rule-form">
                            <div className="form-group">
                                <label>Texto do Conteúdo:</label>
                                <HighlightedTextarea
                                    id="message-textarea"
                                    rows={6}
                                    value={selectedNode.data.message || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                                    placeholder="Escreva sua mensagem aqui..."
                                />
                                <div style={{ marginTop: '8px' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Inserir Variável:</p>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                            className="variable-btn"
                                            onClick={() => {
                                                const current = selectedNode.data.message || "";
                                                updateNodeData(selectedNode.id, { message: current + " {Nome}" });
                                            }}
                                        >
                                            👤 Nome
                                        </button>
                                        <button
                                            className="variable-btn"
                                            onClick={() => {
                                                const current = selectedNode.data.message || "";
                                                updateNodeData(selectedNode.id, { message: current + " {Telefone}" });
                                            }}
                                        >
                                            📞 Telefone
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedNode.type === 'menu' && (
                        <div className="rule-form">
                            <div className="form-group mb-4">
                                <label>Mensagem Principal:</label>
                                <HighlightedTextarea
                                    rows={3}
                                    value={selectedNode.data.message || 'Selecione uma das opções disponíveis:'}
                                    onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                                    placeholder="Mensagem do menu"
                                />
                                <div style={{ marginTop: '8px' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="variable-btn"
                                            onClick={() => {
                                                const current = selectedNode.data.message || "";
                                                updateNodeData(selectedNode.id, { message: current + " {Nome}" });
                                            }}
                                        >
                                            👤 Nome
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Ações Adicionadas (Botões):</label>
                                <div className="menu-buttons mt-2">
                                    {(selectedNode.data.buttons || ['Opção 1', 'Opção 2']).map((btn, idx) => (
                                        <input
                                            key={idx}
                                            type="text"
                                            className="form-input"
                                            value={btn}
                                            onChange={(e) => {
                                                const newBtns = [...(selectedNode.data.buttons || ['Opção 1', 'Opção 2'])];
                                                newBtns[idx] = e.target.value;
                                                updateNodeData(selectedNode.id, { buttons: newBtns });
                                            }}
                                            style={{ marginBottom: '8px' }}
                                        />
                                    ))}
                                </div>
                                <button className="brand-button mt-4" style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }} onClick={() => {
                                    const newBtns = [...(selectedNode.data.buttons || ['Opção 1', 'Opção 2']), 'Nova Opção'];
                                    updateNodeData(selectedNode.id, { buttons: newBtns });
                                }}>+ Novo Botão</button>
                            </div>
                        </div>
                    )}

                    {selectedNode.type === 'delay' && (
                        <div className="rule-form">
                            <div className="form-group mb-4">
                                <label>Valor do Atraso:</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={selectedNode.data.delayValue || '1'}
                                    onChange={(e) => updateNodeData(selectedNode.id, { delayValue: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Unidade de Tempo:</label>
                                <select
                                    className="form-input"
                                    value={selectedNode.data.delayUnit || 'Minutos'}
                                    onChange={(e) => updateNodeData(selectedNode.id, { delayUnit: e.target.value })}
                                >
                                    <option value="Segundos">Segundos</option>
                                    <option value="Minutos">Minutos</option>
                                    <option value="Horas">Horas</option>
                                    <option value="Dias">Dias</option>
                                </select>
                            </div>
                        </div>
                    )}
                    {selectedNode.type === 'condition' && (
                        <div className="rule-form">
                            <div className="form-group mb-4">
                                <label>Campo a Validar:</label>
                                <select
                                    className="form-input"
                                    value={selectedNode.data.conditionField || 'Status Kanban'}
                                    onChange={(e) => updateNodeData(selectedNode.id, { conditionField: e.target.value })}
                                >
                                    <option>Status Kanban</option>
                                    <option>Telefone do Lead</option>
                                    <option>Último Serviço</option>
                                    <option>Data de Criação</option>
                                </select>
                            </div>
                            <div className="form-group mb-4">
                                <label>Condição (Operador):</label>
                                <select
                                    className="form-input"
                                    value={selectedNode.data.conditionOperator || '='}
                                    onChange={(e) => updateNodeData(selectedNode.id, { conditionOperator: e.target.value })}
                                >
                                    <option value="=">É exatamente igual a</option>
                                    <option value="!=">É diferente de</option>
                                    <option value="contem">Contém o texto</option>
                                    <option value=">">É maior que</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Valor Esperado:</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ex: Agendado"
                                    value={selectedNode.data.conditionValue || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { conditionValue: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
};

export default function Automacoes() {
    return (
        <ReactFlowProvider>
            <FlowArea />
        </ReactFlowProvider>
    );
}
