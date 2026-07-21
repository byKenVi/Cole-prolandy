import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { OnboardingForm } from "@/components/onboarding-form";
import { ProfileLogoUpload } from "@/components/profile-logo-upload";

export const dynamic = "force-dynamic";

const cardClass =
  "rounded-[18px] border border-[#EBE3D4] bg-white p-6 shadow-[0_2px_8px_rgba(58,53,45,0.05)]";

export default async function ProfilePage() {
  const session = await getSession();

  const contractor = session.contractorId
    ? await prisma.contractor.findUnique({
        where: { id: session.contractorId },
        include: {
          contractorType: true,
          projects: {
            include: { contractorType: { select: { id: true, name: true } } },
            orderBy: { contractorType: { name: "asc" } },
          },
        },
      })
    : null;

  const assignedProjects =
    contractor?.projects.map((p) => ({
      id: p.contractorType.id,
      name: p.contractorType.name,
    })) ??
    (contractor
      ? [{ id: contractor.contractorType.id, name: contractor.contractorType.name }]
      : []);

  if (!contractor) {
    return (
      <div className="flex min-h-full flex-col">
        <header className="border-b border-[#EDE4D3] px-5 pb-5 pt-6 md:px-[34px] md:pt-[26px]">
          <h1 className="font-fraunces text-[30px] font-semibold tracking-[-0.01em] text-[#3A352D]">
            Set up your profile
          </h1>
          <p className="mt-[5px] text-[14px] text-[#8A7E68]">
            If Landy’s already created your contractor account, sign in with that email to claim it.
            Otherwise contact Landy’s to get set up.
          </p>
        </header>
        <div className="flex-1 px-5 py-6 md:px-[34px]">
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
      ? "No projects assigned"
      : assignedProjects.length === 1
        ? assignedProjects[0]!.name
        : `${assignedProjects.length} projects`;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-[#EDE4D3] px-5 pb-5 pt-6 md:px-[34px] md:pt-[26px]">
        <h1 className="font-fraunces text-[30px] font-semibold tracking-[-0.01em] text-[#3A352D]">
          Profile
        </h1>
        <p className="mt-[5px] text-[14px] text-[#8A7E68]">
          Update your contact details. Project assignment is managed by Landy’s.
        </p>
      </header>

      <div className="flex-1 px-5 py-6 md:px-[34px]">
        <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className={`flex flex-col items-center gap-3 text-center lg:sticky lg:top-6 ${cardClass}`}>
            <ProfileLogoUpload logoUrl={contractor.logoUrl} initials={initial} />
            <div>
              <p className="font-fraunces text-[20px] font-semibold text-[#3A352D]">{contractor.name}</p>
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

          <div className={cardClass}>
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
        </div>
      </div>
    </div>
  );
}
