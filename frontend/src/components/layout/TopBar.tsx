interface TopBarProps {
  pageTitle: string;
  userEmail?: string;
  onLogout: () => Promise<void>;
}

export function TopBar({ pageTitle, userEmail, onLogout }: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">FINANCIAL MANAGEMENT</p>
        <h1>{pageTitle}</h1>
      </div>
      <div className="profile">
        <div className="avatar">TL</div>
        <span>{userEmail ?? "Ledger Workspace"}</span>
        <button className="logout-button" onClick={() => void onLogout()}>Sign out</button>
      </div>
    </header>
  );
}
