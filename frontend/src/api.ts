const API_BASE_URL = "/api";

export async function getAccounts() {
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch accounts: ${response.status}`);
  }

  return response.json();
}

export type TransactionPayload = {
  type: "credit" | "debit";
  amount: string;
  description: string;
  reference_id: string;
};

export async function createTransaction(
  accountId: string,
  transaction: TransactionPayload,
) {
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

  return data;
}

export type Transaction = {
  id: string;
  account_id: string;
  type: "credit" | "debit";
  amount: string;
  description: string;
  reference_id: string | null;
  created_at: string;
};

export type TransactionHistoryItem = Transaction & { account_name: string };

export type TransactionHistoryResponse = {
  account_id: string;
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
  transactions: Transaction[];
};

export type GlobalTransactionHistoryResponse = {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
  transactions: TransactionHistoryItem[];
};

export async function getTransactions(
  accountId: string,
  page = 1,
  limit = 10,
  type?: "credit" | "debit",
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
  type?: "credit" | "debit",
): Promise<GlobalTransactionHistoryResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (accountId) params.append("account_id", accountId);
  if (type) params.append("type", type);

  const response = await fetch(`${API_BASE_URL}/transactions?${params}`, {
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || `Failed to fetch transactions: ${response.status}`,
    );
  }

  return data;
}

export type CreateAccountPayload = {
  name: string;
  account_type: "savings" | "current" | "cash" | "digital_wallet" | "business";
  email?: string;
  phone?: string;
  description?: string;
};

export async function createAccount(payload: CreateAccountPayload) {
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

  return data;
}
