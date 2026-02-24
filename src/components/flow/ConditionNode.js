import { Handle, Position } from '@xyflow/react';

export default function ConditionNode({ data, selected }) {
    return (
        <div className={`flow-node condition-node ${selected ? 'node-selected' : ''}`} style={{ minWidth: '220px' }}>
            <Handle type="target" position={Position.Left} id="target" className="node-handle target-handle" />
            <div className="node-header" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                <span className="icon">🔀</span>
                <strong>Condição</strong>
            </div>
            <div className="node-body">
                <p className="node-label text-center">{data.condition || 'Tem Agendamento?'}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>✅ Sim</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>❌ Não</span>
                </div>
            </div>
            {/* Duas saídas para condições */}
            <Handle type="source" position={Position.Right} id="true" className="node-handle source-handle" style={{ top: '60px' }} />
            <Handle type="source" position={Position.Right} id="false" className="node-handle source-handle" style={{ top: '85px', background: 'var(--danger)' }} />
        </div>
    );
}
