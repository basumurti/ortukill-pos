import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Package, 
  Download, 
  Search, 
  Eye, 
  Trophy, 
  FileSpreadsheet,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Clock,
  BarChart3,
  PieChart,
  Wallet,
  Receipt,
  PlusCircle,
  MinusCircle,
  Fuel,
  Truck,
  Gift,
  Building2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Flame,
  Award,
  CircleDollarSign,
  Trash2,
  Ban,
  X
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { TransactionReceipt, Product, FinanceRecord, SalesTarget } from '../types';
import { formatRupiah, isDateToday, normalizeDateToYmd, classifyProduct } from '../services/storageService';
import { FinanceManagementView } from './FinanceManagementView';

interface SalesHistoryViewProps {
  transactions: TransactionReceipt[];
  products: Product[];
  financeRecords: FinanceRecord[];
  salesTarget: SalesTarget;
  onViewReceipt: (receipt: TransactionReceipt) => void;
  onVoidTransaction?: (id: string, reason: string) => void;
  onDeleteTransaction?: (id: string) => void;
  onAddFinanceRecord: (record: Omit<FinanceRecord, 'id' | 'dateYmd' | 'dateTimeStr'>) => Promise<void> | void;
  onDeleteFinanceRecord: (id: string, rowNumber?: number) => Promise<void> | void;
  onSaveSalesTarget: (targetAmount: number, month?: string) => void;
  onSyncSpreadsheet?: () => void;
  isSyncing?: boolean;
}

interface FlattenedSaleItem {
  id: string;
  trxId: string;
  dateStr: string;
  dateYmd: string;
  dateTimeStr: string;
  timeStr: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  qty: number;
  total: number;
  margin: number;
  customer: string;
  paymentMethod: string;
  status: string;
  rawReceipt: TransactionReceipt;
}

