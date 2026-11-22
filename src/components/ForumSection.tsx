import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ChevronDown,
  Heart,
  ImagePlus,
  Loader2,
  Megaphone,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  createForumPost,
  deleteForumPost,
  updateForumPostContent,
  updateForumPostModerationAdmin,
  validateImageUploadFile,
} from '../services/forumService';
import {
  formatDeadlineVi,
  getActiveRestrictionState,
  logAdminAuditAction,
  recordContentViolation,
} from '../services/moderationService';
import {
  deactivateImportantPostAnnouncementAdmin,
  publishImportantPostAnnouncementAdmin,
} from '../services/notificationService';
import type {
  ForumComment,
  ForumLike,
  ForumPost,
  ForumViolation,
  PublicUserProfile,
  ThemeMode,
  UserProfile,
  UserRestriction,
} from '../types/archive';
import { analyzeContentForModeration } from '../utils/contentModeration';
import { compressImageFile } from '../utils/imageCompressor';
import { sfx } from '../utils/sfxEngine';
import {
  formatRelativeVietnameseTime,
  ForumPostDetailModal,
  resolveLiveAuthor,
} from './ForumPostDetailModal';
import type { ModerationWarningPayload } from './ModerationWarningModal';

type ForumFilterOption =
  | 'newest'
  | 'popular'
  | 'featured'
  | 'admin_only';

const POSTS_PER_PAGE = 6;

interface ForumSectionProps {
  theme: ThemeMode;
  currentUser: UserProfile | null;
  isAdmin: boolean;
  posts: ForumPost[];
  comments: ForumComment[];
  likes: ForumLike[];
  publicProfiles: Record<string, PublicUserProfile>;
  ownRestriction: UserRestriction | null;
  ownViolations: ForumViolation[];
  loading: boolean;
  selectedPostId: string | null;
  highlightCommentId?: string | null;
  composerOpen: boolean;
  onSelectPost: (postId: string | null) => void;
  onComposerOpenChange: (open: boolean) => void;
  onToggleLike: (postId: string) => void;
  onRequireLogin: (action: {
    type: 'forum_like' | 'forum_compose' | 'forum_comment';
    postId?: string;
  }) => void;
  onOpenProfileStatus: () => void;
  onTriggerWarning: (warning: ModerationWarningPayload) => void;
  onNotify: (msg: string) => void;
}

function sortPinnedPosts(a: ForumPost, b: ForumPost): number {
  const impDiff = Number(Boolean(b.isImportant)) - Number(Boolean(a.isImportant));
  if (impDiff !== 0) return impDiff;
  const aHasOrder = a.pinOrder > 0;
  const bHasOrder = b.pinOrder > 0;
  if (aHasOrder && bHasOrder && a.pinOrder !== b.pinOrder) {
    return a.pinOrder - b.pinOrder;
  }
  if (aHasOrder && !bHasOrder) return -1;
  if (!aHasOrder && bHasOrder) return 1;
  if (b.pinnedAt !== a.pinnedAt) return b.pinnedAt - a.pinnedAt;
  return b.createdAt - a.createdAt;
}

