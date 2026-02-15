"use client";

import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";

type TransactionType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "WITHDRAWAL_REVERSAL"
  | "TRADE_HOLD"
  | "TRADE_RELEASE"
  | "TRADE_FEE"
  | "TRADE_REFUND"
  | "VERIFICATION_FEE"
  | "VERIFICATION_FEE_REFUND"
  | "AUTHENTICATOR_EARN"
  | "DIGITISATION_FEE"
  | "DIGITISATION_FEE_REFUND"
  | "DIGITAL_TRADE_HOLD"
  | "DIGITAL_TRADE_RELEASE"
  | "DIGITAL_TRADE_FEE"
  | "DIGITISER_ROYALTY"
  | "REDEMPTION_FEE"
  | "VAULT_EARN";

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<TransactionType, { label: string; variant: "success" | "error" | "warning" | "info" | "default" }> = {
  DEPOSIT: { label: "Deposit", variant: "success" },
  WITHDRAWAL: { label: "Withdrawal", variant: "error" },
  WITHDRAWAL_REVERSAL: { label: "Payout Returned", variant: "info" },
  TRADE_HOLD: { label: "Hold", variant: "warning" },
  TRADE_RELEASE: { label: "Release", variant: "success" },
  TRADE_FEE: { label: "Fee", variant: "error" },
  TRADE_REFUND: { label: "Refund", variant: "info" },
  VERIFICATION_FEE: { label: "Verification Fee", variant: "error" },
  VERIFICATION_FEE_REFUND: { label: "Fee Refund", variant: "info" },
  AUTHENTICATOR_EARN: { label: "Authenticator Earning", variant: "success" },
  DIGITISATION_FEE: { label: "Digitisation Fee", variant: "error" },
  DIGITISATION_FEE_REFUND: { label: "Digitisation Refund", variant: "info" },
  DIGITAL_TRADE_HOLD: { label: "Digital Hold", variant: "warning" },
  DIGITAL_TRADE_RELEASE: { label: "Digital Sale", variant: "success" },
  DIGITAL_TRADE_FEE: { label: "Digital Fee", variant: "error" },
  DIGITISER_ROYALTY: { label: "Royalty", variant: "success" },
  REDEMPTION_FEE: { label: "Redemption Fee", variant: "error" },
  VAULT_EARN: { label: "Vault Earning", variant: "success" },
};

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">No transactions yet. Deposit funds to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">Transaction History</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {transactions.map((tx) => {
          const config = TYPE_CONFIG[tx.type];
          const isCredit = tx.amount > 0;

          return (
            <li key={tx.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <Badge variant={config.variant}>{config.label}</Badge>
                <span className="text-sm text-gray-600">{tx.description}</span>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`text-sm font-medium ${
                    isCredit ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isCredit ? "+" : ""}
                  {formatPrice(tx.amount)}
                </span>
                <span className="w-20 text-right text-xs text-gray-400">
                  {formatRelativeTime(new Date(tx.createdAt))}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
