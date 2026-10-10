import React, { useState, useEffect } from 'react';
import { 
  Package, 
  ArrowUpCircle, 
  Search, 
  Plus, 
  Edit3, 
  X, 
  Download, 
  RefreshCw, 
  Layers, 
  History,
  AlertCircle,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { Product, BarangMasukRecord } from '../types';
import { formatRupiah, StorageService } from '../services/storageService';
import { GasApiService } from '../services/gasApiService';

interface StockManagementViewProps {
  products: Product[];
  onUpdateStock: (productId: string, newStock: number) => void;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  onSyncSpreadsheet?: () => void;
  isSyncing?: boolean;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const StockManagementView: React.FC<StockManagementViewProps> = ({
  products,
  onUpdateStock,
  onAddProduct,
  onUpdateProduct,
  onSyncSpreadsheet,
  isSyncing,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'BARANG_MASUK'>('PRODUCTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Restock modal state
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<number>(12);
  const [restockKrat, setRestockKrat] = useState<number>(1);
  const [restockCost, setRestockCost] = useState<number>(0);
  const [restockSupplier, setRestockSupplier] = useState<string>('orang tua');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);
  const [restockFeedback, setRestockFeedback] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // New product modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCost, setNewCost] = useState<number>(0);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newRedPrice, setNewRedPrice] = useState<number>(0);
  const [newStock, setNewStock] = useState<number>(24);

  // Edit product modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // LOG_BARANG_MASUK records
  const [barangMasukList, setBarangMasukList] = useState<BarangMasukRecord[]>([]);

  useEffect(() => {
    setBarangMasukList(StorageService.getBarangMasukList());
  }, []);

  const presentCategories = Array.from(
    new Set(
      products
        .map((p) => (p.category ? String(p.category).trim() : ''))
        .filter((c): c is string => Boolean(c))
    )
  ) as string[];
  const categories: string[] = ['ALL', ...presentCategories];

  const filtered = products.filter((p) => {
    const skuUpper = String(p.sku || '').toUpperCase();
    const nameUpper = String(p.name || '').toUpperCase();
    if (skuUpper.includes('PROMO') || nameUpper.includes('PROMO') || nameUpper.includes('POTONGAN') || p.category === 'PROMO') {
      return false;
    }
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  // Calculate inventory metrics
  const totalStockBottles = products.reduce((sum, p) => sum + p.stock, 0);
  const totalAssetCost = products.reduce((sum, p) => sum + (p.totalAsset || p.cost * p.stock), 0);
  const totalPotentialRevenue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const potentialProfit = totalPotentialRevenue - totalAssetCost;

  const handleConfirmRestock = async () => {
    if (!restockProduct || restockQty <= 0) return;

    setIsSubmittingRestock(true);
    setRestockFeedback(null);

    try {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      const dateStr = `${d}/${m}/${y}`;
      const recordId = `BM-${Date.now().toString().slice(-6)}`;

      const newRecord: BarangMasukRecord = {
        id: recordId,
        date: dateStr,
        sku: restockProduct.sku,
        name: restockProduct.name,
        krat: restockKrat,
        qty: restockQty,
        cost: restockCost,
        totalCost: restockQty * restockCost,
        supplier: restockSupplier || 'orang tua',
        supplierOrNotes: restockSupplier || 'orang tua',
      };

      // 1. Simpan ke database lokal
      const savedRecord = StorageService.recordBarangMasuk(newRecord);
      setBarangMasukList(StorageService.getBarangMasukList());

      // Update stok lokal di state aplikasi
      const updatedStock = restockProduct.stock + restockQty;
      onUpdateStock(restockProduct.id, updatedStock);

      // 2. Push ke Google Sheets LOG_BARANG_MASUK (B4:H)
      const pushRes = await GasApiService.pushBarangMasuk(savedRecord);

      if (pushRes.success) {
        showToast?.(`✓ Restock ${newRecord.sku} (+${restockQty} btl) tercatat di LOG_BARANG_MASUK baris ${pushRes.rowNumber || 'baru'}`, 'success');
        setRestockFeedback({
          type: 'success',
          message: pushRes.message || `Berhasil dicatat ke LOG_BARANG_MASUK baris ${pushRes.rowNumber || 'baru'}.`,
        });
        setTimeout(() => {
          setRestockProduct(null);
          setRestockFeedback(null);
        }, 1200);
      } else {
        showToast?.(`⚠️ Restock tersimpan lokal. Google Sheets: ${pushRes.message}`, 'error');
        setRestockFeedback({
          type: 'warning',
          message: `${pushRes.message}. (Stok lokal di POS berhasil bertambah +${restockQty}). Pastikan script Apps Script Google Sheets telah di-Deploy versi terbaru.`,
        });
      }
    } catch (err: any) {
      console.error('Failed to restock:', err);
      setRestockFeedback({
        type: 'error',
        message: 'Koneksi error: ' + (err?.message || 'Gagal menghubungi server/Google Sheets'),
      });
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  const handleSaveNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newPrice <= 0) return;

    const sku = newSku.trim() || `SKU-${Date.now().toString().slice(-4)}`;
    onAddProduct({
      sku,
      name: newName.trim(),
      price: newPrice,
      cost: newCost,
      redPrice: newRedPrice > 0 ? newRedPrice : newPrice,
      stock: newStock,
      totalAsset: newStock * newCost,
      category: 'LAINNYA',
    });

    setIsAddModalOpen(false);
    setNewSku('');
    setNewName('');
    setNewCost(0);
    setNewPrice(0);
    setNewRedPrice(0);
    setNewStock(24);
  };

  const handleSaveEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const updated = {
      ...editingProduct,
      totalAsset: editingProduct.stock * editingProduct.cost,
    };
    onUpdateProduct(updated);
    setEditingProduct(null);
  };

  const handleExportProductsCSV = () => {
    if (products.length === 0) return;

    const headers = ['SKU_ColB', 'NAMA_PRODUK_ColC', 'STOK_ColD', 'HARGA_JUAL_ColE', 'HARGA_MODAL_ColF', 'HARGA_MERAH_ColG', 'TOTAL_ASET_ColH', 'KATEGORI'];
    const rows = products.map((p) => [
      p.sku,
      `"${p.name.replace(/"/g, '""')}"`,
      p.stock,
      p.price,
      p.cost,
      p.redPrice || p.price,
      p.totalAsset || p.cost * p.stock,
      p.category,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ortukill_Stok_B70_H_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBarangMasukCSV = () => {
    if (barangMasukList.length === 0) return;

    const headers = ['TANGGAL_ColB', 'NO_BUKTI_ColC', 'SKU_ColD', 'NAMA_PRODUK_ColE', 'QTY_ColF', 'HARGA_MODAL_ColG', 'SUPPLIER_ColH'];
    const rows = barangMasukList.map((bm) => [
      bm.date,
      bm.id,
      bm.sku,
      `"${bm.name.replace(/"/g, '""')}"`,
      bm.qty,
      bm.cost,
      `"${(bm.supplierOrNotes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ortukill_BarangMasuk_B4_H_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight">
                Manajemen Stok & Inventori
              </h2>
              <span className="bg-[#FFF2ED] text-[#FF5E36] text-[10px] px-2 py-0.5 rounded-full font-bold">
                {products.length} SKU
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Sinkron dengan DASHBOARD_MUTASI_&_PROFIT & LOG_BARANG_MASUK
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSyncSpreadsheet && (
            <button
              onClick={onSyncSpreadsheet}
              disabled={isSyncing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-all cursor-pointer min-h-[44px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#FF5E36] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sinkron...' : 'Segarkan'}</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] text-white text-xs font-bold transition-all cursor-pointer shadow-xs min-h-[44px]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
            Total Stok Fisik
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 mt-1">
            {totalStockBottles} Botol
          </h3>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Dari {products.length} varian SKU
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
            Nilai Aset Modal
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-amber-600 mt-1">
            {formatRupiah(totalAssetCost)}
          </h3>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Total biaya HPP tertanam
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
            Potensi Omset
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 mt-1">
            {formatRupiah(totalPotentialRevenue)}
          </h3>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Bila seluruh stok habis
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
            Potensi Keuntungan
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-emerald-600 mt-1">
            +{formatRupiah(potentialProfit)}
          </h3>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Estimasi margin kotor
          </p>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="bg-white rounded-2xl p-1.5 border border-stone-200/80 shadow-xs flex items-center gap-1">
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px] ${
            activeTab === 'PRODUCTS'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Katalog & Stok ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('BARANG_MASUK')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px] ${
            activeTab === 'BARANG_MASUK'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Riwayat Masuk ({barangMasukList.length})</span>
        </button>
      </div>

      {activeTab === 'PRODUCTS' && (
        <>
          {/* Search & Category Filter */}
          <div className="bg-white rounded-2xl p-3.5 border border-stone-200/80 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari SKU atau nama produk..."
                  className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                />
              </div>

              <button
                onClick={handleExportProductsCSV}
                title="Ekspor CSV"
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 min-h-[40px] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#FF5E36]" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>

            {/* Horizontal Categories */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer min-h-[34px] ${
                    selectedCategory === cat
                      ? 'bg-[#FF5E36] text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {cat === 'ALL' ? 'Semua' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* MOBILE VIEW (<640px): Product Card List */}
          <div className="space-y-2.5 sm:hidden">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-stone-200/80 shadow-xs">
                <p className="text-xs text-stone-500">Tidak ada produk yang cocok</p>
              </div>
            ) : (
              filtered.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock < 10;

                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#FF5E36]">
                        {p.sku}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        isOutOfStock
                          ? 'bg-rose-100 text-rose-700'
                          : isLowStock
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {isOutOfStock ? 'HABIS' : isLowStock ? `SISA ${p.stock}` : `STOK: ${p.stock}`}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-stone-900 leading-snug">
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-stone-400 mt-0.5 font-medium">
                        {p.category}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-extrabold text-stone-900">
                          {formatRupiah(p.price)}
                        </p>
                        <p className="text-[10px] text-stone-400">
                          HPP: {formatRupiah(p.cost)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setRestockProduct(p);
                            setRestockQty(12);
                            setRestockCost(p.cost);
                            setRestockSupplier('Gudang Utama / Supplier');
                          }}
                          className="px-3 py-2 rounded-xl bg-[#FFF2ED] hover:bg-[#ffe5dc] text-[#FF5E36] text-xs font-bold flex items-center gap-1 min-h-[44px] cursor-pointer"
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          <span>Restock</span>
                        </button>

                        <button
                          onClick={() => setEditingProduct({ ...p })}
                          className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP VIEW (>=640px): Full Table */}
          <div className="hidden sm:block bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] tracking-wider border-b border-stone-200 font-semibold">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Nama Produk</th>
                    <th className="py-3 px-3">Kategori</th>
                    <th className="py-3 px-3 text-center">Stok Akhir</th>
                    <th className="py-3 px-3 text-right">Harga Jual Biasa</th>
                    <th className="py-3 px-3 text-right text-rose-600">Harga Merah (Reseller)</th>
                    <th className="py-3 px-3 text-right">Harga Beli HPP</th>
                    <th className="py-3 px-3 text-right">Total Aset</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered.map((p) => {
                    const isOutOfStock = p.stock <= 0;
                    const isLowStock = p.stock > 0 && p.stock < 10;
                    const totalAssetVal = p.totalAsset || (p.stock * p.cost);

                    return (
                      <tr key={p.id} className="hover:bg-stone-50/80">
                        <td className="py-3 px-4 font-mono font-bold text-[#FF5E36] whitespace-nowrap">
                          {p.sku}
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900 max-w-xs truncate">
                          {p.name}
                        </td>
                        <td className="py-3 px-3 text-stone-500 whitespace-nowrap">
                          {p.category}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {p.stock}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                          {formatRupiah(p.price)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                          {p.redPrice && p.redPrice > 0 ? formatRupiah(p.redPrice) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-600 whitespace-nowrap">
                          {formatRupiah(p.cost)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-stone-800 whitespace-nowrap">
                          {formatRupiah(totalAssetVal)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setRestockProduct(p);
                                setRestockQty(12);
                                setRestockKrat(1);
                                setRestockCost(p.cost);
                                setRestockSupplier('orang tua');
                                setRestockFeedback(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#FFF2ED] text-[#FF5E36] font-bold text-xs hover:bg-[#ffe5dc]"
                            >
                              Restock
                            </button>
                            <button
                              onClick={() => setEditingProduct({ ...p })}
                              className="p-1 rounded-lg hover:bg-stone-100 text-stone-500"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
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

      {activeTab === 'BARANG_MASUK' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Log Barang Masuk ({barangMasukList.length})
              </h3>
              <p className="text-[11px] text-stone-400">Pencatatan restock otomatis</p>
            </div>
            <button
              onClick={handleExportBarangMasukCSV}
              className="px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200"
            >
              Ekspor CSV
            </button>
          </div>

          {barangMasukList.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400">
              Belum ada data barang masuk.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {barangMasukList.map((bm, idx) => (
                <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-900">{bm.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        +{bm.qty} btl ({bm.krat || 0} krat)
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-stone-400 mt-0.5">
                      {bm.date} • SKU: {bm.sku} • Supplier: {bm.supplier || bm.supplierOrNotes || 'orang tua'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-stone-900">
                      Total: {formatRupiah(bm.totalCost || bm.qty * bm.cost)}
                    </p>
                    <p className="text-[10px] text-stone-500">
                      @{formatRupiah(bm.cost)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Restock Modal */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-stone-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-base text-stone-900">Restock Barang Masuk</h3>
                <p className="text-xs text-stone-500">{restockProduct.name}</p>
              </div>
              <button
                onClick={() => setRestockProduct(null)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-stone-50 p-3 rounded-2xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">SKU:</span>
                <span className="font-bold text-[#FF5E36]">{restockProduct.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Stok Saat Ini:</span>
                <span className="font-bold text-stone-900">{restockProduct.stock} botol</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Qty / Krat:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={restockKrat}
                    onChange={(e) => {
                      const kratVal = Math.max(0, parseInt(e.target.value) || 0);
                      setRestockKrat(kratVal);
                      if (kratVal > 0) {
                        setRestockQty(kratVal * 12);
                      }
                    }}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                  />
                  <span className="text-[10px] text-stone-400">1 Krat = 12 botol</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Kuantitas Masuk (Botol):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={restockQty}
                    onChange={(e) => {
                      const qtyVal = Math.max(1, parseInt(e.target.value) || 1);
                      setRestockQty(qtyVal);
                      setRestockKrat(Math.floor(qtyVal / 12));
                    }}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                  />
                  <div className="flex gap-1 mt-1">
                    {[6, 12, 24].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => {
                          setRestockQty(qty);
                          setRestockKrat(Math.floor(qty / 12));
                        }}
                        className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-md text-[10px]"
                      >
                        +{qty}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Harga Beli / HPP Satuan:
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={restockCost}
                  onChange={(e) => setRestockCost(Number(e.target.value) || 0)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Supplier / Keterangan:
                </label>
                <input
                  type="text"
                  value={restockSupplier}
                  onChange={(e) => setRestockSupplier(e.target.value)}
                  placeholder="orang tua"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                />
                <div className="flex gap-1 mt-1">
                  {['orang tua', 'Gudang Kediri', 'Supplier Luar'].map((sup) => (
                    <button
                      key={sup}
                      type="button"
                      onClick={() => setRestockSupplier(sup)}
                      className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-md text-[10px]"
                    >
                      {sup}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-500 font-medium">Total Biaya Masuk:</span>
                  <span className="font-bold text-stone-900 font-mono">
                    {formatRupiah(restockQty * restockCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-500 font-medium">Stok Baru Nanti:</span>
                  <span className="font-extrabold text-[#FF5E36]">
                    {restockProduct.stock + restockQty} botol
                  </span>
                </div>
                <p className="text-[10px] text-stone-400 pt-1">
                  *Akan otomatis dicatat ke tab spreadsheet <strong className="text-stone-600">LOG_BARANG_MASUK</strong> (Kolom B:H).
                </p>
              </div>

              {restockFeedback && (
                <div className={`p-2.5 rounded-xl text-xs font-medium ${
                  restockFeedback.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : restockFeedback.type === 'warning'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {restockFeedback.message}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRestockProduct(null);
                  setRestockFeedback(null);
                }}
                className="flex-1 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingRestock}
                onClick={handleConfirmRestock}
                className="flex-1 py-3 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] text-white font-bold text-xs shadow-md min-h-[44px] flex items-center justify-center gap-1.5"
              >
                {isSubmittingRestock ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mencatat ke Sheets...</span>
                  </>
                ) : (
                  'Simpan Restock'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <form onSubmit={handleSaveNewProduct} className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900">Tambah Produk Baru</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Nama Produk:
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Soju Chum Churum Original"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                    SKU / Kode:
                  </label>
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="SKU-..."
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Stok Awal:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newStock}
                    onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Harga Jual Biasa:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value) || 0)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">
                    Harga Merah (Reseller):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newRedPrice === 0 ? '' : newRedPrice}
                    onChange={(e) => setNewRedPrice(Number(e.target.value) || 0)}
                    placeholder="Make up reseller"
                    className="w-full p-2.5 bg-rose-50/50 border border-rose-200 rounded-xl text-xs font-mono font-bold text-rose-700 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Harga Beli HPP:
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={newCost}
                  onChange={(e) => setNewCost(Number(e.target.value) || 0)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] text-white font-bold text-xs shadow-md min-h-[44px]"
              >
                Simpan Produk
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <form onSubmit={handleSaveEditProduct} className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900">Edit Produk</h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Nama Produk:
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Stok Fisik:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Harga Jual Biasa:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1">
                    Harga Merah (Reseller):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={editingProduct.redPrice || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, redPrice: Number(e.target.value) || 0 })}
                    placeholder="Make up reseller"
                    className="w-full p-2.5 bg-rose-50/50 border border-rose-200 rounded-xl text-xs font-mono font-bold text-rose-700 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Harga Beli / HPP:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={editingProduct.cost}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost: Number(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#FF5E36]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="flex-1 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs min-h-[44px]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] text-white font-bold text-xs shadow-md min-h-[44px]"
              >
                Perbarui
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
