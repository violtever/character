import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import {
  ArrowUp,
  ChevronDown,
  Heart,
  LogIn,
  LogOut,
  MailCheck,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Sun,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ARCHIVE_META, PERSONAL_QUOTES } from './config/mediaConfig';
import {
  ALL_CATEGORY_LABEL,
  DEFAULT_CATEGORY_SEEDS,
  INITIAL_CHARACTERS,
} from './data/characters';
import { INITIAL_GALLERY_ITEMS } from './data/gallery';
import { auth } from './lib/firebase';
import {
  addGalleryItemAdmin,
  deleteCharacterAdmin,
  deleteGalleryItemAdmin,
  seedInitialDatabase,
  subscribeCategories,
  subscribeCharacters,
  subscribeGallery,
  subscribeUserFavorites,
  syncUserProfileDoc,
  toggleUserFavorite,
} from './services/archiveService';
import type {
  ArchiveStage,
  AuthModalMode,
  CategoryRecord,
  CharacterRecord,
  GalleryItem,
  PendingGuestAction,
  SortOption,
  ThemeMode,
  UserProfile,
} from './types/archive';
import { musicPlayer, type MusicSnapshot } from './utils/musicEngine';
import { sfx } from './utils/sfxEngine';
import { AdminDashboard, type AdminTab } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { BrandWordmark } from './components/BrandWordmark';
import { CharacterCard } from './components/CharacterCard';
import { CharacterDetailModal } from './components/CharacterDetailModal';
import { DecorGallery } from './components/DecorGallery';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginPromptModal } from './components/LoginPromptModal';
import { MusicPlayer } from './components/MusicPlayer';
import {
  FloatingDreamyStickers,
  ThemeDivider,
} from './components/ThemeDecorations';
import { WelcomeScreen } from './components/WelcomeScreen';

const THEME_STORAGE_KEY = 'xocyberluv_archive_theme';

function loadInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore storage errors
  }
  return 'light';
}

