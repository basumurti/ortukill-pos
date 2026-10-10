import React, { useState } from 'react';
import { 
  Store, 
  Calendar, 
  TrendingUp, 
  Package, 
  MoreHorizontal,
  Wallet,
  FileCode2,
  RotateCcw,
  X,
  ChevronRight,
  ShieldCheck,
  Radio,
  Receipt
} from 'lucide-react';

interface BottomNavigationProps {
  activeTab: 'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas';
  setActiveTab: (tab: 'pos' | 'today' | 'history' | 'stock' | 'shift' | 'gas') => void;
  todayCount: number;
  cartCount: number;
  isConnectedGas: boolean;
  onResetData: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  setActiveTab,
  todayCount,
  cartCount,
  isConnectedGas,
  onResetData,
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const isMoreActive = activeTab === 'shift' || activeTab === 'gas';

  const navItems = [
    {
      id: 'pos' as const,
      label: 'Kasir',
      icon: Store,
      badge: cartCount > 0 ? `${cartCount}` : null,
      badgeColor: 'bg-[#FF5E36] text-white',
    },
    {
      id: 'today' as const,
      label: 'Hari Ini',
      icon: Calendar,
      badge: todayCount > 0 ? `${todayCount}` : null,
      badgeColor: 'bg-stone-800 text-white',
    },
    {
      id: 'history' as const,
      label: 'Laporan',
      icon: TrendingUp,
      badge: null,
    },
    {
      id: 'stock' as const,
      label: 'Stok',
      icon: Package,
      badge: null,
    },
  ];

  return (
    <>
      {/* More Options Bottom Sheet Modal */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="fixed inset-0"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-[28px] p-5 shadow-2xl border-t border-stone-100 z-10 space-y-4 animate-in slide-in-from-bottom duration-250 pb-8">
            {/* Header / Grab bar */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-1 rounded-full bg-stone-300 mb-3" />
              <div className="w-full flex items-center justify-between pb-2 border-b border-stone-100">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Menu Lainnya</h3>
                  <p className="text-xs text-stone-500">Kelola shift kasir & integrasi sistem</p>
                </div>
                <button
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  setActiveTab('history');
                  setIsMoreMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left bg-stone-50 hover:bg-stone-100 border-stone-100 text-stone-800`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white text-stone-700 shadow-xs flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-[#FF5E36]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Pengeluaran & Keuangan Lain</p>
                    <p className="text-xs text-stone-500">Bensin, operasional, tips (+), ongkir (+)</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>

              <button
                onClick={() => {
                  setActiveTab('shift');
                  setIsMoreMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                  activeTab === 'shift'
                    ? 'bg-[#FFF2ED] border-[#FF5E36]/30 text-[#FF5E36]'
                    : 'bg-stone-50 hover:bg-stone-100 border-stone-100 text-stone-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    activeTab === 'shift' ? 'bg-[#FF5E36] text-white' : 'bg-white text-stone-700 shadow-xs'
                  }`}>
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Tutup Shift Kasir</p>
                    <p className="text-xs text-stone-500">Rekap kas masuk, pengeluaran & serah terima</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>

              <button
                onClick={() => {
                  setActiveTab('gas');
                  setIsMoreMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                  activeTab === 'gas'
                    ? 'bg-[#FFF2ED] border-[#FF5E36]/30 text-[#FF5E36]'
                    : 'bg-stone-50 hover:bg-stone-100 border-stone-100 text-stone-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    activeTab === 'gas' ? 'bg-[#FF5E36] text-white' : 'bg-white text-stone-700 shadow-xs'
                  }`}>
                    <FileCode2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">Integrasi Google Sheets</p>
                      {isConnectedGas ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          Terhubung
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-stone-600 bg-stone-200 px-1.5 py-0.5 rounded-full">
                          Offline
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500">Koneksi Apps Script Web App & skrip spreadsheet</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>

              <div className="pt-2 border-t border-stone-100">
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    if (window.confirm('Reset data contoh ke setelan awal demo?')) {
                      onResetData();
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors text-left text-xs font-medium"
                >
                  <RotateCcw className="w-4 h-4 text-stone-400" />
                  <span>Reset Data Demo ke Bawaan Awal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Pill Bottom Nav Bar */}
      <div className="fixed bottom-3 left-3 right-3 max-w-lg mx-auto z-40 no-print">
        <div className="bg-white/95 backdrop-blur-xl rounded-full border border-white/90 shadow-[0_16px_36px_-6px_rgba(15,23,42,0.15),0_4px_12px_rgba(15,23,42,0.06)] px-2 py-1.5 flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`bottom-nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className="flex-1 flex flex-col items-center justify-center py-1 relative min-h-[46px] transition-all cursor-pointer group select-none"
              >
                <div className={`relative px-3.5 py-1 rounded-full transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#1E232D] text-white shadow-xs' 
                    : 'text-stone-400 group-hover:text-stone-700'
                }`}>
                  <Icon className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'scale-105 stroke-[2.2]' : 'stroke-[1.8]'}`} />
                  {item.badge && (
                    <span className={`absolute -top-1 -right-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-xs ${
                      isActive ? 'bg-[#FF5E36] text-white ring-2 ring-[#1E232D]' : (item.badgeColor || 'bg-[#FF5E36] text-white')
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 tracking-tight font-semibold transition-colors ${
                  isActive ? 'text-[#1E232D] font-bold' : 'text-stone-500'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* 5th Tab: Lainnya */}
          <button
            id="bottom-nav-more"
            onClick={() => setIsMoreMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-1 relative min-h-[46px] transition-all cursor-pointer group select-none"
          >
            <div className={`relative px-3.5 py-1 rounded-full transition-all duration-200 ${
              isMoreActive 
                ? 'bg-[#1E232D] text-white shadow-xs' 
                : 'text-stone-400 group-hover:text-stone-700'
            }`}>
              <MoreHorizontal className={`w-5 h-5 transition-transform duration-150 ${isMoreActive ? 'scale-105 stroke-[2.2]' : 'stroke-[1.8]'}`} />
              {!isConnectedGas && (
                <span className="absolute top-0.5 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white" />
              )}
            </div>
            <span className={`text-[10px] mt-0.5 tracking-tight font-semibold transition-colors ${
              isMoreActive ? 'text-[#1E232D] font-bold' : 'text-stone-500'
            }`}>
              Lainnya
            </span>
          </button>
        </div>
      </div>
    </>
  );
};
