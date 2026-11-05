import { z } from "zod";
import { created, readJson, route } from "@/server/http";
import { createApiClient, getIntegrationStatus, listApiClients } from "@/server/services/integration-clients";

export const GET = route(async ({ actor }) => ({ status: getIntegrationStatus(actor), clients: await listApiClients(actor) }));
export const POST = route(async ({ req, actor }) => created(await createApiClient(actor, await readJson(req, z.unknown()))));
