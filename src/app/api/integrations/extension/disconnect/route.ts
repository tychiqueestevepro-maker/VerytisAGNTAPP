import { NextResponse } from "next/server";
import { disconnectExtensionIntegration } from "@/lib/actions/integrations";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";

    if (!clientId) {
      return NextResponse.json({ success: false, error: "Client manquant." }, { status: 400 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[integrations] disconnect route hit", { clientId });
    }

    const result = await disconnectExtensionIntegration(clientId);
    if (!result.success) {
      return NextResponse.json(result, { status: result.error === "Non autorisé" ? 403 : 400 });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Erreur lors de la déconnexion.") },
      { status: 500 },
    );
  }
}
