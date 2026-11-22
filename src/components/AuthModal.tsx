import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { CheckCircle2, Eye, EyeOff, Lock, Mail, User, X } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  checkUsernameAvailable,
  normalizeUsername,
} from '../services/archiveService';
import type { AuthModalMode, ThemeMode } from '../types/archive';
import { sfx } from '../utils/sfxEngine';
import { BrandWordmark } from './BrandWordmark';

interface AuthModalProps {
  mode: AuthModalMode;
  theme: ThemeMode;
  onModeChange: (mode: AuthModalMode) => void;
  onClose: () => void;
  onAuthSuccess: (info: {
    message: string;
    preferredUsername?: string;
    needsVerification?: boolean;
  }) => void;
}

function mapAuthErrorToVietnamese(code?: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Địa chỉ email không đúng định dạng.';
    case 'auth/user-disabled':
      return 'Tài khoản này hiện đã bị vô hiệu hóa.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra lại.';
    case 'auth/email-already-in-use':
      return 'Địa chỉ email này đã được sử dụng cho một tài khoản khác.';
    case 'auth/weak-password':
      return 'Mật khẩu quá yếu. Vui lòng đặt mật khẩu tối thiểu 6 ký tự.';
    case 'auth/too-many-requests':
      return 'Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.';
    case 'auth/popup-closed-by-user':
      return 'Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất.';
    case 'auth/popup-blocked':
      return 'Trình duyệt đang chặn cửa sổ bật lên (popup). Hãy cho phép popup để đăng nhập bằng Google.';
    case 'auth/operation-not-allowed':
      return 'Phương thức đăng nhập bằng Email/Mật khẩu chưa được bật trong Firebase Console. Bạn có thể đăng nhập ngay bằng Google hoặc bật Email/Password trong Firebase Authentication.';
    default:
      return 'Không thể xác thực tài khoản lúc này. Vui lòng thử lại sau.';
  }
}

