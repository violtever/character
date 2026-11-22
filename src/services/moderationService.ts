import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AdminAuditLog,
  AppealStatus,
  ForumRulesAcceptance,
  ForumRulesConfig,
  ForumViolation,
  ModerationCheckResult,
  ModerationContentType,
  ModerationSeverity,
  PublicUserProfile,
  RestrictionStatus,
  UserProfile,
  UserRestriction,
  ViolationStatus,
} from '../types/archive';
import { getEscalationSummaryVi } from '../utils/contentModeration';
import { createNotificationDeduped } from './notificationService';

export const DEFAULT_FORUM_RULES: ForumRulesConfig = {
  version: 1,
  title: 'Nội quy cộng đồng Diễn đàn',
  intro:
    'Chào mừng bạn ghé thăm góc trò chuyện của xocyberluv’s character archive. Để không gian chung luôn ấm áp, an toàn và văn minh, vui lòng đọc kỹ nội quy trước khi tham gia nhé:',
  rules: [
    'Tôn trọng mọi người, giao tiếp văn minh, lịch sự và lắng nghe ý kiến khác biệt.',
    'Không xúc phạm, công kích cá nhân, phân biệt đối xử hoặc quấy rối bất kỳ thành viên nào.',
    'Không sử dụng ngôn từ thô tục, kỳ thị, gây hấn hay cố ý khiêu khích.',
    'Không spam, lặp nội dung gây rối hoặc cố tình tạo tranh cãi độc hại.',
    'Không đăng tải, tiết lộ thông tin riêng tư của người khác khi chưa được cho phép.',
    'Không lợi dụng diễn đàn để đe dọa, bắt nạt hoặc làm tổn thương người khác.',
  ],
  updatedBy: 'system',
  updatedAt: 0,
};

const GUEST_RULES_SESSION_KEY = 'xocyberluv_forum_rules_guest_v';

export function hasGuestAcceptedRulesVersion(version: number): boolean {
  try {
    const raw = window.sessionStorage.getItem(GUEST_RULES_SESSION_KEY);
    if (!raw) return false;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= version;
  } catch {
    return false;
  }
}

export function saveGuestAcceptedRulesVersion(version: number): void {
  try {
    window.sessionStorage.setItem(GUEST_RULES_SESSION_KEY, String(version));
  } catch {
    // Ignore storage errors
  }
}

function timestampToMs(value: unknown, fallback = Date.now()): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function generateDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

function mapViolationDoc(
  id: string,
  data: Record<string, unknown>
): ForumViolation {
  const sevRaw = String(data.severity ?? 'low');
  const severity: ModerationSeverity =
    sevRaw === 'high' || sevRaw === 'medium' ? sevRaw : 'low';
  const statusRaw = String(data.status ?? 'unread');
  const status: ViolationStatus =
    statusRaw === 'reviewing' ||
    statusRaw === 'resolved' ||
    statusRaw === 'dismissed'
      ? statusRaw
      : 'unread';
  const appealRaw = String(data.appealStatus ?? 'none');
  const appealStatus: AppealStatus =
    appealRaw === 'pending' ||
    appealRaw === 'approved' ||
    appealRaw === 'rejected'
      ? appealRaw
      : 'none';
  const contentTypeRaw = String(data.contentType ?? 'comment');
  const contentType: ModerationContentType =
    contentTypeRaw === 'post' || contentTypeRaw === 'reply'
      ? contentTypeRaw
      : 'comment';

  return {
    id,
    userId: String(data.userId ?? ''),
    userName: String(data.userName ?? 'Thành viên'),
    userUsername: String(data.userUsername ?? 'member'),
    userPhotoURL: String(data.userPhotoURL ?? ''),
    contentType,
    incidentKey: String(data.incidentKey ?? ''),
    flaggedText: String(data.flaggedText ?? ''),
    reason: String(data.reason ?? ''),
    categories: Array.isArray(data.categories)
      ? data.categories.map((c) => String(c))
      : [],
    severity,
    strikeNumber:
      typeof data.strikeNumber === 'number' ? data.strikeNumber : 1,
    status,
    appealRequested: Boolean(data.appealRequested),
    appealReason: String(data.appealReason ?? ''),
    appealStatus,
    appealResolutionNote: String(data.appealResolutionNote ?? ''),
    adminNote: String(data.adminNote ?? ''),
    reviewedBy: String(data.reviewedBy ?? ''),
    createdAt: timestampToMs(data.createdAt),
    updatedAt: timestampToMs(data.updatedAt),
  };
}

