# Docs Automator

Aplikasi web untuk mengotomatisasi pengolahan dokumen Excel pengajuan barang.

## Deskripsi

Docs Automator memungkinkan pengguna untuk:
- Mengunggah file pengajuan Excel (satu file dengan banyak sheet, atau beberapa file sekaligus).
- Secara otomatis mendeteksi kolom serta baris data pada tabel.
- Mengatur konfigurasi kolom tambahan (seperti Dokumentasi, Harga Perolehan, Invoice, dll).
- Melihat pratinjau tabel dari setiap dokumen dan mengedit sel data secara langsung.
- Mengunduh hasilnya sebagai file Excel tunggal yang tergabung, dengan mempertahankan format visual dan gambar jika memungkinkan.

## Teknologi Utama

- **React.js** (Antarmuka Pengguna)
- **Tailwind CSS** (Pemformatan dan Gaya)
- **ExcelJS** & **xlsx-populate** (Pemrosesan dan Ekspor File Excel)
- **Framer Motion / Motion** (Animasi Antarmuka)
- **Lucide React** (Ikonografi)

## Struktur Folder Penting

- `src/App.jsx`: Komponen utama aplikasi, mengelola _state_ dokumen, antarmuka, dan logika _upload_ file.
- `src/utils/fileParser.js`: Logika untuk memproses/membaca file Excel dan mengekspor data kembali ke format Excel.
- `src/components/ui/how-it-works.jsx`: Komponen visual tutorial tata cara penggunaan aplikasi.

## Cara Menjalankan Proyek

### Persyaratan

- Node.js `20.19.0` atau lebih baru.
- Git untuk mengambil source code dari GitHub.

Periksa versi yang terpasang:

```bash
node --version
npm --version
```

### Menjalankan dari GitHub

1. Clone repository dan masuk ke folder proyek:

   ```bash
   git clone URL_REPOSITORY
   cd docs-automator-main
   ```

   Ganti `URL_REPOSITORY` dengan alamat repository GitHub yang dibagikan.

2. Instal dependency berdasarkan lockfile:

   ```bash
   npm ci
   ```

   Jangan menyalin folder `node_modules` dari komputer lain. Folder tersebut dibuat ulang oleh `npm ci`.

3. Jalankan development server:

   ```bash
   npm run dev
   ```

4. Buka alamat lokal yang ditampilkan di terminal, biasanya `http://localhost:5173`.

### Pemeriksaan sebelum digunakan

Jalankan perintah berikut setelah instalasi atau setelah menerima perubahan baru:

   ```bash
   npm run build
   ```

Untuk memeriksa warning dan error lint:

   ```bash
   npm run lint
   ```

### Catatan kolaborasi

- Perbedaan lokasi folder atau workspace tidak memengaruhi aplikasi.
- Proyek ini berjalan di browser dan tidak memerlukan database, backend, atau file `.env`.
- Pemrosesan file Excel dilakukan di komputer pengguna.
- Setelah melakukan perubahan, kirim source code serta `package.json` dan `package-lock.json` ke GitHub.
- Jangan mengirim `node_modules`, `dist`, atau file Excel yang berisi data rahasia.
- Setelah mengambil perubahan terbaru, jalankan kembali:

   ```bash
   npm ci
   npm run dev
   ```

Aplikasi siap digunakan setelah development server berjalan.
