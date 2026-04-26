"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { SectionHeading } from "@/components/layout/section-heading";
import { TopLine } from "@/components/layout/top-line";
import { Button } from "@/components/ui/button";
import { settingsSchema, type SettingsForm } from "@/lib/schemas/settings";

export default function ParametresPage() {
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      organisation: "Maison Veritis",
      email: "clara@veritis.fr",
    },
  });

  return (
    <>
      <TopLine />
      <SectionHeading>Paramètres</SectionHeading>
      <form onSubmit={form.handleSubmit(() => undefined)} className="max-w-xl space-y-7">
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/35">Organisation</span>
          <input
            {...form.register("organisation")}
            className="h-12 w-full border-b border-white/12 bg-transparent text-xl text-white outline-none transition focus:border-white/45"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/35">Email</span>
          <input
            {...form.register("email")}
            className="h-12 w-full border-b border-white/12 bg-transparent text-xl text-white outline-none transition focus:border-white/45"
          />
        </label>
        <Button className="rounded-[7px] bg-white text-black hover:bg-white/85">
          Enregistrer
        </Button>
      </form>
    </>
  );
}
