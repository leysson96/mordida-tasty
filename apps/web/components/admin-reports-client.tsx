"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { api, formatMoney } from "../lib/api";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../lib/admin-errors";

interface SalesReportResponse {
  from: string;
  to: string;
  totalRevenueCents: number;
  orderCount: number;
  averageTicketCents: number;
  salesByDay: Array<{
    date: string;
    revenueCents: number;
    orderCount: number;
  }>;
  topProducts: Array<{
    productName: string;
    quantity: number;
    revenueCents: number;
  }>;
}

type RangePreset = "today" | "7d" | "30d" | "month";

function inputDate(date: Date) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 10);
}

function presetRange(preset: RangePreset) {
  const today = new Date();
  const from = new Date(today);

  if (preset === "today") {
    return { from: inputDate(today), to: inputDate(today) };
  }

  if (preset === "month") {
    from.setDate(1);
    return { from: inputDate(from), to: inputDate(today) };
  }

  from.setDate(today.getDate() - (preset === "7d" ? 6 : 29));
  return { from: inputDate(from), to: inputDate(today) };
}

export function AdminReportsClient() {
  const initialRange = useMemo(() => presetRange("30d"), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [report, setReport] = useState<SalesReportResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadReport(initialRange.from, initialRange.to);
  }, [initialRange.from, initialRange.to]);

  async function loadReport(nextFrom = from, nextTo = to) {
    setLoading(true);
    setError(undefined);

    try {
      const params = new URLSearchParams({ from: nextFrom, to: nextTo });
      const data = await api<SalesReportResponse>(
        `/admin/reports/sales?${params.toString()}`,
      );
      setReport(data);
    } catch (requestError) {
      if (redirectOnAdminAuthError(requestError)) {
        return;
      }
      setError(readableErrorMessage(requestError, "No se pudo cargar."));
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadReport();
  }

  function applyPreset(preset: RangePreset) {
    const range = presetRange(preset);
    setFrom(range.from);
    setTo(range.to);
    loadReport(range.from, range.to);
  }

  const activeSalesDays =
    report?.salesByDay.filter(
      (day) => day.revenueCents > 0 || day.orderCount > 0,
    ) ?? [];
  const chartDays =
    activeSalesDays.length > 0
      ? activeSalesDays
      : (report?.salesByDay.slice(-7) ?? []);
  const maxRevenue = Math.max(
    ...(chartDays.map((day) => day.revenueCents) ?? [0]),
    0,
  );
  const maxProductRevenue = Math.max(
    ...(report?.topProducts.map((product) => product.revenueCents) ?? [0]),
    0,
  );
  const bestDay = activeSalesDays.reduce<
    SalesReportResponse["salesByDay"][number] | undefined
  >(
    (best, day) => (!best || day.revenueCents > best.revenueCents ? day : best),
    undefined,
  );
  const topProduct = report?.topProducts[0];

  return (
    <main className="page-shell admin-page admin-report-page">
      <section className="admin-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Reportes</h1>
        </div>
        <Link href="/admin" className="button secondary">
          <ArrowLeft aria-hidden="true" size={18} />
          Pedidos
        </Link>
      </section>

      <form className="report-controls" onSubmit={submit}>
        <div className="report-presets">
          <button
            type="button"
            className="button secondary"
            onClick={() => applyPreset("today")}
          >
            Hoy
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => applyPreset("7d")}
          >
            7 dias
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => applyPreset("30d")}
          >
            30 dias
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => applyPreset("month")}
          >
            Mes
          </button>
        </div>
        <label>
          Desde
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <button className="button primary" type="submit" disabled={loading}>
          <CalendarDays aria-hidden="true" size={18} />
          Filtrar
        </button>
      </form>

      {error && <div className="empty-state error">{error}</div>}

      <section className="admin-metrics">
        <article>
          <span>Ingresos</span>
          <strong>{formatMoney(report?.totalRevenueCents ?? 0)}</strong>
          <small>Ventas cobradas</small>
        </article>
        <article>
          <span>Pedidos</span>
          <strong>{report?.orderCount ?? 0}</strong>
          <small>{activeSalesDays.length} dias con venta</small>
        </article>
        <article>
          <span>Ticket medio</span>
          <strong>{formatMoney(report?.averageTicketCents ?? 0)}</strong>
          <small>Promedio por pedido</small>
        </article>
      </section>

      {report && (
        <section className="report-insights">
          <article>
            <CalendarDays aria-hidden="true" size={20} />
            <div>
              <span>Rango</span>
              <strong>
                {formatReportDate(report.from)} - {formatReportDate(report.to)}
              </strong>
            </div>
          </article>
          <article>
            <Trophy aria-hidden="true" size={20} />
            <div>
              <span>Mejor dia</span>
              <strong>
                {bestDay ? formatReportDate(bestDay.date) : "Sin ventas"}
              </strong>
              {bestDay && <small>{formatMoney(bestDay.revenueCents)}</small>}
            </div>
          </article>
          <article>
            <PackageCheck aria-hidden="true" size={20} />
            <div>
              <span>Producto lider</span>
              <strong>{topProduct?.productName ?? "Sin ventas"}</strong>
              {topProduct && <small>{topProduct.quantity} uds.</small>}
            </div>
          </article>
        </section>
      )}

      <section className="report-grid">
        <section className="form-panel">
          <h2>
            <BarChart3 aria-hidden="true" size={20} />
            Actividad diaria
          </h2>
          {!report || loading ? (
            <div className="empty-state">
              <RefreshCw className="spin" aria-hidden="true" />
              Cargando reportes
            </div>
          ) : (
            <div className="trend-chart">
              {chartDays.map((day) => {
                const height =
                  maxRevenue > 0
                    ? Math.max(8, (day.revenueCents / maxRevenue) * 100)
                    : 8;
                return (
                  <article className="trend-day" key={day.date}>
                    <div className="trend-day-label">
                      <strong>{formatReportDate(day.date)}</strong>
                      <span>{day.orderCount} ped.</span>
                    </div>
                    <div className="trend-bar-track">
                      <span
                        className="trend-bar"
                        style={{ height: `${height}%` }}
                        title={formatMoney(day.revenueCents)}
                      />
                    </div>
                    <strong>{formatMoney(day.revenueCents)}</strong>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="form-panel">
          <h2>
            <ReceiptText aria-hidden="true" size={20} />
            Productos mas vendidos
          </h2>
          <div className="report-product-list">
            {report?.topProducts.length ? (
              report.topProducts.map((product, index) => {
                const width =
                  maxProductRevenue > 0
                    ? Math.max(
                        8,
                        (product.revenueCents / maxProductRevenue) * 100,
                      )
                    : 8;

                return (
                  <article
                    className="report-product-row"
                    key={product.productName}
                  >
                    <span className="report-product-rank">{index + 1}</span>
                    <div>
                      <strong>{product.productName}</strong>
                      <small>{product.quantity} uds.</small>
                      <span className="report-product-meter">
                        <span style={{ width: `${width}%` }} />
                      </span>
                    </div>
                    <strong>{formatMoney(product.revenueCents)}</strong>
                  </article>
                );
              })
            ) : (
              <p className="muted">Sin ventas en este rango.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function formatReportDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
}
