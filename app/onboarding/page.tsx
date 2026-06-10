import { requireUser } from "@/lib/tenant";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Start your school" };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <OnboardingForm />
      </div>
    </div>
  );
}
