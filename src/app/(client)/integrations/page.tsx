import { IntegrationLogo } from "@/components/integrations/integration-logo";
import { SectionHeading } from "@/components/layout/section-heading";
import { TopLine } from "@/components/layout/top-line";
import { ExtensionConnectButton } from "@/components/integrations/extension-connect-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultClientId } from "@/lib/actions/integrations";

export default async function IntegrationsPage() {
  const supabase = await createSupabaseServerClient();
  const clientId = await getDefaultClientId();

  // Obtenir le statut de l'intégration LinkedIn
  let isConnected = false;
  if (clientId) {
    const { data } = await supabase
      .from("integrations")
      .select("status")
      .eq("client_id", clientId)
      .eq("integration_type", "chrome_extension")
      .single();
    
    if (data && data.status === "connected") {
      isConnected = true;
    }
  }

  return (
    <>
      <TopLine />
      <SectionHeading>Intégrations</SectionHeading>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Carte Intégration LinkedIn */}
        <div className="flex flex-col p-6 bg-[#0f0f0f] border border-[#222] rounded-2xl hover:border-[#333] transition-colors">
          <div className="flex items-center gap-4 mb-3">
            <IntegrationLogo name="LinkedIn" />
            <h3 className="text-xl font-medium text-white">LinkedIn</h3>
          </div>
          
          <p className="text-sm text-white/50 mb-4 flex-grow">
            Extrayez les profils en un clic depuis n'importe quelle recherche LinkedIn ou page de profil pour enrichir votre CRM.
          </p>
          
          {clientId && (
            <ExtensionConnectButton 
              clientId={clientId} 
              isConnected={isConnected} 
            />
          )}
        </div>

      </div>
    </>
  );
}
