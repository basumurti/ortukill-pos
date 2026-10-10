import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Receipt, 
  Package, 
  Search, 
  Filter, 
  Download, 
  Ban, 
  Eye, 
  RefreshCw, 
  Calendar,
  Clock,
  CreditCard,
  Banknote,
  QrCode,
  X,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { TransactionReceipt, DailySummary } from '../types';
import { formatRupiah } from '../services/storageService';

interface TodayTransactionsViewProps {
  summary: DailySummary;
  transactions: TransactionReceipt[];
  onViewReceipt: (receipt: TransactionReceipt) => void;
  onVoidTransaction: (id: string, reason: string) => void;
  onDeleteTransaction?: (id: string) => void;
  onRefresh: () => void;
  onSyncSpreadsheet?: () => void;
  isSyncing?: boolean;
}

// Helper mengambil jam input website asli tanpa distorsi Google Sheets
export function getPureWebsiteTime(t: TransactionReceipt): string {
  // 1. Jika ada websiteTime eksplisit
  if (t.websiteTime && t.websiteTime.trim()) {
    return t.websiteTime.trim().replace(/\./g, ':');
  }
  // 2. Jika transactionDate memiliki jam (dd/MM/yyyy HH:mm:ss atau HH:mm)
  if (t.transactionDate) {
    const str = t.transactionDate.trim();
    if (str.includes(' ')) {
      const timePart = str.split(' ')[1].trim().replace(/\./g, ':');
      if (timePart && timePart !== '00:00' && timePart !== '00:00:00') {
        return timePart;
      }
    } else if (str.includes(':')) {
      return str.replace(/\./g, ':');
    }
  }
  // 3. Ekstrak dari format ID transaksi jika mengandung waktu: TRX-YYYYMMDD-HHMMSS-XXX
  if (t.id) {
    const matchTimeInId = t.id.match(/TRX-\d{8}-(\d{2})(\d{2})(\d{2})/);
    if (matchTimeInId) {
      return `${matchTimeInId[1]}:${matchTimeInId[2]}:${matchTimeInId[3]}`;
    }
    const matchEpoch = t.id.match(/TRX-(\d{13})/);
    if (matchEpoch) {
      const date = new Date(Number(matchEpoch[1]));
      if (!isNaN(date.getTime())) {
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      }
    }
  }
  // 4. Jika ada createdAt
  if (t.createdAt) {
    const date = new Date(t.createdAt);
    if (!isNaN(date.getTime())) {
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
  }
  return '-';
}

export const TodayTransactionsView: React.FC<TodayTransactionsViewProps> = ({
  summary,
  transactions,
  onViewReceipt,
  onVoidTransaction,
  onDeleteTransaction,
  onRefresh,
  onSyncSpreadsheet,
  isSyncing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Void modal state
  const [voidingTrx, setVoidingTrx] = useState<TransactionReceipt | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Delete modal state
  const [deletingTrx, setDeletingTrx] = useState<TransactionReceipt | null>(null);

  // Filter transactions
  const filtered = transactions.filter((t) => {
    if (selectedPayment !== 'ALL' && t.paymentMethod !== selectedPayment) return false;
    if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchId = t.id.toLowerCase().includes(q);
    const matchCustomer = (t.customerName || '').toLowerCase().includes(q);
    const matchItems = t.items.some((i) => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q));
    return matchId || matchCustomer || matchItems;
  });

  // Urutkan transaksi hari ini secara ketat berdasarkan jam input website asli (terbaru di atas agar tetap urut)
  const sortedTransactions = [...filtered].sort((a, b) => {
    // 1. Bandingkan createdAt numerik jika ada
    if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
      return b.createdAt - a.createdAt;
    }
    // 2. Bandingkan jam input website asli
    const timeA = getPureWebsiteTime(a);
    const timeB = getPureWebsiteTime(b);
    if (timeA !== '-' && timeB !== '-' && timeA !== timeB) {
      return timeB.localeCompare(timeA);
    }
    // 3. Fallback perbandingan nomor ID transaksi
    return b.id.localeCompare(a.id);
  });

  const handleConfirmVoid = () => {
    if (!voidingTrx) return;
    onVoidTransaction(voidingTrx.id, voidReason);
    setVoidingTrx(null);
    setVoidReason('');
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) return;

    const headers = ['No_Transaksi', 'Waktu', 'Tanggal', 'Pelanggan', 'Metode_Bayar', 'Total_Belanja', 'Margin_Untung', 'Total_Qty', 'Status', 'Item_Terjual'];
    const rows = filtered.map((t) => [
      t.id,
      t.transactionDate,
      t.date,
      `"${t.customerName || '-'}"`,
      t.paymentMethod,
      t.total,
      t.margin,
      t.totalQty,
      t.status,
      `"${t.items.map((i) => `${i.name} (${i.qty}x)`).join('; ')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ortukill_Transaksi_${summary.date.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const marginPercentage = summary.totalOmset > 0 
    ? ((summary.totalMargin / summary.totalOmset) * 100).toFixed(1) 
    : '0';

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight">
                Transaksi Hari Ini
              </h2>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {summary.date}
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Total {transactions.length} transaksi tercatat hari ini
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSyncSpreadsheet ? onSyncSpreadsheet : onRefresh}
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-all cursor-pointer min-h-[44px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#FF5E36] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sinkron...' : 'Segarkan'}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] text-white text-xs font-bold transition-all cursor-pointer shadow-xs min-h-[44px]"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Omset */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Omset
            </span>
            <div className="w-7 h-7 rounded-xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight">
              {formatRupiah(summary.totalOmset)}
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {summary.totalTransactions} transaksi
            </p>
          </div>
        </div>

        {/* Card 2: Margin */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Estimasi Laba
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-extrabold text-emerald-600 tracking-tight">
              {formatRupiah(summary.totalMargin)}
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Margin {marginPercentage}%
            </p>
          </div>
        </div>

        {/* Card 3: Nota */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Jumlah Nota
            </span>
            <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight">
              {summary.totalTransactions}
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5 truncate">
              Rata2: {formatRupiah(summary.avgBasketSize)}
            </p>
          </div>
        </div>

        {/* Card 4: Volume */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Volume Terjual
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight">
              {summary.totalQty} Botol
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Item minuman
            </p>
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2.5">
          Rincian Metode Pembayaran
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-stone-50 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">TUNAI</p>
                <p className="text-[10px] text-stone-500">{summary.paymentBreakdown.CASH.count} nota</p>
              </div>
            </div>
            <p className="text-xs font-bold text-stone-900">{formatRupiah(summary.paymentBreakdown.CASH.total)}</p>
          </div>

          <div className="bg-stone-50 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">QRIS</p>
                <p className="text-[10px] text-stone-500">{summary.paymentBreakdown.QRIS.count} nota</p>
              </div>
            </div>
            <p className="text-xs font-bold text-emerald-700">{formatRupiah(summary.paymentBreakdown.QRIS.total)}</p>
          </div>

          <div className="bg-stone-50 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">TRANSFER</p>
                <p className="text-[10px] text-stone-500">{summary.paymentBreakdown.TRANSFER.count} nota</p>
              </div>
            </div>
            <p className="text-xs font-bold text-sky-700">{formatRupiah(summary.paymentBreakdown.TRANSFER.total)}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-2xl p-3.5 border border-stone-200/80 shadow-xs space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            id="input-search-today"
            placeholder="Cari no. struk, pelanggan, atau nama produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(['ALL', 'CASH', 'QRIS', 'TRANSFER'] as const).map((method) => (
            <button
              key={method}
              onClick={() => setSelectedPayment(method)}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer min-h-[36px] ${
                selectedPayment === method
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {method === 'ALL' ? 'Semua Metode' : method}
            </button>
          ))}

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-stone-100 text-stone-700 border border-stone-200 px-3 py-1.5 rounded-full font-medium text-xs focus:outline-none focus:border-[#FF5E36] cursor-pointer min-h-[36px]"
          >
            <option value="ALL">Semua Status</option>
            <option value="COMPLETED">Selesai</option>
            <option value="VOIDED">Dibatalkan</option>
          </select>
        </div>
      </div>

      {/* Transactions List */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Daftar Nota Penjualan ({filtered.length})
          </h3>
          <span className="text-[11px] text-stone-400">Terbaru di atas</span>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-stone-200/80 shadow-xs space-y-2">
            <Receipt className="w-10 h-10 mx-auto text-stone-300" />
            <p className="text-sm font-bold text-stone-800">Tidak ada transaksi ditemukan</p>
            <p className="text-xs text-stone-500 max-w-xs mx-auto">
              Transaksi yang baru diselesaikan di kasir akan langsung muncul di sini.
            </p>
          </div>
        ) : (
          <>
            {/* MOBILE VIEW (<640px): Card List Touch-Friendly */}
            <div className="space-y-3 sm:hidden">
              {sortedTransactions.map((t) => {
                const isVoided = t.status === 'VOIDED';
                return (
                  <div
                    key={t.id}
                    className={`bg-white rounded-2xl p-4 border shadow-xs space-y-3 ${
                      isVoided ? 'border-rose-200 bg-rose-50/40 opacity-70' : 'border-stone-200/80'
                    }`}
                  >
                    {/* Top row: ID, Time, Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-extrabold text-[#FF5E36]">
                          #{t.id}
                        </span>
                        <span className="text-stone-300">•</span>
                        <div className="flex items-center gap-1 text-[11px] text-stone-600 font-mono font-bold">
                          <Clock className="w-3 h-3 text-[#FF5E36]" />
                          <span>{getPureWebsiteTime(t)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.paymentMethod === 'CASH'
                            ? 'bg-amber-50 text-amber-800'
                            : t.paymentMethod === 'QRIS'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-sky-50 text-sky-700'
                        }`}>
                          {t.paymentMethod}
                        </span>
                        {isVoided && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            VOID
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer & Items */}
                    <div>
                      <p className="text-xs font-bold text-stone-900">
                        {t.customerName ? `Pelanggan: ${t.customerName}` : 'Pelanggan Umum'}
                      </p>
                      <div className="text-xs text-stone-600 mt-1 space-y-0.5">
                        {t.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-stone-700">
                            <span className="truncate pr-2">• {item.name}</span>
                            <span className="font-mono font-semibold flex-shrink-0 text-stone-900">
                              {item.qty}x @{formatRupiah(item.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial summary */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-stone-500">Laba: +{formatRupiah(t.margin)}</p>
                        <p className="text-sm font-extrabold text-stone-900">
                          Total: {formatRupiah(t.total)}
                        </p>
                      </div>

                      {/* Action buttons (min 44px touch) */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onViewReceipt(t)}
                          className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1 min-h-[44px] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Struk</span>
                        </button>
                        {!isVoided && (
                          <button
                            onClick={() => setVoidingTrx(t)}
                            className="px-2.5 py-2 rounded-xl text-amber-600 hover:bg-amber-50 text-xs font-semibold flex items-center gap-1 min-h-[44px] cursor-pointer"
                            title="Batalkan Transaksi (VOID) & Hapus di Sheet"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteTransaction && (
                          <button
                            onClick={() => setDeletingTrx(t)}
                            className="px-2.5 py-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1 min-h-[44px] cursor-pointer"
                            title="Hapus Transaksi & Hapus Baris di Google Sheets"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* TABLET/DESKTOP VIEW (>=640px): Full Table */}
            <div className="hidden sm:block bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] tracking-wider border-b border-stone-200 font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold text-stone-900">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#FF5E36]" />
                          <span>Jam Input</span>
                        </div>
                      </th>
                      <th className="py-3.5 px-4">No. Transaksi</th>
                      <th className="py-3.5 px-4">Pelanggan</th>
                      <th className="py-3.5 px-4">Item Minuman</th>
                      <th className="py-3.5 px-4 text-center">Metode</th>
                      <th className="py-3.5 px-4 text-right">Total Belanja</th>
                      <th className="py-3.5 px-4 text-right">Margin</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {sortedTransactions.map((t) => {
                      const isVoided = t.status === 'VOIDED';
                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-stone-50/80 transition-colors ${
                            isVoided ? 'opacity-50 bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs bg-stone-100 px-2.5 py-1 rounded-lg text-stone-800 border border-stone-200/80 font-bold tracking-tight">
                                {getPureWebsiteTime(t)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#FF5E36] whitespace-nowrap">
                            {t.id}
                          </td>
                          <td className="py-3.5 px-4 text-stone-800 font-medium">
                            {t.customerName || <span className="text-stone-400 italic">Umum</span>}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs truncate" title={t.items.map(i => `${i.name} (${i.qty}x)`).join(', ')}>
                            {t.items.map((i, idx) => (
                              <span key={idx} className="mr-1">
                                {i.name} <strong className="text-stone-900">({i.qty}x)</strong>
                                {idx < t.items.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                              {t.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                            {formatRupiah(t.total)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-600 whitespace-nowrap">
                            +{formatRupiah(t.margin)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isVoided ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                DIBATALKAN
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                SELESAI
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => onViewReceipt(t)}
                                className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-colors"
                              >
                                Struk
                              </button>
                              {!isVoided && (
                                <button
                                  onClick={() => setVoidingTrx(t)}
                                  className="p-1 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
                                  title="Void & Hapus di Sheet"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteTransaction && (
                                <button
                                  onClick={() => setDeletingTrx(t)}
                                  className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Hapus Transaksi & Hapus Baris di Google Sheets"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Void Modal */}
      {voidingTrx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-stone-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-base text-stone-900">Batalkan Transaksi & Hapus di Sheet</h3>
              </div>
              <button
                onClick={() => setVoidingTrx(null)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Anda akan membatalkan transaksi <strong className="text-stone-900">#{voidingTrx.id}</strong> sejumlah{' '}
              <strong className="text-stone-900">{formatRupiah(voidingTrx.total)}</strong>. Stok barang akan dikembalikan otomatis.
            </p>

            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-[11px] text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                Hapus Otomatis di Google Sheets:
              </p>
              <p className="text-rose-700 leading-relaxed">
                Seluruh baris transaksi ini di <strong>LOG_PENJUALAN</strong> dan baris ongkir di <strong>LAIN-LAIN</strong> akan langsung dihapus permanen dari Spreadsheet Anda.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-1">
                Alasan Pembatalan:
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Contoh: Salah input pesanan / Pelanggan ganti metode bayar"
                rows={3}
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setVoidingTrx(null)}
                className="flex-1 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs min-h-[44px]"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmVoid}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md min-h-[44px]"
              >
                Konfirmasi VOID & Hapus di Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Struk Permanen Modal */}
      {deletingTrx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-stone-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-base text-stone-900">Hapus Struk Permanen</h3>
              </div>
              <button
                onClick={() => setDeletingTrx(null)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Yakin ingin menghapus struk transaksi <strong className="text-stone-900">#{deletingTrx.id}</strong> ({formatRupiah(deletingTrx.total)}) secara permanen dari database lokal dan Google Sheets?
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeletingTrx(null)}
                className="flex-1 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs min-h-[44px]"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (onDeleteTransaction && deletingTrx) {
                    onDeleteTransaction(deletingTrx.id);
                    setDeletingTrx(null);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md min-h-[44px]"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
