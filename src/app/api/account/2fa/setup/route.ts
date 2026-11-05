import { z } from "zod";
import { readJson, route } from "@/server/http";
import { beginTwoFactorSetup } from "@/server/services/two-factor";

export const POST = route(async ({ req, actor }) => beginTwoFactorSetup(actor, await readJson(req, z.unknown())), { allowMustChange: true, allowMfaSetup: true });
