import { redirect } from "next/navigation";
import { getUserWithProfile } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getClientFlows } from "@/lib/flows/actions";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserWithProfile();
  const { data: flows } = await getClientFlows();

  if (!user) {
    redirect("/login");
  }

  return <AppShell user={user} initialFlows={flows || []}>{children}</AppShell>;
}
