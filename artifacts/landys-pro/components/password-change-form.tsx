"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";

type ClerkError = { errors?: { message: string; longMessage?: string }[] };

/**
 * Lets a signed-in contractor change their Clerk password.
 * Handles two flows:
 *  • user already has a password → show current + new + confirm fields
 *  • user signed up via Google with no password yet → show new + confirm only
 */
export function PasswordChangeForm() {
  const { user } = useUser();

  const hasPassword = user?.passwordEnabled ?? false;

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPw.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("New passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      await user?.updatePassword({
        currentPassword: hasPassword ? currentPw : undefined,
        newPassword: newPw,
      });
      setSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      const clerkErr = err as ClerkError;
      const msg =
        clerkErr?.errors?.[0]?.longMessage ??
        clerkErr?.errors?.[0]?.message ??
        "Failed to update password. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {!hasPassword && (
        <p className="rounded-lg bg-[#F5F0E8] px-4 py-3 text-sm text-[#8A7E68]">
          You signed in with Google. Set a password below to also enable email sign-in.
        </p>
      )}

      {hasPassword && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-password" className="text-sm font-medium text-[#3A352D]">
            Current password
          </Label>
          <div className="relative">
            <Input
              id="current-password"
              type={showCurrent ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A7E68] hover:text-[#3A352D]"
              tabIndex={-1}
              aria-label={showCurrent ? "Hide password" : "Show password"}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password" className="text-sm font-medium text-[#3A352D]">
          New password
        </Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showNew ? "text" : "password"}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A7E68] hover:text-[#3A352D]"
            tabIndex={-1}
            aria-label={showNew ? "Hide password" : "Show password"}
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-[#A79E8D]">Minimum 8 characters.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password" className="text-sm font-medium text-[#3A352D]">
          Confirm new password
        </Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Password updated successfully.
        </div>
      )}

      <Button type="submit" variant="accent" disabled={loading} className="self-start">
        {loading ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
