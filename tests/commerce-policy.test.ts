import { describe, expect, it } from "vitest";
import {
  canCreateUnpaidTrade,
  hasUnpaidTradeAdmission,
  assertNewTradeHoldsAllowed,
  UNPAID_TRADE_ADMISSION,
} from "@/lib/commerce-policy";

const equal = [
  { fromUserId: "a", toUserId: "b", askPrice: 500 },
  { fromUserId: "b", toUserId: "a", askPrice: 500 },
];

describe("new monetary commitment boundary", () => {
  it("keeps equal DIRECT barter, including a balanced three-party cycle", () => {
    expect(canCreateUnpaidTrade("DIRECT", equal)).toBe(true);
    expect(
      canCreateUnpaidTrade("DIRECT", [
        { fromUserId: "a", toUserId: "b", askPrice: 500 },
        { fromUserId: "b", toUserId: "c", askPrice: 500 },
        { fromUserId: "c", toUserId: "a", askPrice: 500 },
      ]),
    ).toBe(true);
  });

  it("refuses monetary differences, fee-bearing authentication and unknown prices", () => {
    expect(canCreateUnpaidTrade("DIRECT", [equal[0], { ...equal[1], askPrice: 600 }])).toBe(false);
    expect(canCreateUnpaidTrade("AUTHENTICATED", equal)).toBe(false);
    expect(canCreateUnpaidTrade(null, equal)).toBe(false);
    expect(canCreateUnpaidTrade("DIRECT", [equal[0], { ...equal[1], askPrice: null }])).toBe(false);
    expect(canCreateUnpaidTrade("DIRECT", [equal[0], { ...equal[1], askPrice: NaN }])).toBe(false);
    expect(canCreateUnpaidTrade("DIRECT", [])).toBe(false);
  });

  it("grandfathers every unmarked record, including one created during rollout", () => {
    const legacy = [{ status: "PROPOSED", at: "2099-01-01T00:00:00.000Z" }];
    const marked = [
      { status: "PROPOSED", at: "2020-01-01T00:00:00.000Z", admission: UNPAID_TRADE_ADMISSION },
    ];
    expect(hasUnpaidTradeAdmission(legacy)).toBe(false);
    expect(hasUnpaidTradeAdmission(marked)).toBe(true);
    expect(hasUnpaidTradeAdmission(null)).toBe(false);
    expect(() => assertNewTradeHoldsAllowed(legacy, new Map([["a", 100]]))).not.toThrow();
    expect(() => assertNewTradeHoldsAllowed(marked, new Map([["a", 100]]))).toThrow("retired");
    expect(() => assertNewTradeHoldsAllowed(marked, new Map([["a", 0]]))).not.toThrow();
  });
});
