# ORTUKILL POS

Aplikasi kasir (POS) ORTUKILL Kediri + integrasi Google Sheets.

## Fitur penting
- Transaksi kasir, stok, keuangan, shift, riwayat penjualan
- Sinkronisasi ke Google Sheets (Apps Script v3.5)
- Login PIN wajib - melindungi data penjualan dan keuangan
- VOID/hapus transaksi benar-benar menghapus barisnya di Google Sheets

## Environment variable (hosting cloud: AI Studio / Cloud Run / VPS)
| Variabel | Wajib | Keterangan |
|---|---|---|
| POS_PASSWORD | ya (cloud) | PIN/password login. Kalau diisi, password dari file diabaikan. |
| GAS_WEBAPP_URL | ya | URL Web App Google Apps Script (deployment v3.5) |
| GEMINI_API_KEY | opsional | untuk fitur AI |
| PORT | opsional | default 3000; Cloud Run mengisinya otomatis (8080) |

## Menjalankan lokal
```
pnpm install
pnpm build
NODE_ENV=production node dist/server.cjs
```
Buka http://localhost:3000
