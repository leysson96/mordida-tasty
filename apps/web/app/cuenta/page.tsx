"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  LogOut,
  MapPin,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { ApiError, api, formatMoney } from "../../lib/api";
import { Address, OrderSummary, User } from "../../lib/types";

export default function AccountPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<User>();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<string>();
  const [addressMessage, setAddressMessage] = useState<string>();
  const [addressBusy, setAddressBusy] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address>();

  useEffect(() => {
    let active = true;

    Promise.all([
      api<User>("/auth/me"),
      api<Address[]>("/customers/addresses"),
      api<OrderSummary[]>("/orders/mine"),
    ])
      .then(([me, savedAddresses, savedOrders]) => {
        if (!active) {
          return;
        }
        setUser(me);
        setAddresses(savedAddresses);
        setOrders(savedOrders);
        setAuthenticated(true);
      })
      .catch((requestError: Error) => {
        if (!active) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 401) {
          setAuthenticated(false);
          return;
        }
        setAuthenticated(true);
        setError(requestError.message);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authenticated !== true) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      label: String(form.get("label")),
      recipientName: String(form.get("recipientName")),
      phone: String(form.get("phone")),
      street: String(form.get("street")),
      city: String(form.get("city")),
      postalCode: String(form.get("postalCode")),
      notes: String(form.get("notes") ?? ""),
      isDefault: form.get("isDefault") === "on",
    };

    try {
      setAddressBusy(true);
      setError(undefined);
      setAddressMessage(undefined);

      const address = await api<Address>(
        editingAddress
          ? `/customers/addresses/${editingAddress.id}`
          : "/customers/addresses",
        {
          method: editingAddress ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );

      setAddresses((current) => {
        const updated = current
          .map((item) =>
            item.id === address.id
              ? address
              : address.isDefault
                ? { ...item, isDefault: false }
                : item,
          )
          .filter((item) => item.id !== address.id);
        return sortAddresses([address, ...updated]);
      });
      setEditingAddress(undefined);
      setAddressMessage(
        editingAddress ? "Direccion actualizada." : "Direccion guardada.",
      );
      formElement.reset();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar.",
      );
    } finally {
      setAddressBusy(false);
    }
  }

  async function deleteAddress(address: Address) {
    const confirmed = window.confirm(`Eliminar direccion "${address.label}"?`);
    if (!confirmed) {
      return;
    }

    try {
      setAddressBusy(true);
      setError(undefined);
      setAddressMessage(undefined);
      await api(`/customers/addresses/${address.id}`, { method: "DELETE" });
      setAddresses((current) =>
        current.filter((item) => item.id !== address.id),
      );
      if (editingAddress?.id === address.id) {
        setEditingAddress(undefined);
      }
      setAddressMessage("Direccion eliminada.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo eliminar.",
      );
    } finally {
      setAddressBusy(false);
    }
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  if (authenticated === null) {
    return (
      <main className="page-shell auth-page">
        <section className="auth-panel">
          <UserRound aria-hidden="true" size={30} />
          <h1>Tu cuenta</h1>
          <p className="muted">Cargando cuenta.</p>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="page-shell auth-page">
        <section className="auth-panel">
          <UserRound aria-hidden="true" size={30} />
          <h1>Tu cuenta</h1>
          <Link href="/auth/login" className="button primary full">
            Entrar
          </Link>
          <Link href="/auth/registro" className="button secondary full">
            Crear cuenta
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell account-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Cuenta</p>
          <h1>{user?.name ?? "Cliente"}</h1>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={logout}
          title="Salir"
        >
          <LogOut aria-hidden="true" size={20} />
        </button>
      </section>

      {error && <div className="empty-state error">{error}</div>}

      <section className="account-grid">
        <form
          key={editingAddress?.id ?? "new-address"}
          className="form-panel"
          onSubmit={saveAddress}
        >
          <h2>
            <MapPin aria-hidden="true" size={20} />
            {editingAddress ? "Editar direccion" : "Direccion"}
          </h2>
          <div className="form-grid">
            <label>
              Etiqueta
              <input
                name="label"
                required
                placeholder="Casa"
                defaultValue={editingAddress?.label ?? ""}
              />
            </label>
            <label>
              Nombre
              <input
                name="recipientName"
                required
                defaultValue={editingAddress?.recipientName ?? ""}
              />
            </label>
            <label>
              Telefono
              <input
                name="phone"
                required
                placeholder="+34..."
                defaultValue={editingAddress?.phone ?? ""}
              />
            </label>
            <label>
              Ciudad
              <input
                name="city"
                required
                defaultValue={editingAddress?.city ?? ""}
              />
            </label>
            <label className="full-field">
              Direccion
              <input
                name="street"
                required
                defaultValue={editingAddress?.street ?? ""}
              />
            </label>
            <label>
              Codigo postal
              <input
                name="postalCode"
                required
                defaultValue={editingAddress?.postalCode ?? ""}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isDefault"
                defaultChecked={editingAddress?.isDefault ?? false}
              />
              Predeterminada
            </label>
            <label className="full-field">
              Notas
              <textarea
                name="notes"
                rows={3}
                defaultValue={editingAddress?.notes ?? ""}
              />
            </label>
          </div>
          {addressMessage && <p className="form-success">{addressMessage}</p>}
          <div className="form-actions">
            {editingAddress && (
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditingAddress(undefined)}
                disabled={addressBusy}
              >
                <X aria-hidden="true" size={18} />
                Cancelar
              </button>
            )}
            <button
              className="button primary"
              type="submit"
              disabled={addressBusy}
            >
              {editingAddress ? (
                <Save aria-hidden="true" size={18} />
              ) : (
                <Plus aria-hidden="true" size={18} />
              )}
              {addressBusy
                ? "Guardando"
                : editingAddress
                  ? "Actualizar"
                  : "Guardar"}
            </button>
          </div>
        </form>

        <section className="stacked-list">
          <h2>Direcciones guardadas</h2>
          {addresses.length === 0 ? (
            <p className="muted">Sin direcciones guardadas.</p>
          ) : (
            addresses.map((address) => (
              <article key={address.id} className="list-card">
                <div className="address-card-head">
                  <strong>{address.label}</strong>
                  {address.isDefault && (
                    <span className="status-pill">Predeterminada</span>
                  )}
                </div>
                <p>
                  {address.street}, {address.city} {address.postalCode}
                </p>
                <p>
                  {address.recipientName} - {address.phone}
                </p>
                {address.notes && <p>{address.notes}</p>}
                <div className="address-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setEditingAddress(address)}
                    disabled={addressBusy}
                  >
                    <Pencil aria-hidden="true" size={17} />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="button secondary danger-text"
                    onClick={() => deleteAddress(address)}
                    disabled={addressBusy}
                  >
                    <Trash2 aria-hidden="true" size={17} />
                    Eliminar
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </section>

      <section className="stacked-list">
        <h2>
          <ReceiptText aria-hidden="true" size={20} />
          Historial
        </h2>
        {orders.length === 0 ? (
          <p className="muted">Sin pedidos todavia.</p>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={
                order.trackingToken
                  ? `/seguimiento/${order.orderNumber}?t=${encodeURIComponent(order.trackingToken)}`
                  : `/seguimiento/${order.orderNumber}`
              }
              className="list-card order-link"
            >
              <span>{order.orderNumber}</span>
              <strong>{formatMoney(order.totalCents)}</strong>
              <span>{order.status}</span>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}

function sortAddresses(addresses: Address[]) {
  return [...addresses].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault),
  );
}
