import { useEffect, useState } from "react";
import {
  getAccounts,
  createAccount,
  createTransaction,
  getAllTransactions,
  getTransactions,
} from "./api";
import type { GlobalTransactionHistoryResponse, Transaction } from "./api";
import "./App.css";

type Account = {
  id: string;
  name: string;
  account_type: "savings" | "current" | "cash" | "digital_wallet" | "business";
  email: string | null;
  phone: string | null;
  description: string | null;
  balance: number | string;
};

type NewAccount = {
  name: string;
  account_type: NewAccountType | "";
  email: string;
  phone: string;
  description: string;
};

type NewAccountType =
  | "savings"
  | "current"
  | "cash"
  | "digital_wallet"
  | "business";

type AccountFormErrors = Partial<Record<keyof NewAccount, string>>;

type Tab = "Overview" | "Accounts" | "Transactions" | "History";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [transactionType, setTransactionType] = useState<"credit" | "debit">(
    "credit",
  );
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transactionMessage, setTransactionMessage] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [transactionHistory, setTransactionHistory] =
    useState<GlobalTransactionHistoryResponse | null>(null);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [historyType, setHistoryType] = useState<"" | "credit" | "debit">("");
  const [historyAccountId, setHistoryAccountId] = useState("");

  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit] = useState(10);
  const [newAccount, setNewAccount] = useState<NewAccount>({
    name: "",
    account_type: "",
    email: "",
    phone: "",
    description: "",
  });
  const [accountFormErrors, setAccountFormErrors] = useState<AccountFormErrors>(
    {},
  );
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountCreateMessage, setAccountCreateMessage] = useState("");
  const [accountCreateError, setAccountCreateError] = useState("");
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    [],
  );
  const totalAccounts = accounts.length;

  const totalBalance = accounts.reduce(
    (total, account) => total + Number(account.balance),
    0,
  );

  const selectedTransactionAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  );
  const currentTransactionBalance = selectedTransactionAccount
    ? Number(selectedTransactionAccount.balance)
    : null;
  const trimmedTransactionAmount = amount.trim();
  const enteredTransactionAmount = trimmedTransactionAmount
    ? Number(trimmedTransactionAmount)
    : null;
  const validTransactionPrecision = /^\d+(?:\.\d{1,2})?$/.test(
    trimmedTransactionAmount,
  );
  const validTransactionAmount =
    enteredTransactionAmount !== null &&
    Number.isFinite(enteredTransactionAmount) &&
    enteredTransactionAmount > 0 &&
    validTransactionPrecision;
  const exceedsAvailableBalance =
    transactionType === "debit" &&
    validTransactionAmount &&
    currentTransactionBalance !== null &&
    enteredTransactionAmount > currentTransactionBalance;
  const transactionAmountError = !amountTouched
    ? ""
    : enteredTransactionAmount === null
      ? "Enter a transaction amount."
      : !validTransactionAmount
        ? enteredTransactionAmount !== null &&
          enteredTransactionAmount > 0 &&
          !validTransactionPrecision
          ? "Use no more than two decimal places."
          : "Enter an amount greater than zero."
        : exceedsAvailableBalance
          ? "Amount exceeds the available balance."
          : "";
  const projectedTransactionBalance =
    validTransactionAmount && currentTransactionBalance !== null
      ? transactionType === "credit"
        ? currentTransactionBalance + enteredTransactionAmount
        : currentTransactionBalance - enteredTransactionAmount
      : null;

  useEffect(() => {
    async function loadAccounts() {
      setLoadingAccounts(true);
      setAccountsError("");

      try {
        const data = await getAccounts();

        setAccounts(data);

        setSelectedAccountId((current) => current || data[0]?.id || "");
      } catch (error) {
        setAccountsError(
          error instanceof Error ? error.message : "Unable to load accounts.",
        );
      } finally {
        setLoadingAccounts(false);
      }
    }

    loadAccounts();
  }, []);

  useEffect(() => {
    if (activeTab !== "Overview" || accounts.length === 0) return;

    async function loadOverviewTransactions() {
      try {
        const results = await Promise.all(
          accounts.map((account) => getTransactions(account.id, 1, 5)),
        );

        const allTransactions = results.flatMap(
          (result) => result.transactions,
        );

        const sortedTransactions = allTransactions?.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        setRecentTransactions(sortedTransactions.slice(0, 5));

        setTotalTransactions(
          results.reduce((total, result) => total + result.total_records, 0),
        );
      } catch (error) {
        console.error("Failed to load overview transactions:", error);
      }
    }

    loadOverviewTransactions();
  }, [activeTab, accounts]);

  useEffect(() => {
    if (activeTab !== "History") return;

    async function loadTransactionHistory() {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const data = await getAllTransactions(
          historyPage,
          historyLimit,
          historyAccountId || undefined,
          historyType || undefined,
        );

        setTransactionHistory(data);
      } catch (error) {
        setHistoryError(
          error instanceof Error
            ? error.message
            : "Unable to load transaction history.",
        );
      } finally {
        setHistoryLoading(false);
      }
    }

    loadTransactionHistory();
  }, [activeTab, historyAccountId, historyPage, historyLimit, historyType]);

  async function handleCreateTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setTransactionMessage("");
    setTransactionError("");

    if (!selectedAccountId) {
      setTransactionError("Please select an account.");
      return;
    }

    if (!validTransactionAmount) {
      setAmountTouched(true);
      setTransactionError("");
      return;
    }

    const selectedAccount = accounts.find(
      (account) => account.id === selectedAccountId,
    );
    if (
      transactionType === "debit" &&
      selectedAccount &&
      Number(amount) > Number(selectedAccount.balance)
    ) {
      setTransactionError("Amount exceeds the available balance.");
      return;
    }

    if (!description.trim() || !referenceId.trim()) {
      setTransactionError("Description and Reference ID are required.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await createTransaction(selectedAccountId, {
        type: transactionType,
        amount,
        description: description.trim(),
        reference_id: referenceId.trim(),
      });

      if (result.duplicate) {
        setTransactionMessage(
          "Duplicate transaction detected. Balance remains unchanged.",
        );
      } else {
        setTransactionMessage("Transaction created successfully!");
      }

      // Refresh account balances
      const updatedAccounts = await getAccounts();
      setAccounts(updatedAccounts);

      setAmount("");
      setAmountTouched(false);
      setDescription("");
      setReferenceId("");

      console.log("Transaction response:", result);
    } catch (error) {
      setTransactionError(
        error instanceof Error
          ? error.message
          : "Unable to create transaction.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setAccountCreateMessage("");
    setAccountCreateError("");

    const name = newAccount.name.trim();
    const accountType = newAccount.account_type;
    const email = newAccount.email.trim();
    const phone = newAccount.phone.trim();
    const description = newAccount.description.trim();
    const errors: AccountFormErrors = {};

    if (!name) errors.name = "Enter an account name.";
    if (!accountType) errors.account_type = "Select an account type.";

    if (!email && !phone) {
      errors.email = "Provide an email address or phone number.";
      errors.phone = "Provide an email address or phone number.";
    } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errors.email = "Enter a valid email address.";
    }

    if (phone) {
      const digitCount = phone.replace(/\D/g, "").length;
      if (
        !/^\+?[0-9][0-9\s().-]*$/.test(phone) ||
        digitCount < 7 ||
        digitCount > 15
      ) {
        errors.phone = "Enter a valid phone number.";
      }
    }

    setAccountFormErrors(errors);
    if (Object.keys(errors).length > 0 || !accountType) return;

    setCreatingAccount(true);

    try {
      const result = await createAccount({
        name,
        account_type: accountType,
        email: email || undefined,
        phone: phone || undefined,
        description: description || undefined,
      });

      const updatedAccounts = await getAccounts();
      setAccounts(updatedAccounts);

      setSelectedAccountId(result.id);

      setAccountCreateMessage("Account created successfully!");
      setNewAccount({
        name: "",
        account_type: "",
        email: "",
        phone: "",
        description: "",
      });
      setAccountFormErrors({});
    } catch (error) {
      setAccountCreateError(
        error instanceof Error ? error.message : "Unable to create account.",
      );
    } finally {
      setCreatingAccount(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">T</div>
          <span>Transaction Ledger</span>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <nav>
          {(["Overview", "Accounts", "Transactions", "History"] as Tab[]).map(
            (tab) => (
              <button
                key={tab}
                className={`nav-item ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ),
          )}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          API dashboard
          <span className="version">v1.0</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">FINANCIAL MANAGEMENT</p>
            <h1>{activeTab}</h1>
          </div>
          <div className="profile">
            <div className="avatar">TL</div>
            <span>Ledger Workspace</span>
          </div>
        </header>

        {activeTab === "Overview" && (
          <section>
            <div className="welcome">
              <div>
                <p className="eyebrow">ACCOUNT CENTER</p>
                <h2>Manage your money with clarity.</h2>
                <p>
                  Track account balances and financial transactions in one
                  place.
                </p>
              </div>
              <div className="welcome-mark">₹</div>
            </div>

            <div className="stats">
              <article className="stat-card">
                <p>Total Accounts</p>
                <h3>{totalAccounts}</h3>
                <span>Connected to your ledger</span>
              </article>

              <article className="stat-card">
                <p>Total Balance</p>
                <h3>₹ {totalBalance.toFixed(2)}</h3>
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

                  <button
                    className="primary-button"
                    onClick={() => setActiveTab("Accounts")}
                  >
                    Manage accounts →
                  </button>
                </div>

                {loadingAccounts && (
                  <p className="muted">Loading accounts...</p>
                )}

                {accountsError && (
                  <p className="error-message">{accountsError}</p>
                )}

                {!loadingAccounts &&
                  !accountsError &&
                  accounts.length === 0 && (
                    <div className="empty-state">
                      No accounts found. Create your first account.
                    </div>
                  )}

                <div className="accounts-grid">
                  {accounts.map((account) => (
                    <article
                      className="stat-card overview-account-card"
                      key={account.id}
                    >
                      <p>Account name</p>
                      <h3>{account.name}</h3>
                      <span>
                        Balance: ₹{Number(account.balance).toFixed(2)}
                      </span>
                      <p className="muted account-id">
                        {account.account_type.replace("_", " ")} account
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="content-card recent-transactions">
                <div className="overview-section-header">
                  <div>
                    <p className="eyebrow">ACTIVITY</p>
                    <h2>Recent Transactions</h2>
                    <p className="muted">Your latest financial activity.</p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() => setActiveTab("History")}
                  >
                    View history →
                  </button>
                </div>

                {recentTransactions.length === 0 ? (
                  <div className="empty-state">No transactions available.</div>
                ) : (
                  <div className="recent-transaction-list">
                    {recentTransactions.map((transaction) => (
                      <article
                        className="recent-transaction-item"
                        key={transaction.id}
                      >
                        <div className="transaction-info">
                          <h3>{transaction.description}</h3>
                          <p>
                            {accounts.find(
                              (account) =>
                                account.id === transaction.account_id,
                            )?.name || "Unknown Account"}
                          </p>
                          <span>
                            {new Date(transaction.created_at).toLocaleString(
                              "en-IN",
                            )}
                          </span>
                        </div>

                        <div className="transaction-amount">
                          <span
                            className={`transaction-badge ${transaction.type}`}
                          >
                            {transaction.type.toUpperCase()}
                          </span>
                          <strong>
                            {transaction.type === "debit" ? "−" : "+"}₹
                            {Number(transaction.amount).toFixed(2)}
                          </strong>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        )}

        {activeTab === "Accounts" && (
          <>
            <form
              className="account-create-form"
              onSubmit={handleCreateAccount}
              noValidate
            >
              <h3>Create New Account</h3>

              <div className="account-form-field">
                <label htmlFor="new-account-name">Account Name</label>
                <input
                  id="new-account-name"
                  type="text"
                  required
                  maxLength={150}
                  placeholder="Enter account name"
                  value={newAccount.name}
                  aria-invalid={Boolean(accountFormErrors.name)}
                  aria-describedby={
                    accountFormErrors.name ? "account-name-error" : undefined
                  }
                  onChange={(e) => {
                    setNewAccount({ ...newAccount, name: e.target.value });
                    setAccountFormErrors({});
                  }}
                />
                {accountFormErrors.name && (
                  <span
                    className="field-error"
                    id="account-name-error"
                    role="alert"
                  >
                    {accountFormErrors.name}
                  </span>
                )}
              </div>

              <div className="account-form-field">
                <label htmlFor="new-account-type">Account Type</label>
                <select
                  id="new-account-type"
                  required
                  value={newAccount.account_type}
                  aria-invalid={Boolean(accountFormErrors.account_type)}
                  aria-describedby={
                    accountFormErrors.account_type
                      ? "account-type-error"
                      : undefined
                  }
                  onChange={(e) => {
                    setNewAccount({
                      ...newAccount,
                      account_type: e.target.value as NewAccountType | "",
                    });
                    setAccountFormErrors({});
                  }}
                >
                  <option value="">Select account type</option>
                  <option value="savings">Savings</option>
                  <option value="current">Current</option>
                  <option value="cash">Cash</option>
                  <option value="digital_wallet">Digital Wallet</option>
                  <option value="business">Business</option>
                </select>
                {accountFormErrors.account_type && (
                  <span
                    className="field-error"
                    id="account-type-error"
                    role="alert"
                  >
                    {accountFormErrors.account_type}
                  </span>
                )}
              </div>

              <div className="account-form-field">
                <label htmlFor="new-account-email">
                  Email Address (optional)
                </label>
                <input
                  id="new-account-email"
                  type="email"
                  maxLength={254}
                  placeholder="name@example.com"
                  value={newAccount.email}
                  aria-invalid={Boolean(accountFormErrors.email)}
                  aria-describedby={
                    accountFormErrors.email ? "account-email-error" : undefined
                  }
                  onChange={(e) => {
                    setNewAccount({ ...newAccount, email: e.target.value });
                    setAccountFormErrors({});
                  }}
                />
                {accountFormErrors.email && (
                  <span
                    className="field-error"
                    id="account-email-error"
                    role="alert"
                  >
                    {accountFormErrors.email}
                  </span>
                )}
              </div>

              <div className="account-form-field">
                <label htmlFor="new-account-phone">
                  Phone Number (optional)
                </label>
                <input
                  id="new-account-phone"
                  type="tel"
                  maxLength={32}
                  placeholder="+1 555 123 4567"
                  value={newAccount.phone}
                  aria-invalid={Boolean(accountFormErrors.phone)}
                  aria-describedby={
                    accountFormErrors.phone ? "account-phone-error" : undefined
                  }
                  onChange={(e) => {
                    setNewAccount({ ...newAccount, phone: e.target.value });
                    setAccountFormErrors({});
                  }}
                />
                {accountFormErrors.phone && (
                  <span
                    className="field-error"
                    id="account-phone-error"
                    role="alert"
                  >
                    {accountFormErrors.phone}
                  </span>
                )}
              </div>

              <div className="account-form-field account-form-field-wide">
                <label htmlFor="new-account-description">
                  Description (optional)
                </label>
                <textarea
                  id="new-account-description"
                  rows={2}
                  maxLength={2000}
                  placeholder="Add a note about this account"
                  value={newAccount.description}
                  onChange={(e) => {
                    setNewAccount({
                      ...newAccount,
                      description: e.target.value,
                    });
                    setAccountFormErrors({});
                  }}
                />
              </div>

              <div
                className="account-initial-balance"
                aria-label="Initial balance is zero rupees"
              >
                <span>Initial Balance</span>
                <strong>₹0.00</strong>
              </div>

              <button type="submit" disabled={creatingAccount}>
                {creatingAccount ? "Creating..." : "Create Account"}
              </button>

              {accountCreateMessage && (
                <p className="success-message">{accountCreateMessage}</p>
              )}

              {accountCreateError && (
                <p className="error-message">{accountCreateError}</p>
              )}
            </form>
            <section className="content-card accounts-content">
              <div>
                <p className="eyebrow">ACCOUNT MANAGEMENT</p>
                <h2>Accounts</h2>
                <p className="muted">Create an account and view its balance.</p>
              </div>

              {loadingAccounts && <p>Loading accounts...</p>}

              {accountsError && <p>{accountsError}</p>}

              {!loadingAccounts && !accountsError && accounts.length === 0 && (
                <div className="empty-state">No accounts found.</div>
              )}

              <div className="accounts-grid">
                {accounts.map((account) => (
                  <article className="stat-card" key={account.id}>
                    <p>Account name</p>
                    <h3>{account.name}</h3>
                    <span>Balance: ₹{Number(account.balance).toFixed(2)}</span>
                    <p className="muted">
                      {account.account_type.replace("_", " ")} account
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "Transactions" && (
          <section className="content-card">
            <div>
              <p className="eyebrow">MONEY MOVEMENT</p>
              <h2>New transaction</h2>
              <p className="muted">Record a credit or debit transaction.</p>
            </div>

            <form
              className="transaction-form"
              onSubmit={handleCreateTransaction}
            >
              {" "}
              <label>Account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setTransactionError("");
                }}
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              {selectedTransactionAccount &&
                currentTransactionBalance !== null && (
                  <div className="transaction-balance-panels">
                    <div className="balance-panel current-balance-panel">
                      <span>Current Balance</span>
                      <strong>₹{currentTransactionBalance.toFixed(2)}</strong>
                    </div>
                    <div
                      className={`balance-panel projected-balance-panel ${transactionType}`}
                    >
                      <span>Projected Balance</span>
                      <strong>
                        {projectedTransactionBalance === null
                          ? "Enter a valid amount"
                          : `₹${projectedTransactionBalance.toFixed(2)}`}
                      </strong>
                    </div>
                  </div>
                )}
              <label>Transaction Type</label>
              <select
                value={transactionType}
                onChange={(e) => {
                  setTransactionType(e.target.value as "credit" | "debit");
                  setTransactionError("");
                }}
              >
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
              <label>Amount</label>
              <input
                type="number"
                value={amount}
                aria-invalid={Boolean(transactionAmountError)}
                aria-describedby={
                  transactionAmountError
                    ? "transaction-amount-error"
                    : undefined
                }
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAmountTouched(true);
                  setTransactionError("");
                }}
                onBlur={() => setAmountTouched(true)}
                placeholder="Enter amount"
              />
              {transactionAmountError && (
                <p
                  className="amount-validation-message"
                  id="transaction-amount-error"
                  role="alert"
                >
                  {transactionAmountError}
                </p>
              )}
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter transaction description"
              />
              <label>Reference ID</label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
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
                  submitting ||
                  !selectedAccountId ||
                  !validTransactionAmount ||
                  exceedsAvailableBalance
                }
              >
                {submitting ? "Processing..." : "Create Transaction"}
              </button>
            </form>
          </section>
        )}

        {activeTab === "History" && (
          <section className="content-card history-content">
            <div>
              <p className="eyebrow">LEDGER RECORDS</p>
              <h2>Transaction History</h2>
              <p className="muted">View and track all account transactions.</p>
            </div>

            <div className="history-filters">
              <div>
                <label>Account</label>
                <select
                  value={historyAccountId}
                  onChange={(e) => {
                    setHistoryAccountId(e.target.value);
                    setHistoryPage(1);
                  }}
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
                  onChange={(e) => {
                    setHistoryType(e.target.value as "" | "credit" | "debit");
                    setHistoryPage(1);
                  }}
                >
                  <option value="">All Transactions</option>
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
              </div>
            </div>

            {historyLoading && <p className="muted">Loading transactions...</p>}

            {historyError && <p className="error-message">{historyError}</p>}

            {!historyLoading && !historyError && transactionHistory && (
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

                              <td>₹{Number(transaction.amount).toFixed(2)}</td>

                              <td>{transaction.description}</td>

                              <td>{transaction.reference_id?.trim() || "—"}</td>

                              <td>
                                {new Date(
                                  transaction.created_at,
                                ).toLocaleString("en-IN")}
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
                    onClick={() => setHistoryPage((page) => page - 1)}
                  >
                    Previous
                  </button>

                  <span>
                    Page {transactionHistory.page} of{" "}
                    {transactionHistory.total_pages}
                  </span>

                  <button
                    className="secondary-button"
                    disabled={
                      historyPage >= transactionHistory.total_pages ||
                      historyLoading
                    }
                    onClick={() => setHistoryPage((page) => page + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
