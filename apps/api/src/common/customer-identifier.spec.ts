import {
  formatCustomerDisplayId,
  maskCustomerEmail,
  maskCustomerPhone,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  normalizeCustomerPostalCode,
} from "./customer-identifier";

describe("customer identifiers", () => {
  it("normalizes email without changing its meaning", () => {
    expect(normalizeCustomerEmail("  Cliente@Example.COM ")).toBe(
      "cliente@example.com",
    );
  });

  it.each([
    ["611 752 804", "+34611752804"],
    ["+34 611-752-804", "+34611752804"],
    ["0034 611 752 804", "+34611752804"],
  ])("normalizes Spanish phone %s", (input, expected) => {
    expect(normalizeCustomerPhone(input)).toBe(expected);
  });

  it("rejects absent and invalid phones", () => {
    expect(normalizeCustomerPhone(undefined)).toBeNull();
    expect(normalizeCustomerPhone("123")).toBeNull();
  });

  it.each([
    [" 15-001 ", "15001"],
    [" sw1a 1aa ", "SW1A1AA"],
    ["!", null],
    ["", null],
  ])("normalizes postal code %s", (input, expected) => {
    expect(normalizeCustomerPostalCode(input)).toBe(expected);
  });

  it("masks contact data while keeping it distinguishable", () => {
    expect(maskCustomerEmail("alexis1@example.com")).toBe(
      "al***s1@example.com",
    );
    expect(maskCustomerPhone("611 752 804")).toBe("+34*****2804");
  });

  it("returns null when contact data cannot be masked safely", () => {
    expect(maskCustomerEmail("not-an-email")).toBeNull();
    expect(maskCustomerPhone("not-a-phone")).toBeNull();
  });

  it("formats a stable short display id without replacing the real id", () => {
    expect(
      formatCustomerDisplayId("a12b3456-c789-4def-8123-abcdef012345"),
    ).toBe("CLI-EF012345");
    expect(formatCustomerDisplayId("   ")).toBeNull();
  });
});
