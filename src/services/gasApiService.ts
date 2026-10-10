import { Product, TransactionReceipt, BarangMasukRecord, FinanceRecord } from '../types';
import { StorageService, classifyProduct } from './storageService';

// Hasil void/hapus transaksi dari Google Sheets.
// deletedRows = jumlah baris yang BENAR-BENAR terhapus (0 berarti tidak ada).
// reachable = apakah Apps Script sempat menjawab (false = jaringan/offline).
export interface VoidTransactionResult {
  success: boolean;
  message?: string;
  deletedRows?: number;
  reachable?: boolean;
  matchedRows?: number;
  totalDeleted?: number;
  deletedSalesRows?: number;
  deletedLainRows?: number;
  attemptedIds?: Array<{ transactionId: string; success: boolean; deletedRows: number; message?: string }>;
}

export interface GasDiagnosticResult {
  success: boolean;
  message?: string;
  spreadsheetName?: string;
  timezone?: string;
  availableSheets?: string[];
  configuredRanges?: {
    products: string;
    salesLog: string;
    barangMasuk: string;
    pengeluaranLain?: string;
  };
  sheetsStatus?: {
    productsSheetFound: boolean;
    productsSheetName: string;
    productsRowCount?: number;
    salesLogSheetFound: boolean;
    salesLogSheetName: string;
    salesLogRowCount?: number;
    barangMasukSheetFound?: boolean;
    barangMasukRowCount?: number;
    pengeluaranLainSheetFound?: boolean;
    pengeluaranLainRowCount?: number;
  };
  sampleProductsLoaded?: Product[];
  ready?: boolean;
}

export interface GasAllDataResponse {
  success: boolean;
  message?: string;
  timestamp?: string;
  products?: Product[];
  todayTransactions?: TransactionReceipt[];
  todaySummary?: any;
  salesHistory?: TransactionReceipt[];
  barangMasukList?: BarangMasukRecord[];
  pengeluaranLainList?: FinanceRecord[];
  diagnostics?: {
    productsCount: number;
    todayCount: number;
    totalSalesLogged: number;
    barangMasukCount?: number;
    pengeluaranLainCount?: number;
  };
}

export const DEFAULT_GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbz3ETMp4XjXq7Qi2zdGuMNr9EVjZGrU5UTuT6g93nXNH3SyZSmIa6sys4Jrd8nNAJFiAA/exec';

export class GasApiService {
  private static STORAGE_URL_KEY = 'ortukill_pos_gas_url_v2';
  private static STORAGE_PRIMARY_URL_KEY = 'ortukill_pos_primary_gas_url_v2';
  private static STORAGE_LAST_SYNC = 'ortukill_pos_last_sync_v2';

  // In-flight request lock & recent processed cache for frontend deduplication
  private static activeInFlightRequests = new Set<string>();
  private static recentProcessedKeys = new Set<string>();

  private static trackKeyProcessed(key: string) {
    this.recentProcessedKeys.add(key);
    setTimeout(() => {
      this.recentProcessedKeys.delete(key);
    }, 60000); // 60-second idempotency window
  }

