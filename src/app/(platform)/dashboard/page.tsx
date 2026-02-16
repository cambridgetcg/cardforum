"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, ListChecks, Package, Sparkles, BookOpen, Heart } from "lucide-react";
import { useDashboard } from "@/hooks/use-api";

export default function DashboardPage() {
  const { data: stats } = useDashboard();

  const s = stats ?? {
    listings: 0,
    haveCount: 0,
    wantCount: 0,
    activeTrades: 0,
    completedTrades: 0,
    pendingProposals: 0,
    expertPostCount: 0,
    collectionCards: 0,
    collectionEntries: 0,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-600">
        Welcome to CardForum. Here&apos;s your trading overview.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Listings</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{s.listings}</p>
            <p className="text-sm text-gray-500">
              {s.haveCount} have &middot; {s.wantCount} want
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Active Trades</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{s.activeTrades}</p>
            <p className="text-sm text-gray-500">trades in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Completed</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{s.completedTrades}</p>
            <p className="text-sm text-gray-500">successful trades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Matches</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{s.pendingProposals}</p>
            <p className="text-sm text-gray-500">pending proposals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Expert Posts</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{s.expertPostCount}</p>
            <p className="text-sm text-gray-500">published posts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold text-gray-900">Collection</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{s.collectionCards}</p>
            <p className="text-sm text-gray-500">
              {s.collectionEntries} unique card{s.collectionEntries !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="py-8 text-center">
            {s.listings === 0 ? (
              <>
                <p className="text-gray-500">Start by listing cards you want to trade!</p>
                <Link href="/listings" className="mt-3 inline-block">
                  <Button>Go to Listings</Button>
                </Link>
              </>
            ) : (
              <>
                <p className="text-gray-500">
                  You have {s.listings} active listing{s.listings !== 1 ? "s" : ""}. The matching
                  engine can find bridge trades for you.
                </p>
                <Link href="/trades" className="mt-3 inline-block">
                  <Button>View Trades</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">
              Browse the card catalog to discover cards across all TCGs.
            </p>
            <Link href="/browse" className="mt-3 inline-block">
              <Button variant="outline">Browse Cards</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">
              Share your expertise — price analyses, combo guides, and more.
            </p>
            <Link href="/expert" className="mt-3 inline-block">
              <Button variant="outline">Visit Expert Hub</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-8 text-center">
            {s.collectionCards === 0 ? (
              <>
                <p className="text-gray-500">
                  Track your collection — see completion progress across sets.
                </p>
                <Link href="/collection" className="mt-3 inline-block">
                  <Button variant="outline">Start Collecting</Button>
                </Link>
              </>
            ) : (
              <>
                <p className="text-gray-500">
                  You have {s.collectionCards} card{s.collectionCards !== 1 ? "s" : ""} in your
                  collection.
                </p>
                <Link href="/collection" className="mt-3 inline-block">
                  <Button variant="outline">View Collection</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
