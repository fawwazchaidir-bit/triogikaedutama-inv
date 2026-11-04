import "server-only";
import { z } from "zod";
import { actorCan, type Actor } from "../actor";
import { Errors } from "../errors";
import { parseInput } from "../validate";
import { listInvoices } from "./invoices";
import { listCustomers } from "./customers";
import { listPayments } from "./payments";
import { listEntries } from "./cash-entries";
import type { CustomerSummaryDto, InvoiceListItemDto, PaymentDto } from "@/lib/types";
import type { CashEntryDto } from "@/lib/finance-types";

/**
 * Pencarian global (bilah atas): invoice (nomor, pelanggan, referensi), pelanggan, pembayaran (referensi/nomor invoice), dan entri kas.
 * Setiap bagian memakai fungsi daftar yang sudah ada sehingga HAK AKSES & visibilitas identik dengan halaman masing-masing;
 * bagian yang tidak boleh dilihat peran tersebut bernilai `null` (bukan kosong) agar UI tidak menyiratkan "tidak ada hasil".
 */
export const SEARCH_MIN = 2;
export const SEARCH_LIMIT = 6;
export const searchQuerySchema = z.object({ q: z.string().trim().max(80, "Maksimal 80 karakter").default("") });

interface Section<T> { items: T[]; total: number }
export interface SearchResults {
  q: string;
  /** true bila kata kunci kurang dari SEARCH_MIN karakter (tidak ada pencarian dijalankan). */
  tooShort: boolean;
  invoices: Section<InvoiceListItemDto> | null;
  customers: Section<CustomerSummaryDto> | null;
  payments: Section<PaymentDto> | null;
  entries: Section<CashEntryDto> | null;
}

export async function searchAll(actor: Actor, raw: unknown): Promise<SearchResults> {
  const { q } = parseInput(searchQuerySchema, raw ?? {});
  const canInvoices = actorCan(actor, "invoice:view") || actorCan(actor, "invoice:view_own");
  const canCustomers = actorCan(actor, "customer:view");
  const canPayments = actorCan(actor, "payment:view");
  const canEntries = actorCan(actor, "finance:view") || actorCan(actor, "expense:view_own");
  if (!canInvoices && !canCustomers && !canPayments && !canEntries) throw Errors.forbidden();
  if (q.length < SEARCH_MIN) return { q, tooShort: true, invoices: null, customers: null, payments: null, entries: null };
  const pick = <T,>(r: { items: T[]; total: number }): Section<T> => ({ items: r.items, total: r.total });
  const [invoices, customers, payments, entries] = await Promise.all([
    canInvoices ? listInvoices(actor, { q, pageSize: SEARCH_LIMIT }).then(pick) : null,
    canCustomers ? listCustomers(actor, { q, status: "all", pageSize: SEARCH_LIMIT }).then(pick) : null,
    canPayments ? listPayments(actor, { q, pageSize: SEARCH_LIMIT }).then(pick) : null,
    canEntries ? listEntries(actor, { q, pageSize: SEARCH_LIMIT }).then(pick) : null,
  ]);
  return { q, tooShort: false, invoices, customers, payments, entries };
}
