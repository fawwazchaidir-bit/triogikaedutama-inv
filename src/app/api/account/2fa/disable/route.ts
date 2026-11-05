import { z } from "zod";
import { readJson, route } from "@/server/http";
import { disableTwoFactor } from "@/server/services/two-factor";

export const POST = route(async ({ req, actor }) => { await disableTwoFactor(actor, await readJson(req, z.unknown())); return { ok: true }; }, { allowMustChange: true, allowMfaSetup: true });
