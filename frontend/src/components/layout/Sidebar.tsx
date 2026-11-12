import { NAVIGATION_TABS, type NavigationTab } from "../../constants/navigation";

interface SidebarProps {
  activeTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
}

export function Sidebar({ activeTab, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">T</div>
        <span>Transaction Ledger</span>
      </div>

      <p className="nav-label">WORKSPACE</p>

      <nav>
        {NAVIGATION_TABS.map((tab) => (
          <button
            key={tab}
            className={`nav-item ${activeTab === tab ? "active" : ""}`}
            onClick={() => onNavigate(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="status-dot" />
        API dashboard
        <span className="version">v1.0</span>
      </div>
    </aside>
  );
}
