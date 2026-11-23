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
  MessageSquare,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Sun,
  User,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ARCHIVE_META, PERSONAL_QUOTES } from './config/mediaConfig';
import { ALL_CATEGORY_LABEL } from './data/characters';
import { auth } from './lib/firebase';
import {
  addGalleryItemAdmin,
  deleteCharacterAdmin,
  deleteGalleryItemAdmin,
  subscribeCategories,
  subscribeCharacters,
  subscribeGallery,
  subscribeUserFavorites,
  syncUserProfileDoc,
  toggleUserFavorite,
} from './services/archiveService';
import {
  subscribeForumComments,
  subscribeForumLikes,
  subscribeForumPosts,
  subscribePublicProfiles,
  toggleForumLike,
} from './services/forumService';
import { subscribeTracks } from './services/musicService';
import {
  DEFAULT_FORUM_RULES,
  acceptForumRules,
  hasGuestAcceptedRulesVersion,
  saveGuestAcceptedRulesVersion,
  subscribeAdminAuditLogs,
  subscribeAllRestrictionsAdmin,
  subscribeAllViolationsAdmin,
  subscribeForumRulesConfig,
  subscribeOwnRestriction,
  subscribeOwnViolations,
  subscribeUserRulesAcceptance,
  submitViolationAppeal,
} from './services/moderationService';
import {
  deleteUserNotification,
  markAllNotificationsRead,
  markNotificationRead,
  notifyPostLike,
  subscribeImportantAnnouncements,
  subscribeUserNotifications,
} from './services/notificationService';
import type {
  AdminAuditLog,
  AppSection,
  ArchiveStage,
  AuthModalMode,
  CategoryRecord,
  CharacterRecord,
  ForumComment,
  ForumLike,
  ForumPost,
  ForumRulesAcceptance,
  ForumRulesConfig,
  ForumViolation,
  GalleryItem,
  ImportantAnnouncement,
  MusicTrack,
  PendingGuestAction,
  PublicUserProfile,
  SortOption,
  ThemeMode,
  UserNotification,
  UserProfile,
  UserRestriction,
} from './types/archive';
import { musicPlayer, type MusicSnapshot } from './utils/musicEngine';
import { sfx } from './utils/sfxEngine';
import { AdminDashboard, type AdminTab } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { BrandWordmark } from './components/BrandWordmark';
import { CharacterCard } from './components/CharacterCard';
import { CharacterDetailModal } from './components/CharacterDetailModal';
import { DecorGallery } from './components/DecorGallery';
import { ForumRulesGate } from './components/ForumRulesGate';
import { ForumSection } from './components/ForumSection';
import { ImportantAnnouncementPopup } from './components/ImportantAnnouncementPopup';
import { LoadingScreen, type LoadingTaskItem } from './components/LoadingScreen';
import { LoginPromptModal } from './components/LoginPromptModal';
import {
  ModerationWarningModal,
  type ModerationWarningPayload,
} from './components/ModerationWarningModal';
import { MusicPlayer } from './components/MusicPlayer';
import { NotificationCenter } from './components/NotificationCenter';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import {
  FloatingDreamyStickers,
  ThemeDivider,
} from './components/ThemeDecorations';
import { WelcomeScreen } from './components/WelcomeScreen';

const THEME_STORAGE_KEY = 'xocyberluv_archive_theme';
const DISMISSED_ANNOUNCEMENTS_KEY = 'xocyberluv_dismissed_announcements';

function loadInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore storage errors
  }
  return 'light';
}

function loadDismissedAnnouncementIds(): string[] {
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function preloadImageUrls(urls: string[], perImageTimeoutMs = 1800): Promise<void> {
  const uniqueUrls = Array.from(
    new Set(urls.map((u) => u.trim()).filter((u) => u.length > 0))
  ).slice(0, 8);

  if (uniqueUrls.length === 0) return Promise.resolve();

  return Promise.all(
    uniqueUrls.map(
      (url) =>
        new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            resolve();
          };
          const timer = window.setTimeout(done, perImageTimeoutMs);
          const img = new Image();
          img.referrerPolicy = 'no-referrer';
          img.onload = done;
          img.onerror = done;
          img.src = url;
        })
    )
  ).then(() => undefined);
}

