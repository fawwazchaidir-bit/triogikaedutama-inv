# Integrasi mesin-ke-mesin

Cara sistem lain (website pendaftaran Laravel, Trilogika Internal Portal/HRIS) memanggil Financial Management System secara aman.
Lapisan ini **hanya fondasi**: otentikasi, anti-replay, idempotensi, scope, batas laju, audit. Endpoint bisnis (pembayaran peserta,
reimbursement) ditambahkan di atasnya dan masing-masing mendapat scope sendiri.

## 1. Mengaktifkan

1. Buat kunci induk **sekali** di server: `openssl rand -hex 32`, isi `INTEGRATION_MASTER_KEY` pada environment aplikasi, jalankan ulang.
   Kosong = seluruh API mesin menjawab 503 dan pembuatan kredensial ditolak.
   **Jangan mengganti kunci ini** setelah kredensial dipakai: semua rahasia diturunkan darinya, jadi mengganti = semua kredensial harus dirotasi.
   Simpan di pengelola rahasia yang sama dengan `DATABASE_URL`; sertakan di prosedur backup *terpisah* dari backup database.
2. Masuk sebagai **Administrator** → Pengaturan → **Integrasi** → *Buat kredensial*: beri nama sistem pengirim, centang **scope** seperlunya
   (least privilege), opsional daftar IP dan batas per menit. Salin **Key ID** dan **Rahasia**; rahasia hanya tampil sekali.
3. Pasang keduanya di sistem pengirim (mis. `.env`), bukan di repository.

Rahasia **tidak disimpan** di database: `rahasia = "fmss_" + base64url(HMAC-SHA256(INTEGRATION_MASTER_KEY, "fms-api-secret:v1:<id>:<versi>"))`.
Kebocoran database saja tidak membocorkan rahasia; rotasi = menaikkan versi.

## 2. Spesifikasi permintaan (skema `FMS1-HMAC-SHA256`)

Alamat dasar: `https://<domain>/api/integration/v1`. Setiap permintaan membawa header:

| Header | Isi |
|---|---|
| `X-FMS-Key` | Key ID (`fmsk_` + 20 heksa) |
| `X-FMS-Timestamp` | Detik Unix saat ini (selisih dengan server ≤ 300 detik) |
| `X-FMS-Nonce` | 16–64 karakter `[A-Za-z0-9_-]`, **baru untuk setiap permintaan** |
| `X-FMS-Signature` | `hex(HMAC-SHA256(rahasia, string_kanonik))` |
| `Idempotency-Key` | **Wajib** untuk metode selain GET: 8–128 karakter `[A-Za-z0-9_.:-]`, stabil per *kejadian bisnis* (mis. `midtrans:<order_id>`) |
| `Content-Type` | `application/json` bila ada badan |

String kanonik (digabung dengan `\n`, tanpa baris tambahan di akhir):

```
FMS1-HMAC-SHA256
<METHOD huruf besar>
<PATH, mis. /api/integration/v1/ping>        ← tanpa host & query
<QUERY kanonik>                              ← pasangan nama=nilai, dikodekan RFC 3986, diurutkan menurut nama lalu nilai, digabung "&"; kosong bila tak ada
<TIMESTAMP>
<NONCE>
<sha256-heksa dari BADAN MENTAH>             ← byte persis yang dikirim; GET = sha256 string kosong
```

Hal yang sering salah: (a) tanda tangani **string badan yang sama persis** dengan yang dikirim (jangan serialisasi ulang JSON setelah menandatangani);
(b) kodekan spasi sebagai `%20`, bukan `+`; (c) kirim query dalam bentuk kanonik; (d) jangan menaruh prefiks path dari proxy ke dalam tanda tangan
— yang ditandatangani adalah path yang dilihat aplikasi.

**Vektor uji tetap** (harus sama di implementasi Anda; diverifikasi silang PHP, `openssl`, dan Node):

```
rahasia   : fmss_test-secret
POST /api/integration/v1/demo?b=2&a=1&a=%C3%A9%20%21        (nilai "é !")
timestamp : 1790000000      nonce: abcdefghijklmnop0123456789
badan     : {"nama":"Budi","jumlah":150000}
kanonik   : "FMS1-HMAC-SHA256\nPOST\n/api/integration/v1/demo\na=%C3%A9%20%21&a=1&b=2\n1790000000\nabcdefghijklmnop0123456789\ndd4f747734879562489488dc4a73adb1316fa50a188b0a14972434fb77093f86"
tanda tangan: a70c7bfcd6ecd57efd951934949329c4b5e1c770411ddb127afe47ac2be06501
```

