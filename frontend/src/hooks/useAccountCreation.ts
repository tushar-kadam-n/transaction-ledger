import { useState } from "react";
import { createAccount } from "../api";
import type { AccountFormErrors, NewAccount } from "../types/account";

const emptyAccount: NewAccount = {
  name: "",
  account_type: "",
  email: "",
  phone: "",
  description: "",
};

interface UseAccountCreationOptions {
  refreshAccounts: () => Promise<void>;
  selectAccount: (accountId: string) => void;
}

export function useAccountCreation({
  refreshAccounts,
  selectAccount,
}: UseAccountCreationOptions) {
  const [newAccount, setNewAccount] = useState<NewAccount>(emptyAccount);
  const [accountFormErrors, setAccountFormErrors] =
    useState<AccountFormErrors>({});
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountCreateMessage, setAccountCreateMessage] = useState("");
  const [accountCreateError, setAccountCreateError] = useState("");

  function handleValuesChange(values: NewAccount) {
    setNewAccount(values);
    setAccountFormErrors({});
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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

      await refreshAccounts();
      selectAccount(result.id);

      setAccountCreateMessage("Account created successfully!");
      setNewAccount({ ...emptyAccount });
      setAccountFormErrors({});
    } catch (error) {
      setAccountCreateError(
        error instanceof Error ? error.message : "Unable to create account.",
      );
    } finally {
      setCreatingAccount(false);
    }
  }

  return {
    newAccount,
    accountFormErrors,
    creatingAccount,
    accountCreateMessage,
    accountCreateError,
    onValuesChange: handleValuesChange,
    onSubmit: handleSubmit,
  };
}
