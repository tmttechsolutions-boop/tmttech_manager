import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function HttpNode({ data, selected }) {
    return (
        <div style={{
            background: 'var(--bg-panel)',
            border: selected ? '2px solid var(--brand-purple)' : '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px',
            minWidth: '220px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            outline: selected ? '2px solid rgba(192, 132, 252, 0.3)' : 'none',
            outlineOffset: '2px',
            transition: 'all 0.2s',
        }}>
            {/* Input target */}
            <Handle
                type="target"
                position={Position.Top}
                style={{ background: '#ec4899', width: '10px', height: '10px', top: '-5px' }}
            />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem'
                }}>
                    🔗
                </div>
                <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white', margin: 0 }}>Requisição HTTP</h3>
                    <p style={{ fontSize: '0.7rem', color: '#38bdf8', margin: 0 }}>Webhook / API Ext</p>
                </div>
            </div>

            {/* Body */}
            <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>{data.method || 'GET'}</span>
                    {data.url ? (data.url.length > 25 ? `${data.url.substring(0, 25)}...` : data.url) : 'URL não configurada'}
                </p>
                {data.body && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                        {'{ JSON Body }'}
                    </div>
                )}
            </div>

            {/* Output source */}
            <Handle
                type="source"
                position={Position.Bottom}
                style={{ background: '#ec4899', width: '10px', height: '10px', bottom: '-5px' }}
            />
        </div>
    );
}
