import { prisma } from "@/lib/prisma";
import { getSession, authMode } from "@/lib/auth";
import { formatPhoneForDisplay } from "@/lib/phone";
import { getServiceRadiusMiles } from "@/lib/domain/settings";
import { OnboardingForm } from "@/components/onboarding-form";
import { ProfileLogoUpload } from "@/components/profile-logo-upload";
import { PasswordChangeForm } from "@/components/password-change-form";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { PauseControl } from "@/components/pro/pause-control";
import { Chip, Facts, Notice, PageHead, Section } from "@/components/pro/ui";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  const contractor = session.contractorId
    ? await prisma.contractor.findUnique({
        where: { id: session.contractorId },
        include: {
          categoryMemberships: {
            include: { category: { select: { name: true } } },
            orderBy: { displayOrder: "asc" },
          },
          contractorCategory: { select: { name: true } },
          externalIdentities: { where: { source: "wix" }, select: { id: true } },
        },
      })
    : null;

  if (!contractor) {
    return (
      <>
        <PageHead
          title="Link your account"
          intro="If Landy's already lists you as a pro, sign in with the same email as your landys.co profile."
        />
        <div className="pro-card">
          <OnboardingForm
            mode="claim"
            assignedProjects={[]}
            initial={{ name: "", phone: "", aboutSection: "", businessHours: "" }}
          />
        </div>
      </>
    );
  }

  const fromLandys = contractor.externalIdentities.length > 0;
  const categories = [
    ...new Set([
      ...contractor.categoryMemberships.map((m) => m.category.name),
      ...(contractor.contractorCategory ? [contractor.contractorCategory.name] : []),
    ]),
  ];
  const radius = contractor.serviceRadiusMiles ?? (await getServiceRadiusMiles(prisma));
  const hasArea = contractor.serviceZipCodes.length > 0 || contractor.serviceCounties.length > 0;

  return (
    <>
      <PageHead title="My account" intro={contractor.name} />

      <Section title="Your business">
        <div className="pro-card">
          {fromLandys ? (
            <>
              <Facts
                items={[
                  { label: "Business", value: contractor.name },
                  { label: "Mobile", value: formatPhoneForDisplay(contractor.phone) || "Not on file" },
                  { label: "Email", value: contractor.email },
                  { label: "Website", value: contractor.websiteUrl },
                ]}
              />
              <p className="pro-small" style={{ margin: "16px 0 0" }}>
                These details come from your profile on landys.co. To change them, update landys.co or call Landy&apos;s.
              </p>
            </>
          ) : (
            <OnboardingForm
              assignedProjects={categories.map((name) => ({ id: name, name }))}
              initial={{
                name: contractor.name,
                phone: contractor.phone,
                aboutSection: contractor.aboutSection ?? "",
                businessHours: contractor.businessHours ?? "",
              }}
            />
          )}
        </div>
      </Section>

      <Section title="Where you get jobs">
        <div className="pro-card">
          {categories.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {categories.map((name) => (
                <Chip key={name}>{name}</Chip>
              ))}
            </div>
          )}
          {hasArea ? (
            <Facts
              items={[
                {
                  label: "Around ZIPs",
                  value: contractor.serviceZipCodes.length ? `${contractor.serviceZipCodes.join(", ")} (${radius} miles)` : null,
                },
                { label: "Counties", value: contractor.serviceCounties.length ? contractor.serviceCounties.join(", ") : null },
              ]}
            />
          ) : (
            <Notice tone="warn" title="No service area on file">
              Add the ZIP codes or counties you serve to your landys.co profile so we can send you nearby jobs.
            </Notice>
          )}
          <p className="pro-small" style={{ margin: "16px 0 0" }}>
            You receive requests for these trades inside this area.
          </p>
        </div>
      </Section>

      <section id="pause" className="pro-section">
        <div className="pro-section-head">
          <h2 className="pro-section-title">New job requests</h2>
        </div>
        <div className="pro-card">
          <PauseControl pausedUntil={contractor.leadsPausedUntil?.toISOString() ?? null} />
        </div>
      </section>

      <Section title="Text messages">
        <div className="pro-card">
          {contractor.smsOptedOutAt ? (
            <Notice tone="warn" title="Texts are turned off">
              You replied STOP, so we only email you. To get texts again, reply START to any Landy&apos;s Pro text, then
              call Landy&apos;s so we can turn them back on.
            </Notice>
          ) : (
            <p style={{ margin: 0 }}>
              We text new job requests to <strong>{formatPhoneForDisplay(contractor.phone) || "your mobile"}</strong>, between 8 am and
              9 pm. Reply STOP to any text to stop them.
            </p>
          )}
        </div>
      </Section>

      <Section title="Company logo">
        <div className="pro-card">
          <ProfileLogoUpload logoUrl={contractor.logoUrl} initials={(contractor.name.trim()[0] ?? "?").toUpperCase()} />
        </div>
      </Section>

      {authMode() === "clerk" && (
        <Section title="Password">
          <div className="pro-card">
            <PasswordChangeForm />
          </div>
        </Section>
      )}

      {authMode() === "clerk" && (
        <div style={{ marginTop: 32 }}>
          <SignOutLink variant="pro" label="Sign out" />
        </div>
      )}
    </>
  );
}
