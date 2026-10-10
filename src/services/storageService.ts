import { 
  Product, 
  TransactionReceipt, 
  AppConfig, 
  ShiftRecord, 
  DailySummary, 
  PaymentMethod, 
  BrandConfig, 
  BarangMasukRecord,
  PromoRule,
  FinanceRecord,
  SalesTarget,
  LastUpdateInfo
} from '../types';
import { 
  INITIAL_CONFIG, 
  INITIAL_PRODUCTS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_BARANG_MASUK, 
  INITIAL_FINANCE_RECORDS,
  INITIAL_SALES_TARGET
} from '../data/initialData';

const STORAGE_KEYS = {
  CONFIG: 'ortukill_pos_config_v1',
  PRODUCTS: 'ortukill_pos_products_v3',
  TRANSACTIONS: 'ortukill_pos_transactions_v2',
  TRANSACTIONS_LEGACY: 'ortukill_pos_transactions_v1',
  BARANG_MASUK: 'ortukill_pos_barang_masuk_v2',
  BARANG_MASUK_LEGACY: 'ortukill_pos_barang_masuk_v1',
  SHIFTS: 'ortukill_pos_shifts_v1',
  CURRENT_SHIFT: 'ortukill_pos_current_shift_v1',
  PROMOS: 'ortukill_pos_promos_v1',
  FINANCES: 'ortukill_pos_finances_v2',
  FINANCES_LEGACY: 'ortukill_pos_finances_v1',
  SALES_TARGET: 'ortukill_pos_sales_target_v1',
  LAST_UPDATE: 'ortukill_pos_last_update_v2',
  PURGE_FLAG: 'ortukill_pos_demo_purged_v2',
  DELETED_TRX: 'ortukill_pos_deleted_trx_v2',
};

// Daftar ID transaksi demo dari initialData untuk mencegah demo muncul kembali
const DEMO_TRANSACTION_IDS = new Set([
  'TRX-20260915-001',
  'TRX-20260915-002',
  'TRX-20260915-003',
  'TRX-20260320-1001',
  'TRX-20260320-1002',
  'TRX-20260322-1003',
  'TRX-20260322-1004',
  'TRX-20260323-1005',
  'TRX-20260324-1006',
  'TRX-20260325-1007',
  'TRX-20260325-1008',
]);

export const INITIAL_PROMOS: PromoRule[] = [
  {
    id: 'promo-5k',
    code: 'PROMO-5K',
    name: 'Diskon Langsung Rp 5.000',
    type: 'FIXED',
    value: 5000,
    minOrder: 0,
    description: 'Potongan Rp 5.000 tanpa minimal belanja',
    isActive: true,
  },
  {
    id: 'promo-10k',
    code: 'PROMO-10K',
    name: 'Promo Belanja Rp 10.000',
    type: 'FIXED',
    value: 10000,
    minOrder: 100000,
    description: 'Potongan Rp 10.000 untuk belanja min. Rp 100.000',
    isActive: true,
  },
  {
    id: 'promo-20k',
    code: 'PROMO-20K',
    name: 'Promo Sultan Rp 20.000',
    type: 'FIXED',
    value: 20000,
    minOrder: 200000,
    description: 'Potongan Rp 20.000 untuk belanja min. Rp 200.000',
    isActive: true,
  },
  {
    id: 'promo-member',
    code: 'MEMBER-5',
    name: 'Diskon Member Setia 5%',
    type: 'PERCENT',
    value: 5,
    minOrder: 0,
    description: 'Diskon 5% untuk pelanggan setia',
    isActive: true,
  },
  {
    id: 'promo-jumat',
    code: 'JUMAT-HEMAT',
    name: 'Jumat Santai Rp 15.000',
    type: 'FIXED',
    value: 15000,
    minOrder: 150000,
    description: 'Potongan Rp 15.000 untuk pembelian min. Rp 150.000',
    isActive: true,
  },
];

