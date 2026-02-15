"use client";

import { formatPrice } from "@/types/domain";
import { Wallet, Clock } from "lucide-react";

interface WalletBalanceProps {
  balance: number; // cents
  pendingAchCount?: number;
  pendingAchCents?: number;
}

export function WalletBalance({ balance, pendingAchCount = 0, pendingAchCents = 0 }: WalletBalanceProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
        <Wallet className="h-6 w-6 text-indigo-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500">Wallet Balance</p>
        <p className="text-3xl font-bold text-gray-900">{formatPrice(balance)}</p>
      </div>
      {pendingAchCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <Clock className="h-4 w-4" />
          <div>
            <div className="font-medium">{formatPrice(pendingAchCents)} pending</div>
            <div className="text-xs opacity-75">
              {pendingAchCount} bank transfer{pendingAchCount > 1 ? "s" : ""} settling
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
