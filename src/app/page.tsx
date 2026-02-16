import Link from "next/link";
import { ArrowRightLeft, Globe, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 to-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Trade cards globally.
              <br />
              <span className="text-indigo-600">Ship locally.</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              CardForum bridges P2P trades so your cards never cross borders. No international
              shipping fees. No customs. No waiting weeks.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg">Start Trading</Button>
              </Link>
              <Link href="/browse">
                <Button variant="outline" size="lg">
                  Browse Cards
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900">How the Bridge Works</h2>
            <p className="mt-4 text-gray-600">
              Trading cards are fungible — a Near Mint Charizard in Tokyo is identical to one in
              London. We use this to eliminate international shipping entirely.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                <span className="text-xl font-bold text-indigo-600">1</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">List Your Cards</h3>
              <p className="mt-2 text-sm text-gray-600">
                Tell us what you have and what you want. Our system finds matches across the globe.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                <span className="text-xl font-bold text-indigo-600">2</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Bridge Matches</h3>
              <p className="mt-2 text-sm text-gray-600">
                Our algorithm finds local equivalents — so a trade between Tokyo and London becomes
                two local swaps.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                <span className="text-xl font-bold text-indigo-600">3</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Local Delivery</h3>
              <p className="mt-2 text-sm text-gray-600">
                Verified authenticators handle cards in your region. Fast, cheap, and fully
                verified.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-6">
              <Globe className="h-8 w-8 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">Global Marketplace</h3>
              <p className="text-sm text-gray-600">
                Pokemon, Yu-Gi-Oh!, One Piece, Magic — trade across all major TCGs with collectors
                worldwide.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-6">
              <Shield className="h-8 w-8 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">Verified & Escrowed</h3>
              <p className="text-sm text-gray-600">
                Every card is authenticated by trusted local verifiers. Funds held in escrow until
                delivery.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-6">
              <Zap className="h-8 w-8 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">No Borders, No Fees</h3>
              <p className="text-sm text-gray-600">
                Cards stay local. No customs declarations, no international postage, no weeks of
                waiting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <ArrowRightLeft className="mx-auto h-10 w-10 text-indigo-600" />
          <h2 className="mt-4 text-3xl font-bold text-gray-900">Ready to bridge?</h2>
          <p className="mx-auto mt-4 max-w-lg text-gray-600">
            Join CardForum and start trading with collectors across the world — without the
            international hassle.
          </p>
          <div className="mt-8">
            <Link href="/register">
              <Button size="lg">Create Your Account</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
