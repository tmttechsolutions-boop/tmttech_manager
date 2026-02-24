import { Handle, Position } from '@xyflow/react';

export default function TriggerNode({ data, selected }) {
    return (
        <div className={`flow-node trigger-node ${selected ? 'node-selected' : ''}`}>
            <div className="node-header" style={{ backgroundColor: 'var(--success-dim)', color: 'var(--success)' }}>
                <span className="icon">⚡</span>
                <strong>Gatilho Inicial</strong>
            </div>
            <div className="node-body">
                <p className="node-label">{data.label || 'Qualquer Mensagem'}</p>
                {data.keyword && <span className="node-badge">Palavra: {data.keyword}</span>}
            </div>
            <Handle type="source" position={Position.Right} id="a" className="node-handle source-handle" />
        </div>
    );
}
