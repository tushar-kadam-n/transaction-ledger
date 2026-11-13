import { useEffect, useRef, useState } from "react";
import { getAllTransactions } from "../api";
import { OVERVIEW_RECENT_TRANSACTION_LIMIT } from "../constants/transaction";
import type { NavigationTab } from "../constants/navigation";
import type { TransactionHistoryItem } from "../types/transaction";

export function useOverviewData(activeTab: NavigationTab) {
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<
    TransactionHistoryItem[]
  >([]);
  const lastOverviewRequestTab = useRef<NavigationTab | null>(null);

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

  return { recentTransactions, totalTransactions };
}
