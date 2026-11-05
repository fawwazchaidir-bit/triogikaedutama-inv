import { route } from "@/server/http";
import { getTwoFactorStatus } from "@/server/services/two-factor";

export const GET = route(({ actor }) => getTwoFactorStatus(actor), { allowMustChange: true, allowMfaSetup: true });
