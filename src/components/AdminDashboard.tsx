import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Cloud,
  Database,
  Eye,
  FolderKanban,
  ImagePlus,
  LayoutDashboard,
  Music,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../lib/firebase';
import {
  createCategoryAdmin,
  deleteCategoryAdmin,
  deleteCharacterAdmin,
  fetchAllUsersAdmin,
  renameCategoryAdmin,
  sanitizeRecordId,
  saveCharacterAdmin,
  setUserRoleAdmin,
} from '../services/archiveService';
import type {
  AdminAuditLog,
  CategoryRecord,
  CharacterRecord,
  ForumPost,
  ForumRulesConfig,
  ForumViolation,
  GalleryItem,
  MusicTrack,
  PublicUserProfile,
  ThemeMode,
  UserProfile,
  UserRestriction,
} from '../types/archive';
import { compressImageFile } from '../utils/imageCompressor';
import { sfx } from '../utils/sfxEngine';
import { AdminModerationSection } from './AdminModerationSection';
import { BrandWordmark } from './BrandWordmark';
import { DriveBackupSection } from './DriveBackupSection';
import { MusicManagerSection } from './MusicManagerSection';

export type AdminTab =
  | 'overview'
  | 'characters'
  | 'form'
  | 'categories'
  | 'music'
  | 'moderation'
  | 'users'
  | 'drive';

interface AdminDashboardProps {
  theme: ThemeMode;
  adminUser: UserProfile;
  characters: CharacterRecord[];
  categories: CategoryRecord[];
  galleryItems: GalleryItem[];
  tracks: MusicTrack[];
  violations: ForumViolation[];
  restrictions: Record<string, UserRestriction>;
  auditLogs: AdminAuditLog[];
  forumPosts: ForumPost[];
  publicProfiles: Record<string, PublicUserProfile>;
  rulesConfig: ForumRulesConfig;
  initialTab?: AdminTab;
  editingCharacter?: CharacterRecord | null;
  onBackToArchive: () => void;
  onInspectCharacter: (character: CharacterRecord) => void;
  onInspectForumPost: (postId: string) => void;
  onNotify: (message: string) => void;
}

