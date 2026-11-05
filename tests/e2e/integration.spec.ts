import { expect, test, type APIRequestContext } from "@playwright/test";
import { login, logout } from "./helpers";
import { HEADER, signedHeaders } from "../../src/lib/integration/signing";

/** Kirim permintaan bertanda tangan ke server SUNGGUHAN (build produksi) — persis seperti yang dilakukan website/Portal. */
async function signedGet(request: APIRequestContext, keyId: string, secret: string, opts: { nonce?: string; now?: number } = {}) {
  const path = "/api/integration/v1/ping";
  return request.get(path, { headers: signedHeaders({ keyId, secret, method: "GET", path, ...opts }) });
}

test.describe("integrasi mesin-ke-mesin (UI admin + API bertanda tangan)", () => {
  test("Admin membuat kredensial → rahasia tampil sekali → API menerima permintaan bertanda tangan; replay, salah rahasia, jam melenceng ditolak; rotasi & pencabutan berlaku seketika", async ({ page, request }) => {
    await login(page, "admin");
    await page.goto("/settings?tab=integration");
    await expect(page.getByRole("heading", { name: "Integrasi sistem lain" })).toBeVisible();
    await expect(page.getByText("Belum ada kredensial.")).toBeVisible();

    // validasi di UI/server: nama kosong ditolak
    await page.getByRole("button", { name: "Buat kredensial" }).click();
    const dlg = page.getByRole("dialog", { name: "Buat kredensial" });
    await dlg.getByRole("button", { name: "Buat", exact: true }).click();
    await expect(dlg.getByRole("alert").first()).toBeVisible();

    await dlg.getByLabel("Nama").fill("Portal HRIS E2E");
    await dlg.getByRole("checkbox", { name: /reimbursements:write/ }).check();
    await dlg.getByRole("button", { name: "Buat", exact: true }).click();

    const shown = page.getByRole("dialog", { name: "Kredensial dibuat" });
    await expect(shown).toBeVisible();
    const keyId = await shown.getByTestId("api-key-id").inputValue();
    const secret = await shown.getByTestId("api-secret").inputValue();
    expect(keyId).toMatch(/^fmsk_[0-9a-f]{20}$/);
    expect(secret).toMatch(/^fmss_[A-Za-z0-9_-]{43}$/);
    await shown.getByRole("button", { name: "Saya sudah menyimpannya" }).click();

    // daftar tidak pernah menampilkan rahasia lagi
    const row = page.getByTestId(`client-${keyId}`);
    await expect(row).toContainText("Portal HRIS E2E");
    await expect(row).toContainText("reimbursements:write");
    await expect(row).toContainText("Aktif");
    await expect(page.locator("body")).not.toContainText(secret);

    // permintaan bertanda tangan diterima
    const ok = await signedGet(request, keyId, secret);
    expect(ok.status()).toBe(200);
    expect(ok.headers()["cache-control"]).toBe("no-store");
    expect((await ok.json()).data).toMatchObject({ ok: true, client: { name: "Portal HRIS E2E", keyId, scopes: ["reimbursements:write"] } });

    // anonim / rahasia salah / replay / jam melenceng
    expect((await request.get("/api/integration/v1/ping")).status()).toBe(401);
    expect((await signedGet(request, keyId, secret.slice(0, -1) + "x")).status()).toBe(401);
    const nonce = "e2e-replay-nonce-0001";
    expect((await signedGet(request, keyId, secret, { nonce })).status()).toBe(200);
    const replay = await signedGet(request, keyId, secret, { nonce });
    expect([replay.status(), (await replay.json()).error.code]).toEqual([401, "NONCE_REPLAYED"]);
    const skew = await signedGet(request, keyId, secret, { now: Date.now() - 10 * 60_000 });
    expect([skew.status(), (await skew.json()).error.code]).toEqual([401, "TIMESTAMP_SKEW"]);

    // kredensial tidak bisa dipakai lewat sesi browser & sebaliknya: endpoint admin menolak tanda tangan mesin
    const viaMachine = await request.get("/api/integration/clients", { headers: signedHeaders({ keyId, secret, method: "GET", path: "/api/integration/clients" }) });
    expect(viaMachine.status()).toBe(401);

    // rotasi tanpa tenggang: rahasia lama mati, baru hidup
    await row.getByRole("button", { name: "Rotasi rahasia" }).click();
    await page.getByRole("dialog", { name: /Rotasi rahasia/ }).getByRole("button", { name: "Rotasi", exact: true }).click();
    const rotated = page.getByRole("dialog", { name: "Rahasia baru" });
    const secret2 = await rotated.getByTestId("api-secret").inputValue();
    expect(secret2).not.toBe(secret);
    await rotated.getByRole("button", { name: "Saya sudah menyimpannya" }).click();
    expect((await signedGet(request, keyId, secret)).status()).toBe(401);
    expect((await signedGet(request, keyId, secret2)).status()).toBe(200);

    // ubah scope & batas lewat UI
    await row.getByRole("button", { name: "Ubah" }).click();
    const edit = page.getByRole("dialog", { name: "Ubah kredensial" });
    await edit.getByRole("checkbox", { name: /reimbursements:read/ }).check();
    await edit.getByLabel("Batas permintaan per menit").fill("60");
    await edit.getByRole("button", { name: "Simpan" }).click();
    await expect(row).toContainText("reimbursements:read");
    await expect(row).toContainText("60/menit");

    // pencabutan: alasan wajib; setelah dicabut langsung ditolak & tombol aksi hilang
    await row.getByRole("button", { name: "Cabut" }).click();
    const rv = page.getByRole("dialog", { name: /Cabut kredensial/ });
    await rv.getByRole("button", { name: "Cabut kredensial" }).click();
    await expect(rv.getByRole("alert").first()).toBeVisible(); // alasan kosong ditolak
    await rv.getByLabel("Alasan").fill("Selesai uji E2E");
    await rv.getByRole("button", { name: "Cabut kredensial" }).click();
    await expect(row).toContainText("Dicabut");
    await expect(row).toContainText("Selesai uji E2E");
    await expect(row.getByRole("button", { name: "Rotasi rahasia" })).toHaveCount(0);
    expect((await signedGet(request, keyId, secret2)).status()).toBe(401);

    // semua tercatat di audit log tanpa rahasia
    const logs = await (await page.request.get("/api/audit-logs?action=integration.client")).text();
    for (const a of ["create", "rotate", "update", "revoke"]) expect(logs).toContain(`integration.client.${a}`);
    expect(logs).not.toContain(secret2);
    expect(logs).not.toContain(secret);
  });

  test("hanya Administrator: Finance Manager & Staf tidak melihat tab Integrasi dan API admin menjawab 403", async ({ page }) => {
    for (const who of ["finance", "staff"] as const) {
      await login(page, who);
      await page.goto("/settings");
      await expect(page.getByRole("navigation", { name: "Bagian pengaturan" }).getByRole("link", { name: "Integrasi" })).toHaveCount(0);
      const r = await page.request.get("/api/integration/clients");
      expect(r.status()).toBe(403);
      const post = await page.request.post("/api/integration/clients", { headers: { Origin: "http://127.0.0.1:3100" }, data: { name: "Peretas", scopes: [] } });
      expect(post.status()).toBe(403);
      await logout(page);
    }
  });

  test("header autentikasi mesin tidak dikenali oleh endpoint pengguna biasa (tanpa sesi → 401)", async ({ request }) => {
    const r = await request.get("/api/dashboard", { headers: { [HEADER.key]: "fmsk_00000000000000000000", [HEADER.signature]: "0".repeat(64) } });
    expect(r.status()).toBe(401);
  });
});
