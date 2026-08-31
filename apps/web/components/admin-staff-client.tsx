"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  KeyRound,
  RotateCcw,
  Save,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { api } from "../lib/api";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../lib/admin-errors";
import { Role, StaffUser, User } from "../lib/types";

type StaffRole = "ADMIN" | "KITCHEN";
type RoleFilter = StaffRole | "ALL";

interface PasswordResetResponse {
  ok: boolean;
  resetToken?: string;
}

const roleLabels: Record<StaffRole, string> = {
  ADMIN: "Administrador",
  KITCHEN: "Cocina",
};

export function AdminStaffClient() {
  const [currentUser, setCurrentUser] = useState<User>();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  useEffect(() => {
    load(roleFilter);
  }, [roleFilter]);

  async function load(filter = roleFilter) {
    try {
      const roleQuery = filter === "ALL" ? "" : `?role=${filter}`;
      const [me, users] = await Promise.all([
        api<User>("/admin/auth/me"),
        api<StaffUser[]>(`/admin/users${roleQuery}`),
      ]);
      setCurrentUser(me);
      setStaff(users);
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo cargar el staff.");
    }
  }

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const phone = String(form.get("phone") ?? "").trim();

    try {
      setBusyId("create");
      const created = await api<StaffUser>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: String(form.get("email")),
          name: String(form.get("name")),
          phone: phone || null,
          role: String(form.get("role")) as StaffRole,
          password: String(form.get("password")),
        }),
      });
      formElement.reset();
      setStaff((current) =>
        roleFilter === "ALL" || created.role === roleFilter
          ? [created, ...current]
          : current,
      );
      setMessage("Usuario interno creado.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo crear el usuario.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function updateStaff(
    user: StaffUser,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "").trim();

    try {
      setBusyId(user.id);
      const updated = await api<StaffUser>(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          email: String(form.get("email")),
          name: String(form.get("name")),
          phone: phone || null,
          role: String(form.get("role")) as StaffRole,
        }),
      });
      setStaff((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage("Usuario guardado.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar el usuario.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function toggleStatus(user: StaffUser) {
    const nextActive = !user.active;
    if (!nextActive) {
      const confirmed = window.confirm(
        `Desactivar a ${user.name}? No podra entrar al panel mientras este desactivado.`,
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setBusyId(user.id);
      const updated = await api<StaffUser>(`/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      });
      setStaff((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage(
        updated.active ? "Usuario reactivado." : "Usuario desactivado.",
      );
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo cambiar el estado.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function resetTwoFactor(user: StaffUser) {
    const confirmed = window.confirm(
      `Resetear 2FA de ${user.name}? Tendra que configurarlo otra vez.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setBusyId(user.id);
      const updated = await api<StaffUser>(
        `/admin/users/${user.id}/reset-2fa`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      setStaff((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage("2FA reseteado.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo resetear 2FA.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function requestPasswordReset(user: StaffUser) {
    try {
      setBusyId(user.id);
      const result = await api<PasswordResetResponse>(
        `/admin/users/${user.id}/password-reset`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      setMessage(
        result.resetToken
          ? `Recuperacion creada. Token local: ${result.resetToken}`
          : "Correo de recuperacion enviado.",
      );
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo enviar recuperacion.");
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

  function roleName(role: Role) {
    return role === "ADMIN" || role === "KITCHEN" ? roleLabels[role] : role;
  }

  return (
    <main className="page-shell admin-page">
      <section className="admin-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Staff</h1>
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

      <section className="staff-layout">
        <form className="form-panel staff-create-form" onSubmit={createStaff}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Equipo</p>
              <h2>Nuevo usuario</h2>
            </div>
            <UserPlus aria-hidden="true" size={24} />
          </div>
          <div className="form-grid compact-two">
            <label>
              Rol
              <select name="role" defaultValue="KITCHEN">
                <option value="KITCHEN">Cocina</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
            <label>
              Nombre
              <input name="name" required />
            </label>
            <label className="full-field">
              Email
              <input name="email" type="email" required />
            </label>
            <label className="full-field">
              Telefono
              <input name="phone" placeholder="+34..." />
            </label>
            <label className="full-field">
              Contrasena temporal
              <input
                name="password"
                type="password"
                minLength={10}
                maxLength={120}
                required
              />
            </label>
          </div>
          <button
            className="button primary"
            type="submit"
            disabled={busyId === "create"}
          >
            <UserPlus aria-hidden="true" size={18} />
            Crear usuario
          </button>
        </form>

        <section className="staff-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Accesos</p>
              <h2>Usuarios internos</h2>
            </div>
            <UsersRound aria-hidden="true" size={24} />
          </div>

          <div
            className="staff-filter"
            role="tablist"
            aria-label="Filtro staff"
          >
            {(["ALL", "ADMIN", "KITCHEN"] as RoleFilter[]).map((filter) => (
              <button
                type="button"
                key={filter}
                className={roleFilter === filter ? "active" : ""}
                onClick={() => setRoleFilter(filter)}
              >
                {filter === "ALL" ? "Todos" : roleName(filter)}
              </button>
            ))}
          </div>

          <div className="staff-list">
            {staff.length === 0 ? (
              <div className="empty-state compact">Sin usuarios internos.</div>
            ) : (
              staff.map((user) => (
                <form
                  key={user.id}
                  className={`staff-card ${user.active ? "" : "inactive"}`}
                  onSubmit={(event) => updateStaff(user, event)}
                >
                  <div className="staff-card-head">
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                    <span
                      className={`status-pill ${user.active ? "" : "danger"}`}
                    >
                      {user.active ? "Activo" : "Desactivado"}
                    </span>
                  </div>

                  <div className="staff-meta">
                    <span>{roleName(user.role)}</span>
                    <span>
                      {user.twoFactorEnabled ? "2FA activo" : "2FA pendiente"}
                    </span>
                    <span>
                      Alta{" "}
                      {new Date(user.createdAt).toLocaleDateString("es-ES")}
                    </span>
                  </div>

                  <div className="form-grid compact">
                    <label>
                      Nombre
                      <input name="name" defaultValue={user.name} required />
                    </label>
                    <label>
                      Email
                      <input
                        name="email"
                        type="email"
                        defaultValue={user.email}
                        required
                      />
                    </label>
                    <label>
                      Rol
                      <select name="role" defaultValue={user.role}>
                        <option value="ADMIN">Administrador</option>
                        <option value="KITCHEN">Cocina</option>
                      </select>
                    </label>
                    <label className="full-field">
                      Telefono
                      <input name="phone" defaultValue={user.phone ?? ""} />
                    </label>
                  </div>

                  <div className="staff-actions">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => requestPasswordReset(user)}
                      disabled={busyId === user.id || !user.active}
                    >
                      <KeyRound aria-hidden="true" size={17} />
                      Recuperacion
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => resetTwoFactor(user)}
                      disabled={busyId === user.id}
                    >
                      <RotateCcw aria-hidden="true" size={17} />
                      Reset 2FA
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => toggleStatus(user)}
                      disabled={
                        busyId === user.id || currentUser?.id === user.id
                      }
                    >
                      {user.active ? (
                        <ToggleLeft aria-hidden="true" size={18} />
                      ) : (
                        <ToggleRight aria-hidden="true" size={18} />
                      )}
                      {user.active ? "Desactivar" : "Reactivar"}
                    </button>
                    <button
                      className="button primary"
                      type="submit"
                      disabled={busyId === user.id}
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

      <section className="staff-note">
        <ShieldCheck aria-hidden="true" size={20} />
        <span>
          Los usuarios de cocina solo operan pedidos en cocina. Solo admin puede
          crear staff, resetear 2FA o cambiar accesos.
        </span>
      </section>
    </main>
  );
}
