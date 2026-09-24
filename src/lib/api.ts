import type { ApiSummary, Mode, UploadedDocument } from "./summarize-data";
import { telegramInitData } from "./telegram";

const API_URL = (import.meta.env["VITE_API_URL"] || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function authHeaders(): Record<string, string> {
  const initData = telegramInitData();
  return initData ? { Authorization: `tma ${initData}` } : {};
}

async function parseError(response: Response): Promise<never> {
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) message = body.detail;
  } catch {
    // Keep the status-based fallback.
  }
  throw new ApiError(message, response.status);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) return parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface CurrentUser {
  id: number;
  first_name: string;
  username?: string;
}

export const api = {
  me: () => request<CurrentUser>("/api/me"),
  listSummaries: () => request<ApiSummary[]>("/api/summaries"),
  getSummary: (id: string) => request<ApiSummary>(`/api/summaries/${id}`),
  createSummary: (documentId: string, mode: Mode) =>
    request<ApiSummary>(`/api/documents/${documentId}/summaries`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),
  deleteSummary: (id: string) => request<void>(`/api/summaries/${id}`, { method: "DELETE" }),
  uploadDocument(file: File, onProgress: (progress: number) => void): Promise<UploadedDocument> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/documents`);
      for (const [name, value] of Object.entries(authHeaders())) xhr.setRequestHeader(name, value);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () => reject(new ApiError("Could not reach the backend", 0));
      xhr.onload = () => {
        let body: unknown;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          body = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as UploadedDocument);
        } else {
          const detail =
            body && typeof body === "object" && "detail" in body
              ? String(body.detail)
              : `Upload failed (${xhr.status})`;
          reject(new ApiError(detail, xhr.status));
        }
      };
      xhr.send(form);
    });
  },
};
