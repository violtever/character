import { useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileWarning,
  History,
  Loader2,
  Megaphone,
  Pin,
  Plus,
  RotateCcw,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  applyUserRestrictionAdmin,
  formatDeadlineVi,
  getActiveRestrictionState,
  logAdminAuditAction,
  updateForumRulesConfigAdmin,
  updateViolationStatusAdmin,
} from '../services/moderationService';
import { updateForumPostModerationAdmin } from '../services/forumService';
import {
  deactivateImportantPostAnnouncementAdmin,
  publishImportantPostAnnouncementAdmin,
} from '../services/notificationService';
import type {
  AdminAuditLog,
  ForumPost,
  ForumRulesConfig,
  ForumViolation,
  ModerationSeverity,
  PublicUserProfile,
  ThemeMode,
  UserProfile,
  UserRestriction,
  ViolationStatus,
} from '../types/archive';
import { formatRelativeVietnameseTime } from './ForumPostDetailModal';
import { sfx } from '../utils/sfxEngine';

type SubTab = 'violations' | 'important_rules' | 'audit';
type ViolationFilter =
  | 'all'
  | 'unread'
  | 'reviewing'
  | 'appeals'
  | 'high_strikes'
  | 'resolved'
  | 'dismissed';
type ViolationSort = 'newest' | 'strikes' | 'severity';

interface AdminModerationSectionProps {
  theme: ThemeMode;
  adminUser: UserProfile;
  violations: ForumViolation[];
  restrictions: Record<string, UserRestriction>;
  auditLogs: AdminAuditLog[];
  forumPosts: ForumPost[];
  publicProfiles: Record<string, PublicUserProfile>;
  rulesConfig: ForumRulesConfig;
  onInspectForumPost: (postId: string) => void;
  onNotify: (msg: string) => void;
}

const SEVERITY_RANK: Record<ModerationSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function severityLabelVi(s: ModerationSeverity): string {
  if (s === 'high') return 'Nghiêm trọng';
  if (s === 'medium') return 'Trung bình';
  return 'Nhẹ';
}

function statusLabelVi(s: ViolationStatus): string {
  if (s === 'unread') return 'Chưa xem';
  if (s === 'reviewing') return 'Đang xem xét';
  if (s === 'resolved') return 'Đã xử lý';
  return 'Đã bỏ qua';
}

