import { apiAuthed } from "./api";

export interface GoogleStatus {
  connected: boolean;
  google_email: string;
  sync_enabled: boolean;
}

export const integrations = {
  googleStatus: () => apiAuthed<GoogleStatus>("/api/integrations/google/status/"),
  googleConnectUrl: () =>
    apiAuthed<{ auth_url: string }>("/api/integrations/google/connect/"),
  googleComplete: (code: string, state: string) =>
    apiAuthed<GoogleStatus>("/api/integrations/google/callback/", {
      method: "POST",
      body: JSON.stringify({ code, state }),
    }),
  googleDisconnect: () =>
    apiAuthed<GoogleStatus>("/api/integrations/google/disconnect/", { method: "POST" }),
};
