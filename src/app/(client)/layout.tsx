import { redirect } from "next/navigation";
import { getUserWithProfile } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserWithProfile();

  if (!user) {
    redirect("/login");
  }

  // Optionnel: Rediriger si pas de client_id (en attente d'onboarding par ex)
  // if (!user.profile?.client_id) {
  //   redirect("/onboarding");
  // }

  return <AppShell user={user}>{children}</AppShell>;
}
