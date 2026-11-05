import { z } from "zod";
import { readJson, route } from "@/server/http";
import { enableTwoFactor } from "@/server/services/two-factor";

export const POST = route(async ({ req, actor }) => enableTwoFactor(actor, await readJson(req, z.unknown())), { allowMustChange: true, allowMfaSetup: true });
