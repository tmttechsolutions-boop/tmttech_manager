import { Handle, Position } from '@xyflow/react';

export default function ActionNode({ data, selected }) {
    return (
        <div className={`flow-node action-node ${selected ? 'node-selected' : ''}`}>
            <Handle type="target" position={Position.Left} id="a" className="node-handle target-handle" />
            <div className="node-header" style={{ backgroundColor: 'var(--brand-purple-dim)', color: 'var(--brand-purple-light)' }}>
                <span className="icon">💬</span>
                <strong>Enviar Mensagem</strong>
            </div>
            <div className="node-body">
                <p className="node-label">WhatsApp</p>
                <div className="message-preview">
                    {data.message
                        ? (data.message.length > 50 ? data.message.substring(0, 50) + '...' : data.message)
                        : 'Clique para escrever...'}
                </div>
            </div>
            <Handle type="source" position={Position.Right} id="b" className="node-handle source-handle" />
        </div>
    );
}
