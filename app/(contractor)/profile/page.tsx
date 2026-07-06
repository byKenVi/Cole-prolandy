import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { OnboardingForm } from "@/components/onboarding-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();

  const [contractorTypes, services] = await Promise.all([
    prisma.contractorType.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { name: "asc" } }),
  ]);

  const contractor = session.contractorId
    ? await prisma.contractor.findUnique({
        where: { id: session.contractorId },
        include: { services: true },
      })
    : null;

  // Onboarding (no profile yet) vs edit existing profile.
  if (!contractor) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-xl font-semibold text-text">Set up your profile</h1>
          <p className="text-sm text-text-muted">
            Tell us about your business so we can start sending you matching leads.
          </p>
        </header>
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
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">Profile</h1>
        {contractor.isTopPro ? (
          <Badge variant="success">Top Pro</Badge>
        ) : contractor.isPro ? (
          <Badge>Pro</Badge>
        ) : (
          <Badge variant="neutral">Free</Badge>
        )}
      </header>

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
  );
}
