import { ACCOUNT_TYPE_OPTIONS } from "../../constants/accountTypes";
import { CURRENCY_SYMBOL } from "../../constants/transaction";
import type {
  AccountFormErrors,
  AccountType,
  NewAccount,
} from "../../types/account";

interface AccountFormProps {
  values: NewAccount;
  errors: AccountFormErrors;
  isSubmitting: boolean;
  successMessage: string;
  errorMessage: string;
  onValuesChange: (values: NewAccount) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}

export function AccountForm({
  values,
  errors,
  isSubmitting,
  successMessage,
  errorMessage,
  onValuesChange,
  onSubmit,
}: AccountFormProps) {
  return (
    <form className="account-create-form" onSubmit={onSubmit} noValidate>
      <h3>Create New Account</h3>

      <div className="account-form-field">
        <label htmlFor="new-account-name">Account Name</label>
        <input
          id="new-account-name"
          type="text"
          required
          maxLength={150}
          placeholder="Enter account name"
          value={values.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "account-name-error" : undefined}
          onChange={(e) =>
            onValuesChange({ ...values, name: e.target.value })
          }
        />
        {errors.name && (
          <span className="field-error" id="account-name-error" role="alert">
            {errors.name}
          </span>
        )}
      </div>

      <div className="account-form-field">
        <label htmlFor="new-account-type">Account Type</label>
        <select
          id="new-account-type"
          required
          value={values.account_type}
          aria-invalid={Boolean(errors.account_type)}
          aria-describedby={
            errors.account_type ? "account-type-error" : undefined
          }
          onChange={(e) =>
            onValuesChange({
              ...values,
              account_type: e.target.value as AccountType | "",
            })
          }
        >
          <option value="">Select account type</option>
          {ACCOUNT_TYPE_OPTIONS.map((accountType) => (
            <option key={accountType.value} value={accountType.value}>
              {accountType.label}
            </option>
          ))}
        </select>
        {errors.account_type && (
          <span className="field-error" id="account-type-error" role="alert">
            {errors.account_type}
          </span>
        )}
      </div>

      <div className="account-form-field">
        <label htmlFor="new-account-email">Email Address (optional)</label>
        <input
          id="new-account-email"
          type="email"
          maxLength={254}
          placeholder="name@example.com"
          value={values.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "account-email-error" : undefined}
          onChange={(e) =>
            onValuesChange({ ...values, email: e.target.value })
          }
        />
        {errors.email && (
          <span className="field-error" id="account-email-error" role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <div className="account-form-field">
        <label htmlFor="new-account-phone">Phone Number (optional)</label>
        <input
          id="new-account-phone"
          type="tel"
          maxLength={32}
          placeholder="+1 555 123 4567"
          value={values.phone}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "account-phone-error" : undefined}
          onChange={(e) =>
            onValuesChange({ ...values, phone: e.target.value })
          }
        />
        {errors.phone && (
          <span className="field-error" id="account-phone-error" role="alert">
            {errors.phone}
          </span>
        )}
      </div>

      <div className="account-form-field account-form-field-wide">
        <label htmlFor="new-account-description">
          Description (optional)
        </label>
        <textarea
          id="new-account-description"
          rows={2}
          maxLength={2000}
          placeholder="Add a note about this account"
          value={values.description}
          onChange={(e) =>
            onValuesChange({ ...values, description: e.target.value })
          }
        />
      </div>

      <div
        className="account-initial-balance"
        aria-label="Initial balance is zero rupees"
      >
        <span>Initial Balance</span>
        <strong>{CURRENCY_SYMBOL}0.00</strong>
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Account"}
      </button>

      {successMessage && <p className="success-message">{successMessage}</p>}

      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </form>
  );
}
