import { formatMoney } from "./api";
import {
  formatOrderItemOptions,
  formatOrderItemPromotion,
  hasPromotionDiscount,
} from "./order-format";
import { paymentSummaryText } from "./payment-format";
import type { OrderSummary, TicketPrintConfig } from "./types";

const cashCollectedHistoryNote = "Pago en efectivo cobrado.";

interface OpenPrintableOrderTicketOptions {
  order: OrderSummary;
  siteName: string;
  config?: TicketPrintConfig;
}

export function openPrintableOrderTicket({
  order,
  siteName,
  config,
}: OpenPrintableOrderTicketOptions) {
  const printWindow = window.open(
    "",
    "mordida-ticket-print",
    "width=420,height=760",
  );

  if (!printWindow) {
    return false;
  }

  const ticketConfig = normalizeTicketPrintConfig(config);
  const printDocument = printWindow.document;
  printDocument.documentElement.lang = "es";
  printDocument.title = `Ticket ${order.orderNumber}`;
  printDocument.head.replaceChildren();
  printDocument.body.replaceChildren();

  const style = printDocument.createElement("style");
  style.textContent = ticketPrintCss(ticketConfig);
  printDocument.head.appendChild(style);

  for (let copy = 0; copy < ticketConfig.copies; copy += 1) {
    printDocument.body.appendChild(
      ticketNode(printDocument, order, siteName, ticketConfig, copy + 1),
    );
  }
  printDocument.close();

  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 120);

  return true;
}

export function openPrintableTestOrderTicket(
  siteName: string,
  config?: TicketPrintConfig,
) {
  const now = new Date().toISOString();

  return openPrintableOrderTicket({
    siteName,
    config,
    order: {
      id: "ticket-test",
      orderNumber: "TICKET-PRUEBA",
      status: "PAID",
      deliveryMethod: "PICKUP",
      paymentMethod: "CASH",
      customerName: "Cliente de prueba",
      customerPhone: "000000000",
      customerEmail: "",
      subtotalCents: 1000,
      discountCents: 0,
      deliveryFeeCents: 0,
      taxCents: 91,
      cashTenderedCents: 1000,
      cashChangeCents: 0,
      totalCents: 1000,
      paidAt: now,
      createdAt: now,
      updatedAt: now,
      items: [
        {
          productName: "Producto de prueba",
          quantity: 1,
          unitPriceCents: 1000,
          lineTotalCents: 1000,
          options: [
            {
              groupName: "Prueba",
              choiceName: "Sin datos reales",
              priceCents: 0,
            },
          ],
        },
      ],
      statusHistory: [
        {
          toStatus: "PAID",
          note: cashCollectedHistoryNote,
          createdAt: now,
        },
      ],
    },
  });
}

function ticketNode(
  printDocument: Document,
  order: OrderSummary,
  siteName: string,
  config: TicketPrintConfig,
  copyNumber: number,
) {
  const ticket = printDocument.createElement("main");
  ticket.className = "ticket";

  appendText(printDocument, ticket, "h1", siteName);
  appendText(printDocument, ticket, "p", order.orderNumber, "order-number");
  if (config.copies > 1) {
    appendText(
      printDocument,
      ticket,
      "p",
      `Copia ${copyNumber}`,
      "muted center",
    );
  }
  appendText(
    printDocument,
    ticket,
    "p",
    new Date(order.createdAt).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    }),
    "muted center",
  );

  const isDelivery = order.deliveryMethod === "DELIVERY";
  appendText(
    printDocument,
    ticket,
    "p",
    isDelivery ? "ENTREGA A DOMICILIO" : "RECOGIDA EN LOCAL",
    "service",
  );
  appendText(printDocument, ticket, "p", paymentSummaryText(order), "center");
  if (order.paymentMethod === "CASH") {
    appendText(printDocument, ticket, "p", cashTicketStatusText(order), "center");
  }

  appendDivider(printDocument, ticket);
  if (config.showCustomer) {
    appendCustomerSection(printDocument, ticket, order);
  }

  if (isDelivery && config.showDelivery) {
    appendDivider(printDocument, ticket);
    appendDeliverySection(printDocument, ticket, order);
  }

  appendDivider(printDocument, ticket);
  appendItemsSection(printDocument, ticket, order, config);

  appendDivider(printDocument, ticket);
  appendTotalsSection(printDocument, ticket, order, config);

  if (config.footerText) {
    appendDivider(printDocument, ticket);
    appendText(printDocument, ticket, "p", config.footerText, "footer");
  }

  return ticket;
}

function appendCustomerSection(
  printDocument: Document,
  ticket: HTMLElement,
  order: OrderSummary,
) {
  const customerName = firstText(order.customerName, order.deliveryName);
  const customerPhone = firstText(order.customerPhone, order.deliveryPhone);

  appendText(printDocument, ticket, "h2", "Cliente");
  appendLine(printDocument, ticket, "Nombre", customerName);
  appendLine(printDocument, ticket, "Telefono", customerPhone);
  appendLine(printDocument, ticket, "Email", order.customerEmail);
}

