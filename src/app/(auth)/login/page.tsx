export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-black px-6 text-white">
      <section className="w-full max-w-sm">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/35">Accès client</p>
        <h1 className="text-4xl font-semibold">Connexion</h1>
        <div className="mt-10 space-y-6">
          <input className="h-12 w-full border-b border-white/15 bg-transparent outline-none focus:border-white/50" placeholder="Email" />
          <input className="h-12 w-full border-b border-white/15 bg-transparent outline-none focus:border-white/50" placeholder="Mot de passe" type="password" />
          <button className="h-11 rounded-[7px] bg-white px-5 text-sm font-medium text-black transition hover:bg-white/85">
            Entrer
          </button>
        </div>
      </section>
    </main>
  );
}
