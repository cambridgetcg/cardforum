"use client";

import { formatPrice } from "@/types/domain";
import { Coins, Layers, TrendingUp, BarChart3 } from "lucide-react";

interface DigitiserStatsProps {
  totalTokensDigitised: number;
  activeTokens: number;
  lifetimeRoyaltyCents: number;
  last30dRoyaltyCents: number;
  totalTrades: number;
}

export function DigitiserStats({
  totalTokensDigitised,
  activeTokens,
  lifetimeRoyaltyCents,
  last30dRoyaltyCents,
  totalTrades,
}: DigitiserStatsProps) {
  const stats = [
    {
      label: "Total Digitised",
      value: String(totalTokensDigitised),
      icon: Layers,
      color: "bg-indigo-100 text-indigo-600",
    },
    {
      label: "Active Tokens",
      value: String(activeTokens),
      icon: BarChart3,
      color: "bg-green-100 text-green-600",
    },
    {
      label: "Lifetime Royalties",
      value: formatPrice(lifetimeRoyaltyCents),
      icon: Coins,
      color: "bg-amber-100 text-amber-600",
    },
    {
      label: "Last 30 Days",
      value: formatPrice(last30dRoyaltyCents),
      icon: TrendingUp,
      color: "bg-blue-100 text-blue-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${stat.color}`}
          >
            <stat.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">{stat.label}</p>
            <p className="text-xl font-bold text-gray-900">{stat.value}</p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-4">
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-900">{totalTrades}</span> royalty-earning
          trades across your digitised tokens
        </p>
      </div>
    </div>
  );
}
