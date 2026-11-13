import { useEffect, useRef, useState } from "react";
import {
  getAccounts,
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
import { useAccountCreation } from "./hooks/useAccountCreation";
import { useTransactionCreation } from "./hooks/useTransactionCreation";
import { useTransactionHistory } from "./hooks/useTransactionHistory";
import type { Account } from "./types/account";
import type { TransactionHistoryItem } from "./types/transaction";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>(NAVIGATION_TABS[0]);
  const history = useTransactionHistory(activeTab === "History");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const accountCreation = useAccountCreation({
    refreshAccounts: async () => {
      const updatedAccounts = await getAccounts();
      setAccounts(updatedAccounts);
    },
    selectAccount: setSelectedAccountId,
  });
  const transactionCreation = useTransactionCreation({
    accounts,
    selectedAccountId,
    refreshAccounts: async () => {
      const updatedAccounts = await getAccounts();
      setAccounts(updatedAccounts);
    },
  });
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
              values={accountCreation.newAccount}
              errors={accountCreation.accountFormErrors}
              isSubmitting={accountCreation.creatingAccount}
              successMessage={accountCreation.accountCreateMessage}
              errorMessage={accountCreation.accountCreateError}
              onValuesChange={accountCreation.onValuesChange}
              onSubmit={accountCreation.onSubmit}
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
              transactionType={transactionCreation.transactionType}
              amount={transactionCreation.amount}
              description={transactionCreation.description}
              referenceId={transactionCreation.referenceId}
              transactionDate={transactionCreation.transactionDate}
              amountError={transactionCreation.amountError}
              transactionMessage={transactionCreation.transactionMessage}
              transactionError={transactionCreation.transactionError}
              isSubmitting={transactionCreation.submitting}
              isAmountValid={transactionCreation.isAmountValid}
              exceedsAvailableBalance={transactionCreation.exceedsAvailableBalance}
              currentBalance={transactionCreation.currentBalance}
              projectedBalance={transactionCreation.projectedBalance}
              onSubmit={transactionCreation.onSubmit}
              onAccountChange={(accountId) => {
                setSelectedAccountId(accountId);
                transactionCreation.onAccountChange();
              }}
              onTransactionTypeChange={transactionCreation.onTransactionTypeChange}
              onAmountChange={transactionCreation.onAmountChange}
              onAmountBlur={transactionCreation.onAmountBlur}
              onDescriptionChange={transactionCreation.onDescriptionChange}
              onReferenceIdChange={transactionCreation.onReferenceIdChange}
              onTransactionDateChange={transactionCreation.onTransactionDateChange}
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
