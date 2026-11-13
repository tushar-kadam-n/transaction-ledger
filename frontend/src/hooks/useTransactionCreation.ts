import { useState } from "react";
import { createTransaction } from "../api";
import type { Account } from "../types/account";
import type { TransactionType } from "../types/transaction";

function currentLocalDateTime() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 16);
}

interface UseTransactionCreationOptions {
  accounts: Account[];
  selectedAccountId: string;
  refreshAccounts: () => Promise<void>;
}

export function useTransactionCreation({
  accounts,
  selectedAccountId,
  refreshAccounts,
}: UseTransactionCreationOptions) {
  const [transactionType, setTransactionType] =
    useState<TransactionType>("credit");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [transactionDate, setTransactionDate] =
    useState(currentLocalDateTime);
  const [submitting, setSubmitting] = useState(false);
  const [transactionMessage, setTransactionMessage] = useState("");
  const [transactionError, setTransactionError] = useState("");

  const selectedTransactionAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  );
  const currentBalance = selectedTransactionAccount
    ? Number(selectedTransactionAccount.balance)
    : null;
  const trimmedAmount = amount.trim();
  const enteredAmount = trimmedAmount ? Number(trimmedAmount) : null;
  const validAmountPrecision = /^\d+(?:\.\d{1,2})?$/.test(trimmedAmount);
  const isAmountValid =
    enteredAmount !== null &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > 0 &&
    validAmountPrecision;
  const exceedsAvailableBalance =
    transactionType === "debit" &&
    isAmountValid &&
    currentBalance !== null &&
    enteredAmount > currentBalance;
  const amountError = !amountTouched
    ? ""
    : enteredAmount === null
      ? "Enter a transaction amount."
      : !isAmountValid
        ? enteredAmount > 0 && !validAmountPrecision
          ? "Use no more than two decimal places."
          : "Enter an amount greater than zero."
        : exceedsAvailableBalance
          ? "Amount exceeds the available balance."
          : "";
  const projectedBalance =
    isAmountValid && currentBalance !== null
      ? transactionType === "credit"
        ? currentBalance + enteredAmount
        : currentBalance - enteredAmount
      : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setTransactionMessage("");
    setTransactionError("");

    if (!selectedAccountId) {
      setTransactionError("Please select an account.");
      return;
    }

    if (!isAmountValid) {
      setAmountTouched(true);
      setTransactionError("");
      return;
    }

    if (
      transactionType === "debit" &&
      selectedTransactionAccount &&
      Number(amount) > Number(selectedTransactionAccount.balance)
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

      await refreshAccounts();

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

  return {
    transactionType,
    amount,
    description,
    referenceId,
    transactionDate,
    amountError,
    transactionMessage,
    transactionError,
    submitting,
    isAmountValid,
    exceedsAvailableBalance,
    currentBalance,
    projectedBalance,
    onSubmit: handleSubmit,
    onAccountChange: () => setTransactionError(""),
    onTransactionTypeChange: (type: TransactionType) => {
      setTransactionType(type);
      setTransactionError("");
    },
    onAmountChange: (value: string) => {
      setAmount(value);
      setAmountTouched(true);
      setTransactionError("");
    },
    onAmountBlur: () => setAmountTouched(true),
    onDescriptionChange: setDescription,
    onReferenceIdChange: setReferenceId,
    onTransactionDateChange: setTransactionDate,
  };
}
