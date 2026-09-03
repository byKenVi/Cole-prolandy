import { prisma } from "@/lib/prisma";
import { getSession, authMode } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { OnboardingForm } from "@/components/onboarding-form";
import { ProfileLogoUpload } from "@/components/profile-logo-upload";
import { PasswordChangeForm } from "@/components/password-change-form";

export const dynamic = "force-dynamic";

const cardClass =
  "rounded-[18px] border border-[#EBE3D4] bg-white p-5 shadow-[0_2px_8px_rgba(58,53,45,0.05)] sm:p-6";

export default async function ProfilePage() {
  const session = await getSession();

  const contractor = session.contractorId
    ? await prisma.contractor.findUnique({
        where: { id: session.contractorId },
        include: {
          categoryMemberships: {
            include: { category: { select: { id: true, name: true } } },
            orderBy: { category: { name: "asc" } },
          },
          workTypes: {
            include: { workType: { select: { id: true, name: true } } },
            orderBy: { workType: { name: "asc" } },
          },
        },
      })
    : null;

  const assignedProjects = contractor
    ? [
        ...contractor.categoryMemberships.map((membership) => ({
          id: `category-${membership.category.id}`,
          name: membership.category.name,
        })),
        ...contractor.workTypes.map((membership) => ({
          id: `work-${membership.workType.id}`,
          name: membership.workType.name,
        })),
      ]
    : [];

  if (!contractor) {
    return (
      <div className="contractor-page flex min-h-full flex-col">
        <header className="border-b border-[#EDE4D3] px-4 pb-5 pt-5 sm:px-5 md:px-[34px] md:pt-[26px]">
          <h1 className="font-fraunces text-[26px] font-semibold tracking-[-0.01em] text-[#3A352D] sm:text-[30px]">
            Set up your profile
          </h1>
          <p className="mt-[5px] text-[14px] text-[#8A7E68]">
            If Landy’s already created your contractor account, sign in with that email to claim it.
            Otherwise contact Landy’s to get set up.
          </p>
        </header>
        <div className="flex-1 px-4 py-6 sm:px-5 md:px-[34px]">
          <div className={`mx-auto max-w-2xl ${cardClass}`}>
            <OnboardingForm
              mode="claim"
              assignedProjects={[]}
              initial={{
                name: "",
                phone: "",
                aboutSection: "",
                businessHours: "",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const initial = (contractor.name.trim()[0] ?? "?").toUpperCase();
  const projectLabel =
    assignedProjects.length === 0
      ? "Matching not configured"
      : assignedProjects.length === 1
        ? assignedProjects[0]!.name
        : `${assignedProjects.length} matching rules`;

  return (
    <div className="contractor-page flex min-h-full flex-col">
      <header className="border-b border-[#EDE4D3] px-4 pb-5 pt-5 sm:px-5 md:px-[34px] md:pt-[26px]">
        <h1 className="font-fraunces text-[26px] font-semibold tracking-[-0.01em] text-[#3A352D] sm:text-[30px]">
          Profile
        </h1>
        <p className="mt-[5px] text-[14px] text-[#8A7E68]">
          Update your contact details. Opportunity matching is managed by Landy’s.
        </p>
      </header>

      <div className="flex-1 px-4 py-6 sm:px-5 md:px-[34px]">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className={`flex min-w-0 flex-col items-center gap-3 text-center lg:sticky lg:top-6 ${cardClass}`}>
            <ProfileLogoUpload logoUrl={contractor.logoUrl} initials={initial} />
            <div className="min-w-0 w-full">
              <p className="truncate font-fraunces text-[20px] font-semibold text-[#3A352D]">{contractor.name}</p>
              <p className="mt-0.5 text-sm text-[#8A7E68]">{projectLabel}</p>
            </div>
            {contractor.isPro ? (
              <Badge>Pro</Badge>
            ) : (
              <Badge variant="neutral">Free</Badge>
            )}
            {contractor.businessHours && (
              <p className="mt-2 text-xs text-[#A79E8D]">{contractor.businessHours}</p>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <div className={`min-w-0 ${cardClass}`}>
              <OnboardingForm
                assignedProjects={assignedProjects}
                initial={{
                  name: contractor.name,
                  phone: contractor.phone,
                  aboutSection: contractor.aboutSection ?? "",
                  businessHours: contractor.businessHours ?? "",
                }}
              />
            </div>

            {authMode() === "clerk" && (
              <div className={`min-w-0 ${cardClass}`}>
                <h2 className="mb-1 font-fraunces text-[18px] font-semibold text-[#3A352D]">
                  Security
                </h2>
                <p className="mb-5 text-[13px] text-[#8A7E68]">
                  Change your account password.
                </p>
                <PasswordChangeForm />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
