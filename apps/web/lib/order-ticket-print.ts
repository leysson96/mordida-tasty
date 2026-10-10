import { formatMoney } from "./api";
import {
  formatOrderItemOptions,
  formatOrderItemPromotion,
  hasPromotionDiscount,
} from "./order-format";
import { paymentSummaryText } from "./payment-format";
import type { OrderSummary } from "./types";

const cashCollectedHistoryNote = "Pago en efectivo cobrado.";

interface OpenPrintableOrderTicketOptions {
  order: OrderSummary;
  siteName: string;
}

export function openPrintableOrderTicket({
  order,
  siteName,
}: OpenPrintableOrderTicketOptions) {
  const printWindow = window.open(
    "",
    "mordida-ticket-print",
    "width=420,height=760",
  );

  if (!printWindow) {
    return false;
  }

  const printDocument = printWindow.document;
  printDocument.documentElement.lang = "es";
  printDocument.title = `Ticket ${order.orderNumber}`;
  printDocument.head.replaceChildren();
  printDocument.body.replaceChildren();

  const style = printDocument.createElement("style");
  style.textContent = ticketPrintCss();
  printDocument.head.appendChild(style);

  printDocument.body.appendChild(ticketNode(printDocument, order, siteName));
  printDocument.close();

  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 120);

  return true;
}

function ticketNode(
  printDocument: Document,
  order: OrderSummary,
  siteName: string,
) {
  const ticket = printDocument.createElement("main");
  ticket.className = "ticket";

  appendText(printDocument, ticket, "h1", siteName);
  appendText(printDocument, ticket, "p", order.orderNumber, "order-number");
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
  appendCustomerSection(printDocument, ticket, order);

  if (isDelivery) {
    appendDivider(printDocument, ticket);
    appendDeliverySection(printDocument, ticket, order);
  }

  appendDivider(printDocument, ticket);
  appendItemsSection(printDocument, ticket, order);

  appendDivider(printDocument, ticket);
  appendTotalsSection(printDocument, ticket, order);

  appendDivider(printDocument, ticket);
  appendText(
    printDocument,
    ticket,
    "p",
    "Conserva este ticket para cualquier consulta sobre tu pedido.",
    "footer",
  );

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

    if (item.options && item.options.length > 0) {
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

  if (order.taxCents !== undefined) {
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

function ticketPrintCss() {
  return `
    @page {
      size: 80mm auto;
      margin: 3mm;
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
      font-size: 12px;
      line-height: 1.3;
    }

    body {
      width: 74mm;
    }

    .ticket {
      width: 74mm;
      padding: 0;
      color: #000;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      text-align: center;
      font-size: 18px;
      font-weight: 900;
      line-height: 1.05;
      text-transform: uppercase;
    }

    h2 {
      margin-bottom: 3px;
      font-size: 11px;
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
      font-size: 16px;
      font-weight: 900;
    }

    .center {
      text-align: center;
    }

    .muted,
    small {
      font-size: 10px;
      font-weight: 700;
    }

    .service {
      margin-top: 7px;
      padding: 5px 0;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      text-align: center;
      font-size: 13px;
      font-weight: 900;
    }

    .line {
      margin: 2px 0;
      overflow-wrap: anywhere;
    }

    .important {
      font-size: 13px;
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
      font-size: 12px;
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
      font-size: 15px;
      font-weight: 900;
    }

    .footer {
      text-align: center;
      font-size: 10px;
      font-weight: 700;
    }

    @media screen {
      body {
        padding: 12px;
      }

      .ticket {
        margin: 0 auto;
        padding: 10px;
        border: 1px solid #ddd;
      }
    }
  `;
}
