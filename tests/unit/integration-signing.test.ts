import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  HEADER, IDEMPOTENCY_KEY_PATTERN, KEY_ID_PATTERN, NONCE_PATTERN, canonicalQuery, canonicalString, safeEqualHex, sha256Hex, sign, signedHeaders,
} from "@/lib/integration/signing";
import { INTEGRATION_SCOPES, SCOPE_IDS, isScope } from "@/lib/integration/scopes";

/** Vektor emas: nilai ini TETAP dan diverifikasi silang dengan PHP, `openssl dgst`, dan klien Node contoh (docs/INTEGRATION.md). */
const VECTOR = {
  secret: "fmss_test-secret",
  input: { method: "post", path: "/api/integration/v1/demo", query: "b=2&a=1&a=%C3%A9 !", timestamp: 1790000000, nonce: "abcdefghijklmnop0123456789", body: '{"nama":"Budi","jumlah":150000}' },
  canonical: "FMS1-HMAC-SHA256\nPOST\n/api/integration/v1/demo\na=%C3%A9%20%21&a=1&b=2\n1790000000\nabcdefghijklmnop0123456789\ndd4f747734879562489488dc4a73adb1316fa50a188b0a14972434fb77093f86",
  signature: "a70c7bfcd6ecd57efd951934949329c4b5e1c770411ddb127afe47ac2be06501",
};

describe("tanda tangan permintaan mesin — vektor emas", () => {
  it("string kanonik & tanda tangan sesuai vektor tetap", () => {
    expect(canonicalString(VECTOR.input)).toBe(VECTOR.canonical);
    expect(sign(VECTOR.secret, VECTOR.input)).toBe(VECTOR.signature);
  });

  it("hash badan: kosong = sha256 string kosong; badan berbeda 1 byte → hash berbeda", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("{}")).not.toBe(sha256Hex("{} "));
  });

  const php = spawnSync("php", ["-v"]).status === 0;
  it.skipIf(!php)("implementasi PHP contoh menghasilkan tanda tangan yang IDENTIK (lintas bahasa)", () => {
    const r = spawnSync("php", ["-r", `require "docs/examples/fms-client.php"; echo fms_sign("${VECTOR.secret}","post","/api/integration/v1/demo",["b"=>"2","a"=>["1","é !"]],"1790000000","${VECTOR.input.nonce}",'${VECTOR.input.body}');`], { encoding: "utf8" });
    expect(r.stdout).toBe(VECTOR.signature);
  });
});

describe("query kanonik", () => {
  it("urut menurut nama lalu nilai; pengodean RFC 3986; kunci berulang dipertahankan", () => {
    expect(canonicalQuery("")).toBe("");
    expect(canonicalQuery("?b=2&a=1")).toBe("a=1&b=2");
    expect(canonicalQuery("a=2&a=1")).toBe("a=1&a=2");
    expect(canonicalQuery("q=a b")).toBe("q=a%20b");
    expect(canonicalQuery("q=a+b")).toBe("q=a%20b"); // "+" pada query = spasi (URLSearchParams)
    expect(canonicalQuery("q=!'()*")).toBe("q=%21%27%28%29%2A");
    expect(canonicalQuery("x=")).toBe("x=");
  });
  it("urutan parameter dari pengirim tidak memengaruhi tanda tangan", () => {
    const base = { method: "GET", path: "/p", timestamp: 1, nonce: "n".repeat(16) };
    expect(sign("s", { ...base, query: "a=1&b=2" })).toBe(sign("s", { ...base, query: "b=2&a=1" }));
  });
});

