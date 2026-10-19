let csrfToken: string | null = null;

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken!;
}

export function clearCsrf(): void {
  csrfToken = null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  opts: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  const method = (opts.method || 'GET').toUpperCase();
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await ensureCsrf();
    headers.set('x-csrf-token', token);
  }

  const res = await fetch(path, {
    ...opts,
    headers,
    credentials: 'include',
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  });

  if (res.status === 403) {
    // CSRF may have rotated
    clearCsrf();
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code || 'ERROR',
      data?.error?.message || res.statusText,
      data?.error?.details,
    );
  }
  return data as T;
}

export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  const token = await ensureCsrf();
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-csrf-token': token },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code || 'ERROR',
      data?.error?.message || res.statusText,
      data?.error?.details,
    );
  }
  return data as T;
}
