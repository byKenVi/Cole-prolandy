"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { adjustWallet } from "@/app/actions/admin";
import { dollarsToCents } from "@/lib/money";

export function WalletAdjustForm({ contractorId }: { contractorId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"add" | "deduct">("add");
  const [type, setType] = useState<"ADMIN_ADJUST" | "REFUND">("ADMIN_ADJUST");
  const [reason, setReason] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const cents = dollarsToCents(amount);
    if (!cents) {
      setResult({ ok: false, message: "Enter a valid amount." });
      return;
    }
    const signed = direction === "deduct" ? -Math.abs(cents) : Math.abs(cents);
    startTransition(async () => {
      const res = await adjustWallet({ contractorId, amountCents: signed, type, reason });
      setResult({ ok: res.ok, message: res.message ?? (res.ok ? "Done" : "Failed") });
      if (res.ok) {
        setAmount("");
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="amt">Amount (USD)</Label>
          <Input
            id="amt"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50.00"
          />
        </div>
        <div>
          <Label htmlFor="dir">Direction</Label>
          <Select id="dir" value={direction} onChange={(e) => setDirection(e.target.value as "add" | "deduct")}>
            <option value="add">Add funds</option>
            <option value="deduct">Deduct funds</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value as "ADMIN_ADJUST" | "REFUND")}>
            <option value="ADMIN_ADJUST">Admin adjustment</option>
            <option value="REFUND">Refund</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="reason">Reason (logged to audit)</Label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
      </div>

      {result && (
        <p
          className={
            result.ok
              ? "rounded-sm bg-success-soft p-3 text-sm font-medium text-success"
              : "rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger"
          }
        >
          {result.message}
        </p>
      )}

      <Button type="submit" variant="brand" loading={pending} disabled={pending}>
        Apply change
      </Button>
    </form>
  );
}
