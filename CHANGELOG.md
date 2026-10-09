# Catatan Perubahan

Dokumen ini mencatat perubahan proyek secara bertahap agar setiap perubahan dan error dapat dilacak.

## 2026-10-09 - Fondasi Draft HPS

### Perubahan

- Menambahkan `src/utils/hpsCalculator.js` untuk memetakan header RPD dan menghitung Draft HPS.
- Mendukung variasi header `Jumlah` atau `Volume`, harga referensi, ongkir, harga vendor, dan link sumber.
- Menetapkan faktor `1.2` sebagai default dan menerima faktor `1.7` sebagai opsi.
- Harga vendor langsung digunakan tanpa faktor pengali.
- Sumber yang mencantumkan `Quotation`, `Surat Penawaran`, `Vendor`, atau `Penyedia` diperlakukan sebagai harga vendor langsung ketika harga tersedia.
- Menambahkan tombol `Unduh Draft HPS` yang menghasilkan workbook terpisah dengan satu sheet per peneliti.
- Draft HPS memuat spesifikasi, volume, harga referensi, ongkir, metode harga, harga satuan HPS, jumlah HPS, dan link/vendor.
- Draft HPS diberi penanda `Belum diverifikasi oleh admin` dan tidak menggantikan file RPD asli.
- Menambahkan input pemeriksaan per baris untuk harga hasil cek admin dan ongkir.
- Menambahkan pilihan metode per baris: harga + ongkir x 1,2, harga + ongkir x 1,7, atau harga vendor langsung.
- Nilai yang diisi admin digunakan konsisten pada pratinjau dan ekspor Draft HPS; jika kosong, sistem memakai nilai RPD.
- Uji browser: mengisi harga cek Rp50.000 dan ongkir Rp10.000 untuk 16 unit menghasilkan Rp800.000 sebagai harga vendor langsung setelah metode dipilih.
- Uji browser: metode harga + ongkir x 1,2 menghasilkan Rp1.152.000 untuk nilai yang sama.
- Build berhasil dan lint selesai tanpa error; warning yang tersisa adalah warning lama di file sebelumnya serta warning ukuran bundle/dependency eksternal.
- Menyimpan rincian harga sumber, ongkir, faktor, harga satuan HPS, total HPS, sumber, dan peringatan validasi per baris.
- Memperbaiki ekspor satu file agar memproses setiap sheet yang telah diunggah, bukan mengharapkan `parsed.sheets` pada setiap item.
- Memilih worksheet berdasarkan `parsed.sheetName` saat menggabungkan beberapa file.

### Error yang ditemukan

- `TypeError: parsed.sheets is not iterable` terjadi karena aplikasi menyimpan satu item untuk setiap sheet, sementara fungsi ekspor menganggap setiap item masih memiliki kumpulan `sheets`.
- Referensi `prevCell` pada ekspor satu file belum dibuat di dalam loop data.

### Status verifikasi

- Build berhasil.
- Lint berhasil tanpa error, dengan warning lama pada kode yang belum terkait langsung dengan kalkulator.
- Uji browser menggunakan file RPD contoh berhasil memuat 6 sheet dan menampilkan Draft HPS.
- Uji pilihan faktor `1,2` dan `1,7` tersedia pada panel Draft HPS.
- Ekspor Draft HPS menggunakan nama file bertanggal dan menampilkan total per sheet.
- Uji browser berhasil menjalankan tombol `Unduh Draft HPS` dan menampilkan pesan `Draft HPS berhasil diunduh`.

## 2026-10-09 - Aturan Sumber Harga

### Perubahan

- INAPROC dikenali dari domain `inaproc.id` dan diperlakukan sebagai sumber harga langsung tanpa faktor.
- Sumber vendor dikenali dari link atau keterangan yang memuat `Quotation`, `Surat Penawaran`, `Invoice`, `Vendor`, atau `Penyedia`.
- Untuk INAPROC/vendor, sistem memprioritaskan nilai terbesar dari kolom `Harga Total dengan PPN`, `Total dengan PPN`, `Harga Total`, `Jumlah Harga`, atau `PPN`.
- Nilai langsung tersebut ditulis sama pada harga satuan dan jumlah HPS, tanpa dibagi atau dikalikan volume lagi.
- Jenis sumber `INAPROC`, `Vendor`, atau `E-commerce` ditampilkan pada pratinjau dan file Draft HPS.

### Status verifikasi

- Verifikasi build dan uji file contoh dilakukan setelah perubahan.
- Uji file RPD contoh: baris petunjuk kolom seperti `(1)`, `(2)`, dan seterusnya tidak lagi masuk sebagai barang.
- Uji sheet Dony: sumber `Quotation PT Taharica` dikenali sebagai `Vendor` dan nilai `PPN 11%` sebesar Rp41.971.916 dipakai langsung sebagai harga satuan dan jumlah HPS.
