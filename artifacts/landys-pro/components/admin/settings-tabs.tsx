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

export type SettingsTabId =
  | "general"
  | "distribution"
  | "fees"
  | "followups"
  | "directories";

const TABS: { id: SettingsTabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "distribution", label: "Opportunity distribution" },
  { id: "fees", label: "Success fee tiers" },
  { id: "followups", label: "Follow-ups" },
  { id: "directories", label: "Directories" },
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
    if (
      raw === "distribution" ||
      raw === "fees" ||
      raw === "followups" ||
      raw === "general" ||
      raw === "directories"
    ) {
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
        subtitle="Product rules for distribution, success fees, and follow-ups — plus a few workspace basics."
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
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
                  <p style={titleStyle}>Team access</p>
                  <p style={{ ...descStyle, marginBottom: 0 }}>
                    Invite admins and choose who can open this dashboard.
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
            <p style={{ ...descStyle, marginBottom: 18 }}>Light or dark admin theme.</p>
            <AppearancePicker />
          </Panel>

          <button
            type="button"
            onClick={() => setTab("directories")}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "block",
            }}
          >
            <Panel
              style={{
                ...cardPad,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <p style={titleStyle}>Directories</p>
                <p style={{ ...descStyle, marginBottom: 0 }}>
                  Projects, land types, and contractor categories — names used across leads, not
                  fee rules.
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
          </button>
        </div>
      )}

      {activeTab === "distribution" && (
        <Panel style={{ ...cardPad, maxWidth: 560 }}>
          <p style={titleStyle}>Opportunity distribution</p>
          <p style={descStyle}>
            Control how many contractors can accept an opportunity and how long it stays open.
          </p>
          <OpportunityDistributionForm
            maxLeadPurchases={maxLeadPurchases}
            leadExpiryHours={leadExpiryHours}
            acceptanceUnlimited={acceptanceUnlimited}
          />
        </Panel>
      )}

      {activeTab === "fees" && (
        <Panel style={{ ...cardPad, maxWidth: 920 }}>
          <p style={titleStyle}>Success fee tiers</p>
          <p style={descStyle}>
            SMALL / MEDIUM / LARGE bands by final contract value. Defaults: under $10k → 5%,
            $10k–$24,999 → 4%, $25k+ → 3%.
          </p>
          <SuccessFeeTiersForm tiers={successFeeTiers} />
        </Panel>
      )}

      {activeTab === "followups" && (
        <Panel style={{ ...cardPad, maxWidth: 560 }}>
          <p style={titleStyle}>Follow-ups</p>
          <p style={descStyle}>
            When to nudge contractors about outcomes and payment after they accept an opportunity.
          </p>
          <FollowUpSettingsForm
            followUpOutcomeDelayHours={followUpOutcomeDelayHours}
            followUpPaymentDelayHours={followUpPaymentDelayHours}
            followUpPaymentRetryHours={followUpPaymentRetryHours}
          />
        </Panel>
      )}

      {activeTab === "directories" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: "0 0 2px", font: "400 14px/1.5 'Inter'", color: "var(--ink3)" }}>
            These are labels used on leads and contractors — not AppSetting product rules.
          </p>

          <Panel style={cardPad}>
            <p style={titleStyle}>Contractor categories</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>
              One business category per contractor. Categories do not control project eligibility.
            </p>
            <ContractorCategoriesManager categories={contractorCategories} />
          </Panel>

          <Panel style={cardPad}>
            <p style={titleStyle}>Land types</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>
              Property classifications for leads. Rename freely; delete only when unused.
            </p>
            <LandTypesManager landTypes={landTypes} />
          </Panel>

          <Panel style={cardPad}>
            <p style={titleStyle}>Projects</p>
            <p style={{ ...descStyle, marginBottom: 18 }}>
              Jobs landowners request. Success fee rates live under Success fee tiers — not here.
            </p>
            <CategoriesManager categories={projects} />
          </Panel>
        </div>
      )}
    </div>
  );
}