export function AuthModal({
  mode,
  theme,
  onModeChange,
  onClose,
  onAuthSuccess,
}: AuthModalProps) {
  // Login state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register state
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Shared UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
  }, [mode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sfx.play('close');
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      await signInWithPopup(auth, googleAuthProvider);
      sfx.play('welcomeClick');
      onAuthSuccess({
        message: 'Đăng nhập thành công! Chào mừng bạn quay lại thư viện.',
      });
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : undefined;
      setErrorMsg(mapAuthErrorToVietnamese(code));
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setErrorMsg('Vui lòng nhập tên tài khoản hoặc email của bạn.');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Vui lòng nhập mật khẩu.');
      return;
    }

    // If user typed a username instead of email, verify existence without exposing private emails
    if (!trimmedId.includes('@')) {
      setLoading(true);
      try {
        const cleanUser = normalizeUsername(trimmedId);
        const isFree = await checkUsernameAvailable(cleanUser);
        if (isFree) {
          setErrorMsg(
            `Không tìm thấy tên tài khoản "@${cleanUser}". Vui lòng kiểm tra lại hoặc tạo tài khoản mới.`
          );
        } else {
          setErrorMsg(
            `Tài khoản "@${cleanUser}" tồn tại! Để bảo mật địa chỉ email riêng tư, vui lòng nhập địa chỉ email gắn với tài khoản này để đăng nhập (hoặc chọn Đăng nhập bằng Google).`
          );
        }
      } catch {
        setErrorMsg('Vui lòng nhập địa chỉ email của bạn để đăng nhập.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      await signInWithEmailAndPassword(auth, trimmedId, loginPassword);
      sfx.play('welcomeClick');
      onAuthSuccess({
        message: 'Đăng nhập thành công!',
      });
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : undefined;
      setErrorMsg(mapAuthErrorToVietnamese(code));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanName = displayName.trim();
    const cleanUsername = normalizeUsername(username);
    const cleanEmail = email.trim();

    if (cleanName.length < 2 || cleanName.length > 80) {
      setErrorMsg('Tên hiển thị cần từ 2 đến 80 ký tự.');
      return;
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 32) {
      setErrorMsg(
        'Tên tài khoản cần từ 3 đến 32 ký tự (chỉ gồm chữ thường không dấu, số, dấu gạch dưới hoặc gạch ngang).'
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Mật khẩu cần có ít nhất 6 ký tự để đảm bảo an toàn.');
      return;
    }
    if (regPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp. Vui lòng nhập lại.');
      return;
    }

    setLoading(true);
    try {
      const available = await checkUsernameAvailable(cleanUsername);
      if (!available) {
        setErrorMsg(
          `Tên tài khoản "@${cleanUsername}" đã có người sử dụng. Bạn hãy chọn tên khác nhé.`
        );
        setLoading(false);
        return;
      }

      const cred = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        regPassword
      );
      await updateProfile(cred.user, { displayName: cleanName });
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // Non-fatal if verification email throttled
      }

      sfx.play('welcomeClick');
      setSuccessMsg(
        'Đăng ký thành công! Chúng tôi đã gửi email xác minh tới hộp thư của bạn.'
      );
      onAuthSuccess({
        message:
          'Đăng ký tài khoản thành công! Vui lòng kiểm tra email để xác minh tài khoản thành viên.',
        preferredUsername: cleanUsername,
        needsVerification: true,
      });
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : undefined;
      setErrorMsg(mapAuthErrorToVietnamese(code));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-10 pr-10 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-heading"
      onClick={() => {
        sfx.play('close');
        onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="theme-surface theme-panel relative max-h-[92vh] w-full max-w-md overflow-y-auto border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 text-[var(--ink-primary)] shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={() => {
            sfx.play('close');
            onClose();
          }}
          aria-label="Đóng hộp thoại tài khoản"
          className="theme-control absolute top-4 right-4 flex h-9 w-9 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Brand signature header */}
        <div className="pr-8 text-center">
          <BrandWordmark theme={theme} size="sm" centered />
          <p className="font-mono-archive mt-2 text-[10px] tracking-[0.22em] text-[var(--ink-muted)] uppercase">
            YOUR LITTLE WORLD OF CHARACTERS &amp; STORIES
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div
          role="tablist"
          aria-label="Chuyển đổi đăng nhập hoặc đăng ký"
          className="theme-control mt-6 grid grid-cols-2 gap-1 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              sfx.play('filterSelect');
              onModeChange('login');
            }}
            className={`theme-control h-9 text-xs font-semibold whitespace-nowrap ${
              mode === 'login'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)] shadow-sm'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => {
              sfx.play('filterSelect');
              onModeChange('register');
            }}
            className={`theme-control h-9 text-xs font-semibold whitespace-nowrap ${
              mode === 'register'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)] shadow-sm'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            Đăng ký
          </button>
        </div>

        <h2 id="auth-modal-heading" className="sr-only">
          {mode === 'login' ? 'Đăng nhập tài khoản' : 'Đăng ký tài khoản mới'}
        </h2>

        {/* Error / Success feedback */}
        {errorMsg && (
          <div
            role="alert"
            className="theme-control mt-4 border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-red-500 dark:text-red-300"
          >
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div
            role="status"
            className="theme-control mt-4 flex items-start gap-2 border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-700 dark:text-emerald-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Quick Google Sign-In */}
        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          onMouseEnter={() => sfx.play('hover')}
          className="theme-control mt-5 flex h-11 w-full items-center justify-center gap-2.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-4 text-xs font-semibold text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
          >
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4-3.1Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.94 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1c.95-2.84 3.6-4.95 6.72-4.95Z"
            />
          </svg>
          <span>
            {mode === 'login'
              ? 'Đăng nhập nhanh bằng Google'
              : 'Đăng ký nhanh bằng Google'}
          </span>
        </button>

        <div className="my-5 flex items-center gap-3 text-[11px] text-[var(--ink-muted)]">
          <span className="h-px flex-1 bg-[var(--border-hairline)]" />
          <span>hoặc dùng tài khoản email</span>
          <span className="h-px flex-1 bg-[var(--border-hairline)]" />
        </div>

        <AnimatePresence mode="wait">
          {mode === 'login' ? (
            <motion.form
              key="login-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.22 }}
              onSubmit={handleLoginSubmit}
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                  Tên tài khoản hoặc Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Nhập email hoặc tên tài khoản..."
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn..."
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw((v) => !v)}
                    aria-label={showLoginPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute top-1/2 right-2.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                  >
                    {showLoginPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[var(--ink-secondary)]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-primary)]"
                />
                <span>Ghi nhớ đăng nhập trên thiết bị này</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="theme-control h-11 w-full bg-[var(--accent-primary)] text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {loading ? 'Đang xác thực...' : 'Đăng nhập'}
              </button>

              <p className="pt-1 text-center text-xs text-[var(--ink-muted)]">
                Chưa có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('filterSelect');
                    onModeChange('register');
                  }}
                  className="font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Đăng ký ngay
                </button>
              </p>
            </motion.form>
          ) : (
            <motion.form
              key="register-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22 }}
              onSubmit={handleRegisterSubmit}
              className="space-y-3.5"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
                  Tên hiển thị
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ví dụ: Linh Mây"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
                  Tên tài khoản (không trùng lặp)
                </label>
                <div className="relative">
                  <span className="font-mono-archive pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-xs text-[var(--ink-muted)]">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="vd: linhmay_26"
                    className={`${inputClass} font-mono-archive`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tenban@email.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type={showRegPw ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPw((v) => !v)}
                    aria-label={showRegPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute top-1/2 right-2.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                  >
                    {showRegPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((v) => !v)}
                    aria-label={
                      showConfirmPw ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'
                    }
                    className="absolute top-1/2 right-2.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                  >
                    {showConfirmPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
                Tài khoản đăng ký mới mặc định là <strong>Thành viên</strong> và
                có thể lưu nhân vật yêu thích của riêng mình.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="theme-control h-11 w-full bg-[var(--accent-primary)] text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {loading ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}
              </button>

              <p className="pt-1 text-center text-xs text-[var(--ink-muted)]">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('filterSelect');
                    onModeChange('login');
                  }}
                  className="font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Đăng nhập
                </button>
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
