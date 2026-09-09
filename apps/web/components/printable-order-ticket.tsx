import { formatMoney } from "../lib/api";
import { formatOrderItemOptions } from "../lib/order-format";
import { paymentSummaryText } from "../lib/payment-format";
import type { OrderSummary } from "../lib/types";

const cashCollectedHistoryNote = "Pago en efectivo cobrado.";

interface PrintableOrderTicketProps {
  order: OrderSummary;
  siteName: string;
}

export function PrintableOrderTicket({
  order,
  siteName,
}: PrintableOrderTicketProps) {
  const activeItems = order.items.filter((item) => !item.removedAt);
  const isDelivery = order.deliveryMethod === "DELIVERY";
  const customerName = firstText(order.customerName, order.deliveryName);
  const customerPhone = firstText(order.customerPhone, order.deliveryPhone);
  const deliveryName = firstText(order.deliveryName, order.customerName);
  const deliveryPhone = firstText(order.deliveryPhone, order.customerPhone);

  return (
    <>
      <h1>{siteName}</h1>
      <p className="print-ticket-order">
        <strong>{order.orderNumber}</strong>
      </p>
      <p>{new Date(order.createdAt).toLocaleString("es-ES")}</p>
      <p className="print-ticket-service">
        {isDelivery ? "ENTREGA A DOMICILIO" : "RECOGIDA EN LOCAL"}
      </p>
      <p>{paymentSummaryText(order)}</p>
      {order.paymentMethod === "CASH" && <p>{cashTicketStatusText(order)}</p>}

      <hr />

      <section className="print-ticket-section">
        <h2>Cliente</h2>
        <TicketLine label="Nombre" value={customerName} />
        <TicketLine label="Telefono" value={customerPhone} />
        <TicketLine label="Email" value={order.customerEmail} />
      </section>

      {isDelivery && (
        <>
          <hr />
          <section className="print-ticket-section print-ticket-delivery">
            <h2>Entrega</h2>
            <TicketLine label="Recibe" value={deliveryName} />
            <TicketLine label="Telefono" value={deliveryPhone} />
            <TicketLine label="Direccion" value={order.deliveryStreet} />
            <TicketLine label="Ciudad" value={order.deliveryCity} />
            <TicketLine label="Codigo postal" value={order.deliveryPostalCode} />
            <TicketLine label="Notas" value={order.deliveryNotes} important />
          </section>
        </>
      )}

      <hr />

      <section className="print-ticket-section">
        <h2>Productos</h2>
        {activeItems.map((item, itemIndex) => (
          <div
            className="print-ticket-row print-ticket-item-row"
            key={`printable-${item.id ?? `${item.productName}-${itemIndex}`}`}
          >
            <span>
              {item.quantity} x {item.productName}
              {item.options && item.options.length > 0 && (
                <small>{formatOrderItemOptions(item)}</small>
              )}
            </span>
            <strong>{formatMoney(item.lineTotalCents)}</strong>
          </div>
        ))}
      </section>

      <hr />

      {(order.discountCents ?? 0) > 0 && (
        <div className="print-ticket-row">
          <span>Premio Mordida Club</span>
          <strong>-{formatMoney(order.discountCents ?? 0)}</strong>
        </div>
      )}
      {(order.deliveryFeeCents ?? 0) > 0 && (
        <div className="print-ticket-row">
          <span>Envio</span>
          <strong>{formatMoney(order.deliveryFeeCents ?? 0)}</strong>
        </div>
      )}
      <div className="print-ticket-row print-ticket-total">
        <span>Total</span>
        <strong>{formatMoney(order.totalCents)}</strong>
      </div>
    </>
  );
}

function TicketLine({
  label,
  value,
  important = false,
}: {
  label: string;
  value?: string | null;
  important?: boolean;
}) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return null;
  }

  return (
    <p className={important ? "print-ticket-important" : undefined}>
      <strong>{label}:</strong> {cleanValue}
    </p>
  );
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
