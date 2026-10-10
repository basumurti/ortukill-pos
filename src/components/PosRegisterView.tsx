import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  Banknote, 
  CreditCard, 
  QrCode, 
  User, 
  Tag, 
  Check, 
  Sparkles,
  AlertTriangle,
  ChevronUp,
  ChevronRight,
  X,
  TrendingUp,
  Receipt,
  Layers,
  ShoppingBag,
  Truck,
  Printer,
  MessageSquare,
  Download,
  RotateCcw,
  Calendar,
  Package,
  Wallet,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  ArrowRight,
  Gift,
  Percent,
  Loader2
} from 'lucide-react';
import { Product, CartItem, PaymentMethod, BrandConfig, PromoRule } from '../types';
import { formatRupiah } from '../services/storageService';
import { PromoSelectorModal } from './PromoSelectorModal';

interface PosRegisterViewProps {
  products: Product[];
  cart: CartItem[];
  customerName: string;
  setCustomerName: (name: string) => void;
  discount: number;
  setDiscount: (discount: number) => void;
  promoCode?: string;
  setPromoCode?: (code: string) => void;
  promoName?: string;
  setPromoName?: (name: string) => void;
  shippingFee: number;
  setShippingFee: (fee: number) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (pm: PaymentMethod) => void;
  cashReceived: number;
  setCashReceived: (cash: number) => void;
  onAddToCart: (product: Product) => void;
  onUpdateQty: (productId: string, qty: number) => void;
  onUpdateItemPrice: (productId: string, newPrice: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onClearCart: () => void;
  onProcessCheckout: () => void;
  brand?: BrandConfig;
  todayOmset?: number;
  todayMargin?: number;
  todayCount?: number;
  isConnectedGas?: boolean;
  onNavigateTab?: (tab: 'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas') => void;
  isRedPriceMode?: boolean;
  onToggleRedPriceMode?: (enabled: boolean) => void;
}

export const PosRegisterView: React.FC<PosRegisterViewProps> = ({
  products,
  cart,
  customerName,
  setCustomerName,
  discount,
  setDiscount,
  promoCode = '',
  setPromoCode,
  promoName = '',
  setPromoName,
  shippingFee,
  setShippingFee,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  onAddToCart,
  onUpdateQty,
  onUpdateItemPrice,
  onRemoveFromCart,
  onClearCart,
  onProcessCheckout,
  brand,
  todayOmset = 0,
  todayMargin = 0,
  todayCount = 0,
  isConnectedGas = false,
  onNavigateTab,
  isRedPriceMode = false,
  onToggleRedPriceMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Kategori murni 100% dinamis mengikuti isi Kolom J di Google Sheets
  const presentCategories = Array.from(
    new Set(
      products
        .map((p) => (p.category ? String(p.category).trim() : ''))
        .filter((c): c is string => Boolean(c))
    )
  ) as string[];

  const categories: string[] = ['ALL', ...presentCategories];

  // Category counts
  const categoryCounts: Record<string, number> = {
    ALL: products.length,
  };
  products.forEach((p) => {
    const cat = p.category ? String(p.category).trim() : 'Lainnya';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const skuUpper = String(p.sku || '').toUpperCase();
    const nameUpper = String(p.name || '').toUpperCase();
    if (skuUpper.includes('PROMO') || nameUpper.includes('PROMO') || nameUpper.includes('POTONGAN') || p.category === 'PROMO') {
      return false;
    }
    const cat = p.category || 'Belum dikategorikan';
    if (selectedCategory !== 'ALL' && cat !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      cat.toLowerCase().includes(q)
    );
  });

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const finalTotal = Math.max(0, subtotal - discount + shippingFee);
  const change = cashReceived >= finalTotal ? cashReceived - finalTotal : 0;
  const isCashInsufficient = paymentMethod === 'CASH' && cashReceived > 0 && cashReceived < finalTotal;

  // Nilai khusus pencatatan Google Sheets (selalu menggunakan harga biasa)
  const sheetsRegularSubtotal = cart.reduce((sum, item) => {
    const reg = item.regularPrice || item.originalPrice || item.price;
    return sum + (reg * item.qty);
  }, 0);
  const sheetsRegularTotal = Math.max(0, sheetsRegularSubtotal - discount + shippingFee);

  // Quick cash options
  const quickCashOptions = [
    finalTotal,
    Math.ceil(finalTotal / 50000) * 50000 || 50000,
    Math.ceil(finalTotal / 100000) * 100000 || 100000,
    (Math.ceil(finalTotal / 100000) + 1) * 100000 || 200000,
  ].filter((val, index, self) => val > 0 && self.indexOf(val) === index);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckoutAndClose = () => {
    if (isSubmitting || cart.length === 0 || isCashInsufficient) return;
    setIsSubmitting(true);
    try {
      onProcessCheckout();
      setIsCartSheetOpen(false);
    } finally {
      setTimeout(() => setIsSubmitting(false), 1200);
    }
  };

  const getCartOrderShareText = () => {
    const itemLines = cart
      .map((i) => `• ${i.name} (${formatRupiah(i.price)}/btl) x${i.qty} = ${formatRupiah(i.subtotal)}${i.isRedPrice ? ' [Harga Merah]' : ''}`)
      .join('\n');

    return encodeURIComponent(
      `*NOTA PESANAN - ${brand?.NAME || 'ORTUKILL POS'}*${isRedPriceMode ? ' [MODE RESELLER]' : ''}\n` +
      `Waktu: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}\n` +
      (customerName ? `Pelanggan: ${customerName}\n` : '') +
      `Metode: ${paymentMethod}\n` +
      `--------------------------------\n` +
      `${itemLines}\n` +
      `--------------------------------\n` +
      `Subtotal: ${formatRupiah(subtotal)}\n` +
      (discount > 0 ? `Diskon: -${formatRupiah(discount)}\n` : '') +
      (shippingFee > 0 ? `Ongkir: +${formatRupiah(shippingFee)}\n` : '') +
      `*TOTAL: ${formatRupiah(finalTotal)}*\n` +
      (paymentMethod === 'CASH' && cashReceived ? `Tunai: ${formatRupiah(cashReceived)}\nKembalian: ${formatRupiah(change)}\n` : '') +
      `--------------------------------\n` +
      `TERIMAKASIH SELAMAT-BERSENANG-SENANG * ATLAS AMER KEDIRI SIAP SEDIA Melayani Setiap Kebutuhan Minum Kamu.\n` +
      `Info: ${brand?.PHONE || '08777-977-9796'}`
    );
  };

  const handleShareCartWA = () => {
    if (cart.length === 0) return;
    const text = getCartOrderShareText();
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleDownloadCartOrder = () => {
    if (cart.length === 0) return;
    try {
      const canvas = document.createElement('canvas');
      const width = 420;
      const padding = 24;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dynamicHeight = 380 + (cart.length * 44);
      canvas.width = width;
      canvas.height = dynamicHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, dynamicHeight);

      ctx.fillStyle = '#0c0a09';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(brand?.NAME || 'ORTUKILL POS', width / 2, 40);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#44403c';
      ctx.fillText(brand?.SUBTITLE || 'POS / KASIR', width / 2, 60);
      ctx.fillText(brand?.DESCRIPTION_1 || '', width / 2, 78);
      ctx.fillText(`WA: ${brand?.PHONE || '087779779796'}`, width / 2, 96);

      ctx.strokeStyle = '#cbd5e1';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding, 110);
      ctx.lineTo(width - padding, 110);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = '11px monospace';
      ctx.fillStyle = '#334155';
      let y = 132;
      ctx.fillText(`DRAF PESANAN / NOTA`, padding, y);
      y += 18;
      ctx.fillText(`Waktu    : ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`, padding, y);
      y += 18;
      ctx.fillText(`Metode   : ${paymentMethod}`, padding, y);
      if (customerName) {
        y += 18;
        ctx.fillText(`Customer : ${customerName}`, padding, y);
      }

      y += 14;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      y += 22;

      cart.forEach((item) => {
        ctx.textAlign = 'left';
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(item.name, padding, y);
        y += 16;
        ctx.font = '11px monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${item.qty} x ${formatRupiah(item.price)}`, padding, y);
        ctx.textAlign = 'right';
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(formatRupiah(item.subtotal), width - padding, y);
        y += 22;
      });

      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      y += 20;

      ctx.textAlign = 'left';
      ctx.font = '11px monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`Total Item: ${totalQty} botol`, padding, y);
      y += 18;

      if (discount > 0) {
        ctx.fillText(`Subtotal`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(formatRupiah(subtotal), width - padding, y);
        y += 18;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#dc2626';
        ctx.fillText(`Diskon`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(`-${formatRupiah(discount)}`, width - padding, y);
        y += 18;
      }

      if (shippingFee > 0) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ea580c';
        ctx.fillText(`Ongkir`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(`+${formatRupiah(shippingFee)}`, width - padding, y);
        y += 18;
      }

      ctx.strokeStyle = '#0f172a';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      y += 24;

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#020617';
      ctx.fillText(`TOTAL AKHIR`, padding, y);
      ctx.textAlign = 'right';
      ctx.fillText(formatRupiah(finalTotal), width - padding, y);
      y += 24;

      ctx.textAlign = 'center';
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`***SELAMAT BERSENANG-SENANG BESOK MINUM LAGIII!!***`, width / 2, y);
      y += 16;
      ctx.font = '9px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`JANGAN LUPA BINTANG 5 DI GOOGLE MAPS YAA.`, width / 2, y);
      y += 14;
      ctx.fillText(`••• ATLAS AMER KEDIRI •••`, width / 2, y);

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Nota_${customerName ? customerName.replace(/[^a-zA-Z0-9]/g, '_') : 'Pesanan'}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Error generating cart order PNG:', e);
    }
  };

  const handlePrintCart = () => {
    window.print();
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto space-y-5">
      {/* 1. HERO HIGH-CONTRAST CARD (High contrast, WCAG AAA legibility, no nested cards) */}
      <section 
        id="pos-hero-section"
        className="relative overflow-hidden bg-[#121620] text-white rounded-[28px] p-5 sm:p-6 border border-stone-800 shadow-[0_16px_36px_-8px_rgba(15,23,42,0.3)]"
      >
        {/* Subtle high-contrast ambient depth */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#FF5E36]/15 via-[#FF5E36]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4.5">
          {/* Top Header: Cashier Profile & Connection Status */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF5E36] to-[#FF8059] flex items-center justify-center font-black text-white text-lg shadow-[0_4px_12px_rgba(255,94,54,0.35)] flex-shrink-0">
                O
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Selamat Bertugas Kasir
                </p>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  {brand?.NAME || 'ORTUKILL KEDIRI'}
                </h2>
              </div>
            </div>

            {/* High-Contrast Sync Pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border flex-shrink-0 ${
              isConnectedGas 
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400 shadow-xs' 
                : 'bg-stone-900 border-stone-700 text-stone-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnectedGas ? 'bg-emerald-400 animate-pulse ring-2 ring-emerald-500/30' : 'bg-amber-400'}`} />
              <span className="hidden sm:inline">{isConnectedGas ? 'Live Google Sheets' : 'Offline / Lokal'}</span>
              <span className="sm:hidden">{isConnectedGas ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Cart In-Progress Notification Pill */}
          {totalQty > 0 && (
            <div 
              onClick={() => setIsCartSheetOpen(true)}
              className="bg-[#FF5E36]/15 hover:bg-[#FF5E36]/25 border border-[#FF5E36]/40 rounded-full px-4 py-2 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] text-white shadow-xs"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-[#FFA07A]">
                <span className="w-5 h-5 rounded-full bg-[#FF5E36] text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                  {totalQty}
                </span>
                <span className="text-white">Ada {totalQty} botol pesanan aktif di keranjang kasir</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#FFA07A]" />
            </div>
          )}

          {/* Main Metric Row: Total Omset & Primary Action */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Total Omset Hari Ini
                </span>
                <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Shift Aktif
                </span>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {todayCount > 0 ? formatRupiah(todayOmset) : 'Rp 0'}
              </p>
              {!isConnectedGas && todayCount === 0 && (
                <p className="text-[11px] text-stone-400 mt-1">
                  Belum ada transaksi hari ini • Data lokal siap catat penjualan
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCartSheetOpen(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-[#FF5E36] to-[#FF7043] hover:brightness-110 active:scale-95 text-white rounded-full px-6 py-3 text-xs sm:text-sm font-black shadow-[0_4px_16px_rgba(255,94,54,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
                <span>{totalQty > 0 ? `Buka Keranjang (${totalQty})` : 'Buka Keranjang'}</span>
              </button>
            </div>
          </div>

          {/* High-Contrast Sub-Metric Tiles (Clean, un-nested) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-2xl p-3 transition-colors">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Estimasi Laba
              </p>
              <p className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
                {todayCount > 0 ? formatRupiah(todayMargin) : 'Rp 0'}
              </p>
            </div>

            <div className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-2xl p-3 transition-colors">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Total Transaksi
              </p>
              <p className="text-base sm:text-lg font-black text-white mt-0.5">
                {todayCount > 0 ? `${todayCount} Nota` : '0 Nota'}
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-2xl p-3 flex items-center justify-between sm:flex-col sm:items-start transition-colors">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Status Operasional
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs sm:text-sm font-extrabold text-emerald-300">Siap Melayani</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. LAYANAN & AKSI CEPAT (Inspired by "Services" in the reference image) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-stone-600 uppercase tracking-wider">
            Layanan & Aksi Cepat
          </p>
          <span className="text-[11px] text-stone-400 font-medium">1-Tap Akses</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          {/* Quick Service: Toggle Mode Reseller / Harga Merah */}
          <button
            type="button"
            id="quick-toggle-red-price"
            onClick={() => onToggleRedPriceMode?.(!isRedPriceMode)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 shadow-xs border transition-all cursor-pointer whitespace-nowrap text-xs font-bold active:scale-95 ${
              isRedPriceMode
                ? 'bg-rose-600 text-white border-rose-600 shadow-rose-600/20 ring-2 ring-rose-300/40'
                : 'bg-white text-stone-800 border-stone-200/70 hover:border-stone-300 hover:bg-stone-50'
            }`}
            title="Klik untuk beralih antara harga biasa dan harga jual merah (reseller)"
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isRedPriceMode ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'
            }`}>
              <Tag className="w-3.5 h-3.5" />
            </div>
            <span>Mode Reseller</span>
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
              isRedPriceMode ? 'bg-white text-rose-700' : 'bg-stone-100 text-stone-500'
            }`}>
              {isRedPriceMode ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Quick Service: Bayar / Keranjang */}
          <button
            onClick={() => setIsCartSheetOpen(true)}
            className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-xs border border-stone-200/70 hover:border-stone-300 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer whitespace-nowrap text-xs font-bold text-stone-800"
          >
            <div className="w-6 h-6 rounded-full bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
            <span>Keranjang</span>
            {totalQty > 0 && (
              <span className="bg-[#FF5E36] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {totalQty}
              </span>
            )}
          </button>

          {/* Quick Service: Transaksi Hari Ini */}
          <button
            onClick={() => onNavigateTab?.('today')}
            className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-xs border border-stone-200/70 hover:border-stone-300 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer whitespace-nowrap text-xs font-bold text-stone-800"
          >
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <span>Nota Hari Ini</span>
          </button>

          {/* Quick Service: Riwayat Penjualan */}
          <button
            onClick={() => onNavigateTab?.('history')}
            className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-xs border border-stone-200/70 hover:border-stone-300 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer whitespace-nowrap text-xs font-bold text-stone-800"
          >
            <div className="w-6 h-6 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <span>Riwayat Lengkap</span>
          </button>

          {/* Quick Service: Cek & Kelola Stok */}
          <button
            onClick={() => onNavigateTab?.('stock')}
            className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-xs border border-stone-200/70 hover:border-stone-300 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer whitespace-nowrap text-xs font-bold text-stone-800"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </div>
            <span>Cek Stok</span>
          </button>

          {/* Quick Service: Tutup Shift Kasir */}
          <button
            onClick={() => onNavigateTab?.('shift')}
            className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-xs border border-stone-200/70 hover:border-stone-300 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer whitespace-nowrap text-xs font-bold text-stone-800"
          >
            <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <span>Tutup Shift</span>
          </button>

          {/* Quick Service: Integrasi GAS */}
          <button
            onClick={() => onNavigateTab?.('gas')}
            className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-xs border border-stone-200/70 hover:border-stone-300 hover:bg-stone-50 active:scale-95 transition-all cursor-pointer whitespace-nowrap text-xs font-bold text-stone-800"
          >
            <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <span>Spreadsheet GAS</span>
          </button>
        </div>
      </section>

      {/* 2.5 TOGGLE HARGA JUAL MERAH (RESELLER MAKE UP PRICE) */}
      <section>
        <div 
          id="toggle-red-price-banner"
          className={`rounded-[24px] p-4 sm:p-4.5 border transition-all duration-200 select-none shadow-xs ${
            isRedPriceMode
              ? 'bg-gradient-to-r from-[#2a0d14] via-[#1f0b10] to-[#2a0d14] border-rose-500/60 shadow-rose-950/20 text-white'
              : 'bg-white border-stone-200/80 hover:border-stone-300 text-stone-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-start sm:items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
                isRedPriceMode 
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/40 ring-2 ring-rose-400/40' 
                  : 'bg-rose-50 text-rose-600 border border-rose-100'
              }`}>
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`text-xs sm:text-sm font-black tracking-tight ${isRedPriceMode ? 'text-white' : 'text-stone-950'}`}>
                    Mode Reseller / Harga Jual Merah
                  </h4>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors ${
                    isRedPriceMode
                      ? 'bg-rose-500 text-white animate-pulse shadow-xs shadow-rose-500/50'
                      : 'bg-stone-100 text-stone-600 border border-stone-200'
                  }`}>
                    {isRedPriceMode ? 'SEMUA HARGA MERAH AKTIF' : 'HARGA BIASA AKTIF'}
                  </span>
                </div>
                <p className={`text-[11px] sm:text-xs mt-0.5 leading-relaxed ${isRedPriceMode ? 'text-rose-200' : 'text-stone-500'}`}>
                  {isRedPriceMode ? (
                    <span>
                      Katalog & kasir menggunakan <strong>harga jual merah</strong> (make up reseller). Di Google Sheets (LOG_PENJUALAN) tetap otomatis dicatat dengan <strong>harga biasa</strong>.
                    </span>
                  ) : (
                    <span>
                      Katalog kasir menggunakan harga jual normal konsumen. Klik tombol toggle di samping untuk beralih ke harga jual merah reseller.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 sm:border-none flex-shrink-0">
              <span className={`text-xs font-bold sm:hidden ${isRedPriceMode ? 'text-rose-300' : 'text-stone-600'}`}>
                {isRedPriceMode ? 'Harga Merah Semua' : 'Harga Biasa'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isRedPriceMode}
                onClick={() => onToggleRedPriceMode?.(!isRedPriceMode)}
                id="toggle-red-price-switch"
                className={`relative inline-flex h-8 w-15 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none ${
                  isRedPriceMode ? 'bg-rose-500 ring-2 ring-rose-400/40 shadow-xs' : 'bg-stone-200 hover:bg-stone-300'
                }`}
                title="Klik untuk mengaktifkan / menonaktifkan harga jual merah"
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                    isRedPriceMode ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PENCARIAN PRODUK (Pill Style) */}
      <section className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        <input
          type="text"
          id="search-product-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari minuman, arak, bir, atau SKU..."
          className="w-full pl-11 pr-10 py-3.5 bg-white border border-stone-200/70 rounded-full text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36] transition-all shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </section>

      {/* 4. KATEGORI HORIZONTAL SCROLL CHIPS (Pill style) */}
      <section className="-mx-3 px-3 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const label = cat === 'ALL' ? 'Semua Minuman' : cat;
            const count = categoryCounts[cat] || 0;

            return (
              <button
                key={cat}
                id={`cat-chip-${cat.replace(/[^a-zA-Z0-9]/g, '-')}`}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer min-h-[38px] ${
                  isSelected
                    ? 'bg-[#1E232D] text-white shadow-xs scale-[1.02]'
                    : 'bg-white text-stone-600 border border-stone-200/70 hover:bg-stone-50 active:scale-95'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. PRODUK TAMPIL SEBAGAI KARTU KOMPAK 2 KOLOM PADA MOBILE */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            Daftar Minuman ({filteredProducts.length})
          </p>
          {selectedCategory !== 'ALL' && (
            <button
              onClick={() => setSelectedCategory('ALL')}
              className="text-xs text-[#FF5E36] font-semibold hover:underline"
            >
              Lihat Semua
            </button>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-stone-200/80 shadow-xs space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-stone-800">Tidak ada produk ditemukan</p>
            <p className="text-xs text-stone-500 max-w-xs mx-auto">
              Coba kata kunci lain atau beralih ke kategori Semua.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map((product) => {
              const inCart = cart.find((i) => i.productId === product.id);
              const isOutOfStock = product.stock <= 0;
              const hasRedPrice = !!(product.redPrice && product.redPrice > 0);
              const displayPrice = isRedPriceMode 
                ? (hasRedPrice ? product.redPrice! : product.price)
                : product.price;
              const isRedApplied = isRedPriceMode && hasRedPrice;
              const redMarkup = isRedApplied ? (product.redPrice! - product.price) : 0;

              return (
                <div
                  key={product.id}
                  id={`product-card-${product.sku}`}
                  className={`bg-white rounded-[24px] p-3.5 sm:p-4 border transition-all duration-150 flex flex-col justify-between select-none relative ${
                    isOutOfStock
                      ? 'border-stone-200 opacity-60 bg-stone-50/80'
                      : inCart
                      ? 'border-[#FF5E36] ring-2 ring-[#FF5E36]/20 bg-[#FFFDFB] shadow-[0_8px_20px_rgba(255,94,54,0.08)]'
                      : isRedApplied
                      ? 'border-rose-200/90 hover:border-rose-400 bg-gradient-to-b from-rose-50/30 to-white shadow-xs'
                      : 'border-stone-200/80 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] shadow-xs bg-white'
                  }`}
                >
                  {/* Top Header with Visual Pill Tag & Stock */}
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2.5 flex-wrap">
                      <div className="flex items-center gap-1 max-w-[120px] truncate">
                        <span className="text-[10px] font-bold text-[#FF5E36] bg-[#FFF2ED] border border-[#FF5E36]/20 px-2 py-0.5 rounded-full truncate">
                          {product.category || 'Minuman'}
                        </span>
                        {isRedApplied && (
                          <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                            Merah
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700'
                            : product.stock < 10
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {isOutOfStock ? 'Habis' : `Sisa ${product.stock}`}
                      </span>
                    </div>

                    {/* Product Name (High Legibility & Distinct Contrast) */}
                    <div className="mb-3">
                      <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 leading-snug line-clamp-2 min-h-[2.5rem]">
                        {product.name}
                      </h3>
                      <p className="text-[10px] font-mono text-stone-400 mt-1 font-medium">
                        SKU: {product.sku}
                      </p>
                    </div>
                  </div>

                  {/* Price & Action Button */}
                  <div className="pt-2.5 border-t border-stone-100/90 flex items-center justify-between gap-1 mt-auto">
                    <div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <p className={`text-xs sm:text-sm font-black tracking-tight ${isRedApplied ? 'text-rose-600 font-mono' : 'text-stone-900'}`}>
                          {formatRupiah(displayPrice)}
                        </p>
                        {isRedApplied && (
                          <span className="text-[10px] text-stone-400 line-through font-mono">
                            {formatRupiah(product.price)}
                          </span>
                        )}
                      </div>
                      {isRedApplied ? (
                        <p className="text-[10px] font-bold text-rose-600">
                          +Markup Reseller Rp {redMarkup.toLocaleString('id-ID')}
                        </p>
                      ) : (
                        <p className="text-[10px] font-bold text-emerald-600">
                          +Laba {formatRupiah(product.price - product.cost)}
                        </p>
                      )}
                    </div>

                    {/* Interactive Add or Qty Stepper */}
                    <div>
                      {inCart ? (
                        <div className="flex items-center gap-1 bg-[#1E232D] text-white px-2 py-1 rounded-full shadow-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQty(product.id, inCart.qty - 1);
                            }}
                            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all text-white cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black px-1 min-w-[16px] text-center">
                            {inCart.qty}
                          </span>
                          <button
                            type="button"
                            disabled={inCart.qty >= product.stock}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQty(product.id, inCart.qty + 1);
                            }}
                            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all text-white disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => !isOutOfStock && onAddToCart(product)}
                          aria-label={`Tambah ${product.name}`}
                          className={`px-3 py-1.5 rounded-full flex items-center gap-1 transition-all text-xs font-bold cursor-pointer min-h-[36px] ${
                            isOutOfStock
                              ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                              : isRedApplied
                              ? 'bg-rose-600 hover:bg-rose-700 text-white active:scale-95 shadow-xs'
                              : 'bg-[#1E232D] hover:bg-black text-white active:scale-95 shadow-xs'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pilih</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. KERANJANG SEBAGAI STICKY FLOATING PILL BAR (Saat ada item) */}
      {cart.length > 0 && (
        <aside 
          aria-label="Keranjang Belanja"
          className="fixed bottom-22 sm:bottom-24 left-3 right-3 max-w-lg mx-auto z-30 animate-in slide-in-from-bottom duration-200 no-print"
        >
          <div className="bg-[#1E232D]/95 backdrop-blur-xl text-white rounded-full p-2.5 sm:p-3 shadow-[0_20px_40px_-8px_rgba(15,23,42,0.4)] flex items-center justify-between gap-3 border border-white/10">
            {/* Left: Cart info & count */}
            <div 
              onClick={() => setIsCartSheetOpen(true)}
              className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 pl-1.5"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF5E36] to-[#FFA07A] flex items-center justify-center text-white font-bold relative flex-shrink-0 shadow-xs">
                <ShoppingBag className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 bg-white text-stone-900 text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs">
                  {totalQty}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold truncate">
                  {cart.length} Item • Total Bayar
                </p>
                <p className="text-sm sm:text-base font-black text-white truncate leading-tight">
                  {formatRupiah(finalTotal)}
                </p>
              </div>
            </div>

            {/* Right: Thumb-friendly button to open cart sheet */}
            <button
              onClick={() => setIsCartSheetOpen(true)}
              className="bg-gradient-to-r from-[#FF5E36] to-[#FFA07A] hover:brightness-105 active:scale-95 text-white px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_4px_14px_rgba(255,94,54,0.4)] cursor-pointer flex-shrink-0 min-h-[40px]"
            >
              <span>Bayar</span>
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* 6. EXPANDABLE BOTTOM SHEET MODAL UNTUK CHECKOUT & RINCIAN KERANJANG */}
      {isCartSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="fixed inset-0"
            onClick={() => setIsCartSheetOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-[32px] p-5 shadow-2xl border-t border-stone-200 z-10 max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-250 pb-safe">
            {/* Grab bar */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-stone-300 mb-3" />
              <div className="w-full flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF2ED] flex items-center justify-center text-[#FF5E36]">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900">
                      Keranjang Kasir ({totalQty} item)
                    </h3>
                    <p className="text-xs text-stone-500">Periksa pesanan & selesaikan transaksi</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {cart.length > 0 && (
                    <button
                      onClick={onClearCart}
                      className="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  )}
                  <button
                    onClick={() => setIsCartSheetOpen(false)}
                    className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Cart Content */}
            <div className="overflow-y-auto flex-1 py-3 divide-y divide-stone-100 space-y-3">
              {/* Mode Reseller Quick Toggle Inside Cart Drawer */}
              <div className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                isRedPriceMode 
                  ? 'bg-rose-50 border-rose-200 text-rose-950' 
                  : 'bg-stone-50 border-stone-200/80 text-stone-800'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isRedPriceMode ? 'bg-rose-600 text-white' : 'bg-stone-200 text-stone-600'
                  }`}>
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold">Harga Jual Merah (Reseller)</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                        isRedPriceMode ? 'bg-rose-600 text-white' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {isRedPriceMode ? 'Aktif' : 'Off'}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 truncate">
                      {isRedPriceMode 
                        ? 'Harga dihitung make up reseller. Sheets dicatat harga biasa.' 
                        : 'Klik untuk ubah seluruh item ke harga merah reseller.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isRedPriceMode}
                  onClick={() => onToggleRedPriceMode?.(!isRedPriceMode)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    isRedPriceMode ? 'bg-rose-600' : 'bg-stone-300'
                  }`}
                  title="Toggle harga jual merah"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      isRedPriceMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                {cart.map((item) => {
                  const isCustomPrice = item.originalPrice !== undefined && item.price !== item.originalPrice;
                  return (
                    <div key={item.productId} className={`p-3 rounded-2xl border space-y-2.5 ${
                      item.isRedPrice ? 'bg-rose-50/40 border-rose-200' : 'bg-stone-50 border-stone-200/70'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs sm:text-sm font-bold text-stone-900 leading-tight">
                              {item.name}
                            </p>
                            {item.isRedPrice && (
                              <span className="text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                <Tag className="w-2.5 h-2.5" />
                                <span>Harga Merah</span>
                              </span>
                            )}
                            {isCustomPrice && (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                                Harga Diubah
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-stone-400">
                            <span>SKU: {item.sku}</span>
                            {item.isRedPrice && item.regularPrice && (
                              <span className="text-stone-500">
                                (Harga Biasa: {formatRupiah(item.regularPrice)})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Subtotal & Delete */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="text-xs sm:text-sm font-black text-stone-950">
                            {formatRupiah(item.subtotal)}
                          </p>
                          <button
                            onClick={() => onRemoveFromCart(item.productId)}
                            className="text-stone-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                            title="Hapus dari keranjang"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Flexible Controls: Editable Price / Botol & Qty Counter */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-stone-200">
                        {/* Editable Price / Botol */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-stone-500 font-semibold">Harga/btl:</span>
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-[11px] text-stone-400 font-mono font-bold">Rp</span>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={item.price}
                              onChange={(e) => onUpdateItemPrice(item.productId, Number(e.target.value) || 0)}
                              className="w-24 sm:w-28 pl-7 pr-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/30 focus:border-[#FF5E36]"
                              title="Ganti harga satuan botol"
                            />
                          </div>
                          {isCustomPrice && item.originalPrice !== undefined && (
                            <button
                              type="button"
                              onClick={() => onUpdateItemPrice(item.productId, item.originalPrice!)}
                              className="text-[10px] text-[#FF5E36] hover:underline font-bold flex items-center gap-0.5 ml-0.5 cursor-pointer"
                              title="Kembalikan ke harga katalog asli"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Reset</span>
                            </button>
                          )}
                        </div>

                        {/* Qty +/- */}
                        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl p-0.5 shadow-xs">
                          <button
                            onClick={() => onUpdateQty(item.productId, item.qty - 1)}
                            className="w-7 h-7 flex items-center justify-center text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-xs text-stone-900 px-2 min-w-[20px] text-center font-mono">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => onUpdateQty(item.productId, item.qty + 1)}
                            className="w-7 h-7 flex items-center justify-center text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Customer & Discount Fields */}
              <div className="pt-3 space-y-2.5">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-1">
                    Nama Pelanggan / Meja (Opsional)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      id="customer-name-input"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Contoh: Mas Budi / Meja 03"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                    />
                  </div>
                </div>

                {/* Potongan Promo & Diskon */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5 text-[#FF5E36]" />
                      <span>Potongan Promo & Diskon</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsPromoModalOpen(true)}
                      className="text-[11px] text-[#FF5E36] hover:text-[#E04B24] font-bold flex items-center gap-1 cursor-pointer bg-[#FFF2ED] hover:bg-[#FFE5DC] px-2 py-0.5 rounded-lg border border-[#FF5E36]/20 transition-colors"
                    >
                      <Gift className="w-3 h-3" />
                      <span>Pilih Promo / Kupon</span>
                    </button>
                  </div>

                  {/* Active promo badge if promo is selected */}
                  {promoCode && discount > 0 && (
                    <div className="p-2 bg-[#FFF4EF] border border-[#FF5E36]/30 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="px-1.5 py-0.5 bg-[#FF5E36] text-white font-mono text-[10px] font-black rounded-md shrink-0">
                          {promoCode}
                        </span>
                        <span className="font-semibold text-stone-800 truncate">
                          {promoName || 'Promo Aktif'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscount(0);
                          setPromoCode?.('');
                          setPromoName?.('');
                        }}
                        className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                        title="Hapus Promo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="relative">
                    <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      id="discount-input"
                      value={discount === 0 ? '' : discount}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setDiscount(val);
                        if (val === 0) {
                          setPromoCode?.('');
                          setPromoName?.('');
                        } else if (!promoCode) {
                          setPromoCode?.('DISKON-MANUAL');
                          setPromoName?.('Diskon Manual Kasir');
                        }
                      }}
                      placeholder="0 (atau klik tombol Pilih Promo di atas)"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                    />
                  </div>

                  {/* Quick promo presets */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      { code: 'PROMO-5K', name: 'Diskon Rp 5.000', val: 5000 },
                      { code: 'PROMO-10K', name: 'Diskon Rp 10.000', val: 10000 },
                      { code: 'PROMO-20K', name: 'Diskon Rp 20.000', val: 20000 },
                    ].map((pre) => (
                      <button
                        key={pre.code}
                        type="button"
                        onClick={() => {
                          setDiscount(pre.val);
                          setPromoCode?.(pre.code);
                          setPromoName?.(pre.name);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer ${
                          discount === pre.val && promoCode === pre.code
                            ? 'border-[#FF5E36] bg-[#FFF2ED] text-[#FF5E36] font-bold'
                            : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        -{formatRupiah(pre.val)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsPromoModalOpen(true)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-dashed border-[#FF5E36]/40 bg-[#FFF8F5] text-[#FF5E36] hover:bg-[#FFF2ED] cursor-pointer"
                    >
                      + Semua Promo
                    </button>
                  </div>
                </div>

                {/* Ongkos Kirim / Ongkir */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                    <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#FF5E36]" />
                      <span>Ongkos Kirim / Ongkir (Rp)</span>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <FileSpreadsheet className="w-2.5 h-2.5 text-emerald-600" />
                        Masuk ke Sheet LAIN-LAIN
                      </span>
                    </label>
                    {shippingFee > 0 && (
                      <button
                        onClick={() => setShippingFee(0)}
                        className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold cursor-pointer"
                      >
                        Hapus Ongkir
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 font-mono">Rp</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      id="shipping-fee-input"
                      value={shippingFee === 0 ? '' : shippingFee}
                      onChange={(e) => setShippingFee(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0 (Contoh: 10000)"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                    />
                  </div>
                  {/* Quick Ongkir Presets */}
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {[0, 5000, 10000, 15000, 20000].map((fee) => (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => setShippingFee(fee)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium border transition-colors cursor-pointer ${
                          shippingFee === fee
                            ? 'border-[#FF5E36] bg-[#FFF2ED] text-[#FF5E36] font-bold'
                            : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        {fee === 0 ? 'Gratis (Rp 0)' : formatRupiah(fee)}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Biaya ongkir otomatis dicatat ke sheet <strong>LAIN-LAIN</strong> (tidak masuk ke LOG_PENJUALAN).
                  </p>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="pt-3 space-y-2">
                <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    id="btn-pay-cash"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'border-[#FF5E36] bg-[#FFF2ED] text-[#FF5E36] ring-2 ring-[#FF5E36]/20 shadow-xs'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    <span>TUNAI</span>
                  </button>

                  <button
                    type="button"
                    id="btn-pay-qris"
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'QRIS'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <QrCode className="w-5 h-5" />
                    <span>QRIS</span>
                  </button>

                  <button
                    type="button"
                    id="btn-pay-transfer"
                    onClick={() => setPaymentMethod('TRANSFER')}
                    className={`py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'TRANSFER'
                        ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500/20 shadow-xs'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>TRANSFER</span>
                  </button>
                </div>

                {/* Tunai / Cash calculator */}
                {paymentMethod === 'CASH' && (
                  <div className="pt-2 space-y-2 bg-stone-50 p-3 rounded-2xl border border-stone-200/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-700">Uang Diterima:</span>
                      <input
                        type="number"
                        min="0"
                        step="5000"
                        value={cashReceived === 0 ? '' : cashReceived}
                        onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                        placeholder={formatRupiah(finalTotal)}
                        className="w-36 px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-right text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                      />
                    </div>

                    {/* Quick pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {quickCashOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setCashReceived(opt)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-medium border transition-colors cursor-pointer ${
                            cashReceived === opt
                              ? 'border-[#FF5E36] text-[#FF5E36] bg-[#FFF2ED]'
                              : 'border-stone-200 text-stone-600 hover:bg-white bg-white/70'
                          }`}
                        >
                          {opt === finalTotal ? 'Uang Pas' : formatRupiah(opt)}
                        </button>
                      ))}
                    </div>

                    {cashReceived > 0 && (
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-stone-600">Kembalian:</span>
                        <span className={`font-mono font-extrabold text-sm ${change >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {formatRupiah(change)}
                        </span>
                      </div>
                    )}

                    {isCashInsufficient && (
                      <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Uang tunai kurang {formatRupiah(finalTotal - cashReceived)}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Checkout Action */}
            <div className="pt-3 border-t border-stone-100 flex-shrink-0 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Subtotal ({totalQty} botol):</span>
                <span className="font-mono font-medium">{formatRupiah(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-xs text-rose-500">
                  <span className="flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5" />
                    <span>Diskon {promoName ? `(${promoName})` : ''}:</span>
                  </span>
                  <span className="font-mono font-medium">-{formatRupiah(discount)}</span>
                </div>
              )}
              {shippingFee > 0 && (
                <div className="flex items-center justify-between text-xs text-[#FF5E36] font-semibold">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Ongkos Kirim (Ongkir):</span>
                  </span>
                  <span className="font-mono font-bold">+{formatRupiah(shippingFee)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-base font-black text-stone-950 pt-0.5 border-t border-stone-100">
                <span>Total Bayar:</span>
                <span className="text-xl text-[#FF5E36] font-mono">{formatRupiah(finalTotal)}</span>
              </div>

              {/* Informational notification for Google Sheets */}
              {isRedPriceMode && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-rose-900">
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-rose-600" />
                      <span>Penulisan ke Google Sheets:</span>
                    </span>
                    <span className="font-mono text-rose-700 font-bold">{formatRupiah(sheetsRegularTotal)}</span>
                  </div>
                  <p className="text-[10px] text-rose-700/90 leading-tight">
                    ✓ Transaksi ini dicatat ke sheet <strong>LOG_PENJUALAN</strong> menggunakan <strong>harga biasa</strong>, bukan harga jual merah.
                  </p>
                </div>
              )}

              {/* Quick Actions Row: Print, Bagikan (WA), Download */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePrintCart}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                  title="Print Struk / Draft"
                >
                  <Printer className="w-3.5 h-3.5 text-[#FF5E36]" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareCartWA}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                  title="Bagikan ke WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5 fill-current" />
                  <span>Bagikan</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCartOrder}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                  title="Download Nota Gambar (PNG)"
                >
                  <Download className="w-3.5 h-3.5 text-stone-700" />
                  <span>Download PNG</span>
                </button>
              </div>

              {/* Primary Checkout Button */}
              <button
                onClick={handleCheckoutAndClose}
                disabled={cart.length === 0 || isCashInsufficient || isSubmitting}
                id="btn-process-checkout"
                className={`w-full py-3.5 rounded-2xl font-extrabold text-sm tracking-wide transition-all duration-150 flex items-center justify-center gap-2 shadow-lg min-h-[48px] ${
                  cart.length === 0 || isCashInsufficient || isSubmitting
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-[#FF5E36] to-[#FFA07A] hover:brightness-105 active:scale-[0.98] text-white shadow-[#FF5E36]/25 cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-stone-500" />
                    <span>Memproses Transaksi...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    <span>Simpan & Selesaikan ({formatRupiah(finalTotal)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Promo & Voucher Selector Modal */}
      <PromoSelectorModal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        subtotal={subtotal}
        currentPromoCode={promoCode}
        onApplyPromo={(p, calcDisc) => {
          setDiscount(calcDisc);
          setPromoCode?.(p.code);
          setPromoName?.(p.name);
        }}
        onRemovePromo={() => {
          setDiscount(0);
          setPromoCode?.('');
          setPromoName?.('');
        }}
      />
    </div>
  );
};
