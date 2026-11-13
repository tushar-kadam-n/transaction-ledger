import { useEffect, useRef, useState } from "react";
import {
  getAccounts,
  createAccount,
  createTransaction,
  getAllTransactions,
} from "./api";
import { NAVIGATION_TABS, type NavigationTab } from "./constants/navigation";
import {
  CURRENCY_SYMBOL,
  OVERVIEW_RECENT_TRANSACTION_LIMIT,
  TRANSACTION_DISPLAY_LOCALE,
} from "./constants/transaction";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { AccountCard } from "./components/accounts/AccountCard";
import { AccountForm } from "./components/accounts/AccountForm";
import { TransactionForm } from "./components/transactions/TransactionForm";
import { HistoryPage } from "./features/history/HistoryPage";
import { OverviewPage } from "./features/overview/OverviewPage";
import { useTransactionHistory } from "./hooks/useTransactionHistory";
import type { Account, AccountFormErrors, NewAccount } from "./types/account";
import type {
  TransactionHistoryItem,
  TransactionType,
} from "./types/transaction";
import "./App.css";

function currentLocalDateTime() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 16);
}

function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>(NAVIGATION_TABS[0]);
  const history = useTransactionHistory(activeTab === "History");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [transactionType, setTransactionType] =
    useState<TransactionType>("credit");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [transactionDate, setTransactionDate] = useState(currentLocalDateTime);
  const [submitting, setSubmitting] = useState(false);
  const [transactionMessage, setTransactionMessage] = useState("");
  const [transactionError, setTransactionError] = useState("");
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
  const [recentTransactions, setRecentTransactions] = useState<
    TransactionHistoryItem[]
  >([]);
  const lastOverviewRequestTab = useRef<NavigationTab | null>(null);
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
    if (activeTab !== "Overview") {
      lastOverviewRequestTab.current = activeTab;
      return;
    }

    if (lastOverviewRequestTab.current === "Overview") return;
    lastOverviewRequestTab.current = "Overview";

    async function loadOverviewTransactions() {
      try {
        const result = await getAllTransactions(
          1,
          OVERVIEW_RECENT_TRANSACTION_LIMIT,
        );
        setRecentTransactions(result.transactions);
        setTotalTransactions(result.total_records);
      } catch (error) {
        console.error("Failed to load overview transactions:", error);
      }
    }

    loadOverviewTransactions();
  }, [activeTab]);

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
        transaction_date: new Date(transactionDate).toISOString(),
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
      setTransactionDate(currentLocalDateTime());

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

  function handleAccountFormValuesChange(values: NewAccount) {
    setNewAccount(values);
    setAccountFormErrors({});
  }

  return (
    <div className="app">
      <Sidebar activeTab={activeTab} onNavigate={setActiveTab} />

      <main className="main">
        <TopBar pageTitle={activeTab} />

        {activeTab === "Overview" && (
          <OverviewPage
            accounts={accounts}
            totalAccounts={totalAccounts}
            totalBalance={totalBalance}
            totalTransactions={totalTransactions}
            recentTransactions={recentTransactions}
            loadingAccounts={loadingAccounts}
            accountsError={accountsError}
            currencySymbol={CURRENCY_SYMBOL}
            displayLocale={TRANSACTION_DISPLAY_LOCALE}
            onManageAccounts={() => setActiveTab("Accounts")}
            onViewHistory={() => setActiveTab("History")}
          />
        )}

        {activeTab === "Accounts" && (
          <>
            <AccountForm
              values={newAccount}
              errors={accountFormErrors}
              isSubmitting={creatingAccount}
              successMessage={accountCreateMessage}
              errorMessage={accountCreateError}
              onValuesChange={handleAccountFormValuesChange}
              onSubmit={handleCreateAccount}
            />
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
                  <AccountCard key={account.id} account={account} />
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

            <TransactionForm
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              transactionType={transactionType}
              amount={amount}
              description={description}
              referenceId={referenceId}
              transactionDate={transactionDate}
              amountError={transactionAmountError}
              transactionMessage={transactionMessage}
              transactionError={transactionError}
              isSubmitting={submitting}
              isAmountValid={validTransactionAmount}
              exceedsAvailableBalance={exceedsAvailableBalance}
              currentBalance={currentTransactionBalance}
              projectedBalance={projectedTransactionBalance}
              onSubmit={handleCreateTransaction}
              onAccountChange={(accountId) => {
                setSelectedAccountId(accountId);
                setTransactionError("");
              }}
              onTransactionTypeChange={(type) => {
                setTransactionType(type);
                setTransactionError("");
              }}
              onAmountChange={(value) => {
                setAmount(value);
                setAmountTouched(true);
                setTransactionError("");
              }}
              onAmountBlur={() => setAmountTouched(true)}
              onDescriptionChange={setDescription}
              onReferenceIdChange={setReferenceId}
              onTransactionDateChange={setTransactionDate}
            />
          </section>
        )}

        {activeTab === "History" && (
          <HistoryPage
            accounts={accounts}
            {...history}
          />
        )}
      </main>
    </div>
  );
}

export default App;
