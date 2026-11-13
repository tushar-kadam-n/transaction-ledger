export const NAVIGATION_TABS = [
  "Overview",
  "Accounts",
  "Transactions",
  "History",
] as const;

export type NavigationTab = (typeof NAVIGATION_TABS)[number];
