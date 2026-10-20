const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

let customerRefresh: Promise<boolean> | undefined;
let adminRefresh: Promise<boolean> | undefined;

export async function api<T>(
  path: string,
  options: RequestInit & { idempotencyKey?: string } = {},
) {
  const response = await send(path, options);
  const refreshPath = refreshPathFor(path);

  if (response.status === 401 && refreshPath) {
    const refreshed = await refreshOnce(refreshPath);
    if (refreshed) {
      const retried = await send(path, options);
      return parseResponse<T>(retried);
    }

    notifySessionExpired(refreshPath.startsWith("/admin/"));
  }

  return parseResponse<T>(response);
}

async function send(
  path: string,
  options: RequestInit & { idempotencyKey?: string },
) {
  const { idempotencyKey, ...fetchOptions } = options;
  const headers = new Headers(options.headers);

  if (
    fetchOptions.body &&
    !(fetchOptions.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }

  return fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
    cache: "no-store",
    credentials: "include",
  });
}

async function parseResponse<T>(response: Response) {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(", ");
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

function refreshPathFor(path: string) {
  if (
    (path.startsWith("/admin/") && !path.startsWith("/admin/auth/")) ||
    path.startsWith("/privacy/admin/")
  ) {
    return "/admin/auth/refresh";
  }

  const customerRoutes = [
    "/auth/me",
    "/auth/logout",
    "/customers/",
    "/orders/mine",
  ];
  return customerRoutes.some((route) => path.startsWith(route))
    ? "/auth/refresh"
    : undefined;
}

function refreshOnce(path: string) {
  const isAdmin = path.startsWith("/admin/");
  const active = isAdmin ? adminRefresh : customerRefresh;
  if (active) {
    return active;
  }

  const pending = fetch(`${API_URL}${path}`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      if (isAdmin) {
        adminRefresh = undefined;
      } else {
        customerRefresh = undefined;
      }
    });

  if (isAdmin) {
    adminRefresh = pending;
  } else {
    customerRefresh = pending;
  }
  return pending;
}

function notifySessionExpired(admin: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("mordida:session-expired"));
  const target = admin ? "/admin/login" : "/auth/login";
  if (window.location.pathname !== target) {
    window.location.assign(target);
  }
}
