import React, { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, Loader2, KeyRound } from 'lucide-react';

interface LoginViewProps {
  mode: 'login' | 'setup';
  onSuccess: () => void;
}

/**
 * Gerbang login ORTUKILL POS.
 * - mode "setup": password belum pernah dibuat (khusus dibuka dari komputer ini).
 * - mode "login": meminta password sebelum aplikasi bisa dipakai.
 */
export const LoginView: React.FC<LoginViewProps> = ({ mode, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSetup = mode === 'setup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSetup) {
      if (password.length < 6) {
        setError('Password minimal 6 karakter.');
        return;
      }
      if (password !== confirm) {
        setError('Konfirmasi password tidak sama.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(isSetup ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.message || 'Gagal masuk. Coba lagi.');
        return;
      }
      setPassword('');
      setConfirm('');
      onSuccess();
    } catch {
      setError('Tidak bisa menghubungi server. Cek koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF1F6] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-[28px] shadow-[0_10px_40px_rgba(15,23,42,0.08)] border border-white p-7">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF643D] via-[#FF5E36] to-[#FFA07A] flex items-center justify-center text-white font-black text-2xl shadow-[0_6px_18px_rgba(255,94,54,0.32)]">
              O
            </div>
            <h1 className="mt-4 text-lg font-extrabold text-stone-900 tracking-tight">ORTUKILL POS</h1>
            <p className="text-[13px] text-stone-500 mt-1 flex items-center gap-1.5">
              {isSetup ? <ShieldCheck className="w-4 h-4 text-[#FF5E36]" /> : <Lock className="w-4 h-4 text-[#FF5E36]" />}
              {isSetup ? 'Buat password untuk mengamankan aplikasi' : 'Masukkan password untuk melanjutkan'}
            </p>
          </div>

          {isSetup && (
            <div className="mb-5 rounded-2xl bg-[#FFF2ED] border border-[#FF5E36]/20 px-4 py-3 text-[12px] leading-relaxed text-stone-700">
              Password ini yang akan dipakai untuk membuka aplikasi dari mana saja.
              Simpan baik-baik — tidak ada fitur "lupa password", dan aplikasi ini
              menyimpan data penjualan serta keuanganmu.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                placeholder={isSetup ? 'Password baru' : 'Password'}
                className="w-full pl-10 pr-11 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-[#FF5E36] focus:bg-white transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {isSetup && (
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Ulangi password"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-[#FF5E36] focus:bg-white transition-colors"
                />
              </div>
            )}

            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-2.5 text-[12px] font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                loading ? 'bg-[#FF5E36]/70 cursor-wait' : 'bg-[#1E232D] hover:bg-black cursor-pointer'
              }`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSetup ? 'Buat password & masuk' : 'Masuk'}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-stone-400 leading-relaxed">
            {isSetup
              ? 'Pembuatan password hanya bisa dilakukan dari komputer ini.'
              : 'Sesi aktif selama 12 jam sejak login terakhir.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
