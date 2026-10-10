import React, { useState } from 'react';
import { 
  PlusCircle, 
  MinusCircle, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Fuel, 
  Truck, 
  Gift, 
  ShoppingBag, 
  Building2, 
  MoreHorizontal, 
  Calendar, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  RefreshCw,
  FileSpreadsheet,
  Check,
  CreditCard,
  Banknote,
  SendHorizontal
} from 'lucide-react';
import { FinanceRecord, FinanceType, FinanceCategory } from '../types';
import { formatRupiah, getFormattedNow } from '../services/storageService';
import { GasApiService } from '../services/gasApiService';

interface FinanceManagementViewProps {
  financeRecords: FinanceRecord[];
  onAddRecord: (record: Omit<FinanceRecord, 'id' | 'dateYmd' | 'dateTimeStr'>) => Promise<void> | void;
  onDeleteRecord: (id: string, rowNumber?: number) => Promise<void> | void;
  onSyncSpreadsheet?: () => void;
  isSyncing?: boolean;
}

export const FinanceManagementView: React.FC<FinanceManagementViewProps> = ({
  financeRecords,
  onAddRecord,
  onDeleteRecord,
  onSyncSpreadsheet,
  isSyncing = false,
}) => {
  const [type, setType] = useState<FinanceType>('EXPENSE');
  const [category, setCategory] = useState<FinanceCategory>('PENGELUARAN_LAIN');
  
  // Kolom Sheet LAIN-LAIN: Tanggal (A), Keterangan (B), Harga (C), Jumlah (D), Total (E), Dibayar dengan (F)
  const todayFormatted = getFormattedNow().date; // DD/MM/YYYY
  const [entryDate, setEntryDate] = useState<string>(todayFormatted);
  const [description, setDescription] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [cashier, setCashier] = useState<string>('Kasir Utama');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  
  // Syncing & UI feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPullingSheet, setIsPullingSheet] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, toastType: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type: toastType });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Payment method options from screenshot Column H (BCA, CASH, GOPAY, JAGO)
  const paymentMethodOptions = [
    { value: 'BCA', label: 'BCA', bg: 'bg-blue-600 text-white hover:bg-blue-700', activeRing: 'ring-blue-500', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    { value: 'CASH', label: 'CASH', bg: 'bg-emerald-600 text-white hover:bg-emerald-700', activeRing: 'ring-emerald-500', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { value: 'GOPAY', label: 'GOPAY', bg: 'bg-sky-500 text-white hover:bg-sky-600', activeRing: 'ring-sky-500', badge: 'bg-sky-100 text-sky-800 border-sky-200' },
    { value: 'JAGO', label: 'JAGO', bg: 'bg-purple-600 text-white hover:bg-purple-700', activeRing: 'ring-purple-500', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
    { value: 'QRIS', label: 'QRIS', bg: 'bg-stone-700 text-white hover:bg-stone-800', activeRing: 'ring-stone-600', badge: 'bg-stone-100 text-stone-800 border-stone-300' },
  ];

  const categoryOptions = type === 'EXPENSE' ? [
    { value: 'PENGELUARAN_LAIN', label: 'Pengeluaran Lain-Lain', icon: MoreHorizontal, color: 'text-stone-600 bg-stone-100' },
    { value: 'BENSIN', label: 'Bensin Motor / Kendaraan', icon: Fuel, color: 'text-amber-600 bg-amber-50' },
    { value: 'OPERASIONAL', label: 'Operasional & Perlengkapan', icon: Building2, color: 'text-blue-600 bg-blue-50' },
    { value: 'PEMBELIAN_STOK', label: 'Pembelian Stok / Kulakan', icon: ShoppingBag, color: 'text-purple-600 bg-purple-50' },
  ] : [
    { value: 'ONGKIR', label: 'Ongkir Pengiriman (+)', icon: Truck, color: 'text-emerald-600 bg-emerald-50' },
    { value: 'TIPS', label: 'Tips & Bonus (+)', icon: Gift, color: 'text-[#FF5E36] bg-[#FFF2ED]' },
    { value: 'MODAL_LAIN', label: 'Modal / Pemasukan Lain (+)', icon: Wallet, color: 'text-cyan-600 bg-cyan-50' },
  ];

  const handleTypeChange = (newType: FinanceType) => {
    setType(newType);
    if (newType === 'EXPENSE') {
      setCategory('PENGELUARAN_LAIN');
    } else {
      setCategory('ONGKIR');
    }
  };

  // Calculated total for form
  const parsedPrice = Math.abs(parseFloat(unitPrice) || 0);
  const parsedQty = Math.max(1, parseInt(qty, 10) || 1);
  const calculatedTotal = parsedPrice * parsedQty;

  const handleQuickAmount = (val: number) => {
    const cur = parseFloat(unitPrice) || 0;
    setUnitPrice(String(cur + val));
  };

  // Submit Handler: Write to Local AND Sheet LAIN-LAIN
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedTotal <= 0) {
      alert('Masukkan harga/nominal yang valid (lebih dari 0).');
      return;
    }
    if (!description.trim()) {
      alert('Masukkan keterangan/catatan pengeluaran.');
      return;
    }

    const matchedCat = categoryOptions.find((c) => c.value === category);
    const categoryLabel = matchedCat ? matchedCat.label : category;

    setIsSubmitting(true);
    try {
      await onAddRecord({
        date: entryDate.trim() || todayFormatted,
        type,
        category,
        categoryLabel,
        unitPrice: parsedPrice,
        qty: parsedQty,
        amount: calculatedTotal,
        description: description.trim(),
        paymentMethod: paymentMethod.toUpperCase(),
        cashier,
      });

      // Reset form
      setDescription('');
      setUnitPrice('');
      setQty('1');
      showToast(`Transaksi "${description.trim()}" (${formatRupiah(calculatedTotal)}) berhasil disimpan!`, 'success');
    } catch (err: any) {
      showToast('Gagal menyimpan transaksi: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pull data directly from Google Sheet LAIN-LAIN
  const handlePullFromSheet = async () => {
    setIsPullingSheet(true);
    try {
      if (onSyncSpreadsheet) {
        await onSyncSpreadsheet();
      } else {
        const res = await GasApiService.fetchPengeluaranLain();
        if (res.success) {
          const count = res.list?.length || 0;
          showToast(`Berhasil menarik ${count} baris dari Sheet LAIN-LAIN!`, 'success');
        } else {
          showToast(res.message || 'Gagal mengambil data dari Google Sheets.', 'error');
        }
      }
    } catch (err: any) {
      showToast('Koneksi ke Sheet LAIN-LAIN gagal: ' + err.message, 'error');
    } finally {
      setIsPullingSheet(false);
    }
  };

  // Calculations
  const totalIncome = financeRecords
    .filter((f) => f.type === 'INCOME')
    .reduce((sum, f) => sum + f.amount, 0);

  const totalExpense = financeRecords
    .filter((f) => f.type === 'EXPENSE')
    .reduce((sum, f) => sum + f.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Breakdown by payment method for expenses
  const expenseByMethod = financeRecords
    .filter((f) => f.type === 'EXPENSE')
    .reduce((acc, f) => {
      const pm = (f.paymentMethod || 'CASH').toUpperCase();
      acc[pm] = (acc[pm] || 0) + f.amount;
      return acc;
    }, {} as Record<string, number>);

  // Count records with sync status
  const syncedCount = financeRecords.filter((f) => f.syncStatus === 'SYNCED' || f.rowNumber).length;

  // Filtering list
  const filteredRecords = financeRecords.filter((rec) => {
    if (filterType !== 'ALL' && rec.type !== filterType) return false;
    if (filterCategory !== 'ALL' && rec.category !== filterCategory) return false;
    if (filterPaymentMethod !== 'ALL') {
      const pm = (rec.paymentMethod || 'CASH').toUpperCase();
      if (pm !== filterPaymentMethod) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const pm = (rec.paymentMethod || '').toLowerCase();
      return (
        rec.description.toLowerCase().includes(q) ||
        rec.categoryLabel.toLowerCase().includes(q) ||
        (rec.cashier && rec.cashier.toLowerCase().includes(q)) ||
        pm.includes(q) ||
        (rec.date && rec.date.includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border animate-in slide-in-from-top ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-stone-900 text-white border-stone-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Header Banner - Google Sheet LAIN-LAIN Sync */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden border border-slate-700/60">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-[#FF5E36] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" />
                Sheet LAIN-LAIN
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Read & Write Google Sheets
              </span>
              <span className="text-slate-400 text-xs font-mono">
                ORTUKILL_KEDIRI • Kolom A-F
              </span>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              Buku Kas & Pengeluaran Lain-Lain
            </h2>
            
            <p className="text-xs sm:text-sm text-slate-300">
              Formulir dan riwayat ini terhubung langsung ke spreadsheet <strong>ORTUKILL_KEDIRI</strong> tab <strong>LAIN-LAIN</strong> (Tanggal, Keterangan, Harga, Jumlah, Total, Dibayar dengan). Setiap pengeluaran yang dicatat otomatis tersimpan ke baris spreadsheet!
            </p>
          </div>

          {/* Sync Action & Summary Stats Widget */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[240px]">
            {/* Sync Button */}
            <button
              type="button"
              onClick={handlePullFromSheet}
              disabled={isPullingSheet || isSyncing}
              className="w-full bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/20 text-white px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-400 ${isPullingSheet || isSyncing ? 'animate-spin' : ''}`} />
              <span>{isPullingSheet || isSyncing ? 'Menghubungkan ke Sheet...' : 'Tarik Data dari Sheet LAIN-LAIN'}</span>
            </button>

            {/* Quick Balance Preview */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">Saldo Arus Kas:</span>
                <span className={`text-sm font-extrabold ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatRupiah(netBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1.5 mt-1.5 border-t border-white/10">
                <span className="text-slate-400">Total Pengeluaran:</span>
                <span className="font-bold text-rose-300">-{formatRupiah(totalExpense)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                <span>Tersinkron Sheet:</span>
                <span className="font-bold text-emerald-300">{syncedCount} baris</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Form Input (Left) + List & Stats (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Input matching Sheet LAIN-LAIN (Kolom A-F) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-stone-200/80 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="font-extrabold text-stone-900 flex items-center gap-2 text-base">
                <Receipt className="w-5 h-5 text-[#FF5E36]" />
                <span>Catat ke Sheet LAIN-LAIN</span>
              </h3>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Otomatis mengisi Kolom A s/d F di spreadsheet
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Live Write
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Toggle Switch Type: Pengeluaran (Sheet LAIN-LAIN) vs Pemasukan */}
            <div className="grid grid-cols-2 gap-2 bg-stone-100/80 p-1.5 rounded-2xl border border-stone-200/60">
              <button
                type="button"
                onClick={() => handleTypeChange('EXPENSE')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  type === 'EXPENSE'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
                }`}
              >
                <MinusCircle className="w-4 h-4" />
                <span>Pengeluaran (Sheet)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('INCOME')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  type === 'INCOME'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Pemasukan (+)</span>
              </button>
            </div>

            {/* Kolom A: Tanggal */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-stone-500" />
                  Tanggal Transaksi (Kolom A)
                </span>
                <button
                  type="button"
                  onClick={() => setEntryDate(todayFormatted)}
                  className="text-[10px] font-bold text-[#FF5E36] hover:underline cursor-pointer"
                >
                  Hari Ini
                </button>
              </label>
              <input
                type="text"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                placeholder="DD/MM/YYYY (contoh: 24/09/2026)"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#FF5E36] bg-stone-50/50"
                required
              />
            </div>

            {/* Kolom B: Keterangan */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Keterangan / Keperluan (Kolom B)
              </label>
              <textarea
                rows={2}
                placeholder={
                  type === 'EXPENSE'
                    ? 'Contoh: Beli bensin motor delivery, Plastik packing, Konsumsi karyawan...'
                    : 'Contoh: Ongkir COD pelanggan, Tips konsumen...'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#FF5E36] bg-stone-50/50 font-medium"
                required
              />
            </div>

            {/* Kolom C & D: Harga Satuan & Jumlah */}
            <div className="grid grid-cols-2 gap-3">
              {/* Kolom C: Harga Satuan */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center justify-between">
                  <span>Harga Satuan (Kolom C)</span>
                  {type === 'EXPENSE' && (
                    <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                      Minus di Sheet (-)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-stone-400 text-xs">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-2xl border border-stone-200 text-sm font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#FF5E36] bg-stone-50/50"
                    required
                  />
                </div>
              </div>

              {/* Kolom D: Jumlah (Qty) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Jumlah / Qty (Kolom D)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 text-sm font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#FF5E36] bg-stone-50/50 text-center"
                  required
                />
              </div>
            </div>

            {/* Quick Price Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-stone-400 mr-0.5">+ Cepat:</span>
              {[5000, 10000, 20000, 50000, 100000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="text-[10px] font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  +{val / 1000}k
                </button>
              ))}
            </div>

            {/* Kolom E: Total (Live preview) */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Total (Kolom E = C × D)
                </span>
                <span className="text-[10px] text-stone-400">
                  {formatRupiah(parsedPrice)} × {parsedQty} unit {type === 'EXPENSE' && '• Di sheet menjadi minus (-)'}
                </span>
              </div>
              <div className="text-right">
                <span className={`text-base font-black ${type === 'EXPENSE' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {type === 'EXPENSE' ? '-' : '+'}{formatRupiah(calculatedTotal)}
                </span>
                <span className="block text-[9px] font-bold text-rose-500">
                  {type === 'EXPENSE' ? 'Tercatat Minus di Sheet' : 'Tercatat Positif di Sheet'}
                </span>
              </div>
            </div>

            {/* Kolom F: Dibayar dengan (BCA, CASH, GOPAY, JAGO) */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center justify-between">
                <span>Dibayar dengan (Kolom F)</span>
                <span className="text-[10px] font-mono text-stone-400">Dropdown H4:H7</span>
              </label>
              
              <div className="grid grid-cols-4 gap-1.5">
                {paymentMethodOptions.slice(0, 4).map((pm) => {
                  const isSelected = paymentMethod === pm.value;
                  return (
                    <button
                      key={pm.value}
                      type="button"
                      onClick={() => setPaymentMethod(pm.value)}
                      className={`py-2 px-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer border text-center ${
                        isSelected
                          ? `${pm.bg} shadow-sm ring-2 ${pm.activeRing} border-transparent`
                          : 'bg-stone-100/80 hover:bg-stone-200/80 text-stone-700 border-stone-200/80'
                      }`}
                    >
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kategori Pengeluaran */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Kategori Operasional
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {categoryOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = category === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCategory(opt.value as FinanceCategory)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-[11px] font-bold truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pencatat / Kasir */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Kasir / Pencatat
              </label>
              <input
                type="text"
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 bg-stone-50 font-medium"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 rounded-2xl font-extrabold text-sm text-white transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                type === 'EXPENSE'
                  ? 'bg-rose-600 hover:bg-rose-700 active:scale-[0.99]'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Google Sheets...</span>
                </>
              ) : (
                <>
                  <SendHorizontal className="w-4 h-4" />
                  <span>
                    Simpan & Tulis ke Sheet LAIN-LAIN ({formatRupiah(calculatedTotal)})
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Breakdown Cards & Records Table */}
        <div className="lg:col-span-7 space-y-5">
          {/* Payment Method Breakdown Widget (BCA, CASH, GOPAY, JAGO) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-3 shadow-xs">
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block">
                BCA
              </span>
              <p className="text-sm sm:text-base font-black text-blue-950 mt-0.5">
                {formatRupiah(expenseByMethod['BCA'] || 0)}
              </p>
              <span className="text-[9px] text-blue-600 font-medium">Pengeluaran Bank</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 shadow-xs">
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">
                CASH (Tunai)
              </span>
              <p className="text-sm sm:text-base font-black text-emerald-950 mt-0.5">
                {formatRupiah(expenseByMethod['CASH'] || 0)}
              </p>
              <span className="text-[9px] text-emerald-600 font-medium">Uang Kasir</span>
            </div>

            <div className="bg-sky-50 border border-sky-200/80 rounded-2xl p-3 shadow-xs">
              <span className="text-[10px] font-black text-sky-700 uppercase tracking-wider block">
                GOPAY
              </span>
              <p className="text-sm sm:text-base font-black text-sky-950 mt-0.5">
                {formatRupiah(expenseByMethod['GOPAY'] || 0)}
              </p>
              <span className="text-[9px] text-sky-600 font-medium">E-Wallet</span>
            </div>

            <div className="bg-purple-50 border border-purple-200/80 rounded-2xl p-3 shadow-xs">
              <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider block">
                JAGO
              </span>
              <p className="text-sm sm:text-base font-black text-purple-950 mt-0.5">
                {formatRupiah(expenseByMethod['JAGO'] || 0)}
              </p>
              <span className="text-[9px] text-purple-600 font-medium">Bank Digital</span>
            </div>
          </div>

          {/* Records Table Card */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
                  <span>Data Sheet LAIN-LAIN</span>
                  <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-0.5 rounded-full">
                    {filteredRecords.length} transaksi
                  </span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Mencerminkan baris data di spreadsheet Google Sheets
                </p>
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterType('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'ALL' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('EXPENSE')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'EXPENSE' ? 'bg-rose-600 text-white shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('INCOME')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'INCOME' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-600'
                  }`}
                >
                  Pemasukan
                </button>
              </div>
            </div>

            {/* Search and Payment Filter Row */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari keterangan, kasir, tanggal, metode bayar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5E36] bg-stone-50/50 font-medium"
                />
              </div>

              {/* Payment Filter Selector */}
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-[#FF5E36] w-full sm:w-auto"
              >
                <option value="ALL">Semua Pembayaran</option>
                <option value="BCA">BCA</option>
                <option value="CASH">CASH</option>
                <option value="GOPAY">GOPAY</option>
                <option value="JAGO">JAGO</option>
              </select>
            </div>

            {/* Records List / Table */}
            {filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-stone-400 space-y-2">
                <FileSpreadsheet className="w-10 h-10 mx-auto stroke-[1.5] text-stone-300" />
                <p className="text-xs font-semibold text-stone-600">Belum ada data di sheet LAIN-LAIN</p>
                <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                  Gunakan tombol "Tarik Data dari Sheet LAIN-LAIN" di atas untuk memuat data spreadsheet yang ada, atau isi form di sebelah kiri untuk menambah baru.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {filteredRecords.map((rec) => {
                  const isExpense = rec.type === 'EXPENSE';
                  const pm = (rec.paymentMethod || 'CASH').toUpperCase();
                  const matchedPm = paymentMethodOptions.find((p) => p.value === pm);

                  return (
                    <div
                      key={rec.id}
                      className="p-3.5 rounded-2xl border border-stone-200/80 hover:border-stone-300 bg-stone-50/40 transition-all hover:shadow-xs group space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {/* Row Indicator / Icon */}
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black ${
                              isExpense ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {rec.rowNumber ? `#${rec.rowNumber}` : (isExpense ? 'OUT' : 'IN')}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Kolom A: Tanggal */}
                              <span className="text-[11px] font-bold text-stone-700 bg-white border border-stone-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-stone-400" />
                                {rec.date}
                              </span>

                              {/* Kolom F: Dibayar dengan */}
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                  matchedPm ? matchedPm.badge : 'bg-stone-100 text-stone-700 border-stone-200'
                                }`}
                              >
                                {pm}
                              </span>

                              {/* Status Sync Badge */}
                              {rec.syncStatus === 'SYNCED' || rec.rowNumber ? (
                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Sheet LAIN-LAIN
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-md">
                                  Lokal
                                </span>
                              )}
                            </div>

                            {/* Kolom B: Keterangan */}
                            <p className="text-xs font-bold text-stone-900 mt-1">
                              {rec.description}
                            </p>

                            {/* Breakdown Kolom C & D: Harga x Jumlah */}
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-500">
                              <span>
                                Harga: <strong className="text-stone-700">{formatRupiah(rec.unitPrice || rec.amount)}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Qty: <strong className="text-stone-700">{rec.qty || 1}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Oleh: <span className="text-stone-600">{rec.cashier || 'Kasir'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Kolom E: Total & Delete Action */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p
                              className={`text-sm sm:text-base font-black tracking-tight ${
                                isExpense ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                            >
                              {isExpense ? '-' : '+'}{formatRupiah(rec.amount)}
                            </p>
                            <span className="text-[10px] font-semibold text-stone-400 block">
                              Kolom E
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const msg = rec.rowNumber
                                ? `Hapus pengeluaran "${rec.description}" di sheet LAIN-LAIN (Baris ${rec.rowNumber})?`
                                : `Hapus catatan keuangan "${rec.description}"?`;
                              if (window.confirm(msg)) {
                                onDeleteRecord(rec.id, rec.rowNumber);
                              }
                            }}
                            className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-all cursor-pointer shadow-2xs flex items-center justify-center flex-shrink-0"
                            title="Hapus dari Sheet & Lokal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
