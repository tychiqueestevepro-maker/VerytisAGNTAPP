"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button"; // Assuming there is a generic button component or I'll just use standard HTML button
import { connectExtensionIntegration } from "@/lib/actions/integrations";

export function ExtensionConnectButton({ clientId, isConnected }: { clientId: string, isConnected: boolean }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(isConnected ? "connecte" : "en_attente");

  const handleConnect = async () => {
    setLoading(true);
    
    // Attempt to connect to extension via postMessage
    // Timeout if no response
    const timeout = setTimeout(() => {
      alert("L'extension n'a pas répondu. Assurez-vous qu'elle est installée et rafraîchie.");
      setLoading(false);
    }, 2000);

    const onMessage = async (event: MessageEvent) => {
      if (event.data.type === "VERYTIS_EXTENSION_CONNECTED" && event.data.success) {
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        
        // Save in DB
        const res = await connectExtensionIntegration(clientId);
        if (res.success) {
          setStatus("connecte");
        } else {
          alert("Erreur lors de l'enregistrement en base de données.");
        }
        setLoading(false);
      }
    };

    window.addEventListener("message", onMessage);
    
    window.postMessage({
      type: "VERYTIS_CONNECT_EXTENSION",
      clientId: clientId
    }, "*");
  };

  if (status === "connecte") {
    return (
      <button 
        disabled
        className="px-4 py-2 bg-[#1a2e1f] text-green-400 rounded-md text-sm border border-green-900/50 w-full mt-4"
      >
        Connecté
      </button>
    );
  }

  return (
    <button 
      onClick={handleConnect}
      disabled={loading}
      className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-md text-sm font-medium transition-colors w-full mt-4"
    >
      {loading ? "Connexion en cours..." : "Connexion"}
    </button>
  );
}
