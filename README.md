# TrialAlgo

Trial Algo

## Menjalankan lokal

1. Buat file `.env.local` dan isi `DATABASE_URL` dengan connection string PostgreSQL.
2. Jalankan `npm run dev`.

## Deploy ke Vercel

Hubungkan repository ini ke Vercel dengan framework preset `Next.js`, lalu tambahkan environment variable berikut pada `Project Settings > Environment Variables`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

Gunakan connection string dari provider PostgreSQL yang mendukung koneksi dari Vercel. Build tidak membutuhkan koneksi database, tetapi route API membutuhkan `DATABASE_URL` saat runtime.
