"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ArrowRightLeft, BookOpen, Dices, Heart, Layers, LogOut, Menu, Settings, Shield, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Header() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-indigo-600" />
          <span className="text-xl font-bold text-gray-900">CardForum</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/browse" className="text-sm text-gray-600 hover:text-gray-900">
            Browse
          </Link>
          <Link href="/marketplace" className="text-sm text-gray-600 hover:text-gray-900">
            Market
          </Link>
          <Link href="/expert" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <BookOpen className="h-3.5 w-3.5" />
            Expert
          </Link>
          {session ? (
            <>
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/listings" className="text-sm text-gray-600 hover:text-gray-900">
                My Listings
              </Link>
              <Link href="/trades" className="text-sm text-gray-600 hover:text-gray-900">
                Trades
              </Link>
              <Link href="/collection" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                <Heart className="h-3.5 w-3.5" />
                Collection
              </Link>
              <Link href="/packs" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                <Dices className="h-3.5 w-3.5" />
                Packs
              </Link>
              <Link href="/digital-marketplace" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                <Layers className="h-3.5 w-3.5" />
                Digital
              </Link>
              <Link href="/wallet" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                <Wallet className="h-3.5 w-3.5" />
                Wallet
              </Link>
              <Link href="/authenticator/dashboard" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                <Shield className="h-3.5 w-3.5" />
                Verify
              </Link>
              <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
                Settings
              </Link>
              <Link href="/admin" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                <Settings className="h-3.5 w-3.5" />
                Admin
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="outline" size="sm">Log In</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get Started</Button>
              </Link>
            </>
          )}
        </nav>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="border-t border-gray-200 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link href="/browse" className="text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
              Browse
            </Link>
            <Link href="/marketplace" className="text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
              Market
            </Link>
            <Link href="/expert" className="flex items-center gap-1 text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
              <BookOpen className="h-3.5 w-3.5" />
              Expert Hub
            </Link>
            {session ? (
              <>
                <Link href="/dashboard" className="text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/listings" className="text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  My Listings
                </Link>
                <Link href="/trades" className="text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  Trades
                </Link>
                <Link href="/collection" className="flex items-center gap-1 text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  <Heart className="h-3.5 w-3.5" />
                  Collection
                </Link>
                <Link href="/packs" className="flex items-center gap-1 text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  <Dices className="h-3.5 w-3.5" />
                  Packs
                </Link>
                <Link href="/digital-marketplace" className="flex items-center gap-1 text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  <Layers className="h-3.5 w-3.5" />
                  Digital Marketplace
                </Link>
                <Link href="/wallet" className="flex items-center gap-1 text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  <Wallet className="h-3.5 w-3.5" />
                  Wallet
                </Link>
                <Link href="/authenticator/dashboard" className="flex items-center gap-1 text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  <Shield className="h-3.5 w-3.5" />
                  Verify
                </Link>
                <Link href="/settings" className="text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  Settings
                </Link>
                <Link href="/admin" className="flex items-center gap-1 text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  <Settings className="h-3.5 w-3.5" />
                  Admin
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }); }}
                  className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="sm">Log In</Button>
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  <Button size="sm">Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