export function AdminDashboard({
  theme,
  adminUser,
  characters,
  categories,
  galleryItems,
  tracks,
  violations,
  restrictions,
  auditLogs,
  forumPosts,
  publicProfiles,
  rulesConfig,
  initialTab = 'overview',
  editingCharacter = null,
  onBackToArchive,
  onInspectCharacter,
  onInspectForumPost,
  onNotify,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(
    editingCharacter ? 'form' : initialTab
  );

  useEffect(() => {
    setActiveTab(editingCharacter ? 'form' : initialTab);
  }, [initialTab, editingCharacter]);
  const [accounts, setAccounts] = useState<UserProfile[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Character list search & delete confirm
  const [charSearch, setCharSearch] = useState('');
  const [pendingDeleteChar, setPendingDeleteChar] =
    useState<CharacterRecord | null>(null);

  // Add / Edit Character form state
  const [editingTarget, setEditingTarget] = useState<CharacterRecord | null>(
    editingCharacter
  );
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formGenre, setFormGenre] = useState(categories[0]?.name || 'Khác');
  const [formTags, setFormTags] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPlot, setFormPlot] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formLinkLabel, setFormLinkLabel] = useState('Mở hồ sơ nhân vật');
  const [formPinned, setFormPinned] = useState(false);
  const [formError, setFormError] = useState('');
  const [savingChar, setSavingChar] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Category management state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingCatId, setRenamingCatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [pendingDeleteCat, setPendingDeleteCat] =
    useState<CategoryRecord | null>(null);
  const [replacementGenre, setReplacementGenre] = useState('Khác');
  const [catBusy, setCatBusy] = useState(false);

  const nextSuggestedId = useMemo(() => {
    const maxNum = characters.reduce((acc, c) => {
      const m = c.id.match(/(\d+)$/);
      return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
    }, 0);
    return `ARC-${String(maxNum + 1).padStart(3, '0')}`;
  }, [characters]);

  // Load real user accounts from Firestore
  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const list = await fetchAllUsersAdmin();
      setAccounts(list);
    } catch {
      // Handled by service
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  // Populate character form whenever editingTarget changes
  useEffect(() => {
    if (editingTarget) {
      setFormId(editingTarget.id);
      setFormName(editingTarget.name);
      setFormSubtitle(editingTarget.subtitle);
      setFormImage(editingTarget.image);
      setFormGenre(editingTarget.genre || categories[0]?.name || 'Khác');
      setFormTags(editingTarget.tags.join(', '));
      setFormDesc(editingTarget.description);
      setFormPlot(editingTarget.plot);
      setFormLink(editingTarget.link);
      setFormLinkLabel(editingTarget.linkLabel || 'Mở hồ sơ nhân vật');
      setFormPinned(Boolean(editingTarget.pinned));
      setFormError('');
      setShowPreview(false);
    } else {
      setFormId(nextSuggestedId);
      setFormName('');
      setFormSubtitle('');
      setFormImage('');
      setFormGenre(categories[0]?.name || 'Khác');
      setFormTags('');
      setFormDesc('');
      setFormPlot('');
      setFormLink('');
      setFormLinkLabel('Mở hồ sơ nhân vật');
      setFormPinned(false);
      setFormError('');
      setShowPreview(false);
    }
  }, [editingTarget, nextSuggestedId, categories]);

  const recentCount = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return characters.filter((c) => (c.createdAt ?? 0) >= sevenDaysAgo).length;
  }, [characters]);

  const filteredChars = useMemo(() => {
    const q = charSearch.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter((c) =>
      [c.id, c.name, c.subtitle, c.genre, ...c.tags]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [characters, charSearch]);

  const handleUploadPortrait = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError('');
    try {
      const dataUrl = await compressImageFile(file);
      setFormImage(dataUrl);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể xử lý ảnh đại diện.'
      );
    }
  };

  const handleSubmitCharacter = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên nhân vật.');
      return;
    }

    const parsedTags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const record: CharacterRecord = {
      id: sanitizeRecordId(formId || nextSuggestedId),
      name: formName.trim(),
      subtitle: formSubtitle.trim() || 'Hồ sơ nhân vật lưu trữ',
      image: formImage.trim(),
      genre: formGenre.trim() || 'Khác',
      tags: parsedTags,
      description: formDesc.trim(),
      plot: formPlot.trim(),
      link: formLink.trim(),
      linkLabel: formLinkLabel.trim() || 'Mở hồ sơ nhân vật',
      pinned: formPinned,
    };

    setSavingChar(true);
    try {
      await saveCharacterAdmin(
        record,
        adminUser.uid,
        Boolean(editingTarget),
        editingTarget?.id
      );
      sfx.play('welcomeClick');
      onNotify(
        editingTarget
          ? `Đã cập nhật hồ sơ "${record.name}".`
          : `Đã lưu nhân vật "${record.name}" vào thư viện.`
      );
      setEditingTarget(null);
      setActiveTab('characters');
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Không thể lưu hồ sơ nhân vật. Vui lòng kiểm tra quyền quản trị.'
      );
    } finally {
      setSavingChar(false);
    }
  };

  const handleConfirmDeleteChar = async () => {
    if (!pendingDeleteChar) return;
    const target = pendingDeleteChar;
    try {
      await deleteCharacterAdmin(target.id);
      sfx.play('close');
      onNotify(`Đã xóa nhân vật "${target.name}" khỏi thư viện.`);
      setPendingDeleteChar(null);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể xóa nhân vật này.'
      );
    }
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    const clean = newCategoryName.trim();
    if (!clean) return;
    if (
      categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())
    ) {
      onNotify('Thể loại này đã tồn tại trong danh sách.');
      return;
    }
    setCatBusy(true);
    try {
      await createCategoryAdmin(clean, categories.length + 1);
      sfx.play('welcomeClick');
      setNewCategoryName('');
      onNotify(`Đã thêm thể loại "${clean}".`);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể thêm thể loại.'
      );
    } finally {
      setCatBusy(false);
    }
  };

  const handleRenameCategory = async (cat: CategoryRecord) => {
    const clean = renameDraft.trim();
    if (!clean || clean === cat.name) {
      setRenamingCatId(null);
      return;
    }
    setCatBusy(true);
    try {
      const affected = characters.filter((c) => c.genre === cat.name);
      await renameCategoryAdmin(cat, clean, affected);
      sfx.play('filterSelect');
      setRenamingCatId(null);
      onNotify(
        `Đã đổi tên thể loại thành "${clean}" (${affected.length} nhân vật được đồng bộ).`
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể đổi tên thể loại.'
      );
    } finally {
      setCatBusy(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!pendingDeleteCat) return;
    setCatBusy(true);
    try {
      const affected = characters.filter(
        (c) => c.genre === pendingDeleteCat.name
      );
      await deleteCategoryAdmin(pendingDeleteCat, replacementGenre, affected);
      sfx.play('close');
      onNotify(
        affected.length > 0
          ? `Đã xóa thể loại "${pendingDeleteCat.name}" và chuyển ${affected.length} nhân vật sang "${replacementGenre}".`
          : `Đã xóa thể loại "${pendingDeleteCat.name}".`
      );
      setPendingDeleteCat(null);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể xóa thể loại này.'
      );
    } finally {
      setCatBusy(false);
    }
  };

  const handleToggleAccountRole = async (target: UserProfile) => {
    if (
      target.uid === adminUser.uid ||
      target.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
    ) {
      return;
    }
    const nextRole = target.role === 'admin' ? 'user' : 'admin';
    try {
      await setUserRoleAdmin(target.uid, nextRole, adminUser.uid);
      sfx.play('themeSwitch');
      onNotify(
        nextRole === 'admin'
          ? `Đã cấp quyền Quản trị viên cho ${target.displayName}.`
          : `Đã chuyển ${target.displayName} về vai trò Thành viên.`
      );
      await loadAccounts();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể cập nhật quyền tài khoản.'
      );
    }
  };

  const inputClass =
    'theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]';

  const pendingModerationCount = useMemo(
    () =>
      violations.filter(
        (v) => v.status === 'unread' || v.appealStatus === 'pending'
      ).length,
    [violations]
  );

  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }> = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'characters', label: 'Quản lý nhân vật', icon: FolderKanban },
    {
      id: 'form',
      label: editingTarget ? 'Chỉnh sửa nhân vật' : 'Thêm nhân vật',
      icon: Plus,
    },
    { id: 'categories', label: 'Quản lý thể loại', icon: Database },
    { id: 'music', label: 'Quản lý nhạc', icon: Music },
    {
      id: 'moderation',
      label: 'Vi phạm & Nội quy',
      icon: ShieldAlert,
      badge: pendingModerationCount,
    },
    { id: 'users', label: 'Quản lý tài khoản', icon: Users },
    { id: 'drive', label: 'Google Drive', icon: Cloud },
  ];

  const affectedByDeleteCat = pendingDeleteCat
    ? characters.filter((c) => c.genre === pendingDeleteCat.name)
    : [];

  return (
    <div className="theme-surface archive-backdrop-light min-h-screen bg-[var(--bg-canvas)] pb-24 text-[var(--ink-primary)]">
      {/* Top Admin Header */}
      <header className="theme-surface sticky top-0 z-30 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => {
                sfx.play('close');
                onBackToArchive();
              }}
              className="theme-control inline-flex h-9 shrink-0 items-center gap-1.5 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Về thư viện</span>
            </button>
            <div className="hidden truncate sm:block">
              <BrandWordmark theme={theme} size="sm" showArchiveSuffix={false} />
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <Shield className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
            <span className="font-mono-archive font-semibold tracking-wider whitespace-nowrap uppercase">
              TRUNG TÂM QUẢN TRỊ
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
        {/* Heading + Tab Strip */}
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-6 md:flex-row md:items-end">
          <div>
            <p className="font-mono-archive text-[11px] tracking-[0.2em] text-[var(--accent-primary)] uppercase">
              TRUNG TÂM QUẢN TRỊ · XÁC THỰC MÁY CHỦ
            </p>
            <h1 className="font-editorial mt-1.5 text-4xl font-semibold tracking-tight">
              Quản lý xocyberluv’s character archive
            </h1>
            <p className="mt-1.5 text-sm text-[var(--ink-secondary)]">
              Đăng nhập quản trị: <strong>{adminUser.displayName}</strong> (
              {adminUser.email})
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          aria-label="Mục quản trị"
          className="mt-6 flex flex-wrap items-center gap-2 border-b border-[var(--border-hairline)] pb-4"
        >
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  sfx.play('filterSelect');
                  if (tab.id === 'form' && activeTab !== 'form') {
                    setEditingTarget(null);
                  }
                  setActiveTab(tab.id);
                }}
                className={`theme-control inline-flex h-10 items-center gap-2 px-4 text-xs font-semibold whitespace-nowrap ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)] shadow-sm'
                    : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono-archive text-[10px] font-bold leading-none ${
                      active
                        ? 'bg-[var(--accent-ink)]/20 text-[var(--accent-ink)]'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* ================================================================
            QUẢN LÝ VI PHẠM, KHIẾU NẠI & NỘI QUY DIỄN ĐÀN — ADMIN
           ================================================================ */}
        {activeTab === 'moderation' && (
          <div className="mt-8">
            <AdminModerationSection
              theme={theme}
              adminUser={adminUser}
              violations={violations}
              restrictions={restrictions}
              auditLogs={auditLogs}
              forumPosts={forumPosts}
              publicProfiles={publicProfiles}
              rulesConfig={rulesConfig}
              onInspectForumPost={onInspectForumPost}
              onNotify={onNotify}
            />
          </div>
        )}

        {/* ================================================================
            QUẢN LÝ THƯ VIỆN NHẠC — ADMIN
           ================================================================ */}
        {activeTab === 'music' && (
          <div className="mt-8">
            <MusicManagerSection
              adminUid={adminUser.uid}
              tracks={tracks}
              onNotify={onNotify}
            />
          </div>
        )}

        {/* ================================================================
            GOOGLE DRIVE BACKUP & SYNC TAB
           ================================================================ */}
        {activeTab === 'drive' && (
          <div className="mt-8">
            <DriveBackupSection
              adminUid={adminUser.uid}
              characters={characters}
              categories={categories}
              galleryItems={galleryItems}
              onNotify={onNotify}
            />
          </div>
        )}

        {/* ================================================================
            TAB 1: TỔNG QUAN (DASHBOARD)
           ================================================================ */}
        {activeTab === 'overview' && (
          <div className="mt-8 space-y-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                <p className="font-mono-archive text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
                  Tổng số nhân vật
                </p>
                <p className="font-editorial mt-2 text-4xl font-semibold tabular-nums text-[var(--ink-primary)]">
                  {characters.length}
                </p>
                <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                  Đồng bộ trực tiếp từ Firestore
                </p>
              </div>

              <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                <p className="font-mono-archive text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
                  Tổng số thể loại
                </p>
                <p className="font-editorial mt-2 text-4xl font-semibold tabular-nums text-[var(--ink-primary)]">
                  {categories.length}
                </p>
                <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                  Danh mục lọc đang hoạt động
                </p>
              </div>

              <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                <p className="font-mono-archive text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
                  Tổng số tài khoản
                </p>
                <p className="font-editorial mt-2 text-4xl font-semibold tabular-nums text-[var(--ink-primary)]">
                  {loadingAccounts ? '—' : accounts.length}
                </p>
                <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                  Thành viên &amp; quản trị viên đã xác minh
                </p>
              </div>

              <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                <p className="font-mono-archive text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
                  Mới thêm (7 ngày qua)
                </p>
                <p className="font-editorial mt-2 text-4xl font-semibold tabular-nums text-[var(--accent-primary)]">
                  {recentCount}
                </p>
                <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                  Hồ sơ mới cập nhật gần đây
                </p>
              </div>
            </div>

            {/* Music Library Quick Summary Banner */}
            <div className="theme-card flex flex-col justify-between gap-4 border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3.5">
                <div className="theme-control flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <Music className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-mono-archive text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
                    Thư viện nhạc nền website
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--ink-primary)]">
                    {tracks.length > 0
                      ? `Đang có ${tracks.length} bài hát được đồng bộ vào trình phát nhạc.`
                      : 'Hiện chưa có bài hát nào trong danh sách phát.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sfx.play('filterSelect');
                  setActiveTab('music');
                }}
                className="theme-control inline-flex h-9 shrink-0 items-center gap-1.5 border border-[var(--border-strong)] px-4 text-xs font-semibold whitespace-nowrap text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
              >
                <Music className="h-3.5 w-3.5" />
                <span>Mở Quản lý nhạc</span>
              </button>
            </div>

            {/* Recently Added Characters */}
            <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-4">
                <h2 className="font-editorial text-2xl font-semibold">
                  Nhân vật mới cập nhật gần đây
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTarget(null);
                    setActiveTab('form');
                  }}
                  className="theme-control inline-flex h-9 items-center gap-1.5 bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm nhân vật</span>
                </button>
              </div>

              <div className="mt-4 divide-y divide-[var(--border-hairline)]">
                {characters.slice(0, 5).map((char) => (
                  <div
                    key={char.id}
                    className="flex items-center justify-between gap-4 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className="theme-control h-12 w-10 shrink-0 overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
                        {char.image && (
                          <img
                            src={char.image}
                            alt={char.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover object-top"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--ink-primary)]">
                          {char.name}
                        </p>
                        <p className="truncate text-xs text-[var(--ink-muted)]">
                          {char.id} · {char.genre} · {char.subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTarget(char);
                          setActiveTab('form');
                        }}
                        className="theme-control h-8 border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                      >
                        Sửa
                      </button>
                    </div>
                  </div>
                ))}
                {characters.length === 0 && (
                  <div className="py-8 text-center text-sm text-[var(--ink-muted)]">
                    Chưa có nhân vật nào trong cơ sở dữ liệu. Hãy nhấn “Thêm nhân vật” để tạo hồ sơ đầu tiên.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 2: QUẢN LÝ NHÂN VẬT
           ================================================================ */}
        {activeTab === 'characters' && (
          <div className="mt-8 space-y-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
                <input
                  type="search"
                  value={charSearch}
                  onChange={(e) => setCharSearch(e.target.value)}
                  placeholder="Tìm kiếm nhân vật theo tên, mã, tag..."
                  className={`${inputClass} pl-10`}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  sfx.play('openCharacter');
                  setEditingTarget(null);
                  setActiveTab('form');
                }}
                className="theme-control inline-flex h-10 items-center justify-center gap-2 bg-[var(--accent-primary)] px-4 text-xs font-semibold tracking-wider whitespace-nowrap text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm nhân vật mới</span>
              </button>
            </div>

            <div className="theme-card overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <div className="divide-y divide-[var(--border-hairline)]">
                {filteredChars.map((char) => (
                  <div
                    key={char.id}
                    className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="theme-control h-16 w-12 shrink-0 overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
                        {char.image && (
                          <img
                            src={char.image}
                            alt={char.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover object-top"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--ink-muted)]">
                          <span className="font-mono-archive">{char.id}</span>
                          <span>·</span>
                          <span>{char.genre}</span>
                          {char.pinned && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-[var(--accent-primary)]">
                                Nổi bật
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="font-editorial truncate text-2xl font-semibold text-[var(--ink-primary)]">
                          {char.name}
                        </h3>
                        <p className="truncate text-xs text-[var(--ink-secondary)]">
                          {char.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onInspectCharacter(char)}
                        className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Xem</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.play('filterSelect');
                          setEditingTarget(char);
                          setActiveTab('form');
                        }}
                        className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Chỉnh sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.play('filterSelect');
                          setPendingDeleteChar(char);
                        }}
                        className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--ink-muted)] hover:border-red-500/60 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                ))}

                {filteredChars.length === 0 && (
                  <div className="p-10 text-center text-sm text-[var(--ink-muted)]">
                    {characters.length === 0
                      ? 'Chưa có hồ sơ nhân vật nào được lưu. Nhấn “Thêm nhân vật mới” để bắt đầu.'
                      : 'Không tìm thấy nhân vật nào khớp với từ khóa.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 3: THÊM / CHỈNH SỬA NHÂN VẬT (CÓ XEM TRƯỚC)
           ================================================================ */}
        {activeTab === 'form' && (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <form
              onSubmit={handleSubmitCharacter}
              className={`theme-card space-y-5 border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 ${
                showPreview ? 'lg:col-span-7' : 'lg:col-span-12'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
                <div>
                  <p className="font-mono-archive text-[11px] tracking-widest text-[var(--ink-muted)] uppercase">
                    {editingTarget
                      ? `Đang chỉnh sửa ${editingTarget.id}`
                      : 'Tạo hồ sơ mới'}
                  </p>
                  <h2 className="font-editorial text-3xl font-semibold">
                    {editingTarget ? 'Chỉnh sửa hồ sơ nhân vật' : 'Thêm nhân vật mới'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('filterSelect');
                    setShowPreview((v) => !v);
                  }}
                  className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-strong)] px-3.5 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{showPreview ? 'Ẩn xem trước' : 'Xem trước'}</span>
                </button>
              </div>

              {formError && (
                <div className="theme-control border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-500">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                    Mã hồ sơ (ID)
                  </label>
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="ARC-001"
                    className={`${inputClass} font-mono-archive`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                    Tên nhân vật *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Nhập tên nhân vật..."
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                  Dòng phụ / Biệt danh
                </label>
                <input
                  type="text"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="Dòng giới thiệu ngắn về nhân vật..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                  Ảnh đại diện (URL hoặc tải ảnh lên)
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    placeholder="https://... hoặc tải ảnh từ thiết bị"
                    className={`${inputClass} flex-1`}
                  />
                  <label className="theme-control inline-flex h-[42px] cursor-pointer items-center justify-center gap-2 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]">
                    <ImagePlus className="h-4 w-4" />
                    <span>Tải ảnh lên</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadPortrait}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                    Thể loại
                  </label>
                  <select
                    value={formGenre}
                    onChange={(e) => setFormGenre(e.target.value)}
                    className={inputClass}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                    {!categories.some((c) => c.name === formGenre) && formGenre && (
                      <option value={formGenre}>{formGenre}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                    Tag (cách nhau bởi dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="Romance, Angst, Slow Burn"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                  Mô tả ngắn
                </label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Tóm tắt tính cách, ấn tượng ban đầu về nhân vật..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                  Cốt truyện (ngăn cách đoạn bằng dòng trống)
                </label>
                <textarea
                  rows={6}
                  value={formPlot}
                  onChange={(e) => setFormPlot(e.target.value)}
                  placeholder="Viết cốt truyện chi tiết, bối cảnh hoặc lời mở đầu..."
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                    Liên kết nhân vật (URL)
                  </label>
                  <input
                    type="text"
                    value={formLink}
                    onChange={(e) => setFormLink(e.target.value)}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                    Nhãn nút liên kết
                  </label>
                  <input
                    type="text"
                    value={formLinkLabel}
                    onChange={(e) => setFormLinkLabel(e.target.value)}
                    placeholder="Mở hồ sơ nhân vật"
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--ink-secondary)]">
                <input
                  type="checkbox"
                  checked={formPinned}
                  onChange={(e) => setFormPinned(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-primary)]"
                />
                <span>Đánh dấu là nhân vật nổi bật trên thư viện</span>
              </label>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-hairline)] pt-5">
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('close');
                    setEditingTarget(null);
                    setActiveTab('characters');
                  }}
                  className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('filterSelect');
                    setShowPreview((v) => !v);
                  }}
                  className="theme-control h-10 border border-[var(--border-strong)] px-4 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)]"
                >
                  {showPreview ? 'Đóng xem trước' : 'Xem trước'}
                </button>
                <button
                  type="submit"
                  disabled={savingChar}
                  className="theme-control h-10 bg-[var(--accent-primary)] px-6 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {savingChar ? 'Đang lưu...' : 'Lưu nhân vật'}
                </button>
              </div>
            </form>

            {/* Live Preview Panel */}
            {showPreview && (
              <aside className="lg:col-span-5">
                <div className="theme-card sticky top-24 overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-surface)]">
                  <div className="border-b border-[var(--border-hairline)] px-5 py-3">
                    <p className="font-mono-archive text-[11px] tracking-widest text-[var(--accent-primary)] uppercase">
                      Xem trước hiển thị thẻ &amp; hồ sơ
                    </p>
                  </div>
                  <div className="p-5">
                    <div className="theme-card relative aspect-[3/4] w-full overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
                      {formImage ? (
                        <img
                          src={formImage}
                          alt={formName || 'Xem trước'}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-6 text-center text-xs text-[var(--ink-muted)]">
                          Chưa chọn ảnh đại diện
                        </div>
                      )}
                    </div>

                    <p className="font-mono-archive mt-4 text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
                      {formId || nextSuggestedId} · {formGenre}
                    </p>
                    <h3 className="font-editorial mt-1 text-3xl font-semibold text-[var(--ink-primary)]">
                      {formName || 'Tên nhân vật mẫu'}
                    </h3>
                    <p className="font-editorial text-lg italic text-[var(--ink-secondary)]">
                      {formSubtitle || 'Dòng mô tả phụ'}
                    </p>
                    {formDesc && (
                      <p className="mt-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
                        {formDesc}
                      </p>
                    )}
                    {formTags.trim() && (
                      <p className="mt-3 border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--ink-muted)]">
                        {formTags
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 4: QUẢN LÝ THỂ LOẠI
           ================================================================ */}
        {activeTab === 'categories' && (
          <div className="mt-8 space-y-6">
            <form
              onSubmit={handleAddCategory}
              className="theme-card flex flex-col gap-3 border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:flex-row"
            >
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nhập tên thể loại mới (vd: Cổ trang, Học đường, Sci-Fi...)"
                className={`${inputClass} flex-1`}
              />
              <button
                type="submit"
                disabled={catBusy || !newCategoryName.trim()}
                className="theme-control inline-flex h-11 shrink-0 items-center justify-center gap-2 bg-[var(--accent-primary)] px-5 text-xs font-semibold tracking-wider whitespace-nowrap text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                <span>Thêm thể loại</span>
              </button>
            </form>

            <div className="theme-card divide-y divide-[var(--border-hairline)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              {categories.map((cat) => {
                const count = characters.filter(
                  (c) => c.genre === cat.name
                ).length;
                const isRenaming = renamingCatId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            className={`${inputClass} max-w-xs py-1.5`}
                          />
                          <button
                            type="button"
                            disabled={catBusy}
                            onClick={() => handleRenameCategory(cat)}
                            aria-label="Lưu tên mới"
                            className="theme-control flex h-9 w-9 items-center justify-center bg-[var(--accent-primary)] text-[var(--accent-ink)]"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingCatId(null)}
                            aria-label="Hủy đổi tên"
                            className="theme-control flex h-9 w-9 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-[var(--ink-primary)]">
                            {cat.name}
                          </p>
                          <p className="font-mono-archive mt-0.5 text-xs text-[var(--ink-muted)]">
                            {count} nhân vật đang sử dụng
                          </p>
                        </>
                      )}
                    </div>

                    {!isRenaming && (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingCatId(cat.id);
                            setRenameDraft(cat.name);
                          }}
                          className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Đổi tên</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const fallback =
                              categories.find((c) => c.id !== cat.id)?.name ||
                              'Khác';
                            setReplacementGenre(fallback);
                            setPendingDeleteCat(cat);
                          }}
                          className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--ink-muted)] hover:border-red-500/60 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 5: QUẢN LÝ TÀI KHOẢN
           ================================================================ */}
        {activeTab === 'users' && (
          <div className="mt-8 space-y-5">
            <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 text-xs leading-relaxed text-[var(--ink-secondary)]">
              <strong className="text-[var(--ink-primary)]">
                Bảo mật phân quyền máy chủ:
              </strong>{' '}
              Quyền <strong>Quản trị viên</strong> được kiểm tra trực tiếp bởi
              Firestore Security Rules. Tài khoản đăng ký mới luôn mặc định là{' '}
              <strong>Thành viên</strong> và không thể tự nâng cấp quyền từ trình
              duyệt.
            </div>

            <div className="theme-card divide-y divide-[var(--border-hairline)] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              {loadingAccounts ? (
                <div className="p-8 text-center text-sm text-[var(--ink-muted)]">
                  Đang tải danh sách tài khoản...
                </div>
              ) : accounts.length === 0 ? (
                <div className="p-8 text-center text-sm text-[var(--ink-muted)]">
                  Chưa có tài khoản nào được lưu trong cơ sở dữ liệu.
                </div>
              ) : (
                accounts.map((acc) => {
                  const isOwnerAdmin =
                    acc.email.toLowerCase() ===
                    BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
                  const isSelf = acc.uid === adminUser.uid;
                  return (
                    <div
                      key={acc.uid}
                      className="flex flex-col justify-between gap-4 px-5 py-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-primary)]">
                          {acc.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--ink-primary)]">
                            {acc.displayName}{' '}
                            <span className="font-mono-archive text-xs font-normal text-[var(--ink-muted)]">
                              @{acc.username}
                            </span>
                          </p>
                          <p className="truncate text-xs text-[var(--ink-secondary)]">
                            {acc.email} ·{' '}
                            <strong className="text-[var(--accent-primary)]">
                              {acc.role === 'admin'
                                ? 'Quản trị viên'
                                : 'Thành viên'}
                            </strong>
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isOwnerAdmin || isSelf ? (
                          <span className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                            {isOwnerAdmin ? 'Quản trị viên chính' : 'Tài khoản hiện tại'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleAccountRole(acc)}
                            className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-strong)] px-3.5 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>
                              {acc.role === 'admin'
                                ? 'Chuyển về Thành viên'
                                : 'Cấp quyền Quản trị'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Character Confirmation Dialog */}
      <AnimatePresence>
        {pendingDeleteChar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            onClick={() => setPendingDeleteChar(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="theme-surface theme-panel w-full max-w-md border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <h3 className="font-editorial text-2xl font-semibold">
                    Xác nhận xóa nhân vật?
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
                    Bạn sắp xóa vĩnh viễn hồ sơ{' '}
                    <strong>{pendingDeleteChar.name}</strong> (
                    {pendingDeleteChar.id}). Thao tác này không thể hoàn tác.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPendingDeleteChar(null)}
                  className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteChar}
                  className="theme-control h-10 bg-red-600 px-5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Xóa nhân vật
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Category Warning & Migration Dialog */}
      <AnimatePresence>
        {pendingDeleteCat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            onClick={() => setPendingDeleteCat(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="theme-surface theme-panel w-full max-w-md border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <h3 className="font-editorial text-2xl font-semibold">
                    Xóa thể loại “{pendingDeleteCat.name}”?
                  </h3>
                  {affectedByDeleteCat.length > 0 ? (
                    <div className="mt-2 space-y-3 text-sm text-[var(--ink-secondary)]">
                      <p>
                        Cảnh báo: Hiện có{' '}
                        <strong>{affectedByDeleteCat.length} nhân vật</strong>{' '}
                        đang sử dụng thể loại này. Vui lòng chọn thể loại thay
                        thế để tự động cập nhật cho các nhân vật liên quan:
                      </p>
                      <select
                        value={replacementGenre}
                        onChange={(e) => setReplacementGenre(e.target.value)}
                        className={inputClass}
                      >
                        {categories
                          .filter((c) => c.id !== pendingDeleteCat.id)
                          .map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--ink-secondary)]">
                      Chưa có nhân vật nào dùng thể loại này. Bạn có chắc muốn
                      xóa không?
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPendingDeleteCat(null)}
                  className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={catBusy}
                  onClick={handleDeleteCategory}
                  className="theme-control h-10 bg-red-600 px-5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {catBusy ? 'Đang xử lý...' : 'Xác nhận xóa'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
