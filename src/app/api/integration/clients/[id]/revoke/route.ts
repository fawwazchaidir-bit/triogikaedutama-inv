import { z } from "zod";
import { uuid } from "@/lib/validation/common";
import { readJson, route } from "@/server/http";
import { revokeApiClient } from "@/server/services/integration-clients";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => revokeApiClient(actor, uuid.parse(params.id), await readJson(req, z.unknown())));
