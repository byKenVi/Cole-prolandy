import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

const cardClass =
  "rounded-[18px] border border-[#EBE3D4] bg-white p-6 shadow-[0_2px_8px_rgba(58,53,45,0.05)]";

export default async function ProfilePage() {
  const session = await getSession();

  const [contractorTypes, services] = await Promise.all([
    prisma.contractorType.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { name: "asc" } }),
  ]);

  const contractor = session.contractorId
    ? await prisma.contractor.findUnique({
        where: { id: session.contractorId },
        include: { services: true, contractorType: true },
      })
    : null;

  if (!contractor) {
    return (
      <div className="flex min-h-full flex-col">
        <header className="border-b border-[#EDE4D3] px-5 pb-5 pt-6 md:px-[34px] md:pt-[26px]">
          <h1 className="font-fraunces text-[30px] font-semibold tracking-[-0.01em] text-[#3A352D]">
            Set up your profile
          </h1>
          <p className="mt-[5px] text-[14px] text-[#8A7E68]">
            Tell us about your business so we can start sending you matching leads.
          </p>
        </header>
        <div className="flex-1 px-5 py-6 md:px-[34px]">
          <div className={`mx-auto max-w-2xl ${cardClass}`}>
            <OnboardingForm
              contractorTypes={contractorTypes}
              services={services}
              initial={{
                name: "",
                phone: "",
                contractorTypeId: contractorTypes[0]?.id ?? "",
                aboutSection: "",
                businessHours: "",
                serviceIds: [],
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const initial = (contractor.name.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-[#EDE4D3] px-5 pb-5 pt-6 md:px-[34px] md:pt-[26px]">
        <h1 className="font-fraunces text-[30px] font-semibold tracking-[-0.01em] text-[#3A352D]">
          Profile
        </h1>
        <p className="mt-[5px] text-[14px] text-[#8A7E68]">
          Keep your trade and services current so we match you to the right jobs.
        </p>
      </header>

      <div className="flex-1 px-5 py-6 md:px-[34px]">
        <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className={`flex flex-col items-center gap-3 text-center lg:sticky lg:top-6 ${cardClass}`}>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3B372F] text-3xl font-semibold text-[#F6EEDF]">
              {initial}
            </div>
            <div>
              <p className="font-fraunces text-[20px] font-semibold text-[#3A352D]">{contractor.name}</p>
              <p className="mt-0.5 text-sm text-[#8A7E68]">{contractor.contractorType.name}</p>
            </div>
            {contractor.isTopPro ? (
              <Badge variant="success">Top Pro</Badge>
            ) : contractor.isPro ? (
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
              contractorTypes={contractorTypes}
              services={services}
              initial={{
                name: contractor.name,
                phone: contractor.phone,
                contractorTypeId: contractor.contractorTypeId,
                aboutSection: contractor.aboutSection ?? "",
                businessHours: contractor.businessHours ?? "",
                serviceIds: contractor.services.map((s) => s.serviceId),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
