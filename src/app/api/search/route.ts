import { route } from "@/server/http";
import { searchAll } from "@/server/services/search";

/** GET /api/search?q= — pencarian global lintas invoice, pelanggan, pembayaran, entri kas (menurut izin). */
export const GET = route(({ req, actor }) => searchAll(actor, Object.fromEntries(new URL(req.url).searchParams)));
