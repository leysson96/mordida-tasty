import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeliveryMethod, OrderPaymentMethod } from "@prisma/client";
import * as nodemailer from "nodemailer";
import { AppEnv } from "../config/env";

interface OrderReceiptEmail {
  orderNumber: string;
  trackingToken: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  deliveryName?: string | null;
  deliveryPhone?: string | null;
  deliveryStreet?: string | null;
  deliveryCity?: string | null;
  deliveryPostalCode?: string | null;
  deliveryNotes?: string | null;
  paymentMethod?: OrderPaymentMethod | null;
  cashTenderedCents?: number | null;
  cashChangeCents?: number | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  createdAt: Date;
  items: Array<{
    productName: string;
    quantity: number;
    lineTotalCents: number;
    options?: Array<{
      groupName: string;
      choiceName: string;
      priceCents: number;
    }>;
  }>;
}

interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport?: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;
  private readonly production: boolean;
  private readonly timeoutMs: number;
  private readonly brevoApiKey?: string;
  private readonly brevoApiUrl: string;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    const host = this.configService.get("SMTP_HOST", { infer: true });
    const user = this.configService.get("SMTP_USER", { infer: true });
    const password = this.configService.get("SMTP_PASSWORD", { infer: true });

    this.frontendUrl = this.configService.get("FRONTEND_URL", { infer: true });
    this.from = this.configService.get("SMTP_FROM", { infer: true });
    this.production =
      this.configService.get("NODE_ENV", { infer: true }) === "production";
    this.timeoutMs = this.configService.get("SMTP_TIMEOUT_MS", {
      infer: true,
    });
    this.brevoApiKey = this.configService.get("BREVO_API_KEY", {
      infer: true,
    });
    this.brevoApiUrl = this.configService.get("BREVO_API_URL", {
      infer: true,
    });

    if (!this.brevoApiKey && host) {
      this.transport = nodemailer.createTransport({
        host,
        port: this.configService.get("SMTP_PORT", { infer: true }),
        secure: this.configService.get("SMTP_SECURE", { infer: true }),
        connectionTimeout: this.timeoutMs,
        greetingTimeout: this.timeoutMs,
        socketTimeout: this.timeoutMs,
        ...(user && password ? { auth: { user, pass: password } } : {}),
      });
    }
  }

  async sendVerificationEmail(email: string, token: string, name?: string) {
    const url = `${this.frontendUrl}/auth/verificar?token=${encodeURIComponent(token)}`;
    await this.send({
      to: email,
      subject: "Verifica tu cuenta de Mordida Tasty",
      text: [
        `Hola${name ? ` ${name}` : ""}.`,
        "Tu cuenta de Mordida Tasty ya casi está lista.",
        `Verifica tu cuenta aquí: ${url}`,
        "Después de verificarla podrás pedir tus favoritos más rápido.",
      ].join("\n\n"),
      html: this.verificationEmailHtml(url, name),
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const url = `${this.frontendUrl}/auth/reset?token=${encodeURIComponent(token)}`;
    await this.send({
      to: email,
      subject: "Recupera tu cuenta de Mordida Tasty",
      text: [
        "Recibimos una solicitud para cambiar tu contraseña.",
        `Puedes crear una nueva aquí: ${url}`,
        "Si no fuiste tú, ignora este mensaje.",
      ].join("\n\n"),
      html: this.passwordResetEmailHtml(url),
    });
  }

  async sendOrderReceiptEmail(order: OrderReceiptEmail) {
    const trackingUrl = `${this.frontendUrl}/seguimiento/${encodeURIComponent(
      order.orderNumber,
    )}?t=${encodeURIComponent(order.trackingToken)}`;
    const paymentSummary = this.paymentSummary(order);
    const deliverySummary = this.deliverySummary(order);

    await this.send({
      to: order.customerEmail,
      subject: `Tu ticket Mordida Tasty ${order.orderNumber}`,
      text: [
        `Gracias por tu pedido ${order.orderNumber}.`,
        `Cliente: ${order.customerName}`,
        `Telefono: ${order.customerPhone}`,
        `Entrega: ${deliverySummary}`,
        `Pago: ${paymentSummary}`,
        `Total: ${formatMoney(order.totalCents)}`,
        "",
        "Productos:",
        ...order.items.map(
          (item) =>
            `${item.quantity} x ${item.productName} - ${formatMoney(
              item.lineTotalCents,
            )}${this.optionText(item.options)}`,
        ),
        "",
        `Sigue tu pedido aqui: ${trackingUrl}`,
      ].join("\n"),
      html: this.orderReceiptHtml(order, trackingUrl),
    });
  }

  private async send(message: MailMessage) {
    if (this.brevoApiKey) {
      await this.sendWithBrevoApi(message);
      return;
    }

    if (!this.transport) {
      if (this.production) {
        throw new ServiceUnavailableException(
          "El servicio de correo no esta configurado.",
        );
      }

      this.logger.warn(`Mail disabled. ${message.subject}: ${message.text}`);
      return;
    }

    try {
      await this.transport.sendMail({
        from: this.from,
        ...message,
      });
    } catch (error) {
      this.logger.error(
        `Email delivery failed for ${message.to}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        "No pudimos enviar el email. Revisa la configuracion SMTP.",
      );
    }
  }

  private async sendWithBrevoApi(message: MailMessage) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.brevoApiUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": this.brevoApiKey!,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: parseSender(this.from),
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          ...(message.html ? { htmlContent: message.html } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Brevo API failed with status ${response.status}: ${body.slice(0, 500)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Email delivery failed for ${message.to}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        "No pudimos enviar el email. Revisa la configuracion de Brevo.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private verificationEmailHtml(url: string, name?: string) {
    const greeting = name ? `Hola ${escapeHtml(name)}` : "Hola";

    return this.baseEmailHtml({
      preheader: "Activa tu cuenta y empieza a pedir más rápido.",
      title: "Tu cuenta ya huele a planazo.",
      eyebrow: "Bienvenido a Mordida Tasty",
      body: `
        <p style="${paragraphStyle}">${greeting}, gracias por registrarte. Solo falta confirmar tu email para guardar tus datos y pedir sin rellenarlo todo cada vez.</p>
        <p style="${paragraphStyle}">Tenemos smash burgers, entrantes y limonadas listas para cuando te entre hambre de verdad.</p>
        ${emailButton(url, "Verificar cuenta")}
        <p style="${smallTextStyle}">El enlace caduca por seguridad. Si el botón no abre, copia esta URL:<br>${emailLink(url)}</p>
      `,
    });
  }

  private passwordResetEmailHtml(url: string) {
    return this.baseEmailHtml({
      preheader: "Crea una nueva contraseña para tu cuenta.",
      title: "Recupera el acceso a tu cuenta.",
      eyebrow: "Seguridad Mordida Tasty",
      body: `
        <p style="${paragraphStyle}">Usa este enlace para crear una contraseña nueva y volver a tu cuenta.</p>
        ${emailButton(url, "Cambiar contraseña")}
        <p style="${smallTextStyle}">Si no solicitaste este cambio, puedes ignorar este correo.</p>
      `,
    });
  }

  private orderReceiptHtml(order: OrderReceiptEmail, trackingUrl: string) {
    const visibleItems = order.items
      .map(
        (item) => `
          <tr>
            <td style="${tableCellStyle}">
              <strong>${item.quantity} x ${escapeHtml(item.productName)}</strong>
              ${this.optionHtml(item.options)}
            </td>
            <td align="right" style="${tableCellStyle}; white-space: nowrap;"><strong>${formatMoney(item.lineTotalCents)}</strong></td>
          </tr>
        `,
      )
      .join("");
    const deliveryRows =
      order.deliveryMethod === DeliveryMethod.DELIVERY
        ? `
          ${detailRow("Nombre entrega", order.deliveryName)}
          ${detailRow("Telefono entrega", order.deliveryPhone)}
          ${detailRow("Dirección", [order.deliveryStreet, order.deliveryCity, order.deliveryPostalCode].filter(Boolean).join(", "))}
          ${detailRow("Notas", order.deliveryNotes)}
        `
        : detailRow("Recogida", "En local");

    return this.baseEmailHtml({
      preheader: `Ticket del pedido ${order.orderNumber}.`,
      title: "Pedido recibido.",
      eyebrow: `Ticket ${escapeHtml(order.orderNumber)}`,
      body: `
        <p style="${paragraphStyle}">Gracias, ${escapeHtml(order.customerName)}. Guardamos tu pedido y te dejamos aqui el comprobante.</p>
        ${emailButton(trackingUrl, "Seguir pedido")}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 22px 0 12px; border-collapse: collapse;">
          ${visibleItems}
          ${moneyRow("Subtotal", order.subtotalCents)}
          ${moneyRow("Envío", order.deliveryFeeCents)}
          ${order.discountCents > 0 ? moneyRow("Descuento", -order.discountCents) : ""}
          ${moneyRow("IVA incluido", order.taxCents)}
          <tr>
            <td style="${totalCellStyle}">Total</td>
            <td align="right" style="${totalCellStyle}; white-space: nowrap;">${formatMoney(order.totalCents)}</td>
          </tr>
        </table>
        <div style="${detailBoxStyle}">
          ${detailRow("Pago", this.paymentSummary(order))}
          ${detailRow("Pedido", formatDate(order.createdAt))}
          ${detailRow("Cliente", `${order.customerName} - ${order.customerPhone}`)}
          ${deliveryRows}
        </div>
        <p style="${smallTextStyle}">Este ticket confirma tu pedido. No sustituye una factura fiscal completa si necesitas datos fiscales adicionales.</p>
      `,
    });
  }

  private baseEmailHtml(input: {
    preheader: string;
    eyebrow: string;
    title: string;
    body: string;
  }) {
    return `
      <!doctype html>
      <html>
        <body style="margin:0; padding:0; background:#fff5e9; color:#211512; font-family:Arial, Helvetica, sans-serif;">
          <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(input.preheader)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff5e9; padding:24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px; background:#fffaf3; border:1px solid #ead7bf; border-radius:8px; overflow:hidden; box-shadow:0 18px 40px rgba(33,21,18,0.12);">
                  <tr>
                    <td style="padding:24px; background:#2b1613;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <div style="display:inline-block; width:54px; height:54px; line-height:54px; text-align:center; border-radius:12px; background:linear-gradient(135deg,#75080d,#1f100f); color:#ffffff; font-size:22px; font-weight:900; box-shadow:5px 5px 0 #c25a00;">MT</div>
                            <span style="display:inline-block; margin-left:14px; vertical-align:middle; color:#ffffff; font-size:22px; font-weight:900;">Mordida Tasty</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:28px 24px 30px;">
                      <p style="margin:0 0 8px; color:#75080d; font-size:12px; font-weight:900; text-transform:uppercase;">${escapeHtml(input.eyebrow)}</p>
                      <h1 style="margin:0 0 14px; color:#211512; font-size:32px; line-height:1.05; font-weight:900;">${escapeHtml(input.title)}</h1>
                      ${input.body}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private paymentSummary(
    order: Pick<
      OrderReceiptEmail,
      | "paymentMethod"
      | "deliveryMethod"
      | "cashTenderedCents"
      | "cashChangeCents"
    >,
  ) {
    if (order.paymentMethod !== OrderPaymentMethod.CASH) {
      return "Tarjeta";
    }

    if (
      order.cashTenderedCents !== null &&
      order.cashTenderedCents !== undefined
    ) {
      return `Efectivo - paga con ${formatMoney(order.cashTenderedCents)} - cambio ${formatMoney(Math.max(0, order.cashChangeCents ?? 0))}`;
    }

    return order.deliveryMethod === DeliveryMethod.DELIVERY
      ? "Efectivo en entrega"
      : "Efectivo en local";
  }

  private deliverySummary(
    order: Pick<
      OrderReceiptEmail,
      | "deliveryMethod"
      | "deliveryStreet"
      | "deliveryCity"
      | "deliveryPostalCode"
    >,
  ) {
    if (order.deliveryMethod === DeliveryMethod.PICKUP) {
      return "Recogida en local";
    }

    return (
      [order.deliveryStreet, order.deliveryCity, order.deliveryPostalCode]
        .filter(Boolean)
        .join(", ") || "Entrega a domicilio"
    );
  }

  private optionText(options: OrderReceiptEmail["items"][number]["options"]) {
    if (!options || options.length === 0) {
      return "";
    }

    return ` (${options
      .map((option) => `${option.groupName}: ${option.choiceName}`)
      .join(", ")})`;
  }

  private optionHtml(options: OrderReceiptEmail["items"][number]["options"]) {
    if (!options || options.length === 0) {
      return "";
    }

    return `<div style="${smallTextStyle}">${escapeHtml(
      options
        .map((option) => `${option.groupName}: ${option.choiceName}`)
        .join(", "),
    )}</div>`;
  }
}

function parseSender(from: string) {
  const match = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (!match) {
    return { email: from.trim() };
  }

  const name = match[1].trim().replace(/^"|"$/g, "");
  return {
    ...(name ? { name } : {}),
    email: match[2].trim(),
  };
}

const paragraphStyle =
  "margin:0 0 16px; color:#3f302b; font-size:16px; line-height:1.55;";
const smallTextStyle =
  "margin:12px 0 0; color:#7a665d; font-size:13px; line-height:1.45; font-weight:700;";
const tableCellStyle =
  "padding:12px 0; border-bottom:1px solid #ead7bf; color:#211512; font-size:15px; line-height:1.4;";
const totalCellStyle =
  "padding:16px 0 0; color:#211512; font-size:20px; font-weight:900;";
const detailBoxStyle =
  "margin-top:20px; padding:14px; background:#fff5e9; border:1px solid #ead7bf; border-radius:8px;";

function emailButton(url: string, label: string) {
  return `<p style="margin:20px 0;"><a href="${escapeAttribute(url)}" style="display:inline-block; padding:14px 20px; background:#75080d; color:#ffffff; border-radius:8px; text-decoration:none; font-size:16px; font-weight:900;">${escapeHtml(label)}</a></p>`;
}

function emailLink(url: string) {
  return `<a href="${escapeAttribute(url)}" style="color:#75080d;">${escapeHtml(url)}</a>`;
}

function moneyRow(label: string, cents: number) {
  return `
    <tr>
      <td style="${tableCellStyle}">${escapeHtml(label)}</td>
      <td align="right" style="${tableCellStyle}; white-space: nowrap;">${formatMoney(cents)}</td>
    </tr>
  `;
}

function detailRow(label: string, value?: string | null) {
  if (!value) {
    return "";
  }

  return `<p style="margin:0 0 8px; color:#3f302b; font-size:14px; line-height:1.45;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(value);
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
