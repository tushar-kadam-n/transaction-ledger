import { CURRENCY_SYMBOL } from "../../constants/transaction";
import type { Account } from "../../types/account";

interface AccountCardProps {
  account: Account;
  appearance?: "overview" | "standard";
}

export function AccountCard({
  account,
  appearance = "standard",
}: AccountCardProps) {
  const cardClassName =
    appearance === "overview"
      ? "stat-card overview-account-card"
      : "stat-card";
  const accountTypeClassName =
    appearance === "overview" ? "muted account-id" : "muted";

  return (
    <article className={cardClassName}>
      <p>Account name</p>
      <h3>{account.name}</h3>
      <span>
        {`Balance: ${CURRENCY_SYMBOL}${Number(account.balance).toFixed(2)}`}
      </span>
      <p className={accountTypeClassName}>
        {account.account_type.replace("_", " ")} account
      </p>
    </article>
  );
}
