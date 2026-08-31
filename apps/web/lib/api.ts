const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(cents / 100);
}

export async function api<T>(
  path: string,
  options: RequestInit & { idempotencyKey?: string } = {}
) {
  const { idempotencyKey, ...fetchOptions } = options;
  const headers = new Headers(options.headers);

  if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
    cache: 'no-store',
    credentials: 'include'
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      message = response.statusText;
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}
