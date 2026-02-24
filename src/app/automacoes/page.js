"use client";
import React, { useState, useCallback, useRef } from 'react';
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

import TriggerNode from '@/components/flow/TriggerNode';
import ActionNode from '@/components/flow/ActionNode';
import MenuNode from '@/components/flow/MenuNode';
import DelayNode from '@/components/flow/DelayNode';
import ConditionNode from '@/components/flow/ConditionNode';
import CustomEdge from '@/components/flow/CustomEdge';
import { createSupabaseClient } from '@/lib/supabase';

// Nossos blocos customizados
const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
    menu: MenuNode,
    delay: DelayNode,
    condition: ConditionNode,
};

const edgeTypes = {
    custom: CustomEdge,
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
                    <span className="icon" style={{ color: 'var(--success)' }}>⚡</span> Gatilho
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
    const reactFlowWrapper = useRef(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const { screenToFlowPosition } = useReactFlow();

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

    const saveFlow = () => {
        const triggerLength = nodes.filter(n => n.type === 'trigger').length;
        if (triggerLength === 0) return alert("Você precisa adicionar pelo menos um Gatilho (Passo Inicial).");
        alert("A Lógica Visual do ManyChat foi mapeada com sucesso (Mocks JSON gravados).");
    }

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
                className="bg-main-flow"
                fitView
            >
                <Background color="#cbd5e1" gap={16} />
                <Controls position="bottom-right" />

                {/* Save Button */}
                <div style={{ position: 'absolute', top: '20px', left: '320px', zIndex: 10 }}>
                    <button className="brand-button" onClick={saveFlow}>💾 Publicar Automação</button>
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
                                <select className="form-input">
                                    <option>O usuário envia uma mensagem</option>
                                    <option>Mencionou no Story</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Palavra-chave Opcional:</label>
                                <input type="text" className="form-input" placeholder="Ex: PREÇO" />
                            </div>
                        </div>
                    )}

                    {selectedNode.type === 'action' && (
                        <div className="rule-form">
                            <div className="form-group">
                                <label>Texto do Conteúdo:</label>
                                <textarea
                                    className="form-input template-textarea"
                                    rows={6}
                                    value={selectedNode.data.message || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                                    placeholder="Nossa barbearia agradece..."
                                />
                            </div>
                        </div>
                    )}

                    {selectedNode.type === 'menu' && (
                        <div className="rule-form">
                            <div className="form-group mb-4">
                                <label>Mensagem Principal:</label>
                                <textarea
                                    className="form-input template-textarea"
                                    rows={3}
                                    value={selectedNode.data.message || 'Selecione uma das opções disponíveis:'}
                                    onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                                />
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
                            <div className="form-group">
                                <label>Atraso Inteligente (Tempo):</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={selectedNode.data.delay || 'Aguardar 1 dia'}
                                    onChange={(e) => updateNodeData(selectedNode.id, { delay: e.target.value })}
                                />
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