Contoh klien siap pakai: [`docs/examples/fms-client.php`](examples/fms-client.php) (Laravel/PHP, tanpa dependensi) dan
[`docs/examples/fms-client.mjs`](examples/fms-client.mjs) (Node ≥ 18). Uji kredensial baru: `GET /api/integration/v1/ping`.

## 3. Respons & galat

Sukses: `{ "data": … }`. Galat: `{ "error": { "code", "message", "requestId", … } }`. Setiap respons membawa `X-Request-Id` (sertakan saat melapor masalah)
dan `Cache-Control: no-store`.

| Status | `code` | Arti & tindakan pengirim |
|---|---|---|
| 401 | `AUTH_FAILED` | Key tidak dikenal / dicabut / tanda tangan salah — **sengaja tidak dibedakan**. Periksa rahasia, badan mentah, path, query. Jangan ulangi tanpa perbaikan. |
| 401 | `TIMESTAMP_SKEW` | Jam pengirim melenceng > 300 dtk (`serverTime` ikut dikirim). Sinkronkan NTP. |
| 401 | `NONCE_REPLAYED` | Nonce sudah dipakai. Buat nonce baru *dan tanda tangan baru* untuk percobaan ulang. |
| 403 | `FORBIDDEN` / `FORBIDDEN_IP` | Scope kurang / IP tidak terdaftar. |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` / `_INVALID` | Header kunci idempotensi hilang atau salah format. |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | Permintaan berkunci sama sedang diproses. Tunggu `Retry-After` lalu kirim ulang. |
| 422 | `IDEMPOTENCY_KEY_REUSED` | Kunci sama dipakai untuk isi/path/query berbeda. |
| 413 | `PAYLOAD_TOO_LARGE` | Badan > 1 MB. |
| 429 | `RATE_LIMITED` | Lewati batas/menit atau terlalu banyak otentikasi gagal dari IP itu. Hormati `Retry-After`. |
| 503 | `INTEGRATION_DISABLED` | Server belum diberi `INTEGRATION_MASTER_KEY`. |
| 422/400/404/409 | `VALIDATION`, … | Galat bisnis dari endpoint; deterministik. |

**Percobaan ulang yang benar:** pakai `Idempotency-Key` yang SAMA, isi yang sama, nonce & tanda tangan BARU. Jawaban sebelumnya diputar ulang
(header `Idempotent-Replay: true`) tanpa menjalankan ulang. Galat 4xx bisnis ikut diputar ulang (deterministik); galat 5xx tidak disimpan sehingga boleh dicoba lagi.
Gunakan backoff eksponensial dengan jitter (mis. 2, 4, 8, 16 dtk, maks 5 kali) dan simpan kejadian yang gagal permanen di antrean pengirim untuk ditinjau manual.

## 4. Operasional

- **Rotasi** (Integrasi → *Rotasi rahasia*): pilih masa tenggang (0/15 menit/1 jam/24 jam) agar rahasia lama tetap sah sementara rahasia baru dipasang di pengirim.
  Rotasi dilakukan berkala (saran: tiap 6 bulan) dan segera bila ada dugaan kebocoran.
- **Pencabutan**: berlaku seketika dan tidak dapat dibatalkan (dijaga trigger database); buat kredensial baru bila perlu.
- **Daftar IP**: efektif bila server melihat IP asli pengirim (`TRUST_PROXY=true` di belakang proxy tepercaya). Bila IP tidak dapat ditentukan dan daftar diisi, permintaan ditolak.
- **Audit**: pembuatan/ubah/rotasi/pencabutan tercatat atas nama Administrator; perubahan data lewat API tercatat atas nama `api:<keyId>` beserta nama kredensial dan IP.
- **Pembersihan**: nonce > 1 hari dan kunci idempotensi selesai > 7 hari dihapus otomatis (oportunistik).
- **Pemantauan**: kolom *Terakhir dipakai* (waktu & IP) di halaman Integrasi; lonjakan 401/429 muncul di log aplikasi dengan `requestId`.

## 5. Untuk pengembang: menambah endpoint

```ts
// src/app/api/integration/v1/<nama>/route.ts
export const POST = machineRoute({ scope: "reimbursements:write" }, async ({ json, principal }) => {
  const input = json(schema);                       // badan mentah sudah diverifikasi tanda tangannya
  return created(await service(principal, input));  // pakai writeMachineAudit(tx, principal, …) di transaksi yang sama
});
```

Aturan: (1) scope baru didaftarkan di `src/lib/integration/scopes.ts` **bersama** endpoint-nya; (2) handler harus punya kunci unik alami
(mis. `order_id` unik di database) sebagai lapis kedua setelah idempotensi; (3) jangan membaca `req` lagi — pakai `rawBody`/`json`;
(4) jangan mengembalikan data di luar kebutuhan pemanggil; (5) tambahkan tes di `tests/integration/` dan perluas E2E.
