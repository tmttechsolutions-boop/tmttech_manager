import { Handle, Position } from '@xyflow/react';

export default function DelayNode({ data, selected }) {
    return (
        <div className={`flow-node delay-node ${selected ? 'node-selected' : ''}`} style={{ minWidth: '200px' }}>
            <Handle type="target" position={Position.Left} id="target" className="node-handle target-handle" />
            <div className="node-header" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
                <span className="icon">⏱️</span>
                <strong>Atraso Inteligente</strong>
            </div>
            <div className="node-body">
                <p className="node-label text-center" style={{ fontWeight: '600' }}>
                    {data.delayValue ? `Aguardar ${data.delayValue} ${data.delayUnit || 'Minutos'}` : 'Atraso não configurado'}
                </p>
            </div>
            <Handle type="source" position={Position.Right} id="source" className="node-handle source-handle" />
        </div>
    );
}
