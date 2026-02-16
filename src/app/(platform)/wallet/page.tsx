"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { WalletBalance } from "@/components/wallet/wallet-balance";
import { DepositButton } from "@/components/wallet/deposit-button";
import { WithdrawForm } from "@/components/wallet/withdraw-form";
import { TransactionHistory } from "@/components/wallet/transaction-history";
import { ConnectAccount } from "@/components/wallet/connect-account";

interface Transaction {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "WITHDRAWAL_REVERSAL" | "TRADE_HOLD" | "TRADE_RELEASE" | "TRADE_FEE" | "TRADE_REFUND" | "VERIFICATION_FEE" | "VERIFICATION_FEE_REFUND" | "AUTHENTICATOR_EARN" | "DIGITISATION_FEE" | "DIGITISATION_FEE_REFUND" | "DIGITAL_TRADE_HOLD" | "DIGITAL_TRADE_RELEASE" | "DIGITAL_TRADE_FEE" | "DIGITISER_ROYALTY" | "REDEMPTION_FEE" | "VAULT_EARN";
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

function WalletContent() {
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const [frozenReason, setFrozenReason] = useState<string | null>(null);
  const [pendingAch, setPendingAch] = useState({ count: 0, totalCents: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [connectStatus, setConnectStatus] = useState({
    hasConnectAccount: false,
    onboardingComplete: false,
  });
  const [loading, setLoading] = useState(true);

  const depositStatus = searchParams.get("deposit");

  const fetchData = useCallback(async () => {
    const [balRes, histRes, connectRes] = await Promise.all([
      fetch("/api/wallet/balance"),
      fetch("/api/wallet/history"),
      fetch("/api/connect/status"),
    ]);

    if (balRes.ok) {
      const data = await balRes.json();
      setBalance(data.balance);
      setFrozen(data.frozen ?? false);
      setFrozenReason(data.frozenReason ?? null);
      setPendingAch(data.pendingAch ?? { count: 0, totalCents: 0 });
    }
    if (histRes.ok) {
      const data = await histRes.json();
      setTransactions(data.transactions);
    }
    if (connectRes.ok) {
      const data = await connectRes.json();
      setConnectStatus(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <p className="text-gray-500">Loading wallet...</p>;
  }

  return (
    <>
      {depositStatus === "success" && (
        <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Deposit successful! Your balance has been updated.
        </div>
      )}
      {depositStatus === "ach_processing" && (
        <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Bank transfer submitted! Funds will be available in 3–5 business days.
        </div>
      )}
      {depositStatus === "cancelled" && (
        <div className="mt-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          Deposit was cancelled.
        </div>
      )}

      {frozen && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            Your wallet is frozen
          </p>
          <p className="mt-1 text-xs text-red-600">
            Withdrawals and trades are disabled due to a pending dispute.
            {frozenReason && ` Reason: ${frozenReason}`}
            {" "}Contact support if you believe this is an error.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-6">
        <WalletBalance
          balance={balance}
          pendingAchCount={pendingAch.count}
          pendingAchCents={pendingAch.totalCents}
        />

        <ConnectAccount
          hasConnectAccount={connectStatus.hasConnectAccount}
          onboardingComplete={connectStatus.onboardingComplete}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <DepositButton onDeposited={fetchData} />
          <WithdrawForm
            balance={balance}
            connectReady={connectStatus.onboardingComplete}
            hasConnectAccount={connectStatus.hasConnectAccount}
            onSuccess={fetchData}
          />
        </div>

        <TransactionHistory transactions={transactions} />
      </div>
    </>
  );
}

export default function WalletPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
      <p className="mt-1 text-sm text-gray-600">
        Manage your funds for trading
      </p>
      <Suspense fallback={<p className="mt-6 text-gray-500">Loading wallet...</p>}>
        <WalletContent />
      </Suspense>
    </div>
  );
}
