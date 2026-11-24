import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight text-gray-900">CardForum</h1>
      <p className="mt-6 text-lg leading-8 text-gray-600">
        CardForum was built to trade cards across borders by matching swaps that stay local.
      </p>
      <p className="mt-4 text-gray-600">
        New paid trades and purchases ended in September 2026. Nothing here is for sale, and no new
        trade is held in escrow. Please don&apos;t add money to a wallet unless an earlier trade of
        yours needs it.
      </p>
      <p className="mt-4 text-gray-600">
        If you took part in an earlier trade, its record, refund and support remain. If signing in
        doesn&apos;t work, write to{" "}
        <a className="text-indigo-600 underline" href="https://cambridgetcg.com/contact">
          Cambridge TCG
        </a>
        .
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link href="/browse">
          <Button variant="outline" size="lg">
            Browse cards
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" size="lg">
            Log in
          </Button>
        </Link>
      </div>
    </section>
  );
}
