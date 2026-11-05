import { z } from "zod";
import { uuid } from "@/lib/validation/common";
import { readJson, route } from "@/server/http";
import { updateApiClient } from "@/server/services/integration-clients";

export const PATCH = route<{ id: string }>(async ({ req, actor, params }) => updateApiClient(actor, uuid.parse(params.id), await readJson(req, z.unknown())));
