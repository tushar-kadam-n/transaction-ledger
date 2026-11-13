import type { Account, CreateAccountPayload } from "./types/account";
import type {
  CreateTransactionResponse,
  GlobalTransactionHistoryResponse,
  TransactionExportFilters,
  TransactionHistoryResponse,
  TransactionPayload,
  TransactionType,
} from "./types/transaction";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function getAccounts(): Promise<Account[]> {
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch accounts: ${response.status}`);
  }

  return (await response.json()) as Account[];
}

export async function createTransaction(
  accountId: string,
  transaction: TransactionPayload,
): Promise<CreateTransactionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/accounts/${accountId}/transactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transaction),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || `Transaction failed: ${response.status}`);
  }

  return data as CreateTransactionResponse;
}

export async function getTransactions(
  accountId: string,
  page = 1,
  limit = 10,
  type?: TransactionType,
): Promise<TransactionHistoryResponse> {
  const history = await getAllTransactions(page, limit, accountId, type);

  return {
    account_id: accountId,
    ...history,
  };
}

export async function getAllTransactions(
  page = 1,
  limit = 10,
  accountId?: string,
  type?: TransactionType,
  search?: string,
  startDate?: string,
  endDate?: string,
): Promise<GlobalTransactionHistoryResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (accountId) params.append("account_id", accountId);
  if (type) params.append("type", type);
  if (search) params.append("search", search);
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);

  const response = await fetch(`${API_BASE_URL}/transactions?${params}`, {
    cache: "no-store",
  });

  const responseBody = await response.text();
  let data: { detail?: string } | undefined;
  try {
    data = JSON.parse(responseBody) as { detail?: string };
  } catch {
    // Proxies and server errors can return plain text instead of JSON.
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        responseBody ||
        `Failed to fetch transactions: ${response.status}`,
    );
  }

  if (!data) {
    throw new Error(
      "The server returned an invalid transaction history response.",
    );
  }

  return data as GlobalTransactionHistoryResponse;
}

export async function exportTransactionsCsv(
  filters: TransactionExportFilters,
): Promise<Blob> {
  const params = new URLSearchParams();
  if (filters.accountId) params.set("account_id", filters.accountId);
  if (filters.type) params.set("type", filters.type);
  if (filters.search) params.set("search", filters.search);
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);

  const response = await fetch(
    `${API_BASE_URL}/transactions/export?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    const responseBody = await response.text();
    let detail: string | undefined;
    try {
      detail = (JSON.parse(responseBody) as { detail?: string }).detail;
    } catch {
      // Keep plain-text API errors readable too.
    }
    throw new Error(
      detail ||
        responseBody ||
        `Failed to export transactions: ${response.status}`,
    );
  }

  return response.blob();
}

export async function createAccount(
  payload: CreateAccountPayload,
): Promise<Account> {
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || `Failed to create account: ${response.status}`,
    );
  }

  return data as Account;
}
