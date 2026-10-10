const TOKEN_STORAGE_KEY = 'wb_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Formats integer paisa (1 NPR = 100 paisa) into Nepali Rupee display string (e.g. "Rs. 4,999" or "Rs. 1,25,000").
 */
export function formatNpr(paisa: number | string | null | undefined): string {
  const numPaisa = Number(paisa ?? 0);
  const rupees = Math.round(numPaisa / 100);
  return `Rs. ${rupees.toLocaleString('en-IN')}`;
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

export function formatTimeOnly(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(path.startsWith('/api') ? path : `/api/v1${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMessage =
      data?.error?.message || `Request failed with status ${res.status}`;
    const err = new Error(errMessage) as Error & {
      code?: string;
      status?: number;
      details?: any[];
    };
    err.code = data?.error?.code || 'API_ERROR';
    err.status = res.status;
    err.details = data?.error?.details || [];
    throw err;
  }

  return data as T;
}
