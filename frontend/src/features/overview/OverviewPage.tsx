import { AccountCard } from "../../components/accounts/AccountCard";
import { RecentTransactions } from "../../components/transactions/RecentTransactions";
import type { Account } from "../../types/account";
import type { TransactionHistoryItem } from "../../types/transaction";

interface OverviewPageProps {
  accounts: Account[];
  totalAccounts: number;
  totalBalance: number;
  totalTransactions: number;
  recentTransactions: TransactionHistoryItem[];
  loadingAccounts: boolean;
  accountsError: string;
  currencySymbol: string;
  displayLocale: string;
  onManageAccounts: () => void;
  onViewHistory: () => void;
}

export function OverviewPage({
  accounts,
  totalAccounts,
  totalBalance,
  totalTransactions,
  recentTransactions,
  loadingAccounts,
  accountsError,
  currencySymbol,
  displayLocale,
  onManageAccounts,
  onViewHistory,
}: OverviewPageProps) {
  return (
    <section>
      <div className="welcome">
        <div>
          <p className="eyebrow">ACCOUNT CENTER</p>
          <h2>Manage your money with clarity.</h2>
          <p>
            Track account balances and financial transactions in one place.
          </p>
        </div>
        <div className="welcome-mark">{currencySymbol}</div>
      </div>

      <div className="stats">
        <article className="stat-card">
          <p>Total Accounts</p>
          <h3>{totalAccounts}</h3>
          <span>Connected to your ledger</span>
        </article>

        <article className="stat-card">
          <p>Total Balance</p>
          <h3>
            {currencySymbol} {totalBalance.toFixed(2)}
          </h3>
          <span>Combined account balance</span>
        </article>

        <article className="stat-card">
          <p>Total Transactions</p>
          <h3>{totalTransactions}</h3>
          <span>Across all accounts</span>
        </article>
      </div>

      <div className="overview-bottom">
        <section className="content-card overview-accounts">
          <div className="overview-section-header">
            <div>
              <p className="eyebrow">GET STARTED</p>
              <h2>Your ledger, at a glance.</h2>
              <p className="muted">Manage your accounts and balances.</p>
            </div>

            <button className="primary-button" onClick={onManageAccounts}>
              Manage accounts →
            </button>
          </div>

          {loadingAccounts && <p className="muted">Loading accounts...</p>}

          {accountsError && <p className="error-message">{accountsError}</p>}

          {!loadingAccounts && !accountsError && accounts.length === 0 && (
            <div className="empty-state">
              No accounts found. Create your first account.
            </div>
          )}

          <div className="accounts-grid">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                appearance="overview"
              />
            ))}
          </div>
        </section>

        <RecentTransactions
          transactions={recentTransactions}
          currencySymbol={currencySymbol}
          displayLocale={displayLocale}
          onViewHistory={onViewHistory}
        />
      </div>
    </section>
  );
}