function mapRestrictionDoc(
  userId: string,
  data: Record<string, unknown>
): UserRestriction {
  const statusRaw = String(data.status ?? 'active');
  const status: RestrictionStatus =
    statusRaw === 'post_restricted' ||
    statusRaw === 'comment_restricted' ||
    statusRaw === 'restricted' ||
    statusRaw === 'suspended'
      ? statusRaw
      : 'active';

  return {
    userId,
    warningCount:
      typeof data.warningCount === 'number' ? data.warningCount : 0,
    status,
    postRestrictedUntil:
      typeof data.postRestrictedUntil === 'number'
        ? data.postRestrictedUntil
        : 0,
    commentRestrictedUntil:
      typeof data.commentRestrictedUntil === 'number'
        ? data.commentRestrictedUntil
        : 0,
    suspendedUntil:
      typeof data.suspendedUntil === 'number' ? data.suspendedUntil : 0,
    reason: String(data.reason ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    updatedAt: timestampToMs(data.updatedAt),
  };
}

function mapAuditLogDoc(
  id: string,
  data: Record<string, unknown>
): AdminAuditLog {
  return {
    id,
    adminId: String(data.adminId ?? ''),
    adminName: String(data.adminName ?? 'Quản trị viên'),
    action: String(data.action ?? ''),
    targetUserId: String(data.targetUserId ?? ''),
    targetUserName: String(data.targetUserName ?? ''),
    targetEntityId: String(data.targetEntityId ?? ''),
    summary: String(data.summary ?? ''),
    createdAt: timestampToMs(data.createdAt),
  };
}

export function getActiveRestrictionState(
  restriction: UserRestriction | null,
  nowMs = Date.now()
): {
  isSuspended: boolean;
  isPostRestricted: boolean;
  isCommentRestricted: boolean;
  activeUntil: number;
  labelVi: string;
} {
  if (!restriction) {
    return {
      isSuspended: false,
      isPostRestricted: false,
      isCommentRestricted: false,
      activeUntil: 0,
      labelVi: 'Bình thường',
    };
  }
  const isSuspended = restriction.suspendedUntil > nowMs;
  const isPostRestricted =
    isSuspended || restriction.postRestrictedUntil > nowMs;
  const isCommentRestricted =
    isSuspended || restriction.commentRestrictedUntil > nowMs;
  const activeUntil = Math.max(
    isSuspended ? restriction.suspendedUntil : 0,
    restriction.postRestrictedUntil > nowMs
      ? restriction.postRestrictedUntil
      : 0,
    restriction.commentRestrictedUntil > nowMs
      ? restriction.commentRestrictedUntil
      : 0
  );

  let labelVi = 'Bình thường';
  if (isSuspended) labelVi = 'Tạm đình chỉ tương tác';
  else if (isPostRestricted && isCommentRestricted)
    labelVi = 'Tạm hạn chế đăng bài & bình luận';
  else if (isPostRestricted) labelVi = 'Tạm hạn chế đăng bài';
  else if (isCommentRestricted) labelVi = 'Tạm hạn chế bình luận';

  return {
    isSuspended,
    isPostRestricted,
    isCommentRestricted,
    activeUntil,
    labelVi,
  };
}

export function formatDeadlineVi(untilMs: number): string {
  if (!untilMs || untilMs <= Date.now()) return 'Đã hết hiệu lực';
  return new Date(untilMs).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ============================================================================
// FORUM RULES CONFIG & ACCEPTANCE
// ============================================================================

export function subscribeForumRulesConfig(
  onUpdate: (config: ForumRulesConfig) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'forumRulesConfig', 'current'),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(DEFAULT_FORUM_RULES);
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      const rulesList = Array.isArray(d.rules)
        ? d.rules.map((r) => String(r)).filter((r) => r.trim().length > 0)
        : DEFAULT_FORUM_RULES.rules;
      onUpdate({
        version: typeof d.version === 'number' && d.version >= 1 ? d.version : 1,
        title: String(d.title || DEFAULT_FORUM_RULES.title),
        intro: String(d.intro || DEFAULT_FORUM_RULES.intro),
        rules: rulesList.length > 0 ? rulesList : DEFAULT_FORUM_RULES.rules,
        updatedBy: String(d.updatedBy || 'admin'),
        updatedAt: timestampToMs(d.updatedAt, 0),
      });
    },
    () => {
      onUpdate(DEFAULT_FORUM_RULES);
    }
  );
}

