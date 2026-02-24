export default function Header() {
    return (
        <header className="main-header glass-panel">
            <div className="header-search">
                <input type="text" placeholder="Buscar clientes ou agendamentos..." className="search-input" />
            </div>

            <div className="header-actions">
                <button className="action-button" title="Notificações">
                    🔔
                </button>
                <div className="user-profile">
                    <div className="avatar">TM</div>
                    <span className="user-name">Thales Martins</span>
                </div>
            </div>
        </header>
    );
}
