import { TRANSACTION_TYPE_OPTIONS } from "../../constants/transaction";
import {
  CURRENCY_SYMBOL,
  TRANSACTION_DISPLAY_LOCALE,
} from "../../constants/transaction";
import type { Account } from "../../types/account";
import type {
  GlobalTransactionHistoryResponse,
  TransactionType,
} from "../../types/transaction";

interface HistoryPageProps {
  accounts: Account[];
  transactionHistory: GlobalTransactionHistoryResponse | null;
  historyPage: number;
  historyAccountId: string;
  historyType: "" | TransactionType;
  historySearch: string;
  historyStartDate: string;
  historyEndDate: string;
  invalidHistoryDateRange: boolean;
  historyLoading: boolean;
  historyError: string;
  historyExporting: boolean;
  historyExportError: string;
  historyExportMessage: string;
  onAccountChange: (accountId: string) => void;
  onTypeChange: (type: "" | TransactionType) => void;
  onSearchChange: (search: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClearDates: () => void;
  onExport: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function HistoryPage({
  accounts,
  transactionHistory,
  historyPage,
  historyAccountId,
  historyType,
  historySearch,
  historyStartDate,
  historyEndDate,
  invalidHistoryDateRange,
  historyLoading,
  historyError,
  historyExporting,
  historyExportError,
  historyExportMessage,
  onAccountChange,
  onTypeChange,
  onSearchChange,
  onStartDateChange,
  onEndDateChange,
  onClearDates,
  onExport,
  onPreviousPage,
  onNextPage,
}: HistoryPageProps) {
  return (
    <section className="content-card history-content">
      <div>
        <p className="eyebrow">LEDGER RECORDS</p>
        <h2>Transaction History</h2>
        <p className="muted">View and track all account transactions.</p>
      </div>

      <div className="history-filters">
        <div className="history-search-field">
          <label htmlFor="history-search">Search transactions</label>
          <input
            id="history-search"
            type="search"
            placeholder="Search description, reference ID, or account..."
            value={historySearch}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="history-start-date">From Date</label>
          <input
            id="history-start-date"
            type="date"
            value={historyStartDate}
            max={historyEndDate || undefined}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="history-end-date">To Date</label>
          <input
            id="history-end-date"
            type="date"
            value={historyEndDate}
            min={historyStartDate || undefined}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="secondary-button history-clear-dates"
          disabled={!historyStartDate && !historyEndDate}
          onClick={onClearDates}
        >
          Clear dates
        </button>
        <div>
          <label>Account</label>
          <select
            value={historyAccountId}
            onChange={(e) => onAccountChange(e.target.value)}
          >
            <option value="">All Accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Transaction Type</label>
          <select
            value={historyType}
            onChange={(e) =>
              onTypeChange(e.target.value as "" | TransactionType)
            }
          >
            <option value="">All Transactions</option>
            {TRANSACTION_TYPE_OPTIONS.map((transactionOption) => (
              <option
                key={transactionOption.value}
                value={transactionOption.value}
              >
                {transactionOption.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        className="primary-button history-export-button"
        onClick={onExport}
        disabled={historyExporting || invalidHistoryDateRange}
      >
        {historyExporting ? "Exporting..." : "Export CSV"}
      </button>

      {historyExportMessage && (
        <p className="success-message" role="status">
          {historyExportMessage}
        </p>
      )}
      {historyExportError && (
        <p className="error-message" role="alert">
          {historyExportError}
        </p>
      )}

      {invalidHistoryDateRange && (
        <p className="error-message" role="alert">
          From Date must be on or before To Date.
        </p>
      )}

      {historyLoading && <p className="muted">Loading transactions...</p>}

      {historyError && <p className="error-message">{historyError}</p>}

      {!invalidHistoryDateRange &&
        !historyLoading &&
        !historyError &&
        transactionHistory && (
          <>
            <p className="muted">
              Total records: {transactionHistory.total_records}
            </p>

            {transactionHistory.transactions.length === 0 ? (
              <div className="empty-state">No transactions found.</div>
            ) : (
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Sr No</th>
                      <th>Account</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Description</th>
                      <th>Reference ID</th>
                      <th>Date &amp; Time</th>
                    </tr>
                  </thead>

                  <tbody>
                    {transactionHistory.transactions.map(
                      (transaction, index) => (
                        <tr key={transaction.id}>
                          <td>
                            {(transactionHistory.page - 1) *
                              transactionHistory.limit +
                              index +
                              1}
                          </td>

                          <td>{transaction.account_name}</td>

                          <td>
                            <span
                              className={`transaction-badge ${transaction.type}`}
                            >
                              {transaction.type.toUpperCase()}
                            </span>
                          </td>

                          <td>
                            {`${CURRENCY_SYMBOL}${Number(transaction.amount).toFixed(2)}`}
                          </td>

                          <td>{transaction.description}</td>

                          <td>{transaction.reference_id?.trim() || "—"}</td>

                          <td>
                            {new Date(
                              transaction.transaction_date,
                            ).toLocaleString(TRANSACTION_DISPLAY_LOCALE)}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="history-pagination">
              <button
                className="secondary-button"
                disabled={historyPage <= 1 || historyLoading}
                onClick={onPreviousPage}
              >
                Previous
              </button>

              <span>
                Page {transactionHistory.page} of {transactionHistory.total_pages}
              </span>

              <button
                className="secondary-button"
                disabled={
                  historyPage >= transactionHistory.total_pages ||
                  historyLoading
                }
                onClick={onNextPage}
              >
                Next
              </button>
            </div>
          </>
        )}
    </section>
  );
}