export function subscribeUserRulesAcceptance(
  userId: string,
  onUpdate: (acceptance: ForumRulesAcceptance | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'forumRulesAcceptances', userId),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      onUpdate({
        userId,
        acceptedVersion:
          typeof d.acceptedVersion === 'number' ? d.acceptedVersion : 0,
        acceptedAt: timestampToMs(d.acceptedAt, 0),
      });
    },
    () => {
      onUpdate(null);
    }
  );
}

export async function acceptForumRules(
  user: UserProfile,
  version: number
): Promise<void> {
  const path = `forumRulesAcceptances/${user.uid}`;
  const ref = doc(db, 'forumRulesAcceptances', user.uid);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const prevVer = Number(existing.data()?.acceptedVersion ?? 0);
      await updateDoc(ref, {
        acceptedVersion: Math.max(prevVer, version),
        acceptedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: user.uid,
        acceptedVersion: Math.max(1, version),
        acceptedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateForumRulesConfigAdmin(params: {
  admin: UserProfile;
  currentVersion: number;
  title: string;
  intro: string;
  rules: string[];
  bumpVersion: boolean;
}): Promise<number> {
  const cleanRules = params.rules
    .map((r) => r.trim().slice(0, 300))
    .filter((r) => r.length > 0)
    .slice(0, 15);
  if (cleanRules.length === 0) {
    throw new Error('Nội quy cần có ít nhất 1 điều khoản.');
  }
  const nextVersion = params.bumpVersion
    ? Math.max(1, params.currentVersion) + 1
    : Math.max(1, params.currentVersion);

  const ref = doc(db, 'forumRulesConfig', 'current');
  try {
    const existing = await getDoc(ref);
    const payload = {
      version: nextVersion,
      title: params.title.trim().slice(0, 120) || DEFAULT_FORUM_RULES.title,
      intro: params.intro.trim().slice(0, 500),
      rules: cleanRules,
      updatedBy: params.admin.uid,
      updatedAt: serverTimestamp(),
    };
    if (existing.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }

    await logAdminAuditAction({
      admin: params.admin,
      action: 'update_forum_rules',
      targetEntityId: `v${nextVersion}`,
      summary: params.bumpVersion
        ? `Cập nhật nội quy diễn đàn lên phiên bản v${nextVersion} (yêu cầu thành viên đồng ý lại).`
        : `Chỉnh sửa nội dung nội quy diễn đàn (giữ nguyên phiên bản v${nextVersion}).`,
    });
    return nextVersion;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'forumRulesConfig/current');
  }
}

// ============================================================================
// VIOLATIONS, RESTRICTIONS & APPEALS
// ============================================================================

export function subscribeOwnRestriction(
  userId: string,
  onUpdate: (restriction: UserRestriction | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'userRestrictions', userId),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(
        mapRestrictionDoc(userId, snap.data() as Record<string, unknown>)
      );
    },
    () => {
      onUpdate(null);
    }
  );
}

export function subscribeOwnViolations(
  userId: string,
  onUpdate: (violations: ForumViolation[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'forumViolations'),
    where('userId', '==', userId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapViolationDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(list);
    },
    () => {
      onUpdate([]);
    }
  );
}