// Format utilities
export function formatRupiah(val: number | string): string {
  const num = typeof val === 'number' ? val : Number(val) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function normalizeDateToYmd(s: string): string {
  if (!s) return '';
  const clean = String(s).trim().split(' ')[0];
  const parts = clean.replace(/[/.]/g, '-').split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean;
}

export function isSameDay(date1: string, date2: string): boolean {
  if (!date1 || !date2) return false;
  if (date1 === date2) return true;
  return normalizeDateToYmd(date1) === normalizeDateToYmd(date2);
}

export function isDateToday(dateStr: string): boolean {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayYmd = `${y}-${m}-${d}`;
  return normalizeDateToYmd(dateStr) === todayYmd;
}

export function getTodayDateString(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

export function getFormattedNow(): { full: string; date: string; time: string } {
  const now = new Date();
  const date = getTodayDateString();
  const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return {
    full: `${date} ${time}`,
    date,
    time,
  };
}

/**
 * Otomatis mengelompokkan kategori menu ORTUKILL secara presisi
 * Berdasarkan SKU kode produk dan nama barang dari sheet
 */
export function classifyProduct(sku: string = '', name: string = ''): string {
  const s = (sku || '').trim().toUpperCase();
  const n = (name || '').trim().toUpperCase();

  // 1. Promo / Diskon
  if (s.startsWith('PROMO') || n.includes('PROMO') || n.includes('DISKON') || n.includes('VOUCHER')) {
    return 'PROMO';
  }

  // 2. Jamu / Herbal
  if (n.includes('BERAS KENCUR') || s.startsWith('BK-')) {
    return 'JAMU';
  }

  // 3. Soju
  if (
    s.startsWith('BSP-') || 
    s.startsWith('BSPM-') || 
    s.startsWith('BSL-') || 
    n.includes('SOJU') || 
    n.includes('BAE')
  ) {
    return 'SOJU';
  }

  // 4. Whisky
  if (
    s.startsWith('DWR') || 
    s.startsWith('DB7-') || 
    s.startsWith('DS3-') || 
    s.startsWith('MDKW-') ||
    n.includes('WHISKY') || 
    n.includes('DRUM')
  ) {
    return 'WHISKY';
  }

  // 5. Rum
  if (
    s.startsWith('CMS') || 
    n.includes('CAPTAIN MORGAN') || 
    n.includes('RUM')
  ) {
    return 'RUM';
  }

  // 6. Vodka
  if (
    s.startsWith('IVM-') || 
    s.startsWith('IS3R-') || 
    s.startsWith('IB5-') || 
    s.startsWith('IX7-') || 
    s.startsWith('ITO7-') || 
    s.startsWith('ITL7-') || 
    s.startsWith('IVO2-') || 
    s.startsWith('IVL2-') || 
    s.startsWith('MDKV') || 
    s.startsWith('MDV-') || 
    s.startsWith('FB-') || 
    s.startsWith('FBK-') || 
    s.startsWith('NR-') || 
    s.startsWith('NPG-') || 
    s.startsWith('NPIT-') ||
    n.includes('ICELAND') || 
    n.includes('VODKA') || 
    n.includes('NEW PORT') || 
    n.includes('NEWPORT') ||
    n.includes('FRIENDSHIP') ||
    n.includes('MC DONALD')
  ) {
    return 'VODKA';
  }

  // 7. Bir
  if (
    s.startsWith('PL-') || 
    s.startsWith('BP-') || 
    s.startsWith('SK5-') || 
    s.startsWith('PALM-') || 
    s.startsWith('PAL-') || 
    s.startsWith('KDS-') ||
    s.startsWith('SAJM-') || 
    s.startsWith('SA-OT-') || 
    s.startsWith('S-OT-') ||
    n.includes('PROST') || 
    n.includes('BINTANG') || 
    n.includes('PILSENER') || 
    n.includes('STOUT') || 
    n.includes('ALSTER') ||
    n.includes('KONIG') ||
    n.includes('SINGARAJA')
  ) {
    return 'BIR';
  }

  // 8. Anggur
  if (
    s.startsWith('AMG-') || 
    s.startsWith('AKKT-') || 
    s.startsWith('AP-') || 
    s.startsWith('AKH-') || 
    s.startsWith('IAG-') || 
    s.startsWith('AA-') || 
    s.startsWith('AABC-') || 
    s.startsWith('KKAM-') || 
    s.startsWith('KKAH-') || 
    s.startsWith('KKB-') ||
    s.startsWith('AAL-') || 
    s.startsWith('AARP-') || 
    s.startsWith('AAP-') || 
    s.startsWith('AAS-') || 
    s.startsWith('AL-A-') || 
    s.startsWith('AAH-') || 
    s.startsWith('AB-A-') ||
    n.includes('ANGGUR') || 
    n.includes('KOLESOM') || 
    n.includes('KETAN HITAM') || 
    n.includes('INTISARI') || 
    n.includes('KAWA KAWA') || 
    n.includes('ATLAS') || 
    n.includes('ALEXIS')
  ) {
    return 'ANGGUR';
  }

  return 'ANGGUR';
}

export function normalizeTransactionsByDate(rawList: TransactionReceipt[]): TransactionReceipt[] {
  if (!rawList || rawList.length === 0) return [];

  // Deteksi format lama di mana t.id adalah SKU produk, bukan tanggal atau nomor nota
  const isOldFormat = rawList.some(
    (t) => !t.id.startsWith('TGL-') && !t.id.startsWith('TRX-') && t.items && t.items.some((it) => !isNaN(Number(it.name)) && Number(it.name) > 1000)
  );

  if (!isOldFormat) {
    return rawList;
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

export class StorageService {
  // Config
  static getConfig(): AppConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to load config', e);
    }
    return INITIAL_CONFIG;
  }

  static getBrandConfig(): BrandConfig {
    return this.getConfig().brand;
  }

  static saveConfig(config: AppConfig): void {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }

  // Pastikan data demo statis awal tidak lagi memuat ulang transaksi palsu
  static ensureDemoPurged(): void {
    try {
      const isPurged = localStorage.getItem(STORAGE_KEYS.PURGE_FLAG);
      if (isPurged === 'true') return;

      // Cek dan bersihkan transaksi demo jika masih ada di browser
      const v2 = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const v1 = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS_LEGACY);

      let cleanTransactions: TransactionReceipt[] = [];
      const sourceStr = v2 || v1;
      if (sourceStr) {
        try {
          const parsed = JSON.parse(sourceStr);
          if (Array.isArray(parsed)) {
            cleanTransactions = parsed.filter(
              (t) => !DEMO_TRANSACTION_IDS.has(t.id) && !t.id?.startsWith('TRX-20260915-')
            );
          }
        } catch (e) {}
      }

      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(cleanTransactions));

      // Bersihkan catatan keuangan demo jika ada
      const fLegacy = localStorage.getItem(STORAGE_KEYS.FINANCES_LEGACY);
      const fV2 = localStorage.getItem(STORAGE_KEYS.FINANCES);
      const fSource = fV2 || fLegacy;
      let cleanFinances: FinanceRecord[] = [];
      if (fSource) {
        try {
          const parsedFin = JSON.parse(fSource);
          if (Array.isArray(parsedFin)) {
            cleanFinances = parsedFin.filter((f) => !f.id?.startsWith('FIN-00'));
          }
        } catch (e) {}
      }
      localStorage.setItem(STORAGE_KEYS.FINANCES, JSON.stringify(cleanFinances));

      // Bersihkan barang masuk demo
      const bmLegacy = localStorage.getItem(STORAGE_KEYS.BARANG_MASUK_LEGACY);
      const bmV2 = localStorage.getItem(STORAGE_KEYS.BARANG_MASUK);
      const bmSource = bmV2 || bmLegacy;
      let cleanBm: BarangMasukRecord[] = [];
      if (bmSource) {
        try {
          const parsedBm = JSON.parse(bmSource);
          if (Array.isArray(parsedBm)) {
            cleanBm = parsedBm.filter((b) => !b.id?.startsWith('BM-10'));
          }
        } catch (e) {}
      }
      localStorage.setItem(STORAGE_KEYS.BARANG_MASUK, JSON.stringify(cleanBm));

      localStorage.setItem(STORAGE_KEYS.PURGE_FLAG, 'true');
    } catch (e) {
      console.warn('ensureDemoPurged warning:', e);
    }
  }

  // Products - Memorized berdasarkan pembaruan terakhir
  static getProducts(): Product[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (stored !== null) {
        const parsed: Product[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize and categorize
          return parsed.map((p) => ({
            ...p,
            category: p.category && p.category !== 'PRODUK' ? p.category : classifyProduct(p.sku, p.name),
            cost: Number(p.cost) || 0,
            price: Number(p.price) || 0,
            stock: Number(p.stock) || 0,
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load products', e);
    }
    // Jika benar-benar pertama kali di browser, inisialisasi katalog sekali saja
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  }

  static saveProducts(products: Product[], source: 'GOOGLE_SHEETS' | 'POS' | 'LOCAL' = 'LOCAL', details?: string): void {
    const formatted = products.map((p) => ({
      ...p,
      category: p.category && p.category !== 'PRODUK' ? p.category : classifyProduct(p.sku, p.name),
    }));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(formatted));
    this.setLastUpdateInfo({
      source,
      sourceLabel: source === 'GOOGLE_SHEETS' ? 'Google Sheets' : 'Pembaruan Lokal',
      details: details || `Katalog produk diperbarui (${formatted.length} produk)`,
    });
  }

  static updateProductStock(idOrSku: string, newStockOrDelta: number, isDirectSet: boolean = true): Product[] {
    const products = this.getProducts();
    const updated = products.map((p) => {
      if (p.id === idOrSku || p.sku === idOrSku) {
        const stock = isDirectSet
          ? Math.max(0, newStockOrDelta)
          : Math.max(0, p.stock + newStockOrDelta);
        const totalAsset = stock * (p.cost || 0);
        return { ...p, stock, totalAsset };
      }
      return p;
    });
    this.saveProducts(updated, 'LOCAL', `Update stok ${idOrSku}: ${newStockOrDelta}`);
    return updated;
  }

  static addProduct(product: Omit<Product, 'id'>): Product[] {
    const products = this.getProducts();
    const cat = product.category || classifyProduct(product.sku, product.name);
    const newProd: Product = {
      ...product,
      id: product.sku || `PROD-${Date.now()}`,
      category: cat,
      totalAsset: (product.stock || 0) * (product.cost || 0),
    };
    const updated = [newProd, ...products];
    this.saveProducts(updated, 'LOCAL', `Tambah produk baru: ${newProd.name}`);
    return updated;
  }

  static updateProduct(product: Product): Product[] {
    const products = this.getProducts();
    const cat = product.category || classifyProduct(product.sku, product.name);
    const updatedProduct = {
      ...product,
      category: cat,
      totalAsset: (product.stock || 0) * (product.cost || 0),
    };

    const index = products.findIndex((p) => p.id === product.id || p.sku === product.sku);
    if (index >= 0) {
      products[index] = updatedProduct;
    } else {
      products.push(updatedProduct);
    }
    this.saveProducts(products, 'LOCAL', `Ubah produk: ${product.name}`);
    return products;
  }

  static deleteProduct(sku: string): Product[] {
    const products = this.getProducts().filter((p) => p.sku !== sku);
    this.saveProducts(products, 'LOCAL', `Hapus produk SKU ${sku}`);
    return products;
  }

  // Blacklist ID Transaksi yang sudah dihapus / di-void secara permanen
  static getDeletedTransactionIds(): Set<string> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DELETED_TRX);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {}
    return new Set<string>();
  }

  static markTransactionAsDeleted(trxId: string): void {
    if (!trxId) return;
    try {
      const deletedSet = this.getDeletedTransactionIds();
      deletedSet.add(trxId);
      deletedSet.add(trxId.replace(/^#/, ''));
      localStorage.setItem(STORAGE_KEYS.DELETED_TRX, JSON.stringify(Array.from(deletedSet)));
    } catch (e) {
      console.error(e);
    }
  }

  // Transactions - Memorized riil, TIDAK PERNAH memuat demo awal
  static getTransactions(): TransactionReceipt[] {
    this.ensureDemoPurged();
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (stored !== null) {
        const parsed: TransactionReceipt[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const deletedSet = this.getDeletedTransactionIds();
          const activeOnly = parsed.filter((t) => !deletedSet.has(t.id) && !deletedSet.has(t.id.replace(/^#/, '')));
          const normalized = normalizeTransactionsByDate(activeOnly);
          if (normalized !== parsed) {
            localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(normalized));
          }
          return normalized;
        }
      }
    } catch (e) {
      console.error('Failed to load transactions', e);
    }
    return [];
  }

  static saveTransactions(transactions: TransactionReceipt[], source: 'GOOGLE_SHEETS' | 'POS' | 'LOCAL' = 'LOCAL', details?: string): void {
    this.ensureDemoPurged();
    const deletedSet = this.getDeletedTransactionIds();
    // Filter transaksi yang sudah dihapus secara permanen
    const filtered = transactions.filter((t) => !deletedSet.has(t.id) && !deletedSet.has(t.id.replace(/^#/, '')));
    const normalized = normalizeTransactionsByDate(filtered);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(normalized));
    this.setLastUpdateInfo({
      source,
      sourceLabel: source === 'GOOGLE_SHEETS' ? 'Google Sheets' : source === 'POS' ? 'Kasir POS' : 'Update Lokal',
      details: details || `Memorize ${normalized.length} transaksi`,
    });
  }

  static generateTransactionId(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(100 + Math.random() * 900);
    return `TRX-${y}${m}${d}-${hh}${mm}${ss}-${random}`;
  }

  static saveTransaction(trx: TransactionReceipt): TransactionReceipt[] {
    const products = this.getProducts();
    const productMap = new Map(products.map((p) => [p.sku, p]));

    // Pastikan jam input website asli dan timestamp terekam sempurna
    if (!trx.websiteTime && trx.transactionDate && trx.transactionDate.includes(' ')) {
      trx.websiteTime = trx.transactionDate.split(' ')[1].replace(/\./g, ':');
    }
    if (!trx.createdAt) {
      trx.createdAt = Date.now();
    }

    // Ensure items have category, cost, and accurate margins
    const enrichedItems = trx.items.map((item) => {
      const prod = productMap.get(item.sku || '') || products.find((p) => p.id === item.productId);
      const cat = item.category || (prod ? prod.category : classifyProduct(item.sku || '', item.name));
      const cost = typeof item.cost === 'number' ? item.cost : (prod ? prod.cost : 0);
      const itemMargin = (item.price - cost) * item.qty;
      return {
        ...item,
        category: cat,
        cost,
        margin: itemMargin,
      };
    });

    const grossMargin = enrichedItems.reduce((sum, i) => sum + i.margin, 0);
    const discount = Number(trx.discount) || 0;
    const finalMargin = Math.max(0, grossMargin - discount);

    const enrichedTrx: TransactionReceipt = {
      ...trx,
      items: enrichedItems,
      margin: finalMargin,
    };

    const list = this.getTransactions();
    const updated = [enrichedTrx, ...list];
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));

    // Automatically record shipping fee as website income (+) if present
    if (trx.shippingFee && trx.shippingFee > 0) {
      try {
        this.saveFinanceRecord({
          id: `FIN-ONGKIR-${trx.id}`,
          type: 'INCOME',
          category: 'ONGKIR',
          categoryLabel: 'Ongkir Pengiriman (+)',
          amount: trx.shippingFee,
          description: `Ongkir Nota ${trx.id} (${trx.customerName || 'Pelanggan'})`,
          cashier: trx.cashier || 'Kasir Utama',
          date: trx.date,
        });
      } catch (e) {
        console.error('Failed to auto-record shipping fee', e);
      }
    }

    // Deduct stock locally from DASHBOARD_MUTASI_&_PROFIT
    enrichedTrx.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId || p.sku === item.sku);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.qty);
        prod.totalAsset = prod.stock * (prod.cost || 0);
      }
    });
    this.saveProducts(products, 'POS', `Stok dikurangi nota ${trx.id}`);

    this.setLastUpdateInfo({
      source: 'POS',
      sourceLabel: 'Kasir POS',
      details: `Transaksi ${trx.id} (${formatRupiah(trx.total)})`,
    });

    return updated;
  }

  static voidTransaction(trxId: string, reason: string): TransactionReceipt[] {
    const list = this.getTransactions();
    const products = this.getProducts();

    const updated = list.map((t) => {
      if (t.id === trxId && t.status !== 'VOIDED') {
        t.items.forEach((item) => {
          const prod = products.find((p) => p.id === item.productId || p.sku === item.sku);
          if (prod) {
            prod.stock += item.qty;
            prod.totalAsset = prod.stock * (prod.cost || 0);
          }
        });
        return {
          ...t,
          status: 'VOIDED' as const,
          voidReason: reason || 'Dibatalkan oleh kasir',
        };
      }
      return t;
    });

    this.saveProducts(products, 'POS', `Stok dikembalikan nota VOID ${trxId}`);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));

    this.setLastUpdateInfo({
      source: 'POS',
      sourceLabel: 'Void Transaksi',
      details: `Nota ${trxId} dibatalkan (VOID)`,
    });

    return updated;
  }

  static deleteTransaction(trxId: string, restoreStock = true): TransactionReceipt[] {
    this.markTransactionAsDeleted(trxId);
    const list = this.getTransactions();
    const products = this.getProducts();
    const target = list.find((t) => t.id === trxId);

    if (target && restoreStock && target.status !== 'VOIDED') {
      target.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId || p.sku === item.sku);
        if (prod) {
          prod.stock += item.qty;
          prod.totalAsset = prod.stock * (prod.cost || 0);
        }
      });
      this.saveProducts(products, 'POS', `Stok dikembalikan nota dihapus ${trxId}`);
    }

    const updated = list.filter((t) => t.id !== trxId);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));

    // Hapus juga catatan keuangan ongkir jika ada yang terikat nomor struk ini
    try {
      const finances = this.getFinanceRecords();
      const updatedFinances = finances.filter((f) => !f.description.includes(trxId));
      if (updatedFinances.length !== finances.length) {
        localStorage.setItem(STORAGE_KEYS.FINANCES, JSON.stringify(updatedFinances));
      }
    } catch (e) {}

    this.setLastUpdateInfo({
      source: 'POS',
      sourceLabel: 'Hapus Transaksi',
      details: `Nota ${trxId} dihapus permanen`,
    });

    return updated;
  }

  // Today's Transactions using flexible date matcher
  static getTodayTransactions(): TransactionReceipt[] {
    const all = this.getTransactions();
    return all.filter((t) => isDateToday(t.date));
  }

  static getDailySummary(): DailySummary {
    const todayList = this.getTodayTransactions().filter((t) => t.status !== 'VOIDED');
    const today = getTodayDateString();

    const paymentBreakdown: Record<PaymentMethod, { count: number; total: number }> = {
      CASH: { count: 0, total: 0 },
      TRANSFER: { count: 0, total: 0 },
      QRIS: { count: 0, total: 0 },
    };

    let totalOmset = 0;
    let totalMargin = 0;
    let totalQty = 0;

    todayList.forEach((t) => {
      totalOmset += t.total;
      totalMargin += t.margin || 0;
      totalQty += t.totalQty || 0;

      const method = t.paymentMethod;
      if (paymentBreakdown[method]) {
        paymentBreakdown[method].count += 1;
        paymentBreakdown[method].total += t.total;
      }
    });

    return {
      date: today,
      totalTransactions: todayList.length,
      totalOmset,
      totalMargin,
      totalQty,
      avgBasketSize: todayList.length > 0 ? Math.round(totalOmset / todayList.length) : 0,
      paymentBreakdown,
    };
  }

  // LOG_BARANG_MASUK (B4:H) - Memorized, tidak memuat demo
  static getBarangMasukList(): BarangMasukRecord[] {
    this.ensureDemoPurged();
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BARANG_MASUK);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  static saveBarangMasukList(list: BarangMasukRecord[]): void {
    this.ensureDemoPurged();
    localStorage.setItem(STORAGE_KEYS.BARANG_MASUK, JSON.stringify(list));
    this.setLastUpdateInfo({
      source: 'LOCAL',
      sourceLabel: 'Barang Masuk',
      details: `Catatan barang masuk disimpan (${list.length} data)`,
    });
  }

  static addBarangMasuk(entry: BarangMasukRecord): void {
    const list = this.getBarangMasukList();
    const updated = [entry, ...list.filter((b) => b.id !== entry.id)];
    this.saveBarangMasukList(updated);
  }

  static classifyProduct(sku: string = '', name: string = ''): string {
    return classifyProduct(sku, name);
  }

  static recordBarangMasuk(entry: Omit<BarangMasukRecord, 'id' | 'date'> & { id?: string; date?: string }): BarangMasukRecord {
    const list = this.getBarangMasukList();
    const { full } = getFormattedNow();
    const nowId = `BM-${Date.now().toString().slice(-6)}`;

    const newRecord: BarangMasukRecord = {
      id: entry.id || nowId,
      date: entry.date || full,
      sku: entry.sku,
      name: entry.name,
      qty: Number(entry.qty) || 0,
      cost: Number(entry.cost) || 0,
      supplierOrNotes: entry.supplierOrNotes || 'Restock Barang Masuk',
      totalCost: (Number(entry.qty) || 0) * (Number(entry.cost) || 0),
    };

    const updated = [newRecord, ...list];
    this.saveBarangMasukList(updated);

    // Also update product stock in DASHBOARD_MUTASI_&_PROFIT
    this.updateProductStock(entry.sku, newRecord.qty, false);

    this.setLastUpdateInfo({
      source: 'LOCAL',
      sourceLabel: 'Restock Barang',
      details: `Barang Masuk: ${newRecord.name} (+${newRecord.qty})`,
    });

    return newRecord;
  }

  // Shift & Cash Drawer
  static getCurrentShift(): ShiftRecord {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_SHIFT);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }

    const { full } = getFormattedNow();
    const newShift: ShiftRecord = {
      id: 'SHIFT-' + Date.now(),
      cashierName: 'Kasir ORTUKILL Kediri',
      startTime: full,
      startingCash: 200000,
      cashSales: 0,
      expenses: [],
      actualCash: 200000,
      difference: 0,
      status: 'OPEN',
    };
    localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(newShift));
    return newShift;
  }

  static updateShiftCashSales(amount: number): ShiftRecord {
    const shift = this.getCurrentShift();
    shift.cashSales += amount;
    localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(shift));
    return shift;
  }

  static addShiftExpense(description: string, amount: number): ShiftRecord {
    const shift = this.getCurrentShift();
    const { time } = getFormattedNow();
    shift.expenses = shift.expenses || [];
    shift.expenses.push({
      id: 'EXP-' + Date.now(),
      time,
      description,
      amount,
    });
    localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(shift));
    return shift;
  }

  static closeCurrentShift(actualCash: number, notes: string): ShiftRecord {
    const current = this.getCurrentShift();
    const { full } = getFormattedNow();
    const totalExpenses = (current.expenses || []).reduce((sum, e) => sum + e.amount, 0);
    const expected = current.startingCash + current.cashSales - totalExpenses;
    const difference = actualCash - expected;

    const closed: ShiftRecord = {
      ...current,
      endTime: full,
      actualCash,
      difference,
      notes,
      status: 'CLOSED',
    };

    const allShifts = this.getShiftHistory();
    allShifts.unshift(closed);
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(allShifts));
    localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(closed));

    return closed;
  }

  static startNewShift(startingCash: number, cashierName: string): ShiftRecord {
    const { full } = getFormattedNow();
    const newShift: ShiftRecord = {
      id: 'SHIFT-' + Date.now(),
      cashierName: cashierName || 'Kasir ORTUKILL',
      startTime: full,
      startingCash,
      cashSales: 0,
      expenses: [],
      actualCash: startingCash,
      difference: 0,
      status: 'OPEN',
    };
    localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(newShift));
    return newShift;
  }

  static getShiftHistory(): ShiftRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  // Promo Management
  static getPromos(): PromoRule[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROMOS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse promos:', e);
    }
    // Inisialisasi awal jika belum ada
    localStorage.setItem(STORAGE_KEYS.PROMOS, JSON.stringify(INITIAL_PROMOS));
    return INITIAL_PROMOS;
  }

  static savePromo(promo: PromoRule): PromoRule[] {
    const promos = this.getPromos();
    const existingIndex = promos.findIndex((p) => p.id === promo.id || (promo.code && p.code.toUpperCase() === promo.code.toUpperCase()));
    let updated: PromoRule[];

    if (existingIndex >= 0) {
      updated = [...promos];
      updated[existingIndex] = { ...updated[existingIndex], ...promo };
    } else {
      updated = [promo, ...promos];
    }

    localStorage.setItem(STORAGE_KEYS.PROMOS, JSON.stringify(updated));
    return updated;
  }

  static deletePromo(id: string): PromoRule[] {
    const promos = this.getPromos().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PROMOS, JSON.stringify(promos));
    return promos;
  }

  static togglePromo(id: string): PromoRule[] {
    const promos = this.getPromos().map((p) => 
      p.id === id ? { ...p, isActive: p.isActive === false ? true : false } : p
    );
    localStorage.setItem(STORAGE_KEYS.PROMOS, JSON.stringify(promos));
    return promos;
  }

  // Finance (Pemasukan & Pengeluaran Non-Penjualan) - Memorized, tidak memuat demo
  static getFinanceRecords(): FinanceRecord[] {
    this.ensureDemoPurged();
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.FINANCES);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load finance records', e);
    }
    return [];
  }

  static saveFinanceRecord(rec: Omit<FinanceRecord, 'id' | 'dateYmd' | 'dateTimeStr'> & { id?: string; date?: string; dateYmd?: string; dateTimeStr?: string }): FinanceRecord[] {
    const list = this.getFinanceRecords();
    const { full, date } = getFormattedNow();
    const entryDate = rec.date || date;
    const dateYmd = rec.dateYmd || normalizeDateToYmd(entryDate);

    const categoryMap: Record<string, string> = {
      ONGKIR: 'Ongkir Pengiriman (+)',
      TIPS: 'Tips & Bonus (+)',
      MODAL_LAIN: 'Modal / Pemasukan Lain (+)',
      BENSIN: 'Bensin Motor/Kendaraan (-)',
      PEMBELIAN_STOK: 'Pembelian Stok / Kulakan (-)',
      OPERASIONAL: 'Operasional Toko (-)',
      PENGELUARAN_LAIN: 'Pengeluaran Lain-Lain (-)',
    };

    const qty = Number(rec.qty) || 1;
    const unitPrice = rec.unitPrice !== undefined ? Number(rec.unitPrice) : Math.abs(Number(rec.amount) || 0) / qty;
    const amount = rec.amount !== undefined ? Math.abs(Number(rec.amount) || 0) : unitPrice * qty;

    const newRec: FinanceRecord = {
      id: rec.id || `FIN-${Date.now().toString().slice(-8)}`,
      date: entryDate,
      dateYmd: dateYmd,
      dateTimeStr: rec.dateTimeStr || `${entryDate} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
      type: rec.type,
      category: rec.category,
      categoryLabel: rec.categoryLabel || categoryMap[rec.category] || rec.category,
      unitPrice: unitPrice,
      qty: qty,
      amount: amount,
      description: rec.description || '',
      paymentMethod: (rec.paymentMethod || 'CASH').toUpperCase(),
      cashier: rec.cashier || 'Kasir Utama',
      notes: rec.notes || '',
      rowNumber: rec.rowNumber,
      syncStatus: rec.syncStatus || 'LOCAL',
    };

    const updated = [newRec, ...list.filter((f) => f.id !== newRec.id)];
    localStorage.setItem(STORAGE_KEYS.FINANCES, JSON.stringify(updated));

    this.setLastUpdateInfo({
      source: 'LOCAL',
      sourceLabel: 'Catatan Keuangan',
      details: `${newRec.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}: ${newRec.description} (${formatRupiah(amount)})`,
    });

    return updated;
  }

  // Sinkronisasi data dari sheet LAIN-LAIN (Google Sheets)
  static syncPengeluaranLainList(remoteList: FinanceRecord[]): FinanceRecord[] {
    if (!remoteList || remoteList.length === 0) {
      return this.getFinanceRecords();
    }

    const localList = this.getFinanceRecords();
    const mergedMap = new Map<string, FinanceRecord>();

    // 1. Masukkan remote items lebih dulu
    remoteList.forEach((r) => {
      const key = r.rowNumber ? `SHEET-ROW-${r.rowNumber}` : (r.id || `${r.date}-${r.description}-${r.amount}`);
      mergedMap.set(key, {
        ...r,
        syncStatus: 'SYNCED',
      });
    });

    // 2. Pertahankan local records yang belum ada di spreadsheet (misal pemasukan atau lokal baru)
    localList.forEach((loc) => {
      const hasMatch = remoteList.some(
        (rem) =>
          (loc.rowNumber && rem.rowNumber === loc.rowNumber) ||
          (loc.date === rem.date && loc.description === rem.description && loc.amount === rem.amount)
      );

      if (!hasMatch) {
        mergedMap.set(loc.id, loc);
      }
    });

    const result = Array.from(mergedMap.values());
    result.sort((a, b) => String(b.dateYmd || b.date || '').localeCompare(String(a.dateYmd || a.date || '')));

    localStorage.setItem(STORAGE_KEYS.FINANCES, JSON.stringify(result));
    return result;
  }

  static deleteFinanceRecord(id: string): FinanceRecord[] {
    const list = this.getFinanceRecords().filter((f) => f.id !== id);
    localStorage.setItem(STORAGE_KEYS.FINANCES, JSON.stringify(list));
    this.setLastUpdateInfo({
      source: 'LOCAL',
      sourceLabel: 'Hapus Keuangan',
      details: 'Catatan keuangan dihapus',
    });
    return list;
  }

  // Sales Target Bulanan
  static getSalesTarget(): SalesTarget {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SALES_TARGET);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load sales target', e);
    }
    localStorage.setItem(STORAGE_KEYS.SALES_TARGET, JSON.stringify(INITIAL_SALES_TARGET));
    return INITIAL_SALES_TARGET;
  }

  static saveSalesTarget(targetAmount: number, month?: string): SalesTarget {
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const newTarget: SalesTarget = {
      targetAmount: Math.max(0, Number(targetAmount) || 0),
      month: currentMonth,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.SALES_TARGET, JSON.stringify(newTarget));
    return newTarget;
  }

  // Memorize Base on Last Update State Management
  static getLastUpdateInfo(): LastUpdateInfo {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LAST_UPDATE);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}

    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    return {
      timestamp: now.toISOString(),
      formatted: `${d}/${m}/${y} ${time} WIB`,
      source: 'LOCAL',
      sourceLabel: 'Memorize Aktif',
      details: 'Menggunakan data pembaruan terakhir',
    };
  }

  static setLastUpdateInfo(info: Partial<LastUpdateInfo>): LastUpdateInfo {
    const current = this.getLastUpdateInfo();
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const updated: LastUpdateInfo = {
      timestamp: now.toISOString(),
      formatted: `${d}/${m}/${y} ${time} WIB`,
      source: info.source || current.source,
      sourceLabel: info.sourceLabel || (info.source === 'GOOGLE_SHEETS' ? 'Google Sheets' : info.source === 'POS' ? 'Kasir POS' : 'Update Lokal'),
      details: info.details || current.details || 'Pembaruan data kasir',
      itemCounts: {
        products: info.itemCounts?.products ?? (JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]')?.length || 0),
        transactions: info.itemCounts?.transactions ?? (JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]')?.length || 0),
        finances: info.itemCounts?.finances ?? (JSON.parse(localStorage.getItem(STORAGE_KEYS.FINANCES) || '[]')?.length || 0),
        barangMasuk: info.itemCounts?.barangMasuk ?? (JSON.parse(localStorage.getItem(STORAGE_KEYS.BARANG_MASUK) || '[]')?.length || 0),
      },
    };

    try {
      localStorage.setItem(STORAGE_KEYS.LAST_UPDATE, JSON.stringify(updated));
    } catch (e) {}

    return updated;
  }

  // Bersihkan data transaksi dan keuangan ke kondisi fresh (TIDAK menyuntikkan data demo palsu!)
  static resetToInitialData(): void {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.BARANG_MASUK, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.FINANCES, JSON.stringify([]));
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SHIFT);
    localStorage.removeItem(STORAGE_KEYS.SHIFTS);
    this.setLastUpdateInfo({
      source: 'LOCAL',
      sourceLabel: 'Data Dibersihkan',
      details: 'Data transaksi & catatan kasir dibersihkan (tanpa data demo)',
    });
  }
}
