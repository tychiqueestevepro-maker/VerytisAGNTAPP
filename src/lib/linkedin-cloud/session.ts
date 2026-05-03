import { createCipheriv, createHash, randomBytes } from "crypto";

type EncryptedStorageState = {
  storage_state_ciphertext: string;
  storage_state_iv: string;
  storage_state_tag: string;
};

function encryptionKey() {
  const secret = process.env.LINKEDIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("LINKEDIN_SESSION_SECRET manquant ou trop court");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptLinkedInStorageState(storageState: unknown): EncryptedStorageState {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(storageState), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    storage_state_ciphertext: ciphertext.toString("base64"),
    storage_state_iv: iv.toString("base64"),
    storage_state_tag: cipher.getAuthTag().toString("base64"),
  };
}

export function normalizeLinkedInStorageState(value: unknown) {
  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    cookies?: unknown;
    origins?: unknown;
  };

  if (!Array.isArray(candidate.cookies)) return null;

  const cookies = candidate.cookies.filter((cookie) => {
    if (!cookie || typeof cookie !== "object") return false;
    const domain = String((cookie as { domain?: unknown }).domain || "");
    return domain.includes("linkedin.com");
  });

  if (!cookies.length) return null;

  const hasAuthenticatedSession = cookies.some((cookie) => {
    if (!cookie || typeof cookie !== "object") return false;
    const name = String((cookie as { name?: unknown }).name || "");
    const value = String((cookie as { value?: unknown }).value || "");
    return name === "li_at" && value.length > 0;
  });

  if (!hasAuthenticatedSession) return null;

  return {
    cookies,
    origins: Array.isArray(candidate.origins) ? candidate.origins : [],
  };
}
