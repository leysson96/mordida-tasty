"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPinned,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import { api, formatMoney } from "../lib/api";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../lib/admin-errors";
import { DeliveryZone } from "../lib/types";

export function AdminDeliveryClient() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await api<DeliveryZone[]>("/admin/delivery-zones");
      setZones(data);
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudieron cargar las zonas.");
    }
  }

  async function createZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      setBusyId("create");
      const zone = await api<DeliveryZone>("/admin/delivery-zones", {
        method: "POST",
        body: JSON.stringify(zonePayload(form)),
      });
      setZones((current) => sortZones([zone, ...current]));
      formElement.reset();
      setMessage("Zona creada.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo crear la zona.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function updateZone(
    zone: DeliveryZone,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      setBusyId(zone.id);
      const updated = await api<DeliveryZone>(
        `/admin/delivery-zones/${zone.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...zonePayload(form),
            active: form.get("active") === "on",
          }),
        },
      );
      setZones((current) =>
        sortZones(
          current.map((item) => (item.id === zone.id ? updated : item)),
        ),
      );
      setMessage("Zona guardada.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar la zona.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function toggleZone(zone: DeliveryZone) {
    if (zone.active) {
      const confirmed = window.confirm(`Desactivar reparto en "${zone.name}"?`);
      if (!confirmed) {
        return;
      }
    }

    try {
      setBusyId(zone.id);
      const updated = await api<DeliveryZone>(
        `/admin/delivery-zones/${zone.id}`,
        zone.active
          ? { method: "DELETE" }
          : {
              method: "PATCH",
              body: JSON.stringify({ active: true }),
            },
      );
      setZones((current) =>
        sortZones(
          current.map((item) => (item.id === zone.id ? updated : item)),
        ),
      );
      setMessage(zone.active ? "Zona desactivada." : "Zona reactivada.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo cambiar la zona.");
    } finally {
      setBusyId(undefined);
    }
  }

  function handleAdminError(requestError: unknown, fallback: string) {
    if (redirectOnAdminAuthError(requestError)) {
      return;
    }

    setMessage(undefined);
    setError(readableErrorMessage(requestError, fallback));
  }

  return (
    <main className="page-shell admin-page">
      <section className="admin-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Reparto</h1>
        </div>
        <div className="toolbar-actions">
          <Link href="/admin" className="button secondary">
            <ArrowLeft aria-hidden="true" size={18} />
            Pedidos
          </Link>
        </div>
      </section>

      {error && <div className="empty-state error">{error}</div>}
      {message && <p className="form-success">{message}</p>}

      <section className="delivery-layout">
        <form className="form-panel delivery-create-form" onSubmit={createZone}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Envio</p>
              <h2>Nueva zona</h2>
            </div>
            <MapPinned aria-hidden="true" size={24} />
          </div>
          <div className="form-grid compact-two">
            <label className="full-field">
              Nombre
              <input name="name" required />
            </label>
            <label>
              Coste EUR
              <input
                name="deliveryFee"
                type="number"
                step="0.01"
                min="0"
                defaultValue="2.50"
                required
              />
            </label>
            <label>
              Minimo EUR
              <input
                name="minimumOrder"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                required
              />
            </label>
            <label>
              Orden
              <input name="sortOrder" type="number" min="0" defaultValue="0" />
            </label>
            <label className="full-field">
              Codigos postales
              <textarea
                name="postalCodes"
                rows={5}
                placeholder={"15001\n15002\n151*"}
                required
              />
            </label>
          </div>
          <button
            className="button primary"
            type="submit"
            disabled={busyId === "create"}
          >
            <Plus aria-hidden="true" size={18} />
            Crear zona
          </button>
        </form>

        <section className="delivery-zones-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cobertura</p>
              <h2>Zonas de reparto</h2>
            </div>
            <Truck aria-hidden="true" size={24} />
          </div>

          <div className="delivery-zone-list">
            {zones.length === 0 ? (
              <div className="empty-state compact">Sin zonas configuradas.</div>
            ) : (
              zones.map((zone) => (
                <form
                  key={zone.id}
                  className={`delivery-zone-card ${
                    zone.active ? "" : "inactive"
                  }`}
                  onSubmit={(event) => updateZone(zone, event)}
                >
                  <div className="delivery-zone-head">
                    <div>
                      <strong>{zone.name}</strong>
                      <span>
                        {formatMoney(zone.deliveryFeeCents)} - minimo{" "}
                        {formatMoney(zone.minimumOrderCents)}
                      </span>
                    </div>
                    <span
                      className={`status-pill ${zone.active ? "" : "danger"}`}
                    >
                      {zone.active ? "Activa" : "Desactivada"}
                    </span>
                  </div>

                  <div className="form-grid compact">
                    <label>
                      Nombre
                      <input name="name" defaultValue={zone.name} required />
                    </label>
                    <label>
                      Coste EUR
                      <input
                        name="deliveryFee"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={centsToEuros(zone.deliveryFeeCents)}
                        required
                      />
                    </label>
                    <label>
                      Minimo EUR
                      <input
                        name="minimumOrder"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={centsToEuros(zone.minimumOrderCents)}
                        required
                      />
                    </label>
                    <label>
                      Orden
                      <input
                        name="sortOrder"
                        type="number"
                        min="0"
                        defaultValue={zone.sortOrder}
                      />
                    </label>
                    <label className="full-field">
                      Codigos postales
                      <textarea
                        name="postalCodes"
                        rows={4}
                        defaultValue={zone.postalCodes.join("\n")}
                        required
                      />
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={zone.active}
                      />
                      Activa
                    </label>
                  </div>

                  <div className="delivery-zone-actions">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => toggleZone(zone)}
                      disabled={busyId === zone.id}
                    >
                      {zone.active ? (
                        <Trash2 aria-hidden="true" size={17} />
                      ) : (
                        <RotateCcw aria-hidden="true" size={17} />
                      )}
                      {zone.active ? "Desactivar" : "Reactivar"}
                    </button>
                    <button
                      className="button primary"
                      type="submit"
                      disabled={busyId === zone.id}
                    >
                      <Save aria-hidden="true" size={17} />
                      Guardar
                    </button>
                  </div>
                </form>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function zonePayload(form: FormData) {
  return {
    name: String(form.get("name")),
    postalCodes: parsePostalCodes(String(form.get("postalCodes") ?? "")),
    deliveryFeeCents: eurosToCents(String(form.get("deliveryFee") ?? "0")),
    minimumOrderCents: eurosToCents(String(form.get("minimumOrder") ?? "0")),
    sortOrder: Number(form.get("sortOrder") || 0),
  };
}

function parsePostalCodes(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function eurosToCents(value: string) {
  return Math.round(Number(value.replace(",", ".")) * 100);
}

function centsToEuros(value: number) {
  return (value / 100).toFixed(2);
}

function sortZones(zones: DeliveryZone[]) {
  return [...zones].sort((a, b) => {
    if (a.active !== b.active) {
      return Number(b.active) - Number(a.active);
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    return a.name.localeCompare(b.name, "es");
  });
}
