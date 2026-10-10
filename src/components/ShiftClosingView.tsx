import React, { useState } from 'react';
import { 
  Wallet, 
  Printer, 
  Receipt, 
  Banknote, 
  Clock,
  ArrowDownCircle,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus
} from 'lucide-react';
import { ShiftRecord, CashExpense, BrandConfig } from '../types';
import { formatRupiah } from '../services/storageService';

interface ShiftClosingViewProps {
  currentShift: ShiftRecord;
  shiftHistory: ShiftRecord[];
  todayCashSales: number;
  todayQrisSales: number;
  todayTransferSales: number;
  brand: BrandConfig;
  onAddExpense: (description: string, amount: number) => void;
  onCloseShift: (actualCash: number, notes: string) => void;
  onStartNewShift: (startingCash: number, cashierName: string) => void;
}

export const ShiftClosingView: React.FC<ShiftClosingViewProps> = ({
  currentShift,
  shiftHistory,
  todayCashSales,
  todayQrisSales,
  todayTransferSales,
  brand,
  onAddExpense,
  onCloseShift,
  onStartNewShift,
}) => {
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);

  const [actualCashCounted, setActualCashCounted] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');

  const [newCashier, setNewCashier] = useState('Kasir Kediri');
  const [newStartingCash, setNewStartingCash] = useState<number>(100000);

  const totalExpenses = (currentShift.expenses || []).reduce((sum, e) => sum + e.amount, 0);
  const expectedCashInDrawer = currentShift.startingCash + todayCashSales - totalExpenses;
  const difference = actualCashCounted - expectedCashInDrawer;

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc.trim() || expenseAmount <= 0) return;
    onAddExpense(expenseDesc.trim(), expenseAmount);
    setExpenseDesc('');
    setExpenseAmount(0);
  };

  const handleCloseShiftSubmit = () => {
    if (actualCashCounted <= 0 && !window.confirm('Fisik uang kas terhitung adalah Rp 0? Lanjutkan?')) {
      return;
    }
    onCloseShift(actualCashCounted, closingNotes);
  };

  const handlePrintShiftReport = () => {
    window.print();
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight">
                Rekap & Tutup Shift Kasir
              </h2>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {currentShift.status === 'OPEN' ? 'Shift Aktif' : 'Shift Ditutup'}
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Kasir: <strong className="text-stone-800">{currentShift.cashierName}</strong> • Sejak {currentShift.startTime}
            </p>
          </div>
        </div>

        <button
          onClick={handlePrintShiftReport}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-all cursor-pointer min-h-[44px]"
        >
          <Printer className="w-3.5 h-3.5 text-[#FF5E36]" />
          <span>Cetak Laporan Shift</span>
        </button>
      </div>

      {currentShift.status === 'OPEN' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Drawer Status & Petty Cash (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Cash Drawer Reconciliation Grid */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Kalkulasi Uang Tunai di Laci
                </span>
                <span className="text-[10px] bg-[#FFF2ED] text-[#FF5E36] px-2 py-0.5 rounded-full font-bold">
                  Sistem Kasir
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-400 font-semibold block uppercase">Modal Awal</span>
                  <p className="font-extrabold text-stone-900 mt-1">{formatRupiah(currentShift.startingCash)}</p>
                </div>

                <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-400 font-semibold block uppercase">Penjualan Tunai</span>
                  <p className="font-extrabold text-[#FF5E36] mt-1">+{formatRupiah(todayCashSales)}</p>
                </div>

                <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-400 font-semibold block uppercase">Kas Keluar</span>
                  <p className="font-extrabold text-rose-600 mt-1">-{formatRupiah(totalExpenses)}</p>
                </div>

                <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-700 font-semibold block uppercase">Target Laci</span>
                  <p className="font-extrabold text-emerald-700 mt-1">{formatRupiah(expectedCashInDrawer)}</p>
                </div>
              </div>
            </div>

            {/* Non-Cash Channels Info */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                Penerimaan Non-Tunai (Rekening / QRIS)
              </span>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-stone-50 rounded-xl flex items-center justify-between">
                  <span className="text-stone-500 font-medium">QRIS Merchant:</span>
                  <span className="font-extrabold text-emerald-700">{formatRupiah(todayQrisSales)}</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Transfer Bank:</span>
                  <span className="font-extrabold text-sky-700">{formatRupiah(todayTransferSales)}</span>
                </div>
              </div>
            </div>

            {/* Petty Cash / Operational Expense */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-rose-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Pengeluaran Operasional / Kas Keluar
                  </h4>
                </div>
                <span className="text-xs font-bold text-rose-600">
                  Total: -{formatRupiah(totalExpenses)}
                </span>
              </div>

              {/* Add Expense Form */}
              <form onSubmit={handleAddExpenseSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Keterangan (Es Batu, Aqua Galon, Plastik)..."
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="500"
                    step="500"
                    placeholder="Nominal Rp"
                    value={expenseAmount || ''}
                    onChange={(e) => setExpenseAmount(Number(e.target.value) || 0)}
                    className="w-32 px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shrink-0 min-h-[44px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Catat</span>
                  </button>
                </div>
              </form>

              {/* Expense History List */}
              <div className="space-y-1.5 pt-1">
                {(currentShift.expenses || []).length === 0 ? (
                  <p className="text-xs text-stone-400 italic py-2">
                    Belum ada pengeluaran kas tercatat pada shift ini.
                  </p>
                ) : (
                  currentShift.expenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-400 font-mono">{exp.time}</span>
                        <span className="font-semibold text-stone-800">{exp.description}</span>
                      </div>
                      <span className="font-bold text-rose-600">-{formatRupiah(exp.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Close Shift Form (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900">
                  Form Tutup Shift & Serah Terima
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Hitung fisik uang kas lembaran & koin di laci
                </p>
              </div>

              {/* Count Input Box */}
              <div className="p-3.5 bg-stone-50 rounded-2xl space-y-2.5 border border-stone-100">
                <div className="flex justify-between text-xs text-stone-600">
                  <span>Target Kas Sistem:</span>
                  <span className="font-extrabold text-stone-900">{formatRupiah(expectedCashInDrawer)}</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Fisik Uang Terhitung (Actual Cash):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={actualCashCounted || ''}
                    onChange={(e) => setActualCashCounted(Number(e.target.value) || 0)}
                    placeholder="Masukkan jumlah fisik uang..."
                    className="w-full px-3.5 py-3 bg-white border border-stone-300 rounded-xl text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                  />
                </div>

                {/* Discrepancy indicator */}
                <div className="pt-2 border-t border-stone-200/80 flex justify-between items-center text-xs">
                  <span className="text-stone-500 font-medium">Status Selisih:</span>
                  <span className={`font-extrabold ${
                    difference === 0
                      ? 'text-emerald-700'
                      : difference > 0
                      ? 'text-sky-700'
                      : 'text-rose-600'
                  }`}>
                    {difference === 0
                      ? 'KLOP / SESUAI (Rp 0)'
                      : difference > 0
                      ? `SURPLUS +${formatRupiah(difference)}`
                      : `MINUS -${formatRupiah(Math.abs(difference))}`}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Catatan untuk Shift Berikutnya:
                </label>
                <textarea
                  rows={3}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Contoh: Sisa koin Rp 500 aman, es batu sisa 1 termos..."
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                />
              </div>

              <button
                onClick={handleCloseShiftSubmit}
                className="w-full py-3.5 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md min-h-[48px]"
              >
                Tutup Shift & Simpan Laporan
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Open New Shift Card */
        <div className="bg-white rounded-3xl p-6 max-w-md mx-auto text-center space-y-4 border border-stone-200/80 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center mx-auto">
            <FileCheck className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-extrabold text-stone-900">Shift Kasir Telah Ditutup</h3>
            <p className="text-xs text-stone-500 mt-1">
              Buka shift kasir baru untuk memulai transaksi berikutnya
            </p>
          </div>

          <div className="text-left space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold uppercase text-stone-600 mb-1">
                Nama Kasir Bertugas:
              </label>
              <input
                type="text"
                value={newCashier}
                onChange={(e) => setNewCashier(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-[#FF5E36]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-stone-600 mb-1">
                Modal Awal di Laci:
              </label>
              <input
                type="number"
                step="5000"
                value={newStartingCash}
                onChange={(e) => setNewStartingCash(Number(e.target.value) || 0)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-900 focus:outline-none focus:border-[#FF5E36]"
              />
            </div>

            <button
              onClick={() => onStartNewShift(newStartingCash, newCashier)}
              className="w-full py-3.5 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md mt-2 min-h-[48px]"
            >
              Buka Shift Baru ({formatRupiah(newStartingCash)})
            </button>
          </div>
        </div>
      )}

      {/* Historic Closed Shifts */}
      {shiftHistory.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Riwayat Shift Sebelumnya ({shiftHistory.length})
          </h3>
          <div className="space-y-2">
            {shiftHistory.slice(0, 5).map((sh) => (
              <div
                key={sh.id}
                className="p-3 bg-stone-50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2"
              >
                <div>
                  <span className="font-bold text-stone-900">{sh.cashierName}</span>
                  <p className="text-[10px] text-stone-400">
                    {sh.startTime} — {sh.endTime || 'Selesai'}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-[10px] text-stone-400 block">Kas Masuk</span>
                    <span className="font-bold text-[#FF5E36]">{formatRupiah(sh.cashSales)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 block">Fisik Dihitung</span>
                    <span className="font-bold text-stone-900">{formatRupiah(sh.actualCash || 0)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 block">Selisih</span>
                    <span className={`font-bold ${
                      (sh.difference || 0) === 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {formatRupiah(sh.difference || 0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
