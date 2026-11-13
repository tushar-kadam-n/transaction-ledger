interface TopBarProps {
  pageTitle: string;
}

export function TopBar({ pageTitle }: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">FINANCIAL MANAGEMENT</p>
        <h1>{pageTitle}</h1>
      </div>
      <div className="profile">
        <div className="avatar">TL</div>
        <span>Ledger Workspace</span>
      </div>
    </header>
  );
}
