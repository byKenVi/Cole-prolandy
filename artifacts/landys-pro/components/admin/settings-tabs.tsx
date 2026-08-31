"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OpportunityDistributionForm } from "@/components/admin/opportunity-distribution-form";
import { FollowUpSettingsForm } from "@/components/admin/follow-up-settings-form";
import {
  SuccessFeeTiersForm,
  type SuccessFeeTierFormRow,
} from "@/components/admin/success-fee-tiers-form";
import { AppearancePicker } from "@/components/admin/appearance-picker";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { LandTypesManager } from "@/components/admin/land-types-manager";
import { ContractorCategoriesManager } from "@/components/admin/contractor-categories-manager";
import { PageHeader, Panel } from "@/components/admin/ui";

export type SettingsTabId = "general" | "distribution" | "fees" | "followups";

const TABS: { id: SettingsTabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "distribution", label: "Opportunity distribution" },
  { id: "fees", label: "Success fee tiers" },
  { id: "followups", label: "Follow-ups" },
];

const cardPad: React.CSSProperties = { padding: "24px 26px" };
const titleStyle: React.CSSProperties = {
  margin: "0 0 4px",
  font: "600 17px/1 'Inter'",
  color: "var(--ink)",
};
const descStyle: React.CSSProperties = {
  margin: "0 0 22px",
  color: "var(--ink2)",
  fontSize: 14,
  lineHeight: 1.5,
};
const sectionKicker: React.CSSProperties = {
  margin: "0 0 14px",
  font: "600 12px/1 var(--mono)",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--ink3)",
};

type CategoryRow = {
  id: string;
  name: string;
  icon: string | null;
  code: string;
  archived: boolean;
  contractors: number;
  leads: number;
};

type LandTypeRow = {
  id: string;
  name: string;
  code: string;
  archived: boolean;
  leads: number;
};

type ContractorCategoryRow = {
  id: string;
  name: string;
  code: string;
  archived: boolean;
  contractors: number;
  leads: number;
};

export function SettingsTabs({
  isOwner,
  maxLeadPurchases,
  leadExpiryHours,
  acceptanceUnlimited,
  followUpOutcomeDelayHours,
  followUpPaymentDelayHours,
  followUpPaymentRetryHours,
  successFeeTiers,
  projects,
  landTypes,
  contractorCategories,
}: {
  isOwner: boolean;
  maxLeadPurchases: number;
  leadExpiryHours: number;
  acceptanceUnlimited: boolean;
  followUpOutcomeDelayHours: number;
  followUpPaymentDelayHours: number;
  followUpPaymentRetryHours: number;
  successFeeTiers: SuccessFeeTierFormRow[];
  projects: CategoryRow[];
  landTypes: LandTypeRow[];
  contractorCategories: ContractorCategoryRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = useMemo<SettingsTabId>(() => {
    const raw = searchParams.get("tab");
    if (raw === "distribution" || raw === "fees" || raw === "followups" || raw === "general") {
      return raw;
    }
    return "general";
  }, [searchParams]);

  const setTab = useCallback(
    (tab: SettingsTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "general") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Admin"
        title="Settings"
        subtitle="Configure distribution, fees, follow-ups, appearance, and taxonomy."
      />

      <div
        role="tablist"
        aria-label="Settings sections"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 22,
          padding: 6,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          boxShadow: "var(--shadow)",
        }}
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(tab.id)}
              style={{
                flex: "1 1 auto",
                minWidth: 120,
                height: 40,
                padding: "0 14px",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                font: selected ? "600 13px/1 'Inter'" : "500 13px/1 'Inter'",
                color: selected ? "var(--ink)" : "var(--ink2)",
                background: selected ? "var(--card2)" : "transparent",
                boxShadow: selected ? "inset 0 0 0 1px var(--line)" : "none",
                transition: "background .15s ease, color .15s ease",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "general" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isOwner && (
            <Link href="/admin/team" style={{ textDecoration: "none" }}>
              <Panel
                className="settings-team-card"
                style={{
                  ...cardPad,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  cursor: "pointer",
                }}
              >
                <div>
                  <p style={titleStyle}>Team</p>
                  <p style={{ ...descStyle, marginBottom: 0 }}>
                    Invite admins, manage roles, and control who has access to this dashboard.
                  </p>
                </div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink2)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Panel>
            </Link>
          )}

          <Panel style={cardPad}>
            <p style={titleStyle}>Appearance</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>Choose how the admin panel looks.</p>
            <AppearancePicker />
          </Panel>

          <Panel style={cardPad}>
            <p style={sectionKicker}>Taxonomy</p>
            <p style={titleStyle}>Contractor categories</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>
              One business category per contractor. Categories do not determine project-service
              eligibility.
            </p>
            <ContractorCategoriesManager categories={contractorCategories} />
          </Panel>

          <Panel style={cardPad}>
            <p style={titleStyle}>Land types</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>
              Property classifications for leads. Renaming is safe; delete only when no leads use
              the type.
            </p>
            <LandTypesManager landTypes={landTypes} />
          </Panel>

          <Panel style={cardPad}>
            <p style={titleStyle}>Projects</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>
            Jobs landowners request and contractors fulfill. Success fee rates are configured under
            Success fee tiers — not here. Rename anytime and delete only when unused.
            </p>
            <CategoriesManager categories={projects} />
          </Panel>
        </div>
      )}

      {activeTab === "distribution" && (
        <Panel style={{ ...cardPad, maxWidth: 560 }}>
          <p style={titleStyle}>Opportunity distribution</p>
          <p style={descStyle}>
            When Unlimited is disabled, only the first X eligible contractors who accept receive
            the landowner contact details.
          </p>
          <OpportunityDistributionForm
            maxLeadPurchases={maxLeadPurchases}
            leadExpiryHours={leadExpiryHours}
            acceptanceUnlimited={acceptanceUnlimited}
          />
        </Panel>
      )}

      {activeTab === "fees" && (
        <Panel style={{ ...cardPad, maxWidth: 560 }}>
          <p style={titleStyle}>Success fee tiers</p>
          <p style={descStyle}>
            Thresholds and rates for SMALL, MEDIUM, and LARGE jobs. Defaults: &lt; $10,000 = 5%,
            $10,000–$24,999 = 4%, $25,000+ = 3%.
          </p>
          <SuccessFeeTiersForm tiers={successFeeTiers} />
        </Panel>
      )}

      {activeTab === "followups" && (
        <Panel style={{ ...cardPad, maxWidth: 560 }}>
          <p style={titleStyle}>Follow-ups</p>
          <p style={descStyle}>
            Timing for contractor outcome and payment check-ins after an opportunity is accepted.
          </p>
          <FollowUpSettingsForm
            followUpOutcomeDelayHours={followUpOutcomeDelayHours}
            followUpPaymentDelayHours={followUpPaymentDelayHours}
            followUpPaymentRetryHours={followUpPaymentRetryHours}
          />
        </Panel>
      )}
    </div>
  );
}
