import { env } from "@/lib/env";

/** Error envelope from docs/shared/architecture.md. `code` is mapped to Thai copy by the screen. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ListMeta = { page: number; pageSize: number; total: number };

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Skip the redirect to /login on 401 (e.g. the login page itself). */
  allowUnauthenticated?: boolean;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: ListMeta }> {
  const { body, allowUnauthenticated, headers, ...init } = opts;
  let res: Response;
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "network error");
  }

  if (res.status === 401 && !allowUnauthenticated && typeof window !== "undefined") {
    redirectToLogin("expired");
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError(res.status, e?.code ?? "UNKNOWN", e?.message ?? res.statusText, e?.fields ?? {});
  }
  return { data: json?.data as T, meta: json?.meta };
}

/** Session expired → S01 `/login?reason=expired&next=<current page>` (_common.md §6). */
export function redirectToLogin(reason?: "expired") {
  const next = window.location.pathname + window.location.search;
  const q = new URLSearchParams({ next });
  if (reason) q.set("reason", reason);
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard navigation on purpose: drop all client state
  window.location.assign(`/login?${q}`);
}

export type UploadOptions = {
  /** 0–1 while the request body is sent. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

/**
 * multipart/form-data POST with upload progress (fetch cannot report it, so this uses XHR).
 * Same envelope, 401 and network handling as `request`. Abort rejects with an `AbortError` DOMException.
 */
function upload<T>(path: string, form: FormData, opts: UploadOptions = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${env.apiBaseUrl}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK", "network error"));
    xhr.onabort = () => reject(new DOMException("upload aborted", "AbortError"));
    xhr.onload = () => {
      if (xhr.status === 401 && typeof window !== "undefined") redirectToLogin("expired");
      let json: { data?: T; error?: { code?: string; message?: string; fields?: Record<string, string> } } | null = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        json = null;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const e = json?.error;
        reject(new ApiError(xhr.status, e?.code ?? "UNKNOWN", e?.message ?? xhr.statusText, e?.fields ?? {}));
        return;
      }
      opts.onProgress?.(1);
      resolve(json?.data as T);
    };
    if (opts.signal) {
      if (opts.signal.aborted) {
        reject(new DOMException("upload aborted", "AbortError"));
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(form);
  });
}

export const http = {
  upload,
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "GET" }).then((r) => r.data),
  list: <T>(path: string, opts?: RequestOptions) => request<T[]>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "POST", body }).then((r) => r.data),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PUT", body }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PATCH", body }).then((r) => r.data),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "DELETE" }).then((r) => r.data),
};
