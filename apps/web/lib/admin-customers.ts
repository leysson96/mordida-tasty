import { api } from "./api";
import type {
  AdminCustomerDetailResponse,
  AdminCustomerListResponse,
  AdminCustomerSortDirection,
  AdminCustomerSortField,
  AdminCustomerSource,
  AdminCustomerStatus,
} from "./types";

export interface ListAdminCustomersParameters {
  query?: string;
  status: AdminCustomerStatus;
  source: AdminCustomerSource;
  sortBy: AdminCustomerSortField;
  sortDirection: AdminCustomerSortDirection;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}

export function listAdminCustomers({
  query,
  status,
  source,
  sortBy,
  sortDirection,
  page,
  pageSize,
  signal,
}: ListAdminCustomersParameters) {
  const parameters = new URLSearchParams({
    status,
    source,
    sortBy,
    sortDirection,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (query) {
    parameters.set("q", query);
  }

  return api<AdminCustomerListResponse>(
    `/admin/customers?${parameters.toString()}`,
    { signal },
  );
}

export function getAdminCustomerDetail(
  customerId: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
) {
  const parameters = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return api<AdminCustomerDetailResponse>(
    `/admin/customers/${encodeURIComponent(customerId)}?${parameters.toString()}`,
    { signal },
  );
}
