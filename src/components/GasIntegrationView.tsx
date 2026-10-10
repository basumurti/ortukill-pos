import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileCode2, 
  Copy, 
  Check, 
  FileSpreadsheet, 
  Terminal, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  HelpCircle,
  Database,
  ArrowDownCircle,
  Tag,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCheck,
  Star,
  Pencil,
  RotateCcw,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { generateEnhancedGoogleAppsScriptCode } from '../services/gasCodeGenerator';
import { GasApiService, GasDiagnosticResult, DEFAULT_GAS_WEBAPP_URL } from '../services/gasApiService';
import { StorageService } from '../services/storageService';
import { INITIAL_PRODUCTS } from '../data/initialData';

interface GasIntegrationViewProps {
  onSyncComplete?: () => void;
}

export const GasIntegrationView: React.FC<GasIntegrationViewProps> = ({ onSyncComplete }) => {
  const [copied, setCopied] = useState(false);
  const [webAppUrl, setWebAppUrl] = useState('');
  const [primaryStoreUrl, setPrimaryStoreUrl] = useState<string>(GasApiService.getPrimaryStoreUrl());
  const [isEditingPrimary, setIsEditingPrimary] = useState<boolean>(false);
  const [primaryInputDraft, setPrimaryInputDraft] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fillingCategories, setFillingCategories] = useState(false);
  const [copiedCategories, setCopiedCategories] = useState(false);
  const [showCategoryTable, setShowCategoryTable] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('ALL');
  const [diagnostic, setDiagnostic] = useState<GasDiagnosticResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testingWriteDelete, setTestingWriteDelete] = useState(false);
  const [scriptVersion, setScriptVersion] = useState<{
    installedVersion?: string | null;
    expectedVersion?: string;
    upToDate?: boolean;
    message?: string;
  } | null>(null);
  const [checkingVersion, setCheckingVersion] = useState(false);

  const checkScriptVersion = async () => {
    setCheckingVersion(true);
    try {
      const res = await GasApiService.checkScriptVersion();
      setScriptVersion(res.success ? res : null);
    } finally {
      setCheckingVersion(false);
    }
  };

  useEffect(() => {
    checkScriptVersion();
  }, []);
  const [writeDeleteResult, setWriteDeleteResult] = useState<{
    success: boolean;
    message: string;
    stage?: string;
    testId?: string;
    writeResult?: any;
    deleteResult?: any;
  } | null>(null);

  const handleTestWriteDelete = async () => {
    const url = (webAppUrl || primaryStoreUrl || '').trim();
    if (!url) {
      setErrorMessage('Masukkan URL Web App terlebih dahulu.');
      return;
    }

    setTestingWriteDelete(true);
    setWriteDeleteResult(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await GasApiService.testWriteAndDeleteLogPenjualan(url);
      setWriteDeleteResult(res);
      if (res.success) {
        setSuccessMessage('✓ Sukses! Uji coba Tulis dan Hapus di LOG_PENJUALAN berhasil 100%. Baris uji coba telah dihapus bersih.');
      } else {
        setErrorMessage(res.message || 'Uji coba gagal pada tahap ' + (res.stage || 'proses'));
      }
    } catch (err: any) {
      setErrorMessage('Terjadi error saat uji coba: ' + err.message);
    } finally {
      setTestingWriteDelete(false);
    }
  };

  const scriptCode = generateEnhancedGoogleAppsScriptCode();

  const productsList = useMemo(() => {
    const stored = StorageService.getProducts();
    const list = stored && stored.length > 0 ? stored : INITIAL_PRODUCTS;
    return [...list].sort((a, b) => (a.rowNumber || 999) - (b.rowNumber || 999));
  }, []);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    productsList.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [productsList]);

  const filteredProducts = useMemo(() => {
    return productsList.filter(p => {
      const matchSearch = !categorySearch.trim() || 
        p.name.toLowerCase().includes(categorySearch.toLowerCase()) || 
        p.sku.toLowerCase().includes(categorySearch.toLowerCase()) ||
        p.category.toLowerCase().includes(categorySearch.toLowerCase());
      const matchCat = selectedCatFilter === 'ALL' || p.category === selectedCatFilter;
      return matchSearch && matchCat;
    });
  }, [productsList, categorySearch, selectedCatFilter]);

  const handleFillCategoriesInSheet = async () => {
    setFillingCategories(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await GasApiService.fillCategoriesInSheet();
      if (res.success) {
        setSuccessMessage(`Berhasil mengisi Kolom J di Spreadsheet! (${res.message || 'Kategori diperbarui'})`);
        await GasApiService.fetchAndSyncAll();
        if (onSyncComplete) onSyncComplete();
      } else {
        setErrorMessage(res.message || 'Gagal mengisi Kolom J. Pastikan Kode.gs terbaru sudah dideploy.');
      }
    } catch (err: any) {
      setErrorMessage('Terjadi error saat mengisi kategori: ' + err.message);
    } finally {
      setFillingCategories(false);
    }
  };

  const handleCopyColumnJValues = () => {
    const textLines = productsList.map(p => p.category || 'ANGGUR').join('\n');
    navigator.clipboard.writeText(textLines);
    setCopiedCategories(true);
    setTimeout(() => setCopiedCategories(false), 3000);
    setSuccessMessage('Daftar Kolom J berhasil disalin! Silakan buka Spreadsheet Anda, klik pada sel J71, lalu tekan Ctrl+V (atau Cmd+V).');
  };

  useEffect(() => {
    const initUrl = async () => {
      try {
        const status = await GasApiService.getStatus();
        const primary = status.primaryWebAppUrl || GasApiService.getPrimaryStoreUrl();
        const urlToUse = status.webAppUrl || primary;
        setPrimaryStoreUrl(primary);
        setWebAppUrl(urlToUse);
        testUrl(urlToUse);
      } catch {
        const primary = GasApiService.getPrimaryStoreUrl();
        const saved = GasApiService.getSavedWebAppUrl();
        setPrimaryStoreUrl(primary);
        setWebAppUrl(saved);
        testUrl(saved);
      }
    };
    initUrl();
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Jadikan URL yang sedang diketik sebagai URL Utama Toko baru
  const handleSetCurrentAsPrimary = async () => {
    if (!webAppUrl.trim()) {
      setErrorMessage('Silakan masukkan URL Web App terlebih dahulu.');
      return;
    }
    try {
      const clean = webAppUrl.trim();
      await GasApiService.setPrimaryStoreUrl(clean);
      setPrimaryStoreUrl(clean);
      setSuccessMessage('⭐ URL Utama Toko berhasil diubah dan disimpan permanen!');
      testUrl(clean);
    } catch (err: any) {
      setErrorMessage('Gagal menyimpan URL Utama Toko: ' + err.message);
    }
  };

  // Beralih kembali ke URL Utama Toko
  const handleUsePrimaryUrl = () => {
    const primary = primaryStoreUrl || GasApiService.getPrimaryStoreUrl();
    setWebAppUrl(primary);
    GasApiService.setSavedWebAppUrl(primary);
    testUrl(primary);
    setSuccessMessage('Berhasil beralih ke URL Utama Toko!');
  };

  // Buka editor inline URL Utama Toko
  const handleStartEditPrimary = () => {
    setPrimaryInputDraft(primaryStoreUrl);
    setIsEditingPrimary(true);
  };

  // Simpan perubahan URL Utama Toko dari editor inline
  const handleSaveEditedPrimary = async () => {
    if (!primaryInputDraft.trim()) {
      setErrorMessage('URL Utama Toko tidak boleh kosong.');
      return;
    }
    try {
      const clean = primaryInputDraft.trim();
      await GasApiService.setPrimaryStoreUrl(clean);
      setPrimaryStoreUrl(clean);
      setWebAppUrl(clean);
      setIsEditingPrimary(false);
      setSuccessMessage('⭐ URL Utama Toko berhasil diperbarui & disimpan permanen!');
      testUrl(clean);
    } catch (err: any) {
      setErrorMessage('Gagal memperbarui URL Utama Toko: ' + err.message);
    }
  };

  const testUrl = async (urlToTest: string) => {
    if (!urlToTest.trim()) return;
    setTesting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await GasApiService.testConnection(urlToTest.trim());
      setDiagnostic(res);
      if (res.success) {
        setSuccessMessage('Koneksi ke spreadsheet berhasil diverifikasi!');
      } else {
        setErrorMessage(res.message || 'Gagal terhubung ke Google Apps Script.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menguji URL.');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndTest = async () => {
    if (!webAppUrl.trim()) {
      setErrorMessage('Silakan masukkan URL Web App Google Apps Script.');
      return;
    }

    setTesting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await GasApiService.configureWebAppUrl(webAppUrl.trim());
      const res = await GasApiService.testConnection(webAppUrl.trim());
      setDiagnostic(res);
      if (res.success) {
        setSuccessMessage('URL berhasil disimpan permanen ke server & koneksi terverifikasi!');
      } else {
        setErrorMessage(res.message || 'URL disimpan, namun gagal merespons. Pastikan opsi hak akses Deployment adalah "Anyone".');
      }
    } catch (err: any) {
      setErrorMessage('Koneksi gagal: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const handlePullAllData = async () => {
    if (!webAppUrl.trim()) {
      setErrorMessage('Masukkan URL Web App terlebih dahulu.');
      return;
    }

    setSyncing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await GasApiService.fetchAndSyncAll();
      if (res.success) {
        setSuccessMessage(`Berhasil menarik data! Memuat ${res.products?.length || 0} produk dan ${res.todayTransactions?.length || 0} transaksi hari ini.`);
        if (onSyncComplete) onSyncComplete();
      } else {
        setErrorMessage(res.message || 'Gagal memuat data dari Spreadsheet.');
      }
    } catch (err: any) {
      setErrorMessage('Sinkronisasi gagal: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);

  const handleCleanDuplicates = async () => {
    setCleaningDuplicates(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await GasApiService.cleanUpDuplicatesInSheet();
      if (res.success) {
        setSuccessMessage(res.message || 'Pembersihan duplikat selesai!');
        await GasApiService.fetchAndSyncAll();
        if (onSyncComplete) onSyncComplete();
      } else {
        setErrorMessage(res.message || 'Gagal membersihkan duplikat.');
      }
    } catch (err: any) {
      setErrorMessage('Error pembersihan duplikat: ' + err.message);
    } finally {
      setCleaningDuplicates(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight">
                Integrasi Google Spreadsheet
              </h2>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  scriptVersion?.upToDate
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
                title={scriptVersion?.message || 'Versi Apps Script yang sedang terpasang di Google Sheets'}
              >
                {checkingVersion
                  ? 'Cek versi script…'
                  : scriptVersion
                  ? scriptVersion.upToDate
                    ? `Script ${scriptVersion.installedVersion} ✓ terbaru`
                    : `Script ${scriptVersion.installedVersion || '?'} — perlu diperbarui`
                  : 'Versi script tidak diketahui'}
              </span>
              <button
                type="button"
                onClick={checkScriptVersion}
                disabled={checkingVersion}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-stone-200 bg-white hover:bg-stone-50 text-stone-500 cursor-pointer disabled:opacity-50"
                title="Periksa ulang versi Apps Script yang terpasang"
              >
                Cek ulang
              </button>
            </div>
            <p className="text-xs text-stone-500">
              Sinkronisasi data real-time: Master Produk B70:H (Read-Only) & Log Penjualan B7:M (Harga Biasa)
            </p>
          </div>
        </div>

        <button
          onClick={handleCopyCode}
          id="btn-copy-gas-code"
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap min-h-[44px]"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400 stroke-[3]" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Kode .gs Terbaru'}</span>
        </button>
      </div>

      {/* PERINGATAN: script di Google Sheets masih versi lama */}
      {scriptVersion && scriptVersion.upToDate === false && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5">
          <div className="font-extrabold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Script yang terpasang di Google Sheets masih <span className="font-black">{scriptVersion.installedVersion || 'versi lama'}</span>, sedangkan aplikasi ini memakai <span className="font-black">{scriptVersion.expectedVersion}</span>.
          </div>
          <div className="leading-relaxed">
            Akibatnya tombol <strong>VOID / Hapus</strong> hanya <strong>menandai</strong> transaksi jadi <code className="bg-amber-100 px-1 rounded">VOIDED-…</code> dan <strong>barisnya tetap ada</strong> di Google Sheets.
          </div>
          <div className="leading-relaxed">
            <strong>Cara memperbaiki:</strong> klik <strong>“Salin Kode .gs Terbaru”</strong> di atas → di editor Apps Script tekan <strong>Ctrl+A</strong> lalu <strong>Ctrl+V</strong> (timpa semua) → <strong>Simpan</strong> → <strong>Deploy → Manage deployments → ikon pensil → Version: “New version” → Deploy</strong>.
          </div>
          <div className="text-[11px] text-amber-800/80">
            Sesudah deploy, klik <strong>Cek ulang</strong> di atas — kalau sudah hijau, tombol VOID akan benar-benar menghapus barisnya.
          </div>
        </div>
      )}

      {/* Unified Logic: Penulisan Bersih & Hapus/VOID Otomatis Tanpa Benturan */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 rounded-2xl p-4 border border-teal-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-stone-900 text-sm">
                  Sistem Terpadu: Penulisan Bersih & Penghapusan Otomatis (Anti-Benturan)
                </span>
                <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Harmonis & Aktif
                </span>
              </div>
              <p className="text-stone-600 text-xs mt-1 leading-relaxed">
                Logika penulisan dan penghapusan diatur secara sinkron agar tidak saling menghalangi:
              </p>
            </div>
          </div>

          <button
            onClick={handleCleanDuplicates}
            disabled={cleaningDuplicates}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap min-h-[40px] flex-shrink-0"
            title="Bersihkan baris ganda yang tidak sengaja terinput di Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cleaningDuplicates ? 'animate-spin' : ''}`} />
            <span>{cleaningDuplicates ? 'Membersihkan Duplikat...' : 'Bersihkan Duplikat di Sheets'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-teal-100">
          <div className="bg-white/80 p-2.5 rounded-xl border border-teal-200/50">
            <span className="font-bold text-teal-900 block mb-0.5">✓ 1. Saat Transaksi Kasir Dibuat (Write):</span>
            <span className="text-stone-600 leading-normal">
              Dicatat langsung ke sheet <strong>LOG_PENJUALAN</strong> (dan ongkir ke <strong>LAIN-LAIN</strong>) sekali saja tanpa dobel.
            </span>
          </div>

          <div className="bg-white/80 p-2.5 rounded-xl border border-rose-200/50">
            <span className="font-bold text-rose-900 block mb-0.5">✓ 2. Saat Transaksi Di-VOID / Dihapus (Delete):</span>
            <span className="text-stone-600 leading-normal">
              Seluruh baris transaksi langsung <strong>dihapus permanen (deleteRow)</strong> dari Google Sheets, dan kunci anti-duplikat langsung dilepas seketika.
            </span>
          </div>
        </div>
      </div>

      {/* NEW: Test & Verify LOG_PENJUALAN Write & Delete Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-[#FF5E36]/30 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center font-black">
              🧪
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-stone-900">
                  Uji Coba Otomatis: Tulis & Hapus LOG_PENJUALAN
                </h3>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  v3.5 Siap Diuji
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Menguji penulisan transaksi kasir ke <strong>LOG_PENJUALAN</strong> dan langsung menghapusnya kembali untuk memastikan sistem 100% normal.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestWriteDelete}
            disabled={testingWriteDelete}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-sm min-h-[44px] flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${testingWriteDelete ? 'animate-spin' : ''}`} />
            <span>{testingWriteDelete ? 'Menguji Tulis & Hapus...' : 'Jalankan Tes Tulis & Hapus Sekarang'}</span>
          </button>
        </div>

        {/* Live Test Diagnostic Output */}
        {testingWriteDelete && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <RefreshCw className="w-4 h-4 animate-spin text-[#FF5E36]" />
              <span>Sedang memproses pengujian pipeline Google Sheets...</span>
            </div>
            <ul className="text-[11px] text-amber-700 space-y-1 list-disc list-inside">
              <li>Tahap 1: Mengirim dummy transaksi ke sheet LOG_PENJUALAN via saveTransaction...</li>
              <li>Tahap 2: Menunggu konfirmasi nomor baris yang tercatat di Spreadsheet...</li>
              <li>Tahap 3: Menjalankan penghapusan otomatis (deleteRow) agar sheet tetap bersih...</li>
            </ul>
          </div>
        )}

        {writeDeleteResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-2.5 animate-in fade-in ${
            writeDeleteResult.success 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50/80 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2">
              {writeDeleteResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              )}
              <h4 className="font-extrabold text-xs sm:text-sm">
                {writeDeleteResult.message}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="bg-white/80 p-2.5 rounded-lg border border-stone-200/80 space-y-1">
                <span className="font-bold text-stone-700 block">1. Status Penulisan (WRITE):</span>
                <span className="text-stone-600">
                  {writeDeleteResult.writeResult?.message || (writeDeleteResult.stage === 'WRITE' ? 'Gagal pada tahap penulisan' : 'Berhasil')}
                </span>
                {writeDeleteResult.writeResult?.startRow && (
                  <span className="block font-mono text-[10px] text-emerald-700">
                    Tercatat di baris: {writeDeleteResult.writeResult.startRow}
                  </span>
                )}
              </div>

              <div className="bg-white/80 p-2.5 rounded-lg border border-stone-200/80 space-y-1">
                <span className="font-bold text-stone-700 block">2. Status Penghapusan (DELETE):</span>
                <span className="text-stone-600">
                  {writeDeleteResult.deleteResult?.message || (writeDeleteResult.success ? 'Berhasil dihapus' : 'Belum selesai')}
                </span>
                {writeDeleteResult.deleteResult?.deletedSalesRows !== undefined && (
                  <span className="block font-mono text-[10px] text-emerald-700">
                    Baris dihapus: {writeDeleteResult.deleteResult.deletedSalesRows} baris
                  </span>
                )}
              </div>
            </div>

            {writeDeleteResult.testId && (
              <p className="text-[10px] text-stone-500 font-mono">
                ID Uji Coba: {writeDeleteResult.testId}
              </p>
            )}
          </div>
        )}
      </div>

      {/* URL Input & Quick Sync Controls */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#FF5E36]" />
            <h3 className="text-sm font-extrabold text-stone-900">
              Koneksi Web App Google Apps Script
            </h3>
          </div>
          {diagnostic?.success ? (
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>TERHUBUNG</span>
            </span>
          ) : (
            <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Belum Terhubung</span>
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-stone-50 border border-stone-200/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center flex-shrink-0">
              <Star className="w-4 h-4 fill-[#FF5E36]" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-stone-900">URL Utama Toko:</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Tersimpan Permanen
                </span>
              </div>
              <p className="text-[11px] font-mono text-stone-500 truncate max-w-xs sm:max-w-md mt-0.5" title={primaryStoreUrl}>
                {primaryStoreUrl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {/* Tombol beralih kembali ke URL Utama jika input berbeda */}
            {webAppUrl.trim() !== primaryStoreUrl.trim() && (
              <button
                type="button"
                onClick={handleUsePrimaryUrl}
                className="text-[11px] font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Gunakan URL Utama Toko saat ini"
              >
                <RotateCcw className="w-3 h-3 text-stone-500" />
                <span>Gunakan URL Utama</span>
              </button>
            )}

            {/* Tombol Jadikan URL yang sedang diketik sebagai URL Utama Toko */}
            <button
              type="button"
              onClick={handleSetCurrentAsPrimary}
              disabled={!webAppUrl.trim() || webAppUrl.trim() === primaryStoreUrl.trim()}
              className="text-[11px] font-bold text-[#FF5E36] bg-[#FFF2ED] hover:bg-[#FFE5DC] border border-[#FF5E36]/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
              title="Jadikan URL yang diketik di bawah sebagai URL Utama Toko"
            >
              <Star className="w-3 h-3" />
              <span>Jadikan URL Utama</span>
            </button>

            {/* Tombol Ubah URL Utama Toko */}
            <button
              type="button"
              onClick={handleStartEditPrimary}
              className="text-[11px] font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Ketik atau paste URL Utama Toko baru"
            >
              <Pencil className="w-3 h-3 text-stone-500" />
              <span>Ubah URL Utama</span>
            </button>
          </div>
        </div>

        {/* Panel input inline jika user klik "Ubah URL Utama" */}
        {isEditingPrimary && (
          <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-amber-600" />
                Masukkan URL Utama Toko yang Baru:
              </span>
              <button
                type="button"
                onClick={() => setIsEditingPrimary(false)}
                className="text-[11px] text-stone-500 hover:text-stone-800 font-semibold cursor-pointer"
              >
                Batal
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={primaryInputDraft}
                onChange={(e) => setPrimaryInputDraft(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF5E36]"
              />
              <button
                type="button"
                onClick={handleSaveEditedPrimary}
                className="px-4 py-2 bg-[#FF5E36] hover:bg-[#F24E24] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                Simpan Sebagai URL Utama
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={webAppUrl}
            onChange={(e) => setWebAppUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
            className="flex-1 px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#FF5E36]"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveAndTest}
              disabled={testing}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin text-[#FF5E36]' : ''}`} />
              <span>{testing ? 'Menguji...' : 'Uji Koneksi'}</span>
            </button>
            <button
              onClick={handlePullAllData}
              disabled={syncing || !webAppUrl.trim()}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 shadow-xs min-h-[44px]"
            >
              <ArrowDownCircle className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
              <span>{syncing ? 'Menarik...' : 'Tarik Data'}</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Diagnostics Panel */}
        {diagnostic && diagnostic.success && (
          <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 space-y-2 mt-2">
            <div className="flex items-center justify-between border-b border-stone-200/80 pb-2">
              <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#FF5E36]" />
                Hasil Diagnostik Spreadsheet
              </span>
              <span className="text-[10px] text-stone-400">
                {diagnostic.timezone || 'Asia/Jakarta'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-stone-100">
                <p className="text-stone-400 text-[10px] uppercase font-bold">Sheet Produk</p>
                <p className="font-bold text-stone-800 mt-0.5 truncate">
                  {diagnostic.sheetsStatus?.productsSheetName || 'DASHBOARD_MUTASI_&_PROFIT'}
                </p>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  {diagnostic.sheetsStatus?.productsRowCount ? `${diagnostic.sheetsStatus.productsRowCount} baris` : 'Baris 71+'} (Read)
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-stone-100">
                <p className="text-stone-400 text-[10px] uppercase font-bold">Log Penjualan</p>
                <p className="font-bold text-stone-800 mt-0.5 truncate">
                  {diagnostic.sheetsStatus?.salesLogSheetName || 'LOG_PENJUALAN'}
                </p>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  {diagnostic.sheetsStatus?.salesLogRowCount ? `${diagnostic.sheetsStatus.salesLogRowCount} baris` : 'Baris 8+'} (Write)
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-stone-100">
                <p className="text-stone-400 text-[10px] uppercase font-bold">Barang Masuk</p>
                <p className="font-bold text-stone-800 mt-0.5 truncate">LOG_BARANG_MASUK</p>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  {diagnostic.sheetsStatus?.barangMasukRowCount ? `${diagnostic.sheetsStatus.barangMasukRowCount} baris` : 'Baris 5+'} (Write)
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-stone-100">
                <p className="text-emerald-600 text-[10px] uppercase font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Sheet LAIN-LAIN
                </p>
                <p className="font-bold text-stone-800 mt-0.5 truncate">LAIN-LAIN</p>
                <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                  {diagnostic.sheetsStatus?.pengeluaranLainRowCount ? `${diagnostic.sheetsStatus.pengeluaranLainRowCount} baris` : 'A4:F'} (Read & Write)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Column J Category Assistant Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center flex-shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900 tracking-tight">
                  Kategori Produk Kolom J (B70:J)
                </h3>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                  Sinkron Aktif
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Range <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-[11px] text-stone-700 font-bold">DASHBOARD_MUTASI_&_PROFIT B70:J</code> (Cell J70: Header KATEGORI, Cell J71+: Data Kategori).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyColumnJValues}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
              title="Salin semua kategori untuk langsung di-paste di sel J71 Google Sheets"
            >
              {copiedCategories ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCategories ? 'Tersalin!' : 'Salin Data Kolom J'}</span>
            </button>

            <button
              onClick={handleFillCategoriesInSheet}
              disabled={fillingCategories || !webAppUrl.trim()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF5E36] hover:bg-[#F24E24] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title="Perintahkan Google Apps Script untuk mengisi Kolom J di Spreadsheet secara otomatis"
            >
              <Sparkles className={`w-3.5 h-3.5 ${fillingCategories ? 'animate-spin' : ''}`} />
              <span>{fillingCategories ? 'Mengisi...' : '✨ Auto-Fill Kolom J di Sheets'}</span>
            </button>
          </div>
        </div>

        {/* Informational guide */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-[10px] font-bold text-[#FF5E36] uppercase tracking-wider block">Aturan Kolom J</span>
            <p className="text-xs text-stone-700 font-medium mt-1 leading-snug">
              Jika Kolom J diisi di Google Sheets, sistem kasir akan langsung memakai kategori tersebut. Jika masih kosong, sistem menggunakan klasifikasi otomatis.
            </p>
          </div>

          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-[10px] font-bold text-[#FF5E36] uppercase tracking-wider block">Opsi 1: Klik 1 Tombol</span>
            <p className="text-xs text-stone-700 font-medium mt-1 leading-snug">
              Klik <strong>Auto-Fill Kolom J di Sheets</strong> di atas. Apps Script akan otomatis mengisi cell J70 ('KATEGORI') dan baris 71 ke bawah dengan kategori yang tepat.
            </p>
          </div>

          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-[10px] font-bold text-[#FF5E36] uppercase tracking-wider block">Opsi 2: Salin & Paste Manual</span>
            <p className="text-xs text-stone-700 font-medium mt-1 leading-snug">
              Klik <strong>Salin Data Kolom J</strong>, lalu buka Google Sheets, klik sel <strong>J71</strong>, dan tekan <strong>Ctrl + V</strong>.
            </p>
          </div>
        </div>

        {/* Toggle table preview */}
        <div className="pt-1">
          <button
            onClick={() => setShowCategoryTable(!showCategoryTable)}
            className="flex items-center gap-2 text-xs font-bold text-stone-700 hover:text-stone-900 transition-colors cursor-pointer"
          >
            <span>{showCategoryTable ? 'Sembunyikan Daftar Kategori Kolom J' : `Lihat Daftar Pemetaan Kategori Produk (${productsList.length} Item)`}</span>
            {showCategoryTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showCategoryTable && (
            <div className="mt-3 space-y-3 border border-stone-200/70 rounded-2xl p-3 bg-stone-50/50">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Cari SKU, Nama, atau Kategori..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#FF5E36]"
                  />
                </div>

                <div className="flex gap-1.5 flex-wrap w-full sm:w-auto">
                  <button
                    onClick={() => setSelectedCatFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      selectedCatFilter === 'ALL'
                        ? 'bg-stone-900 text-white'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    Semua ({productsList.length})
                  </button>
                  {uniqueCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCatFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        selectedCatFilter === cat
                          ? 'bg-[#FF5E36] text-white'
                          : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-stone-100 border-b border-stone-200 text-stone-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2 w-16">Baris Sheet</th>
                      <th className="px-3 py-2 w-28">SKU</th>
                      <th className="px-3 py-2">Nama Produk</th>
                      <th className="px-3 py-2">Kategori Kolom J</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredProducts.map((p, idx) => (
                      <tr key={p.id || p.sku || idx} className="hover:bg-stone-50/80">
                        <td className="px-3 py-2 font-mono text-[11px] text-stone-500">
                          {p.rowNumber || (71 + idx)}
                        </td>
                        <td className="px-3 py-2 font-mono text-stone-800 font-bold">
                          {p.sku}
                        </td>
                        <td className="px-3 py-2 text-stone-800 font-medium">
                          {p.name}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FFF2ED] text-[#FF5E36] border border-[#FF5E36]/20">
                            {p.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-stone-400 text-xs">
                          Tidak ditemukan produk yang cocok dengan pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3 Step Deployment Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center text-xs font-bold">
              1
            </span>
            <h4 className="font-bold text-xs text-stone-900">Buka Spreadsheet</h4>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            Buka file Google Sheets ORTUKILL Anda. Klik menu <strong>Ekstensi</strong> &gt; <strong>Apps Script</strong>.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center text-xs font-bold">
              2
            </span>
            <h4 className="font-bold text-xs text-stone-900">Perbarui Kode.gs</h4>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            Klik tombol "Salin Kode .gs Terbaru" di atas, ganti seluruh isi file <code className="text-stone-800 font-mono text-[10px] bg-stone-100 px-1 py-0.5 rounded">Kode.gs</code>, lalu klik Simpan.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#FFF2ED] text-[#FF5E36] flex items-center justify-center text-xs font-bold">
              3
            </span>
            <h4 className="font-bold text-xs text-stone-900">Deployment Baru (Wajib Versi Baru)</h4>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            Klik <strong>Terapkan (Deploy)</strong> &gt; <strong>Kelola penerapan (Manage deployments)</strong> &gt; Ikon pensil (Edit) &gt; Versi: <strong>Versi baru (New version)</strong> &gt; Terapkan. Pastikan Akses: <strong>Siapa saja (Anyone)</strong>.
          </p>
        </div>
      </div>

      {/* Code Preview Box */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <span className="text-xs font-bold text-stone-700 flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-[#FF5E36]" />
            <span>Kode.gs (Google Apps Script Backend)</span>
          </span>
          <button
            onClick={handleCopyCode}
            className="text-xs font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Salin</span>
          </button>
        </div>
        <pre className="p-4 text-[11px] font-mono text-stone-700 overflow-x-auto max-h-72 leading-relaxed bg-stone-50/50 select-all">
          {scriptCode}
        </pre>
      </div>
    </div>
  );
};
