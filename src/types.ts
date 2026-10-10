export type ProductCategory = string;

export interface Product {
  id: string;
  sku: string;
  name: string;
  stock: number; // Kolom D: Stok Akhir
  price: number; // Kolom E: Harga Jual
  cost: number; // Kolom F: Harga Beli / HPP
  purchasePrice?: number;
  redPrice?: number; // Kolom G: HARGA jual MERAH
  totalAsset?: number; // Kolom H: TOTAL ASET
  category: string;
  minStockAlert?: number;
  rowNumber?: number;
}

export interface BarangMasukRecord {
  id: string; // Ref ID atau nomor baris
  date: string; // Kolom B: Tanggal (DD/MM/YYYY)
  sku: string; // Kolom C: SKU
  name: string; // Kolom D: Nama Produk
  krat?: number; // Kolom E: Qty/Krat
  qty: number; // Kolom F: Kuantitas Masuk
  supplier?: string; // Kolom G: Supplier (cth: 'orang tua')
  supplierOrNotes?: string; // Fallback / catatan
  cost: number; // Harga Beli / Modal
  totalCost?: number; // Kolom H: Total Biaya
  rowNumber?: number;
}

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  price: number;
  originalPrice?: number;
  regularPrice?: number; // Harga biasa dari katalog (Kolom E)
  redPrice?: number; // Harga jual merah / make up reseller (Kolom G)
  cost: number;
  qty: number;
  subtotal: number;
  total?: number;
  margin: number;
  note?: string;
  isRedPrice?: boolean; // Apakah saat ini menggunakan harga jual merah
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS';

export interface TransactionItem {
  productId?: string;
  sku?: string;
  name: string;
  category?: string; // Kolom F di LOG_PENJUALAN
  qty: number; // Kolom I di LOG_PENJUALAN
  price: number; // Kolom G: Harga Jual Satuan (aktif saat transaksi)
  regularPrice?: number; // Harga biasa / normal untuk penulisan di spreadsheet Google Sheets
  cost?: number; // Kolom H: Harga Beli Satuan (Modal)
  subtotal?: number; // Subtotal per item
  total: number; // Kolom J: Total Omzet
  margin: number; // Kolom K: Total Margin / Cuan
  isRedPrice?: boolean; // Penanda apakah item dibeli dengan harga merah
}

export interface TransactionReceipt {
  id: string;
  transactionDate: string; // 'dd/MM/yyyy HH:mm:ss'
  websiteTime?: string; // Jam input website 'HH:mm:ss' atau 'HH:mm'
  createdAt?: number; // Epoch timestamp saat kasir input transaksi
  date: string; // 'dd/MM/yyyy'
  dateYmd?: string; // 'yyyy-MM-dd' for sorting and grouping
  paymentMethod: PaymentMethod;
  items: TransactionItem[];
  totalQty: number;
  subtotal: number;
  discount: number;
  shippingFee?: number; // Ongkir / Biaya Pengiriman
  total: number;
  margin: number;
  cashReceived?: number;
  cashChange?: number;
  customerName?: string;
  cashier?: string;
  notes?: string;
  promoCode?: string;
  promoName?: string;
  status: 'COMPLETED' | 'VOIDED';
  voidReason?: string;
  isResellerMode?: boolean; // Mode harga merah / reseller aktif
}

export interface PromoRule {
  id: string;
  code: string;
  name: string;
  type: 'FIXED' | 'PERCENT';
  value: number; // Nominal Rupiah atau Persentase
  minOrder?: number;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface DailySummary {
  date: string;
  totalTransactions: number;
  totalOmset: number;
  totalMargin: number;
  totalQty: number;
  avgBasketSize: number;
  paymentBreakdown: {
    CASH: { count: number; total: number };
    TRANSFER: { count: number; total: number };
    QRIS: { count: number; total: number };
  };
}

export interface CashExpense {
  id: string;
  time: string;
  description: string;
  amount: number;
}

export interface ShiftRecord {
  id: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  startingCash: number;
  cashSales: number;
  expenses: CashExpense[];
  actualCash?: number;
  difference?: number;
  notes?: string;
  status: 'OPEN' | 'CLOSED';
}

export type ShiftReport = ShiftRecord;

export interface BrandConfig {
  NAME: string;
  SUBTITLE: string;
  DESCRIPTION_1: string;
  DESCRIPTION_2: string;
  PHONE: string;
}

export interface AppConfig {
  brand: BrandConfig;
  paymentMethods: PaymentMethod[];
  currency: string;
  timezone: string;
  webAppUrl?: string;
}

export type FinanceType = 'INCOME' | 'EXPENSE';

export type FinanceCategory = 
  | 'ONGKIR'            // Ongkir / Pengiriman (+ Uang Masuk)
  | 'TIPS'              // Tips & Tambahan Uang (+ Uang Masuk)
  | 'MODAL_LAIN'        // Modal / Pemasukan Lain (+ Uang Masuk)
  | 'BENSIN'            // Bensin (- Uang Keluar)
  | 'PEMBELIAN_STOK'   // Pembelian Stok / Operasional (- Uang Keluar)
  | 'OPERASIONAL'       // Biaya Operasional / Sewa / Listrik (- Uang Keluar)
  | 'PENGELUARAN_LAIN'; // Pengeluaran Lain (- Uang Keluar)

export interface FinanceRecord {
  id: string;
  date: string; // DD/MM/YYYY
  dateYmd: string; // YYYY-MM-DD
  dateTimeStr: string; // DD/MM/YYYY HH:mm
  type: FinanceType; // 'INCOME' (+) atau 'EXPENSE' (-)
  category: FinanceCategory | string;
  categoryLabel: string;
  unitPrice?: number; // Kolom C (Harga Satuan di sheet LAIN-LAIN)
  qty?: number; // Kolom D (Jumlah di sheet LAIN-LAIN)
  amount: number; // Kolom E (Total = Harga * Jumlah)
  description: string; // Kolom B (Keterangan di sheet LAIN-LAIN)
  paymentMethod?: string; // Kolom F (Dibayar dengan: BCA, CASH, GOPAY, JAGO)
  cashier?: string;
  notes?: string;
  rowNumber?: number; // Nomor baris di Google Sheets LAIN-LAIN
  syncStatus?: 'SYNCED' | 'LOCAL' | 'PENDING';
}

export interface SalesTarget {
  targetAmount: number;
  month: string; // YYYY-MM
  updatedAt?: string;
}

export interface LastUpdateInfo {
  timestamp: string; // ISO date string
  formatted: string; // e.g. "25/09/2026 17:15"
  source: 'GOOGLE_SHEETS' | 'POS' | 'LOCAL' | 'MANUAL';
  sourceLabel: string;
  details?: string;
  itemCounts?: {
    products?: number;
    transactions?: number;
    finances?: number;
    barangMasuk?: number;
  };
}

// Ringkasan hasil sinkronisasi data (dipakai untuk umpan balik di header).
export interface SyncSummary {
  time: string; // jam sinkron selesai, mis. "13:55"
  products: number;
  transactions: number;
  durationMs: number;
}
