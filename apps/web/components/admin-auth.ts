import { api } from '../lib/api';

export function logoutAdmin() {
  return api<{ ok: boolean }>('/admin/auth/logout', { method: 'POST' });
}