export function AdminModerationSection({
  adminUser,
  violations,
  restrictions,
  auditLogs,
  forumPosts,
  publicProfiles,
  rulesConfig,
  onInspectForumPost,
  onNotify,
}: AdminModerationSectionProps) {
  const [subTab, setSubTab] = useState<SubTab>('violations');
  const [statusFilter, setStatusFilter] = useState<ViolationFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | ModerationSeverity>('all');
  const [sortBy, setSortBy] = useState<ViolationSort>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // User history & sanction modal
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<
    | 'manual_warning'
    | 'post_restricted'
    | 'comment_restricted'
    | 'restricted'
    | 'suspended'
    | 'lift'
  >('restricted');
  const [durationHours, setDurationHours] = useState(24);
  const [actionReason, setActionReason] = useState('');
  const [applyingAction, setApplyingAction] = useState(false);

  // Appeal resolution note modal
  const [appealTarget, setAppealTarget] = useState<{
    violation: ForumViolation;
    decision: 'approved' | 'rejected';
  } | null>(null);
  const [appealNote, setAppealNote] = useState('');

  // Forum Rules editor state
  const [rulesTitle, setRulesTitle] = useState(rulesConfig.title);
  const [rulesIntro, setRulesIntro] = useState(rulesConfig.intro);
  const [rulesItems, setRulesItems] = useState<string[]>(rulesConfig.rules);
  const [bumpRulesVersion, setBumpRulesVersion] = useState(true);
  const [savingRules, setSavingRules] = useState(false);

  // Metrics
  const unreadCount = useMemo(
    () => violations.filter((v) => v.status === 'unread').length,
    [violations]
  );
  const pendingAppealsCount = useMemo(
    () => violations.filter((v) => v.appealStatus === 'pending').length,
    [violations]
  );
  const flaggedAccounts3Plus = useMemo(
    () =>
      Object.values(restrictions).filter((r) => r.warningCount >= 3).length,
    [restrictions]
  );
  const activeRestrictedAccounts = useMemo(
    () =>
      Object.values(restrictions).filter(
        (r) => getActiveRestrictionState(r).activeUntil > Date.now()
      ).length,
    [restrictions]
  );

  const filteredViolations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return violations
      .filter((v) => {
        if (statusFilter === 'unread' && v.status !== 'unread') return false;
        if (statusFilter === 'reviewing' && v.status !== 'reviewing')
          return false;
        if (statusFilter === 'resolved' && v.status !== 'resolved')
          return false;
        if (statusFilter === 'dismissed' && v.status !== 'dismissed')
          return false;
        if (statusFilter === 'appeals' && v.appealStatus !== 'pending')
          return false;
        if (statusFilter === 'high_strikes') {
          const count = restrictions[v.userId]?.warningCount ?? v.strikeNumber;
          if (count < 3) return false;
        }
        if (severityFilter !== 'all' && v.severity !== severityFilter)
          return false;
        if (q) {
          const hay =
            `${v.userName} ${v.userUsername} ${v.flaggedText} ${v.reason}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'strikes') {
          const aCount = restrictions[a.userId]?.warningCount ?? a.strikeNumber;
          const bCount = restrictions[b.userId]?.warningCount ?? b.strikeNumber;
          if (bCount !== aCount) return bCount - aCount;
          return b.createdAt - a.createdAt;
        }
        if (sortBy === 'severity') {
          const diff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
          if (diff !== 0) return diff;
          return b.createdAt - a.createdAt;
        }
        return b.createdAt - a.createdAt;
      });
  }, [
    violations,
    restrictions,
    statusFilter,
    severityFilter,
    sortBy,
    searchQuery,
  ]);

  const inspectedUserMeta = useMemo(() => {
    if (!inspectUserId) return null;
    const live = publicProfiles[inspectUserId];
    const sampleVio = violations.find((v) => v.userId === inspectUserId);
    const restr = restrictions[inspectUserId] ?? null;
    const history = violations.filter((v) => v.userId === inspectUserId);
    return {
      uid: inspectUserId,
      displayName: live?.displayName || sampleVio?.userName || 'Thành viên',
      username: live?.username || sampleVio?.userUsername || 'member',
      photoURL: live?.photoURL || sampleVio?.userPhotoURL || '',
      restriction: restr,
      history,
    };
  }, [inspectUserId, publicProfiles, violations, restrictions]);

  const handleStatusChange = async (
    violation: ForumViolation,
    status: ViolationStatus,
    decrementStrike = false
  ) => {
    setBusyId(violation.id);
    try {
      await updateViolationStatusAdmin({
        admin: adminUser,
        violation,
        status,
        decrementStrike,
      });
      sfx.play('filterSelect');
      onNotify(
        status === 'dismissed'
          ? 'Đã bỏ qua cảnh cáo do nhận diện sai và điều chỉnh số lần vi phạm.'
          : `Đã chuyển trạng thái cảnh cáo thành "${statusLabelVi(status)}".`
      );
    } catch {
      onNotify('Không thể cập nhật trạng thái cảnh cáo lúc này.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmAppealDecision = async (e: FormEvent) => {
    e.preventDefault();
    if (!appealTarget) return;
    setBusyId(appealTarget.violation.id);
    try {
      const approved = appealTarget.decision === 'approved';
      await updateViolationStatusAdmin({
        admin: adminUser,
        violation: appealTarget.violation,
        status: approved ? 'dismissed' : 'resolved',
        appealStatus: appealTarget.decision,
        appealResolutionNote:
          appealNote.trim() ||
          (approved
            ? 'Quản trị viên chấp thuận khiếu nại và gỡ cảnh cáo.'
            : 'Quản trị viên giữ nguyên cảnh cáo sau khi xem xét ngữ cảnh.'),
        decrementStrike: approved,
      });
      sfx.play('welcomeClick');
      onNotify(
        approved
          ? 'Đã chấp thuận khiếu nại, gỡ cảnh cáo và thông báo tới thành viên.'
          : 'Đã từ chối khiếu nại và gửi phản hồi tới thành viên.'
      );
      setAppealTarget(null);
      setAppealNote('');
    } catch {
      onNotify('Không thể xử lý khiếu nại lúc này.');
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyRestriction = async (e: FormEvent) => {
    e.preventDefault();
    if (!inspectedUserMeta) return;
    setApplyingAction(true);
    try {
      await applyUserRestrictionAdmin({
        admin: adminUser,
        targetUser: {
          uid: inspectedUserMeta.uid,
          displayName: inspectedUserMeta.displayName,
          username: inspectedUserMeta.username,
          photoURL: inspectedUserMeta.photoURL,
        },
        restrictionType: actionType,
        durationHours:
          actionType === 'lift' || actionType === 'manual_warning'
            ? 0
            : durationHours,
        reason: actionReason,
      });
      sfx.play('welcomeClick');
      setActionReason('');
      onNotify('Đã cập nhật trạng thái tài khoản và gửi thông báo tới thành viên.');
    } catch {
      onNotify('Không thể cập nhật quyền tài khoản lúc này.');
    } finally {
      setApplyingAction(false);
    }
  };

  const handleToggleImportantPost = async (post: ForumPost) => {
    setBusyId(post.id);
    const nextImportant = !post.isImportant;
    try {
      await updateForumPostModerationAdmin({
        postId: post.id,
        isImportant: nextImportant,
      });
      if (nextImportant) {
        await publishImportantPostAnnouncementAdmin({
          postId: post.id,
          title: post.title,
          content: post.content,
          admin: adminUser,
          publicProfiles,
        });
      } else {
        await deactivateImportantPostAnnouncementAdmin(post.id);
      }
      await logAdminAuditAction({
        admin: adminUser,
        action: nextImportant ? 'pin_important_post' : 'unpin_important_post',
        targetEntityId: post.id,
        summary: nextImportant
          ? `Ghim quan trọng & phát thông báo cho bài viết "${post.title}".`
          : `Tắt trạng thái ghim quan trọng cho bài viết "${post.title}".`,
      });
      sfx.play('welcomeClick');
      onNotify(
        nextImportant
          ? 'Đã ghim quan trọng và gửi thông báo tới các thành viên!'
          : 'Đã gỡ trạng thái ghim quan trọng của bài viết.'
      );
    } catch {
      onNotify('Không thể cập nhật trạng thái ghim quan trọng lúc này.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveRules = async (e: FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const nextVer = await updateForumRulesConfigAdmin({
        admin: adminUser,
        currentVersion: rulesConfig.version,
        title: rulesTitle,
        intro: rulesIntro,
        rules: rulesItems,
        bumpVersion: bumpRulesVersion,
      });
      sfx.play('welcomeClick');
      onNotify(
        bumpRulesVersion
          ? `Đã cập nhật nội quy diễn đàn lên phiên bản v${nextVer}. Thành viên sẽ được yêu cầu đọc lại khi vào diễn đàn.`
          : `Đã lưu thay đổi nội quy diễn đàn (phiên bản v${nextVer}).`
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể lưu nội quy diễn đàn.'
      );
    } finally {
      setSavingRules(false);
    }
  };

  const adminPosts = useMemo(
    () =>
      forumPosts
        .filter((p) => p.authorRole === 'admin' || p.isPinned || p.isImportant)
        .sort((a, b) => Number(Boolean(b.isImportant)) - Number(Boolean(a.isImportant)) || b.createdAt - a.createdAt),
    [forumPosts]
  );

  return (
    <div className="space-y-6">
      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          <p className="font-mono-archive text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
            Cảnh cáo chưa xem
          </p>
          <p className="font-editorial mt-1 text-3xl font-semibold tabular-nums text-[var(--ink-primary)]">
            {unreadCount}
          </p>
        </div>
        <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          <p className="font-mono-archive text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
            Khiếu nại chờ duyệt
          </p>
          <p className="font-editorial mt-1 text-3xl font-semibold tabular-nums text-amber-500">
            {pendingAppealsCount}
          </p>
        </div>
        <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          <p className="font-mono-archive text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
            Tài khoản ≥ 3 vi phạm
          </p>
          <p className="font-editorial mt-1 text-3xl font-semibold tabular-nums text-rose-500">
            {flaggedAccounts3Plus}
          </p>
        </div>
        <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          <p className="font-mono-archive text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
            Đang bị hạn chế
          </p>
          <p className="font-editorial mt-1 text-3xl font-semibold tabular-nums text-[var(--accent-primary)]">
            {activeRestrictedAccounts}
          </p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-hairline)] pb-4">
        <button
          type="button"
          onClick={() => setSubTab('violations')}
          className={`theme-control inline-flex h-10 items-center gap-2 px-4 text-xs font-semibold whitespace-nowrap ${
            subTab === 'violations'
              ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)]'
              : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)]'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Quản lý vi phạm & Khiếu nại ({violations.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('important_rules')}
          className={`theme-control inline-flex h-10 items-center gap-2 px-4 text-xs font-semibold whitespace-nowrap ${
            subTab === 'important_rules'
              ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)]'
              : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)]'
          }`}
        >
          <Megaphone className="h-3.5 w-3.5" />
          <span>Bài ghim quan trọng & Nội quy (v{rulesConfig.version})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('audit')}
          className={`theme-control inline-flex h-10 items-center gap-2 px-4 text-xs font-semibold whitespace-nowrap ${
            subTab === 'audit'
              ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)]'
              : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)]'
          }`}
        >
          <ScrollText className="h-3.5 w-3.5" />
          <span>Nhật ký quản trị ({auditLogs.length})</span>
        </button>
      </div>

      {/* =================================================================
          SUB-TAB 1: VIOLATIONS & APPEALS
         ================================================================= */}
      {subTab === 'violations' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên, @username, lý do hoặc nội dung bị đánh dấu..."
                className="theme-control h-10 w-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] pr-3 pl-10 text-xs text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as ViolationFilter)
                }
                aria-label="Lọc theo trạng thái"
                className="theme-control h-10 border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              >
                <option value="all">Trạng thái: Tất cả</option>
                <option value="unread">Chưa xem ({unreadCount})</option>
                <option value="appeals">
                  Có khiếu nại ({pendingAppealsCount})
                </option>
                <option value="high_strikes">Tài khoản ≥ 3 vi phạm</option>
                <option value="reviewing">Đang xem xét</option>
                <option value="resolved">Đã xử lý</option>
                <option value="dismissed">Đã bỏ qua</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) =>
                  setSeverityFilter(
                    e.target.value as 'all' | ModerationSeverity
                  )
                }
                aria-label="Lọc theo mức độ"
                className="theme-control h-10 border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              >
                <option value="all">Mức độ: Tất cả</option>
                <option value="high">Nghiêm trọng</option>
                <option value="medium">Trung bình</option>
                <option value="low">Nhẹ</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ViolationSort)}
                aria-label="Sắp xếp danh sách vi phạm"
                className="theme-control h-10 border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              >
                <option value="newest">Sắp xếp: Mới nhất</option>
                <option value="strikes">Sắp xếp: Số vi phạm cao nhất</option>
                <option value="severity">Sắp xếp: Mức độ nghiêm trọng</option>
              </select>
            </div>
          </div>

          {/* Violations List */}
          {filteredViolations.length === 0 ? (
            <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 py-14 text-center">
              <ShieldCheck className="mx-auto h-9 w-9 text-emerald-500/70" />
              <p className="mt-3 text-sm font-medium text-[var(--ink-primary)]">
                Chưa có bản ghi cảnh cáo nào khớp với bộ lọc.
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Diễn đàn đang vận hành bình yên và văn minh.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredViolations.map((vio) => {
                const liveProfile = publicProfiles[vio.userId];
                const restr = restrictions[vio.userId] ?? null;
                const activeState = getActiveRestrictionState(restr);
                const totalStrikes = restr?.warningCount ?? vio.strikeNumber;
                const isBusy = busyId === vio.id;

                return (
                  <article
                    key={vio.id}
                    className={`theme-card border bg-[var(--bg-surface)] p-5 ${
                      totalStrikes >= 3 || vio.severity === 'high'
                        ? 'border-rose-500/45'
                        : 'border-[var(--border-hairline)]'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent-primary)]">
                          {liveProfile?.photoURL || vio.userPhotoURL ? (
                            <img
                              src={liveProfile?.photoURL || vio.userPhotoURL}
                              alt={liveProfile?.displayName || vio.userName}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (liveProfile?.displayName || vio.userName)
                              .charAt(0)
                              .toUpperCase()
                          )}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-sm font-semibold text-[var(--ink-primary)]">
                              {liveProfile?.displayName || vio.userName}
                            </p>
                            <span className="font-mono-archive text-xs text-[var(--ink-muted)]">
                              @{liveProfile?.username || vio.userUsername}
                            </span>
                            <span
                              className={`font-mono-archive text-xs font-semibold ${
                                totalStrikes >= 3
                                  ? 'text-rose-500'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              · Tổng {totalStrikes} vi phạm
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--ink-muted)]">
                            <span>
                              Loại:{' '}
                              {vio.contentType === 'post'
                                ? 'Bài viết'
                                : vio.contentType === 'reply'
                                  ? 'Trả lời'
                                  : 'Bình luận'}
                            </span>
                            <span>·</span>
                            <span
                              className={
                                vio.severity === 'high'
                                  ? 'font-semibold text-rose-500'
                                  : vio.severity === 'medium'
                                    ? 'font-medium text-amber-600 dark:text-amber-400'
                                    : ''
                              }
                            >
                              Mức: {severityLabelVi(vio.severity)}
                            </span>
                            <span>·</span>
                            <span className="font-mono-archive">
                              {formatRelativeVietnameseTime(vio.createdAt)}
                            </span>
                            <span>·</span>
                            <span className="font-semibold text-[var(--ink-primary)]">
                              {statusLabelVi(vio.status)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            sfx.play('filterSelect');
                            setInspectUserId(vio.userId);
                            setActionType(
                              activeState.activeUntil > Date.now()
                                ? 'lift'
                                : 'restricted'
                            );
                          }}
                          className="theme-control inline-flex h-8 items-center gap-1.5 border border-[var(--border-strong)] px-3 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                        >
                          <History className="h-3.5 w-3.5" />
                          <span>Lịch sử & Xử lý quyền</span>
                        </button>
                      </div>
                    </div>

                    {/* Flagged content + reason */}
                    <div className="theme-control mt-3.5 space-y-2 border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/75 p-3.5 text-xs">
                      <p className="text-[var(--ink-secondary)]">
                        <strong className="text-[var(--ink-primary)]">
                          Lý do đánh dấu:
                        </strong>{' '}
                        {vio.reason}
                      </p>
                      <div className="border-t border-[var(--border-hairline)] pt-2">
                        <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                          Nội dung bị chặn:
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[var(--ink-primary)]">
                          {vio.flaggedText}
                        </p>
                      </div>
                      {activeState.activeUntil > Date.now() && (
                        <p className="border-t border-[var(--border-hairline)] pt-2 font-semibold text-rose-500">
                          Trạng thái hiện tại: {activeState.labelVi} (đến{' '}
                          {formatDeadlineVi(activeState.activeUntil)})
                        </p>
                      )}
                    </div>

                    {/* User Appeal Block */}
                    {vio.appealRequested && (
                      <div className="theme-control mt-3 border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-amber-700 dark:text-amber-300">
                            Yêu cầu khiếu nại từ thành viên (
                            {vio.appealStatus === 'pending'
                              ? 'Đang chờ duyệt'
                              : vio.appealStatus === 'approved'
                                ? 'Đã chấp thuận'
                                : 'Đã từ chối'}
                            )
                          </p>
                          {vio.appealStatus === 'pending' && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setAppealTarget({
                                    violation: vio,
                                    decision: 'approved',
                                  });
                                  setAppealNote('');
                                }}
                                className="theme-control h-7 bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                              >
                                Chấp thuận & Gỡ cảnh cáo
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setAppealTarget({
                                    violation: vio,
                                    decision: 'rejected',
                                  });
                                  setAppealNote('');
                                }}
                                className="theme-control h-7 border border-rose-500/50 px-2.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-300"
                              >
                                Giữ nguyên cảnh cáo
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="mt-1.5 text-[var(--ink-primary)]">
                          “{vio.appealReason}”
                        </p>
                        {vio.appealResolutionNote && (
                          <p className="mt-1 text-[11px] text-[var(--ink-secondary)]">
                            Phản hồi Admin: {vio.appealResolutionNote}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Quick Moderation Buttons */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] pt-3">
                      {vio.status === 'unread' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleStatusChange(vio, 'reviewing', false)
                          }
                          className="theme-control h-8 border border-[var(--border-hairline)] px-3 text-[11px] font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                        >
                          Đánh dấu Đang xem xét
                        </button>
                      )}
                      {vio.status !== 'resolved' &&
                        vio.status !== 'dismissed' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleStatusChange(vio, 'resolved', false)
                            }
                            className="theme-control h-8 border border-[var(--border-hairline)] px-3 text-[11px] font-medium text-[var(--ink-secondary)] hover:border-emerald-500 hover:text-emerald-600"
                          >
                            Xác nhận Đã xử lý
                          </button>
                        )}
                      {vio.status !== 'dismissed' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleStatusChange(vio, 'dismissed', true)
                          }
                          className="theme-control h-8 border border-[var(--border-hairline)] px-3 text-[11px] font-medium text-emerald-600 hover:border-emerald-500 hover:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          Bỏ qua cảnh cáo (Nhận diện nhầm)
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================
          SUB-TAB 2: IMPORTANT PINNED POSTS & FORUM RULES VERSIONING
         ================================================================= */}
      {subTab === 'important_rules' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Important Pinned Posts Manager */}
          <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 lg:col-span-6">
            <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-3.5">
              <Megaphone className="h-4 w-4 text-[var(--accent-primary)]" />
              <h3 className="font-editorial text-2xl font-semibold text-[var(--ink-primary)]">
                Quản lý bài ghim quan trọng
              </h3>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
              Bật <strong>Ghim quan trọng</strong> cho bài đăng Admin sẽ ghim
              bài lên đầu diễn đàn, hiển thị popup góc dưới trái và gửi thông
              báo tự động (không trùng lặp) đến thành viên.
            </p>

            <div className="mt-4 space-y-2.5">
              {adminPosts.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--ink-muted)]">
                  Chưa có bài viết Admin hoặc bài ghim nào trong diễn đàn.
                </p>
              ) : (
                adminPosts.map((post) => (
                  <div
                    key={post.id}
                    className="theme-control flex flex-col justify-between gap-2.5 border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/70 p-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onInspectForumPost(post.id)}
                        className="truncate text-left text-xs font-semibold text-[var(--ink-primary)] hover:text-[var(--accent-primary)]"
                      >
                        {post.title}
                      </button>
                      <p className="font-mono-archive mt-0.5 text-[11px] text-[var(--ink-muted)]">
                        {post.isImportant
                          ? 'Đang ghim quan trọng · Đã thông báo'
                          : post.isPinned
                            ? 'Đang ghim thường'
                            : 'Bài đăng Admin'}
                        {' · '}
                        {formatRelativeVietnameseTime(post.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === post.id}
                      onClick={() => void handleToggleImportantPost(post)}
                      className={`theme-control inline-flex h-8 shrink-0 items-center gap-1.5 px-3 text-[11px] font-semibold whitespace-nowrap ${
                        post.isImportant
                          ? 'border border-rose-500/40 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-300'
                          : 'bg-[var(--accent-primary)] text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]'
                      }`}
                    >
                      <Pin className="h-3 w-3" />
                      <span>
                        {post.isImportant
                          ? 'Tắt ghim quan trọng'
                          : 'Ghim quan trọng & Thông báo'}
                      </span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Forum Rules Config & Version Bump */}
          <form
            onSubmit={handleSaveRules}
            className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 lg:col-span-6"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3.5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--accent-primary)]" />
                <h3 className="font-editorial text-2xl font-semibold text-[var(--ink-primary)]">
                  Chỉnh sửa nội quy diễn đàn
                </h3>
              </div>
              <span className="font-mono-archive text-xs text-[var(--ink-muted)]">
                Hiện tại: v{rulesConfig.version}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
                  Tiêu đề màn hình nội quy
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={rulesTitle}
                  onChange={(e) => setRulesTitle(e.target.value)}
                  className="theme-control h-10 w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
                  Lời mở đầu
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={rulesIntro}
                  onChange={(e) => setRulesIntro(e.target.value)}
                  className="theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--ink-secondary)]">
                    Danh sách điều khoản ({rulesItems.length}/15)
                  </label>
                  {rulesItems.length < 15 && (
                    <button
                      type="button"
                      onClick={() => setRulesItems((prev) => [...prev, ''])}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Thêm điều khoản</span>
                    </button>
                  )}
                </div>

                {rulesItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-mono-archive w-5 shrink-0 text-[11px] text-[var(--ink-muted)]">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      maxLength={300}
                      value={item}
                      onChange={(e) =>
                        setRulesItems((prev) =>
                          prev.map((r, i) => (i === idx ? e.target.value : r))
                        )
                      }
                      className="theme-control h-9 flex-1 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                    {rulesItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setRulesItems((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        aria-label="Xóa điều khoản"
                        className="theme-control flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-muted)] hover:border-rose-500 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 pt-2 text-xs text-[var(--ink-secondary)]">
                <input
                  type="checkbox"
                  checked={bumpRulesVersion}
                  onChange={(e) => setBumpRulesVersion(e.target.checked)}
                  className="mt-0.5 accent-[var(--accent-primary)]"
                />
                <span>
                  Tăng phiên bản nội quy lên <strong>v{rulesConfig.version + 1}</strong>{' '}
                  (yêu cầu toàn bộ thành viên và khách đọc và đồng ý lại khi vào
                  diễn đàn)
                </span>
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingRules}
                  className="theme-control inline-flex h-10 items-center gap-2 bg-[var(--accent-primary)] px-5 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {savingRules ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>Lưu nội quy diễn đàn</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================
          SUB-TAB 3: IMMUTABLE ADMIN AUDIT LOG
         ================================================================= */}
      {subTab === 'audit' && (
        <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3.5">
            <div>
              <h3 className="font-editorial text-2xl font-semibold text-[var(--ink-primary)]">
                Nhật ký thao tác Quản trị viên
              </h3>
              <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">
                Mọi thao tác xử lý vi phạm, hạn chế tài khoản, gỡ cảnh cáo và
                cập nhật nội quy đều được lưu bất biến để đảm bảo minh bạch.
              </p>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <p className="py-10 text-center text-xs text-[var(--ink-muted)]">
              Chưa có thao tác kiểm duyệt nào được ghi nhận.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[var(--border-hairline)]">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col justify-between gap-1.5 py-3 text-xs sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--ink-primary)]">
                      {log.summary}
                    </p>
                    <p className="font-mono-archive mt-0.5 text-[11px] text-[var(--ink-muted)]">
                      Thực hiện bởi: {log.adminName} · Mã thao tác: {log.action}
                    </p>
                  </div>
                  <span className="font-mono-archive shrink-0 text-[11px] text-[var(--ink-muted)]">
                    {formatRelativeVietnameseTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================
          MODAL: USER HISTORY & RESTRICTION CONTROLS
         ================================================================= */}
      <AnimatePresence>
        {inspectedUserMeta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            onClick={() => setInspectUserId(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="theme-panel archive-scroll max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
                <div>
                  <p className="font-mono-archive text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
                    Hồ sơ kiểm duyệt tài khoản
                  </p>
                  <h3 className="font-editorial mt-1 text-2xl font-semibold text-[var(--ink-primary)]">
                    {inspectedUserMeta.displayName}{' '}
                    <span className="font-mono-archive text-sm font-normal text-[var(--ink-muted)]">
                      @{inspectedUserMeta.username}
                    </span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectUserId(null)}
                  className="theme-control flex h-8 w-8 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Current standing */}
              {(() => {
                const st = getActiveRestrictionState(
                  inspectedUserMeta.restriction
                );
                return (
                  <div className="theme-control mt-4 border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/80 p-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Số lần cảnh cáo tích lũy:{' '}
                        <strong className="font-mono-archive text-rose-500">
                          {inspectedUserMeta.restriction?.warningCount ?? 0}
                        </strong>
                      </span>
                      <span>
                        Trạng thái:{' '}
                        <strong className="text-[var(--ink-primary)]">
                          {st.labelVi}
                        </strong>
                      </span>
                    </div>
                    {st.activeUntil > Date.now() && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-rose-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          Hết hạn vào: {formatDeadlineVi(st.activeUntil)}
                        </span>
                      </p>
                    )}
                    {inspectedUserMeta.restriction?.reason && (
                      <p className="mt-1.5 text-[var(--ink-secondary)]">
                        Lý do gần nhất: {inspectedUserMeta.restriction.reason}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Admin Action Form */}
              <form
                onSubmit={handleApplyRestriction}
                className="theme-control mt-4 space-y-3 border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4"
              >
                <p className="text-xs font-semibold text-[var(--ink-primary)]">
                  Áp dụng biện pháp hoặc khôi phục quyền
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[var(--ink-secondary)]">
                      Hành động
                    </label>
                    <select
                      value={actionType}
                      onChange={(e) =>
                        setActionType(
                          e.target.value as typeof actionType
                        )
                      }
                      className="theme-control h-9 w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--ink-primary)]"
                    >
                      <option value="manual_warning">
                        Cảnh cáo thủ công (+1 cảnh cáo)
                      </option>
                      <option value="post_restricted">
                        Tạm hạn chế đăng bài
                      </option>
                      <option value="comment_restricted">
                        Tạm hạn chế bình luận
                      </option>
                      <option value="restricted">
                        Tạm hạn chế đăng bài & bình luận
                      </option>
                      <option value="suspended">
                        Tạm đình chỉ tương tác diễn đàn
                      </option>
                      <option value="lift">
                        Gỡ toàn bộ hạn chế & Khôi phục quyền
                      </option>
                    </select>
                  </div>

                  {actionType !== 'lift' && actionType !== 'manual_warning' && (
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-[var(--ink-secondary)]">
                        Thời hạn tạm khóa
                      </label>
                      <select
                        value={durationHours}
                        onChange={(e) =>
                          setDurationHours(Number(e.target.value))
                        }
                        className="theme-control h-9 w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--ink-primary)]"
                      >
                        <option value={1}>1 giờ</option>
                        <option value={6}>6 giờ</option>
                        <option value={24}>24 giờ (1 ngày)</option>
                        <option value={72}>3 ngày</option>
                        <option value={168}>7 ngày</option>
                        <option value={336}>14 ngày</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[var(--ink-secondary)]">
                    Lý do (sẽ hiển thị cho thành viên và lưu nhật ký quản trị)
                  </label>
                  <input
                    type="text"
                    maxLength={400}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Nhập lý do rõ ràng, khách quan..."
                    className="theme-control h-9 w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs text-[var(--ink-primary)]"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={applyingAction}
                    className={`theme-control inline-flex h-9 items-center gap-1.5 px-4 text-xs font-semibold text-white ${
                      actionType === 'lift'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)]'
                    }`}
                  >
                    {applyingAction ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : actionType === 'lift' ? (
                      <RotateCcw className="h-3.5 w-3.5" />
                    ) : (
                      <FileWarning className="h-3.5 w-3.5" />
                    )}
                    <span>Xác nhận thực hiện</span>
                  </button>
                </div>
              </form>

              {/* Violation Timeline */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-[var(--ink-primary)]">
                  Lịch sử vi phạm ({inspectedUserMeta.history.length})
                </p>
                <div className="mt-2.5 space-y-2">
                  {inspectedUserMeta.history.map((h) => (
                    <div
                      key={h.id}
                      className="theme-control border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/70 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--ink-muted)]">
                        <span>
                          Lần #{h.strikeNumber} · {severityLabelVi(h.severity)} ·{' '}
                          {statusLabelVi(h.status)}
                        </span>
                        <span className="font-mono-archive">
                          {formatRelativeVietnameseTime(h.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-[var(--ink-primary)]">
                        {h.reason}
                      </p>
                      <p className="mt-1 text-[var(--ink-secondary)]">
                        “{h.flaggedText}”
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =================================================================
          MODAL: APPEAL RESOLUTION NOTE
         ================================================================= */}
      <AnimatePresence>
        {appealTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            onClick={() => setAppealTarget(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleConfirmAppealDecision}
              className="theme-panel w-full max-w-md border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-primary)]">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>
                  {appealTarget.decision === 'approved'
                    ? 'Chấp thuận khiếu nại & Gỡ cảnh cáo'
                    : 'Từ chối khiếu nại & Giữ nguyên cảnh cáo'}
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--ink-secondary)]">
                Thành viên: <strong>{appealTarget.violation.userName}</strong>
              </p>
              <textarea
                rows={3}
                maxLength={500}
                value={appealNote}
                onChange={(e) => setAppealNote(e.target.value)}
                placeholder="Nhập lời nhắn phản hồi gửi đến thành viên (không bắt buộc)..."
                className="theme-control mt-3 w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAppealTarget(null)}
                  className="theme-control h-9 px-3.5 text-xs text-[var(--ink-secondary)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busyId === appealTarget.violation.id}
                  className={`theme-control h-9 px-4 text-xs font-semibold text-white ${
                    appealTarget.decision === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Xác nhận quyết định
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
