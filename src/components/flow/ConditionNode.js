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
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', marginBottom: '8px' }}>
                    <p className="node-label text-center" style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Se atender a regra:</p>
                    <p className="node-label text-center" style={{ fontWeight: 'bold', margin: '4px 0 0 0' }}>
                        {data.conditionField || 'Qualquer'} {data.conditionOperator || '='} {data.conditionValue || '...'}
                    </p>
                </div>
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
