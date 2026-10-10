import React, { useState, useRef } from 'react';
import { 
  Printer, 
  Share2, 
  X, 
  CheckCircle2, 
  MessageSquare, 
  Check,
  Download,
  Loader2,
  Ban,
  Trash2,
  AlertTriangle,
  Copy,
  Image,
  FileImage,
  CheckCheck
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { TransactionReceipt, BrandConfig } from '../types';
import { formatRupiah } from '../services/storageService';

interface ReceiptModalProps {
  receipt: TransactionReceipt | null;
  brand: BrandConfig;
  isOpen: boolean;
  onClose: () => void;
  onVoidTransaction?: (id: string, reason: string) => void;
  onDeleteTransaction?: (id: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  brand,
  isOpen,
  onClose,
  onVoidTransaction,
  onDeleteTransaction,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedPng, setCopiedPng] = useState(false);
  const [isCopyingPng, setIsCopyingPng] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [toastNotif, setToastNotif] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !receipt) return null;

  const showNotif = (msg: string) => {
    setToastNotif(msg);
    setTimeout(() => {
      setToastNotif((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleConfirmVoid = () => {
    if (onVoidTransaction && receipt) {
      onVoidTransaction(receipt.id, voidReason || 'Dibatalkan oleh kasir');
      setShowVoidConfirm(false);
      setVoidReason('');
      onClose();
    }
  };

  const handleConfirmDelete = () => {
    if (onDeleteTransaction && receipt) {
      onDeleteTransaction(receipt.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getWhatsAppShareText = () => {
    const itemLines = receipt.items
      .map((i) => {
        const itemSubtotal = i.total ?? i.subtotal ?? (i.qty * i.price);
        return `• ${i.name}\n  ${i.qty} x ${formatRupiah(i.price)} = ${formatRupiah(itemSubtotal)}`;
      })
      .join('\n');

    return encodeURIComponent(
      `*STRUK PEMBELIAN - ${brand.NAME}*\n` +
      `${brand.DESCRIPTION_1}\n` +
      `--------------------------------\n` +
      `No. Struk: ${receipt.id}\n` +
      `Waktu: ${receipt.transactionDate}\n` +
      `Metode: ${receipt.paymentMethod}\n` +
      (receipt.customerName ? `Pelanggan: ${receipt.customerName}\n` : '') +
      `--------------------------------\n` +
      `${itemLines}\n` +
      `--------------------------------\n` +
      (receipt.discount > 0 ? `Subtotal: ${formatRupiah(receipt.subtotal)}\nPromo/Diskon: -${formatRupiah(receipt.discount)}${receipt.promoName ? ` (${receipt.promoName})` : ''}\n` : '') +
      (receipt.shippingFee && receipt.shippingFee > 0 ? `Ongkir: +${formatRupiah(receipt.shippingFee)}\n` : '') +
      `*TOTAL: ${formatRupiah(receipt.total)}*\n` +
      (receipt.paymentMethod === 'CASH' && receipt.cashReceived ? 
        `Tunai: ${formatRupiah(receipt.cashReceived)}\nKembalian: ${formatRupiah(receipt.cashChange || 0)}\n` : '') +
      `--------------------------------\n` +
      `TERIMAKASIH SELAMAT-BERSENANG-SENANG * ATLAS AMER KEDIRI SIAP SEDIA Melayani Setiap Kebutuhan Minum Kamu.\n` +
      `WA/Info: ${brand.PHONE}`
    );
  };

  const handleShareWA = () => {
    const text = getWhatsAppShareText();
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const downloadReceiptCanvasFallback = () => {
    try {
      const canvas = document.createElement('canvas');
      const width = 420;
      const padding = 24;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dynamicHeight = 400 + (receipt.items.length * 44);
      canvas.width = width;
      canvas.height = dynamicHeight;

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, dynamicHeight);

      // Brand Title
      ctx.fillStyle = '#0c0a09';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(brand.NAME || 'ORTUKILL POS', width / 2, 40);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#44403c';
      ctx.fillText(brand.SUBTITLE || 'POS / KASIR', width / 2, 60);
      ctx.fillText(brand.DESCRIPTION_1 || '', width / 2, 78);
      ctx.fillText(`WA: ${brand.PHONE || ''}`, width / 2, 96);

      // Dash line
      ctx.strokeStyle = '#cbd5e1';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding, 110);
      ctx.lineTo(width - padding, 110);
      ctx.stroke();

      // Meta
      ctx.textAlign = 'left';
      ctx.font = '11px monospace';
      ctx.fillStyle = '#334155';
      let y = 132;
      ctx.fillText(`No. Nota : ${receipt.id}`, padding, y);
      y += 18;
      ctx.fillText(`Waktu    : ${receipt.transactionDate}`, padding, y);
      y += 18;
      ctx.fillText(`Metode   : ${receipt.paymentMethod}`, padding, y);
      if (receipt.customerName) {
        y += 18;
        ctx.fillText(`Customer : ${receipt.customerName}`, padding, y);
      }

      y += 14;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      y += 22;

      // Items
      receipt.items.forEach((item) => {
        const itemSubtotal = item.total ?? item.subtotal ?? (item.qty * item.price);
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
        ctx.fillText(formatRupiah(itemSubtotal), width - padding, y);
        y += 22;
      });

      // Separator
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      y += 20;

      // Totals
      ctx.textAlign = 'left';
      ctx.font = '11px monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`Total Item: ${receipt.totalQty} botol`, padding, y);
      y += 18;

      if (receipt.discount > 0) {
        ctx.fillText(`Subtotal`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(formatRupiah(receipt.subtotal), width - padding, y);
        y += 18;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#dc2626';
        const promoLabel = receipt.promoName ? `Diskon (${receipt.promoName})` : 'Diskon';
        ctx.fillText(promoLabel.length > 28 ? promoLabel.slice(0, 26) + '..' : promoLabel, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(`-${formatRupiah(receipt.discount)}`, width - padding, y);
        y += 18;
      }

      if (receipt.shippingFee && receipt.shippingFee > 0) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ea580c';
        ctx.fillText(`Ongkir`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(`+${formatRupiah(receipt.shippingFee)}`, width - padding, y);
        y += 18;
      }

      // Total Final
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
      ctx.fillText(formatRupiah(receipt.total), width - padding, y);
      y += 24;

      if (receipt.paymentMethod === 'CASH' && receipt.cashReceived) {
        ctx.font = '11px monospace';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'left';
        ctx.fillText(`Uang Diterima`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(formatRupiah(receipt.cashReceived), width - padding, y);
        y += 18;
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#059669';
        ctx.textAlign = 'left';
        ctx.fillText(`Kembalian`, padding, y);
        ctx.textAlign = 'right';
        ctx.fillText(formatRupiah(receipt.cashChange || 0), width - padding, y);
        y += 24;
      }

      // Footer
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
      const link = document.createElement('a');
      link.download = `Struk_${receipt.id}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Canvas fallback error:', e);
    }
  };

  const generateCanvasBlobFallback = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        const width = 420;
        const padding = 24;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        const dynamicHeight = 400 + (receipt.items.length * 44);
        canvas.width = width;
        canvas.height = dynamicHeight;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, dynamicHeight);

        ctx.fillStyle = '#0c0a09';
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(brand.NAME || 'ORTUKILL POS', width / 2, 40);

        ctx.font = '12px monospace';
        ctx.fillStyle = '#44403c';
        ctx.fillText(brand.SUBTITLE || 'POS / KASIR', width / 2, 60);
        ctx.fillText(brand.DESCRIPTION_1 || '', width / 2, 78);
        ctx.fillText(`WA: ${brand.PHONE || ''}`, width / 2, 96);

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
        ctx.fillText(`No. Nota : ${receipt.id}`, padding, y);
        y += 18;
        ctx.fillText(`Waktu    : ${receipt.transactionDate}`, padding, y);
        y += 18;
        ctx.fillText(`Metode   : ${receipt.paymentMethod}`, padding, y);
        if (receipt.customerName) {
          y += 18;
          ctx.fillText(`Customer : ${receipt.customerName}`, padding, y);
        }

        y += 14;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        y += 22;

        receipt.items.forEach((item) => {
          const itemSubtotal = item.total ?? item.subtotal ?? (item.qty * item.price);
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
          ctx.fillText(formatRupiah(itemSubtotal), width - padding, y);
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
        ctx.fillText(`Total Item: ${receipt.totalQty} botol`, padding, y);
        y += 18;

        if (receipt.discount > 0) {
          ctx.fillText(`Subtotal`, padding, y);
          ctx.textAlign = 'right';
          ctx.fillText(formatRupiah(receipt.subtotal), width - padding, y);
          y += 18;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#dc2626';
          const promoLabel = receipt.promoName ? `Diskon (${receipt.promoName})` : 'Diskon';
          ctx.fillText(promoLabel.length > 28 ? promoLabel.slice(0, 26) + '..' : promoLabel, padding, y);
          ctx.textAlign = 'right';
          ctx.fillText(`-${formatRupiah(receipt.discount)}`, width - padding, y);
          y += 18;
        }

        if (receipt.shippingFee && receipt.shippingFee > 0) {
          ctx.textAlign = 'left';
          ctx.fillStyle = '#ea580c';
          ctx.fillText(`Ongkir`, padding, y);
          ctx.textAlign = 'right';
          ctx.fillText(`+${formatRupiah(receipt.shippingFee)}`, width - padding, y);
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
        ctx.fillText(formatRupiah(receipt.total), width - padding, y);
        y += 24;

        if (receipt.paymentMethod === 'CASH' && receipt.cashReceived) {
          ctx.font = '11px monospace';
          ctx.fillStyle = '#475569';
          ctx.textAlign = 'left';
          ctx.fillText(`Uang Diterima`, padding, y);
          ctx.textAlign = 'right';
          ctx.fillText(formatRupiah(receipt.cashReceived), width - padding, y);
          y += 18;
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#059669';
          ctx.textAlign = 'left';
          ctx.fillText(`Kembalian`, padding, y);
          ctx.textAlign = 'right';
          ctx.fillText(formatRupiah(receipt.cashChange || 0), width - padding, y);
          y += 24;
        }

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

        canvas.toBlob((b) => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });
  };

  const handleCopyPng = async () => {
    if (isCopyingPng) return;
    setIsCopyingPng(true);

    try {
      let blob: Blob | null = null;

      // 1. Try rendering container to PNG via html-to-image
      if (receiptRef.current) {
        try {
          const dataUrl = await toPng(receiptRef.current, {
            cacheBust: true,
            pixelRatio: 2.5,
            backgroundColor: '#ffffff',
            skipFonts: true,
            fontEmbedCSS: '',
          });
          const res = await fetch(dataUrl);
          blob = await res.blob();
        } catch (err) {
          console.warn('toPng failed for clipboard, using canvas blob fallback:', err);
        }
      }

      // 2. Fallback to HTML5 Canvas blob
      if (!blob) {
        blob = await generateCanvasBlobFallback();
      }

      if (!blob) {
        throw new Error('Gagal memproses gambar struk.');
      }

      // 3. Attempt Clipboard write with ClipboardItem
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
          await navigator.clipboard.write([item]);
          setCopiedPng(true);
          setTimeout(() => setCopiedPng(false), 3000);
          showNotif('✓ Gambar struk berhasil disalin ke clipboard!');
          return;
        } catch (clipErr: any) {
          console.warn('navigator.clipboard.write failed:', clipErr);
        }
      }

      // Fallback if clipboard write is blocked by browser/iframe: Auto-download PNG
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `Struk_${receipt.id}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotif('Clipboard tidak didukung browser ini. Gambar struk diunduh sebagai PNG.');
    } catch (err: any) {
      console.error('Error copying receipt PNG:', err);
      showNotif('Gagal menyalin gambar struk: ' + (err?.message || 'Error'));
    } finally {
      setIsCopyingPng(false);
    }
  };

  const handleDownloadPng = async () => {
    if (!receiptRef.current) return;
    setIsGeneratingPng(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        skipFonts: true,
        fontEmbedCSS: '',
      });
      const link = document.createElement('a');
      link.download = `Struk_${receipt.id}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('html-to-image render failed, using canvas fallback:', err);
      downloadReceiptCanvasFallback();
    } finally {
      setIsGeneratingPng(false);
    }
  };

  const handleCopyText = () => {
    const plainText = decodeURIComponent(getWhatsAppShareText());
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="receipt-modal-card"
        className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150 my-6"
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-50 border-b border-stone-100 relative">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-extrabold text-stone-900 text-xs">
              Struk #{receipt.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200/60 hover:bg-stone-200 flex items-center justify-center text-stone-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast Notif Banner inside Modal */}
        {toastNotif && (
          <div className="px-4 pt-3 animate-in fade-in duration-150">
            <div className="bg-stone-900 text-white text-xs font-bold px-3.5 py-2.5 rounded-2xl shadow-md flex items-center justify-between gap-2">
              <span className="truncate">{toastNotif}</span>
              <button onClick={() => setToastNotif(null)} className="text-stone-400 hover:text-white p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Thermal Receipt Paper */}
        <div className="p-4 bg-stone-100/70 flex justify-center">
          <div 
            ref={receiptRef}
            id="thermal-receipt-container"
            className="w-full bg-white text-stone-900 p-5 rounded-2xl shadow-xs font-mono text-xs border border-stone-200/80 select-all space-y-3"
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-stone-300">
              <div className="font-black text-base tracking-wider uppercase text-stone-950">
                {brand.NAME}
              </div>
              <p className="text-[11px] font-bold text-stone-600 mt-0.5">{brand.SUBTITLE}</p>
              <p className="text-[10px] text-stone-500 mt-0.5">{brand.DESCRIPTION_1}</p>
              <p className="text-[10px] text-stone-800 font-bold mt-1">WA: {brand.PHONE}</p>
            </div>

            {/* Meta */}
            <div className="py-2 border-b border-dashed border-stone-300 space-y-1 text-[11px] text-stone-600">
              <div className="flex justify-between">
                <span>No. Nota</span>
                <span className="font-bold text-stone-900">{receipt.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu</span>
                <span>{receipt.transactionDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Metode</span>
                <span className="font-bold px-1.5 py-0.2 rounded-md bg-stone-100 text-stone-900">{receipt.paymentMethod}</span>
              </div>
              {receipt.customerName && (
                <div className="flex justify-between">
                  <span>Pelanggan</span>
                  <span className="font-semibold text-stone-900">{receipt.customerName}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="py-2 border-b border-dashed border-stone-300 space-y-1.5">
              {receipt.items.map((item, idx) => {
                const itemSubtotal = item.total ?? item.subtotal ?? (item.qty * item.price);
                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-semibold text-stone-900 leading-tight">
                      {item.name}
                    </div>
                    <div className="flex justify-between text-stone-500 text-[11px]">
                      <span>
                        {item.qty} x {formatRupiah(item.price)}
                      </span>
                      <span className="font-bold text-stone-900">
                        {formatRupiah(itemSubtotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="py-2 border-b border-dashed border-stone-300 space-y-1 text-[11px]">
              <div className="flex justify-between text-stone-500">
                <span>Total Item</span>
                <span>{receipt.totalQty} botol</span>
              </div>
              {receipt.discount > 0 && (
                <>
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal</span>
                    <span>{formatRupiah(receipt.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Diskon {receipt.promoName ? `(${receipt.promoName})` : ''}</span>
                    <span>-{formatRupiah(receipt.discount)}</span>
                  </div>
                </>
              )}
              {receipt.shippingFee && receipt.shippingFee > 0 && (
                <div className="flex justify-between text-[#FF5E36] font-semibold">
                  <span>Ongkir (Pengiriman)</span>
                  <span>+{formatRupiah(receipt.shippingFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black pt-1.5 text-stone-950 border-t border-stone-200">
                <span>TOTAL AKHIR</span>
                <span>{formatRupiah(receipt.total)}</span>
              </div>

              {receipt.paymentMethod === 'CASH' && receipt.cashReceived !== undefined && (
                <>
                  <div className="flex justify-between text-stone-600 pt-1">
                    <span>Uang Diterima</span>
                    <span>{formatRupiah(receipt.cashReceived)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Kembalian</span>
                    <span>{formatRupiah(receipt.cashChange || 0)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-2 text-[10px] text-stone-500 space-y-0.5">
              <p className="font-bold text-stone-800">***SELAMAT BERSENANG-SENANG BESOK MINUM LAGIII!!***</p>
              <p>JANGAN LUPA BINTANG 5 DI GOOGLE MAPS YAA.</p>
              <p className="text-[9px] text-stone-400">••• ATLAS AMER KEDIRI ••• </p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons (min 44px touch targets) */}
        <div className="p-3.5 bg-white border-t border-stone-100 flex flex-col gap-2">
          {/* Primary Action: Kirim WA */}
          <button
            onClick={handleShareWA}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wide transition-all cursor-pointer shadow-xs min-h-[46px]"
          >
            <MessageSquare className="w-4 h-4 fill-current" />
            <span>Kirim Nota ke WhatsApp</span>
          </button>

          {/* Special Action: Copy PNG Image */}
          <button
            onClick={handleCopyPng}
            disabled={isCopyingPng}
            id="copy-receipt-png-button"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FFF2ED] hover:bg-[#FFE5DE] text-[#FF5E36] border border-[#FF5E36]/30 font-extrabold text-xs transition-all cursor-pointer shadow-xs min-h-[44px] disabled:opacity-50"
            title="Salin Struk sebagai Gambar PNG ke Clipboard"
          >
            {isCopyingPng ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#FF5E36]" />
                <span>Memproses Gambar Struk...</span>
              </>
            ) : copiedPng ? (
              <>
                <CheckCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Gambar Tersalin ke Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 stroke-[2.5]" />
                <span>Copy PNG (Salin Struk Gambar)</span>
              </>
            )}
          </button>

          {/* Secondary Actions: Print, Download, Salin Teks */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs transition-colors cursor-pointer min-h-[44px]"
            >
              <Printer className="w-3.5 h-3.5 text-[#FF5E36]" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPng}
              disabled={isGeneratingPng}
              id="download-receipt-png-button"
              className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs transition-colors cursor-pointer min-h-[44px]"
              title="Download Struk sebagai File PNG"
            >
              {isGeneratingPng ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF5E36]" />
              ) : (
                <Download className="w-3.5 h-3.5 text-stone-700" />
              )}
              <span>{isGeneratingPng ? 'Proses...' : 'Download'}</span>
            </button>
            <button
              onClick={handleCopyText}
              className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs transition-colors cursor-pointer min-h-[44px]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-stone-500" />}
              <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
            </button>
          </div>

          {/* Void / Hapus Struk Action */}
          {receipt.status !== 'VOIDED' && onVoidTransaction && (
            <button
              onClick={() => setShowVoidConfirm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer min-h-[42px]"
            >
              <Ban className="w-3.5 h-3.5 text-rose-600" />
              <span>Batalkan Struk (VOID & Hapus di Spreadsheet)</span>
            </button>
          )}

          {receipt.status === 'VOIDED' && onDeleteTransaction && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs transition-colors cursor-pointer min-h-[42px]"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Hapus Struk Permanen dari Sistem & Sheet</span>
            </button>
          )}
        </div>

        {/* Modal Konfirmasi VOID & Hapus di Spreadsheet */}
        {showVoidConfirm && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 rounded-3xl animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-2xl border border-rose-200 space-y-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-bold text-sm text-stone-900">Konfirmasi VOID & Hapus</h4>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Struk <strong>#{receipt.id}</strong> akan dibatalkan, stok barang dikembalikan, dan seluruh barisnya di <strong>Google Sheets (LOG_PENJUALAN & LAIN-LAIN)</strong> akan langsung dihapus permanen.
              </p>
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                  Alasan Pembatalan:
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Contoh: Salah pesanan / Pelanggan cancel"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowVoidConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmVoid}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
                >
                  Hapus & VOID
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Struk Permanen */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 rounded-3xl animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-2xl border border-rose-200 space-y-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5" />
                <h4 className="font-bold text-sm text-stone-900">Hapus Struk Permanen</h4>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Hapus struk <strong>#{receipt.id}</strong> permanen dari database dan Google Sheets? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
