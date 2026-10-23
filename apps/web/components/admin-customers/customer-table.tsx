"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Eye,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  UserRoundCheck,
} from "lucide-react";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../../lib/admin-errors";
import { listAdminCustomers } from "../../lib/admin-customers";
import { formatMoney } from "../../lib/api";
import type {
  AdminCustomerListItem,
  AdminCustomerSortDirection,
  AdminCustomerSortField,
  AdminCustomerSource,
  AdminCustomerStatus,
} from "../../lib/types";
import { CustomerDetail } from "./customer-detail";

const features = tableFeatures({});
const columnHelper = createColumnHelper<
  typeof features,
  AdminCustomerListItem
>();

export function CustomerTable() {
  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminCustomerStatus>("ALL");
  const [source, setSource] = useState<AdminCustomerSource>("REGISTERED");
  const [sortBy, setSortBy] = useState<AdminCustomerSortField>("CREATED_AT");
  const [sortDirection, setSortDirection] =
    useState<AdminCustomerSortDirection>("DESC");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>();
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomers() {
      setLoading(true);
      setError(undefined);

      try {
        const response = await listAdminCustomers({
          query: debouncedQuery,
          status,
          source,
          sortBy,
          sortDirection,
          page,
          pageSize,
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        setCustomers(response.items);
        setTotal(response.pagination.total);
        setTotalPages(response.pagination.totalPages);
        if (page > response.pagination.totalPages) {
          setPage(response.pagination.totalPages);
        }
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }
        if (redirectOnAdminAuthError(requestError)) {
          return;
        }
        setError(
          readableErrorMessage(
            requestError,
            "No se pudo cargar la lista de clientes.",
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCustomers();
    return () => controller.abort();
  }, [
    debouncedQuery,
    page,
    pageSize,
    reloadKey,
    sortBy,
    sortDirection,
    source,
    status,
  ]);

  const columns = useMemo(() => {
    const sortableHeader = (label: string, field: AdminCustomerSortField) => {
      const active = sortBy === field;
      const Icon = active
        ? sortDirection === "ASC"
          ? ArrowUp
          : ArrowDown
        : ArrowUpDown;

      return (
        <button
          type="button"
          className="crm-sort-button"
          onClick={() => changeSort(field)}
          aria-label={`${label}. ${sortDescription(field)}`}
        >
          {label}
          <Icon aria-hidden="true" size={15} />
        </button>
      );
    };

    return columnHelper.columns([
      columnHelper.accessor("name", {
        header: () => sortableHeader("Cliente", "NAME"),
        cell: ({ row }) => (
          <div className="crm-customer-identity">
            <strong>{row.original.name}</strong>
            <span>{row.original.displayId}</span>
            <span>
              {row.original.maskedEmail ??
                (row.original.anonymized
                  ? "Identidad eliminada"
                  : "Correo no indicado")}
            </span>
            <span>
              {row.original.maskedPhone ?? "Telefono no indicado"}
              {row.original.postalCode
                ? ` · CP ${row.original.postalCode}`
                : " · Sin CP"}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("verificationStatus", {
        header: "Estado",
        cell: ({ row }) => {
          const state = row.original.active
            ? row.original.verificationStatus.toLowerCase()
            : "disabled";
          return (
            <span className={`crm-status ${state}`}>
              {customerStateLabel(row.original)}
            </span>
          );
        },
      }),
      columnHelper.accessor("lastPurchaseAt", {
        header: "Ultima compra",
        cell: ({ getValue }) => formatDate(getValue()),
      }),
      columnHelper.display({
        id: "orders",
        header: "Pedidos",
        cell: ({ row }) => (
          <div className="crm-order-counts">
            <strong>{row.original.deliveredOrders}</strong>
            <span>entregados</span>
            {row.original.cancelledOrders > 0 && (
              <small>{row.original.cancelledOrders} cancelados</small>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("totalSpentCents", {
        header: "Gasto",
        cell: ({ getValue }) => <strong>{formatMoney(getValue())}</strong>,
      }),
      columnHelper.display({
        id: "detail",
        header: () => (
          <>
            <span className="crm-detail-label-full">Detalle</span>
            <span className="crm-detail-label-short">Ver</span>
          </>
        ),
        cell: ({ row }) =>
          row.original.accountType === "REGISTERED" ? (
            <button
              type="button"
              className="icon-button crm-detail-button"
              onClick={() => setSelectedCustomerId(row.original.id)}
              aria-label={`Abrir ficha de ${row.original.name}`}
              title="Abrir ficha"
            >
              <Eye aria-hidden="true" size={18} />
            </button>
          ) : (
            <span
              className="crm-no-detail"
              title="Compra sin cuenta registrada"
            >
              -
            </span>
          ),
      }),
    ]);

    function changeSort(field: AdminCustomerSortField) {
      if (sortBy === field) {
        setSortDirection((current) => (current === "ASC" ? "DESC" : "ASC"));
      } else {
        setSortBy(field);
        setSortDirection(field === "NAME" ? "ASC" : "DESC");
      }
      setPage(1);
    }

    function sortDescription(field: AdminCustomerSortField) {
      if (sortBy !== field) {
        return "Activar orden";
      }
      return sortDirection === "ASC"
        ? "Orden ascendente; pulsar para descendente"
        : "Orden descendente; pulsar para ascendente";
    }
  }, [sortBy, sortDirection]);

  const table = useTable({
    features,
    columns,
    data: customers,
    getRowId: (customer) => customer.id,
  });

  const hasFilters = Boolean(query || status !== "ALL");
  const firstResult = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, total);

  function resetFilters() {
    setQuery("");
    setStatus("ALL");
    setPage(1);
  }

  return (
    <main className="page-shell admin-page crm-page">
      <section className="admin-toolbar crm-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Clientes</h1>
        </div>
        <div className="crm-toolbar-status" aria-live="polite">
          <span>
            {total} {source === "REGISTERED" ? "cuentas" : "invitados"}
          </span>
          <button
            type="button"
            className="icon-button crm-refresh-button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={loading}
            aria-label="Actualizar clientes"
            title="Actualizar clientes"
          >
            <RefreshCw
              aria-hidden="true"
              size={18}
              className={loading ? "spinning" : ""}
            />
          </button>
        </div>
      </section>

      <section className="crm-filters" aria-label="Filtros de clientes">
        <div
          className="crm-source-tabs"
          role="tablist"
          aria-label="Tipo de cliente"
        >
          <button
            type="button"
            role="tab"
            aria-selected={source === "REGISTERED"}
            className={source === "REGISTERED" ? "active" : undefined}
            onClick={() => {
              setSource("REGISTERED");
              setSelectedCustomerId(undefined);
              setPage(1);
            }}
          >
            <UserRoundCheck aria-hidden="true" size={17} />
            Registrados
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === "GUEST"}
            className={source === "GUEST" ? "active" : undefined}
            onClick={() => {
              setSource("GUEST");
              setStatus("ALL");
              setSelectedCustomerId(undefined);
              setPage(1);
            }}
          >
            <ShoppingBag aria-hidden="true" size={17} />
            Invitados
          </button>
        </div>
        <label className="search-field crm-search-field">
          Buscar cliente
          <div>
            <Search aria-hidden="true" size={18} />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Nombre, email o telefono"
              autoComplete="off"
            />
          </div>
        </label>
        <label>
          Estado
          <select
            value={status}
            disabled={source === "GUEST"}
            onChange={(event) => {
              setStatus(event.target.value as AdminCustomerStatus);
              setPage(1);
            }}
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="DISABLED">Desactivados</option>
          </select>
        </label>
        <label>
          Por pagina
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
        <button
          type="button"
          className="button secondary crm-clear-button"
          onClick={resetFilters}
          disabled={!hasFilters}
        >
          <RotateCcw aria-hidden="true" size={17} />
          Limpiar
        </button>
      </section>

      {error && (
        <div className="empty-state error crm-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="button secondary"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Reintentar
          </button>
        </div>
      )}

      <section
        className="crm-table-panel"
        aria-labelledby="customer-list-title"
      >
        <div className="crm-table-heading">
          <div>
            <ContactRound aria-hidden="true" size={20} />
            <h2 id="customer-list-title">Listado</h2>
          </div>
          <span aria-live="polite">
            {loading
              ? "Actualizando..."
              : `${firstResult}-${lastResult} de ${total}`}
          </span>
        </div>
        <div className="crm-table-scroll">
          <table className="crm-table" data-source={source} aria-busy={loading}>
            <caption className="crm-sr-only">
              {source === "REGISTERED"
                ? "Cuentas registradas, identidad y actividad"
                : "Compradores invitados, identidad y actividad"}
            </caption>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`crm-column-${header.column.id}`}
                      aria-sort={ariaSort(
                        header.column.id,
                        sortBy,
                        sortDirection,
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {!error && customers.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="crm-empty-cell">
                    {loading
                      ? "Cargando clientes..."
                      : hasFilters
                        ? "No hay clientes que coincidan con los filtros."
                        : source === "REGISTERED"
                          ? "Todavia no hay clientes registrados."
                          : "Todavia no hay compradores invitados."}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`crm-column-${cell.column.id}`}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <nav className="crm-pagination" aria-label="Paginacion de clientes">
          <button
            type="button"
            className="icon-button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={loading || page <= 1}
            aria-label="Pagina anterior"
            title="Pagina anterior"
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <span>
            Pagina <strong>{page}</strong> de <strong>{totalPages}</strong>
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={loading || page >= totalPages}
            aria-label="Pagina siguiente"
            title="Pagina siguiente"
          >
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </nav>
      </section>

      <CustomerDetail
        customerId={selectedCustomerId}
        open={Boolean(selectedCustomerId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedCustomerId(undefined);
          }
        }}
      />

      <style jsx global>{`
        .crm-page {
          --page-width: 1440px;
        }

        .crm-toolbar {
          gap: 16px;
        }

        .crm-toolbar-status,
        .crm-toolbar-status span,
        .crm-table-heading,
        .crm-table-heading > div,
        .crm-pagination,
        .crm-error {
          display: flex;
          align-items: center;
        }

        .crm-toolbar-status {
          gap: 10px;
          margin-left: auto;
        }

        .crm-toolbar-status span {
          min-height: 40px;
          padding: 0 12px;
          color: var(--color-muted);
          border: 1px solid var(--color-line);
          border-radius: var(--radius-small);
          background: var(--color-surface);
          font-size: 0.88rem;
          font-weight: 900;
        }

        .crm-refresh-button {
          min-width: 42px;
        }

        .crm-filters {
          display: grid;
          grid-template-columns:
            minmax(260px, 1fr) minmax(160px, 0.35fr)
            minmax(120px, 0.24fr) auto;
          align-items: end;
          gap: 10px;
          margin-bottom: 12px;
          padding: 12px;
          border: 1px solid var(--color-line);
          border-radius: var(--radius);
          background: rgba(255, 250, 243, 0.96);
          box-shadow: var(--shadow-tight);
        }

        .crm-source-tabs {
          display: flex;
          grid-column: 1 / -1;
          gap: 4px;
          width: fit-content;
          padding: 3px;
          border: 1px solid var(--color-line);
          border-radius: var(--radius-small);
          background: var(--color-surface);
        }

        .crm-source-tabs button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 38px;
          padding: 0 12px;
          color: var(--color-muted);
          border: 0;
          border-radius: 4px;
          background: transparent;
          font-weight: 900;
          cursor: pointer;
        }

        .crm-source-tabs button.active {
          color: #fff;
          background: var(--color-brand-dark);
        }

        .crm-filters label {
          display: grid;
          gap: 6px;
          min-width: 0;
          color: var(--color-ink);
          font-size: 0.82rem;
          font-weight: 900;
        }

        .crm-filters input,
        .crm-filters select {
          width: 100%;
        }

        .crm-clear-button {
          white-space: nowrap;
        }

        .crm-error {
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
          text-align: left;
        }

        .crm-table-panel {
          overflow: hidden;
          border: 1px solid var(--color-line);
          border-radius: var(--radius);
          background: rgba(255, 250, 243, 0.98);
          box-shadow: var(--shadow-tight);
        }

        .crm-table-heading {
          justify-content: space-between;
          gap: 12px;
          min-height: 50px;
          padding: 9px 14px;
          border-bottom: 1px solid var(--color-line);
        }

        .crm-table-heading > div {
          gap: 8px;
        }

        .crm-table-heading h2 {
          margin: 0;
          font-size: 1.05rem;
        }

        .crm-table-heading > span {
          color: var(--color-muted);
          font-size: 0.82rem;
          font-weight: 850;
        }

        .crm-table-scroll {
          width: 100%;
          overflow-x: auto;
          overscroll-behavior-x: contain;
        }

        .crm-table {
          width: 100%;
          min-width: 880px;
          border-collapse: collapse;
        }

        .crm-table th,
        .crm-table td {
          padding: 11px 12px;
          border-bottom: 1px solid var(--color-line);
          text-align: left;
          vertical-align: middle;
        }

        .crm-table th {
          color: var(--color-muted);
          background: rgba(244, 232, 219, 0.56);
          font-size: 0.73rem;
          font-weight: 950;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .crm-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .crm-table tbody tr:hover td {
          background: rgba(244, 232, 219, 0.3);
        }

        .crm-table td {
          color: var(--color-ink);
          font-size: 0.88rem;
        }

        .crm-sort-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 32px;
          padding: 0;
          color: inherit;
          background: transparent;
          border: 0;
          font: inherit;
          text-transform: inherit;
          cursor: pointer;
        }

        .crm-sort-button:hover,
        .crm-sort-button:focus-visible {
          color: var(--color-brand-dark);
        }

        .crm-detail-button {
          min-width: 38px;
          min-height: 38px;
        }

        .crm-column-detail {
          width: 68px;
          text-align: center !important;
        }

        .crm-detail-label-short {
          display: none;
        }

        .crm-sort-button:focus-visible {
          outline: 2px solid var(--color-brand);
          outline-offset: 3px;
        }

        .crm-customer-identity,
        .crm-order-counts {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .crm-customer-identity {
          max-width: 300px;
        }

        .crm-customer-identity strong,
        .crm-customer-identity a,
        .crm-customer-identity span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .crm-customer-identity span,
        .crm-order-counts span,
        .crm-order-counts small {
          color: var(--color-muted);
          font-size: 0.78rem;
        }

        .crm-status {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 9px;
          border-radius: var(--radius-small);
          font-size: 0.75rem;
          font-weight: 950;
          white-space: nowrap;
        }

        .crm-status.active {
          color: #fff;
          background: var(--color-green);
        }

        .crm-status.verified {
          color: #fff;
          background: var(--color-green);
        }

        .crm-status.pending {
          color: var(--color-ink);
          background: #f4c95d;
        }

        .crm-status.guest {
          color: #fff;
          background: var(--color-brand-dark);
        }

        .crm-status.disabled {
          color: #fff;
          background: var(--color-danger);
        }

        .crm-order-counts small {
          color: var(--color-danger);
        }

        .crm-no-detail {
          color: var(--color-muted);
          font-weight: 900;
        }

        .crm-empty-cell {
          height: 180px;
          color: var(--color-muted) !important;
          text-align: center !important;
          font-weight: 850;
        }

        .crm-pagination {
          justify-content: center;
          gap: 12px;
          min-height: 58px;
          padding: 8px 12px;
          border-top: 1px solid var(--color-line);
        }

        .crm-pagination span {
          min-width: 130px;
          color: var(--color-muted);
          text-align: center;
          font-size: 0.84rem;
        }

        .crm-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .spinning {
          animation: crm-spin 0.8s linear infinite;
        }

        @keyframes crm-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1080px) {
          .crm-filters {
            grid-template-columns:
              minmax(240px, 1fr) minmax(150px, 0.45fr)
              minmax(120px, 0.3fr) auto;
          }

          .crm-table {
            min-width: 720px;
          }
        }

        @media (max-width: 720px) {
          .crm-page {
            padding-top: 18px;
          }

          .crm-toolbar {
            align-items: flex-end;
            flex-direction: row;
          }

          .crm-toolbar-status span {
            display: none;
          }

          .crm-filters {
            grid-template-columns: minmax(0, 1fr) minmax(126px, 0.48fr);
          }

          .crm-search-field {
            grid-column: 1 / -1;
          }

          .crm-clear-button {
            width: 100%;
          }

          .crm-table {
            min-width: 610px;
          }

          .crm-column-lastPurchaseAt {
            display: none;
          }

          .crm-table th,
          .crm-table td {
            padding: 10px;
          }

          .crm-customer-identity {
            max-width: 230px;
          }
        }

        @media (max-width: 430px) {
          .crm-filters {
            grid-template-columns: 1fr 1fr;
          }

          .crm-filters label:nth-of-type(3) {
            grid-column: 1;
          }

          .crm-table-heading {
            align-items: flex-start;
          }

          .crm-table {
            min-width: 100%;
            table-layout: fixed;
          }

          .crm-column-orders {
            display: none;
          }

          .crm-column-totalSpentCents {
            display: none;
          }

          .crm-column-name {
            width: 56%;
          }

          .crm-column-verificationStatus {
            width: 28%;
          }

          .crm-column-detail {
            width: 16%;
          }

          .crm-detail-label-full {
            display: none;
          }

          .crm-detail-label-short {
            display: inline;
          }

          .crm-table[data-source="GUEST"] .crm-column-name {
            width: 68%;
          }

          .crm-table[data-source="GUEST"] .crm-column-verificationStatus {
            width: 32%;
          }

          .crm-table[data-source="GUEST"] .crm-column-detail {
            display: none;
          }

          .crm-customer-identity {
            max-width: 100%;
          }

          .crm-error {
            align-items: stretch;
            flex-direction: column;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .spinning {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

function customerStateLabel(customer: AdminCustomerListItem) {
  if (customer.anonymized) {
    return "Anonimizado";
  }
  if (!customer.active) {
    return "Desactivado";
  }
  if (customer.verificationStatus === "GUEST") {
    return "Invitado";
  }
  return customer.verificationStatus === "VERIFIED"
    ? "Verificado"
    : "Pendiente";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin actividad";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ariaSort(
  columnId: string,
  sortBy: AdminCustomerSortField,
  direction: AdminCustomerSortDirection,
): "ascending" | "descending" | undefined {
  const fieldByColumn: Partial<Record<string, AdminCustomerSortField>> = {
    name: "NAME",
    lastLoginAt: "LAST_LOGIN_AT",
    createdAt: "CREATED_AT",
  };

  if (fieldByColumn[columnId] !== sortBy) {
    return undefined;
  }
  return direction === "ASC" ? "ascending" : "descending";
}
