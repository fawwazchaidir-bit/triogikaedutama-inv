// Mengosongkan database TEST_DATABASE_URL lalu mengisi data demo bersih (seed-dev). Dipakai sebelum menjalankan shots.mjs.
import setup from "../../tests/e2e/global-setup.ts";
const fn = ((setup as unknown as { default?: () => Promise<void> }).default ?? setup) as () => Promise<void>;
await fn();
console.log("Data demo bersih siap.");