export function ForumSection({
  theme,
  currentUser,
  isAdmin,
  posts,
  comments,
  likes,
  publicProfiles,
  ownRestriction,
  ownViolations,
  loading,
  selectedPostId,
  highlightCommentId = null,
  composerOpen,
  onSelectPost,
  onComposerOpenChange,
  onToggleLike,
  onRequireLogin,
  onOpenProfileStatus,
  onTriggerWarning,
  onNotify,
}: ForumSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<ForumFilterOption>('newest');
  const [communityLimit, setCommunityLimit] = useState(POSTS_PER_PAGE);

  // Composer / Edit modal state
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftImage, setDraftImage] = useState('');
  const [draftPinOnCreate, setDraftPinOnCreate] = useState(false);
  const [draftImportantOnCreate, setDraftImportantOnCreate] = useState(false);
  const [draftPinOrder, setDraftPinOrder] = useState(0);
  const [draftFeatureOnCreate, setDraftFeatureOnCreate] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [composerError, setComposerError] = useState('');

  // Draft-session deduplication key so retrying the same blocked post draft never double-counts strikes
  const postDraftKeyRef = useRef<string>('');

  // Confirm delete post modal
  const [pendingDeletePost, setPendingDeletePost] = useState<ForumPost | null>(
    null
  );
  const [deletingPost, setDeletingPost] = useState(false);

  const activeRestriction = useMemo(
    () => getActiveRestrictionState(ownRestriction),
    [ownRestriction]
  );

  // Pin priority inline editor for Admin
  const [pinOrderModalPost, setPinOrderModalPost] = useState<ForumPost | null>(
    null
  );
  const [pinOrderDraft, setPinOrderDraft] = useState(0);

  // Aggregate counts for O(1) lookup per post
  const { likeCountByPost, likedPostIds, commentCountByPost } = useMemo(() => {
    const likeCounts: Record<string, number> = {};
    const likedSet = new Set<string>();
    likes.forEach((l) => {
      likeCounts[l.postId] = (likeCounts[l.postId] ?? 0) + 1;
      if (currentUser && l.userId === currentUser.uid) {
        likedSet.add(l.postId);
      }
    });

    const commentCounts: Record<string, number> = {};
    comments.forEach((c) => {
      commentCounts[c.postId] = (commentCounts[c.postId] ?? 0) + 1;
    });

    return {
      likeCountByPost: likeCounts,
      likedPostIds: likedSet,
      commentCountByPost: commentCounts,
    };
  }, [likes, comments, currentUser]);

  // Filter & partition posts:
  // 1) Admin Priority Zone = ALL pinned posts (sorted by pinOrder / pinnedAt desc) + Admin posts
  // 2) Community Zone = Regular member posts (paginated)
  const { priorityPosts, communityPosts, totalMatched } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matched = posts.filter((post) => {
      if (filterBy === 'featured' && !post.isFeatured && !post.isPinned) {
        return false;
      }
      if (filterBy === 'admin_only' && post.authorRole !== 'admin') {
        return false;
      }
      if (q) {
        const liveAuthor = resolveLiveAuthor(post, publicProfiles);
        const haystack = [
          post.title,
          post.content,
          liveAuthor.displayName,
          liveAuthor.username,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sortRegular = (a: ForumPost, b: ForumPost) => {
      if (filterBy === 'popular') {
        const scoreA =
          (likeCountByPost[a.id] ?? 0) * 2 +
          (commentCountByPost[a.id] ?? 0) +
          (a.isFeatured ? 5 : 0);
        const scoreB =
          (likeCountByPost[b.id] ?? 0) * 2 +
          (commentCountByPost[b.id] ?? 0) +
          (b.isFeatured ? 5 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      if (filterBy === 'featured') {
        const featDiff = Number(b.isFeatured) - Number(a.isFeatured);
        if (featDiff !== 0) return featDiff;
      }
      return b.createdAt - a.createdAt;
    };

    const pinned = matched.filter((p) => p.isPinned).sort(sortPinnedPosts);
    const adminUnpinned = matched
      .filter((p) => !p.isPinned && p.authorRole === 'admin')
      .sort(sortRegular);
    const regular = matched
      .filter((p) => !p.isPinned && p.authorRole !== 'admin')
      .sort(sortRegular);

    return {
      priorityPosts: [...pinned, ...adminUnpinned],
      communityPosts: regular,
      totalMatched: matched.length,
    };
  }, [
    posts,
    searchQuery,
    filterBy,
    publicProfiles,
    likeCountByPost,
    commentCountByPost,
  ]);

  const visibleCommunityPosts = communityPosts.slice(0, communityLimit);
  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  const openNewComposer = () => {
    if (!currentUser) {
      onRequireLogin({ type: 'forum_compose' });
      return;
    }
    if (!currentUser.emailVerified) {
      onNotify('Vui lòng xác minh địa chỉ email trước khi đăng bài lên diễn đàn.');
      return;
    }
    if (!isAdmin && activeRestriction.isPostRestricted) {
      onNotify(
        `${activeRestriction.labelVi} đến ${formatDeadlineVi(activeRestriction.activeUntil)}. Bạn chưa thể đăng bài mới lúc này.`
      );
      return;
    }
    sfx.play('openCharacter');
    postDraftKeyRef.current = '';
    setEditingPost(null);
    setDraftTitle('');
    setDraftContent('');
    setDraftImage('');
    setDraftPinOnCreate(false);
    setDraftImportantOnCreate(false);
    setDraftPinOrder(0);
    setDraftFeatureOnCreate(false);
    setComposerError('');
    onComposerOpenChange(true);
  };

  const openEditComposer = (post: ForumPost) => {
    sfx.play('filterSelect');
    postDraftKeyRef.current = '';
    setEditingPost(post);
    setDraftTitle(post.title);
    setDraftContent(post.content);
    setDraftImage(post.image || '');
    setDraftPinOnCreate(post.isPinned);
    setDraftImportantOnCreate(Boolean(post.isImportant));
    setDraftPinOrder(post.pinOrder || 0);
    setDraftFeatureOnCreate(post.isFeatured);
    setComposerError('');
    onComposerOpenChange(true);
  };

  const handleUploadPostImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setComposerError('');
    const err = validateImageUploadFile(file, 5);
    if (err) {
      setComposerError(err);
      return;
    }

    setProcessingImage(true);
    try {
      const compressed = await compressImageFile(file, 960, 0.8);
      setDraftImage(compressed);
    } catch (uploadErr) {
      setComposerError(
        uploadErr instanceof Error
          ? uploadErr.message
          : 'Không thể xử lý ảnh đính kèm.'
      );
    } finally {
      setProcessingImage(false);
    }
  };

  const handleSubmitPost = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setComposerError('');

    if (!draftTitle.trim()) {
      setComposerError('Vui lòng nhập tiêu đề bài viết.');
      return;
    }
    if (!draftContent.trim()) {
      setComposerError('Vui lòng nhập nội dung bài viết.');
      return;
    }

    if (!isAdmin) {
      const latestRestriction = getActiveRestrictionState(ownRestriction);
      if (latestRestriction.isPostRestricted) {
        setComposerError(
          `${latestRestriction.labelVi} đến ${formatDeadlineVi(latestRestriction.activeUntil)}.`
        );
        return;
      }
    }

    setSavingPost(true);
    try {
      // Context-aware moderation check BEFORE saving to Firestore (keep draft intact if flagged!)
      if (!isAdmin) {
        const combinedText = `${draftTitle.trim()}\n${draftContent.trim()}`;
        const check = analyzeContentForModeration(combinedText);
        if (check.flagged) {
          if (!postDraftKeyRef.current) {
            postDraftKeyRef.current = `post_${editingPost?.id || 'new'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          }
          const recorded = await recordContentViolation({
            user: currentUser,
            contentType: 'post',
            incidentKey: postDraftKeyRef.current,
            flaggedText: combinedText,
            result: check,
            existingViolations: ownViolations,
            currentRestriction: ownRestriction,
            publicProfiles,
          });
          onTriggerWarning({
            violationId: recorded.violationId,
            strikeNumber: recorded.strikeNumber,
            severity: check.severity,
            reason: check.reason,
            matchedExcerpt: check.matchedExcerpt,
            alreadyRecordedForDraft: recorded.alreadyRecordedForDraft,
            restrictedUntil: recorded.restrictedUntil,
          });
          return;
        }
      }

      if (editingPost) {
        await updateForumPostContent({
          postId: editingPost.id,
          user: currentUser,
          title: draftTitle,
          content: draftContent,
          image: draftImage,
        });
        if (isAdmin) {
          const nextPinned = draftPinOnCreate || draftImportantOnCreate;
          const modChanged =
            editingPost.isPinned !== nextPinned ||
            editingPost.pinOrder !== draftPinOrder ||
            editingPost.isFeatured !== draftFeatureOnCreate ||
            Boolean(editingPost.isImportant) !== draftImportantOnCreate;
          if (modChanged) {
            await updateForumPostModerationAdmin({
              postId: editingPost.id,
              isPinned: nextPinned,
              pinOrder: nextPinned ? draftPinOrder : 0,
              isFeatured: draftFeatureOnCreate,
              isImportant: draftImportantOnCreate,
            });
          }
          if (draftImportantOnCreate && !editingPost.isImportant) {
            await publishImportantPostAnnouncementAdmin({
              postId: editingPost.id,
              title: draftTitle,
              content: draftContent,
              admin: currentUser,
              publicProfiles,
            });
            await logAdminAuditAction({
              admin: currentUser,
              action: 'pin_important_post',
              targetEntityId: editingPost.id,
              summary: `Ghim bài viết quan trọng và gửi thông báo: “${draftTitle.trim().slice(0, 80)}”.`,
            });
          } else if (!draftImportantOnCreate && editingPost.isImportant) {
            await deactivateImportantPostAnnouncementAdmin(editingPost.id);
          }
        }
        sfx.play('welcomeClick');
        onNotify('Đã cập nhật bài viết thành công!');
      } else {
        const shouldImportant = isAdmin && draftImportantOnCreate;
        const shouldPin = isAdmin && (draftPinOnCreate || shouldImportant);
        const createdId = await createForumPost({
          user: currentUser,
          title: draftTitle,
          content: draftContent,
          image: draftImage,
          pinOnCreate: shouldPin,
          pinOrder: shouldPin ? draftPinOrder : 0,
          featureOnCreate: isAdmin ? draftFeatureOnCreate : false,
          importantOnCreate: shouldImportant,
        });

        if (shouldImportant) {
          await publishImportantPostAnnouncementAdmin({
            postId: createdId,
            title: draftTitle,
            content: draftContent,
            admin: currentUser,
            publicProfiles,
          });
          await logAdminAuditAction({
            admin: currentUser,
            action: 'pin_important_post',
            targetEntityId: createdId,
            summary: `Đăng và ghim bài viết quan trọng: “${draftTitle.trim().slice(0, 80)}”.`,
          });
        }

        sfx.play('welcomeClick');
        onNotify(
          shouldImportant
            ? 'Đã đăng bài viết quan trọng và gửi thông báo đến thành viên!'
            : 'Đã đăng bài viết mới lên diễn đàn!'
        );
      }
      postDraftKeyRef.current = '';
      onComposerOpenChange(false);
      setEditingPost(null);
    } catch (err) {
      setComposerError(
        err instanceof Error
          ? err.message
          : 'Không thể lưu bài viết. Vui lòng thử lại.'
      );
    } finally {
      setSavingPost(false);
    }
  };

  const handleTogglePin = async (post: ForumPost) => {
    if (!isAdmin) return;
    try {
      const nextPinned = !post.isPinned;
      await updateForumPostModerationAdmin({
        postId: post.id,
        isPinned: nextPinned,
        ...(nextPinned ? {} : { isImportant: false }),
      });
      if (!nextPinned && post.isImportant) {
        await deactivateImportantPostAnnouncementAdmin(post.id);
      }
      sfx.play('filterSelect');
      onNotify(
        nextPinned
          ? `Đã ghim bài viết "${post.title}" lên đầu diễn đàn.`
          : `Đã bỏ ghim bài viết "${post.title}".`
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể thay đổi trạng thái ghim.'
      );
    }
  };

  const handleToggleImportant = async (post: ForumPost) => {
    if (!isAdmin || !currentUser) return;
    try {
      const nextImportant = !post.isImportant;
      await updateForumPostModerationAdmin({
        postId: post.id,
        isImportant: nextImportant,
        ...(nextImportant ? { isPinned: true } : {}),
      });
      if (nextImportant) {
        await publishImportantPostAnnouncementAdmin({
          postId: post.id,
          title: post.title,
          content: post.content,
          admin: currentUser,
          publicProfiles,
        });
        await logAdminAuditAction({
          admin: currentUser,
          action: 'pin_important_post',
          targetEntityId: post.id,
          summary: `Bật Ghim quan trọng & phát thông báo cho bài “${post.title.slice(0, 80)}”.`,
        });
      } else {
        await deactivateImportantPostAnnouncementAdmin(post.id);
        await logAdminAuditAction({
          admin: currentUser,
          action: 'unpin_important_post',
          targetEntityId: post.id,
          summary: `Tắt Ghim quan trọng cho bài “${post.title.slice(0, 80)}”.`,
        });
      }
      sfx.play('welcomeClick');
      onNotify(
        nextImportant
          ? `Đã bật Ghim quan trọng và gửi thông báo cho "${post.title}".`
          : `Đã tắt Ghim quan trọng của "${post.title}".`
      );
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật trạng thái Ghim quan trọng.'
      );
    }
  };

  const handleSavePinOrder = async () => {
    if (!isAdmin || !pinOrderModalPost) return;
    try {
      await updateForumPostModerationAdmin({
        postId: pinOrderModalPost.id,
        isPinned: true,
        pinOrder: Math.max(0, Math.min(9999, pinOrderDraft)),
      });
      sfx.play('filterSelect');
      onNotify('Đã cập nhật thứ tự ưu tiên bài ghim.');
      setPinOrderModalPost(null);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể cập nhật thứ tự ghim.'
      );
    }
  };

  const handleToggleFeatured = async (post: ForumPost) => {
    if (!isAdmin) return;
    try {
      const nextFeatured = !post.isFeatured;
      await updateForumPostModerationAdmin({
        postId: post.id,
        isFeatured: nextFeatured,
      });
      sfx.play('filterSelect');
      onNotify(
        nextFeatured
          ? `Đã đánh dấu "${post.title}" là bài viết nổi bật.`
          : `Đã tắt trạng thái nổi bật của "${post.title}".`
      );
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'Không thể thay đổi trạng thái nổi bật.'
      );
    }
  };

  const handleConfirmDeletePost = async () => {
    if (!pendingDeletePost || !currentUser) return;
    setDeletingPost(true);
    try {
      const target = pendingDeletePost;
      if (isAdmin && target.isImportant) {
        await deactivateImportantPostAnnouncementAdmin(target.id);
      }
      await deleteForumPost(target.id, currentUser);
      if (selectedPostId === target.id) {
        onSelectPost(null);
      }
      setPendingDeletePost(null);
      sfx.play('close');
      onNotify(`Đã xóa bài viết "${target.title}".`);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể xóa bài viết này.'
      );
    } finally {
      setDeletingPost(false);
    }
  };

  const renderPostCard = (post: ForumPost, isPriorityZone: boolean) => {
    const author = resolveLiveAuthor(post, publicProfiles);
    const isAuthorAdmin = author.role === 'admin';
    const isOwner = Boolean(currentUser && currentUser.uid === post.authorId);
    const likeCount = likeCountByPost[post.id] ?? 0;
    const commentCount = commentCountByPost[post.id] ?? 0;
    const isLiked = likedPostIds.has(post.id);

    const cardAccentClass = post.isImportant
      ? theme === 'dark'
        ? 'border-[#d4445d]/80 bg-gradient-to-br from-[#250f16] via-[#1c0c12] to-[#34121f] shadow-lg'
        : 'border-[#2558d4]/80 bg-gradient-to-br from-[#eef5ff] via-[#f7faff] to-[#e2eeff] shadow-lg'
      : post.isPinned
        ? theme === 'dark'
          ? 'border-[var(--accent-primary)]/70 bg-gradient-to-br from-[var(--bg-surface)] via-[var(--bg-surface)] to-[var(--accent-soft)]/35 shadow-md'
          : 'border-[var(--accent-primary)]/65 bg-gradient-to-br from-[var(--bg-surface)] via-[var(--bg-surface)] to-[var(--accent-soft)]/45 shadow-md'
        : isAuthorAdmin
          ? theme === 'dark'
            ? 'border-[#b52b44]/55 bg-[#1f0d13] shadow-sm'
            : 'border-[#5c8ef0]/55 bg-[#f2f7ff] shadow-sm'
          : post.isFeatured
            ? 'border-amber-500/45 bg-[var(--bg-surface)]'
            : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]';

    return (
      <motion.article
        key={post.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`theme-card relative overflow-hidden border transition-all hover:border-[var(--accent-primary)]/85 ${cardAccentClass}`}
      >
        {/* Subtle top accent bar for Important / Pinned / Admin / Featured posts */}
        {(post.isImportant || post.isPinned || isAuthorAdmin || post.isFeatured) && (
          <div
            aria-hidden="true"
            className={`h-1 w-full ${
              post.isImportant
                ? 'bg-[var(--accent-primary)]'
                : post.isPinned
                  ? 'bg-[var(--accent-primary)]/85'
                  : isAuthorAdmin
                    ? 'bg-[var(--accent-primary)]/65'
                    : 'bg-amber-500/70'
            }`}
          />
        )}

        <div className="p-5 sm:p-6">
          {/* Author Row + Distinct Role & Status Labels */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold ${
                  isAuthorAdmin
                    ? 'border-2 border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20'
                    : 'border border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--ink-primary)]'
                }`}
              >
                {author.photoURL ? (
                  <img
                    src={author.photoURL}
                    alt={author.displayName}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  author.displayName.charAt(0).toUpperCase()
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-[var(--ink-primary)]">
                    {author.displayName}
                  </span>
                  {isAuthorAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[var(--accent-primary)] px-2 py-0.5 font-mono-archive text-[10px] font-bold tracking-wider text-[var(--accent-ink)] uppercase">
                      <Shield className="h-2.5 w-2.5" />
                      ✦ ADMIN
                    </span>
                  ) : (
                    <span className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                      Thành viên
                    </span>
                  )}
                </div>
                <p className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                  @{author.username} ·{' '}
                  {formatRelativeVietnameseTime(post.createdAt)}
                </p>
              </div>
            </div>

            {/* Distinct Important, Pin & Featured Badges (separated from Admin role label!) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {post.isImportant && (
                <span className="inline-flex items-center gap-1 rounded border border-[var(--accent-primary)] bg-[var(--accent-primary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-ink)]">
                  <Megaphone className="h-3 w-3" />
                  <span>Ghim quan trọng</span>
                </span>
              )}
              {post.isPinned && !post.isImportant && (
                <span className="inline-flex items-center gap-1 rounded border border-[var(--accent-primary)]/60 bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-primary)]">
                  <Pin className="h-3 w-3" />
                  <span>
                    Đã ghim{post.pinOrder > 0 ? ` #${post.pinOrder}` : ''}
                  </span>
                </span>
              )}
              {post.isFeatured && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-3 w-3" />
                  <span>Nổi bật</span>
                </span>
              )}
            </div>
          </div>

          {/* Clickable Post Title, Excerpt & Optional Image */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              sfx.play('openCharacter');
              onSelectPost(post.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                sfx.play('openCharacter');
                onSelectPost(post.id);
              }
            }}
            className="mt-4 cursor-pointer text-left focus:outline-none"
          >
            <h3
              className={`font-editorial font-semibold text-balance text-[var(--ink-primary)] transition-colors hover:text-[var(--accent-primary)] ${
                isPriorityZone ? 'text-2xl sm:text-3xl' : 'text-2xl'
              }`}
            >
              {post.title}
            </h3>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-secondary)]">
              {post.content}
            </p>

            {post.image && (
              <div className="theme-control mt-4 overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
                <img
                  src={post.image}
                  alt={post.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="max-h-72 w-full object-cover transition-transform duration-500 hover:scale-[1.015]"
                />
              </div>
            )}
          </div>

          {/* Footer Action Row */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-3.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleLike(post.id)}
                className={`theme-control inline-flex h-8 items-center gap-1.5 border px-3 text-xs font-medium transition-colors ${
                  isLiked
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-ink)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                }`}
              >
                <Heart
                  className="h-3.5 w-3.5"
                  fill={isLiked ? 'currentColor' : 'none'}
                />
                <span>{likeCount}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sfx.play('openCharacter');
                  onSelectPost(post.id);
                }}
                className="theme-control inline-flex h-8 items-center gap-1.5 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{commentCount} bình luận</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleToggleImportant(post)}
                    className={`theme-control inline-flex h-8 items-center gap-1 border px-2.5 text-[11px] font-semibold ${
                      post.isImportant
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-ink)]'
                        : 'border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                    }`}
                  >
                    <Megaphone className="h-3 w-3" />
                    <span>{post.isImportant ? 'Tắt quan trọng' : 'Quan trọng'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleTogglePin(post)}
                    className={`theme-control inline-flex h-8 items-center gap-1 border px-2.5 text-[11px] font-medium ${
                      post.isPinned
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)]'
                    }`}
                  >
                    <Pin className="h-3 w-3" />
                    <span>{post.isPinned ? 'Bỏ ghim' : 'Ghim'}</span>
                  </button>

                  {post.isPinned && (
                    <button
                      type="button"
                      onClick={() => {
                        setPinOrderModalPost(post);
                        setPinOrderDraft(post.pinOrder || 0);
                      }}
                      className="theme-control inline-flex h-8 items-center border border-[var(--border-hairline)] px-2 text-[11px] text-[var(--ink-muted)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                    >
                      Thứ tự ghim
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleToggleFeatured(post)}
                    className={`theme-control inline-flex h-8 items-center gap-1 border px-2.5 text-[11px] font-medium ${
                      post.isFeatured
                        ? 'border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-amber-500/60'
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>{post.isFeatured ? 'Bỏ nổi bật' : 'Nổi bật'}</span>
                  </button>
                </>
              )}

              {isOwner && (
                <button
                  type="button"
                  onClick={() => openEditComposer(post)}
                  className="theme-control inline-flex h-8 items-center gap-1 border border-[var(--border-hairline)] px-2.5 text-[11px] font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                >
                  <Pencil className="h-3 w-3" />
                  <span>Sửa</span>
                </button>
              )}

              {(isOwner || isAdmin) && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('filterSelect');
                    setPendingDeletePost(post);
                  }}
                  className="theme-control inline-flex h-8 items-center gap-1 border border-[var(--border-hairline)] px-2.5 text-[11px] font-medium text-[var(--ink-muted)] hover:border-red-500/60 hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Xóa</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.article>
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 mx-auto w-full max-w-5xl px-5 pt-10 pb-24 sm:px-8"
    >
      {/* Forum Header */}
      <div className="flex flex-col justify-between gap-5 border-b border-[var(--border-hairline)] pb-7 md:flex-row md:items-end">
        <div>
          <p className="font-mono-archive text-[11px] tracking-[0.22em] text-[var(--accent-primary)] uppercase">
            DIỄN ĐÀN CỘNG ĐỒNG · XOCYBERLUV’S ARCHIVE
          </p>
          <h1 className="font-editorial mt-1.5 text-4xl font-semibold text-[var(--ink-primary)] sm:text-5xl">
            Diễn đàn thảo luận
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-secondary)]">
            Góc trò chuyện, chia sẻ cảm nhận về các nhân vật, nhận thông báo mới
            nhất từ Quản trị viên và kết nối cùng mọi người.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewComposer}
          onMouseEnter={() => sfx.play('hover')}
          className="theme-control inline-flex h-11 shrink-0 items-center justify-center gap-2 bg-[var(--accent-primary)] px-5 text-xs font-semibold tracking-wider whitespace-nowrap text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo bài viết mới</span>
        </button>
      </div>

      {/* Active Account Restriction Notice (for restricted non-admin users) */}
      {currentUser &&
        !isAdmin &&
        (activeRestriction.isPostRestricted ||
          activeRestriction.isCommentRestricted) && (
          <div className="theme-card mt-5 flex flex-col justify-between gap-3 border border-rose-500/45 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-200 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <div>
                <p className="font-semibold">
                  {activeRestriction.labelVi} đến{' '}
                  {formatDeadlineVi(activeRestriction.activeUntil)}
                </p>
                {ownRestriction?.reason && (
                  <p className="mt-0.5 opacity-90">{ownRestriction.reason}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenProfileStatus}
              className="theme-control h-8 shrink-0 border border-rose-500/40 bg-[var(--bg-surface)] px-3 text-[11px] font-semibold text-rose-600 hover:border-rose-500 dark:text-rose-300"
            >
              Xem lịch sử &amp; khiếu nại
            </button>
          </div>
        )}

      {/* Search & Filter Bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCommunityLimit(POSTS_PER_PAGE);
            }}
            placeholder="Tìm kiếm bài viết theo tiêu đề, nội dung, tác giả..."
            className="theme-control h-11 w-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] pr-9 pl-10 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute top-1/2 right-2.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <label className="theme-control inline-flex h-11 items-center border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--ink-secondary)] focus-within:border-[var(--accent-primary)]">
            <SlidersHorizontal className="mr-2 h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
            <span className="sr-only">Lọc bài viết</span>
            <select
              value={filterBy}
              onChange={(e) => {
                sfx.play('filterSelect');
                setFilterBy(e.target.value as ForumFilterOption);
                setCommunityLimit(POSTS_PER_PAGE);
              }}
              className="cursor-pointer bg-transparent pr-1 text-xs font-medium text-[var(--ink-primary)] focus:outline-none"
            >
              <option value="newest" className="bg-[var(--bg-surface)]">
                Mới nhất trước
              </option>
              <option value="popular" className="bg-[var(--bg-surface)]">
                Nổi bật &amp; tương tác cao
              </option>
              <option value="featured" className="bg-[var(--bg-surface)]">
                Chỉ bài ghim &amp; nổi bật
              </option>
              <option value="admin_only" className="bg-[var(--bg-surface)]">
                Chỉ bài viết của Admin
              </option>
            </select>
          </label>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="mt-12 flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--accent-primary)]" />
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Đang tải bài viết diễn đàn...
          </p>
        </div>
      ) : totalMatched === 0 ? (
        <div className="theme-card mt-10 flex flex-col items-center justify-center border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 py-16 text-center">
          <MessageSquare className="h-9 w-9 text-[var(--ink-muted)]/60" />
          <h3 className="font-editorial mt-3 text-3xl font-semibold text-[var(--ink-primary)]">
            {posts.length === 0
              ? 'Diễn đàn chưa có bài viết nào'
              : 'Không tìm thấy bài viết phù hợp'}
          </h3>
          <p className="mt-2 max-w-md text-sm text-[var(--ink-secondary)]">
            {posts.length === 0
              ? 'Hãy trở thành người đầu tiên mở lời, chia sẻ câu chuyện hoặc đánh giá nhân vật yêu thích của bạn!'
              : 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc để xem các bài viết khác.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {posts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterBy('newest');
                }}
                className="theme-control h-10 border border-[var(--border-strong)] px-4 text-xs font-medium text-[var(--ink-primary)]"
              >
                Đặt lại bộ lọc
              </button>
            )}
            <button
              type="button"
              onClick={openNewComposer}
              className="theme-control h-10 bg-[var(--accent-primary)] px-5 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)]"
            >
              Tạo bài viết đầu tiên
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {/* ==============================================================
              ZONE 1: PRIORITIZED PINNED & ADMIN POSTS
             ============================================================== */}
          {priorityPosts.length > 0 && (
            <section aria-label="Bài viết được ghim và bài viết của Quản trị viên">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[var(--accent-primary)]" />
                  <h2 className="font-mono-archive text-xs font-semibold tracking-[0.18em] text-[var(--accent-primary)] uppercase">
                    Bài ghim &amp; Bài viết từ Quản trị viên ({priorityPosts.length})
                  </h2>
                </div>
              </div>

              <div className="space-y-4">
                {priorityPosts.map((post) => renderPostCard(post, true))}
              </div>
            </section>
          )}

          {/* ==============================================================
              ZONE 2: COMMUNITY POSTS (SEPARATED + PAGINATED)
             ============================================================== */}
          {filterBy !== 'admin_only' && (
            <section aria-label="Bài viết cộng đồng">
              <div className="mb-4 flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-6">
                <h2 className="font-mono-archive text-xs font-semibold tracking-[0.18em] text-[var(--ink-muted)] uppercase">
                  Bài viết cộng đồng ({communityPosts.length})
                </h2>
                {communityPosts.length > 0 && (
                  <span className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                    Hiển thị {visibleCommunityPosts.length} /{' '}
                    {communityPosts.length}
                  </span>
                )}
              </div>

              {visibleCommunityPosts.length > 0 ? (
                <div className="space-y-4">
                  {visibleCommunityPosts.map((post) =>
                    renderPostCard(post, false)
                  )}
                </div>
              ) : (
                <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)]/70 p-8 text-center text-sm text-[var(--ink-muted)]">
                  Chưa có bài viết nào từ thành viên cộng đồng trong mục này.
                </div>
              )}

              {communityLimit < communityPosts.length && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.play('filterSelect');
                      setCommunityLimit((prev) => prev + POSTS_PER_PAGE);
                    }}
                    className="theme-control inline-flex h-10 items-center gap-2 border border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 text-xs font-semibold text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span>
                      Tải thêm bài viết (còn{' '}
                      {communityPosts.length - communityLimit} bài)
                    </span>
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ====================================================================
          POST DETAIL & COMMENTS MODAL
         ==================================================================== */}
      <AnimatePresence>
        {selectedPost && (
          <ForumPostDetailModal
            theme={theme}
            post={selectedPost}
            comments={comments}
            publicProfiles={publicProfiles}
            currentUser={currentUser}
            isAdmin={isAdmin}
            ownRestriction={ownRestriction}
            ownViolations={ownViolations}
            highlightCommentId={highlightCommentId}
            likeCount={likeCountByPost[selectedPost.id] ?? 0}
            isLiked={likedPostIds.has(selectedPost.id)}
            onClose={() => onSelectPost(null)}
            onToggleLike={onToggleLike}
            onEditPost={openEditComposer}
            onRequestDeletePost={(p) => setPendingDeletePost(p)}
            onTogglePin={(p) => void handleTogglePin(p)}
            onToggleImportant={(p) => void handleToggleImportant(p)}
            onToggleFeatured={(p) => void handleToggleFeatured(p)}
            onRequireLogin={(postId) =>
              onRequireLogin({ type: 'forum_comment', postId })
            }
            onTriggerWarning={onTriggerWarning}
            onNotify={onNotify}
          />
        )}
      </AnimatePresence>

      {/* ====================================================================
          CREATE / EDIT POST MODAL
         ==================================================================== */}
      <AnimatePresence>
        {composerOpen && currentUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            onClick={() => !savingPost && onComposerOpenChange(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
          >
            <motion.form
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmitPost}
              className="theme-surface theme-panel max-h-[90vh] w-full max-w-xl space-y-5 overflow-y-auto border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 text-[var(--ink-primary)] shadow-2xl sm:p-7"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
                <div>
                  <p className="font-mono-archive text-[11px] tracking-widest text-[var(--accent-primary)] uppercase">
                    {isAdmin ? 'ĐĂNG BÀI VỚI QUYỀN ADMIN' : 'BÀI VIẾT CỘNG ĐỒNG'}
                  </p>
                  <h2 className="font-editorial mt-0.5 text-3xl font-semibold">
                    {editingPost ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'}
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={savingPost}
                  onClick={() => onComposerOpenChange(false)}
                  aria-label="Đóng biểu mẫu"
                  className="theme-control flex h-9 w-9 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {composerError && (
                <div className="theme-control flex items-start gap-2 border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-500">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{composerError}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                  Tiêu đề bài viết *
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Nhập tiêu đề thu hút cho bài viết của bạn..."
                  className="theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                  Nội dung *
                </label>
                <textarea
                  rows={6}
                  required
                  maxLength={10000}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Chia sẻ câu chuyện, nhận xét hoặc thông báo của bạn..."
                  className="theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
              </div>

              {/* Optional Image Attachment */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                  Ảnh đính kèm (không bắt buộc · tối đa 5 MB)
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="theme-control inline-flex h-9 cursor-pointer items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3.5 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)]">
                    {processingImage ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    <span>{draftImage ? 'Đổi ảnh đính kèm' : 'Chọn ảnh từ máy'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={processingImage || savingPost}
                      onChange={handleUploadPostImage}
                      className="sr-only"
                    />
                  </label>
                  {draftImage && (
                    <button
                      type="button"
                      onClick={() => setDraftImage('')}
                      className="theme-control inline-flex h-9 items-center gap-1 border border-[var(--border-hairline)] px-3 text-xs text-[var(--ink-muted)] hover:border-red-500/50 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Gỡ ảnh</span>
                    </button>
                  )}
                </div>

                {draftImage && (
                  <div className="theme-control mt-3 overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
                    <img
                      src={draftImage}
                      alt="Xem trước ảnh đính kèm"
                      className="max-h-52 w-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Admin-only optional pin, important announcement & feature toggles */}
              {isAdmin && (
                <div className="theme-control space-y-3 border border-[var(--accent-primary)]/35 bg-[var(--accent-soft)]/35 p-4">
                  <p className="font-mono-archive flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-[var(--accent-primary)] uppercase">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Tùy chọn Quản trị viên (không tự động ghim)</span>
                  </p>

                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[var(--ink-primary)]">
                    <input
                      type="checkbox"
                      checked={draftImportantOnCreate}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setDraftImportantOnCreate(checked);
                        if (checked) setDraftPinOnCreate(true);
                      }}
                      className="mt-0.5 h-4 w-4 accent-[var(--accent-primary)]"
                    />
                    <span>
                      <strong className="text-[var(--accent-primary)]">
                        Ghim quan trọng &amp; gửi thông báo
                      </strong>{' '}
                      (hiển thị popup góc trái dưới và gửi vào Trung tâm thông báo
                      của thành viên)
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[var(--ink-primary)]">
                    <input
                      type="checkbox"
                      checked={draftPinOnCreate}
                      disabled={draftImportantOnCreate}
                      onChange={(e) => setDraftPinOnCreate(e.target.checked)}
                      className="h-4 w-4 accent-[var(--accent-primary)] disabled:opacity-60"
                    />
                    <span>Ghim bài viết này lên đầu diễn đàn</span>
                  </label>

                  {draftPinOnCreate && (
                    <div className="ml-6 flex items-center gap-2.5">
                      <label className="text-[11px] text-[var(--ink-secondary)]">
                        Thứ tự ưu tiên ghim (0 = theo thời gian ghim mới nhất,
                        1 = cao nhất):
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={draftPinOrder}
                        onChange={(e) =>
                          setDraftPinOrder(Math.max(0, Number(e.target.value)))
                        }
                        className="theme-control w-20 border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--ink-primary)]"
                      />
                    </div>
                  )}

                  <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[var(--ink-primary)]">
                    <input
                      type="checkbox"
                      checked={draftFeatureOnCreate}
                      onChange={(e) =>
                        setDraftFeatureOnCreate(e.target.checked)
                      }
                      className="h-4 w-4 accent-[var(--accent-primary)]"
                    />
                    <span>Đánh dấu bài viết nổi bật</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2.5 border-t border-[var(--border-hairline)] pt-4">
                <button
                  type="button"
                  disabled={savingPost}
                  onClick={() => onComposerOpenChange(false)}
                  className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingPost || processingImage}
                  className="theme-control inline-flex h-10 items-center gap-2 bg-[var(--accent-primary)] px-6 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {savingPost && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>
                    {savingPost
                      ? 'Đang lưu...'
                      : editingPost
                        ? 'Lưu thay đổi'
                        : 'Đăng bài'}
                  </span>
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          ADMIN PIN PRIORITY ORDER MODAL
         ==================================================================== */}
      <AnimatePresence>
        {pinOrderModalPost && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPinOrderModalPost(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="theme-surface theme-panel w-full max-w-sm border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            >
              <h3 className="font-editorial text-2xl font-semibold">
                Thứ tự ưu tiên bài ghim
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                Số nhỏ hơn sẽ hiển thị cao hơn (ví dụ: <strong>1</strong> đứng
                trước <strong>2</strong>). Để <strong>0</strong> để sắp theo
                thời gian ghim mới nhất.
              </p>
              <input
                type="number"
                min={0}
                max={9999}
                value={pinOrderDraft}
                onChange={(e) =>
                  setPinOrderDraft(Math.max(0, Number(e.target.value)))
                }
                className="theme-control mt-4 w-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3.5 py-2 text-sm text-[var(--ink-primary)]"
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPinOrderModalPost(null)}
                  className="theme-control h-9 border border-[var(--border-hairline)] px-4 text-xs text-[var(--ink-secondary)]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void handleSavePinOrder()}
                  className="theme-control h-9 bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-ink)]"
                >
                  Lưu thứ tự
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          IN-APP DELETE POST CONFIRMATION MODAL (NO window.confirm)
         ==================================================================== */}
      <AnimatePresence>
        {pendingDeletePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            onClick={() => !deletingPost && setPendingDeletePost(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
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
                    Xác nhận xóa bài viết?
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
                    Bạn có chắc muốn xóa vĩnh viễn bài viết{' '}
                    <strong>“{pendingDeletePost.title}”</strong> không? Hành
                    động này không thể hoàn tác.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={deletingPost}
                  onClick={() => setPendingDeletePost(null)}
                  className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={deletingPost}
                  onClick={() => void handleConfirmDeletePost()}
                  className="theme-control inline-flex h-10 items-center gap-1.5 bg-red-600 px-5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deletingPost && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>{deletingPost ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
