import Link from "next/link";
import { Plus } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Dark "hero money" wallet card used in the desktop sidebar and at the top of
 * the mobile home screen. The balance is the emotional focal point.
 */
export function WalletCard({ cents, className }: { cents: number; className?: string }) {
  return (
    <div className={cn("rounded-lg bg-text p-6 shadow-md", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Wallet balance</p>
      <p className="mt-2 font-display text-4xl font-bold leading-none tabular-nums text-white">
        {formatMoney(cents)}
      </p>
      <Button asChild variant="accent" className="mt-6 h-12 w-full text-base">
        <Link href="/wallet">
          <Plus className="h-5 w-5" aria-hidden /> Add funds
        </Link>
      </Button>
    </div>
  );
}
