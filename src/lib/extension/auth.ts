import { createHash, randomBytes } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const CLIENT_ID_HEADER = "x-verytis-client-id";
const EXTENSION_TOKEN_HEADER = "x-verytis-extension-token";

export function createExtensionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashExtensionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readExtensionAuth(request: Request) {
  return {
    clientId: request.headers.get(CLIENT_ID_HEADER)?.trim() || "",
    token: request.headers.get(EXTENSION_TOKEN_HEADER)?.trim() || "",
  };
}

export async function verifyExtensionRequest(request: Request) {
  const { clientId, token } = readExtensionAuth(request);

  if (!clientId || !token) {
    return { ok: false as const, status: 401, error: "Missing extension credentials" };
  }

  const tokenHash = hashExtensionToken(token);
  const supabase = createSupabaseServiceClient();
  const { data: integration, error } = await supabase
    .from("integrations")
    .select("id, client_id, status, credentials_ref, extra_data")
    .eq("client_id", clientId)
    .eq("integration_type", "chrome_extension")
    .maybeSingle();

  if (error) {
    return { ok: false as const, status: 500, error: error.message };
  }

  if (!integration?.credentials_ref || integration.credentials_ref !== tokenHash) {
    return { ok: false as const, status: 401, error: "Invalid extension token" };
  }

  if (integration.status !== "connected") {
    return { ok: false as const, status: 401, error: "Extension disconnected" };
  }

  return { ok: true as const, clientId, tokenHash, integration, supabase };
}
