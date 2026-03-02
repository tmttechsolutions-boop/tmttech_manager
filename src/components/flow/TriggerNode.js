import { Handle, Position } from '@xyflow/react';

export default function TriggerNode({ data, selected }) {
    return (
        <div className={`flow-node trigger-node ${selected ? 'node-selected' : ''}`}>
            <div className="node-header" style={{
                backgroundColor: data.triggerType === 'remetente_2h' ? 'rgba(234, 179, 8, 0.15)' : 'var(--success-dim)',
                color: data.triggerType === 'remetente_2h' ? 'var(--warning)' : 'var(--success)'
            }}>
                <span className="icon">{data.triggerType === 'remetente_2h' ? '⏰' : '⚡'}</span>
                <strong>Gatilho Inicial</strong>
            </div>
            <div className="node-body">
                <p className="node-label">
                    {data.triggerType === 'remetente_2h'
                        ? 'Lembrete 2h (Agendamento)'
                        : (data.label || 'Qualquer Mensagem')}
                </p>
                {data.keyword && <span className="node-badge">Palavra: {data.keyword}</span>}
            </div>
            <Handle type="source" position={Position.Right} id="a" className="node-handle source-handle" />
        </div>
    );
}
