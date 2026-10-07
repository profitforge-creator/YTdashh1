import { redirect } from "next/navigation";
import { OnboardingForm } from "@/features/onboarding/onboarding-form";
import { getViewer } from "@/lib/auth";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.prefs.onboarded_at) redirect("/home");
  return (
    <main className="min-h-dvh">
      <OnboardingForm defaultName={viewer.profile.display_name} />
    </main>
  );
}