function appendDeliverySection(
  printDocument: Document,
  ticket: HTMLElement,
  order: OrderSummary,
) {
  const deliveryName = firstText(order.deliveryName, order.customerName);
  const deliveryPhone = firstText(order.deliveryPhone, order.customerPhone);

  appendText(printDocument, ticket, "h2", "Entrega");
  appendLine(printDocument, ticket, "Recibe", deliveryName);
  appendLine(printDocument, ticket, "Telefono", deliveryPhone);
  appendLine(printDocument, ticket, "Direccion", order.deliveryStreet, true);
  appendLine(printDocument, ticket, "Ciudad", order.deliveryCity);
  appendLine(printDocument, ticket, "Codigo postal", order.deliveryPostalCode);
  appendLine(printDocument, ticket, "Notas", order.deliveryNotes, true);
}

function appendItemsSection(
  printDocument: Document,
  ticket: HTMLElement,
  order: OrderSummary,
  config: TicketPrintConfig,
) {
  const activeItems = order.items.filter((item) => !item.removedAt);

  appendText(printDocument, ticket, "h2", "Productos");

  if (activeItems.length === 0) {
    appendText(printDocument, ticket, "p", "Sin productos activos.", "muted");
    return;
  }

  activeItems.forEach((item) => {
    const row = printDocument.createElement("div");
    row.className = "row item";

    const copy = printDocument.createElement("div");
    copy.className = "item-copy";
    appendText(
      printDocument,
      copy,
      "strong",
      `${item.quantity} x ${item.productName}`,
    );

    if (config.showItemOptions && item.options && item.options.length > 0) {
      appendText(printDocument, copy, "small", formatOrderItemOptions(item));
    }

    if (hasPromotionDiscount(item)) {
      appendText(
        printDocument,
        copy,
        "small",
        formatOrderItemPromotion(item),
        "discount",
      );
    }

    const amount = printDocument.createElement("strong");
    amount.className = "amount";
    amount.textContent = formatMoney(item.lineTotalCents);

    row.append(copy, amount);
    ticket.appendChild(row);
  });
}

function appendTotalsSection(
  printDocument: Document,
  ticket: HTMLElement,
  order: OrderSummary,
  config: TicketPrintConfig,
) {
  if ((order.subtotalCents ?? 0) > 0) {
    appendRow(printDocument, ticket, "Subtotal", formatMoney(order.subtotalCents ?? 0));
  }

  if ((order.discountCents ?? 0) > 0) {
    appendRow(
      printDocument,
      ticket,
      "Premio Mordida Club",
      `-${formatMoney(order.discountCents ?? 0)}`,
      "discount",
    );
  }

  if ((order.deliveryFeeCents ?? 0) > 0) {
    appendRow(printDocument, ticket, "Envio", formatMoney(order.deliveryFeeCents ?? 0));
  }

  if (config.showTaxLine && order.taxCents !== undefined) {
    appendRow(printDocument, ticket, "IVA incluido", formatMoney(order.taxCents));
  }

  appendRow(printDocument, ticket, "Total", formatMoney(order.totalCents), "total");
}

function appendLine(
  printDocument: Document,
  ticket: HTMLElement,
  label: string,
  value?: string | null,
  important = false,
) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return;
  }

  const line = printDocument.createElement("p");
  line.className = important ? "important line" : "line";

  const labelNode = printDocument.createElement("strong");
  labelNode.textContent = `${label}: `;

  line.append(labelNode, printDocument.createTextNode(cleanValue));
  ticket.appendChild(line);
}

function appendRow(
  printDocument: Document,
  ticket: HTMLElement,
  label: string,
  value: string,
  className?: string,
) {
  const row = printDocument.createElement("div");
  row.className = className ? `row ${className}` : "row";

  const labelNode = printDocument.createElement("span");
  labelNode.textContent = label;

  const valueNode = printDocument.createElement("strong");
  valueNode.textContent = value;

  row.append(labelNode, valueNode);
  ticket.appendChild(row);
}

function appendText<K extends keyof HTMLElementTagNameMap>(
  printDocument: Document,
  parent: HTMLElement,
  tagName: K,
  text: string,
  className?: string,
) {
  const element = printDocument.createElement(tagName);
  element.textContent = text;
  if (className) {
    element.className = className;
  }
  parent.appendChild(element);
  return element;
}

function appendDivider(printDocument: Document, ticket: HTMLElement) {
  ticket.appendChild(printDocument.createElement("hr"));
}

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value?.trim()));
}

function cashTicketStatusText(order: OrderSummary) {
  return isCashPaymentCollected(order)
    ? "Caja: EFECTIVO COBRADO"
    : "Caja: EFECTIVO PENDIENTE";
}

function isCashPaymentCollected(order: OrderSummary) {
  return (
    Boolean(order.paidAt) ||
    Boolean(
      order.statusHistory?.some(
        (historyItem) => historyItem.note === cashCollectedHistoryNote,
      ),
    )
  );
}

