import { TRANSACTION_TYPE_OPTIONS } from "../constants/transaction";

export type TransactionType =
  (typeof TRANSACTION_TYPE_OPTIONS)[number]["value"];

export type TransactionPayload = {
  type: TransactionType;
  amount: string;
  description: string;
  reference_id: string;
  transaction_date: string;
};

export type Transaction = {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: string;
  description: string;
  reference_id: string | null;
  transaction_date: string;
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

export type CreateTransactionResponse = {
  message: string;
  duplicate: boolean;
  transaction: Transaction;
  balance: string;
};

export type TransactionExportFilters = {
  accountId?: string;
  type?: TransactionType;
  search?: string;
  startDate?: string;
  endDate?: string;
};
