import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  CornerDownRight,
  Heart,
  Loader2,
  MessageSquare,
  Pencil,
  Pin,
  Send,
  Shield,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  createForumComment,
  deleteForumComment,
  updateForumComment,
} from '../services/forumService';
import type {
  ForumComment,
  ForumPost,
  PublicUserProfile,
  UserProfile,
} from '../types/archive';
import { sfx } from '../utils/sfxEngine';

interface ForumPostDetailModalProps {
  post: ForumPost;
  comments: ForumComment[];
  publicProfiles: Record<string, PublicUserProfile>;
  currentUser: UserProfile | null;
  isAdmin: boolean;
  likeCount: number;
  isLiked: boolean;
  onClose: () => void;
  onToggleLike: (postId: string) => void;
  onEditPost: (post: ForumPost) => void;
  onRequestDeletePost: (post: ForumPost) => void;
  onTogglePin: (post: ForumPost) => void;
  onToggleFeatured: (post: ForumPost) => void;
  onRequireLogin: (postId: string) => void;
  onNotify: (msg: string) => void;
}

export function formatRelativeVietnameseTime(timestampMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return new Date(timestampMs).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function resolveLiveAuthor(
  fallback: {
    authorId: string;
    authorName: string;
    authorUsername: string;
    authorPhotoURL: string;
    authorRole: 'user' | 'admin';
  },
  publicProfiles: Record<string, PublicUserProfile>
) {
  const live = publicProfiles[fallback.authorId];
  return {
    displayName: live?.displayName || fallback.authorName || 'Thành viên',
    username: live?.username || fallback.authorUsername || 'member',
    photoURL: live ? live.photoURL : fallback.authorPhotoURL || '',
    role:
      fallback.authorRole === 'admin' || live?.role === 'admin'
        ? ('admin' as const)
        : ('user' as const),
  };
}

export function ForumPostDetailModal({
  post,
  comments,
  publicProfiles,
  currentUser,
  isAdmin,
  likeCount,
  isLiked,
  onClose,
  onToggleLike,
  onEditPost,
  onRequestDeletePost,
  onTogglePin,
  onToggleFeatured,
  onRequireLogin,
  onNotify,
}: ForumPostDetailModalProps) {
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ForumComment | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft] = useState('');
  const [savingEditComment, setSavingEditComment] = useState(false);

  // Confirm delete comment modal
  const [pendingDeleteComment, setPendingDeleteComment] =
    useState<ForumComment | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingDeleteComment) {
          setPendingDeleteComment(null);
        } else {
          sfx.play('close');
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pendingDeleteComment]);

  const postAuthor = resolveLiveAuthor(post, publicProfiles);
  const isPostOwner = Boolean(currentUser && currentUser.uid === post.authorId);

  const postComments = useMemo(
    () => comments.filter((c) => c.postId === post.id),
    [comments, post.id]
  );

  const { rootComments, repliesByParent } = useMemo(() => {
    const map: Record<string, ForumComment[]> = {};
    const roots: ForumComment[] = [];
    const ids = new Set(postComments.map((c) => c.id));

    postComments.forEach((c) => {
      if (c.parentCommentId && ids.has(c.parentCommentId)) {
        if (!map[c.parentCommentId]) map[c.parentCommentId] = [];
        map[c.parentCommentId].push(c);
      } else {
        roots.push(c);
      }
    });
    return { rootComments: roots, repliesByParent: map };
  }, [postComments]);

  const handleCreateRootComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireLogin(post.id);
      return;
    }
    if (!currentUser.emailVerified) {
      onNotify('Vui lòng xác minh email của bạn trước khi gửi bình luận.');
      return;
    }
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await createForumComment({
        postId: post.id,
        user: currentUser,
        content: newComment,
      });
      setNewComment('');
      sfx.play('welcomeClick');
      onNotify('Đã gửi bình luận của bạn!');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể gửi bình luận lúc này.'
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSubmitReply = async (e: FormEvent, parent: ForumComment) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireLogin(post.id);
      return;
    }
    if (!currentUser.emailVerified) {
      onNotify('Vui lòng xác minh email của bạn trước khi trả lời bình luận.');
      return;
    }
    if (!replyDraft.trim()) return;

    setSubmittingReply(true);
    try {
      // Flatten deep replies onto the root thread cleanly
      const targetParentId = parent.parentCommentId || parent.id;
      await createForumComment({
        postId: post.id,
        parentCommentId: targetParentId,
        user: currentUser,
        content: replyDraft,
      });
      setReplyDraft('');
      setReplyingTo(null);
      sfx.play('welcomeClick');
      onNotify('Đã gửi phản hồi!');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể gửi phản hồi lúc này.'
      );
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleSaveCommentEdit = async (commentId: string) => {
    if (!currentUser || !editCommentDraft.trim()) return;
    setSavingEditComment(true);
    try {
      await updateForumComment({
        commentId,
        user: currentUser,
        content: editCommentDraft,
      });
      setEditingCommentId(null);
      setEditCommentDraft('');
      sfx.play('filterSelect');
      onNotify('Đã cập nhật bình luận.');
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật bình luận lúc này.'
      );
    } finally {
      setSavingEditComment(false);
    }
  };

  const handleConfirmDeleteComment = async () => {
    if (!pendingDeleteComment || !currentUser) return;
    setDeletingComment(true);
    try {
      await deleteForumComment(
        pendingDeleteComment.id,
        currentUser,
        postComments
      );
      setPendingDeleteComment(null);
      sfx.play('close');
      onNotify('Đã xóa bình luận.');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể xóa bình luận này.'
      );
    } finally {
      setDeletingComment(false);
    }
  };

  const renderCommentItem = (comment: ForumComment, isReply = false) => {
    const author = resolveLiveAuthor(comment, publicProfiles);
    const isCommentOwner = Boolean(
      currentUser && currentUser.uid === comment.authorId
    );
    const canDelete = isCommentOwner || isAdmin;
    const isEditing = editingCommentId === comment.id;
    const wasEdited = comment.updatedAt - comment.createdAt > 5000;

    return (
      <div
        key={comment.id}
        className={`${
          isReply
            ? 'ml-7 border-l-2 border-[var(--border-strong)]/60 pl-4 sm:ml-10'
            : ''
        }`}
      >
        <div className="theme-control border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/85 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-hairline)] bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent-primary)]">
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-[var(--ink-primary)]">
                    {author.displayName}
                  </span>
                  {author.role === 'admin' && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-[var(--accent-primary)] px-1.5 py-0.5 font-mono-archive text-[9px] font-bold tracking-wider text-[var(--accent-ink)] uppercase">
                      <Shield className="h-2.5 w-2.5" />
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="font-mono-archive text-[10px] text-[var(--ink-muted)]">
                  @{author.username} ·{' '}
                  {formatRelativeVietnameseTime(comment.createdAt)}
                  {wasEdited && ' · đã chỉnh sửa'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    onRequireLogin(post.id);
                    return;
                  }
                  setReplyingTo(comment);
                  setReplyDraft(`@${author.displayName} `);
                }}
                className="inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--accent-primary)]"
              >
                <CornerDownRight className="h-3 w-3" />
                <span>Trả lời</span>
              </button>

              {isCommentOwner && !isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCommentId(comment.id);
                    setEditCommentDraft(comment.content);
                  }}
                  aria-label="Chỉnh sửa bình luận"
                  className="flex h-7 w-7 items-center justify-center rounded text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => setPendingDeleteComment(comment)}
                  aria-label="Xóa bình luận"
                  className="flex h-7 w-7 items-center justify-center rounded text-[var(--ink-muted)] hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="mt-2.5 space-y-2">
              <textarea
                rows={2}
                maxLength={3000}
                value={editCommentDraft}
                onChange={(e) => setEditCommentDraft(e.target.value)}
                className="theme-control w-full border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCommentId(null);
                    setEditCommentDraft('');
                  }}
                  className="theme-control h-8 border border-[var(--border-hairline)] px-3 text-[11px] text-[var(--ink-secondary)]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={savingEditComment || !editCommentDraft.trim()}
                  onClick={() => void handleSaveCommentEdit(comment.id)}
                  className="theme-control h-8 bg-[var(--accent-primary)] px-3 text-[11px] font-semibold text-[var(--accent-ink)] disabled:opacity-50"
                >
                  {savingEditComment ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-secondary)]">
              {comment.content}
            </p>
          )}
        </div>

        {/* Inline Reply Box */}
        {replyingTo?.id === comment.id && (
          <form
            onSubmit={(e) => void handleSubmitReply(e, comment)}
            className="mt-2 ml-6 flex gap-2"
          >
            <input
              type="text"
              maxLength={3000}
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder={`Trả lời ${author.displayName}...`}
              autoFocus
              className="theme-control flex-1 border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={submittingReply || !replyDraft.trim()}
              className="theme-control inline-flex h-9 items-center gap-1 bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {submittingReply ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Gửi</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setReplyingTo(null);
                setReplyDraft('');
              }}
              aria-label="Hủy trả lời"
              className="theme-control flex h-9 w-9 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="forum-post-detail-title"
      onClick={() => {
        sfx.play('close');
        onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-3 backdrop-blur-md sm:p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="theme-surface theme-panel relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--ink-primary)] shadow-2xl"
      >
        {/* Modal Sticky Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-primary)]">
              {postAuthor.photoURL ? (
                <img
                  src={postAuthor.photoURL}
                  alt={postAuthor.displayName}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                postAuthor.displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-[var(--ink-primary)]">
                  {postAuthor.displayName}
                </p>
                {postAuthor.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 rounded bg-[var(--accent-primary)] px-2 py-0.5 font-mono-archive text-[10px] font-bold tracking-wider text-[var(--accent-ink)] uppercase">
                    <Shield className="h-3 w-3" />
                    ADMIN
                  </span>
                )}
                {post.isPinned && (
                  <span className="inline-flex items-center gap-1 rounded border border-[var(--accent-primary)]/50 bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-primary)]">
                    <Pin className="h-2.5 w-2.5" />
                    Đã ghim
                  </span>
                )}
                {post.isFeatured && (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    <Sparkles className="h-2.5 w-2.5" />
                    Nổi bật
                  </span>
                )}
              </div>
              <p className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                @{postAuthor.username} ·{' '}
                {formatRelativeVietnameseTime(post.createdAt)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sfx.play('close');
              onClose();
            }}
            aria-label="Đóng bài viết"
            className="theme-control flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
          <article>
            <h2
              id="forum-post-detail-title"
              className="font-editorial text-3xl font-semibold text-balance text-[var(--ink-primary)] sm:text-4xl"
            >
              {post.title}
            </h2>

            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-secondary)] sm:text-[15px]">
              {post.content}
            </div>

            {post.image && (
              <div className="theme-card mt-5 overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
                <img
                  src={post.image}
                  alt={post.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[460px] w-full object-contain"
                />
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--border-hairline)] py-3.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleLike(post.id)}
                  className={`theme-control inline-flex h-9 items-center gap-1.5 border px-3.5 text-xs font-semibold transition-colors ${
                    isLiked
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-ink)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                  }`}
                >
                  <Heart
                    className="h-3.5 w-3.5"
                    fill={isLiked ? 'currentColor' : 'none'}
                  />
                  <span>Thích ({likeCount})</span>
                </button>

                <span className="inline-flex h-9 items-center gap-1.5 px-2 text-xs text-[var(--ink-muted)]">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{postComments.length} bình luận</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => onTogglePin(post)}
                      className={`theme-control inline-flex h-8 items-center gap-1 border px-2.5 text-[11px] font-medium ${
                        post.isPinned
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)]'
                      }`}
                    >
                      <Pin className="h-3 w-3" />
                      <span>{post.isPinned ? 'Bỏ ghim' : 'Ghim bài'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFeatured(post)}
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

                {isPostOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditPost(post);
                    }}
                    className="theme-control inline-flex h-8 items-center gap-1 border border-[var(--border-hairline)] px-2.5 text-[11px] font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Sửa</span>
                  </button>
                )}

                {(isPostOwner || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => onRequestDeletePost(post)}
                    className="theme-control inline-flex h-8 items-center gap-1 border border-[var(--border-hairline)] px-2.5 text-[11px] font-medium text-[var(--ink-muted)] hover:border-red-500/60 hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Xóa</span>
                  </button>
                )}
              </div>
            </div>
          </article>

          {/* Comments Section */}
          <section className="space-y-4">
            <h3 className="font-editorial text-2xl font-semibold text-[var(--ink-primary)]">
              Bình luận ({postComments.length})
            </h3>

            {/* Comment Composer */}
            {currentUser ? (
              <form onSubmit={handleCreateRootComment} className="space-y-2.5">
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Viết bình luận chia sẻ cảm nghĩ của bạn..."
                  className="theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--ink-muted)]">
                    Đang bình luận với tên{' '}
                    <strong className="text-[var(--ink-primary)]">
                      {currentUser.displayName}
                    </strong>
                  </span>
                  <button
                    type="submit"
                    disabled={submittingComment || !newComment.trim()}
                    className="theme-control inline-flex h-9 items-center gap-1.5 bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    {submittingComment ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Gửi bình luận</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="theme-control flex flex-col items-center justify-between gap-3 border border-dashed border-[var(--border-strong)] bg-[var(--bg-canvas)]/70 p-4 text-center sm:flex-row sm:text-left">
                <p className="text-xs text-[var(--ink-secondary)]">
                  Đăng nhập để tham gia bình luận, trả lời và thả tim cho bài
                  viết này.
                </p>
                <button
                  type="button"
                  onClick={() => onRequireLogin(post.id)}
                  className="theme-control h-9 shrink-0 bg-[var(--accent-primary)] px-4 text-xs font-semibold whitespace-nowrap text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
                >
                  Đăng nhập để bình luận
                </button>
              </div>
            )}

            {/* Comment Threads */}
            <div className="space-y-3 pt-1">
              {rootComments.map((root) => (
                <div key={root.id} className="space-y-2.5">
                  {renderCommentItem(root, false)}
                  {(repliesByParent[root.id] ?? []).map((reply) =>
                    renderCommentItem(reply, true)
                  )}
                </div>
              ))}

              {postComments.length === 0 && (
                <p className="py-6 text-center text-xs text-[var(--ink-muted)]">
                  Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nghĩ!
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Confirm Delete Comment Dialog */}
        <AnimatePresence>
          {pendingDeleteComment && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deletingComment && setPendingDeleteComment(null)}
              className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                onClick={(e) => e.stopPropagation()}
                className="theme-surface theme-panel w-full max-w-sm border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                  <div>
                    <h4 className="font-editorial text-2xl font-semibold">
                      Xác nhận xóa bình luận?
                    </h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                      Bình luận này sẽ bị xóa vĩnh viễn và không thể khôi phục.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={deletingComment}
                    onClick={() => setPendingDeleteComment(null)}
                    className="theme-control h-9 border border-[var(--border-hairline)] px-4 text-xs text-[var(--ink-secondary)]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={deletingComment}
                    onClick={() => void handleConfirmDeleteComment()}
                    className="theme-control inline-flex h-9 items-center gap-1.5 bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {deletingComment && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    <span>Xác nhận xóa</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
