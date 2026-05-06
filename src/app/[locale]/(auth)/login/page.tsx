import { login } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const t = await getTranslations("Auth");

  return (
    <main className="grid min-h-screen place-items-center bg-black px-6 text-white">
      <section className="w-full max-w-sm">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/35">
          {t("client_access")}
        </p>
        <h1 className="text-4xl font-semibold">{t("login_title")}</h1>

        {error && (
          <p className="mt-6 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-400 border border-red-500/20">
            {error}
          </p>
        )}

        <form action={login} className="mt-10 space-y-6">
          <div className="space-y-4">
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-12 w-full border-b border-white/15 bg-transparent outline-none placeholder:text-white/30 focus:border-white/50 transition-colors"
              placeholder={t("email_placeholder")}
            />
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-12 w-full border-b border-white/15 bg-transparent outline-none placeholder:text-white/30 focus:border-white/50 transition-colors"
              placeholder={t("password_placeholder")}
            />
          </div>
          <button
            type="submit"
            className="h-11 w-full rounded-[7px] bg-white px-5 text-sm font-medium text-black transition hover:bg-white/85 active:scale-[0.98]"
          >
            {t("submit")}
          </button>
        </form>
      </section>
    </main>
  );
}
