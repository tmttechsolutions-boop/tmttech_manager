import { Handle, Position } from '@xyflow/react';

export default function MenuNode({ data, selected }) {
    const buttons = data.buttons || ['Opção 1', 'Opção 2'];

    return (
        <div className={`flow-node menu-node ${selected ? 'node-selected' : ''}`}>
            <Handle type="target" position={Position.Left} id="target" className="node-handle target-handle" />
            <div className="node-header" style={{ backgroundColor: 'var(--brand-purple-dim)', color: 'var(--brand-purple-light)' }}>
                <span className="icon">📱</span>
                <strong>WhatsApp (Menu)</strong>
            </div>
            <div className="node-body">
                <div className="message-preview" style={{ marginBottom: '12px' }}>
                    {data.message || 'Selecione uma das opções:'}
                </div>

                <div className="menu-buttons">
                    {buttons.map((btn, index) => (
                        <div key={index} className="menu-button-item">
                            <div className="menu-btn-text">≡ {btn}</div>
                            {/* Uma saída (Handle) para CADA botão */}
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={`btn-${index}`}
                                className="node-handle source-handle menu-source"
                                style={{ top: `${(index * 36) + 18}px` }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
