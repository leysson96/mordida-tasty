import { NotFoundException } from "@nestjs/common";
import { CustomersService } from "./customers.service";

describe("CustomersService", () => {
  const prisma = {
    customerAddress: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const dto = {
    label: " Casa ",
    recipientName: " Cliente ",
    phone: " +34611752804 ",
    street: " Calle Mayor 1 ",
    city: " A Coruna ",
    postalCode: " 15001 ",
    notes: " Timbre bajo ",
    isDefault: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (
        callback: (transactionClient: typeof prisma) => Promise<unknown>,
      ) => callback(prisma),
    );
    prisma.customerAddress.findFirst.mockResolvedValue({ id: "address-1" });
    prisma.customerAddress.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerAddress.update.mockResolvedValue({ id: "address-1" });
    prisma.customerAddress.delete.mockResolvedValue({});
  });

  function service() {
    return new CustomersService(prisma as never);
  }

  it("lists only addresses owned by the authenticated customer", async () => {
    prisma.customerAddress.findMany.mockResolvedValue([]);

    await service().listAddresses("user-1");

    expect(prisma.customerAddress.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  });

  it("updates only owned addresses and resets previous default when needed", async () => {
    await service().updateAddress("user-1", "address-1", dto);

    expect(prisma.customerAddress.findFirst).toHaveBeenCalledWith({
      where: { id: "address-1", userId: "user-1" },
    });
    expect(prisma.customerAddress.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { isDefault: false },
    });
    expect(prisma.customerAddress.update).toHaveBeenCalledWith({
      where: { id: "address-1" },
      data: {
        label: "Casa",
        recipientName: "Cliente",
        phone: "+34611752804",
        street: "Calle Mayor 1",
        city: "A Coruna",
        postalCode: "15001",
        notes: "Timbre bajo",
        isDefault: true,
      },
    });
  });

  it("does not update an address owned by another customer", async () => {
    prisma.customerAddress.findFirst.mockResolvedValue(null);

    await expect(
      service().updateAddress("user-1", "address-2", dto),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.customerAddress.update).not.toHaveBeenCalled();
  });

  it("deletes only owned addresses", async () => {
    await expect(
      service().deleteAddress("user-1", "address-1"),
    ).resolves.toEqual({ ok: true });

    expect(prisma.customerAddress.findFirst).toHaveBeenCalledWith({
      where: { id: "address-1", userId: "user-1" },
    });
    expect(prisma.customerAddress.delete).toHaveBeenCalledWith({
      where: { id: "address-1" },
    });
  });
});
