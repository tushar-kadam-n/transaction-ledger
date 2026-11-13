import { useEffect, useState } from "react";
import { exportTransactionsCsv, getAllTransactions } from "../api";
import { HISTORY_PAGE_SIZE } from "../constants/transaction";
import type { GlobalTransactionHistoryResponse, TransactionType } from "../types/transaction";

export function useTransactionHistory(isActive: boolean) {
  const [transactionHistory, setTransactionHistory] =
    useState<GlobalTransactionHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyExporting, setHistoryExporting] = useState(false);
  const [historyExportError, setHistoryExportError] = useState("");
  const [historyExportMessage, setHistoryExportMessage] = useState("");
  const [historyType, setHistoryType] = useState<"" | TransactionType>("");
  const [historyAccountId, setHistoryAccountId] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const invalidHistoryDateRange = Boolean(
    historyStartDate && historyEndDate && historyStartDate > historyEndDate,
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHistoryPage(1);
      setDebouncedHistorySearch(historySearch.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [historySearch]);

  useEffect(() => {
    if (!isActive || invalidHistoryDateRange) return;

    async function loadTransactionHistory() {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const data = await getAllTransactions(
          historyPage,
          HISTORY_PAGE_SIZE,
          historyAccountId || undefined,
          historyType || undefined,
          debouncedHistorySearch || undefined,
          historyStartDate || undefined,
          historyEndDate || undefined,
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
  }, [
    isActive,
    historyAccountId,
    historyPage,
    historyType,
    debouncedHistorySearch,
    historyStartDate,
    historyEndDate,
    invalidHistoryDateRange,
  ]);

  function handleAccountChange(accountId: string) {
    setHistoryAccountId(accountId);
    setHistoryPage(1);
  }

  function handleTypeChange(type: "" | TransactionType) {
    setHistoryType(type);
    setHistoryPage(1);
  }

  function handleStartDateChange(date: string) {
    setHistoryStartDate(date);
    setHistoryPage(1);
  }

  function handleEndDateChange(date: string) {
    setHistoryEndDate(date);
    setHistoryPage(1);
  }

  function handleClearDates() {
    setHistoryStartDate("");
    setHistoryEndDate("");
    setHistoryPage(1);
  }

  async function handleExport() {
    setHistoryExportError("");
    setHistoryExportMessage("");
    setHistoryExporting(true);

    try {
      const csv = await exportTransactionsCsv({
        accountId: historyAccountId || undefined,
        type: historyType || undefined,
        search: debouncedHistorySearch || undefined,
        startDate: historyStartDate || undefined,
        endDate: historyEndDate || undefined,
      });
      const downloadUrl = URL.createObjectURL(csv);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "transactions.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      setHistoryExportMessage("CSV export downloaded.");
    } catch (error) {
      setHistoryExportError(
        error instanceof Error ? error.message : "Unable to export transactions.",
      );
    } finally {
      setHistoryExporting(false);
    }
  }

  return {
    transactionHistory,
    historyLoading,
    historyError,
    historyExporting,
    historyExportError,
    historyExportMessage,
    historyType,
    historyAccountId,
    historySearch,
    historyStartDate,
    historyEndDate,
    historyPage,
    invalidHistoryDateRange,
    onAccountChange: handleAccountChange,
    onTypeChange: handleTypeChange,
    onSearchChange: setHistorySearch,
    onStartDateChange: handleStartDateChange,
    onEndDateChange: handleEndDateChange,
    onClearDates: handleClearDates,
    onExport: handleExport,
    onPreviousPage: () => setHistoryPage((page) => page - 1),
    onNextPage: () => setHistoryPage((page) => page + 1),
  };
}
