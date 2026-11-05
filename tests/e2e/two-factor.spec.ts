import { expect, test, type Page } from "@playwright/test";
import { login, logout, openUserMenu, USERS } from "./helpers";
import { E2E_PASSWORD } from "./global-setup";
import { totpAt } from "../../src/lib/totp";

const ORIGIN = { Origin: "http://127.0.0.1:3100" };
/** Kode `n` langkah dari sekarang. Login memakai langkah SETELAH langkah enrol (kode yang sama tidak boleh dipakai dua kali). */
const code = (secret: string, n = 0) => totpAt(secret, Date.now() + n * 30_000);

async function startLogin(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test.describe("autentikasi dua langkah (TOTP)", () => {
  // Jaring pengaman: apa pun hasil tes, akun uji tidak boleh tertinggal ber-2FA (spec lain login sebagai pengguna yang sama).
  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, "admin");
    const users = (await (await page.request.get("/api/users")).json()).data as { id: string; email: string; twoFactorEnabled: boolean }[];
    for (const u of users.filter((x) => x.twoFactorEnabled && [USERS.finance, USERS.staff].includes(x.email as never))) {
      await page.request.post(`/api/users/${u.id}/reset-2fa`, { headers: ORIGIN, data: {} });
    }
    await page.close();
  });

  test("aktivasi lewat UI → kode pemulihan → login 2 langkah (kode salah ditolak) → login dengan kode pemulihan (sekali pakai) → nonaktifkan", async ({ page }) => {
    await login(page, "finance");
    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "Keamanan (2FA)" }).click();
    await expect(page).toHaveURL(/\/security/);
    await expect(page.getByRole("heading", { name: "Autentikasi dua langkah (2FA)" })).toBeVisible();
    await expect(page.getByText("Belum diaktifkan")).toBeVisible();

    // langkah 1: password wajib
    await page.getByRole("button", { name: "Aktifkan 2FA" }).click();
    await page.getByLabel("Password").fill("salah-salah-salah");
    await page.getByRole("button", { name: "Lanjut" }).click();
    await expect(page.getByText("Password salah.").first()).toBeVisible();
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Lanjut" }).click();

    // langkah 2: QR + kunci manual; kode salah ditolak, kode benar mengaktifkan
    await expect(page.getByTestId("totp-qr")).toBeVisible();
    const secret = ((await page.getByTestId("totp-secret").textContent()) ?? "").replace(/\s/g, "");
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    await page.getByLabel("Kode 6 digit").fill("000000");
    await page.getByRole("button", { name: "Aktifkan", exact: true }).click();
    await expect(page.getByText("Kode tidak cocok").first()).toBeVisible();
    await page.getByLabel("Kode 6 digit").fill(code(secret));
    await page.getByRole("button", { name: "Aktifkan", exact: true }).click();

    // kode pemulihan tampil SEKALI; "Selesai" terkunci sampai pengguna menyatakan sudah menyimpan
    const list = page.getByTestId("recovery-codes");
    await expect(list.locator("li")).toHaveCount(10);
    const recovery = await list.locator("li").allTextContents();
    expect(recovery.every((c) => /^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/.test(c))).toBe(true);
    await expect(page.getByRole("button", { name: "Selesai" })).toBeDisabled();
    await page.getByLabel("Saya sudah menyimpan kode ini di tempat aman.").check();
    await page.getByRole("button", { name: "Selesai" }).click();
    await expect(page.getByText(/Aktif sejak .* · 10 kode pemulihan tersisa/)).toBeVisible(); // tidak dipaksa pindah halaman bila bukan wajib
    await expect(page.getByRole("button", { name: "Nonaktifkan 2FA" })).toBeVisible();
    await page.goto("/dashboard");
    await logout(page);

    // login: password saja → langkah kedua; kode salah ditolak; kode benar masuk
    await startLogin(page, USERS.finance);
    await expect(page.getByLabel("Kode verifikasi")).toBeVisible();
    await expect(page).toHaveURL(/\/login/); // belum ada sesi
    expect((await page.request.get("/api/me")).status()).toBe(401);
    await page.getByLabel("Kode verifikasi").fill("000000");
    await page.getByRole("button", { name: "Verifikasi" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Kode salah atau sudah dipakai." })).toBeVisible();
    await page.getByLabel("Kode verifikasi").fill(code(secret, 1));
    await page.getByRole("button", { name: "Verifikasi" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await logout(page);

    // kode pemulihan: sekali pakai
    await startLogin(page, USERS.finance);
    await page.getByLabel("Kode verifikasi").fill(recovery[0]!);
    await page.getByRole("button", { name: "Verifikasi" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await logout(page);
    await startLogin(page, USERS.finance);
    await page.getByLabel("Kode verifikasi").fill(recovery[0]!);
    await page.getByRole("button", { name: "Verifikasi" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Kode salah atau sudah dipakai." })).toBeVisible();

    // "Kembali" mengembalikan ke langkah 1; nonaktifkan memakai password + kode pemulihan lain
    await page.getByRole("button", { name: "Kembali" }).click();
    await expect(page.getByLabel("Password")).toBeVisible();
    await startLogin(page, USERS.finance);
    await page.getByLabel("Kode verifikasi").fill(recovery[1]!);
    await page.getByRole("button", { name: "Verifikasi" }).click();
    await expect(page).toHaveURL(/\/dashboard/); // tunggu sesi terbentuk sebelum berpindah halaman
    await page.goto("/security");
    await expect(page.getByText(/8 kode pemulihan tersisa/)).toBeVisible();
    await page.getByRole("button", { name: "Nonaktifkan 2FA" }).click();
    await page.getByLabel("Password").fill(E2E_PASSWORD);
    await page.getByLabel("Kode 6 digit (atau kode pemulihan)").fill(recovery[2]!);
    await page.getByRole("button", { name: "Nonaktifkan", exact: true }).click();
    await expect(page.getByText("Belum diaktifkan")).toBeVisible();
    await page.goto("/dashboard");
    await logout(page);
    await startLogin(page, USERS.finance);
    await expect(page).toHaveURL(/\/dashboard/); // kembali ke login biasa
  });

  test("Administrator mereset 2FA akun lain lewat UI: sesi korban diakhiri, lencana hilang, korban masuk tanpa kode", async ({ page, browser }) => {
    // staf mengaktifkan 2FA lewat API (jalur yang sama dengan UI)
    const victim = await browser.newPage();
    await login(victim, "staff");
    const setup = await (await victim.request.post("/api/account/2fa/setup", { headers: ORIGIN, data: { password: E2E_PASSWORD } })).json();
    const en = await victim.request.post("/api/account/2fa/enable", { headers: ORIGIN, data: { code: code(setup.data.secret) } });
    expect(en.status()).toBe(200);
    expect(((await en.json()).data.recoveryCodes as string[]).length).toBe(10);
    await victim.goto("/dashboard"); // sesi diteruskan? tidak: sesi lain dicabut, sesi ini tetap
    expect((await victim.request.get("/api/me")).status()).toBe(200);

    await login(page, "admin");
    await page.goto("/settings?tab=users");
    const row = page.getByRole("row", { name: /staff@trilogika\.test/ });
    await expect(row.getByRole("button", { name: "Reset 2FA" })).toBeVisible(); // hanya akun ber-2FA yang memilikinya
    page.once("dialog", (d) => void d.accept());
    await row.getByRole("button", { name: "Reset 2FA" }).click();
    await expect(page.getByText("2FA direset.")).toBeVisible();
    await expect(row.getByRole("button", { name: "Reset 2FA" })).toHaveCount(0);

    expect((await victim.request.get("/api/me")).status()).toBe(401); // sesi korban dicabut
    await victim.close();
    const fresh = await browser.newPage();
    await startLogin(fresh, USERS.staff);
    await expect(fresh.getByLabel("Kode verifikasi")).toHaveCount(0);
    await expect(fresh).not.toHaveURL(/\/login/);
    await fresh.close();
  });

  test("keamanan akses: /security & API 2FA butuh login; akun sendiri tidak dapat direset; akses non-admin ke reset ditolak", async ({ page, request }) => {
    expect((await request.get("/api/account/2fa")).status()).toBe(401);
    await page.goto("/security");
    await expect(page).toHaveURL(/\/login/);
    await login(page, "finance");
    const me = (await (await page.request.get("/api/me")).json()).data as { id: string };
    expect((await page.request.post(`/api/users/${me.id}/reset-2fa`, { headers: ORIGIN, data: {} })).status()).toBe(403); // bukan Admin
    expect((await page.request.post("/api/account/2fa/enable", { headers: ORIGIN, data: { code: "123456" } })).status()).toBe(422); // belum memulai
    const st = (await (await page.request.get("/api/account/2fa")).json()).data;
    expect(st).toMatchObject({ available: true, enabled: false, required: false });
  });
});
