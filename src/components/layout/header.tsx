"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRightLeft, Menu, X } from "lucide-react";
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
              <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
                Settings
              </Link>
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
                <Link href="/settings" className="text-sm text-gray-600" onClick={() => setMobileOpen(false)}>
                  Settings
                </Link>
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
