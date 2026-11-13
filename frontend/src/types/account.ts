import { ACCOUNT_TYPE_OPTIONS } from "../constants/accountTypes";

export type AccountType = (typeof ACCOUNT_TYPE_OPTIONS)[number]["value"];

export type Account = {
  id: string;
  name: string;
  account_type: AccountType;
  email: string | null;
  phone: string | null;
  description: string | null;
  balance: number | string;
  created_at: string;
};

export type NewAccount = {
  name: string;
  account_type: AccountType | "";
  email: string;
  phone: string;
  description: string;
};

export type AccountFormErrors = Partial<Record<keyof NewAccount, string>>;

export type CreateAccountPayload = {
  name: string;
  account_type: AccountType;
  email?: string;
  phone?: string;
  description?: string;
};
