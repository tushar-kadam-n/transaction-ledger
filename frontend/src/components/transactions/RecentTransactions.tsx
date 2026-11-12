import type { TransactionHistoryItem } from "../../types/transaction";

interface RecentTransactionsProps {
  transactions: TransactionHistoryItem[];
  currencySymbol: string;
  displayLocale: string;
  onViewHistory: () => void;
}

export function RecentTransactions({
  transactions,
  currencySymbol,
  displayLocale,
  onViewHistory,
}: RecentTransactionsProps) {
  return (
    <section className="content-card recent-transactions">
      <div className="overview-section-header">
        <div>
          <p className="eyebrow">ACTIVITY</p>
          <h2>Recent Transactions</h2>
          <p className="muted">Your latest financial activity.</p>
        </div>

        <button className="secondary-button" onClick={onViewHistory}>
          View history →
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state">No transactions available.</div>
      ) : (
        <div className="recent-transaction-list">
          {transactions.map((transaction) => (
            <article className="recent-transaction-item" key={transaction.id}>
              <div className="transaction-info">
                <h3>{transaction.description}</h3>
                <p>{transaction.account_name}</p>
                <span>
                  {new Date(transaction.created_at).toLocaleString(
                    displayLocale,
                  )}
                </span>
              </div>

              <div className="transaction-amount">
                <span className={`transaction-badge ${transaction.type}`}>
                  {transaction.type.toUpperCase()}
                </span>
                <strong>
                  {transaction.type === "debit" ? "−" : "+"}
                  {`${currencySymbol}${Number(transaction.amount).toFixed(2)}`}
                </strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