describe("setiap bagian permintaan terikat pada tanda tangan", () => {
  const base = { method: "POST", path: "/api/integration/v1/x", query: "a=1", timestamp: 1790000000, nonce: "abcdefghijklmnop", body: '{"a":1}' };
  const ref = sign("s3cret", base);
  const mutations: [string, Partial<typeof base>][] = [
    ["metode", { method: "PUT" }], ["path", { path: "/api/integration/v1/y" }], ["query", { query: "a=2" }],
    ["timestamp", { timestamp: 1790000001 }], ["nonce", { nonce: "abcdefghijklmnoq" }], ["badan", { body: '{"a":2}' }],
  ];
  it.each(mutations)("mengubah %s mengubah tanda tangan", (_n, patch) => {
    expect(sign("s3cret", { ...base, ...patch })).not.toBe(ref);
  });
  it("rahasia berbeda → tanda tangan berbeda; metode tidak peka huruf besar/kecil", () => {
    expect(sign("lain", base)).not.toBe(ref);
    expect(sign("s3cret", { ...base, method: "post" })).toBe(ref);
  });
  it("tidak ada tabrakan antar-bidang (pergeseran batas path/query/nonce tidak menghasilkan tanda tangan sama)", () => {
    expect(sign("s", { ...base, path: "/a", query: "b=1" })).not.toBe(sign("s", { ...base, path: "/a?b=1", query: "" }));
    expect(sign("s", { ...base, nonce: "abcdefghijklmnop", timestamp: 1 })).not.toBe(sign("s", { ...base, nonce: "1abcdefghijklmnop", timestamp: "" }));
  });
});

describe("perbandingan & pola", () => {
  it("safeEqualHex: waktu-konstan, tidak melempar pada panjang/format salah", () => {
    const a = "a".repeat(64);
    expect(safeEqualHex(a, a)).toBe(true);
    expect(safeEqualHex(a, "b".repeat(64))).toBe(false);
    expect(safeEqualHex(a, "a".repeat(63))).toBe(false);
    expect(safeEqualHex(a, "z".repeat(64))).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
  it("pola key id / nonce / idempotency key", () => {
    expect(KEY_ID_PATTERN.test("fmsk_0123456789abcdef0123")).toBe(true);
    for (const bad of ["fmsk_XYZ", "fmsk_0123456789abcdef012", "FMSK_0123456789abcdef0123", "fmsk_0123456789abcdef01234"]) expect(KEY_ID_PATTERN.test(bad)).toBe(false);
    expect(NONCE_PATTERN.test("a".repeat(16))).toBe(true);
    expect(NONCE_PATTERN.test("a".repeat(15))).toBe(false);
    expect(NONCE_PATTERN.test("a".repeat(65))).toBe(false);
    expect(NONCE_PATTERN.test("abc def ghijklmnop")).toBe(false);
    expect(IDEMPOTENCY_KEY_PATTERN.test("midtrans:order-123")).toBe(true);
    expect(IDEMPOTENCY_KEY_PATTERN.test("pendek")).toBe(false);
    expect(IDEMPOTENCY_KEY_PATTERN.test("a b c d e f g h")).toBe(false);
  });
  it("signedHeaders menghasilkan header lengkap yang cocok dengan tanda tangan; nonce selalu baru", () => {
    const i = { method: "GET", path: "/api/integration/v1/ping", timestamp: 1790000000 as number, nonce: "n".repeat(20) };
    const h = signedHeaders({ keyId: "fmsk_0123456789abcdef0123", secret: "s", ...i });
    expect(h[HEADER.key]).toBe("fmsk_0123456789abcdef0123");
    expect(h[HEADER.signature]).toBe(sign("s", i));
    const a = signedHeaders({ keyId: "k", secret: "s", method: "GET", path: "/" }), b = signedHeaders({ keyId: "k", secret: "s", method: "GET", path: "/" });
    expect(a[HEADER.nonce]).not.toBe(b[HEADER.nonce]);
    expect(NONCE_PATTERN.test(a[HEADER.nonce]!)).toBe(true);
  });
  it("katalog scope konsisten", () => {
    expect(SCOPE_IDS).toEqual(Object.keys(INTEGRATION_SCOPES));
    expect(isScope("reimbursements:write")).toBe(true);
    expect(isScope("admin:*")).toBe(false);
  });
});