export function subscribeAllViolationsAdmin(
  onUpdate: (violations: ForumViolation[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'forumViolations'),
    (snap) => {
      const list = snap.docs
        .map((d) => mapViolationDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'forumViolations');
      } catch {
        onUpdate([]);
      }
    }
  );
}

export function subscribeAllRestrictionsAdmin(
  onUpdate: (map: Record<string, UserRestriction>) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'userRestrictions'),
    (snap) => {
      const map: Record<string, UserRestriction> = {};
      snap.docs.forEach((d) => {
        map[d.id] = mapRestrictionDoc(d.id, d.data() as Record<string, unknown>);
      });
      onUpdate(map);
    },
    () => {
      onUpdate({});
    }
  );
}

export function subscribeAdminAuditLogs(
  onUpdate: (logs: AdminAuditLog[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'adminAuditLogs'),
    (snap) => {
      const list = snap.docs
        .map((d) => mapAuditLogDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(list);
    },
    () => {
      onUpdate([]);
    }
  );
}

/**
 * Records a content moderation violation in Firestore.
 * Uses `incidentKey` deduplication so if the user edits and retries the SAME
 * unpublished draft multiple times, their strike counter does NOT double-increment.
 */
export async function recordContentViolation(params: {
  user: UserProfile;
  contentType: ModerationContentType;
  incidentKey: string;
  flaggedText: string;
  result: ModerationCheckResult;
  existingViolations: ForumViolation[];
  currentRestriction: UserRestriction | null;
  publicProfiles: Record<string, PublicUserProfile>;
}): Promise<{
  violationId: string;
  strikeNumber: number;
  alreadyRecordedForDraft: boolean;
  restrictedUntil: number;
}> {
  // Check if this unpublished draft session already logged a violation
  const priorSameDraft = params.existingViolations.find(
    (v) => v.incidentKey === params.incidentKey
  );
  if (priorSameDraft) {
    const active = getActiveRestrictionState(params.currentRestriction);
    return {
      violationId: priorSameDraft.id,
      strikeNumber: priorSameDraft.strikeNumber,
      alreadyRecordedForDraft: true,
      restrictedUntil: active.activeUntil,
    };
  }

  const prevWarnings = params.currentRestriction?.warningCount ?? 0;
  const nextStrike = prevWarnings + 1;
  const escalation = getEscalationSummaryVi(nextStrike, params.result.severity);

  const nowMs = Date.now();
  const autoUntil =
    escalation.autoRestrictionHours > 0
      ? nowMs + escalation.autoRestrictionHours * 3600 * 1000
      : 0;

  const nextPostUntil = Math.max(
    params.currentRestriction?.postRestrictedUntil ?? 0,
    autoUntil
  );
  const nextCommentUntil = Math.max(
    params.currentRestriction?.commentRestrictedUntil ?? 0,
    autoUntil
  );
  const nextSuspendedUntil = params.currentRestriction?.suspendedUntil ?? 0;

  let nextStatus: RestrictionStatus = 'active';
  if (nextSuspendedUntil > nowMs) nextStatus = 'suspended';
  else if (nextPostUntil > nowMs && nextCommentUntil > nowMs)
    nextStatus = 'restricted';
  else if (nextPostUntil > nowMs) nextStatus = 'post_restricted';
  else if (nextCommentUntil > nowMs) nextStatus = 'comment_restricted';

  const violationId = generateDocId('VIO');
  const violationRef = doc(db, 'forumViolations', violationId);
  const restrictionRef = doc(db, 'userRestrictions', params.user.uid);

  try {
    await setDoc(violationRef, {
      id: violationId,
      userId: params.user.uid,
      userName: params.user.displayName.trim().slice(0, 80) || 'Thành viên',
      userUsername: params.user.username.trim().slice(0, 32) || 'member',
      userPhotoURL: (params.user.photoURL || '').slice(0, 250000),
      contentType: params.contentType,
      incidentKey: params.incidentKey.slice(0, 128),
      flaggedText: params.flaggedText.trim().slice(0, 3000),
      reason: params.result.reason.trim().slice(0, 300),
      categories: params.result.categories.slice(0, 8),
      severity: params.result.severity,
      strikeNumber: nextStrike,
      status: 'unread',
      appealRequested: false,
      appealReason: '',
      appealStatus: 'none',
      appealResolutionNote: '',
      adminNote: '',
      reviewedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const restrictionPayload = {
      userId: params.user.uid,
      warningCount: nextStrike,
      status: nextStatus,
      postRestrictedUntil: nextPostUntil,
      commentRestrictedUntil: nextCommentUntil,
      suspendedUntil: nextSuspendedUntil,
      reason: (
        autoUntil > 0
          ? `Tự động tạm hạn chế sau ${nextStrike} lần vi phạm: ${params.result.reason}`
          : params.currentRestriction?.reason || params.result.reason
      ).slice(0, 400),
      updatedBy: 'system',
      updatedAt: serverTimestamp(),
    };

    const existingRestr = await getDoc(restrictionRef);
    if (existingRestr.exists()) {
      await updateDoc(restrictionRef, {
        warningCount: restrictionPayload.warningCount,
        status: restrictionPayload.status,
        postRestrictedUntil: restrictionPayload.postRestrictedUntil,
        commentRestrictedUntil: restrictionPayload.commentRestrictedUntil,
        suspendedUntil: restrictionPayload.suspendedUntil,
        reason: restrictionPayload.reason,
        updatedBy: 'system',
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(restrictionRef, restrictionPayload);
    }

    // Create personal warning notification for the user
    await createNotificationDeduped({
      id: `warn_${violationId}_${params.user.uid.slice(0, 24)}`,
      recipientId: params.user.uid,
      type: 'warning',
      subtype: autoUntil > 0 ? 'restriction' : 'violation_warning',
      title: escalation.title,
      body: `Lý do: ${params.result.reason.slice(0, 220)}. Bạn có thể xem chi tiết hoặc gửi yêu cầu xem xét trong Hồ sơ của tôi.`,
      actorId: 'system',
      actorName: 'Hệ thống kiểm duyệt',
      violationId,
    });

    // Notify Admins when strike >= 3 or severity is high
    if (escalation.notifyAdmin) {
      const adminUids = Object.values(params.publicProfiles)
        .filter((p) => p.role === 'admin' && p.uid !== params.user.uid)
        .map((p) => p.uid);

      await Promise.all(
        adminUids.map((adminUid) =>
          createNotificationDeduped({
            id: `adm_vio_${violationId}_${adminUid.slice(0, 24)}`,
            recipientId: adminUid,
            type: 'system',
            subtype: 'admin_violation_alert',
            title:
              params.result.severity === 'high'
                ? `Cảnh báo vi phạm nghiêm trọng · @${params.user.username}`
                : `Tài khoản @${params.user.username} đạt ${nextStrike} lần vi phạm`,
            body: `${params.user.displayName} bị hệ thống đánh dấu (${params.result.reason.slice(0, 180)}). Vào Quản lý vi phạm để xem xét.`,
            actorId: params.user.uid,
            actorName: params.user.displayName,
            actorPhotoURL: params.user.photoURL || '',
            violationId,
          })
        )
      );
    }

    return {
      violationId,
      strikeNumber: nextStrike,
      alreadyRecordedForDraft: false,
      restrictedUntil: Math.max(nextPostUntil, nextCommentUntil, nextSuspendedUntil),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `forumViolations/${violationId}`);
  }
}

/**
 * Member submits an appeal / review request if they believe the filter made a mistake.
 */
export async function submitViolationAppeal(params: {
  violationId: string;
  user: UserProfile;
  appealReason: string;
  publicProfiles: Record<string, PublicUserProfile>;
}): Promise<void> {
  const cleanReason = params.appealReason.trim().slice(0, 1000);
  if (cleanReason.length < 5) {
    throw new Error('Vui lòng nhập lý do tối thiểu 5 ký tự để Admin có thể xem xét.');
  }

  const path = `forumViolations/${params.violationId}`;
  try {
    await updateDoc(doc(db, 'forumViolations', params.violationId), {
      appealRequested: true,
      appealReason: cleanReason,
      appealStatus: 'pending',
      updatedAt: serverTimestamp(),
    });

    const adminUids = Object.values(params.publicProfiles)
      .filter((p) => p.role === 'admin' && p.uid !== params.user.uid)
      .map((p) => p.uid);

    await Promise.all(
      adminUids.map((adminUid) =>
        createNotificationDeduped({
          id: `adm_app_${params.violationId}_${adminUid.slice(0, 24)}`,
          recipientId: adminUid,
          type: 'system',
          subtype: 'admin_appeal_alert',
          title: `Yêu cầu xem xét lại cảnh cáo · @${params.user.username}`,
          body: `${params.user.displayName} gửi khiếu nại: “${cleanReason.slice(0, 180)}”`,
          actorId: params.user.uid,
          actorName: params.user.displayName,
          actorPhotoURL: params.user.photoURL || '',
          violationId: params.violationId,
        })
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// ADMIN MODERATION ACTIONS & AUDIT LOGGING
// ============================================================================

export async function logAdminAuditAction(params: {
  admin: UserProfile;
  action: string;
  targetUserId?: string;
  targetUserName?: string;
  targetEntityId?: string;
  summary: string;
}): Promise<void> {
  const logId = generateDocId('LOG');
  try {
    await setDoc(doc(db, 'adminAuditLogs', logId), {
      id: logId,
      adminId: params.admin.uid,
      adminName: params.admin.displayName.slice(0, 80),
      action: params.action.slice(0, 60),
      targetUserId: (params.targetUserId ?? '').slice(0, 128),
      targetUserName: (params.targetUserName ?? '').slice(0, 80),
      targetEntityId: (params.targetEntityId ?? '').slice(0, 128),
      summary: params.summary.trim().slice(0, 400),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Audit logging failure should not crash UI
  }
}

export async function updateViolationStatusAdmin(params: {
  admin: UserProfile;
  violation: ForumViolation;
  status: ViolationStatus;
  adminNote?: string;
  appealStatus?: AppealStatus;
  appealResolutionNote?: string;
  decrementStrike?: boolean;
}): Promise<void> {
  const path = `forumViolations/${params.violation.id}`;
  try {
    await updateDoc(doc(db, 'forumViolations', params.violation.id), {
      status: params.status,
      appealStatus: params.appealStatus ?? params.violation.appealStatus,
      appealResolutionNote: (
        params.appealResolutionNote ?? params.violation.appealResolutionNote
      ).slice(0, 500),
      adminNote: (params.adminNote ?? params.violation.adminNote).slice(0, 500),
      reviewedBy: params.admin.uid,
      updatedAt: serverTimestamp(),
    });

    // If dismissing a false-positive warning or approving an appeal, decrement strike count cleanly
    if (params.decrementStrike) {
      const restrRef = doc(db, 'userRestrictions', params.violation.userId);
      const snap = await getDoc(restrRef);
      if (snap.exists()) {
        const current = mapRestrictionDoc(
          params.violation.userId,
          snap.data() as Record<string, unknown>
        );
        const nextCount = Math.max(0, current.warningCount - 1);
        await updateDoc(restrRef, {
          warningCount: nextCount,
          status: nextCount < 3 ? 'active' : current.status,
          postRestrictedUntil: nextCount < 3 ? 0 : current.postRestrictedUntil,
          commentRestrictedUntil:
            nextCount < 3 ? 0 : current.commentRestrictedUntil,
          suspendedUntil: nextCount < 3 ? 0 : current.suspendedUntil,
          reason:
            nextCount < 3
              ? 'Quản trị viên đã gỡ cảnh cáo do nhận diện nhầm.'
              : current.reason,
          updatedBy: params.admin.uid,
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Notify user when appeal is decided or warning dismissed
    if (params.appealStatus === 'approved' || params.status === 'dismissed') {
      await createNotificationDeduped({
        id: `mod_ok_${params.violation.id}_${Date.now().toString(36)}`,
        recipientId: params.violation.userId,
        type: 'warning',
        subtype: 'appeal_result',
        title: 'Cảnh cáo của bạn đã được gỡ bỏ',
        body:
          params.appealResolutionNote?.trim() ||
          'Quản trị viên đã xem xét và xác nhận cảnh cáo trước đó được bỏ qua. Số lần vi phạm của bạn đã được điều chỉnh.',
        actorId: params.admin.uid,
        actorName: params.admin.displayName,
        actorPhotoURL: params.admin.photoURL || '',
        violationId: params.violation.id,
      });
    } else if (params.appealStatus === 'rejected') {
      await createNotificationDeduped({
        id: `mod_rej_${params.violation.id}_${Date.now().toString(36)}`,
        recipientId: params.violation.userId,
        type: 'warning',
        subtype: 'appeal_result',
        title: 'Kết quả xem xét khiếu nại cảnh cáo',
        body:
          params.appealResolutionNote?.trim() ||
          'Quản trị viên đã xem xét và giữ nguyên quyết định cảnh cáo. Vui lòng tuân thủ nội quy diễn đàn.',
        actorId: params.admin.uid,
        actorName: params.admin.displayName,
        actorPhotoURL: params.admin.photoURL || '',
        violationId: params.violation.id,
      });
    }

    await logAdminAuditAction({
      admin: params.admin,
      action:
        params.status === 'dismissed'
          ? 'dismiss_violation'
          : params.appealStatus === 'approved'
            ? 'approve_appeal'
            : params.appealStatus === 'rejected'
              ? 'reject_appeal'
              : 'update_violation_status',
      targetUserId: params.violation.userId,
      targetUserName: params.violation.userName,
      targetEntityId: params.violation.id,
      summary: `Cập nhật vi phạm ${params.violation.id} của @${params.violation.userUsername} → trạng thái: ${params.status}${params.appealStatus && params.appealStatus !== 'none' ? `, khiếu nại: ${params.appealStatus}` : ''}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function applyUserRestrictionAdmin(params: {
  admin: UserProfile;
  targetUser: {
    uid: string;
    displayName: string;
    username: string;
    photoURL?: string;
  };
  restrictionType:
    | 'manual_warning'
    | 'post_restricted'
    | 'comment_restricted'
    | 'restricted'
    | 'suspended'
    | 'lift';
  durationHours: number;
  reason: string;
}): Promise<void> {
  const cleanReason =
    params.reason.trim().slice(0, 400) ||
    (params.restrictionType === 'lift'
      ? 'Quản trị viên đã khôi phục đầy đủ quyền.'
      : 'Quản trị viên áp dụng biện pháp nhắc nhở theo nội quy diễn đàn.');

  const ref = doc(db, 'userRestrictions', params.targetUser.uid);
  const existingSnap = await getDoc(ref);
  const prev = existingSnap.exists()
    ? mapRestrictionDoc(
        params.targetUser.uid,
        existingSnap.data() as Record<string, unknown>
      )
    : null;

  const nowMs = Date.now();
  const untilMs =
    params.durationHours > 0 ? nowMs + params.durationHours * 3600 * 1000 : 0;

  let warningCount = prev?.warningCount ?? 0;
  let status: RestrictionStatus = prev?.status ?? 'active';
  let postRestrictedUntil = prev?.postRestrictedUntil ?? 0;
  let commentRestrictedUntil = prev?.commentRestrictedUntil ?? 0;
  let suspendedUntil = prev?.suspendedUntil ?? 0;

  if (params.restrictionType === 'lift') {
    status = 'active';
    postRestrictedUntil = 0;
    commentRestrictedUntil = 0;
    suspendedUntil = 0;
  } else if (params.restrictionType === 'manual_warning') {
    warningCount += 1;
    // Also record an explicit admin manual warning entry in forumViolations
    const vioId = generateDocId('VIO');
    await setDoc(doc(db, 'forumViolations', vioId), {
      id: vioId,
      userId: params.targetUser.uid,
      userName: params.targetUser.displayName.slice(0, 80) || 'Thành viên',
      userUsername: params.targetUser.username.slice(0, 32) || 'member',
      userPhotoURL: (params.targetUser.photoURL || '').slice(0, 250000),
      contentType: 'post',
      incidentKey: `manual_${vioId}`,
      flaggedText: '[Cảnh cáo thủ công từ Quản trị viên]',
      reason: cleanReason.slice(0, 300),
      categories: ['manual_admin_warning'],
      severity: 'medium',
      strikeNumber: warningCount,
      status: 'resolved',
      appealRequested: false,
      appealReason: '',
      appealStatus: 'none',
      appealResolutionNote: '',
      adminNote: cleanReason.slice(0, 500),
      reviewedBy: params.admin.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else if (params.restrictionType === 'post_restricted') {
    status = 'post_restricted';
    postRestrictedUntil = untilMs;
  } else if (params.restrictionType === 'comment_restricted') {
    status = 'comment_restricted';
    commentRestrictedUntil = untilMs;
  } else if (params.restrictionType === 'restricted') {
    status = 'restricted';
    postRestrictedUntil = untilMs;
    commentRestrictedUntil = untilMs;
  } else if (params.restrictionType === 'suspended') {
    status = 'suspended';
    suspendedUntil = untilMs;
    postRestrictedUntil = untilMs;
    commentRestrictedUntil = untilMs;
  }

  const payload = {
    userId: params.targetUser.uid,
    warningCount,
    status,
    postRestrictedUntil,
    commentRestrictedUntil,
    suspendedUntil,
    reason: cleanReason,
    updatedBy: params.admin.uid,
    updatedAt: serverTimestamp(),
  };

  try {
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        warningCount: payload.warningCount,
        status: payload.status,
        postRestrictedUntil: payload.postRestrictedUntil,
        commentRestrictedUntil: payload.commentRestrictedUntil,
        suspendedUntil: payload.suspendedUntil,
        reason: payload.reason,
        updatedBy: payload.updatedBy,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, payload);
    }

    const titleMap: Record<typeof params.restrictionType, string> = {
      lift: 'Quyền tương tác diễn đàn của bạn đã được khôi phục',
      manual_warning: `Bạn nhận được cảnh cáo từ Quản trị viên (Lần ${warningCount})`,
      post_restricted: `Tạm hạn chế đăng bài trong ${params.durationHours} giờ`,
      comment_restricted: `Tạm hạn chế bình luận trong ${params.durationHours} giờ`,
      restricted: `Tạm hạn chế đăng bài & bình luận trong ${params.durationHours} giờ`,
      suspended: `Tạm đình chỉ tương tác diễn đàn trong ${params.durationHours} giờ`,
    };

    await createNotificationDeduped({
      id: `restr_${params.targetUser.uid.slice(0, 24)}_${Date.now().toString(36)}`,
      recipientId: params.targetUser.uid,
      type: 'warning',
      subtype: params.restrictionType === 'lift' ? 'appeal_result' : 'restriction',
      title: titleMap[params.restrictionType],
      body:
        params.restrictionType === 'lift'
          ? cleanReason
          : `${cleanReason}${untilMs > 0 ? ` · Hiệu lực đến ${formatDeadlineVi(untilMs)}.` : ''}`,
      actorId: params.admin.uid,
      actorName: params.admin.displayName,
      actorPhotoURL: params.admin.photoURL || '',
    });

    await logAdminAuditAction({
      admin: params.admin,
      action: params.restrictionType,
      targetUserId: params.targetUser.uid,
      targetUserName: params.targetUser.displayName,
      targetEntityId: params.targetUser.uid,
      summary: `${titleMap[params.restrictionType]} đối với @${params.targetUser.username}. Lý do: ${cleanReason}`,
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `userRestrictions/${params.targetUser.uid}`
    );
  }
}
