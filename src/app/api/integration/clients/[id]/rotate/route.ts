import { z } from "zod";
import { uuid } from "@/lib/validation/common";
import { readJson, route } from "@/server/http";
import { rotateApiClientSecret } from "@/server/services/integration-clients";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => rotateApiClientSecret(actor, uuid.parse(params.id), await readJson(req, z.unknown())));