export default function App() {
  const [stage, setStage] = useState<ArchiveStage>('welcome');
  const [theme, setTheme] = useState<ThemeMode>(loadInitialTheme);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => sfx.isEnabled());
  const [musicSnapshot, setMusicSnapshot] = useState<MusicSnapshot>(() =>
    musicPlayer.getSnapshot()
  );

  // Real Firebase Auth + Firestore Profile State
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const pendingUsernameRef = useRef<string | undefined>(undefined);
  const [resendingVerify, setResendingVerify] = useState(false);
  const [checkingVerify, setCheckingVerify] = useState(false);

  // Main section navigation (Library Archive, Forum, or My Profile)
  const [activeSection, setActiveSection] = useState<AppSection>('archive');
  const previousSectionRef = useRef<'archive' | 'forum'>('archive');

  // Real website initialization pipeline (starts when entering Loading Screen)
  const [archiveInitStarted, setArchiveInitStarted] = useState(false);
  const [loadingRunId, setLoadingRunId] = useState(0);
  const [charsLoaded, setCharsLoaded] = useState(false);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [tracksLoaded, setTracksLoaded] = useState(false);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [forumPostsLoaded, setForumPostsLoaded] = useState(false);
  const [forumCommentsLoaded, setForumCommentsLoaded] = useState(false);
  const [forumLikesLoaded, setForumLikesLoaded] = useState(false);
  const [rulesConfigLoaded, setRulesConfigLoaded] = useState(false);
  const [announcementsLoaded, setAnnouncementsLoaded] = useState(false);
  const [audioPrepared, setAudioPrepared] = useState(false);
  const [assetsPrepared, setAssetsPrepared] = useState(false);

  // Live Firestore Archive Collections (Public Read — zero placeholder data)
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);

  // Live Firestore Forum & Public Profile Collections
  const [publicProfiles, setPublicProfiles] = useState<
    Record<string, PublicUserProfile>
  >({});
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [forumComments, setForumComments] = useState<ForumComment[]>([]);
  const [forumLikes, setForumLikes] = useState<ForumLike[]>([]);
  const [forumLoading, setForumLoading] = useState(true);
  const [selectedForumPostId, setSelectedForumPostId] = useState<string | null>(
    null
  );
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(
    null
  );
  const [forumComposerOpen, setForumComposerOpen] = useState(false);

  // Forum Rules Gate, Moderation, Notifications & Announcements State
  const [rulesConfig, setRulesConfig] =
    useState<ForumRulesConfig>(DEFAULT_FORUM_RULES);
  const [userRulesAcceptance, setUserRulesAcceptance] =
    useState<ForumRulesAcceptance | null>(null);
  const [rulesAcceptanceLoaded, setRulesAcceptanceLoaded] = useState(false);
  const [guestAcceptedVersion, setGuestAcceptedVersion] = useState<number>(() =>
    hasGuestAcceptedRulesVersion(1) ? 1 : 0
  );
  const [savingRulesAcceptance, setSavingRulesAcceptance] = useState(false);

  const [ownRestriction, setOwnRestriction] = useState<UserRestriction | null>(
    null
  );
  const [ownViolations, setOwnViolations] = useState<ForumViolation[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [importantAnnouncements, setImportantAnnouncements] = useState<
    ImportantAnnouncement[]
  >([]);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<
    string[]
  >(loadDismissedAnnouncementIds);

  // Admin-only Moderation Collections
  const [allViolations, setAllViolations] = useState<ForumViolation[]>([]);
  const [allRestrictions, setAllRestrictions] = useState<
    Record<string, UserRestriction>
  >({});
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([]);

  // Active Content Moderation Warning Modal (rendered above Forum composer/comments so draft stays intact)
  const [activeWarning, setActiveWarning] =
    useState<ModerationWarningPayload | null>(null);

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

  // Subscribe to real Firebase Auth session immediately on page load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setCurrentUser(null);
        setFavoriteIds([]);
        setFavoritesOnly(false);
        setAdminView({ open: false, tab: 'overview', editingChar: null });
        setActiveSection((prev) => (prev === 'profile' ? 'archive' : prev));
        setAuthReady(true);
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
      } finally {
        setAuthReady(true);
      }
    });
    return unsubscribe;
  }, []);

  // Never leave login/register modals open once a real session is active
  useEffect(() => {
    if (!currentUser) return;
    setAuthModal((prev) => (prev.open ? { ...prev, open: false } : prev));
    setLoginPromptOpen(false);
  }, [currentUser]);

  // Keep lightweight music playlist synced early so clicking "TRUY CẬP THƯ VIỆN"
  // can start real background music immediately inside the user click gesture.
  useEffect(() => {
    const unsubTracks = subscribeTracks((dbTracks) => {
      setTracks(dbTracks);
      setTracksLoaded(true);
    });
    return () => {
      unsubTracks();
    };
  }, []);

  // Real website data initialization: runs once the user enters the Loading Screen
  useEffect(() => {
    if (!archiveInitStarted) return;

    const unsubChars = subscribeCharacters((records) => {
      setCharacters(records);
      setCharsLoaded(true);
    });
    const unsubCats = subscribeCategories((cats) => {
      setCategories(cats);
      setCatsLoaded(true);
    });
    const unsubGallery = subscribeGallery((items) => {
      setGalleryItems(items);
      setGalleryLoaded(true);
    });
    const unsubPublicProfiles = subscribePublicProfiles((profiles) => {
      setPublicProfiles(profiles);
      setProfilesLoaded(true);
    });
    const unsubForumPosts = subscribeForumPosts((posts) => {
      setForumPosts(posts);
      setForumLoading(false);
      setForumPostsLoaded(true);
    });
    const unsubForumComments = subscribeForumComments((comments) => {
      setForumComments(comments);
      setForumCommentsLoaded(true);
    });
    const unsubForumLikes = subscribeForumLikes((likes) => {
      setForumLikes(likes);
      setForumLikesLoaded(true);
    });
    const unsubRulesConfig = subscribeForumRulesConfig((cfg) => {
      setRulesConfig(cfg);
      setRulesConfigLoaded(true);
      if (hasGuestAcceptedRulesVersion(cfg.version)) {
        setGuestAcceptedVersion(cfg.version);
      }
    });
    const unsubImportantAnnouncements = subscribeImportantAnnouncements(
      (items) => {
        setImportantAnnouncements(items);
        setAnnouncementsLoaded(true);
      }
    );
    return () => {
      unsubChars();
      unsubCats();
      unsubGallery();
      unsubPublicProfiles();
      unsubForumPosts();
      unsubForumComments();
      unsubForumLikes();
      unsubRulesConfig();
      unsubImportantAnnouncements();
    };
  }, [archiveInitStarted]);

  // Respect #forum URL hash without ever skipping Welcome -> Loading -> Main flow
  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === '#forum') {
        setActiveSection('forum');
      }
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // Live-sync Admin-managed tracks into the website's Music Player playlist
  useEffect(() => {
    musicPlayer.setPlaylist(tracks);
  }, [tracks]);

  // Real audio readiness & autoplay verification while on Loading Screen
  useEffect(() => {
    if (stage !== 'loading' || !tracksLoaded) return;
    let cancelled = false;
    setAudioPrepared(false);

    const snap = musicPlayer.getSnapshot();
    if (
      snap.playlist.length > 0 &&
      !snap.isPlaying &&
      !snap.isLoadingTrack &&
      !snap.autoplayBlocked
    ) {
      void musicPlayer.play();
    }

    void musicPlayer.waitForInitialAudioReady(1800).then(() => {
      if (!cancelled) {
        setAudioPrepared(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [stage, tracksLoaded, loadingRunId]);

  const archiveDataReady = charsLoaded && catsLoaded && galleryLoaded;
  const communityDataReady =
    profilesLoaded &&
    forumPostsLoaded &&
    forumCommentsLoaded &&
    forumLikesLoaded &&
    rulesConfigLoaded &&
    announcementsLoaded;
  const audioStepReady = tracksLoaded && audioPrepared;

  // Real font & visible media preloading while on Loading Screen
  const charactersRef = useRef<CharacterRecord[]>(characters);
  const galleryRef = useRef<GalleryItem[]>(galleryItems);
  charactersRef.current = characters;
  galleryRef.current = galleryItems;

  useEffect(() => {
    if (stage !== 'loading' || !archiveDataReady) return;
    let cancelled = false;
    setAssetsPrepared(false);

    const fontsPromise =
      typeof document !== 'undefined' && document.fonts?.ready
        ? document.fonts.ready.then(() => undefined).catch(() => undefined)
        : Promise.resolve();

    const visibleImageUrls = [
      ...charactersRef.current.slice(0, 6).map((c) => c.image),
      ...galleryRef.current.slice(0, 2).map((g) => g.image),
    ];

    void Promise.all([
      fontsPromise,
      preloadImageUrls(visibleImageUrls, 1800),
    ]).then(() => {
      if (!cancelled) {
        setAssetsPrepared(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [stage, archiveDataReady, loadingRunId]);

  // Real weighted loading progress & tasks (zero fake timers)
  const loadingTasks = useMemo<LoadingTaskItem[]>(
    () => [
      { id: 'auth', label: 'Xác thực phiên người dùng', done: authReady },
      {
        id: 'archive',
        label: 'Đồng bộ thư viện nhân vật & thể loại',
        done: archiveDataReady,
      },
      {
        id: 'community',
        label: 'Tải diễn đàn & cấu hình nội quy',
        done: communityDataReady,
      },
      {
        id: 'audio',
        label: 'Khởi tạo danh sách nhạc nền',
        done: audioStepReady,
      },
      {
        id: 'assets',
        label: 'Chuẩn bị phông chữ & hình ảnh hiển thị',
        done: assetsPrepared,
      },
    ],
    [authReady, archiveDataReady, communityDataReady, audioStepReady, assetsPrepared]
  );

  const loadingProgress = useMemo(() => {
    let pct = 0;
    if (authReady) pct += 15;
    if (charsLoaded) pct += 12;
    if (catsLoaded) pct += 9;
    if (galleryLoaded) pct += 9;
    if (forumPostsLoaded) pct += 8;
    if (forumCommentsLoaded && forumLikesLoaded) pct += 6;
    if (profilesLoaded && rulesConfigLoaded && announcementsLoaded) pct += 6;
    if (tracksLoaded) pct += 8;
    if (audioPrepared) pct += 7;
    if (assetsPrepared) pct += 20;
    return Math.min(100, pct);
  }, [
    authReady,
    charsLoaded,
    catsLoaded,
    galleryLoaded,
    forumPostsLoaded,
    forumCommentsLoaded,
    forumLikesLoaded,
    profilesLoaded,
    rulesConfigLoaded,
    announcementsLoaded,
    tracksLoaded,
    audioPrepared,
    assetsPrepared,
  ]);

  const loadingComplete =
    authReady &&
    archiveDataReady &&
    communityDataReady &&
    audioStepReady &&
    assetsPrepared;

  const loadingStatusLabel = useMemo(() => {
    if (loadingComplete) return 'Thư viện đã sẵn sàng.';
    if (!authReady) return 'Đang xác thực phiên người dùng...';
    if (!archiveDataReady) return 'Đang tải dữ liệu thư viện nhân vật...';
    if (!communityDataReady) return 'Đang đồng bộ diễn đàn và nội quy...';
    if (!audioStepReady) return 'Đang khởi tạo trình phát nhạc nền...';
    return 'Đang tải phông chữ và hình ảnh...';
  }, [
    loadingComplete,
    authReady,
    archiveDataReady,
    communityDataReady,
    audioStepReady,
  ]);

  // Enter Main Website automatically once actual initialization finishes
  useEffect(() => {
    if (stage !== 'loading' || !loadingComplete) return;
    sfx.play('loadingComplete');
    const settleTimer = window.setTimeout(() => {
      setStage('main');
      window.scrollTo({ top: 0 });
    }, 280);
    return () => window.clearTimeout(settleTimer);
  }, [stage, loadingComplete]);

  // Safety guard so a flaky network/offline Firestore never traps the user forever
  useEffect(() => {
    if (stage !== 'loading') return;
    const failsafe = window.setTimeout(() => {
      setStage('main');
      window.scrollTo({ top: 0 });
    }, 8000);
    return () => window.clearTimeout(failsafe);
  }, [stage, loadingRunId]);

  // Subscribe to member personal favorites, notifications, rules acceptance & moderation standing
  useEffect(() => {
    if (!currentUser) {
      setFavoriteIds([]);
      setUserRulesAcceptance(null);
      setRulesAcceptanceLoaded(true);
      setOwnRestriction(null);
      setOwnViolations([]);
      setNotifications([]);
      return;
    }

    setRulesAcceptanceLoaded(false);
    const unsubAccept = subscribeUserRulesAcceptance(
      currentUser.uid,
      (acc) => {
        setUserRulesAcceptance(acc);
        setRulesAcceptanceLoaded(true);
      }
    );
    const unsubRestriction = subscribeOwnRestriction(
      currentUser.uid,
      setOwnRestriction
    );
    const unsubViolations = subscribeOwnViolations(
      currentUser.uid,
      setOwnViolations
    );

    let unsubFavs: (() => void) | undefined;
    let unsubNotifs: (() => void) | undefined;
    if (currentUser.emailVerified) {
      unsubFavs = subscribeUserFavorites(currentUser.uid, setFavoriteIds);
      unsubNotifs = subscribeUserNotifications(
        currentUser.uid,
        setNotifications
      );
    } else {
      setFavoriteIds([]);
      setNotifications([]);
    }

    return () => {
      unsubAccept();
      unsubRestriction();
      unsubViolations();
      unsubFavs?.();
      unsubNotifs?.();
    };
  }, [currentUser]);

  // Admin-only subscriptions for Moderation Center & Immutable Audit Logs
  useEffect(() => {
    if (!isAdmin) {
      setAllViolations([]);
      setAllRestrictions({});
      setAdminAuditLogs([]);
      return;
    }
    const unsubAllViolations = subscribeAllViolationsAdmin(setAllViolations);
    const unsubAllRestrictions =
      subscribeAllRestrictionsAdmin(setAllRestrictions);
    const unsubAuditLogs = subscribeAdminAuditLogs(setAdminAuditLogs);
    return () => {
      unsubAllViolations();
      unsubAllRestrictions();
      unsubAuditLogs();
    };
  }, [isAdmin]);

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
    [characters, favoriteIds, showToast]
  );

  const executeForumLikeToggle = useCallback(
    async (user: UserProfile, postId: string) => {
      if (!user.emailVerified) {
        showToast(
          'Vui lòng xác minh địa chỉ email của bạn trước khi thích bài viết.'
        );
        return;
      }

      const alreadyLiked = forumLikes.some(
        (like) => like.postId === postId && like.userId === user.uid
      );
      try {
        await toggleForumLike(postId, user.uid, alreadyLiked);
        if (!alreadyLiked) {
          const targetPost = forumPosts.find((p) => p.id === postId);
          if (targetPost) {
            void notifyPostLike({ post: targetPost, actor: user });
          }
        }
      } catch {
        showToast('Không thể cập nhật lượt thích lúc này. Vui lòng thử lại.');
      }
    },
    [forumLikes, forumPosts, showToast]
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
    if (action.type === 'favorite' && action.characterId) {
      void executeFavoriteToggle(currentUser, action.characterId);
    } else if (action.type === 'forum_like' && action.postId) {
      void executeForumLikeToggle(currentUser, action.postId);
    } else if (action.type === 'forum_compose') {
      setActiveSection('forum');
      setForumComposerOpen(true);
    } else if (action.type === 'forum_comment' && action.postId) {
      setActiveSection('forum');
      setSelectedForumPostId(action.postId);
    }
  }, [
    pendingGuestAction,
    currentUser,
    executeFavoriteToggle,
    executeForumLikeToggle,
  ]);

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

  const handleToggleForumLike = useCallback(
    (postId: string) => {
      if (!currentUser) {
        setPendingGuestAction({ type: 'forum_like', postId });
        setLoginPromptOpen(true);
        return;
      }
      void executeForumLikeToggle(currentUser, postId);
    },
    [currentUser, executeForumLikeToggle]
  );

  const handleRequireForumLogin = useCallback(
    (action: {
      type: 'forum_like' | 'forum_compose' | 'forum_comment';
      postId?: string;
    }) => {
      if (action.type === 'forum_compose') {
        setPendingGuestAction({ type: 'forum_compose' });
      } else if (action.type === 'forum_like' && action.postId) {
        setPendingGuestAction({ type: 'forum_like', postId: action.postId });
      } else if (action.type === 'forum_comment' && action.postId) {
        setPendingGuestAction({ type: 'forum_comment', postId: action.postId });
      }
      setLoginPromptOpen(true);
    },
    []
  );

  const handleNavigateSection = useCallback(
    (section: AppSection, anchorId?: string) => {
      sfx.play('filterSelect');
      setAccountMenuOpen(false);
      if (section === 'archive' || section === 'forum') {
        previousSectionRef.current = section;
      }
      setActiveSection(section);
      try {
        if (section === 'forum') {
          window.history.replaceState(null, '', '#forum');
        } else if (window.location.hash === '#forum') {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } catch {
        // Ignore history restrictions in sandboxed iframe
      }
      if ((section === 'archive' || section === 'profile') && anchorId) {
        window.setTimeout(() => {
          document
            .getElementById(anchorId)
            ?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  const handleAcceptForumRules = useCallback(async () => {
    setSavingRulesAcceptance(true);
    try {
      if (currentUser) {
        await acceptForumRules(currentUser, rulesConfig.version);
        setUserRulesAcceptance({
          userId: currentUser.uid,
          acceptedVersion: rulesConfig.version,
          acceptedAt: Date.now(),
        });
      } else {
        saveGuestAcceptedRulesVersion(rulesConfig.version);
        setGuestAcceptedVersion(rulesConfig.version);
      }
      sfx.play('welcomeClick');
      showToast('Cảm ơn bạn đã đồng ý nội quy! Chào mừng đến với Diễn đàn.');
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Không thể lưu xác nhận nội quy lúc này. Vui lòng thử lại.'
      );
    } finally {
      setSavingRulesAcceptance(false);
    }
  }, [currentUser, rulesConfig.version, showToast]);

  const handleDismissAnnouncement = useCallback((announcementId: string) => {
    setDismissedAnnouncementIds((prev) => {
      if (prev.includes(announcementId)) return prev;
      const next = [...prev, announcementId];
      try {
        window.sessionStorage.setItem(
          DISMISSED_ANNOUNCEMENTS_KEY,
          JSON.stringify(next)
        );
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const handleOpenImportantAnnouncementPost = useCallback(
    (postId: string, announcementId?: string) => {
      if (announcementId) {
        handleDismissAnnouncement(announcementId);
      }
      setAdminView({ open: false, tab: 'overview', editingChar: null });
      setHighlightCommentId(null);
      setSelectedForumPostId(postId);
      handleNavigateSection('forum');
    },
    [handleDismissAnnouncement, handleNavigateSection]
  );

  const handleSelectNotification = useCallback(
    (item: UserNotification) => {
      if (!item.isRead) {
        void markNotificationRead(item.id, true);
      }
      if (item.type === 'important_post' || item.type === 'interaction') {
        setAdminView({ open: false, tab: 'overview', editingChar: null });
        if (item.postId) {
          setSelectedForumPostId(item.postId);
        }
        setHighlightCommentId(item.commentId || null);
        handleNavigateSection('forum');
        return;
      }
      if (item.type === 'warning') {
        setAdminView({ open: false, tab: 'overview', editingChar: null });
        handleNavigateSection('profile', 'profile-account-standing');
        return;
      }
      if (item.type === 'system' && isAdmin) {
        setStage('main');
        setAdminView({ open: true, tab: 'moderation', editingChar: null });
        window.scrollTo({ top: 0 });
        return;
      }
      handleNavigateSection('profile');
    },
    [handleNavigateSection, isAdmin]
  );

  const handleSubmitWarningAppeal = useCallback(
    async (violationId: string, appealReason: string) => {
      if (!currentUser) return;
      await submitViolationAppeal({
        violationId,
        user: currentUser,
        appealReason,
        publicProfiles,
      });
      showToast('Đã gửi yêu cầu xem xét lại đến Quản trị viên!');
    },
    [currentUser, publicProfiles, showToast]
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
    setArchiveInitStarted(true);
    setAudioPrepared(false);
    setAssetsPrepared(false);
    setLoadingRunId((n) => n + 1);
    setStage('loading');
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
        await deleteCharacterAdmin(id);
        setSelectedCharacterId(null);
        showToast(`Đã xóa nhân vật "${target?.name || id}" khỏi thư viện.`);
      } catch {
        showToast('Không thể xóa nhân vật. Vui lòng kiểm tra quyền quản trị.');
      }
    },
    [characters, currentUser, isAdmin, showToast]
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
      await addGalleryItemAdmin(item);
      showToast('Đã thêm ảnh mới vào góc ảnh trang trí!');
    },
    [currentUser, isAdmin, showToast]
  );

  const handleRemoveGalleryItem = useCallback(
    async (id: string) => {
      if (!isAdmin || !currentUser) return;
      await deleteGalleryItemAdmin(id);
      showToast('Đã xóa ảnh khỏi góc ảnh trang trí.');
    },
    [currentUser, isAdmin, showToast]
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

  // Compute Forum Rules Gate requirement (cannot be bypassed by direct URL)
  const needsForumRulesAcceptance = useMemo(() => {
    if (currentUser) {
      if (!rulesAcceptanceLoaded) return false;
      return (
        !userRulesAcceptance ||
        userRulesAcceptance.acceptedVersion < rulesConfig.version
      );
    }
    return guestAcceptedVersion < rulesConfig.version;
  }, [
    currentUser,
    rulesAcceptanceLoaded,
    userRulesAcceptance,
    rulesConfig.version,
    guestAcceptedVersion,
  ]);

  const isUpdatedForumRulesVersion = Boolean(
    currentUser &&
      userRulesAcceptance &&
      userRulesAcceptance.acceptedVersion > 0 &&
      userRulesAcceptance.acceptedVersion < rulesConfig.version
  );

  // Pick the newest active Important Admin Pinned Post announcement for bottom-left popup
  const activePopupAnnouncement = useMemo(() => {
    return (
      importantAnnouncements.find(
        (item) =>
          item.active &&
          !dismissedAnnouncementIds.includes(item.id) &&
          (!currentUser || item.authorId !== currentUser.uid)
      ) ?? null
    );
  }, [importantAnnouncements, dismissedAnnouncementIds, currentUser]);

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
            recordCount={archiveInitStarted ? characters.length : null}
            authReady={authReady}
            currentUser={currentUser}
            onEnter={handleEnterArchive}
          />
        )}

        {stage === 'loading' && (
          <LoadingScreen
            key="stage-loading"
            theme={theme}
            progress={loadingProgress}
            statusLabel={loadingStatusLabel}
            tasks={loadingTasks}
            isComplete={loadingComplete}
            musicSnapshot={musicSnapshot}
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
              galleryItems={galleryItems}
              tracks={tracks}
              violations={allViolations}
              restrictions={allRestrictions}
              auditLogs={adminAuditLogs}
              forumPosts={forumPosts}
              publicProfiles={publicProfiles}
              rulesConfig={rulesConfig}
              initialTab={adminView.tab}
              editingCharacter={adminView.editingChar}
              onBackToArchive={() =>
                setAdminView({ open: false, tab: 'overview', editingChar: null })
              }
              onInspectCharacter={(char) => {
                setSelectedCharacterId(char.id);
              }}
              onInspectForumPost={(postId) => {
                setAdminView({ open: false, tab: 'overview', editingChar: null });
                setHighlightCommentId(null);
                setSelectedForumPostId(postId);
                handleNavigateSection('forum');
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
              <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
                {/* Zone 1: Brand Wordmark */}
                <a
                  href="#top"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigateSection('archive');
                  }}
                  className="shrink-0 whitespace-nowrap transition-opacity hover:opacity-85"
                >
                  <BrandWordmark theme={theme} size="sm" />
                </a>

                {/* Zone 2: Clean single-line Vietnamese Navigation with sliding active indicator */}
                <nav
                  aria-label="Điều hướng chính"
                  className="hidden items-center gap-6 text-sm font-medium text-[var(--ink-secondary)] md:flex"
                >
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('archive', 'collection')}
                    onMouseEnter={() => sfx.play('hover')}
                    className={`relative shrink-0 py-1 whitespace-nowrap transition-colors hover:text-[var(--ink-primary)] ${
                      activeSection === 'archive'
                        ? 'font-semibold text-[var(--accent-primary)]'
                        : ''
                    }`}
                  >
                    <span>Thư viện</span>
                    {activeSection === 'archive' && (
                      <motion.span
                        layoutId="nav-active-underline"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-x-0 -bottom-1 h-[2px] rounded-full bg-[var(--accent-primary)]"
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('forum')}
                    onMouseEnter={() => sfx.play('hover')}
                    className={`relative inline-flex shrink-0 items-center gap-1.5 py-1 whitespace-nowrap transition-colors hover:text-[var(--ink-primary)] ${
                      activeSection === 'forum'
                        ? 'font-semibold text-[var(--accent-primary)]'
                        : ''
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Diễn đàn</span>
                    {forumPosts.length > 0 && (
                      <span className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                        ({forumPosts.length})
                      </span>
                    )}
                    {activeSection === 'forum' && (
                      <motion.span
                        layoutId="nav-active-underline"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-x-0 -bottom-1 h-[2px] rounded-full bg-[var(--accent-primary)]"
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('archive', 'gallery')}
                    onMouseEnter={() => sfx.play('hover')}
                    className="shrink-0 py-1 whitespace-nowrap transition-colors hover:text-[var(--ink-primary)]"
                  >
                    Góc ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigateSection('archive', 'notes')}
                    onMouseEnter={() => sfx.play('hover')}
                    className="shrink-0 py-1 whitespace-nowrap transition-colors hover:text-[var(--ink-primary)]"
                  >
                    Ghi chú
                  </button>
                </nav>

                {/* Zone 3: Quick Theme/SFX (when outside Archive workspace) + Role-Aware Account Controls */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* Compact mobile Forum/Library toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      handleNavigateSection(
                        activeSection === 'forum' ? 'archive' : 'forum'
                      )
                    }
                    className={`theme-control inline-flex h-9 shrink-0 items-center gap-1.5 border px-2.5 text-xs font-medium whitespace-nowrap md:hidden ${
                      activeSection === 'forum'
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)]'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{activeSection === 'forum' ? 'Thư viện' : 'Diễn đàn'}</span>
                  </button>

                  {activeSection !== 'archive' && (
                    <button
                      type="button"
                      onClick={handleToggleTheme}
                      aria-label={
                        theme === 'dark'
                          ? 'Chuyển sang giao diện Sáng'
                          : 'Chuyển sang giao diện Tối'
                      }
                      className="theme-control hidden h-9 w-9 shrink-0 items-center justify-center border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)] sm:inline-flex"
                    >
                      {theme === 'dark' ? (
                        <Sun className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                      ) : (
                        <Moon className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                      )}
                    </button>
                  )}

                  {!authReady ? (
                    <div
                      aria-label="Đang đồng bộ phiên đăng nhập"
                      className="theme-control h-9 w-24 animate-pulse border border-[var(--border-hairline)] bg-[var(--bg-subtle)]"
                    />
                  ) : !currentUser ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.play('filterSelect');
                          setAuthModal({ open: true, mode: 'login' });
                        }}
                        onMouseEnter={() => sfx.play('hover')}
                        className="theme-control inline-flex h-9 shrink-0 items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-xs font-semibold whitespace-nowrap text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] sm:px-3.5"
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
                        className="theme-control inline-flex h-9 shrink-0 items-center gap-1.5 bg-[var(--accent-primary)] px-3 text-xs font-semibold whitespace-nowrap text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] sm:px-3.5"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Đăng ký</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {currentUser.emailVerified && (
                        <NotificationCenter
                          theme={theme}
                          notifications={notifications}
                          onSelectNotification={handleSelectNotification}
                          onMarkRead={(id, isRead) =>
                            void markNotificationRead(id, isRead)
                          }
                          onMarkAllRead={() =>
                            void markAllNotificationsRead(notifications)
                          }
                          onDeleteNotification={(id) =>
                            void deleteUserNotification(id)
                          }
                        />
                      )}

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
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => handleNavigateSection('profile')}
                                  className="theme-control flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)]"
                                >
                                  <User className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                                  <span>Hồ sơ của tôi</span>
                                </button>

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
                                    setFavoritesOnly(true);
                                    handleNavigateSection('archive', 'collection');
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
                      minh email. Hãy xác nhận hộp thư để lưu yêu thích, đăng
                      bài, bình luận và chỉnh sửa hồ sơ.
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
                SECTION ROUTER: FORUM | PROFILE | LIBRARY ARCHIVE
               =============================================================== */}
            <AnimatePresence mode="wait">
            {activeSection === 'forum' ? (
              <motion.div
                key="section-forum"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col"
              >
              {currentUser && !rulesAcceptanceLoaded ? (
                <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-24 text-center">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent-primary)]" />
                  <p className="mt-3 text-xs text-[var(--ink-muted)]">
                    Đang kiểm tra trạng thái nội quy diễn đàn...
                  </p>
                </div>
              ) : needsForumRulesAcceptance ? (
                <ForumRulesGate
                  theme={theme}
                  config={rulesConfig}
                  isUpdatedVersion={isUpdatedForumRulesVersion}
                  saving={savingRulesAcceptance}
                  onAccept={() => void handleAcceptForumRules()}
                  onBackToArchive={() => handleNavigateSection('archive')}
                />
              ) : (
                <ForumSection
                  theme={theme}
                  currentUser={currentUser}
                  isAdmin={isAdmin}
                  posts={forumPosts}
                  comments={forumComments}
                  likes={forumLikes}
                  publicProfiles={publicProfiles}
                  ownRestriction={ownRestriction}
                  ownViolations={ownViolations}
                  loading={forumLoading}
                  selectedPostId={selectedForumPostId}
                  highlightCommentId={highlightCommentId}
                  composerOpen={forumComposerOpen}
                  onSelectPost={(postId) => {
                    setSelectedForumPostId(postId);
                    if (!postId) setHighlightCommentId(null);
                  }}
                  onComposerOpenChange={setForumComposerOpen}
                  onToggleLike={handleToggleForumLike}
                  onRequireLogin={handleRequireForumLogin}
                  onOpenProfileStatus={() =>
                    handleNavigateSection('profile', 'profile-account-standing')
                  }
                  onTriggerWarning={(warning) => setActiveWarning(warning)}
                  onNotify={showToast}
                />
              )}
              </motion.div>
            ) : activeSection === 'profile' && currentUser ? (
              <motion.div
                key="section-profile"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col"
              >
              <ProfileSettingsView
                theme={theme}
                currentUser={currentUser}
                ownRestriction={ownRestriction}
                ownViolations={ownViolations}
                publicProfiles={publicProfiles}
                onProfileUpdated={(updated) => setCurrentUser(updated)}
                onBack={() =>
                  handleNavigateSection(previousSectionRef.current || 'archive')
                }
                onNotify={showToast}
              />
              </motion.div>
            ) : (
              <motion.div
                key="section-archive"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col"
              >
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
                    className="theme-card mt-10 flex flex-col items-center justify-center border border-dashed border-[var(--border-strong)]/60 bg-[var(--bg-surface)]/80 px-6 py-16 text-center"
                  >
                    <p className="font-mono-archive text-xs tracking-[0.2em] text-[var(--ink-muted)] uppercase">
                      {characters.length === 0
                        ? 'Thư viện đang sẵn sàng'
                        : 'Không tìm thấy hồ sơ phù hợp'}
                    </p>
                    <h3 className="font-editorial mt-2 text-3xl font-semibold text-[var(--ink-primary)]">
                      {characters.length === 0
                        ? 'Thư viện hiện chưa có nhân vật nào'
                        : favoritesOnly
                          ? 'Bạn chưa lưu nhân vật yêu thích nào'
                          : 'Chưa có nhân vật nào khớp với bộ lọc hiện tại'}
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-[var(--ink-secondary)]">
                      {characters.length === 0
                        ? isAdmin
                          ? 'Hãy mở Trung tâm quản trị để thêm hồ sơ nhân vật đầu tiên vào kho lưu trữ của bạn.'
                          : 'Các hồ sơ nhân vật sẽ được hiển thị tại đây ngay khi được đăng tải.'
                        : favoritesOnly
                          ? 'Nhấn biểu tượng trái tim trên bất kỳ thẻ nhân vật nào để cất vào danh sách yêu thích riêng của bạn nhé.'
                          : 'Hãy thử xóa từ khóa tìm kiếm hoặc chọn thể loại khác để tiếp tục khám phá thư viện.'}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      {hasActiveFilters && characters.length > 0 && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="theme-control btn-tactile h-10 border border-[var(--border-strong)] px-5 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)]"
                        >
                          Xem lại toàn bộ thư viện
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openAdminCenter('form', null)}
                          className="theme-control btn-tactile h-10 bg-[var(--accent-primary)] px-5 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)]"
                        >
                          {characters.length === 0
                            ? 'Thêm nhân vật đầu tiên'
                            : 'Thêm nhân vật mới'}
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
                      <button
                        type="button"
                        onClick={() => handleNavigateSection('forum')}
                        className="theme-control inline-flex h-10 items-center gap-1.5 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Mở Diễn đàn</span>
                      </button>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Background Music Player (always accessible once inside main archive) */}
      {stage === 'main' && <MusicPlayer snapshot={musicSnapshot} />}

      {/* Floating Important Admin Pinned Post Popup (bottom-left, non-intrusive) */}
      <AnimatePresence>
        {stage === 'main' &&
          (!adminView.open || !isAdmin) &&
          activePopupAnnouncement && (
            <ImportantAnnouncementPopup
              key={activePopupAnnouncement.id}
              theme={theme}
              announcement={activePopupAnnouncement}
              onOpenPost={(postId) =>
                handleOpenImportantAnnouncementPost(
                  postId,
                  activePopupAnnouncement.id
                )
              }
              onDismiss={handleDismissAnnouncement}
            />
          )}
      </AnimatePresence>

      {/* Subtle Back-to-Top Floating Button (auto-hides when Important Popup occupies bottom-left) */}
      <AnimatePresence>
        {stage === 'main' &&
          !adminView.open &&
          showBackToTop &&
          !activePopupAnnouncement && (
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

      {/* Cute-Yet-Serious Content Moderation Warning Modal (above Forum composer/detail) */}
      <AnimatePresence>
        {activeWarning && (
          <ModerationWarningModal
            theme={theme}
            warning={activeWarning}
            onEditContent={() => setActiveWarning(null)}
            onClose={() => setActiveWarning(null)}
            onSubmitAppeal={handleSubmitWarningAppeal}
          />
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

      {/* Guest Login Prompt Modal (triggered only when Guest clicks member-only feature) */}
      <AnimatePresence>
        {loginPromptOpen && !currentUser && (
          <LoginPromptModal
            theme={theme}
            reason={
              pendingGuestAction?.type === 'forum_compose'
                ? 'Vui lòng đăng nhập để tạo bài đăng mới trên diễn đàn. Sau khi đăng nhập, bạn sẽ quay lại đúng trang diễn đàn đang xem.'
                : pendingGuestAction?.type === 'forum_comment'
                  ? 'Vui lòng đăng nhập để bình luận hoặc trả lời bài viết. Sau khi đăng nhập, bạn sẽ quay lại đúng bài viết đang xem.'
                  : pendingGuestAction?.type === 'forum_like'
                    ? 'Vui lòng đăng nhập để thích bài viết trên diễn đàn. Sau khi đăng nhập, lượt thích của bạn sẽ được tự động cập nhật.'
                    : 'Hãy đăng nhập hoặc tạo tài khoản để tiếp tục. Sau khi đăng nhập, bạn sẽ quay lại đúng trang đang xem.'
            }
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

      {/* Login / Register Modal (never rendered while already signed in) */}
      <AnimatePresence>
        {authModal.open && !currentUser && (
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
