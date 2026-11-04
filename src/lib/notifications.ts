/** Butir notifikasi pada lonceng bilah atas: pekerjaan yang menunggu tindakan pengguna (diturunkan dari data, bukan disimpan). */
export interface NotificationItem {
  id: string;
  label: string;
  /** Jumlah butir yang menunggu (selalu > 0 untuk butir yang ditampilkan). */
  count: number;
  /** Keterangan tambahan, mis. nilai rupiah. */
  detail?: string;
  href: string;
  tone: "red" | "amber" | "blue";
}