  // Lepaskan kunci duplikasi transaksi (misal saat transaksi di-void atau dihapus)
  static releaseTransactionKey(trxId: string): void {
    const cleanId = String(trxId || '').replace(/^#/, '').trim();
    this.activeInFlightRequests.delete(`trx_${cleanId}`);
    this.recentProcessedKeys.delete(`trx_${cleanId}`);
    this.activeInFlightRequests.delete(`trx_${trxId}`);
    this.recentProcessedKeys.delete(`trx_${trxId}`);
  }

  // Get Primary Store URL (URL Utama Toko yang bisa dirubah-rubah)
  static getPrimaryStoreUrl(): string {
    const saved = localStorage.getItem(this.STORAGE_PRIMARY_URL_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
    return DEFAULT_GAS_WEBAPP_URL;
  }

  // Set / Change Primary Store URL (Simpan permanen di server & browser)
  static async setPrimaryStoreUrl(url: string): Promise<{ success: boolean; message?: string }> {
    const cleanUrl = (url && url.trim()) || DEFAULT_GAS_WEBAPP_URL;
    localStorage.setItem(this.STORAGE_PRIMARY_URL_KEY, cleanUrl);
    localStorage.setItem(this.STORAGE_URL_KEY, cleanUrl);

    try {
      const res = await fetch('/api/gas/set-primary-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryWebAppUrl: cleanUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err: any) {
      console.warn('Gagal menyimpan primary URL ke server backend, disimpan di browser:', err);
    }
    return { success: true, message: 'URL Utama Toko tersimpan di browser.' };
  }

  static getSavedWebAppUrl(): string {
    const saved = localStorage.getItem(this.STORAGE_URL_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
    const primary = this.getPrimaryStoreUrl();
    try {
      localStorage.setItem(this.STORAGE_URL_KEY, primary);
    } catch {
      // ignore
    }
    return primary;
  }

  static setSavedWebAppUrl(url: string): void {
    const finalUrl = (url && url.trim()) || this.getPrimaryStoreUrl();
    localStorage.setItem(this.STORAGE_URL_KEY, finalUrl);
  }

  static getLastSync(): string | null {
    return localStorage.getItem(this.STORAGE_LAST_SYNC);
  }

  static setLastSync(timeStr: string): void {
    localStorage.setItem(this.STORAGE_LAST_SYNC, timeStr);
  }

  // Get status from backend
  static async getStatus(): Promise<{ configured: boolean; webAppUrl: string; primaryWebAppUrl?: string; lastSynced?: string }> {
    try {
      const res = await fetch('/api/gas/status');
      if (res.ok) {
        const data = await res.json();
        const primaryToUse = (data.primaryWebAppUrl && data.primaryWebAppUrl.trim()) || this.getPrimaryStoreUrl();
        const urlToUse = (data.webAppUrl && data.webAppUrl.trim()) || primaryToUse;

        localStorage.setItem(this.STORAGE_PRIMARY_URL_KEY, primaryToUse);
        this.setSavedWebAppUrl(urlToUse);

        return {
          ...data,
          configured: true,
          webAppUrl: urlToUse,
          primaryWebAppUrl: primaryToUse,
        };
      }
    } catch {
      // Offline / fallback to local storage
    }
    const localPrimary = this.getPrimaryStoreUrl();
    const localUrl = this.getSavedWebAppUrl();
    return {
      configured: !!localUrl,
      webAppUrl: localUrl,
      primaryWebAppUrl: localPrimary,
      lastSynced: this.getLastSync() || undefined,
    };
  }

  // Save config & test
  static async configureWebAppUrl(webAppUrl: string, setAsPrimary = false): Promise<{ success: boolean; message: string; testResult?: any }> {
    this.setSavedWebAppUrl(webAppUrl);
    if (setAsPrimary) {
      localStorage.setItem(this.STORAGE_PRIMARY_URL_KEY, webAppUrl.trim());
    }

    try {
      const res = await fetch('/api/gas/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webAppUrl, setAsPrimary }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          message: setAsPrimary ? 'URL disimpan & ditetapkan sebagai URL Utama Toko.' : 'Konfigurasi tersimpan.',
          testResult: data.testResult,
        };
      }
    } catch (err: any) {
      console.warn('Backend proxy configure failed, saved to localStorage', err);
    }

    return {
      success: true,
      message: 'URL tersimpan secara lokal di browser.',
    };
  }

  // Test & diagnose Google Sheet connection
  static async testConnection(webAppUrl?: string): Promise<GasDiagnosticResult> {
    const targetUrl = webAppUrl || this.getSavedWebAppUrl();
    if (!targetUrl) {
      return { success: false, message: 'URL Google Apps Script belum diisi.' };
    }

    try {
      const res = await fetch('/api/gas/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webAppUrl: targetUrl }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback direct call if server is unreachable
    }

    // Direct fetch fallback
    try {
      const pingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=diagnose`;
      const direct = await fetch(pingUrl, { redirect: 'follow' });
      if (direct.ok) {
        return await direct.json();
      }
    } catch (e: any) {
      return { success: false, message: 'Gagal menghubungi Google Apps Script: ' + e.message };
    }

    return { success: false, message: 'Tidak dapat menghubungi server.' };
  }

  // Cek versi Apps Script yang benar-benar terpasang di Google Sheets.
  // Kalau yang terpasang masih versi lama (mis. v3.2), tombol void tidak akan
  // menghapus baris — jadi aplikasi perlu memberi tahu pengguna.
  static async checkScriptVersion(): Promise<{
    success: boolean;
    message?: string;
    installedVersion?: string | null;
    expectedVersion?: string;
    upToDate?: boolean;
  }> {
    try {
      const res = await fetch('/api/gas/ping');
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          message: data.message,
          installedVersion: data.installedVersion,
          expectedVersion: data.expectedVersion,
          upToDate: data.upToDate === true,
        };
      }
    } catch (err) {
      console.warn('Gagal cek versi Apps Script:', err);
    }
    return { success: false, message: 'Tidak bisa memeriksa versi Apps Script.' };
  }

  // Fetch ALL live data from Google Sheets and synchronize to local state
  static async fetchAndSyncAll(): Promise<GasAllDataResponse> {
    let result: GasAllDataResponse;

    try {
      const res = await fetch('/api/gas/fetch-all');
      if (res.ok) {
        result = await res.json();
      } else {
        const err = await res.json();
        throw new Error(err.message || 'Gagal memuat data dari spreadsheet');
      }
    } catch (serverErr: any) {
      // Fallback: direct GET request to Web App URL
      const webAppUrl = this.getSavedWebAppUrl();
      if (!webAppUrl) {
        throw new Error('Google Apps Script belum dikonfigurasi.');
      }

      const fetchUrl = `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}action=getAllData`;
      const direct = await fetch(fetchUrl, { redirect: 'follow' });
      if (!direct.ok) {
        throw new Error('Gagal mengambil data dari Google Apps Script: ' + serverErr.message);
      }
      result = await direct.json();
    }

    if (result && result.success) {
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      this.setLastSync(nowStr);

      // 1. Sync Products
      if (result.products && result.products.length > 0) {
        StorageService.saveProducts(result.products, 'GOOGLE_SHEETS', `Sinkronisasi Spreadsheet (${result.products.length} produk)`);
      }

      // 2. Sync Sales History & Today's Transactions (Berdasarkan Tanggal)
      if (result.salesHistory || result.todayTransactions) {
        const rawSales = result.salesHistory || [];
        const normalizedSales = this.normalizeSalesData(rawSales);
        const rawToday = result.todayTransactions || [];
        const normalizedToday = this.normalizeSalesData(rawToday);

        const todayMap = new Map(normalizedToday.map((t) => [t.id, t]));

        // Merge today into all
        const mergedMap = new Map<string, TransactionReceipt>();
        normalizedSales.forEach((t) => mergedMap.set(t.id, t));
        todayMap.forEach((t, id) => mergedMap.set(id, t));

        // PENTING: Pertahankan JAM INPUT WEBSITE ASLI agar tidak ditimpa/diacak Google
        const localExisting = StorageService.getTransactions();
        const localMap = new Map(localExisting.map((t) => [t.id, t]));

        mergedMap.forEach((sheetTrx, id) => {
          const local = localMap.get(id);
          if (local) {
            if (local.websiteTime) {
              sheetTrx.websiteTime = local.websiteTime;
            }
            if (local.createdAt) {
              sheetTrx.createdAt = local.createdAt;
            }
            if (local.transactionDate && local.transactionDate.includes(':') && !local.transactionDate.includes('00:00')) {
              sheetTrx.transactionDate = local.transactionDate;
            }
          } else if (!sheetTrx.websiteTime && sheetTrx.transactionDate && sheetTrx.transactionDate.includes(' ')) {
            const timePart = sheetTrx.transactionDate.split(' ')[1].replace(/\./g, ':');
            if (timePart !== '00:00' && timePart !== '00:00:00') {
              sheetTrx.websiteTime = timePart;
            }
          }
        });

        const finalTransactions = Array.from(mergedMap.values());
        // Urutkan transaksi secara konsisten berdasarkan tanggal & jam input website
        finalTransactions.sort((a, b) => {
          if (b.createdAt && a.createdAt && b.createdAt !== a.createdAt) {
            return b.createdAt - a.createdAt;
          }
          const dateComp = String(b.dateYmd || b.date || '').localeCompare(String(a.dateYmd || a.date || ''));
          if (dateComp !== 0) return dateComp;
          const timeA = a.websiteTime || (a.transactionDate?.includes(' ') ? a.transactionDate.split(' ')[1] : '');
          const timeB = b.websiteTime || (b.transactionDate?.includes(' ') ? b.transactionDate.split(' ')[1] : '');
          if (timeB && timeA && timeB !== timeA) {
            return timeB.localeCompare(timeA);
          }
          return b.id.localeCompare(a.id);
        });

        StorageService.saveTransactions(finalTransactions, 'GOOGLE_SHEETS', `Sinkronisasi ${finalTransactions.length} transaksi dari Spreadsheet`);
      }

      // 3. Sync LOG_BARANG_MASUK
      if (result.barangMasukList) {
        StorageService.saveBarangMasukList(result.barangMasukList);
      }

      // 4. Sync LAIN-LAIN (PENGELUARAN LAIN-LAIN)
      if (result.pengeluaranLainList) {
        StorageService.syncPengeluaranLainList(result.pengeluaranLainList);
      }

      StorageService.setLastUpdateInfo({
        source: 'GOOGLE_SHEETS',
        sourceLabel: 'Google Sheets',
        details: `Sinkronisasi Spreadsheet berhasil (${result.products?.length || 0} produk)`,
      });
    }

    return result;
  }

  // Push new transaction to Google Sheets
  // PENTING: Untuk penulisan di Google Sheets (LOG_PENJUALAN), wajib menggunakan harga biasa bukan harga jual merah!
  static async pushTransaction(trx: TransactionReceipt): Promise<{ success: boolean; message?: string }> {
    const lockKey = `trx_${trx.id}`;
    if (this.activeInFlightRequests.has(lockKey) || this.recentProcessedKeys.has(lockKey)) {
      console.warn(`[GasApiService Deduplication] Request untuk transaksi ${trx.id} diabaikan karena sedang/sudah dikirim.`);
      return { success: true, message: 'Transaksi sedang/sudah dikirim (Deduplicated).' };
    }

    this.activeInFlightRequests.add(lockKey);

    try {
      const webAppUrl = this.getSavedWebAppUrl();

      // Siapkan data transaksi khusus Google Sheets menggunakan HARGA BIASA
      const sheetItems = trx.items.map((item) => {
        const regularPrice = Number(item.regularPrice ?? item.price) || 0;
        const regularTotal = regularPrice * item.qty;
        const regularMargin = (regularPrice - (item.cost || 0)) * item.qty;

        return {
          ...item,
          price: regularPrice, // Harga Jual Biasa
          regularPrice: regularPrice,
          total: regularTotal,
          subtotal: regularTotal,
          margin: regularMargin,
        };
      });

      // PENTING: Jika ada diskon/promo, masukkan sebagai baris potongan PROMO-DISKON
      // agar kolom G (Total Penjualan) di Google Sheets klop 100% dengan omset kasir
      if (trx.discount && trx.discount > 0) {
        const promoSku = (trx.promoCode ? trx.promoCode.trim().toUpperCase() : 'PROMO-DISKON');
        const promoLabel = trx.promoName
          ? `PROMO: ${trx.promoName}`
          : 'POTONGAN PROMO / DISKON';

        sheetItems.push({
          productId: promoSku,
          sku: promoSku,
          name: promoLabel,
          price: -Math.abs(trx.discount),
          regularPrice: -Math.abs(trx.discount),
          qty: 1,
          total: -Math.abs(trx.discount),
          subtotal: -Math.abs(trx.discount),
          margin: -Math.abs(trx.discount),
        });
      }

      // ATURAN MUTLAK:
      // Biaya ongkir TIDAK BOLEH masuk ke sheet LOG_PENJUALAN.
      // Semua ongkir dialihkan dan dicatat langsung ke sheet LAIN-LAIN.

      const sheetSubtotal = sheetItems.reduce((sum, item) => sum + item.total, 0);
      const sheetTotal = sheetSubtotal;
      const sheetMargin = sheetItems.reduce((sum, item) => sum + item.margin, 0);

      const sheetsPayload = {
        ...trx,
        items: sheetItems,
        subtotal: sheetSubtotal,
        total: sheetTotal,
        margin: sheetMargin,
        customerName: trx.isResellerMode 
          ? `${trx.customerName || 'Reseller'} [Harga Merah]` 
          : trx.customerName,
      };

      // Sinkronisasi biaya ongkir ke sheet LAIN-LAIN secara otomatis
      if (trx.shippingFee && trx.shippingFee > 0) {
        const customerSuffix = trx.customerName ? ` (${trx.customerName})` : '';
        const ongkirDescription = `Ongkir Nota ${trx.id}${customerSuffix}`;
        
        this.pushPengeluaranLain({
          id: `ONGKIR-${trx.id}`,
          date: trx.date,
          description: ongkirDescription,
          unitPrice: trx.shippingFee,
          qty: 1,
          amount: trx.shippingFee,
          paymentMethod: (trx.paymentMethod || 'CASH').toUpperCase(),
          type: 'INCOME',
          category: 'ONGKIR',
          categoryLabel: 'Ongkir Pengiriman (+)',
          cashier: trx.cashier || 'Kasir',
        }).catch((err) => {
          console.warn('Gagal sinkronisasi ongkir ke sheet LAIN-LAIN:', err);
        });
      }

      // 1. Try server backend proxy
      try {
        const res = await fetch('/api/gas/transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetsPayload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            this.trackKeyProcessed(lockKey);
            return data;
          }
          // Jika server backend mengembalikan pesan error eksplisit dari Apps Script
          if (data && data.message) {
            return data;
          }
        }
      } catch (err) {
        console.warn('Backend proxy /api/gas/transaction failed:', err);
      }

      // 2. Direct fallback to Google Apps Script Web App
      if (webAppUrl) {
        try {
          const direct = await fetch(webAppUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'saveTransaction', transaction: sheetsPayload }),
          });
          if (direct.ok) {
            const result = await direct.json();
            if (result.success) {
              this.trackKeyProcessed(lockKey);
            }
            return result;
          }
        } catch (err: any) {
          console.warn('Direct GAS sync failed:', err);
          return { success: false, message: 'Koneksi ke Google Sheets gagal: ' + (err?.message || 'Error') };
        }
      }

      return { success: false, message: 'Google Apps Script belum dikonfigurasi atau belum terhubung.' };
    } finally {
      this.activeInFlightRequests.delete(lockKey);
    }
  }

  // Push record barang masuk to LOG_BARANG_MASUK (B4:H)
  static async pushBarangMasuk(entry: BarangMasukRecord): Promise<{ success: boolean; message?: string; updatedStock?: number; rowNumber?: number }> {
    const lockKey = `bm_${entry.sku}_${entry.date}_${entry.qty}_${entry.totalCost}`;
    if (this.activeInFlightRequests.has(lockKey) || this.recentProcessedKeys.has(lockKey)) {
      console.warn(`[GasApiService Deduplication] Barang masuk ${entry.sku} diabaikan karena sedang/sudah dikirim.`);
      return { success: true, message: 'Barang masuk sedang/sudah dikirim (Deduplicated).' };
    }

    this.activeInFlightRequests.add(lockKey);

    try {
      const webAppUrl = this.getSavedWebAppUrl();

      // 1. Try server backend proxy
      try {
        const res = await fetch('/api/gas/barang-masuk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            this.trackKeyProcessed(lockKey);
            return data;
          }
        }
      } catch (err) {
        console.warn('Backend proxy /api/gas/barang-masuk error:', err);
      }

      // 2. Direct fallback to Google Apps Script Web App
      if (webAppUrl) {
        try {
          const direct = await fetch(webAppUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'recordBarangMasuk', entry }),
          });
          if (direct.ok) {
            const data = await direct.json();
            if (data.success) this.trackKeyProcessed(lockKey);
            return data;
          }
        } catch (err: any) {
          console.warn('Direct GAS barang masuk failed:', err);
          return { success: false, message: 'Koneksi ke Google Sheets gagal: ' + (err?.message || 'Error') };
        }
      }

      return { success: false, message: 'Google Apps Script belum dikonfigurasi atau belum terhubung.' };
    } finally {
      this.activeInFlightRequests.delete(lockKey);
    }
  }

  // Push record pengeluaran lain to sheet LAIN-LAIN (A4:F)
  static async pushPengeluaranLain(entry: {
    id?: string;
    date?: string;
    description: string;
    unitPrice?: number;
    qty?: number;
    amount: number;
    paymentMethod?: string;
    type?: string;
    category?: string;
    categoryLabel?: string;
    cashier?: string;
    isExpense?: boolean;
    isIncome?: boolean;
  }): Promise<{ success: boolean; message?: string; rowNumber?: number; entry?: FinanceRecord }> {
    const entryId = entry.id || `fin_${entry.date || ''}_${entry.description}_${entry.amount}`;
    const lockKey = `fin_${entryId}`;

    if (this.activeInFlightRequests.has(lockKey) || this.recentProcessedKeys.has(lockKey)) {
      console.warn(`[GasApiService Deduplication] Finance record ${entryId} diabaikan karena sedang/sudah dikirim.`);
      return { success: true, message: 'Catatan keuangan sedang/sudah dikirim (Deduplicated).' };
    }

    this.activeInFlightRequests.add(lockKey);

    try {
      const webAppUrl = this.getSavedWebAppUrl();

      const isIncome = entry.type === 'INCOME' || entry.isIncome === true || entry.description.toUpperCase().includes('ONGKIR');
      const enrichedEntry = {
        ...entry,
        type: isIncome ? 'INCOME' : 'EXPENSE',
        isIncome,
        isExpense: !isIncome,
      };

      // 1. Try server backend proxy
      try {
        const res = await fetch('/api/gas/pengeluaran-lain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enrichedEntry),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            this.trackKeyProcessed(lockKey);
            return data;
          }
        }
      } catch (err) {
        console.warn('Backend proxy /api/gas/pengeluaran-lain error:', err);
      }

      // 2. Direct fallback to Google Apps Script Web App
      if (webAppUrl) {
        try {
          const direct = await fetch(webAppUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'recordPengeluaranLain', entry: enrichedEntry }),
          });
          if (direct.ok) {
            const data = await direct.json();
            if (data.success) this.trackKeyProcessed(lockKey);
            return data;
          }
        } catch (err: any) {
          console.warn('Direct GAS pengeluaran lain failed:', err);
          return { success: false, message: 'Koneksi ke Google Sheets gagal: ' + (err?.message || 'Error') };
        }
      }

      return { success: false, message: 'Google Apps Script belum dikonfigurasi atau belum terhubung.' };
    } finally {
      this.activeInFlightRequests.delete(lockKey);
    }
  }

  // PEMBERSIH DUPLIKAT DI SPREADSHEET (Action: cleanDuplicates)
  static async cleanUpDuplicatesInSheet(): Promise<{ success: boolean; message?: string; deletedSalesCount?: number; deletedLainCount?: number; deletedBMCount?: number; totalDeleted?: number }> {
    const webAppUrl = this.getSavedWebAppUrl();

    try {
      const res = await fetch('/api/gas/clean-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) return await res.json();
    } catch {
      // ignore
    }

    if (webAppUrl) {
      try {
        const direct = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'cleanDuplicates' }),
        });
        if (direct.ok) return await direct.json();
      } catch (err: any) {
        return { success: false, message: 'Gagal menghubungi Google Apps Script: ' + err.message };
      }
    }

    return { success: false, message: 'Google Apps Script belum dikonfigurasi atau terhubung.' };
  }

  // Fetch Pengeluaran Lain from sheet LAIN-LAIN
  static async fetchPengeluaranLain(): Promise<{ success: boolean; list?: FinanceRecord[]; message?: string }> {
    const webAppUrl = this.getSavedWebAppUrl();

    // 1. Try server backend proxy
    try {
      const res = await fetch('/api/gas/pengeluaran-lain');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.list && data.list.length > 0) {
            StorageService.syncPengeluaranLainList(data.list);
          }
          return data;
        }
      }
    } catch (err) {
      console.warn('Backend proxy /api/gas/pengeluaran-lain failed:', err);
    }

    // 2. Direct fallback
    if (webAppUrl) {
      try {
        const fetchUrl = `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}action=getPengeluaranLain`;
        const direct = await fetch(fetchUrl, { redirect: 'follow' });
        if (direct.ok) {
          const data = await direct.json();
          if (data.success && data.list && data.list.length > 0) {
            StorageService.syncPengeluaranLainList(data.list);
          }
          return data;
        }
      } catch (e: any) {
        return { success: false, message: 'Gagal mengambil data dari Google Apps Script: ' + e.message };
      }
    }

    return { success: false, message: 'Google Apps Script belum dikonfigurasi atau belum terhubung.' };
  }

  // Delete row in sheet LAIN-LAIN
  static async deletePengeluaranLain(rowNumber: number): Promise<{ success: boolean; message?: string }> {
    const webAppUrl = this.getSavedWebAppUrl();

    // 1. Try server backend proxy
    try {
      const res = await fetch('/api/gas/pengeluaran-lain/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowNumber }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Backend proxy /api/gas/pengeluaran-lain/delete error:', err);
    }

    // 2. Direct fallback
    if (webAppUrl) {
      try {
        const direct = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'deletePengeluaranLain', rowNumber }),
        });
        if (direct.ok) {
          return await direct.json();
        }
      } catch (err: any) {
        return { success: false, message: 'Gagal menghapus baris di Google Sheets: ' + err.message };
      }
    }

    return { success: false, message: 'Gagal menghapus baris di Google Sheets.' };
  }

  // Push stock update to Google Sheets
  static async pushStockUpdate(sku: string, delta: number, reason?: string): Promise<{ success: boolean; message?: string }> {
    const webAppUrl = this.getSavedWebAppUrl();
    if (!webAppUrl) return { success: false, message: 'Belum terhubung ke spreadsheet' };

    try {
      const res = await fetch('/api/gas/update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, delta, reason }),
      });
      if (res.ok) return await res.json();
    } catch {
      // direct
      try {
        const direct = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'updateStock', sku, delta, reason }),
        });
        if (direct.ok) return await direct.json();
      } catch (e) {
        console.warn(e);
      }
    }
    return { success: false, message: 'Gagal update stok ke spreadsheet' };
  }

  // Hitung berapa baris yang benar-benar terhapus dari jawaban Apps Script.
  // Versi lama membalas { success:false, matchedRows:0 }, versi generator membalas
  // { success:true, totalDeleted:0 } walau tidak menghapus apa pun — dua-duanya
  // berarti TIDAK ADA yang terhapus.
  static deletedRowsFrom(data: any): number {
    if (!data) return 0;
    const raw = data.deletedRows ?? data.matchedRows ?? data.totalDeleted ?? data.deletedSalesRows ?? 0;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  // Push void & hapus transaksi dari Google Sheets
  static async pushVoidTransaction(transactionId: string, reason?: string): Promise<VoidTransactionResult> {
    this.releaseTransactionKey(transactionId);
    const webAppUrl = this.getSavedWebAppUrl();

    try {
      const res = await fetch('/api/gas/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, reason: reason || 'Dibatalkan oleh kasir' }),
      });
      if (res.ok) {
        const data = await res.json();
        return { ...data, deletedRows: this.deletedRowsFrom(data), reachable: true };
      }
    } catch (err) {
      console.warn('Backend proxy /api/gas/void error:', err);
    }

    if (webAppUrl) {
      try {
        const direct = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'voidTransaction', transactionId, reason: reason || 'Dibatalkan oleh kasir' }),
        });
        if (direct.ok) {
          const data = await direct.json();
          return { ...data, deletedRows: this.deletedRowsFrom(data), reachable: true };
        }
      } catch (e) {
        console.warn('Direct GAS void failed:', e);
      }
    }

    return { success: false, deletedRows: 0, reachable: false, message: 'Google Apps Script belum terhubung atau offline.' };
  }

  // Hapus transaksi secara permanen dari Google Sheets
  static async deleteTransactionFromGas(transactionId: string, reason?: string): Promise<VoidTransactionResult> {
    this.releaseTransactionKey(transactionId);
    const webAppUrl = this.getSavedWebAppUrl();

    // Apps Script v3.2 hanya punya action voidTransaction, jadi backend memakai
    // jalur yang sama (dengan beberapa varian ID) untuk menghapus barisnya.
    try {
      const res = await fetch('/api/gas/delete-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, reason: reason || 'Dihapus permanen oleh kasir' }),
      });
      if (res.ok) {
        const data = await res.json();
        return { ...data, deletedRows: this.deletedRowsFrom(data), reachable: true };
      }
    } catch (err) {
      console.warn('Backend proxy /api/gas/delete-transaction error:', err);
    }

    // Fallback direct call ke Google Apps Script
    if (webAppUrl) {
      try {
        const direct = await fetch(webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'voidTransaction', transactionId, reason: reason || 'Dihapus permanen oleh kasir' }),
        });
        if (direct.ok) {
          const data = await direct.json();
          return { ...data, deletedRows: this.deletedRowsFrom(data), reachable: true };
        }
      } catch (e) {
        console.warn('Direct GAS delete failed:', e);
      }
    }

    return { success: false, deletedRows: 0, reachable: false, message: 'Google Apps Script belum terhubung atau offline.' };
  }

  // Uji coba Tulis dan Hapus di LOG_PENJUALAN secara langsung
  static async testWriteAndDeleteLogPenjualan(targetUrl?: string): Promise<{
    success: boolean;
    message: string;
    stage?: string;
    testId?: string;
    writeResult?: any;
    deleteResult?: any;
  }> {
    const url = (targetUrl || this.getSavedWebAppUrl() || '').trim();
    try {
      const res = await fetch('/api/gas/test-write-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webAppUrl: url }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      console.warn('Backend proxy /api/gas/test-write-delete error:', err);
    }

    if (url) {
      try {
        const direct = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'testWriteDelete' }),
        });
        if (direct.ok) {
          return await direct.json();
        }
      } catch (err: any) {
        return { success: false, message: 'Gagal menghubungi Apps Script: ' + err.message };
      }
    }

    return { success: false, message: 'Google Apps Script belum dikonfigurasi atau offline.' };
  }

  // Isi otomatis Kolom J (KATEGORI) di spreadsheet DASHBOARD_MUTASI_&_PROFIT
  static async fillCategoriesInSheet(): Promise<{ success: boolean; message?: string; count?: number }> {
    const webAppUrl = this.getSavedWebAppUrl();
    if (!webAppUrl) return { success: false, message: 'Belum terhubung ke spreadsheet.' };

    try {
      const res = await fetch('/api/gas/fill-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webAppUrl }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Direct call fallback
      try {
        const direct = await fetch(`${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}action=fillCategories`, {
          redirect: 'follow',
        });
        if (direct.ok) {
          return await direct.json();
        }
      } catch (err: any) {
        return { success: false, message: 'Gagal menjalankan auto-fill: ' + (err?.message || 'Error') };
      }
    }

    return { success: false, message: 'Gagal menghubungi server Apps Script.' };
  }

  // Normalisasi data transaksi agar selalu dikelompokkan berdasarkan tanggal penjualan
  static normalizeSalesData(rawList: TransactionReceipt[]): TransactionReceipt[] {
    if (!rawList || rawList.length === 0) return [];

    // Deteksi apakah format data lama (di mana t.id adalah SKU dan it.name adalah harga)
    const isOldFormat = rawList.some(
      (t) => !t.id.startsWith('TGL-') && t.items && t.items.some((it) => !isNaN(Number(it.name)) && Number(it.name) > 1000)
    );

    if (!isOldFormat) {
      return rawList.map((t) => ({
        ...t,
        status: t.status || 'COMPLETED',
        subtotal: t.subtotal ?? t.total ?? 0,
        discount: t.discount ?? 0,
        shippingFee: t.shippingFee ?? 0,
        items: (t.items || []).map((it) => ({
          ...it,
          productId: it.productId || it.sku || '-',
          sku: it.sku || '-',
          name: it.name || '-',
          price: Number(it.price) || 0,
          qty: Number(it.qty) || 1,
          total: Number(it.total) || (Number(it.price || 0) * Number(it.qty || 1)),
          subtotal: Number(it.subtotal || it.total) || (Number(it.price || 0) * Number(it.qty || 1)),
          margin: Number(it.margin) || 0,
        })),
      }));
    }

    const dateMap: Record<string, TransactionReceipt> = {};

    rawList.forEach((t) => {
      const dateStr = t.date || (t.transactionDate ? t.transactionDate.split(' ')[0] : 'Lainnya');
      const parts = dateStr.split('/');
      const dateYmd = parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : dateStr;
      const key = 'TGL-' + (dateYmd || dateStr);

      if (!dateMap[key]) {
        const pm = t.paymentMethod && !String(t.paymentMethod).startsWith('+') ? (t.paymentMethod as any) : 'CASH';
        dateMap[key] = {
          id: key,
          date: dateStr,
          dateYmd: dateYmd,
          transactionDate: t.transactionDate || dateStr,
          paymentMethod: pm,
          items: [],
          totalQty: 0,
          subtotal: 0,
          discount: 0,
          total: 0,
          margin: 0,
          customerName: t.paymentMethod && String(t.paymentMethod).startsWith('+') ? t.paymentMethod : '-',
          status: 'COMPLETED',
        };
      }

      (t.items || []).forEach((it) => {
        const actualSku = t.id;
        const actualName = isNaN(Number(it.sku)) ? it.sku || actualSku : it.name;
        const actualPrice = !isNaN(Number(it.name)) && Number(it.name) > 0 ? Number(it.name) : Number(it.price) || 0;
        const actualQty = !isNaN(Number(it.category)) && Number(it.category) > 0 ? Number(it.category) : Number(it.qty) || 1;
        const actualTotal = Number(it.price) || (actualPrice * actualQty);
        const actualCost = Number(it.cost) || 0;
        const actualMargin = Number(it.margin) || (actualTotal - (actualCost * actualQty));
        const cat = classifyProduct(actualSku, actualName);

        dateMap[key].items.push({
          productId: actualSku,
          sku: actualSku,
          name: actualName,
          category: cat,
          price: actualPrice,
          qty: actualQty,
          total: actualTotal,
          cost: actualCost,
          margin: actualMargin,
        });

        dateMap[key].totalQty += actualQty;
        dateMap[key].subtotal += actualTotal;
        dateMap[key].total += actualTotal;
        dateMap[key].margin += actualMargin;
      });
    });

    const result = Object.values(dateMap);
    result.sort((a, b) => String(b.dateYmd || b.date || '').localeCompare(String(a.dateYmd || a.date || '')));
    return result;
  }
}
