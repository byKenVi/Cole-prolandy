"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Hammer, HardHat, LandPlot } from "lucide-react";
import { OpportunityDistributionForm } from "@/components/admin/opportunity-distribution-form";
import { FollowUpSettingsForm } from "@/components/admin/follow-up-settings-form";
import { NumberSettingsForm } from "@/components/admin/number-settings-form";
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
/** Shared rule: every Settings tab panel matches the tab bar's full content width. */
const settingsPanel: React.CSSProperties = {
  ...cardPad,
  width: "100%",
  maxWidth: "none",
  boxSizing: "border-box",
};
const settingsStack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  width: "100%",
};
const titleStyle: React.CSSProperties = {
  margin: "0 0 4px",
  font: "600 17px/1 var(--ui)",
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
  serviceRadiusMiles,
  landownerHireCheckDelayDays,
  followUpMaxAttempts,
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
  serviceRadiusMiles: number;
  landownerHireCheckDelayDays: number;
  followUpMaxAttempts: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const routeTab = useMemo<SettingsTabId>(() => {
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
  const [activeTab, setActiveTab] = useState<SettingsTabId>(routeTab);
  const [directory, setDirectory] = useState<string | null>(searchParams.get("dir"));

  useEffect(() => {
    setActiveTab(routeTab);
    setDirectory(searchParams.get("dir"));
  }, [routeTab, searchParams]);

  const setTab = useCallback(
    (tab: SettingsTabId, dir?: string) => {
      setActiveTab(tab);
      setDirectory(tab === "directories" ? (dir ?? null) : null);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "general") {
        params.delete("tab");
        params.delete("dir");
      } else {
        params.set("tab", tab);
      }
      if (tab === "directories") {
        if (dir) params.set("dir", dir);
        else params.delete("dir");
      } else {
        params.delete("dir");
      }
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, searchParams],
  );

  return (
    <div className="admin-fade-up">
      <PageHeader
        title="Settings"
        subtitle="How requests are sent out, what fees contractors pay, when follow-ups go out, and the lists behind the forms."
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
                font: selected ? "600 13px/1 var(--ui)" : "500 13px/1 var(--ui)",
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
        <div style={settingsStack}>
          {isOwner && (
            <Link href="/admin/team" style={{ textDecoration: "none", display: "block", width: "100%" }}>
              <Panel
                className="settings-team-card"
                style={{
                  ...settingsPanel,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  cursor: "pointer",
                }}
              >
                <div style={{ minWidth: 0 }}>
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

          <Panel style={settingsPanel}>
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
              width: "100%",
            }}
          >
            <Panel
              style={{
                ...settingsPanel,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={titleStyle}>Directories</p>
                <p style={{ ...descStyle, marginBottom: 0 }}>
                  The lists of projects, land types and contractor categories used in requests.
                  They do not set any fee.
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
        <Panel style={settingsPanel}>
          <p style={titleStyle}>Opportunity distribution</p>
          <p style={descStyle}>
            Control how many contractors can accept an opportunity and how long it stays open.
          </p>
          <OpportunityDistributionForm
            maxLeadPurchases={maxLeadPurchases}
            leadExpiryHours={leadExpiryHours}
            acceptanceUnlimited={acceptanceUnlimited}
          />
          <NumberSettingsForm
            submitLabel="Save service area"
            fields={[
              {
                key: "serviceRadiusMiles",
                label: "Default service radius",
                help: "A contractor receives a request when the property is within this distance of one of their service ZIP codes (unless their profile sets its own radius).",
                unit: "miles",
                value: serviceRadiusMiles,
                min: 1,
                max: 500,
              },
            ]}
          />
        </Panel>
      )}

      {activeTab === "fees" && (
        <Panel style={settingsPanel}>
          <p style={titleStyle}>Success fee tiers</p>
          <p style={descStyle}>
            Three bands by final contract value. Defaults: 5% up to $9,999, 4% from $10,000 to
            $24,999, 3% from $25,000.
          </p>
          <SuccessFeeTiersForm tiers={successFeeTiers} />
        </Panel>
      )}

      {activeTab === "followups" && (
        <Panel style={settingsPanel}>
          <p style={titleStyle}>Follow-ups</p>
          <p style={descStyle}>
            When to nudge contractors about outcomes and payment after they accept an opportunity.
          </p>
          <FollowUpSettingsForm
            followUpOutcomeDelayHours={followUpOutcomeDelayHours}
            followUpPaymentDelayHours={followUpPaymentDelayHours}
            followUpPaymentRetryHours={followUpPaymentRetryHours}
          />
          <NumberSettingsForm
            submitLabel="Save reminders"
            fields={[
              {
                key: "followUpMaxAttempts",
                label: "Reminders before alerting an admin",
                help: "How many times we ask a contractor \"Did you get the job?\" or \"Have you been paid?\" before emailing the admins.",
                unit: "reminders",
                value: followUpMaxAttempts,
                min: 1,
                max: 10,
              },
              {
                key: "landownerHireCheckDelayDays",
                label: "Ask the homeowner who they hired after",
                help: "Days after the first contractor accepted. Used to double-check contractor answers.",
                unit: "days",
                value: landownerHireCheckDelayDays,
                min: 1,
                max: 120,
              },
            ]}
          />
        </Panel>
      )}

      {activeTab === "directories" && (
        <div style={settingsStack}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              width: "100%",
            }}
          >
            {[
              {
                id: "projects",
                title: "Projects",
                body: "The kinds of work homeowners can request.",
                icon: Hammer,
              },
              {
                id: "land",
                title: "Land types",
                body: "How the property is used: ranch, timber, homestead.",
                icon: LandPlot,
              },
              {
                id: "categories",
                title: "Contractor categories",
                body: "The trade each contractor is listed under.",
                icon: HardHat,
              },
            ].map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setTab("directories", card.id)}
                style={{
                  textAlign: "left",
                  padding: "16px 18px",
                  borderRadius: 12,
                  border: directory === card.id ? "1px solid var(--gold)" : "1px solid var(--line)",
                  background: directory === card.id ? "var(--goldSoft)" : "var(--card)",
                  cursor: "pointer",
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 40,
                    height: 40,
                    flex: "none",
                    borderRadius: 8,
                    background: "var(--sage)",
                    color: "var(--sageFg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <card.icon size={20} strokeWidth={1.8} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <p style={{ ...titleStyle, marginBottom: 6 }}>{card.title}</p>
                  <p style={{ ...descStyle, marginBottom: 0 }}>{card.body}</p>
                </span>
              </button>
            ))}
          </div>

          {directory === "categories" && (
            <Panel style={settingsPanel}>
              <p style={titleStyle}>Contractor categories</p>
              <p style={{ ...descStyle, marginBottom: 18 }}>
                One business category per contractor. Categories do not control project eligibility.
              </p>
              <ContractorCategoriesManager categories={contractorCategories} />
            </Panel>
          )}
          {directory === "land" && (
            <Panel style={settingsPanel}>
              <p style={titleStyle}>Land types</p>
              <p style={{ ...descStyle, marginBottom: 18 }}>
                Property classifications for leads. Rename freely; delete only when unused.
              </p>
              <LandTypesManager landTypes={landTypes} />
            </Panel>
          )}
          {directory === "projects" && (
            <Panel style={settingsPanel}>
              <p style={titleStyle}>Projects</p>
              <p style={{ ...descStyle, marginBottom: 18 }}>
                The kinds of work homeowners can request. Fee rates are set in Success fee tiers.
              </p>
              <CategoriesManager categories={projects} />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
