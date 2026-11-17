import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, X, ArrowLeft, Building2, User, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { Language, UserAccount } from '../types';
import { useTranslation } from '../data/translations';
import { APP_LOGO_SRC } from './AppLogo';
import {
  apiLogin,
  apiRegister,
  apiForgotPassword,
  apiResetPassword,
  apiGetOAuthProviders,
  apiGetOAuthUrl,
  setStoredToken,
  type OAuthProvider,
  type OAuthProvidersStatus,
} from '../services/api';

interface MobileAuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'register';
  lang: Language;
  onClose: () => void;
  onSuccess: (user: UserAccount, message: string) => void;
}

const PROVIDER_META: Record<
  OAuthProvider,
  { label: string; envVars: string }
> = {
  google: {
    label: 'Google',
    envVars: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET',
  },
  facebook: {
    label: 'Facebook',
    envVars: 'FACEBOOK_APP_ID, FACEBOOK_APP_SECRET',
  },
  apple: {
    label: 'Apple / iCloud',
    envVars: 'APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY',
  },
};

export const MobileAuthModal: React.FC<MobileAuthModalProps> = ({
  isOpen,
  initialMode,
  lang,
  onClose,
  onSuccess,
}) => {
  const t = useTranslation(lang);
  const [view, setView] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const loginEmailInputRef = useRef<HTMLInputElement>(null);
  const registerEmailInputRef = useRef<HTMLInputElement>(null);

  // Role selection (used for both Email registration and OAuth new accounts)
  const [accountType, setAccountType] = useState<'candidate' | 'employer'>('candidate');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'reset' | 'done'>('request');
  const [resetCode, setResetCode] = useState('');
  const [serverDevCode, setServerDevCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  // OAuth status & feedback
  const [oauthStatus, setOauthStatus] = useState<OAuthProvidersStatus | null>(null);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<OAuthProvider | null>(null);
  const [oauthSetupHint, setOauthSetupHint] = useState<{
    provider: OAuthProvider;
    callbackUrl: string;
    envVars: string;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setView(initialMode);
    setErrorMsg(null);
    setForgotStep('request');
    setForgotMessage(null);
    setServerDevCode(null);
    setOauthSetupHint(null);
    setOauthLoadingProvider(null);

    if (isOpen) {
      apiGetOAuthProviders()
        .then(setOauthStatus)
        .catch(() => {});
    }
  }, [initialMode, isOpen]);

  // Listen for cross-origin OAuth popup completion
  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      const isTrustedOrigin =
        origin === window.location.origin ||
        origin.endsWith('.run.app') ||
        origin.includes('localhost');
      if (!isTrustedOrigin) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.user && event.data?.token) {
        setStoredToken(String(event.data.token), true);
        setOauthLoadingProvider(null);
        setErrorMsg(null);
        onSuccess(
          event.data.user as UserAccount,
          String(event.data.message || 'Đăng nhập thành công!')
        );
        onClose();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setOauthLoadingProvider(null);
        setErrorMsg(String(event.data.error || 'Đăng nhập bên thứ ba không thành công.'));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, onSuccess, onClose]);

  if (!isOpen) return null;

  const isEmailValid = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setErrorMsg(null);
    setOauthSetupHint(null);
    setOauthLoadingProvider(provider);

    try {
      const { url } = await apiGetOAuthUrl(provider, accountType);
      const authWindow = window.open(
        url,
        `jobshub_oauth_${provider}`,
        'width=540,height=680,noopener=false'
      );
      if (!authWindow) {
        setOauthLoadingProvider(null);
        setErrorMsg(
          'Trình duyệt đang chặn cửa sổ bật lên (popup). Vui lòng cho phép popup cho trang web này rồi thử lại.'
        );
      } else {
        // Reset spinner if user closes popup manually
        const pollTimer = window.setInterval(() => {
          if (authWindow.closed) {
            window.clearInterval(pollTimer);
            setOauthLoadingProvider((cur) => (cur === provider ? null : cur));
          }
        }, 500);
      }
    } catch (err) {
      setOauthLoadingProvider(null);
      const fallbackCallback =
        oauthStatus?.callbackUrls?.[provider] ||
        `${window.location.origin}/api/auth/oauth/${provider}/callback`;
      if (oauthStatus && !oauthStatus.providers[provider]) {
        setOauthSetupHint({
          provider,
          callbackUrl: fallbackCallback,
          envVars: PROVIDER_META[provider].envVars,
        });
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : `Không thể khởi tạo đăng nhập ${PROVIDER_META[provider].label}.`
        );
      }
    }
  };

  const handleFocusEmailForm = () => {
    setOauthSetupHint(null);
    setErrorMsg(null);
    if (view === 'register') {
      registerEmailInputRef.current?.focus();
    } else {
      setView('login');
      setTimeout(() => loginEmailInputRef.current?.focus(), 50);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isEmailValid(loginEmail)) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (loginPassword.length < 6) {
      setErrorMsg('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { user } = await apiLogin({
        email: loginEmail.trim(),
        password: loginPassword,
        rememberMe,
      });
      onSuccess(
        user,
        user.role === 'employer'
          ? 'Đăng nhập thành công với vai trò Nhà tuyển dụng!'
          : t.loginSuccess || 'Đăng nhập thành công!'
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên.');
      return;
    }
    if (!isEmailValid(email)) {
      setErrorMsg('Địa chỉ email không hợp lệ.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Vui lòng nhập số điện thoại liên hệ.');
      return;
    }
    if (accountType === 'employer' && !companyName.trim()) {
      setErrorMsg('Vui lòng nhập Tên công ty / Doanh nghiệp của bạn.');
      return;
    }
    if (registerPassword.length < 6) {
      setErrorMsg('Mật khẩu phải từ 6 ký tự trở lên.');
      return;
    }
    if (registerPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu và xác nhận mật khẩu không trùng khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { user } = await apiRegister({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: registerPassword,
        confirmPassword,
        role: accountType,
        companyName: accountType === 'employer' ? companyName.trim() : undefined,
      });
      onSuccess(
        user,
        user.role === 'employer'
          ? 'Đăng ký tài khoản Nhà tuyển dụng thành công!'
          : t.registerSuccess || 'Đăng ký tài khoản thành công!'
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Đăng ký thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!isEmailValid(forgotEmail)) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiForgotPassword(forgotEmail.trim());
      setForgotMessage(res.message);
      setServerDevCode(res.resetCode || null);
      setForgotStep('reset');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể gửi yêu cầu đặt lại mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!resetCode.trim()) {
      setErrorMsg('Vui lòng nhập mã xác nhận.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Xác nhận mật khẩu mới không trùng khớp.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiResetPassword({
        email: forgotEmail.trim(),
        code: resetCode.trim(),
        newPassword,
      });
      setForgotMessage(res.message);
      setForgotStep('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSocialLoginGrid = () => (
    <div className="pt-3 mt-3 border-t border-[#E8E2D5] space-y-2.5">
      <div className="flex items-center justify-between text-[11px] text-stone-600 font-semibold">
        <span>Hoặc đăng nhập / đăng ký nhanh bằng:</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Google */}
        <button
          type="button"
          onClick={() => handleOAuthLogin('google')}
          disabled={oauthLoadingProvider !== null}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#E8E2D5] bg-white hover:bg-[#FAF7F2] active:scale-[0.98] text-xs font-bold text-stone-800 transition-all shadow-2xs disabled:opacity-60"
        >
          {oauthLoadingProvider === 'google' ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#2F5233]" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
          )}
          <span>Google</span>
        </button>

        {/* Facebook */}
        <button
          type="button"
          onClick={() => handleOAuthLogin('facebook')}
          disabled={oauthLoadingProvider !== null}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#1877F2]/25 bg-[#1877F2]/5 hover:bg-[#1877F2]/10 active:scale-[0.98] text-xs font-bold text-[#1877F2] transition-all shadow-2xs disabled:opacity-60"
        >
          {oauthLoadingProvider === 'facebook' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.022 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796v8.437C19.612 23.095 24 18.1 24 12.073Z" />
            </svg>
          )}
          <span>Facebook</span>
        </button>

        {/* Apple / iCloud */}
        <button
          type="button"
          onClick={() => handleOAuthLogin('apple')}
          disabled={oauthLoadingProvider !== null}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-stone-900 bg-stone-900 hover:bg-black active:scale-[0.98] text-xs font-bold text-white transition-all shadow-2xs disabled:opacity-60"
        >
          {oauthLoadingProvider === 'apple' ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
            </svg>
          )}
          <span>Apple / iCloud</span>
        </button>

        {/* Email */}
        <button
          type="button"
          onClick={handleFocusEmailForm}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#2F5233]/30 bg-[#EBF2EB] hover:bg-[#DCE8DC] active:scale-[0.98] text-xs font-bold text-[#2F5233] transition-all shadow-2xs"
        >
          <Mail className="w-4 h-4 shrink-0" />
          <span>Email</span>
        </button>
      </div>

      {oauthSetupHint && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1.5 animate-fadeIn">
          <p className="font-bold">
            Chưa cấu hình OAuth {PROVIDER_META[oauthSetupHint.provider].label} trên máy chủ
          </p>
          <p>
            Để bật đăng nhập thật bằng {PROVIDER_META[oauthSetupHint.provider].label}, hãy thêm biến môi trường{' '}
            <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-200">
              {oauthSetupHint.envVars}
            </code>{' '}
            trong <strong>Settings &gt; Secrets</strong> và khai báo Callback URL:
          </p>
          <p className="font-mono text-[10px] break-all bg-white p-1.5 rounded border border-amber-200 select-all">
            {oauthSetupHint.callbackUrl}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E8E2D5] p-5 sm:p-6 my-auto animate-fadeIn overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with App Logo */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#E8E2D5]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white border border-[#E8E2D5] p-1 flex items-center justify-center shadow-2xs shrink-0">
              <img
                src={APP_LOGO_SRC}
                alt="Jobs Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-stone-900 font-display leading-tight">
                {view === 'login' && t.login}
                {view === 'register' && t.register}
                {view === 'forgot' && t.forgotPassword}
              </h2>
              <p className="text-[11px] text-stone-500 font-medium">
                JobsHub — Email, Google, Facebook & Apple / iCloud
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-[#FAF7F2] transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch between Login and Register */}
        {view !== 'forgot' && (
          <div className="grid grid-cols-2 p-1 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl my-3.5">
            <button
              type="button"
              onClick={() => {
                setView('login');
                setErrorMsg(null);
                setOauthSetupHint(null);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                view === 'login' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
              }`}
            >
              {t.login}
            </button>
            <button
              type="button"
              onClick={() => {
                setView('register');
                setErrorMsg(null);
                setOauthSetupHint(null);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                view === 'register' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
              }`}
            >
              {t.register}
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl mb-3 font-medium">
            {errorMsg}
          </div>
        )}

        {/* 1. LOGIN */}
        {view === 'login' && (
          <div>
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Email đăng nhập
                </label>
                <input
                  ref={loginEmailInputRef}
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-stone-700">
                    {t.password}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setView('forgot');
                      setErrorMsg(null);
                      setOauthSetupHint(null);
                      setForgotStep('request');
                    }}
                    className="text-[11px] font-semibold text-[#2F5233] hover:underline"
                  >
                    {t.forgotPassword}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    className="w-full pl-3 pr-9 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-800 p-1"
                    aria-label={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showLoginPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#2F5233]"
                />
                <span className="text-xs text-stone-700 font-medium">
                  Ghi nhớ phiên đăng nhập
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-[#2F5233] hover:bg-[#244127] active:scale-95 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Đăng nhập bằng Email</span>
              </button>
            </form>

            {renderSocialLoginGrid()}
          </div>
        )}

        {/* 2. REGISTER */}
        {view === 'register' && (
          <div>
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Loại tài khoản:
                </label>
                <div className="grid grid-cols-2 p-1 bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAccountType('candidate')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      accountType === 'candidate'
                        ? 'bg-white text-[#2F5233] shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Người tìm việc</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('employer')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      accountType === 'employer'
                        ? 'bg-white text-[#2F5233] shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Nhà tuyển dụng</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  {t.fullName} *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Văn Minh"
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-900"
                />
              </div>

              {accountType === 'employer' && (
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Tên công ty / Doanh nghiệp *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="VD: Công ty TNHH NextGen Hub"
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    {t.email} *
                  </label>
                  <input
                    ref={registerEmailInputRef}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    {t.phone} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912 345 678"
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  {t.password} (Tối thiểu 6 ký tự) *
                </label>
                <div className="relative">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3 pr-9 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-800 p-1"
                  >
                    {showRegisterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  {t.confirmPassword} *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3 pr-9 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-800 p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-[#2F5233] hover:bg-[#244127] active:scale-95 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {accountType === 'employer' ? 'Đăng ký Nhà tuyển dụng' : 'Đăng ký bằng Email'}
                </span>
              </button>
            </form>

            {renderSocialLoginGrid()}
          </div>
        )}

        {/* 3. FORGOT PASSWORD */}
        {view === 'forgot' && (
          <div className="space-y-3 mt-3">
            <button
              type="button"
              onClick={() => {
                setView('login');
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Đăng nhập</span>
            </button>

            {forgotStep === 'request' && (
              <form onSubmit={handleForgotRequest} className="space-y-3">
                <p className="text-xs text-stone-600 leading-relaxed">
                  Nhập địa chỉ email tài khoản đã đăng ký để nhận mã xác nhận đặt lại mật khẩu.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] text-stone-900"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-[#2F5233] hover:bg-[#244127] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Gửi yêu cầu đặt lại mật khẩu</span>
                </button>
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={handleResetSubmit} className="space-y-3">
                {forgotMessage && (
                  <div className="p-3 bg-[#EBF2EB] border border-[#2F5233]/30 rounded-xl text-xs text-[#2F5233] space-y-1">
                    <p className="font-semibold">{forgotMessage}</p>
                    {serverDevCode && (
                      <p className="font-mono text-xs">
                        Mã xác nhận của bạn: <strong>{serverDevCode}</strong>
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Mã xác nhận 6 số
                  </label>
                  <input
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Nhập mã 6 số..."
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Mật khẩu mới (tối thiểu 6 ký tự)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#E8E2D5] rounded-xl focus:bg-white focus:outline-none focus:border-[#2F5233]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-[#2F5233] hover:bg-[#244127] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Cập nhật mật khẩu mới</span>
                </button>
              </form>
            )}

            {forgotStep === 'done' && (
              <div className="p-4 bg-[#EBF2EB] border border-[#2F5233]/30 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-[#2F5233] mx-auto" />
                <p className="text-xs font-bold text-[#2F5233]">
                  {forgotMessage || 'Đặt lại mật khẩu thành công!'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setLoginEmail(forgotEmail);
                    setErrorMsg(null);
                  }}
                  className="mt-2 px-4 py-2 bg-[#2F5233] text-white text-xs font-bold rounded-xl"
                >
                  Đăng nhập ngay
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
