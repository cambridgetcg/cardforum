import { ArrowRightLeft } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-gray-900">CardForum</span>
          </div>
          <nav className="flex gap-6">
            <Link href="/browse" className="text-sm text-gray-500 hover:text-gray-700">
              Browse
            </Link>
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
              Log In
            </Link>
          </nav>
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} CardForum</p>
        </div>
      </div>
    </footer>
  );
}
