/** New monetary commitments are retired; existing obligations remain serviceable. */
export const NEW_PAID_COMMERCE_RETIRED = true;
export const UNPAID_TRADE_ADMISSION = "unpaid-direct-v1";
export const NEW_PAID_COMMERCE_RETIRED_STATUS = 410;
export const NEW_PAID_COMMERCE_RETIRED_MESSAGE =
  "New paid purchases and services are retired. Existing records, settlement, withdrawals, cancellation and refunds remain available.";

export function assertNewPaidCommerceAllowed(): void {
  if (NEW_PAID_COMMERCE_RETIRED) throw new Error(NEW_PAID_COMMERCE_RETIRED_MESSAGE);
}

/** Only new admission writes this marker; old versions and existing records are untouched. */
export function hasUnpaidTradeAdmission(statusHistory: unknown): boolean {
  return (
    Array.isArray(statusHistory) &&
    statusHistory.some(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        entry.status === "PROPOSED" &&
        entry.admission === UNPAID_TRADE_ADMISSION,
    )
  );
}

/** DIRECT equal-value barter has no net settlement or platform/verification fee. */
export function canCreateUnpaidTrade(
  mode: string | null | undefined,
  legs: readonly { fromUserId: string; toUserId: string; askPrice: number | null }[],
): boolean {
  if (mode !== "DIRECT" || legs.length < 2) return false;
  const net = new Map<string, number>();
  for (const leg of legs) {
    if (
      !leg.fromUserId ||
      !leg.toUserId ||
      leg.fromUserId === leg.toUserId ||
      leg.askPrice === null ||
      !Number.isSafeInteger(leg.askPrice) ||
      leg.askPrice < 0
    )
      return false;
    net.set(leg.fromUserId, (net.get(leg.fromUserId) ?? 0) - leg.askPrice);
    net.set(leg.toUserId, (net.get(leg.toUserId) ?? 0) + leg.askPrice);
  }
  return net.size > 1 && [...net.values()].every((amount) => amount === 0);
}

export function assertNewTradeHoldsAllowed(
  statusHistory: unknown,
  holds: ReadonlyMap<string, number>,
): void {
  if (
    hasUnpaidTradeAdmission(statusHistory) &&
    [...holds.values()].some((amount) => !Number.isSafeInteger(amount) || amount !== 0)
  ) {
    throw new Error(NEW_PAID_COMMERCE_RETIRED_MESSAGE);
  }
}
