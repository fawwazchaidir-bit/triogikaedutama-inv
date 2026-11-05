import { describe, expect, it } from "vitest";
import {
  base32Decode, base32Encode, generateRecoveryCode, generateTotpSecret, hotp, looksLikeRecoveryCode, mfaEnrollmentRequired, normalizeRecoveryCode,
  otpauthUri, totpAt, totpStep, verifyTotp,
} from "@/lib/totp";

/** Vektor uji resmi RFC 6238 (Lampiran B), SHA-1, rahasia ASCII "12345678901234567890". */
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const RFC_VECTORS: [number, string][] = [
  [59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"],
];

describe("TOTP — vektor resmi RFC 6238", () => {
  it("rahasia RFC dalam base32 sesuai", () => expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"));
  it.each(RFC_VECTORS)("t=%i → %s (8 digit) dan %s (6 digit = 6 digit terakhir)", (t, eight) => {
    expect(totpAt(RFC_SECRET, t * 1000, 8)).toBe(eight);
    expect(totpAt(RFC_SECRET, t * 1000)).toBe(eight.slice(2));
  });
  it("HOTP RFC 4226 (Lampiran D): 10 kode pertama", () => {
    const k = Buffer.from("12345678901234567890");
    expect(Array.from({ length: 10 }, (_, i) => hotp(k, i))).toEqual(["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"]);
  });
});

describe("base32 (RFC 4648)", () => {
  it("vektor resmi (tanpa padding) & bolak-balik acak", () => {
    for (const [plain, enc] of [["", ""], ["f", "MY"], ["fo", "MZXQ"], ["foo", "MZXW6"], ["foob", "MZXW6YQ"], ["fooba", "MZXW6YTB"], ["foobar", "MZXW6YTBOI"]]) {
      expect(base32Encode(Buffer.from(plain!))).toBe(enc);
      expect(base32Decode(enc!).toString()).toBe(plain);
    }
    for (let i = 0; i < 50; i++) { const s = generateTotpSecret(); expect(base32Encode(base32Decode(s))).toBe(s); expect(s).toMatch(/^[A-Z2-7]{32}$/); }
  });
  it("toleran huruf kecil/spasi/strip/padding; menolak karakter asing", () => {
    expect(base32Decode("mzxw 6ytb-oi==").toString()).toBe("foobar");
    expect(() => base32Decode("MZXW1")).toThrow();
  });
});

describe("verifyTotp", () => {
  const now = 1_700_000_000_000;
  const at = (d: number) => totpAt(RFC_SECRET, now + d * 30_000);
  it("menerima langkah sekarang ±1; menolak ±2 dan seterusnya", () => {
    for (const d of [-1, 0, 1]) expect(verifyTotp(RFC_SECRET, at(d), { nowMs: now })).toEqual({ ok: true, step: totpStep(now) + d });
    for (const d of [-2, 2, -10, 10]) expect(verifyTotp(RFC_SECRET, at(d), { nowMs: now }).ok).toBe(false);
  });
  it("anti-replay: hanya langkah LEBIH BESAR dari lastStep yang sah", () => {
    const step = totpStep(now);
    expect(verifyTotp(RFC_SECRET, at(0), { nowMs: now, lastStep: step }).ok).toBe(false);       // kode yang sama dipakai lagi
    expect(verifyTotp(RFC_SECRET, at(-1), { nowMs: now, lastStep: step }).ok).toBe(false);      // lebih lama
    expect(verifyTotp(RFC_SECRET, at(1), { nowMs: now, lastStep: step })).toEqual({ ok: true, step: step + 1 });
    expect(verifyTotp(RFC_SECRET, at(0), { nowMs: now, lastStep: step - 1 }).ok).toBe(true);
  });
  it("toleran spasi; menolak format salah (panjang, huruf, kosong)", () => {
    const c = at(0);
    expect(verifyTotp(RFC_SECRET, `${c.slice(0, 3)} ${c.slice(3)}`, { nowMs: now }).ok).toBe(true);
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34", at(0) + "0"]) expect(verifyTotp(RFC_SECRET, bad, { nowMs: now }).ok).toBe(false);
  });
  it("rahasia lain menolak kode ini", () => expect(verifyTotp(generateTotpSecret(), at(0), { nowMs: now }).ok).toBe(false));
});

describe("otpauth URI", () => {
  it("memuat issuer, akun, rahasia, algoritma, digit, periode (dikodekan)", () => {
    const u = new URL(otpauthUri({ issuer: "Trilogika Edutama", account: "a+b@x.id", secret: "ABC234" }));
    expect(u.protocol).toBe("otpauth:");
    expect(u.host).toBe("totp");
    expect(decodeURIComponent(u.pathname)).toBe("/Trilogika Edutama:a+b@x.id");
    expect(Object.fromEntries(u.searchParams)).toEqual({ secret: "ABC234", issuer: "Trilogika Edutama", algorithm: "SHA1", digits: "6", period: "30" });
  });
});

describe("kode pemulihan", () => {
  it("format XXXXX-XXXXX tanpa karakter ambigu; acak (1000 kode unik)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) { const c = generateRecoveryCode(); expect(c).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/); set.add(c); }
    expect(set.size).toBe(1000);
  });
  it("normalisasi & pengenalan: huruf kecil, spasi, tanpa strip diterima; kode TOTP 6 digit bukan kode pemulihan", () => {
    expect(normalizeRecoveryCode(" abcde-fghjk ")).toBe("ABCDEFGHJK");
    expect(looksLikeRecoveryCode("abcde-fghjk")).toBe(true);
    expect(looksLikeRecoveryCode("ABCDEFGHJK")).toBe(true);
    for (const x of ["123456", "ABCDE-FGHIJ" /* I tidak ada di alfabet */, "ABCD", "ABCDE-FGHJKM", ""]) expect(looksLikeRecoveryCode(x)).toBe(false);
  });
});

describe("kewajiban 2FA per peran", () => {
  it("wajib hanya bila peran terdaftar DAN belum aktif", () => {
    expect(mfaEnrollmentRequired("FINANCE", false, ["ADMIN", "FINANCE"])).toBe(true);
    expect(mfaEnrollmentRequired("FINANCE", true, ["ADMIN", "FINANCE"])).toBe(false);
    expect(mfaEnrollmentRequired("STAFF", false, ["ADMIN", "FINANCE"])).toBe(false);
    expect(mfaEnrollmentRequired("ADMIN", false, [])).toBe(false);
  });
});
