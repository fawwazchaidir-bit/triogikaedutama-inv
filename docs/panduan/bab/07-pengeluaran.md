# Bab 7 — Pengeluaran

> **Peran:** Pelaksana ✔ ajukan, batalkan pengajuan sendiri · Finance Manager ✔ + setujui, tolak, balikkan

## 7.1 Alur

```
Pelaksana catat ──► Menunggu persetujuan ──► (Finance Manager) Setujui ──► Berlaku ──► (Finance Manager) Balikkan bila salah
                                      └─────► Tolak (alasan wajib) ──► Ditolak
```

Hanya entri berstatus **Berlaku** yang masuk saldo, buku kas, dan laporan.

## 7.2 Daftar pengeluaran

{{fig:exp-list}}

## 7.3 Mencatat pengeluaran (Pelaksana)

1. Klik **Catat pengeluaran**.
2. Pilih akun pembayar, kategori biaya, isi nominal, penerima, nomor bukti, dan keterangan.
3. Lampirkan bukti. **Wajib** bila nominal di atas Rp 1.000.000.
4. **Simpan**.

{{fig:exp-proof-required}}

{{fig:exp-new}}

{{fig:exp-pending}}

## 7.4 Persetujuan (Finance Manager)

{{fig:exp-list-fm}}

### Menyetujui

Periksa nominal, kategori, dan bukti. Pencatat tidak dapat menyetujui pengeluarannya sendiri.

{{fig:exp-approve-dialog}}

### Menolak

{{fig:exp-reject-dialog}}

## 7.5 Membalikkan pengeluaran berlaku (Finance Manager)

{{fig:exp-reverse-dialog}}

{{fig:exp-list-after}}

## Tips & Kesalahan Umum

- Pilih **kategori yang paling sesuai**; kategori menentukan posisi di laporan laba rugi (beban langsung program atau beban operasional).
- Foto nota harus jelas dan terbaca; nota buram adalah alasan penolakan paling umum.
- Salah input sebelum disetujui: **Batalkan** pengajuan lalu catat ulang. Setelah berlaku: minta Finance Manager membalikkan.
- Pengeluaran yang ditolak tidak pernah memengaruhi saldo.
