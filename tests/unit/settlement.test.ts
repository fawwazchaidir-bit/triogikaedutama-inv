import { describe, expect, it } from "vitest";
import { settlementDate, type SettlementPayment } from "@/lib/finance/settlement";

const pay = (id: string, date: string): SettlementPayment => ({ id, entryType: "PAYMENT", reversesPaymentId: null, date });
const rev = (id: string, of: string, date: string): SettlementPayment => ({ id, entryType: "REVERSAL", reversesPaymentId: of, date });

describe("settlementDate", () => {
  it("tanggal pembayaran terakhir yang masih berlaku", () => {
    expect(settlementDate([pay("a", "2026-01-05"), pay("b", "2026-01-20"), pay("c", "2026-01-10")])).toBe("2026-01-20");
    expect(settlementDate([pay("a", "2026-01-05")])).toBe("2026-01-05");
  });
  it("pembayaran yang sudah dibalik diabaikan; dibayar ulang memakai tanggal baru", () => {
    expect(settlementDate([pay("a", "2026-01-05"), rev("r", "a", "2026-01-30")])).toBeNull();
    expect(settlementDate([pay("a", "2026-01-05"), rev("r", "a", "2026-01-30"), pay("b", "2026-02-03")])).toBe("2026-02-03");
    expect(settlementDate([pay("a", "2026-01-05"), pay("b", "2026-01-10"), rev("r", "b", "2026-01-12")])).toBe("2026-01-05");
  });
  it("kosong → null; baris pembalikan tidak pernah dianggap pembayaran", () => {
    expect(settlementDate([])).toBeNull();
    expect(settlementDate([rev("r", "x", "2026-03-01")])).toBeNull();
  });
});
