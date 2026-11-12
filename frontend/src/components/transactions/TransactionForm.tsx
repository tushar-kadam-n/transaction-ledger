import { CURRENCY_SYMBOL } from "../../constants/transaction";
import { TRANSACTION_TYPE_OPTIONS } from "../../constants/transaction";
import type { Account } from "../../types/account";
import type { TransactionType } from "../../types/transaction";

interface TransactionFormProps {
  accounts: Account[];
  selectedAccountId: string;
  transactionType: TransactionType;
  amount: string;
  description: string;
  referenceId: string;
  transactionDate: string;
  amountError: string;
  transactionMessage: string;
  transactionError: string;
  isSubmitting: boolean;
  isAmountValid: boolean;
  exceedsAvailableBalance: boolean;
  currentBalance: number | null;
  projectedBalance: number | null;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onAccountChange: (accountId: string) => void;
  onTransactionTypeChange: (type: TransactionType) => void;
  onAmountChange: (amount: string) => void;
  onAmountBlur: () => void;
  onDescriptionChange: (description: string) => void;
  onReferenceIdChange: (referenceId: string) => void;
  onTransactionDateChange: (date: string) => void;
}

export function TransactionForm({
  accounts,
  selectedAccountId,
  transactionType,
  amount,
  description,
  referenceId,
  transactionDate,
  amountError,
  transactionMessage,
  transactionError,
  isSubmitting,
  isAmountValid,
  exceedsAvailableBalance,
  currentBalance,
  projectedBalance,
  onSubmit,
  onAccountChange,
  onTransactionTypeChange,
  onAmountChange,
  onAmountBlur,
  onDescriptionChange,
  onReferenceIdChange,
  onTransactionDateChange,
}: TransactionFormProps) {
  return (
    <form className="transaction-form" onSubmit={onSubmit}>
      {" "}
      <label>Account</label>
      <select
        value={selectedAccountId}
        onChange={(e) => onAccountChange(e.target.value)}
      >
        <option value="">Select account</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>

      {currentBalance !== null && (
        <div className="transaction-balance-panels">
          <div className="balance-panel current-balance-panel">
            <span>Current Balance</span>
            <strong>{`${CURRENCY_SYMBOL}${currentBalance.toFixed(2)}`}</strong>
          </div>
          <div
            className={`balance-panel projected-balance-panel ${transactionType}`}
          >
            <span>Projected Balance</span>
            <strong>
              {projectedBalance === null
                ? "Enter a valid amount"
                : `${CURRENCY_SYMBOL}${projectedBalance.toFixed(2)}`}
            </strong>
          </div>
        </div>
      )}

      <label>Transaction Type</label>
      <select
        value={transactionType}
        onChange={(e) =>
          onTransactionTypeChange(e.target.value as TransactionType)
        }
      >
        {TRANSACTION_TYPE_OPTIONS.map((transactionOption) => (
          <option key={transactionOption.value} value={transactionOption.value}>
            {transactionOption.label}
          </option>
        ))}
      </select>

      <label>Amount</label>
      <input
        type="number"
        value={amount}
        aria-invalid={Boolean(amountError)}
        aria-describedby={amountError ? "transaction-amount-error" : undefined}
        onChange={(e) => onAmountChange(e.target.value)}
        onBlur={onAmountBlur}
        placeholder="Enter amount"
      />
      {amountError && (
        <p
          className="amount-validation-message"
          id="transaction-amount-error"
          role="alert"
        >
          {amountError}
        </p>
      )}

      <label>Description</label>
      <input
        type="text"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Enter transaction description"
      />

      <label htmlFor="transaction-date">Transaction Date &amp; Time</label>
      <input
        id="transaction-date"
        type="datetime-local"
        required
        value={transactionDate}
        onChange={(e) => onTransactionDateChange(e.target.value)}
      />

      <label>Reference ID</label>
      <input
        type="text"
        value={referenceId}
        onChange={(e) => onReferenceIdChange(e.target.value)}
        placeholder="e.g. REF-001"
      />

      {transactionMessage && (
        <p className="success-message">{transactionMessage}</p>
      )}
      {transactionError && (
        <p className="error-message">{transactionError}</p>
      )}
      <button
        type="submit"
        className="primary-button"
        disabled={
          isSubmitting ||
          !selectedAccountId ||
          !isAmountValid ||
          exceedsAvailableBalance
        }
      >
        {isSubmitting ? "Processing..." : "Create Transaction"}
      </button>
    </form>
  );
}
