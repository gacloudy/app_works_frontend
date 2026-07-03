const METADATA_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";

export const API_BASE = process.env.BACKEND_URL ?? "http://localhost:8000";

async function getIdToken(): Promise<string | null> {
  if (!process.env.BACKEND_URL) return null;
  try {
    const res = await fetch(`${METADATA_URL}?audience=${process.env.BACKEND_URL}`, {
      headers: { "Metadata-Flavor": "Google" },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getIdToken();
  const headers: HeadersInit = {
    ...(init?.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
