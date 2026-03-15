import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import { Compass, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Forgot password state
  const [step, setStep] = useState('login'); // 'login' | 'forgot' | 'code'
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Введите email и пароль'); return; }
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Добро пожаловать!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!resetEmail) { toast.error('Email kiriting'); return; }
    setResetLoading(true);
    try {
      await axios.post('/api/auth/forgot-password', { email: resetEmail });
      toast.success('Kod emailga yuborildi');
      setStep('code');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetCode || !newPassword) { toast.error('Barcha maydonlarni to\'ldiring'); return; }
    if (newPassword.length < 8) { toast.error('Parol kamida 8 belgidan iborat bo\'lishi kerak'); return; }
    setResetLoading(true);
    try {
      await axios.post('/api/auth/reset-password', { email: resetEmail, code: resetCode, newPassword });
      toast.success('Parol muvaffaqiyatli o\'zgartirildi!');
      setStep('login');
      setResetEmail(''); setResetCode(''); setNewPassword('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Kod noto\'g\'ri yoki muddati o\'tgan');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Compass className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-white">Orient Insight</h1>
          <p className="text-primary-200">Система управления турами</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* ── LOGIN ── */}
          {step === 'login' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Вход в систему</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder="admin@orientinsight.uz"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors pr-10"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Вход...' : 'Войти'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <button onClick={() => { setStep('forgot'); setResetEmail(email); }}
                  className="text-sm text-primary-600 hover:text-primary-700 hover:underline">
                  Parolni unutdim
                </button>
              </div>
            </>
          )}

          {/* ── FORGOT: enter login email ── */}
          {step === 'forgot' && (
            <>
              <button onClick={() => setStep('login')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
                <ArrowLeft className="w-4 h-4" /> Orqaga
              </button>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Parolni tiklash</h2>
              <p className="text-sm text-gray-500 mb-6">Tizimga kirish emailingizni kiriting — tiklash kodi shaxsiy emailingizga yuboriladi.</p>
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Login email</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 transition-colors"
                    placeholder="admin@orientinsight.uz"
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={resetLoading}
                  className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
                  {resetLoading ? 'Yuborilmoqda...' : 'Kod yuborish'}
                </button>
              </form>
            </>
          )}

          {/* ── CODE + NEW PASSWORD ── */}
          {step === 'code' && (
            <>
              <button onClick={() => setStep('forgot')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
                <ArrowLeft className="w-4 h-4" /> Orqaga
              </button>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Kodni kiriting</h2>
              <p className="text-sm text-gray-500 mb-6">
                <strong>{resetEmail}</strong> uchun shaxsiy emailga 6 xonali kod yuborildi. Kodni va yangi parolni kiriting.
              </p>
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tasdiqlash kodi</label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 transition-colors text-center text-2xl font-bold tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Yangi parol</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 transition-colors pr-10"
                      placeholder="Kamida 8 belgi"
                    />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={resetLoading}
                  className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
                  {resetLoading ? 'Saqlanmoqda...' : 'Parolni o\'zgartirish'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-primary-200 text-sm mt-6">
          © {new Date().getFullYear()} Orient Insight. Все права защищены.
        </p>
      </div>
    </div>
  );
}
