import { MapPin, Phone, Mail, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { TierBadge } from "@/components/tier-badge";
import { WalletBalance } from "@/components/wallet-balance";
import { AcceptTokenActions } from "@/components/accept-token-actions";
import { formatMoney } from "@/lib/money";
import { timeUntil } from "@/lib/format";

export const dynamic = "force-dynamic";

function Notice({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-center text-base text-text">{text}</p>
    </Card>
  );
}

export default async function AcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const match = await prisma.leadMatch.findUnique({
    where: { acceptToken: token },
    include: {
      contractor: { select: { name: true, walletBalanceCents: true } },
      lead: { include: { projectType: true } },
    },
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 py-8 md:justify-center md:py-16">
      <div className="text-center">
        <p className="font-display text-2xl font-semibold text-primary">Landy&apos;s Pro</p>
      </div>

      {!match ? (
        <Notice text="This lead link is not valid. It may have been mistyped or removed." />
      ) : (
        (() => {
          const { lead, contractor } = match;
          const expired =
            match.status === "EXPIRED" ||
            lead.status === "EXPIRED" ||
            lead.expiresAt.getTime() <= Date.now();

          if (match.status === "ACCEPTED") {
            return (
              <Card className="flex flex-col gap-1">
                <p className="flex items-center gap-2 font-semibold text-success">
                  <CheckCircle2 className="h-5 w-5" /> You&apos;re on this job
                </p>
                <p className="mt-2 text-sm text-text-muted">Landowner contact:</p>
                <p className="text-lg font-semibold text-text">{lead.landownerName}</p>
                <a
                  href={`tel:${lead.landownerPhone}`}
                  className="flex min-h-tap items-center gap-2 text-text"
                >
                  <Phone className="h-5 w-5 text-primary" /> {lead.landownerPhone}
                </a>
                <a
                  href={`mailto:${lead.landownerEmail}`}
                  className="flex min-h-tap items-center gap-2 text-text"
                >
                  <Mail className="h-5 w-5 text-primary" /> {lead.landownerEmail}
                </a>
              </Card>
            );
          }

          if (match.status === "DECLINED") {
            return <Notice text="You passed on this lead. No charge was made." />;
          }

          if (expired) {
            return <Notice text="This lead has expired and can no longer be accepted." />;
          }

          return (
            <>
              <Card className="flex flex-col gap-4">
                <div>
                  <h1 className="text-xl font-semibold text-text">{lead.projectType.name}</h1>
                  <p className="mt-1 flex items-center gap-1 text-base text-text-muted">
                    <MapPin className="h-4 w-4" /> {lead.propertyLocation}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <TierBadge tier={lead.tier} />
                  <span className="text-sm text-text-muted">{timeUntil(lead.expiresAt)}</span>
                </div>
                <div className="rounded-md bg-primary-soft p-4 text-center">
                  <p className="text-sm text-text-muted">Lead price</p>
                  <p className="text-3xl font-semibold tabular-nums text-text">
                    {formatMoney(lead.priceCents)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted">Your wallet balance</p>
                  <WalletBalance cents={contractor.walletBalanceCents} size="md" />
                </div>
              </Card>

              <AcceptTokenActions token={token} />
              <p className="text-center text-xs text-text-muted">
                Accepting charges your wallet {formatMoney(lead.priceCents)} and unlocks the
                landowner&apos;s contact info.
              </p>
            </>
          );
        })()
      )}
    </main>
  );
}