function ticketPrintCss(config: TicketPrintConfig) {
  const paperWidth = config.paperWidth === "58mm" ? 58 : 80;
  const baseFontSize =
    config.fontSize === "small" ? 10 : config.fontSize === "large" ? 14 : 12;
  const smallFontSize = Math.max(8, baseFontSize - 2);
  const headingFontSize = baseFontSize + 6;
  const orderNumberFontSize = baseFontSize + 4;

  return `
    @page {
      size: ${paperWidth}mm auto;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, "Helvetica Neue", sans-serif;
      font-size: ${baseFontSize}px;
      line-height: 1.3;
      width: ${paperWidth}mm;
      max-width: ${paperWidth}mm;
      overflow: visible;
    }

    body {
      min-width: ${paperWidth}mm;
    }

    .ticket {
      width: ${paperWidth}mm;
      max-width: ${paperWidth}mm;
      padding: 3mm;
      color: #000;
    }

    .ticket + .ticket {
      page-break-before: always;
      margin-top: 10mm;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      text-align: center;
      font-size: ${headingFontSize}px;
      font-weight: 900;
      line-height: 1.05;
      text-transform: uppercase;
    }

    h2 {
      margin-bottom: 3px;
      font-size: ${smallFontSize + 1}px;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    hr {
      border: 0;
      border-top: 1px dashed #000;
      margin: 7px 0;
    }

    .order-number {
      margin-top: 4px;
      text-align: center;
      font-size: ${orderNumberFontSize}px;
      font-weight: 900;
    }

    .center {
      text-align: center;
    }

    .muted,
    small {
      font-size: ${smallFontSize}px;
      font-weight: 700;
    }

    .service {
      margin-top: 7px;
      padding: 5px 0;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      text-align: center;
      font-size: ${baseFontSize + 1}px;
      font-weight: 900;
    }

    .line {
      margin: 2px 0;
      overflow-wrap: anywhere;
    }

    .important {
      font-size: ${baseFontSize + 1}px;
      font-weight: 900;
    }

    .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 3px 0;
      align-items: flex-start;
    }

    .item {
      padding: 3px 0;
    }

    .item-copy {
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    .item-copy strong,
    .amount {
      font-size: ${baseFontSize}px;
      font-weight: 900;
    }

    .amount {
      white-space: nowrap;
      text-align: right;
    }

    .discount {
      color: #000;
      font-weight: 900;
    }

    .total {
      margin-top: 6px;
      padding-top: 5px;
      border-top: 1px solid #000;
      font-size: ${baseFontSize + 3}px;
      font-weight: 900;
    }

    .footer {
      text-align: center;
      font-size: ${smallFontSize}px;
      font-weight: 700;
    }

    @media screen {
      html,
      body {
        width: auto;
        max-width: none;
        min-width: 0;
      }

      body {
        padding: 12px;
        background: #f3f3f3;
      }

      .ticket {
        margin: 0 auto;
        padding: 10px;
        border: 1px solid #ddd;
        background: #fff;
      }
    }

    @media print {
      html,
      body {
        width: ${paperWidth}mm;
        max-width: ${paperWidth}mm;
        min-width: ${paperWidth}mm;
        padding: 0;
        margin: 0;
      }

      .ticket {
        width: ${paperWidth}mm;
        max-width: ${paperWidth}mm;
        padding: 3mm;
        border: 0;
      }
    }
  `;
}

export function defaultTicketPrintConfig(): TicketPrintConfig {
  return {
    paperWidth: "80mm",
    fontSize: "normal",
    copies: 1,
    showCustomer: true,
    showDelivery: true,
    showItemOptions: true,
    showTaxLine: true,
    footerText: "Conserva este ticket para cualquier consulta sobre tu pedido.",
  };
}

export function normalizeTicketPrintConfig(
  config?: Partial<TicketPrintConfig> | null,
): TicketPrintConfig {
  const defaults = defaultTicketPrintConfig();
  const paperWidth =
    config?.paperWidth === "58mm" || config?.paperWidth === "80mm"
      ? config.paperWidth
      : defaults.paperWidth;
  const fontSize =
    config?.fontSize === "small" ||
    config?.fontSize === "normal" ||
    config?.fontSize === "large"
      ? config.fontSize
      : defaults.fontSize;
  const copies = Number.isInteger(config?.copies)
    ? Math.min(3, Math.max(1, Number(config?.copies)))
    : defaults.copies;

  return {
    paperWidth,
    fontSize,
    copies,
    showCustomer:
      typeof config?.showCustomer === "boolean"
        ? config.showCustomer
        : defaults.showCustomer,
    showDelivery:
      typeof config?.showDelivery === "boolean"
        ? config.showDelivery
        : defaults.showDelivery,
    showItemOptions:
      typeof config?.showItemOptions === "boolean"
        ? config.showItemOptions
        : defaults.showItemOptions,
    showTaxLine:
      typeof config?.showTaxLine === "boolean"
        ? config.showTaxLine
        : defaults.showTaxLine,
    footerText:
      typeof config?.footerText === "string"
        ? config.footerText.trim().slice(0, 180)
        : defaults.footerText,
  };
}
