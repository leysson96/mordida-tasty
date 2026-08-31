import { ApiError } from "./api";

export function redirectOnAdminAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    window.location.href = "/admin/login";
    return true;
  }

  if (
    error instanceof ApiError &&
    error.status === 403 &&
    error.message.includes("2FA")
  ) {
    window.location.href = "/admin/2fa";
    return true;
  }

  return false;
}

export function readableErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
