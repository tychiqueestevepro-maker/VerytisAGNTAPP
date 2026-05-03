import { IntegrationLogo } from "@/components/integrations/integration-logo";
import { SectionHeading } from "@/components/layout/section-heading";
import { TopLine } from "@/components/layout/top-line";
import { ExtensionConnectButton } from "@/components/integrations/extension-connect-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultClientId } from "@/lib/actions/integrations";

export default async function IntegrationsPage() {
  const supabase = await createSupabaseServerClient();
  const clientId = await getDefaultClientId();

  // Obtenir le statut de l'intégration LinkedIn et le nom du client
  let isConnected = false;
  let clientName = "";

  if (clientId) {
    const [integrationRes, cloudSessionRes, clientRes] = await Promise.all([
      supabase
        .from("integrations")
        .select("status")
        .eq("client_id", clientId)
        .eq("integration_type", "chrome_extension")
        .maybeSingle(),
      supabase
        .from("linkedin_cloud_sessions")
        .select("status")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("display_name")
        .eq("id", clientId)
        .maybeSingle()
    ]);

    if (
      integrationRes.data?.status === "connected" &&
      cloudSessionRes.data?.status === "active"
    ) {
      isConnected = true;
    }
    clientName = clientRes.data?.display_name || "";
  }

  return (
    <>
      <TopLine />
      <SectionHeading>Intégrations</SectionHeading>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Carte Intégration LinkedIn */}
        <div className="flex flex-col p-6 bg-[#0f0f0f] border border-[#222] rounded-2xl hover:border-[#333] transition-colors">
          <div className="flex items-center gap-4 mb-5">
            <IntegrationLogo name="LinkedIn" />
            <div>
              <h3 className="text-xl font-medium text-white">LinkedIn</h3>
            </div>
          </div>

          <div className="space-y-6 flex-grow">
            {/* Étape 1 : Installation */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-white/40">1</div>
                <p className="text-sm font-medium text-white/80">Installer l&apos;extension</p>
              </div>
              <p className="text-xs text-white/40 ml-7">
                Nécessaire pour connecter LinkedIn, importer les profils et activer le runner cloud.
              </p>
              <a
                href="https://chrome.google.com/webstore/detail/verytis"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-7 inline-flex items-center text-xs text-blue-400 hover:text-blue-300 transition-colors gap-1"
              >
                Télécharger sur le Chrome Web Store
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            {/* Étape 2 : Liaison */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-white/40">2</div>
                <p className="text-sm font-medium text-white/80">Lier votre compte</p>
              </div>
              <p className="text-xs text-white/40 ml-7">
                Connecte l&apos;extension et autorise le runner cloud à exécuter les séquences.
              </p>

              {clientId && (
                <div className="ml-7">
                  <ExtensionConnectButton
                    key={`${clientId}-${isConnected ? "connected" : "disconnected"}`}
                    clientId={clientId}
                    clientName={clientName}
                    isConnected={isConnected}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