export default function App() {
  const [stage, setStage] = useState<ArchiveStage>('welcome');
  const [theme, setTheme] = useState<ThemeMode>(loadInitialTheme);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => sfx.isEnabled());
  const [musicSnapshot, setMusicSnapshot] = useState<MusicSnapshot>(() =>
    musicPlayer.getSnapshot()
  );

  // Real Firebase Auth + Firestore Profile State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const pendingUsernameRef = useRef<string | undefined>(undefined);
  const [resendingVerify, setResendingVerify] = useState(false);
  const [checkingVerify, setCheckingVerify] = useState(false);

  // Live Firestore Archive Collections (Public Read)
  const [characters, setCharacters] =
    useState<CharacterRecord[]>(INITIAL_CHARACTERS);
  const [categories, setCategories] = useState<CategoryRecord[]>(() =>
    DEFAULT_CATEGORY_SEEDS.map((c) => ({ ...c, id: c.slug }))
  );
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(
    INITIAL_GALLERY_ITEMS
  );
  const [isCharsDbEmpty, setIsCharsDbEmpty] = useState(true);
  const [isCatsDbEmpty, setIsCatsDbEmpty] = useState(true);
  const [isGalleryDbEmpty, setIsGalleryDbEmpty] = useState(true);

  const isDbEmpty = isCharsDbEmpty || isCatsDbEmpty || isGalleryDbEmpty;
  const isAdmin = Boolean(
    currentUser && currentUser.role === 'admin' && currentUser.emailVerified
  );

  // Filtering & sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY_LABEL);
  const [sortBy, setSortBy] = useState<SortOption>('pinned');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Modals, Account Menu & Admin Center
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null
  );
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: AuthModalMode;
  }>({ open: false, mode: 'login' });
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [pendingGuestAction, setPendingGuestAction] =
    useState<PendingGuestAction | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const [adminView, setAdminView] = useState<{
    open: boolean;
    tab: AdminTab;
    editingChar: CharacterRecord | null;
  }>({ open: false, tab: 'overview', editingChar: null });

  const [quoteIndex, setQuoteIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  // Sync theme to documentElement & localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  // Subscribe to persistent music engine
  useEffect(() => {
    return musicPlayer.subscribe(setMusicSnapshot);
  }, []);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setCurrentUser(null);
        setFavoriteIds([]);
        setFavoritesOnly(false);
        setAdminView({ open: false, tab: 'overview', editingChar: null });
        return;
      }

      try {
        const preferred = pendingUsernameRef.current;
        pendingUsernameRef.current = undefined;
        const profile = await syncUserProfileDoc({
          uid: fbUser.uid,
          email: fbUser.email ?? '',
          displayName: fbUser.displayName ?? '',
          preferredUsername: preferred,
          photoURL: fbUser.photoURL ?? '',
          emailVerified: fbUser.emailVerified,
        });
        setCurrentUser(profile);
      } catch {
        setCurrentUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName || 'Thành viên',
          username: (fbUser.email || 'member').split('@')[0],
          email: fbUser.email || '',
          role: 'user',
          photoURL: fbUser.photoURL || '',
          emailVerified: fbUser.emailVerified,
        });
      }
    });
    return unsubscribe;
  }, []);

  // Subscribe to public Firestore collections (accessible to Guests, Users & Admins)
  useEffect(() => {
    const unsubChars = subscribeCharacters((records, empty) => {
      setCharacters(records);
      setIsCharsDbEmpty(empty);
    });
    const unsubCats = subscribeCategories((cats, empty) => {
      setCategories(cats);
      setIsCatsDbEmpty(empty);
    });
    const unsubGallery = subscribeGallery((items, empty) => {
      setGalleryItems(items);
      setIsGalleryDbEmpty(empty);
    });
    return () => {
      unsubChars();
      unsubCats();
      unsubGallery();
    };
  }, []);

  // Subscribe to member personal favorites when verified
  useEffect(() => {
    if (!currentUser || !currentUser.emailVerified) {
      setFavoriteIds([]);
      return;
    }
    return subscribeUserFavorites(currentUser.uid, setFavoriteIds);
  }, [currentUser]);

  // Close account dropdown on outside click or Escape
  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [accountMenuOpen]);

  // Track scroll for Back-to-Top button
  useEffect(() => {
    if (stage !== 'main' || adminView.open) return;
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 480);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [stage, adminView.open]);

  const executeFavoriteToggle = useCallback(
    async (user: UserProfile, characterId: string) => {
      if (!user.emailVerified) {
        showToast(
          'Vui lòng xác minh địa chỉ email của bạn trước khi lưu nhân vật yêu thích.'
        );
        return;
      }

      const alreadyFav = favoriteIds.includes(characterId);
      const targetChar = characters.find((c) => c.id === characterId);

      try {
        if (isCharsDbEmpty) {
          if (user.role === 'admin') {
            await seedInitialDatabase(user.uid);
          } else {
            showToast(
              'Thư viện đang hiển thị dữ liệu mẫu chờ Quản trị viên đồng bộ lên cơ sở dữ liệu.'
            );
            return;
          }
        }
        await toggleUserFavorite(user.uid, characterId, alreadyFav);
        showToast(
          alreadyFav
            ? `Đã bỏ lưu "${targetChar?.name || characterId}" khỏi mục yêu thích.`
            : `Đã lưu "${targetChar?.name || characterId}" vào mục yêu thích!`
        );
      } catch {
        showToast('Không thể cập nhật mục yêu thích lúc này. Vui lòng thử lại.');
      }
    },
    [characters, favoriteIds, isCharsDbEmpty, showToast]
  );

  // Resume pending Guest action automatically right after login without losing UI state
  useEffect(() => {
    if (
      !pendingGuestAction ||
      !currentUser ||
      !currentUser.emailVerified
    ) {
      return;
    }
    const action = pendingGuestAction;
    setPendingGuestAction(null);
    if (action.type === 'favorite') {
      void executeFavoriteToggle(currentUser, action.characterId);
    }
  }, [pendingGuestAction, currentUser, executeFavoriteToggle]);

  const handleToggleFavorite = useCallback(
    (characterId: string) => {
      if (!currentUser) {
        setPendingGuestAction({ type: 'favorite', characterId });
        setLoginPromptOpen(true);
        return;
      }
      void executeFavoriteToggle(currentUser, characterId);
    },
    [currentUser, executeFavoriteToggle]
  );

  const handleToggleTheme = useCallback(() => {
    sfx.unlock();
    sfx.play('themeSwitch');
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const handleToggleSfx = useCallback(() => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    sfx.setEnabled(next);
    if (next) {
      sfx.unlock();
      sfx.play('filterSelect');
    }
  }, [sfxEnabled]);

  const handleEnterArchive = useCallback(() => {
    void musicPlayer.play();
    setStage('loading');
  }, []);

  const handleLoadingComplete = useCallback(() => {
    setStage('main');
    window.scrollTo({ top: 0 });
  }, []);

  const handleSignOut = useCallback(async () => {
    setAccountMenuOpen(false);
    try {
      await signOut(auth);
      sfx.play('close');
      showToast('Đã đăng xuất tài khoản. Bạn vẫn có thể tiếp tục xem thư viện công khai.');
    } catch {
      showToast('Không thể đăng xuất lúc này.');
    }
  }, [showToast]);

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setResendingVerify(true);
    try {
      await sendEmailVerification(auth.currentUser);
      showToast('Đã gửi lại email xác minh. Hãy kiểm tra hộp thư đến hoặc mục Spam nhé.');
    } catch {
      showToast('Bạn vừa yêu cầu gửi email xác minh. Vui lòng đợi một chút rồi thử lại.');
    } finally {
      setResendingVerify(false);
    }
  };

  const handleRefreshVerificationStatus = async () => {
    if (!auth.currentUser) return;
    setCheckingVerify(true);
    try {
      await reload(auth.currentUser);
      const fbUser = auth.currentUser;
      if (fbUser.emailVerified) {
        const synced = await syncUserProfileDoc({
          uid: fbUser.uid,
          email: fbUser.email ?? '',
          displayName: fbUser.displayName ?? '',
          photoURL: fbUser.photoURL ?? '',
          emailVerified: true,
        });
        setCurrentUser(synced);
        sfx.play('welcomeClick');
        showToast('Xác minh email thành công! Bạn đã mở khóa đầy đủ quyền thành viên.');
      } else {
        showToast('Email vẫn chưa được xác minh. Hãy nhấn vào liên kết trong hộp thư của bạn.');
      }
    } catch {
      showToast('Không thể kiểm tra trạng thái xác minh lúc này.');
    } finally {
      setCheckingVerify(false);
    }
  };

  // Dynamic category tabs combining Firestore categories + any character genres
  const availableCategories = useMemo(() => {
    const names = [ALL_CATEGORY_LABEL];
    const seen = new Set<string>([ALL_CATEGORY_LABEL.toLowerCase()]);
    categories.forEach((cat) => {
      if (cat.name && !seen.has(cat.name.toLowerCase())) {
        seen.add(cat.name.toLowerCase());
        names.push(cat.name);
      }
    });
    characters.forEach((c) => {
      if (c.genre && !seen.has(c.genre.toLowerCase())) {
        seen.add(c.genre.toLowerCase());
        names.push(c.genre);
      }
    });
    return names;
  }, [categories, characters]);

  // Filtered and sorted character records
  const filteredCharacters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matched = characters.filter((char) => {
      if (favoritesOnly && !favoriteIds.includes(char.id)) return false;

      if (activeCategory !== ALL_CATEGORY_LABEL) {
        const lowerCat = activeCategory.toLowerCase();
        const genreMatch = char.genre.toLowerCase() === lowerCat;
        const tagMatch = char.tags.some((t) => t.toLowerCase() === lowerCat);
        if (!genreMatch && !tagMatch) return false;
      }

      if (q) {
        const haystack = [
          char.id,
          char.name,
          char.subtitle,
          char.genre,
          char.description,
          char.plot,
          ...char.tags,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    return [...matched].sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.name.localeCompare(b.name, 'vi');
      }
      if (sortBy === 'newest') {
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      }
      const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (pinDiff !== 0) return pinDiff;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
  }, [
    characters,
    searchQuery,
    activeCategory,
    favoritesOnly,
    favoriteIds,
    sortBy,
  ]);

  const pinnedCount = useMemo(
    () => characters.filter((c) => c.pinned).length,
    [characters]
  );

  const uniqueGenresCount = useMemo(
    () => new Set(characters.map((c) => c.genre).filter(Boolean)).size,
    [characters]
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    activeCategory !== ALL_CATEGORY_LABEL ||
    favoritesOnly;

  const resetFilters = () => {
    sfx.play('filterSelect');
    setSearchQuery('');
    setActiveCategory(ALL_CATEGORY_LABEL);
    setFavoritesOnly(false);
  };

  // Selected character & prev/next modal navigation
  const selectedCharacterIndex = useMemo(() => {
    if (!selectedCharacterId) return -1;
    return filteredCharacters.findIndex((c) => c.id === selectedCharacterId);
  }, [filteredCharacters, selectedCharacterId]);

  const selectedCharacter =
    selectedCharacterIndex >= 0
      ? filteredCharacters[selectedCharacterIndex]
      : characters.find((c) => c.id === selectedCharacterId) ?? null;

  const handlePrevCharacter = useCallback(() => {
    if (filteredCharacters.length <= 1 || selectedCharacterIndex < 0) return;
    const prevIdx =
      (selectedCharacterIndex - 1 + filteredCharacters.length) %
      filteredCharacters.length;
    setSelectedCharacterId(filteredCharacters[prevIdx].id);
  }, [filteredCharacters, selectedCharacterIndex]);

  const handleNextCharacter = useCallback(() => {
    if (filteredCharacters.length <= 1 || selectedCharacterIndex < 0) return;
    const nextIdx = (selectedCharacterIndex + 1) % filteredCharacters.length;
    setSelectedCharacterId(filteredCharacters[nextIdx].id);
  }, [filteredCharacters, selectedCharacterIndex]);

  // Admin character actions from detail modal
  const handleAdminDeleteFromModal = useCallback(
    async (id: string) => {
      if (!isAdmin || !currentUser) return;
      const target = characters.find((c) => c.id === id);
      try {
        if (isCharsDbEmpty) {
          await seedInitialDatabase(currentUser.uid);
        }
        await deleteCharacterAdmin(id);
        setSelectedCharacterId(null);
        showToast(`Đã xóa nhân vật "${target?.name || id}" khỏi thư viện.`);
      } catch {
        showToast('Không thể xóa nhân vật. Vui lòng kiểm tra quyền quản trị.');
      }
    },
    [characters, currentUser, isAdmin, isCharsDbEmpty, showToast]
  );

  const handleCopyLink = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        sfx.play('copy');
        showToast('Đã sao chép liên kết nhân vật vào khay nhớ tạm!');
      } catch {
        showToast('Không thể truy cập khay nhớ tạm của trình duyệt.');
      }
    },
    [showToast]
  );

  // Admin gallery mutations
  const handleAddGalleryItem = useCallback(
    async (item: GalleryItem) => {
      if (!isAdmin || !currentUser) return;
      if (isGalleryDbEmpty) {
        await seedInitialDatabase(currentUser.uid);
      }
      await addGalleryItemAdmin(item);
      showToast('Đã thêm ảnh mới vào góc ảnh trang trí!');
    },
    [currentUser, isAdmin, isGalleryDbEmpty, showToast]
  );

  const handleRemoveGalleryItem = useCallback(
    async (id: string) => {
      if (!isAdmin || !currentUser) return;
      if (isGalleryDbEmpty) {
        await seedInitialDatabase(currentUser.uid);
      }
      await deleteGalleryItemAdmin(id);
      showToast('Đã xóa ảnh khỏi góc ảnh trang trí.');
    },
    [currentUser, isAdmin, isGalleryDbEmpty, showToast]
  );

  const openAdminCenter = useCallback(
    (tab: AdminTab = 'overview', editingChar: CharacterRecord | null = null) => {
      if (!isAdmin) return;
      setAccountMenuOpen(false);
      setSelectedCharacterId(null);
      setStage('main');
      setAdminView({ open: true, tab, editingChar });
      window.scrollTo({ top: 0 });
    },
    [isAdmin]
  );

  const activeQuote = PERSONAL_QUOTES[quoteIndex % PERSONAL_QUOTES.length];
  const userInitial = (currentUser?.displayName || 'U').charAt(0).toUpperCase();

  return (
    <div className="theme-surface relative min-h-screen bg-[var(--bg-canvas)] text-[var(--ink-primary)]">
      {/* Subtle analog grain overlay across entire site */}
      <div
        aria-hidden="true"
        className="archive-grain pointer-events-none fixed inset-0 z-50"
      />

      <AnimatePresence mode="wait">
        {stage === 'welcome' && (
          <WelcomeScreen
            key="stage-welcome"
            theme={theme}
            onToggleTheme={handleToggleTheme}
            sfxEnabled={sfxEnabled}
            onToggleSfx={handleToggleSfx}
            recordCount={characters.length}
            currentUser={currentUser}
            onEnter={handleEnterArchive}
            onOpenLogin={() => setAuthModal({ open: true, mode: 'login' })}
            onOpenRegister={() =>
              setAuthModal({ open: true, mode: 'register' })
            }
            onEnterAdmin={() => openAdminCenter('overview', null)}
          />
        )}

        {stage === 'loading' && (
          <LoadingScreen
            key="stage-loading"
            theme={theme}
            recordCount={characters.length}
            onComplete={handleLoadingComplete}
          />
        )}

        {stage === 'main' && adminView.open && isAdmin && currentUser && (
          <motion.div
            key="stage-admin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <AdminDashboard
              theme={theme}
              adminUser={currentUser}
              characters={characters}
              categories={categories}
              isDbEmpty={isDbEmpty}
              initialTab={adminView.tab}
              editingCharacter={adminView.editingChar}
              onBackToArchive={() =>
                setAdminView({ open: false, tab: 'overview', editingChar: null })
              }
              onInspectCharacter={(char) => {
                setSelectedCharacterId(char.id);
              }}
              onNotify={showToast}
            />
          </motion.div>
        )}

        {stage === 'main' && (!adminView.open || !isAdmin) && (
          <motion.div
            key="stage-main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="archive-backdrop-light relative flex min-h-screen flex-col pb-24"
          >
            {/* Subtle theme ornaments behind hero */}
            <FloatingDreamyStickers theme={theme} />

            {/* ===============================================================
                TOP HEADER BAR (Brand + Nav + Role-Aware Account Zone)
               =============================================================== */}
            <header className="theme-surface relative z-30 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/90 backdrop-blur-md md:sticky md:top-0">
              <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
                {/* Zone 1: Brand Wordmark */}
                <a
                  href="#top"
                  onClick={(e) => {
                    e.preventDefault();
                    sfx.play('filterSelect');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="shrink-0 whitespace-nowrap transition-opacity hover:opacity-85"
                >
                  <BrandWordmark theme={theme} size="sm" />
                </a>

                {/* Zone 2: Clean single-line Vietnamese Navigation */}
                <nav
                  aria-label="Điều hướng chính"
                  className="hidden items-center gap-7 text-sm font-medium text-[var(--ink-secondary)] md:flex"
                >
                  <a
                    href="#collection"
                    onMouseEnter={() => sfx.play('hover')}
                    className="shrink-0 whitespace-nowrap transition-colors hover:text-[var(--ink-primary)] hover:underline hover:underline-offset-8"
                  >
                    Thư viện
                  </a>
                  <a
                    href="#gallery"
                    onMouseEnter={() => sfx.play('hover')}
                    className="shrink-0 whitespace-nowrap transition-colors hover:text-[var(--ink-primary)] hover:underline hover:underline-offset-8"
                  >
                    Góc ảnh
                  </a>
                  <a
                    href="#notes"
                    onMouseEnter={() => sfx.play('hover')}
                    className="shrink-0 whitespace-nowrap transition-colors hover:text-[var(--ink-primary)] hover:underline hover:underline-offset-8"
                  >
                    Ghi chú
                  </a>
                </nav>

                {/* Zone 3: Role-Aware Account Controls */}
                <div className="flex shrink-0 items-center gap-2">
                  {!currentUser ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.play('filterSelect');
                          setAuthModal({ open: true, mode: 'login' });
                        }}
                        onMouseEnter={() => sfx.play('hover')}
                        className="theme-control inline-flex h-9 shrink-0 items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 text-xs font-semibold whitespace-nowrap text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        <span>Đăng nhập</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.play('filterSelect');
                          setAuthModal({ open: true, mode: 'register' });
                        }}
                        onMouseEnter={() => sfx.play('hover')}
                        className="theme-control inline-flex h-9 shrink-0 items-center gap-1.5 bg-[var(--accent-primary)] px-3.5 text-xs font-semibold whitespace-nowrap text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Đăng ký</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            sfx.play('openCharacter');
                            openAdminCenter('overview', null);
                          }}
                          onMouseEnter={() => sfx.play('hover')}
                          className="theme-control hidden h-9 shrink-0 items-center gap-1.5 bg-[var(--accent-primary)] px-3.5 text-xs font-semibold whitespace-nowrap text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] sm:inline-flex"
                        >
                          <Shield className="h-3.5 w-3.5" />
                          <span>Trung tâm quản trị</span>
                        </button>
                      )}

                      <div ref={accountMenuRef} className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            sfx.play('filterSelect');
                            setAccountMenuOpen((o) => !o);
                          }}
                          aria-expanded={accountMenuOpen}
                          aria-haspopup="menu"
                          className="theme-control inline-flex h-9 items-center gap-2 border border-[var(--border-hairline)] bg-[var(--bg-surface)] pr-2.5 pl-1.5 text-xs text-[var(--ink-primary)] hover:border-[var(--accent-primary)]"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent-primary)]">
                            {currentUser.photoURL ? (
                              <img
                                src={currentUser.photoURL}
                                alt={currentUser.displayName}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              userInitial
                            )}
                          </span>
                          <span className="max-w-[110px] truncate font-medium">
                            {currentUser.displayName}
                          </span>
                          <span className="hidden text-[11px] text-[var(--ink-muted)] lg:inline">
                            · {isAdmin ? 'Quản trị viên' : 'Thành viên'}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                        </button>

                        <AnimatePresence>
                          {accountMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 8, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 6, scale: 0.98 }}
                              transition={{ duration: 0.18 }}
                              role="menu"
                              className="theme-card absolute right-0 mt-2 w-60 overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1.5 shadow-xl"
                            >
                              <div className="border-b border-[var(--border-hairline)] px-3 py-2.5">
                                <p className="truncate text-xs font-semibold text-[var(--ink-primary)]">
                                  {currentUser.displayName}
                                </p>
                                <p className="font-mono-archive truncate text-[11px] text-[var(--ink-muted)]">
                                  @{currentUser.username} ·{' '}
                                  {isAdmin ? 'Quản trị viên' : 'Thành viên'}
                                </p>
                              </div>

                              <div className="py-1">
                                {isAdmin && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => openAdminCenter('overview', null)}
                                    className="theme-control flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[var(--accent-primary)] hover:bg-[var(--bg-subtle)]"
                                  >
                                    <Shield className="h-3.5 w-3.5" />
                                    <span>Trung tâm quản trị</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    sfx.play('filterSelect');
                                    setFavoritesOnly((prev) => !prev);
                                    setAccountMenuOpen(false);
                                    document
                                      .getElementById('collection')
                                      ?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  className="theme-control flex w-full items-center justify-between px-3 py-2 text-left text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                                >
                                  <span className="inline-flex items-center gap-2.5">
                                    <Heart className="h-3.5 w-3.5" />
                                    <span>Nhân vật yêu thích</span>
                                  </span>
                                  <span className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                                    {favoriteIds.length}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => void handleSignOut()}
                                  className="theme-control flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-[var(--ink-secondary)] hover:bg-red-500/10 hover:text-red-500"
                                >
                                  <LogOut className="h-3.5 w-3.5" />
                                  <span>Đăng xuất</span>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </header>

            {/* Polite Email Verification Reminder (only for unverified email/password signups) */}
            {currentUser && !currentUser.emailVerified && (
              <div className="relative z-20 border-b border-[var(--border-strong)] bg-[var(--accent-soft)]/70">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-xs sm:px-8">
                  <div className="flex items-center gap-2 text-[var(--ink-primary)]">
                    <MailCheck className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                    <span>
                      Tài khoản <strong>{currentUser.email}</strong> chưa xác
                      minh email. Hãy xác nhận hộp thư để kích hoạt tính năng
                      lưu nhân vật yêu thích.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={resendingVerify}
                      onClick={() => void handleResendVerification()}
                      className="theme-control h-8 border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-[11px] font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)] disabled:opacity-60"
                    >
                      {resendingVerify ? 'Đang gửi...' : 'Gửi lại email'}
                    </button>
                    <button
                      type="button"
                      disabled={checkingVerify}
                      onClick={() => void handleRefreshVerificationStatus()}
                      className="theme-control h-8 bg-[var(--accent-primary)] px-3 text-[11px] font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
                    >
                      {checkingVerify ? 'Đang kiểm tra...' : 'Tôi đã xác minh'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                EDITORIAL HERO & LIVE ARCHIVE REGISTRY
               =============================================================== */}
            <section
              id="top"
              className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-12 pb-10 sm:px-8 sm:pt-16"
            >
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Live archival ledger metadata (unboxed text, auto-updated from DB) */}
                <div className="font-mono-archive flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs tracking-[0.14em] text-[var(--ink-muted)] uppercase">
                  <span>{ARCHIVE_META.collectionLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{ARCHIVE_META.subtitleEn}</span>
                  <span aria-hidden="true">·</span>
                  <span>{characters.length} hồ sơ</span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
                  <div className="lg:col-span-7">
                    <h1 className="text-balance">
                      <BrandWordmark theme={theme} size="md" />
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--ink-secondary)]">
                      {ARCHIVE_META.tagline}
                    </p>
                  </div>

                  {/* Personal Quote / Marginalia Note */}
                  <div className="border-t border-[var(--border-hairline)] pt-5 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7">
                    <p className="font-editorial text-xl leading-relaxed italic text-[var(--ink-secondary)]">
                      “{activeQuote.text}”
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--ink-muted)]">
                      <span className="font-mono-archive">
                        {activeQuote.note}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.play('filterSelect');
                          setQuoteIndex((i) => (i + 1) % PERSONAL_QUOTES.length);
                        }}
                        aria-label="Đổi ghi chú khác"
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] transition-colors hover:text-[var(--accent-primary)]"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Ghi chú khác</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <ThemeDivider theme={theme} />
                </div>

                {/* Live Archive Summary Metrics Row */}
                <div className="mt-6 grid grid-cols-2 gap-4 border-b border-[var(--border-hairline)] pb-6 sm:grid-cols-4">
                  <div>
                    <p className="font-mono-archive text-[11px] tracking-widest text-[var(--ink-muted)] uppercase">
                      Tổng hồ sơ
                    </p>
                    <p className="font-editorial mt-1 text-3xl font-semibold tabular-nums text-[var(--ink-primary)]">
                      {String(characters.length).padStart(2, '0')}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono-archive text-[11px] tracking-widest text-[var(--ink-muted)] uppercase">
                      Hồ sơ nổi bật
                    </p>
                    <p className="font-editorial mt-1 text-3xl font-semibold tabular-nums text-[var(--ink-primary)]">
                      {String(pinnedCount).padStart(2, '0')}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono-archive text-[11px] tracking-widest text-[var(--ink-muted)] uppercase">
                      Thể loại
                    </p>
                    <p className="font-editorial mt-1 text-3xl font-semibold tabular-nums text-[var(--ink-primary)]">
                      {String(uniqueGenresCount).padStart(2, '0')}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono-archive text-[11px] tracking-widest text-[var(--ink-muted)] uppercase">
                      Ảnh kỷ niệm
                    </p>
                    <p className="font-editorial mt-1 text-3xl font-semibold tabular-nums text-[var(--ink-primary)]">
                      {String(galleryItems.length).padStart(2, '0')}
                    </p>
                  </div>
                </div>
              </motion.div>
            </section>

            {/* ===============================================================
                01. CHARACTER COLLECTION & FILTERING WORKSPACE
               =============================================================== */}
            <main
              id="collection"
              className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-5 pb-20 sm:px-8"
            >
              {/* Workspace Utility Bar: Search + Favorites + Sort + SFX + Theme */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Search bar */}
                <div className="relative flex-1 lg:max-w-md">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên nhân vật, tag, thể loại hoặc cốt truyện..."
                    aria-label="Tìm kiếm trong thư viện nhân vật"
                    className="theme-surface theme-control h-11 w-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] pr-9 pl-10 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('close');
                        setSearchQuery('');
                      }}
                      aria-label="Xóa từ khóa tìm kiếm"
                      className="absolute top-1/2 right-2.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Controls cluster */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Personal Favorites Filter Toggle (prompts login for Guests) */}
                  <button
                    type="button"
                    onClick={() => {
                      sfx.play('filterSelect');
                      if (!currentUser) {
                        setLoginPromptOpen(true);
                        return;
                      }
                      setFavoritesOnly((prev) => !prev);
                    }}
                    onMouseEnter={() => sfx.play('hover')}
                    aria-pressed={favoritesOnly}
                    className={`theme-control inline-flex h-11 items-center gap-2 border px-3.5 text-xs font-medium whitespace-nowrap ${
                      favoritesOnly
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-ink)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]'
                    }`}
                  >
                    <Heart
                      className="h-3.5 w-3.5"
                      fill={favoritesOnly ? 'currentColor' : 'none'}
                    />
                    <span>
                      Yêu thích
                      {currentUser && favoriteIds.length > 0
                        ? ` (${favoriteIds.length})`
                        : ''}
                    </span>
                  </button>

                  {/* Sort selector */}
                  <label className="theme-control relative inline-flex h-11 items-center border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--ink-secondary)] focus-within:border-[var(--accent-primary)]">
                    <SlidersHorizontal
                      aria-hidden="true"
                      className="mr-2 h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]"
                    />
                    <span className="sr-only">Sắp xếp nhân vật</span>
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        sfx.play('filterSelect');
                        setSortBy(e.target.value as SortOption);
                      }}
                      className="cursor-pointer bg-transparent pr-1 text-xs font-medium text-[var(--ink-primary)] focus:outline-none"
                    >
                      <option value="pinned" className="bg-[var(--bg-surface)]">
                        Sắp xếp: Nổi bật trước
                      </option>
                      <option value="newest" className="bg-[var(--bg-surface)]">
                        Sắp xếp: Mới nhất
                      </option>
                      <option
                        value="alphabetical"
                        className="bg-[var(--bg-surface)]"
                      >
                        Sắp xếp: Tên A — Z
                      </option>
                    </select>
                  </label>

                  {/* Sound Effects toggle */}
                  <button
                    type="button"
                    onClick={handleToggleSfx}
                    onMouseEnter={() => sfx.play('hover')}
                    aria-pressed={sfxEnabled}
                    aria-label={
                      sfxEnabled
                        ? 'Tắt hiệu ứng âm thanh'
                        : 'Bật hiệu ứng âm thanh'
                    }
                    className="theme-control inline-flex h-11 items-center gap-2 border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                  >
                    {sfxEnabled ? (
                      <Volume2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {sfxEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}
                    </span>
                  </button>

                  {/* Theme Switcher (Cute Dreamy Light / Mysterious Wine Dark) */}
                  <button
                    type="button"
                    onClick={handleToggleTheme}
                    onMouseEnter={() => sfx.play('hover')}
                    aria-label={
                      theme === 'dark'
                        ? 'Chuyển sang giao diện Sáng ngọt ngào'
                        : 'Chuyển sang giao diện Tối rượu vang'
                    }
                    className="theme-control inline-flex h-11 items-center gap-2 border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-xs font-medium whitespace-nowrap text-[var(--ink-primary)] hover:border-[var(--accent-primary)]"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                        <span>Sáng · Dreamy</span>
                      </>
                    ) : (
                      <>
                        <Moon className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        <span>Tối · Wine Red</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Interactive Category Filter Bar */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-5">
                <div
                  role="tablist"
                  aria-label="Lọc nhân vật theo thể loại"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {availableCategories.map((category) => {
                    const isActive = activeCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => {
                          sfx.play('filterSelect');
                          setActiveCategory(category);
                        }}
                        onMouseEnter={() => sfx.play('hover')}
                        className={`theme-control h-9 px-3.5 text-xs font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] ${
                          isActive
                            ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)] shadow-sm'
                            : 'bg-transparent text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]'
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-[var(--accent-primary)] transition-opacity hover:opacity-80"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Đặt lại bộ lọc</span>
                  </button>
                )}
              </div>

              {/* Section Header + Live Match Count */}
              <div className="mt-8 flex items-baseline justify-between gap-4">
                <div>
                  <p className="font-mono-archive text-xs tracking-[0.2em] text-[var(--ink-muted)] uppercase">
                    01. Danh mục nhân vật
                  </p>
                  <h2 className="font-editorial mt-1 text-3xl font-semibold text-[var(--ink-primary)]">
                    {favoritesOnly
                      ? 'Nhân vật yêu thích của bạn'
                      : activeCategory === ALL_CATEGORY_LABEL
                        ? 'Tất cả hồ sơ lưu trữ'
                        : `Thể loại · ${activeCategory}`}
                  </h2>
                </div>
                <p className="font-mono-archive shrink-0 text-xs text-[var(--ink-muted)]">
                  Hiển thị {filteredCharacters.length} / {characters.length}
                </p>
              </div>

              {/* Character Cards Grid */}
              <LayoutGroup>
                {filteredCharacters.length > 0 ? (
                  <motion.div
                    layout
                    className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <AnimatePresence mode="popLayout">
                      {filteredCharacters.map((character, idx) => (
                        <CharacterCard
                          key={character.id}
                          character={character}
                          index={idx}
                          theme={theme}
                          isFavorited={favoriteIds.includes(character.id)}
                          onSelect={(char) => {
                            sfx.play('openCharacter');
                            setSelectedCharacterId(char.id);
                          }}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="theme-card mt-10 flex flex-col items-center justify-center border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 py-16 text-center"
                  >
                    <p className="font-mono-archive text-xs tracking-[0.2em] text-[var(--ink-muted)] uppercase">
                      Không tìm thấy hồ sơ phù hợp
                    </p>
                    <h3 className="font-editorial mt-2 text-3xl font-semibold text-[var(--ink-primary)]">
                      {favoritesOnly
                        ? 'Bạn chưa lưu nhân vật yêu thích nào'
                        : 'Chưa có nhân vật nào khớp với bộ lọc hiện tại'}
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-[var(--ink-secondary)]">
                      {favoritesOnly
                        ? 'Nhấn biểu tượng trái tim trên bất kỳ thẻ nhân vật nào để cất vào danh sách yêu thích riêng của bạn nhé.'
                        : 'Hãy thử xóa từ khóa tìm kiếm hoặc chọn thể loại khác để tiếp tục khám phá thư viện.'}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="theme-control h-10 border border-[var(--border-strong)] px-5 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)]"
                      >
                        Xem lại toàn bộ thư viện
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openAdminCenter('form', null)}
                          className="theme-control h-10 bg-[var(--accent-primary)] px-5 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)]"
                        >
                          Thêm nhân vật mới
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </LayoutGroup>
            </main>

            {/* ===============================================================
                SUBTLE EDITORIAL MARQUEE DIVIDER
               =============================================================== */}
            <div
              aria-hidden="true"
              className="relative z-10 overflow-hidden border-y border-[var(--border-hairline)] bg-[var(--bg-surface)]/70 py-3.5"
            >
              <div className="animate-marquee flex w-max items-center gap-10 text-xs tracking-[0.24em] text-[var(--ink-muted)] uppercase">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="font-mono-archive whitespace-nowrap">
                    xocyberluv’s character archive · YOUR LITTLE WORLD OF
                    CHARACTERS &amp; STORIES · Thư viện cá nhân · 2026
                  </span>
                ))}
              </div>
            </div>

            {/* ===============================================================
                02. INDEPENDENT DECORATIVE IMAGE GALLERY
               =============================================================== */}
            <div className="relative z-10">
              <DecorGallery
                items={galleryItems}
                isAdmin={isAdmin}
                onAddItem={isAdmin ? handleAddGalleryItem : undefined}
                onRemoveItem={isAdmin ? handleRemoveGalleryItem : undefined}
              />
            </div>

            {/* ===============================================================
                03. CURATOR'S NOTES & FOOTER
               =============================================================== */}
            <footer
              id="notes"
              className="relative z-10 mt-8 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/60"
            >
              <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
                  <div className="md:col-span-6">
                    <p className="font-mono-archive text-xs tracking-[0.2em] text-[var(--ink-muted)] uppercase">
                      03. Ghi chú thư viện
                    </p>
                    <div className="mt-3">
                      <BrandWordmark theme={theme} size="sm" />
                    </div>
                    <p className="font-mono-archive mt-2 text-[11px] tracking-[0.18em] text-[var(--ink-muted)] uppercase">
                      {ARCHIVE_META.subtitleEn}
                    </p>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--ink-secondary)]">
                      {ARCHIVE_META.tagline} Chuyển đổi tự do giữa phong cách
                      Pastel Sky mộng mơ ban ngày và Wine Archive huyền bí khi
                      đêm xuống.
                    </p>
                  </div>

                  <div className="flex flex-col justify-between gap-5 md:col-span-6 md:items-end md:text-right">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openAdminCenter('overview', null)}
                          className="theme-control inline-flex h-10 items-center gap-1.5 border border-[var(--border-strong)] px-4 text-xs font-medium text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
                        >
                          <Shield className="h-3.5 w-3.5" />
                          <span>Trung tâm quản trị</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          sfx.play('close');
                          setStage('welcome');
                        }}
                        className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                      >
                        Quay lại màn hình chào mừng
                      </button>
                    </div>

                    <p className="font-mono-archive text-xs text-[var(--ink-muted)]">
                      {ARCHIVE_META.archiveNumber} · {characters.length} hồ sơ ·{' '}
                      {ARCHIVE_META.established}
                    </p>
                  </div>
                </div>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Background Music Player (always accessible once inside main archive) */}
      {stage === 'main' && <MusicPlayer snapshot={musicSnapshot} />}

      {/* Subtle Back-to-Top Floating Button */}
      <AnimatePresence>
        {stage === 'main' && !adminView.open && showBackToTop && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={() => {
              sfx.play('filterSelect');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="Cuộn lên đầu trang"
            className="theme-control fixed bottom-4 left-4 z-30 flex h-10 w-10 items-center justify-center border border-[var(--border-strong)] bg-[var(--bg-surface)]/92 text-[var(--ink-secondary)] shadow-md backdrop-blur-md hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)] sm:bottom-6 sm:left-6"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Character Editorial Detail Modal */}
      <AnimatePresence>
        {selectedCharacter && (
          <CharacterDetailModal
            character={selectedCharacter}
            theme={theme}
            isAdmin={isAdmin}
            isFavorited={favoriteIds.includes(selectedCharacter.id)}
            onClose={() => setSelectedCharacterId(null)}
            onPrev={handlePrevCharacter}
            onNext={handleNextCharacter}
            hasMultiple={filteredCharacters.length > 1}
            onToggleFavorite={handleToggleFavorite}
            onEdit={
              isAdmin
                ? (char) => openAdminCenter('form', char)
                : undefined
            }
            onDelete={isAdmin ? handleAdminDeleteFromModal : undefined}
            onCopyLink={handleCopyLink}
          />
        )}
      </AnimatePresence>

      {/* Guest Login Prompt Modal (triggered when Guest clicks member-only feature) */}
      <AnimatePresence>
        {loginPromptOpen && (
          <LoginPromptModal
            theme={theme}
            onOpenLogin={() => {
              setLoginPromptOpen(false);
              setAuthModal({ open: true, mode: 'login' });
            }}
            onOpenRegister={() => {
              setLoginPromptOpen(false);
              setAuthModal({ open: true, mode: 'register' });
            }}
            onClose={() => {
              setLoginPromptOpen(false);
              setPendingGuestAction(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Login / Register Modal */}
      <AnimatePresence>
        {authModal.open && (
          <AuthModal
            mode={authModal.mode}
            theme={theme}
            onModeChange={(nextMode) =>
              setAuthModal({ open: true, mode: nextMode })
            }
            onClose={() => {
              setAuthModal((prev) => ({ ...prev, open: false }));
            }}
            onAuthSuccess={({ message, preferredUsername }) => {
              if (preferredUsername) {
                pendingUsernameRef.current = preferredUsername;
              }
              setAuthModal((prev) => ({ ...prev, open: false }));
              showToast(message);
            }}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            role="status"
            aria-live="polite"
            className="theme-control fixed bottom-20 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 border border-[var(--border-strong)] bg-[var(--bg-surface)]/95 px-4 py-2.5 text-center text-xs font-medium text-[var(--ink-primary)] shadow-lg backdrop-blur-md sm:bottom-6"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
