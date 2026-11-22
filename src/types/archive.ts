export type ThemeMode = 'light' | 'dark';

export type ArchiveStage = 'welcome' | 'loading' | 'main';

export type SortOption = 'newest' | 'alphabetical' | 'pinned';

export type UserRole = 'guest' | 'user' | 'admin';

export type AuthModalMode = 'login' | 'register';

export type SfxName =
  | 'welcomeClick'
  | 'hover'
  | 'openCharacter'
  | 'close'
  | 'themeSwitch'
  | 'filterSelect'
  | 'loadingComplete'
  | 'favorite'
  | 'copy';

export interface CharacterRecord {
  /** Mã hồ sơ duy nhất, ví dụ: "ARC-001" */
  id: string;
  /** Tên hiển thị của nhân vật */
  name: string;
  /** Đường dẫn ảnh đại diện (để trống "" để hiện khung thay thế theo theme) */
  image: string;
  /** Biệt danh hoặc dòng phụ ngắn */
  subtitle: string;
  /** Danh sách tag phục vụ tìm kiếm và lọc */
  tags: string[];
  /** Thể loại chính */
  genre: string;
  /** Mô tả ngắn về nhân vật */
  description: string;
  /** Cốt truyện / tiểu sử chi tiết */
  plot: string;
  /** Liên kết ngoài đến hồ sơ / trang chat / truyện của nhân vật */
  link: string;
  /** Nhãn tùy chỉnh cho nút mở liên kết */
  linkLabel?: string;
  /** Ghim nổi bật (do quản trị viên thiết lập) */
  pinned?: boolean;
  /** UID quản trị viên tạo hồ sơ */
  createdBy?: string;
  /** Mốc thời gian tạo (ms) */
  createdAt?: number;
  /** Mốc thời gian cập nhật (ms) */
  updatedAt?: number;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  order: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface GalleryItem {
  id: string;
  image: string;
  caption: string;
  date: string;
  category: string;
  span: 'tall' | 'wide' | 'standard';
  createdAt?: number;
  updatedAt?: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  photoURL?: string;
  emailVerified: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export type AppSection = 'archive' | 'forum' | 'profile';

export interface PublicUserProfile {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string;
  role: 'user' | 'admin';
  updatedAt?: number;
}

export interface ForumPost {
  id: string;
  authorId: string;
  authorRole: 'user' | 'admin';
  authorName: string;
  authorUsername: string;
  authorPhotoURL: string;
  title: string;
  content: string;
  image: string;
  isPinned: boolean;
  pinnedAt: number;
  pinOrder: number;
  isFeatured: boolean;
  isImportant?: boolean;
  importantAnnouncedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ForumComment {
  id: string;
  postId: string;
  parentCommentId: string;
  authorId: string;
  authorRole: 'user' | 'admin';
  authorName: string;
  authorUsername: string;
  authorPhotoURL: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ForumLike {
  id: string;
  postId: string;
  userId: string;
  createdAt: number;
}

export interface ForumRulesConfig {
  version: number;
  title: string;
  intro: string;
  rules: string[];
  updatedBy: string;
  updatedAt: number;
}

export interface ForumRulesAcceptance {
  userId: string;
  acceptedVersion: number;
  acceptedAt: number;
}

export type ModerationContentType = 'post' | 'comment' | 'reply';
export type ModerationSeverity = 'low' | 'medium' | 'high';
export type ViolationStatus = 'unread' | 'reviewing' | 'resolved' | 'dismissed';
export type AppealStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface ForumViolation {
  id: string;
  userId: string;
  userName: string;
  userUsername: string;
  userPhotoURL: string;
  contentType: ModerationContentType;
  incidentKey: string;
  flaggedText: string;
  reason: string;
  categories: string[];
  severity: ModerationSeverity;
  strikeNumber: number;
  status: ViolationStatus;
  appealRequested: boolean;
  appealReason: string;
  appealStatus: AppealStatus;
  appealResolutionNote: string;
  adminNote: string;
  reviewedBy: string;
  createdAt: number;
  updatedAt: number;
}

export type RestrictionStatus =
  | 'active'
  | 'post_restricted'
  | 'comment_restricted'
  | 'restricted'
  | 'suspended';

export interface UserRestriction {
  userId: string;
  warningCount: number;
  status: RestrictionStatus;
  postRestrictedUntil: number;
  commentRestrictedUntil: number;
  suspendedUntil: number;
  reason: string;
  updatedBy: string;
  updatedAt: number;
}

export type NotificationType =
  | 'important_post'
  | 'interaction'
  | 'warning'
  | 'system';

export interface UserNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  subtype: string;
  title: string;
  body: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string;
  postId: string;
  commentId: string;
  violationId: string;
  isRead: boolean;
  createdAt: number;
}

export interface ImportantAnnouncement {
  id: string;
  postId: string;
  title: string;
  excerpt: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetUserId: string;
  targetUserName: string;
  targetEntityId: string;
  summary: string;
  createdAt: number;
}

export interface ModerationCheckResult {
  flagged: boolean;
  uncertain?: boolean;
  severity: ModerationSeverity;
  categories: string[];
  reason: string;
  matchedExcerpt: string;
}

export interface PendingGuestAction {
  type: 'favorite' | 'forum_like' | 'forum_compose' | 'forum_comment';
  characterId?: string;
  postId?: string;
}

export type RepeatMode = 'all' | 'one' | 'off';

export type TrackAudioType = 'chunks' | 'url' | 'ambient';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  description?: string;
  src: string;
  cover: string;
  duration: number;
  ambientPreset?: 'porcelain' | 'burgundy' | 'library';
  audioType?: TrackAudioType;
  audioMimeType?: string;
  audioFileName?: string;
  audioFileSize?: number;
  audioChunkCount?: number;
  audioVersion?: number;
  order?: number;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
  isBuiltIn?: boolean;
}
