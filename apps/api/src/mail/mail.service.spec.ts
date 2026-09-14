import { DeliveryMethod, OrderPaymentMethod } from "@prisma/client";
import { MailService } from "./mail.service";

interface BrevoPayload {
  subject: string;
  textContent: string;
  htmlContent?: string;
}

describe("MailService", () => {
  const configValues: Record<string, string | number | boolean | undefined> = {
    BREVO_API_KEY: "brevo_test_key",
    BREVO_API_URL: "https://brevo.test/v3/smtp/email",
    FRONTEND_URL: "https://mordida.test",
    SMTP_FROM: "Mordida Tasty <info@mordida.test>",
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_TIMEOUT_MS: 1000,
    NODE_ENV: "test",
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("includes promotion discount snapshots in order receipt emails", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => "",
    } as Response);

    await new MailService(config as never).sendOrderReceiptEmail({
      orderNumber: "MT-20260915-0001",
      trackingToken: "track_123",
      customerEmail: "cliente@example.com",
      customerName: "Cliente Test",
      customerPhone: "+34611752804",
      deliveryMethod: DeliveryMethod.PICKUP,
      paymentMethod: OrderPaymentMethod.CARD,
      subtotalCents: 952,
      deliveryFeeCents: 0,
      discountCents: 0,
      taxCents: 87,
      totalCents: 952,
      createdAt: new Date("2026-09-15T12:00:00.000Z"),
      items: [
        {
          productName: "Mordida Smash",
          quantity: 1,
          originalLineTotalCents: 1190,
          promotionDiscountName: "Promo lunes",
          promotionDiscountCents: 238,
          lineTotalCents: 952,
          options: [],
        },
      ],
    });

    const request = fetchSpy.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    expect(typeof request?.body).toBe("string");

    const payload = JSON.parse(request?.body as string) as BrevoPayload;
    expect(payload.subject).toBe("Tu ticket Mordida Tasty MT-20260915-0001");
    expect(payload.textContent).toContain("Promo lunes");
    expect(payload.textContent).toContain("-2,38");
    expect(payload.textContent).toContain("antes 11,90");
    expect(payload.htmlContent).toContain("Promo lunes");
    expect(payload.htmlContent).toContain("-2,38");

  });
});
