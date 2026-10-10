import React, { useState, useEffect } from 'react';
import { 
  X, 
  Gift, 
  Tag, 
  Percent, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Info, 
  Sparkles,
  Search,
  ArrowRight
} from 'lucide-react';
import { PromoRule } from '../types';
import { StorageService, formatRupiah } from '../services/storageService';

interface PromoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  currentPromoCode?: string;
  onApplyPromo: (promo: PromoRule, calculatedDiscount: number) => void;
  onRemovePromo: () => void;
}

export const PromoSelectorModal: React.FC<PromoSelectorModalProps> = ({
  isOpen,
  onClose,
  subtotal,
  currentPromoCode,
  onApplyPromo,
  onRemovePromo,
}) => {
  const [promos, setPromos] = useState<PromoRule[]>([]);
  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE'>('LIST');
  const [searchQuery, setSearchQuery] = useState('');

  // New promo form state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [newValue, setNewValue] = useState<number>(10000);
  const [newMinOrder, setNewMinOrder] = useState<number>(0);
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState('');

  const loadPromos = () => {
    const list = StorageService.getPromos();
    setPromos(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadPromos();
      setActiveTab('LIST');
      setSearchQuery('');
      setFormError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const calculateDiscountValue = (promo: PromoRule, amount: number): number => {
    if (promo.type === 'PERCENT') {
      const pct = Math.min(100, Math.max(0, promo.value));
      return Math.round((amount * pct) / 100);
    }
    return Math.min(amount, promo.value);
  };

  const filteredPromos = promos.filter((p) => {
    if (!p.isActive && p.isActive !== undefined) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const handleSelectPromo = (promo: PromoRule) => {
    const min = promo.minOrder || 0;
    if (subtotal < min) return;

    const discountAmount = calculateDiscountValue(promo, subtotal);
    onApplyPromo(promo, discountAmount);
    onClose();
  };

  const handleSaveNewPromo = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newCode.trim()) {
      setFormError('Kode promo wajib diisi (contoh: PROMO-WEEKEND)');
      return;
    }
    if (!newName.trim()) {
      setFormError('Nama promo wajib diisi');
      return;
    }
    if (newValue <= 0) {
      setFormError('Nilai potongan harus lebih besar dari 0');
      return;
    }
    if (newType === 'PERCENT' && newValue > 100) {
      setFormError('Diskon persen maksimal 100%');
      return;
    }

    const cleanCode = newCode.trim().toUpperCase().replace(/\s+/g, '-');
    const created: PromoRule = {
      id: 'promo-' + Date.now(),
      code: cleanCode,
      name: newName.trim(),
      type: newType,
      value: newValue,
      minOrder: newMinOrder > 0 ? newMinOrder : 0,
      description: newDescription.trim() || undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    StorageService.savePromo(created);
    loadPromos();
    setActiveTab('LIST');

    // Reset form
    setNewCode('');
    setNewName('');
    setNewValue(10000);
    setNewMinOrder(0);
    setNewDescription('');

    // If subtotal qualifies, auto-apply!
    if (subtotal >= created.minOrder!) {
      const disc = calculateDiscountValue(created, subtotal);
      onApplyPromo(created, disc);
      onClose();
    }
  };

  const handleDeletePromo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Hapus promo ini dari daftar?')) {
      StorageService.deletePromo(id);
      loadPromos();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF2ED] flex items-center justify-center text-[#FF5E36] border border-[#FF5E36]/20">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900 leading-tight">Promo & Voucher Kasir</h3>
              <p className="text-[11px] text-stone-500">
                Subtotal Belanja: <span className="font-mono font-bold text-stone-900">{formatRupiah(subtotal)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-stone-200 bg-white px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'LIST'
                ? 'border-[#FF5E36] text-[#FF5E36]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Pilih Promo ({promos.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CREATE')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CREATE'
                ? 'border-[#FF5E36] text-[#FF5E36]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Buat Promo Baru</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'LIST' && (
            <>
              {/* Search & Active Promo Status */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari promo atau kode voucher..."
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {currentPromoCode && (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Promo Aktif Saat Ini: <strong className="font-mono">{currentPromoCode}</strong></span>
                    </div>
                    <button
                      onClick={() => {
                        onRemovePromo();
                        onClose();
                      }}
                      className="text-emerald-700 hover:text-rose-600 font-bold text-[11px] underline cursor-pointer"
                    >
                      Batalkan Promo
                    </button>
                  </div>
                )}
              </div>

              {/* Promo Cards List */}
              <div className="space-y-2.5">
                {filteredPromos.length === 0 ? (
                  <div className="text-center py-8 text-stone-400">
                    <Gift className="w-10 h-10 mx-auto stroke-1 text-stone-300 mb-2" />
                    <p className="text-xs font-medium text-stone-600">Tidak ada promo yang sesuai</p>
                    <button
                      onClick={() => setActiveTab('CREATE')}
                      className="mt-3 px-3 py-1.5 bg-[#FF5E36] text-white text-xs font-semibold rounded-lg hover:bg-[#E04B24] cursor-pointer"
                    >
                      + Buat Promo Sekarang
                    </button>
                  </div>
                ) : (
                  filteredPromos.map((p) => {
                    const minOrder = p.minOrder || 0;
                    const isEligible = subtotal >= minOrder;
                    const isCurrentlySelected = currentPromoCode === p.code;
                    const calculatedDisc = calculateDiscountValue(p, subtotal);

                    return (
                      <div
                        key={p.id}
                        onClick={() => isEligible && handleSelectPromo(p)}
                        className={`group relative p-3.5 rounded-xl border transition-all ${
                          isCurrentlySelected
                            ? 'bg-[#FFF8F5] border-[#FF5E36] ring-2 ring-[#FF5E36]/20'
                            : isEligible
                            ? 'bg-white border-stone-200 hover:border-[#FF5E36]/50 hover:shadow-xs cursor-pointer'
                            : 'bg-stone-50/70 border-stone-200 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-black tracking-wide bg-stone-900 text-white">
                                {p.code}
                              </span>
                              <span className="font-bold text-xs sm:text-sm text-stone-900">
                                {p.name}
                              </span>
                            </div>

                            <div className="text-xs font-semibold text-[#FF5E36] flex items-center gap-1">
                              {p.type === 'PERCENT' ? (
                                <>
                                  <Percent className="w-3.5 h-3.5" />
                                  <span>Diskon {p.value}% (Potongan {formatRupiah(calculatedDisc)})</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Potongan {formatRupiah(p.value)}</span>
                                </>
                              )}
                            </div>

                            {p.description && (
                              <p className="text-[11px] text-stone-500">{p.description}</p>
                            )}

                            {/* Eligibility indicator */}
                            <div className="pt-1 text-[10px]">
                              {minOrder > 0 ? (
                                isEligible ? (
                                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Min. belanja {formatRupiah(minOrder)} (Terpenuhi)
                                  </span>
                                ) : (
                                  <span className="text-amber-600 font-medium flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Min. belanja {formatRupiah(minOrder)} (Kurang {formatRupiah(minOrder - subtotal)})
                                  </span>
                                )
                              ) : (
                                <span className="text-stone-400">Tanpa syarat minimal belanja</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {isCurrentlySelected ? (
                              <span className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1">
                                <Check className="w-3 h-3" /> Terpasang
                              </span>
                            ) : isEligible ? (
                              <button
                                type="button"
                                onClick={() => handleSelectPromo(p)}
                                className="px-2.5 py-1 bg-[#FF5E36] hover:bg-[#E04B24] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                              >
                                <span>Gunakan</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 bg-stone-200 text-stone-500 text-[10px] font-medium rounded-md">
                                Belum Cukup
                              </span>
                            )}

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => handleDeletePromo(p.id, e)}
                              title="Hapus promo ini"
                              className="text-stone-300 hover:text-rose-500 p-1 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Google Sheets Explanation Note */}
              <div className="p-3 bg-stone-100 rounded-xl border border-stone-200 text-[11px] text-stone-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-stone-800">
                  <Info className="w-3.5 h-3.5 text-[#FF5E36]" />
                  <span>Otomatis Terhubung ke Google Sheets</span>
                </div>
                <p>
                  Saat transaksi disimpan, promo akan dicatat otomatis di sheet <strong>LOG_PENJUALAN</strong> dengan SKU kode promo dan nilai minus sehingga omset di spreadsheet 100% klop dengan uang kasir.
                </p>
              </div>
            </>
          )}

          {activeTab === 'CREATE' && (
            <form onSubmit={handleSaveNewPromo} className="space-y-3.5">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Kode Promo */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Kode Promo / Voucher <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: PROMO-WEEKEND atau MEMBER-5"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono uppercase font-bold text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                  required
                />
                <p className="text-[10px] text-stone-400 mt-0.5">Kode ini akan tercatat di Kolom C (SKU) Google Sheets.</p>
              </div>

              {/* Nama Promo */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nama Promo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Potongan Spesial Akhir Pekan"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                  required
                />
              </div>

              {/* Tipe Diskon & Nilai */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Tipe Potongan</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as 'FIXED' | 'PERCENT')}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                  >
                    <option value="FIXED">Nominal Tetap (Rp)</option>
                    <option value="PERCENT">Persentase (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {newType === 'FIXED' ? 'Nilai Potongan (Rp)' : 'Persentase (%)'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={newType === 'PERCENT' ? 100 : 10000000}
                    step={newType === 'PERCENT' ? 1 : 1000}
                    value={newValue}
                    onChange={(e) => setNewValue(Number(e.target.value) || 0)}
                    placeholder={newType === 'FIXED' ? '10000' : '10'}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                    required
                  />
                </div>
              </div>

              {/* Minimal Belanja */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Syarat Minimal Belanja (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={newMinOrder === 0 ? '' : newMinOrder}
                  onChange={(e) => setNewMinOrder(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0 (Isi 0 jika tanpa syarat)"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                />
                <p className="text-[10px] text-stone-400 mt-0.5">Kosongkan atau isi 0 jika promo berlaku untuk semua total belanja.</p>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Keterangan / Deskripsi</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Contoh: Khusus pembelian min. 2 botol bir"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]/20 focus:border-[#FF5E36]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('LIST')}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#FF5E36] hover:bg-[#E04B24] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  Simpan & Terapkan Promo
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