interface DateSalesGroup {
  dateKey: string;
  dateDisplay: string;
  dateYmd: string;
  totalOmset: number;
  totalHPP: number;
  totalMargin: number;
  totalQty: number;
  itemCount: number;
  paymentMethods: Record<string, number>;
  items: FlattenedSaleItem[];
  rawReceipt?: TransactionReceipt;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  transactions,
  products,
  financeRecords,
  salesTarget,
  onViewReceipt,
  onVoidTransaction,
  onDeleteTransaction,
  onAddFinanceRecord,
  onDeleteFinanceRecord,
  onSaveSalesTarget,
  onSyncSpreadsheet,
  isSyncing,
}) => {
  // Main Tab Navigation inside Laporan
  const [activeSubTab, setActiveSubTab] = useState<'ANALYTICS' | 'FINANCE_KAS' | 'SALES_LOG'>('ANALYTICS');

  // Deleting modal state
  const [deletingTrx, setDeletingTrx] = useState<TransactionReceipt | null>(null);

  // Sales log filters & Month filter state
  const [viewMode, setViewMode] = useState<'BY_DATE' | 'FLAT_LOG'>('BY_DATE');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL'); // 'ALL' or 'YYYY-MM'
  const [targetGrain, setTargetGrain] = useState<'HARIAN' | 'MINGGUAN' | 'BULANAN'>('BULANAN');
  const [dayOffset, setDayOffset] = useState<number>(1); // Default offset +1 day (maju 1 hari untuk progress hari ini)
  const [timeFilter, setTimeFilter] = useState<'TODAY' | '7DAYS' | '30DAYS' | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Available unique YYYY-MM months derived from transactions & current month
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonthStr);

    transactions.forEach((t) => {
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (ymd && ymd.length >= 7) {
        monthsSet.add(ymd.slice(0, 7));
      }
    });

    return Array.from(monthsSet).sort().reverse();
  }, [transactions]);

  const formatMonthLabel = (ym: string) => {
    if (ym === 'ALL') return 'Semua Bulan';
    const parts = ym.split('-');
    if (parts.length < 2) return ym;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return ym;
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  // Target Editing State
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(salesTarget.targetAmount || 50000000));

  // Handle target submit
  const handleTargetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(0, parseFloat(targetInput) || 0);
    onSaveSalesTarget(val);
    setIsEditingTarget(false);
  };

  const toggleDateExpand = (dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // Flatten items for analysis and logging
  const allFlattenedItems = useMemo(() => {
    const list: FlattenedSaleItem[] = [];

    transactions.forEach((t) => {
      const dateStr = t.date || (t.transactionDate ? t.transactionDate.split(' ')[0] : 'Lainnya');
      const dateYmd = normalizeDateToYmd(t.date || t.transactionDate || '') || dateStr;
      const dateTimeStr = t.transactionDate || dateStr;
      const timeStr = dateTimeStr.includes(' ') ? dateTimeStr.split(' ')[1] : '';

      (t.items || []).forEach((item, idx) => {
        const rawSku = item.sku || t.id;
        const rawName = isNaN(Number(item.sku)) ? item.name : item.sku || item.name;
        const price = !isNaN(Number(item.name)) && Number(item.name) > 0 ? Number(item.name) : Number(item.price) || 0;
        const qty = !isNaN(Number(item.category)) && Number(item.category) > 0 ? Number(item.category) : Number(item.qty) || 1;
        const total = Number(item.total) || (price * qty);
        const cost = Number(item.cost) || 0;
        const margin = Number(item.margin) || (total - (cost * qty));
        const category = item.category && isNaN(Number(item.category)) 
          ? item.category 
          : classifyProduct(rawSku, rawName);

        list.push({
          id: `${t.id}-${idx}`,
          trxId: t.id,
          dateStr,
          dateYmd,
          dateTimeStr,
          timeStr,
          sku: rawSku,
          name: rawName,
          category,
          price,
          cost,
          qty,
          total,
          margin,
          customer: t.customerName || 'Pelanggan Umum',
          paymentMethod: t.paymentMethod || 'CASH',
          status: t.status || 'COMPLETED',
          rawReceipt: t,
        });
      });
    });

    return list;
  }, [transactions]);

  // Available unique categories derived from transactions & products
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    allFlattenedItems.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort();
  }, [products, allFlattenedItems]);

  // Monthly stats and MoM Growth Calculations based on selectedMonth or current month
  const monthlyComparison = useMemo(() => {
    const now = new Date();
    const currentMonthKey = selectedMonth !== 'ALL'
      ? selectedMonth
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Calculate previous month key
    const [cYear, cMonth] = currentMonthKey.split('-').map(Number);
    const prevMonthDate = new Date(cYear, cMonth - 2, 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    let curOmset = 0;
    let curMargin = 0;
    let curTrxCount = 0;

    let prevOmset = 0;
    let prevMargin = 0;
    let prevTrxCount = 0;

    transactions.forEach((t) => {
      const dateYmd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (!dateYmd) return;
      const monthKey = dateYmd.slice(0, 7); // YYYY-MM

      if (monthKey === currentMonthKey) {
        curOmset += Number(t.subtotal || t.total || 0);
        curMargin += Number(t.margin || 0);
        curTrxCount += 1;
      } else if (monthKey === prevMonthKey) {
        prevOmset += Number(t.subtotal || t.total || 0);
        prevMargin += Number(t.margin || 0);
        prevTrxCount += 1;
      }
    });

    const calcGrowth = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 100);
    };

    return {
      currentMonthKey,
      prevMonthKey,
      curOmset,
      curMargin,
      curTrxCount,
      prevOmset,
      prevMargin,
      prevTrxCount,
      omsetGrowth: calcGrowth(curOmset, prevOmset),
      marginGrowth: calcGrowth(curMargin, prevMargin),
      trxGrowth: calcGrowth(curTrxCount, prevTrxCount),
    };
  }, [transactions, selectedMonth]);

  // Today's total sales
  const todayYmd = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayOmset = useMemo(() => {
    return transactions
      .filter((t) => {
        const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
        return ymd === todayYmd;
      })
      .reduce((sum, t) => sum + Number(t.subtotal || t.total || 0), 0);
  }, [transactions, todayYmd]);

  // Week's total sales (last 7 days)
  const weekOmset = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((t) => {
        const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
        if (!ymd) return false;
        const tDate = new Date(ymd);
        const diffDays = (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7;
      })
      .reduce((sum, t) => sum + Number(t.subtotal || t.total || 0), 0);
  }, [transactions]);

  // Target Progress Calculations supporting Harian, Mingguan, Bulanan & +1 Day Advance Offset
  const targetProgress = useMemo(() => {
    const baseMonthlyTarget = salesTarget.targetAmount || 50000000;
    const [year, month] = monthlyComparison.currentMonthKey.split('-').map(Number);
    const now = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const isCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === month;
    const rawCurrentDay = isCurrentMonth ? now.getDate() : daysInMonth;
    
    // Effective day count advancing +dayOffset (e.g., +1 for progress ditujukan buat hari ini)
    const effectiveDay = Math.min(daysInMonth, Math.max(1, rawCurrentDay + dayOffset));
    // Remaining days in month includes today in active progress count
    const daysRemaining = isCurrentMonth ? Math.max(1, daysInMonth - rawCurrentDay + 1) : 1;

    let target = baseMonthlyTarget;
    let achieved = monthlyComparison.curOmset;
    let grainTitle = 'Target Omzet Bulanan';
    let grainSubtitle = `Bulan ini (Hari ke-${effectiveDay} dari ${daysInMonth} Hari)`;

    if (targetGrain === 'HARIAN') {
      target = Math.round(baseMonthlyTarget / daysInMonth);
      achieved = todayOmset;
      grainTitle = 'Target Omzet Harian';
      grainSubtitle = `Progress Hari Ini (${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}${dayOffset !== 0 ? ` • Target Maju +${dayOffset} Hari` : ''})`;
    } else if (targetGrain === 'MINGGUAN') {
      target = Math.round((baseMonthlyTarget / daysInMonth) * 7);
      achieved = weekOmset;
      grainTitle = 'Target Omzet Mingguan';
      grainSubtitle = `Minggu Ini (7 Hari Terakhir${dayOffset !== 0 ? ` • Progress Maju +${dayOffset} Hari` : ''})`;
    } else {
      // BULANAN
      target = baseMonthlyTarget;
      achieved = monthlyComparison.curOmset;
      grainTitle = 'Target Omzet Bulanan';
      grainSubtitle = `Hari ke-${effectiveDay} dari ${daysInMonth} Hari (${new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}${dayOffset !== 0 ? ` • Progress Maju +${dayOffset} Hari` : ''})`;
    }

    const percent = Math.min(100, Math.round((achieved / target) * 100));
    const remaining = Math.max(0, target - achieved);

    const remainingMonthlyOmset = Math.max(0, baseMonthlyTarget - monthlyComparison.curOmset);
    const requiredDailyRate = daysRemaining > 0 && remainingMonthlyOmset > 0 
      ? Math.ceil(remainingMonthlyOmset / daysRemaining) 
      : 0;

    const currentDailyAvg = rawCurrentDay > 0 ? Math.round(monthlyComparison.curOmset / rawCurrentDay) : 0;
    const expectedPace = Math.round((baseMonthlyTarget / daysInMonth) * effectiveDay);

    return {
      baseMonthlyTarget,
      target,
      achieved,
      percent,
      remaining,
      daysInMonth,
      currentDay: rawCurrentDay,
      effectiveDay,
      daysRemaining,
      requiredDailyRate,
      currentDailyAvg,
      expectedPace,
      grainTitle,
      grainSubtitle,
      isCurrentMonth,
    };
  }, [salesTarget, monthlyComparison, targetGrain, dayOffset, todayOmset, weekOmset]);

  // Top Products Ranking
  const topProducts = useMemo(() => {
    const map = new Map<string, { sku: string; name: string; category: string; qty: number; revenue: number; margin: number }>();

    allFlattenedItems.forEach((it) => {
      if (selectedMonth !== 'ALL' && (!it.dateYmd || !it.dateYmd.startsWith(selectedMonth))) return;

      const key = it.sku || it.name;
      const existing = map.get(key) || {
        sku: it.sku,
        name: it.name,
        category: it.category,
        qty: 0,
        revenue: 0,
        margin: 0,
      };

      existing.qty += it.qty;
      existing.revenue += it.total;
      existing.margin += it.margin;
      map.set(key, existing);
    });

    const list = Array.from(map.values()).sort((a, b) => b.qty - a.qty);
    const maxQty = list.length > 0 ? list[0].qty : 1;

    return list.slice(0, 8).map((p, idx) => ({
      ...p,
      rank: idx + 1,
      percentOfTop: Math.round((p.qty / maxQty) * 100),
    }));
  }, [allFlattenedItems, selectedMonth]);

  // Chart Trend Data (Grouped by Date for Recharts)
  const chartTrendData = useMemo(() => {
    const map = new Map<string, { dateYmd: string; dateLabel: string; omset: number; margin: number; financeIncome: number; financeExpense: number }>();

    if (selectedMonth !== 'ALL') {
      // Seed all days in the selected month (1..daysInMonth)
      const [year, month] = selectedMonth.split('-').map(Number);
      const totalDays = new Date(year, month, 0).getDate();
      for (let day = 1; day <= totalDays; day++) {
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month).padStart(2, '0');
        const ymd = `${year}-${monthStr}-${dayStr}`;
        const label = `${dayStr}/${monthStr}`;
        map.set(ymd, { dateYmd: ymd, dateLabel: label, omset: 0, margin: 0, financeIncome: 0, financeExpense: 0 });
      }
    } else {
      // Seed last 14 days
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ymd = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        map.set(ymd, { dateYmd: ymd, dateLabel: label, omset: 0, margin: 0, financeIncome: 0, financeExpense: 0 });
      }
    }

    transactions.forEach((t) => {
      const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
      if (!ymd) return;

      if (selectedMonth !== 'ALL' && !ymd.startsWith(selectedMonth)) return;

      const existing = map.get(ymd);
      if (existing) {
        existing.omset += Number(t.subtotal || t.total || 0);
        existing.margin += Number(t.margin || 0);
      } else if (selectedMonth === 'ALL') {
        const dParts = ymd.split('-');
        const label = `${dParts[2]}/${dParts[1]}`;
        map.set(ymd, {
          dateYmd: ymd,
          dateLabel: label,
          omset: Number(t.subtotal || t.total || 0),
          margin: Number(t.margin || 0),
          financeIncome: 0,
          financeExpense: 0,
        });
      }
    });

    financeRecords.forEach((f) => {
      const ymd = f.dateYmd || normalizeDateToYmd(f.date || '');
      if (!ymd) return;

      if (selectedMonth !== 'ALL' && !ymd.startsWith(selectedMonth)) return;

      const existing = map.get(ymd);
      if (existing) {
        if (f.type === 'INCOME') {
          existing.financeIncome += f.amount;
        } else {
          existing.financeExpense += f.amount;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.dateYmd.localeCompare(b.dateYmd));
  }, [transactions, financeRecords, selectedMonth]);

  // Net Cash Flow Aggregations
  const totalSalesOmset = useMemo(() => {
    return transactions
      .filter((t) => {
        if (selectedMonth === 'ALL') return true;
        const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
        return ymd ? ymd.startsWith(selectedMonth) : true;
      })
      .reduce((sum, t) => sum + Number(t.subtotal || t.total || 0), 0);
  }, [transactions, selectedMonth]);

  const totalSalesMargin = useMemo(() => {
    return transactions
      .filter((t) => {
        if (selectedMonth === 'ALL') return true;
        const ymd = normalizeDateToYmd(t.date || t.transactionDate || '');
        return ymd ? ymd.startsWith(selectedMonth) : true;
      })
      .reduce((sum, t) => sum + Number(t.margin || 0), 0);
  }, [transactions, selectedMonth]);

  const totalFinanceIncome = useMemo(() => {
    return financeRecords
      .filter((f) => {
        if (f.type !== 'INCOME') return false;
        if (selectedMonth === 'ALL') return true;
        const ymd = f.dateYmd || normalizeDateToYmd(f.date || '');
        return ymd ? ymd.startsWith(selectedMonth) : true;
      })
      .reduce((sum, f) => sum + f.amount, 0);
  }, [financeRecords, selectedMonth]);

  const totalFinanceExpense = useMemo(() => {
    return financeRecords
      .filter((f) => {
        if (f.type !== 'EXPENSE') return false;
        if (selectedMonth === 'ALL') return true;
        const ymd = f.dateYmd || normalizeDateToYmd(f.date || '');
        return ymd ? ymd.startsWith(selectedMonth) : true;
      })
      .reduce((sum, f) => sum + f.amount, 0);
  }, [financeRecords, selectedMonth]);

  const totalUangMasuk = totalSalesOmset + totalFinanceIncome;
  const totalUangKeluar = totalFinanceExpense;
  const netCashFlow = totalUangMasuk - totalUangKeluar;

  // Filtered Items for Sales Log View
  const filteredItems = useMemo(() => {
    const todayYmd = new Date().toISOString().slice(0, 10);
    const now = new Date();

    return allFlattenedItems.filter((item) => {
      if (selectedMonth !== 'ALL') {
        if (!item.dateYmd || !item.dateYmd.startsWith(selectedMonth)) return false;
      }

      if (timeFilter === 'TODAY') {
        if (item.dateYmd !== todayYmd) return false;
      } else if (timeFilter === '7DAYS') {
        const itemDate = new Date(item.dateYmd);
        const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (timeFilter === '30DAYS') {
        const itemDate = new Date(item.dateYmd);
        const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }

      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (paymentFilter !== 'ALL' && item.paymentMethod !== paymentFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.customer.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.trxId.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allFlattenedItems, timeFilter, categoryFilter, paymentFilter, searchQuery]);

  // Group items by date for BY_DATE view
  const dateGroups = useMemo(() => {
    const map = new Map<string, DateSalesGroup>();

    filteredItems.forEach((item) => {
      const key = item.dateStr || 'Lainnya';
      const dateYmd = item.dateYmd;

      if (!map.has(key)) {
        map.set(key, {
          dateKey: key,
          dateDisplay: key,
          dateYmd,
          totalOmset: 0,
          totalHPP: 0,
          totalMargin: 0,
          totalQty: 0,
          itemCount: 0,
          paymentMethods: {},
          items: [],
          rawReceipt: item.rawReceipt,
        });
      }

      const group = map.get(key)!;
      group.totalOmset += item.total;
      group.totalHPP += (item.cost * item.qty);
      group.totalMargin += item.margin;
      group.totalQty += item.qty;
      group.itemCount += 1;
      group.items.push(item);

      const pm = item.paymentMethod || 'CASH';
      group.paymentMethods[pm] = (group.paymentMethods[pm] || 0) + item.total;
    });

    return Array.from(map.values()).sort((a, b) => b.dateYmd.localeCompare(a.dateYmd));
  }, [filteredItems]);

  // CSV Export
  const exportToCSV = () => {
    const headers = ['ID Transaksi', 'Tanggal', 'Jam', 'SKU', 'Nama Produk', 'Kategori', 'Harga Jual', 'HPP Cost', 'Qty', 'Total Omset', 'Margin Profit', 'Pelanggan', 'Metode Bayar'];
    const rows = filteredItems.map((it) => [
      it.trxId,
      it.dateStr,
      it.timeStr,
      `"${it.sku}"`,
      `"${it.name}"`,
      `"${it.category}"`,
      it.price,
      it.cost,
      it.qty,
      it.total,
      it.margin,
      `"${it.customer}"`,
      it.paymentMethod,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Penjualan_ORTUKILL_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Top Navigation & Sub-Tab Selector */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-xs border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#1E232D] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              Laporan Keuangan & Analytics
            </span>
            <span className="text-stone-400 text-xs font-medium">• ORTUKILL POS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight mt-1">
            {activeSubTab === 'ANALYTICS' && 'Grafik Performance & Target Penjualan'}
            {activeSubTab === 'FINANCE_KAS' && 'Buku Kas Non-Penjualan'}
            {activeSubTab === 'SALES_LOG' && 'Riwayat & Log Nota Penjualan'}
          </h2>
        </div>

        {/* Sub-tab Switcher Buttons */}
        <div className="flex items-center gap-1.5 bg-stone-100/90 p-1.5 rounded-2xl border border-stone-200/60 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('ANALYTICS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'ANALYTICS'
                ? 'bg-[#FF5E36] text-white shadow-md'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Grafik & Target</span>
          </button>

          <button
            onClick={() => setActiveSubTab('FINANCE_KAS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'FINANCE_KAS'
                ? 'bg-[#FF5E36] text-white shadow-md'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Buku Kas / Pengeluaran</span>
          </button>

          <button
            onClick={() => setActiveSubTab('SALES_LOG')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'SALES_LOG'
                ? 'bg-[#FF5E36] text-white shadow-md'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Log Nota Detail</span>
          </button>
        </div>
      </div>

      {/* Global Month Filter Control Bar */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-stone-800 bg-stone-100 px-3 py-1.5 rounded-2xl border border-stone-200/60">
            <Calendar className="w-4 h-4 text-[#FF5E36]" />
            <span>Filter Periode:</span>
          </div>

          {/* Quick Grain Filter Pills (Harian, Mingguan, Bulanan) */}
          <div className="flex items-center bg-stone-100/90 p-1 rounded-2xl border border-stone-200/80">
            <button
              onClick={() => {
                setTimeFilter('TODAY');
                setTargetGrain('HARIAN');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeFilter === 'TODAY' && targetGrain === 'HARIAN'
                  ? 'bg-[#1E232D] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => {
                setTimeFilter('7DAYS');
                setTargetGrain('MINGGUAN');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeFilter === '7DAYS' && targetGrain === 'MINGGUAN'
                  ? 'bg-[#1E232D] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Mingguan
            </button>
            <button
              onClick={() => {
                setTimeFilter('30DAYS');
                setTargetGrain('BULANAN');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                (timeFilter === '30DAYS' || timeFilter === 'ALL') && targetGrain === 'BULANAN'
                  ? 'bg-[#1E232D] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Bulanan
            </button>
          </div>

          <div className="h-4 w-px bg-stone-200 mx-1 hidden sm:block" />

          {/* Quick Month Filter Buttons */}
          <button
            onClick={() => {
              setSelectedMonth('ALL');
              setTimeFilter('ALL');
            }}
            className={`px-3 py-1.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
              selectedMonth === 'ALL'
                ? 'bg-stone-200 text-stone-900'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/80'
            }`}
          >
            Semua Bulan
          </button>

          {(() => {
            const now = new Date();
            const curStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            return (
              <button
                onClick={() => {
                  setSelectedMonth(curStr);
                  setTargetGrain('BULANAN');
                }}
                className={`px-3 py-1.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                  selectedMonth === curStr
                    ? 'bg-[#FF5E36] text-white shadow-xs'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/80'
                }`}
              >
                Bulan Ini ({formatMonthLabel(curStr)})
              </button>
            );
          })()}

          {/* Dropdown for specific month selection */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setTargetGrain('BULANAN');
              }}
              className="appearance-none bg-stone-50 text-stone-800 text-xs font-extrabold pl-3.5 pr-8 py-1.5 rounded-2xl border border-stone-200 hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/30 cursor-pointer min-h-[36px]"
            >
              <option value="ALL">Pilih Bulan Lain...</option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym}>
                  {formatMonthLabel(ym)} ({ym})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Active Month Indicator */}
        {selectedMonth !== 'ALL' && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-extrabold bg-[#FFF2ED] text-[#FF5E36] px-3 py-1 rounded-2xl border border-[#FF5E36]/30 flex items-center gap-1.5">
              <span>Periode: <strong>{formatMonthLabel(selectedMonth)}</strong></span>
            </span>
            <button
              onClick={() => setSelectedMonth('ALL')}
              className="text-[11px] font-bold text-stone-500 hover:text-stone-900 underline cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* SUB TAB 1: ANALYTICS & GRAPH DASHBOARD */}
      {activeSubTab === 'ANALYTICS' && (
        <div className="space-y-6">
          {/* Target Penjualan Bulanan Card */}
          <div className="bg-gradient-to-br from-[#1E232D] via-stone-900 to-stone-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-40 h-40 bg-[#FF5E36]/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              {/* Target Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FF5E36] flex items-center justify-center text-white shadow-lg flex-shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">
                      {targetProgress.grainTitle}
                    </h3>
                    <p className="text-xs text-stone-300">
                      {targetProgress.grainSubtitle}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Grain Switcher Buttons: Harian, Mingguan, Bulanan */}
                  <div className="flex items-center bg-white/10 p-1 rounded-2xl border border-white/15">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetGrain('HARIAN');
                        setTimeFilter('TODAY');
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        targetGrain === 'HARIAN'
                          ? 'bg-[#FF5E36] text-white shadow-md'
                          : 'text-stone-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      Harian
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetGrain('MINGGUAN');
                        setTimeFilter('7DAYS');
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        targetGrain === 'MINGGUAN'
                          ? 'bg-[#FF5E36] text-white shadow-md'
                          : 'text-stone-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      Mingguan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetGrain('BULANAN');
                        setTimeFilter('30DAYS');
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        targetGrain === 'BULANAN'
                          ? 'bg-[#FF5E36] text-white shadow-md'
                          : 'text-stone-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      Bulanan
                    </button>
                  </div>

                  {/* Advance 1 Day Button (+1) */}
                  <button
                    type="button"
                    onClick={() => setDayOffset((prev) => (prev === 1 ? 0 : 1))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black border transition-all cursor-pointer ${
                      dayOffset === 1
                        ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md ring-2 ring-amber-400/30'
                        : 'bg-white/10 text-stone-200 border-white/20 hover:bg-white/20'
                    }`}
                    title="Maju 1 hari untuk target & progress yang ditujukan buat hari ini"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-900" />
                    <span>{dayOffset === 1 ? '⏩ Maju +1 Hari' : '▶️ Hari Ini (+0)'}</span>
                  </button>

                  {/* Target Edit Button or Inline Form */}
                  {isEditingTarget ? (
                    <form onSubmit={handleTargetSubmit} className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="1000000"
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        className="px-3 py-1 rounded-xl bg-white text-stone-900 font-bold text-xs w-32 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingTarget(false)}
                        className="px-2.5 py-1 rounded-xl bg-stone-700 text-stone-300 font-bold text-xs"
                      >
                        Batal
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        setTargetInput(String(salesTarget.targetAmount || 50000000));
                        setIsEditingTarget(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#FF5E36]" />
                      <span>Edit Base</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar & Key Numbers */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                <div className="md:col-span-8 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-stone-300">
                      Capaian: <span className="text-white text-sm font-black">{formatRupiah(targetProgress.achieved)}</span>
                    </span>
                    <span className="text-[#FF5E36] font-black text-base">
                      {targetProgress.percent}% Tercapai
                    </span>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#FF643D] via-[#FF5E36] to-emerald-400 transition-all duration-1000 shadow-[0_0_12px_rgba(255,94,54,0.6)]"
                      style={{ width: `${targetProgress.percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-400 pt-0.5">
                    <span>Target: {formatRupiah(targetProgress.target)}</span>
                    <span>Sisa Target: {formatRupiah(targetProgress.remaining)}</span>
                  </div>
                </div>

                {/* Insight & Run-Rate Box */}
                <div className="md:col-span-4 bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
                    <span>Analisis Proyeksi</span>
                  </div>
                  <p className="text-[11px] text-stone-200 leading-snug">
                    {targetProgress.remaining <= 0 ? (
                      <span className="text-emerald-400 font-bold">
                        🎉 Luar Biasa! Target omzet bulan ini sudah 100% TERCAPAI!
                      </span>
                    ) : (
                      <>
                        Butuh rata-rata <span className="font-extrabold text-white">{formatRupiah(targetProgress.requiredDailyRate)}/hari</span> selama {targetProgress.daysRemaining} hari ke depan untuk capai target.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* MoM Growth Cards (Month-over-Month Comparison) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* MoM Omzet */}
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80 space-y-2">
              <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
                <span>Omzet Bulan Ini (MoM)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
                  monthlyComparison.omsetGrowth >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {monthlyComparison.omsetGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {monthlyComparison.omsetGrowth >= 0 ? `+${monthlyComparison.omsetGrowth}%` : `${monthlyComparison.omsetGrowth}%`}
                </span>
              </div>
              <p className="text-xl font-black text-stone-900 tracking-tight">
                {formatRupiah(monthlyComparison.curOmset)}
              </p>
              <p className="text-[11px] text-stone-400">
                vs Bulan Lalu: {formatRupiah(monthlyComparison.prevOmset)}
              </p>
            </div>

            {/* MoM Keuntungan / Margin */}
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80 space-y-2">
              <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
                <span>Margin Keuntungan (MoM)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
                  monthlyComparison.marginGrowth >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {monthlyComparison.marginGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {monthlyComparison.marginGrowth >= 0 ? `+${monthlyComparison.marginGrowth}%` : `${monthlyComparison.marginGrowth}%`}
                </span>
              </div>
              <p className="text-xl font-black text-emerald-700 tracking-tight">
                {formatRupiah(monthlyComparison.curMargin)}
              </p>
              <p className="text-[11px] text-stone-400">
                vs Bulan Lalu: {formatRupiah(monthlyComparison.prevMargin)}
              </p>
            </div>

            {/* MoM Jumlah Transaksi */}
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80 space-y-2">
              <div className="flex items-center justify-between text-stone-500 text-xs font-bold">
                <span>Total Transaksi (MoM)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
                  monthlyComparison.trxGrowth >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {monthlyComparison.trxGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {monthlyComparison.trxGrowth >= 0 ? `+${monthlyComparison.trxGrowth}%` : `${monthlyComparison.trxGrowth}%`}
                </span>
              </div>
              <p className="text-xl font-black text-stone-900 tracking-tight">
                {monthlyComparison.curTrxCount} Nota
              </p>
              <p className="text-[11px] text-stone-400">
                vs Bulan Lalu: {monthlyComparison.prevTrxCount} Nota
              </p>
            </div>
          </div>

          {/* Ringkasan Arus Kas Lengkap (Net Cash Flow Overview) */}
          <div className="bg-stone-900 text-white rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <CircleDollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base">Ringkasan Arus Kas & Saldo Bersih</h3>
              </div>
              <span className="text-[11px] text-stone-400 bg-white/10 px-3 py-1 rounded-full font-medium">
                Sistem Terpadu
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <p className="text-[10px] text-stone-400 font-bold uppercase">Omzet Penjualan</p>
                <p className="text-sm sm:text-base font-black text-white mt-1">
                  {formatRupiah(totalSalesOmset)}
                </p>
              </div>

              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <p className="text-[10px] text-stone-400 font-bold uppercase">Profit Margin</p>
                <p className="text-sm sm:text-base font-black text-emerald-400 mt-1">
                  {formatRupiah(totalSalesMargin)}
                </p>
              </div>

              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <p className="text-[10px] text-stone-400 font-bold uppercase">Total Uang Masuk (+)</p>
                <p className="text-sm sm:text-base font-black text-emerald-300 mt-1">
                  {formatRupiah(totalUangMasuk)}
                </p>
              </div>

              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <p className="text-[10px] text-stone-400 font-bold uppercase">Total Uang Keluar (-)</p>
                <p className="text-sm sm:text-base font-black text-rose-400 mt-1">
                  {formatRupiah(totalUangKeluar)}
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-[#FF5E36]/20 p-3 rounded-2xl border border-[#FF5E36]/40">
                <p className="text-[10px] text-[#FFA07A] font-bold uppercase">Arus Kas Bersih</p>
                <p className="text-sm sm:text-base font-black text-white mt-1">
                  {formatRupiah(netCashFlow)}
                </p>
              </div>
            </div>
          </div>

          {/* Recharts Area Chart: Trend Perkembangan Omzet & Keuntungan */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-stone-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-100">
              <div>
                <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#FF5E36]" />
                  <span>Grafik Perkembangan Omzet & Keuntungan</span>
                </h3>
                <p className="text-xs text-stone-500">Tren harian omzet penjualan vs margin profit bersih</p>
              </div>
            </div>

            {/* Recharts AreaChart Container */}
            <div className="w-full h-72 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOmset" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF5E36" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#FF5E36" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#6B7280' }} 
                    axisLine={false}
                    tickFormatter={(v) => `${v / 1000}k`}
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatRupiah(Number(value) || 0), '']}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #E5E7EB', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area type="monotone" dataKey="omset" name="Omzet Penjualan" stroke="#FF5E36" strokeWidth={3} fillOpacity={1} fill="url(#colorOmset)" />
                  <Area type="monotone" dataKey="margin" name="Profit Margin" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorMargin)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Selling Products Section */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-stone-200/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Trophy className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base">Produk Terlaris & Kontribusi Omzet</h3>
                  <p className="text-xs text-stone-500">Peringkat produk berdasarkan total quantity terjual</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topProducts.map((p) => {
                const rankBadges = ['🥇 #1', '🥈 #2', '🥉 #3'];
                const rankColor = p.rank === 1 
                  ? 'bg-amber-100 text-amber-800 border-amber-300' 
                  : p.rank === 2 
                  ? 'bg-stone-200 text-stone-800 border-stone-300' 
                  : p.rank === 3 
                  ? 'bg-orange-100 text-orange-800 border-orange-300' 
                  : 'bg-stone-100 text-stone-600 border-stone-200';

                return (
                  <div
                    key={p.sku}
                    className="p-3.5 rounded-2xl border border-stone-100 hover:border-stone-200 bg-stone-50/50 space-y-2 transition-all hover:shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${rankColor}`}>
                          {rankBadges[p.rank - 1] || `#${p.rank}`}
                        </span>
                        <span className="text-xs font-bold text-stone-900 truncate">
                          {p.name}
                        </span>
                      </div>
                      <span className="text-xs font-black text-[#FF5E36] bg-[#FFF2ED] px-2.5 py-0.5 rounded-full">
                        {p.qty} Terjual
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FF5E36] rounded-full transition-all duration-500"
                        style={{ width: `${p.percentOfTop}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span>Omzet: <strong className="text-stone-900">{formatRupiah(p.revenue)}</strong></span>
                      <span>Margin: <strong className="text-emerald-700">{formatRupiah(p.margin)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: CATATAN KEUANGAN NON-PENJUALAN */}
      {activeSubTab === 'FINANCE_KAS' && (
        <FinanceManagementView
          financeRecords={financeRecords}
          onAddRecord={onAddFinanceRecord}
          onDeleteRecord={onDeleteFinanceRecord}
          onSyncSpreadsheet={onSyncSpreadsheet}
          isSyncing={isSyncing}
        />
      )}

      {/* SUB TAB 3: LOG NOTA PENJUALAN DETAIL */}
      {activeSubTab === 'SALES_LOG' && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-xs border border-stone-200/80 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari SKU, Nama Produk, Nota ID, atau Pelanggan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5E36] bg-stone-50/50"
                />
              </div>

              {/* View mode toggle & Export */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-2xl border border-stone-200/60">
                  <button
                    onClick={() => setViewMode('BY_DATE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'BY_DATE' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
                    }`}
                  >
                    Group per Tanggal
                  </button>
                  <button
                    onClick={() => setViewMode('FLAT_LOG')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'FLAT_LOG' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
                    }`}
                  >
                    Flat Log Item
                  </button>
                </div>

                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
              <span className="text-stone-400 text-[11px] mr-1">Filter Periode:</span>
              {(['ALL', 'TODAY', '7DAYS', '30DAYS'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFilter(tf)}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                    timeFilter === tf
                      ? 'bg-[#1E232D] text-white border-transparent'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {tf === 'ALL' && 'Semua Waktu'}
                  {tf === 'TODAY' && 'Hari Ini'}
                  {tf === '7DAYS' && '7 Hari Terakhir'}
                  {tf === '30DAYS' && '30 Hari Terakhir'}
                </button>
              ))}
            </div>
          </div>

          {/* Grouped by Date View */}
          {viewMode === 'BY_DATE' ? (
            <div className="space-y-4">
              {dateGroups.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center text-stone-400">
                  <Receipt className="w-12 h-12 mx-auto stroke-[1.5] text-stone-300" />
                  <p className="text-sm font-bold text-stone-700 mt-2">Tidak ada data penjualan sesuai filter</p>
                </div>
              ) : (
                dateGroups.map((group) => {
                  const isExpanded = expandedDates[group.dateKey] !== false; // expanded by default
                  return (
                    <div
                      key={group.dateKey}
                      className="bg-white rounded-3xl shadow-xs border border-stone-200/80 overflow-hidden"
                    >
                      {/* Date Group Header */}
                      <div
                        onClick={() => toggleDateExpand(group.dateKey)}
                        className="p-4 sm:p-5 bg-stone-50/80 hover:bg-stone-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors border-b border-stone-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#FF5E36] text-white flex items-center justify-center font-bold">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-base font-black text-stone-900">
                              {group.dateDisplay}
                            </h4>
                            <p className="text-xs text-stone-500 font-medium">
                              {group.items.length} item terjual • {group.totalQty} Pcs total
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="text-right">
                            <p className="text-base font-black text-stone-900">
                              {formatRupiah(group.totalOmset)}
                            </p>
                            <p className="text-xs font-bold text-emerald-700">
                              Margin: +{formatRupiah(group.totalMargin)}
                            </p>
                          </div>

                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-stone-500 shadow-xs">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Items Table inside Date Group */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 space-y-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                                  <th className="pb-2">Waktu / Nota ID</th>
                                  <th className="pb-2">SKU & Nama Produk</th>
                                  <th className="pb-2 text-center">Harga Jual</th>
                                  <th className="pb-2 text-center">Qty</th>
                                  <th className="pb-2 text-right">Total Omset</th>
                                  <th className="pb-2 text-right">Margin Profit</th>
                                  <th className="pb-2 text-center">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {group.items.map((it) => (
                                  <tr key={it.id} className="hover:bg-stone-50/60 transition-colors">
                                    <td className="py-2.5 font-mono text-stone-600">
                                      {it.timeStr || it.dateStr}
                                      <span className="block text-[10px] text-stone-400">{it.trxId}</span>
                                    </td>
                                    <td className="py-2.5">
                                      <p className="font-bold text-stone-900">{it.name}</p>
                                      <p className="text-[10px] text-stone-400 font-mono">{it.sku}</p>
                                    </td>
                                    <td className="py-2.5 text-center font-medium">
                                      {formatRupiah(it.price)}
                                    </td>
                                    <td className="py-2.5 text-center">
                                      <span className="font-bold bg-stone-100 px-2 py-0.5 rounded-full text-stone-800">
                                        {it.qty}
                                      </span>
                                    </td>
                                    <td className="py-2.5 text-right font-black text-stone-900">
                                      {formatRupiah(it.total)}
                                    </td>
                                    <td className="py-2.5 text-right font-bold text-emerald-700">
                                      +{formatRupiah(it.margin)}
                                    </td>
                                    <td className="py-2.5 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={() => onViewReceipt(it.rawReceipt)}
                                          className="p-1.5 text-stone-400 hover:text-[#FF5E36] hover:bg-[#FFF2ED] rounded-xl transition-all cursor-pointer"
                                          title="Lihat Nota"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                        {(onDeleteTransaction || onVoidTransaction) && (
                                          <button
                                            onClick={() => setDeletingTrx(it.rawReceipt)}
                                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                            title="Hapus Transaksi & Hapus Baris di Google Sheets"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Flat Log Item View */
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-stone-200/80">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                      <th className="pb-3">Tanggal & Waktu</th>
                      <th className="pb-3">SKU & Nama Produk</th>
                      <th className="pb-3">Kategori</th>
                      <th className="pb-3 text-center">Harga Jual</th>
                      <th className="pb-3 text-center">Qty</th>
                      <th className="pb-3 text-right">Total Omset</th>
                      <th className="pb-3 text-right">Margin Profit</th>
                      <th className="pb-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredItems.map((it) => (
                      <tr key={it.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 font-mono text-stone-600">
                          {it.dateTimeStr || it.dateStr}
                        </td>
                        <td className="py-3">
                          <p className="font-bold text-stone-900">{it.name}</p>
                          <p className="text-[10px] text-stone-400 font-mono">{it.sku}</p>
                        </td>
                        <td className="py-3">
                          <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {it.category}
                          </span>
                        </td>
                        <td className="py-3 text-center font-medium">
                          {formatRupiah(it.price)}
                        </td>
                        <td className="py-3 text-center">
                          <span className="font-bold bg-stone-100 px-2 py-0.5 rounded-full text-stone-800">
                            {it.qty}
                          </span>
                        </td>
                        <td className="py-3 text-right font-black text-stone-900">
                          {formatRupiah(it.total)}
                        </td>
                        <td className="py-3 text-right font-bold text-emerald-700">
                          +{formatRupiah(it.margin)}
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onViewReceipt(it.rawReceipt)}
                              className="p-1.5 text-stone-400 hover:text-[#FF5E36] hover:bg-[#FFF2ED] rounded-xl transition-all cursor-pointer"
                              title="Lihat Nota"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {(onDeleteTransaction || onVoidTransaction) && (
                              <button
                                onClick={() => setDeletingTrx(it.rawReceipt)}
                                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                title="Hapus Transaksi & Hapus Baris di Google Sheets"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Konfirmasi Hapus Transaksi & Hapus Baris di Google Sheets */}
      {deletingTrx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-sm">Hapus Transaksi & Hapus di Sheets</h3>
                  <p className="text-[11px] text-stone-400 font-mono">ID: {deletingTrx.id}</p>
                </div>
              </div>
              <button
                onClick={() => setDeletingTrx(null)}
                className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50/70 border border-rose-100 p-3.5 rounded-2xl text-xs text-rose-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Peringatan Penghapusan Permanen:</span>
              </p>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Tindakan ini akan <strong>menghapus baris transaksi #{deletingTrx.id} dari sheet LOG_PENJUALAN</strong> di Google Spreadsheet secara permanen dan menghapusnya dari riwayat penjualan aplikasi.
              </p>
            </div>

            <div className="bg-stone-50 p-3 rounded-2xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Tanggal:</span>
                <span className="font-semibold text-stone-800">{deletingTrx.transactionDate || deletingTrx.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Total Belanja:</span>
                <span className="font-bold text-stone-900">{formatRupiah(deletingTrx.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Pelanggan:</span>
                <span className="text-stone-800">{deletingTrx.customerName || 'Umum'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTrx(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50 cursor-pointer min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = deletingTrx.id;
                  setDeletingTrx(null);
                  if (onDeleteTransaction) {
                    onDeleteTransaction(targetId);
                  } else if (onVoidTransaction) {
                    onVoidTransaction(targetId, 'Dihapus dari Riwayat Penjualan');
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer min-h-[44px]"
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
