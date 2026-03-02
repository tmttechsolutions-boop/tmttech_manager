import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function HttpNode({ data, selected }) {
    return (
        <div className={`flow-node action-node ${selected ? 'node-selected' : ''}`}>
            <Handle type="target" position={Position.Left} id="a" className="node-handle target-handle" />
            <div className="node-header" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <span className="icon">🔗</span>
                <strong>Requisição HTTP</strong>
            </div>
            <div className="node-body">
                <p className="node-label">Webhook / API Ext</p>
                <div className="message-preview">
                    <span style={{ fontWeight: 'bold' }}>{data.method || 'POST'}</span>
                    <br />
                    <span style={{ fontSize: '0.8em', opacity: 0.8 }}>
                        {data.url ? (data.url.length > 30 ? `${data.url.substring(0, 30)}...` : data.url) : 'Nenhuma URL configurada'}
                    </span>
                    {data.headers && (
                        <div style={{ marginTop: '4px', fontSize: '0.7em', color: 'var(--success)' }}>
                            🗝️ Com Headers Customizados
                        </div>
                    )}
                </div>
            </div>
            <Handle type="source" position={Position.Right} id="b" className="node-handle source-handle" />
        </div>
    );
}
