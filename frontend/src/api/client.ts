/* Thin fetch wrapper for the FastAPI backend. Errors carry the server's `detail`
   (a string, or {code, message, detail, redirect, fields, problems}). */
export type Detail = string | {
  code?: string; message?: string; detail?: string; redirect?: string;
  fields?: Record<string, string>; problems?: string[]; missing?: string[];
};

export class ApiError extends Error {
  status: number;
  detail: Detail;
  constructor(status: number, detail: Detail) {
    super(typeof detail === 'string' ? detail : detail?.message || `HTTP ${status}`);
    this.status = status;
    this.detail = detail;
  }
  get fields() { return typeof this.detail === 'object' ? this.detail.fields || {} : {}; }
  get redirect() { return typeof this.detail === 'object' ? this.detail.redirect : undefined; }
  get info() { return typeof this.detail === 'object' ? this.detail.detail : undefined; }
  get offline() { return this.status === 0; }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Koneksi terputus.');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = (data && typeof data === 'object' && 'detail' in (data as object)) ? (data as { detail: Detail }).detail : (text || res.statusText);
    const err = new ApiError(res.status, detail);
    if (res.status === 401) window.dispatchEvent(new CustomEvent('gnosia:unauthorized'));
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b ?? {}),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b ?? {}),
  del: <T>(p: string, b?: unknown) => request<T>('DELETE', p, b),
};
