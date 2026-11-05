import { uuid } from "@/lib/validation/common";
import { route } from "@/server/http";
import { resetUserTwoFactor } from "@/server/services/two-factor";

export const POST = route<{ id: string }>(async ({ actor, params }) => { await resetUserTwoFactor(actor, uuid.parse(params.id)); return { ok: true }; });
