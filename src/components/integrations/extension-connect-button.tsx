"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  connectExtensionIntegration,
  disconnectExtensionIntegration,
  getLinkedInConnectionStatus,
} from "@/lib/actions/integrations";

export function ExtensionConnectButton({ clientId, clientName, isConnected }: { clientId: string, clientName: string, isConnected: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(isConnected ? "connecte" : "en_attente");
  const [isHovering, setIsHovering] = useState(false);

  const handleConnect = async () => {
    console.log("[integrations] handleConnect started");
    setLoading(true);
    let completed = false;

    const completeConnection = () => {
      if (completed) return;
      completed = true;
      setStatus("connecte");
      setLoading(false);
      setTimeout(() => router.refresh(), 100);
    };

    const linkedinWindow = window.open(
      "https://www.linkedin.com/feed/",
      "verytis_linkedin_login"
    );

    const res = await connectExtensionIntegration(clientId);
    if (!res.success || !res.extensionToken) {
      alert(res.error || "Erreur lors de l'enregistrement en base de données.");
      setLoading(false);
      return;
    }

    // Attempt to connect to extension via postMessage.
    // The extension also captures the LinkedIn browser session for the cloud runner.
    const timeout = setTimeout(() => {
      if (completed) return;
      linkedinWindow?.focus();
      alert("Connexion LinkedIn non terminée. Connecte-toi dans l'onglet LinkedIn ouvert, puis reviens ici et relance la connexion.");
      setStatus("en_attente");
      setLoading(false);
      router.refresh();
    }, 150000);

    const pollConnection = async () => {
      for (let attempt = 0; attempt < 30 && !completed; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const statusResult = await getLinkedInConnectionStatus(clientId);
        if (statusResult.connected) {
          clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          completeConnection();
          return;
        }
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data.type === "VERYTIS_EXTENSION_CONNECTED") {
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        
        if (event.data.success && event.data.cloudSessionConnected) {
          console.log("[integrations] extension confirmed connection for:", event.data.linkedinName);
          completeConnection();
        } else {
          console.warn("[integrations] extension connection failed or cancelled:", event.data.error);
          alert(event.data.error || "Connexion LinkedIn cloud impossible.");
          setStatus("en_attente");
          setLoading(false);
          router.refresh();
        }
      }
    };

    window.addEventListener("message", onMessage);

    window.postMessage({
      type: "VERYTIS_CONNECT_EXTENSION",
      clientId: clientId,
      clientName: clientName,
      extensionToken: res.extensionToken,
      returnUrl: window.location.href
    }, "*");

    void pollConnection();
  };

  const handleDisconnect = async () => {
    console.log("[integrations] handleDisconnect clicked - bypass confirm");

    setLoading(true);
    try {
      console.log("[integrations] calling server action disconnect for clientId:", clientId);
      const res = await disconnectExtensionIntegration(clientId);
      console.log("[integrations] server action result:", res);

      if (res.success) {
        console.log("[integrations] success! notifying extension and refreshing...");
        // Notify extension
        window.postMessage({
          type: "VERYTIS_DISCONNECT_EXTENSION"
        }, "*");

        setStatus("en_attente");
        router.refresh();
      } else {
        console.warn("[integrations] disconnect failed:", res.error);
        alert(res.error || "Erreur lors de la déconnexion.");
      }
    } catch (err) {
      console.error("[integrations] disconnect unexpected error:", err);
      alert("Une erreur inattendue est survenue.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "connecte") {
    return (
      <div className="space-y-2 mt-4">
        {clientName && (
          <p className="text-[10px] text-white/30 uppercase tracking-widest text-center">
            Connecté en tant que <span className="text-green-400/60">{clientName}</span>
          </p>
        )}
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={loading}
          aria-label="Déconnecter LinkedIn"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className={`px-4 py-2 rounded-md text-sm border transition-all w-full flex items-center justify-center gap-2 ${
            isHovering
              ? "bg-red-500/10 text-red-500 border-red-500/20"
              : "bg-[#1a2e1f] text-green-400 border-green-900/50"
          }`}
        >
          {loading ? "Déconnexion..." : isHovering ? "Déconnecter" : "Connecté"}
        </button>
      </div>
    );
  }

  return (
    <button 
      type="button"
      onClick={handleConnect}
      disabled={loading}
      className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-md text-sm font-medium transition-colors w-full mt-4"
    >
      {loading ? "Connexion en cours..." : "Connecter LinkedIn"}
    </button>
  );
}
