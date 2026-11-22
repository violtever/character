import type { ModerationCheckResult, ModerationSeverity } from '../types/archive';

interface PatternRule {
  category: string;
  labelVi: string;
  severity: ModerationSeverity;
  patterns: RegExp[];
  /** If true, even quoted/reporting context requires caution unless clearly educational */
  strictEvenInQuotes?: boolean;
}

const SAFE_CONTEXT_MARKERS: RegExp[] = [
  /(?:trích dẫn|trich dan|ví dụ về|vi du ve|lời thoại|loi thoai|nhân vật nói|nhan vat noi|trong truyện|trong truyen|phân tích|phan tich|báo cáo|bao cao|phản ánh|phan anh|tố cáo|to cao|cảnh báo từ|canh bao tu|không nên nói|khong nen noi|đừng nói|dung noi|bị người khác|bi nguoi khac|hành vi xấu|hanh vi xau|nội quy cấm|noi quy cam)/i,
  /(?:quote|quoting|example of|reporting|academic|character dialogue|in the story|do not say|should not call)/i,
];

const DIRECT_TARGET_HOSTILITY: RegExp[] = [
  /\b(?:mày|may|thằng|thang|con chó|con cho|đồ|do|bọn mày|bon may|tụi mày|tui may|lũ|lu|chúng mày|chung may|you are|ur a|shut up|stfu|f\*ck you)\b/i,
];

const MODERATION_RULES: PatternRule[] = [
  {
    category: 'threat',
    labelVi: 'Đe dọa, kích động bạo lực hoặc gây tổn hại',
    severity: 'high',
    strictEvenInQuotes: true,
    patterns: [
      /\b(?:giết\s*(?:mày|chết|hết|cả nhà|nó)|giet\s*(?:may|chet|het|no))\b/i,
      /\b(?:đánh\s*chết|danh\s*chet|chém\s*chết|chem\s*chet|xử\s*đẹp|xu\s*dep|tìm\s*tận\s*nhà|tim\s*tan\s*nha|đốt\s*nhà|dot\s*nha)\b/i,
      /\b(?:tự\s*tử\s*đi|tu\s*tu\s*di|chết\s*(?:đi|mẹ\s*mày\s*đi|quách\s*đi)|chet\s*(?:di|me\s*may\s*di))\b/i,
      /\b(?:kill\s*yourself|go\s*die|i\s*will\s*kill\s*you|kys)\b/i,
    ],
  },
  {
    category: 'privacy',
    labelVi: 'Tiết lộ hoặc đe dọa tung thông tin riêng tư của người khác',
    severity: 'high',
    strictEvenInQuotes: true,
    patterns: [
      /(?:tung\s*(?:info|thông tin|sđt|sdt|địa chỉ|dia chi|ảnh nóng|anh nong)|doxx(?:ing)?|lộ\s*(?:thông tin cá nhân|số điện thoại|địa chỉ nhà|cccd|cmnd))/i,
      /(?:(?:số điện thoại|sdt|sđt|địa chỉ nhà|cccd|cmnd)\s*(?:của|cua)\s*(?:nó|hắn|thằng|con|mày|admin|bạn này).{0,25}(?:\d{9,12}|phường|quận|đường))/i,
    ],
  },
  {
    category: 'hate_speech',
    labelVi: 'Ngôn từ kỳ thị, phân biệt đối xử',
    severity: 'high',
    patterns: [
      /\b(?:đồ\s*(?:bê\s*đê|pê\s*đê|bệnh\s*hoạn|dị\s*hợm)|do\s*(?:be\s*de|pe\s*de|benh\s*hoan))\b/i,
      /\b(?:bắc\s*kỳ\s*chó|nam\s*kỳ\s*chó|mọi\s*miên|rác\s*rưởi\s*xã\s*hội|thứ\s*hạ\s*đẳng|thu\s*ha\s*dang)\b/i,
      /\b(?:nigger|faggot|retard(?:ed)?|tranny|kike|chink)\b/i,
    ],
  },
  {
    category: 'personal_attack',
    labelVi: 'Công kích cá nhân, xúc phạm hoặc hạ nhục người khác',
    severity: 'medium',
    patterns: [
      /\b(?:đồ\s*(?:ngu|óc\s*chó|rác\s*rưởi|súc\s*vật|vô\s*học|mất\s*dạy|đần|khùng|điên|bẩn\s*thỉu)|do\s*(?:ngu|oc\s*cho|rac\s*ruoi|suc\s*vat|vo\s*hoc|mat\s*day))\b/i,
      /\b(?:óc\s*chó|oc\s*cho|não\s*tàn|nao\s*tan|ngu\s*(?:như\s*chó|nhu\s*cho|vãi|vai|vl|vcl|vkl|hết\s*phần)|mày\s*(?:ngu|điên|khùng|rác)|may\s*(?:ngu|dien|khung))\b/i,
      /\b(?:cút\s*(?:khỏi\s*đây|đi|mẹ\s*mày\s*đi|ngay)|cut\s*(?:khoi\s*day|me\s*may\s*di)|biến\s*mẹ\s*mày\s*đi|câm\s*mồm|cam\s*mom|ngậm\s*mồm|ngam\s*mom)\b/i,
      /\b(?:thằng\s*(?:ngu|rác|chó|khốn|mất\s*dạy)|con\s*(?:ngu|đĩ|chó|rác|mất\s*dạy|khốn))\b/i,
      /\b(?:you\s*are\s*(?:trash|stupid|idiot|pathetic|garbage|worthless)|shut\s*up\s*(?:idiot|moron|loser))\b/i,
    ],
  },
  {
    category: 'profanity',
    labelVi: 'Ngôn từ thô tục, chửi bới thiếu tôn trọng',
    severity: 'medium',
    patterns: [
      /\b(?:địt\s*(?:mẹ|má|con\s*mẹ|cụ)|dit\s*(?:me|ma|cu)|đụ\s*(?:mẹ|má|mày)|du\s*(?:me|ma|may)|đéo\s*(?:mẹ|quan\s*tâm|cần\s*mày)|deo\s*me)\b/i,
      /\b(?:đmm|đkm|đcm|dmm|dkm|dcm|vkl|vcl|cmm|clmm)\b/i,
      /\b(?:mẹ\s*mày|me\s*may|con\s*cặc|con\s*cac|cái\s*lồn|cai\s*lon|vãi\s*lồn|vai\s*lon|đĩ\s*điếm|di\s*diem|lồn\s*mẹ|lon\s*me)\b/i,
      /\b(?:fuck\s*(?:you|off|u)|motherfucker|son\s*of\s*a\s*bitch|dumb\s*bitch|asshole|cunt)\b/i,
    ],
  },
];

function stripQuotedSegments(text: string): string {
  return text
    .replace(/"[^"\n]{1,220}"/g, ' ')
    .replace(/“[^”\n]{1,220}”/g, ' ')
    .replace(/‘[^’\n]{1,220}’/g, ' ')
    .replace(/`[^`\n]{1,220}`/g, ' ');
}

function normalizeObfuscation(text: string): string {
  return text
    .replace(/([a-zA-ZđĐ])[\.\-_*\s]{1,2}(?=[a-zA-ZđĐ]\b)/g, '$1')
    .replace(/(.)\1{4,}/gu, '$1$1$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSpam(rawText: string): { isSpam: boolean; reason: string; excerpt: string } {
  const trimmed = rawText.trim();
  if (trimmed.length < 12) return { isSpam: false, reason: '', excerpt: '' };

  // 1. Excessive repeated identical characters (e.g. aaaaaaaaaaaaaaaa or !!!!!!!!!!!)
  const charSpam = trimmed.match(/(.)\1{14,}/u);
  if (charSpam) {
    return {
      isSpam: true,
      reason: 'Nội dung chứa chuỗi ký tự lặp lại bất thường có dấu hiệu spam hoặc gây rối.',
      excerpt: charSpam[0].slice(0, 40),
    };
  }

  // 2. Repeated same token / word 7+ times in a row or overwhelming ratio
  const tokens = trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length >= 10) {
    let run = 1;
    let maxRun = 1;
    let repeatedWord = '';
    for (let i = 1; i < tokens.length; i++) {
      if (tokens[i] === tokens[i - 1]) {
        run += 1;
        if (run > maxRun) {
          maxRun = run;
          repeatedWord = tokens[i];
        }
      } else {
        run = 1;
      }
    }
    if (maxRun >= 7) {
      return {
        isSpam: true,
        reason: 'Nội dung lặp lại cùng một từ quá nhiều lần có dấu hiệu spam.',
        excerpt: `${repeatedWord} (lặp ${maxRun} lần)`,
      };
    }

    const uniqueCount = new Set(tokens).size;
    if (tokens.length >= 18 && uniqueCount / tokens.length < 0.22) {
      return {
        isSpam: true,
        reason: 'Nội dung lặp đi lặp lại gây loãng cuộc trò chuyện trên diễn đàn.',
        excerpt: trimmed.slice(0, 70),
      };
    }
  }

  // 3. Excessive URLs (4+ links in a single comment/post)
  const urls = trimmed.match(/https?:\/\/[^\s]+/gi);
  if (urls && urls.length >= 4) {
    return {
      isSpam: true,
      reason: 'Nội dung chứa quá nhiều liên kết liên tiếp có dấu hiệu spam.',
      excerpt: urls.slice(0, 2).join(' '),
    };
  }

  return { isSpam: false, reason: '', excerpt: '' };
}

function severityRank(s: ModerationSeverity): number {
  if (s === 'high') return 3;
  if (s === 'medium') return 2;
  return 1;
}

/**
 * Context-aware Vietnamese & English forum content moderation analyzer.
 * Evaluates text BEFORE saving to Firestore while avoiding false positives
 * on quoted examples, academic discussion, or reporting misconduct.
 */
export function analyzeContentForModeration(
  rawText: string
): ModerationCheckResult {
  const cleanText = rawText.trim();
  if (!cleanText) {
    return {
      flagged: false,
      severity: 'low',
      categories: [],
      reason: '',
      matchedExcerpt: '',
    };
  }

  const hasBenignFraming = SAFE_CONTEXT_MARKERS.some((rx) => rx.test(cleanText));
  const unquotedText = stripQuotedSegments(cleanText);
  const normalizedFull = normalizeObfuscation(cleanText);
  const normalizedUnquoted = normalizeObfuscation(unquotedText);
  const hasDirectHostility = DIRECT_TARGET_HOSTILITY.some((rx) =>
    rx.test(normalizedUnquoted)
  );

  const matchedCategories: string[] = [];
  const matchedLabels: string[] = [];
  let maxSeverity: ModerationSeverity = 'low';
  let firstExcerpt = '';
  let uncertain = false;

  for (const rule of MODERATION_RULES) {
    // Check unquoted text first so quoted citations don't blindly trigger warnings
    let matchedInUnquoted: RegExpMatchArray | null = null;
    for (const pattern of rule.patterns) {
      const m = normalizedUnquoted.match(pattern) || unquotedText.match(pattern);
      if (m) {
        matchedInUnquoted = m;
        break;
      }
    }

    let matchedInFull: RegExpMatchArray | null = matchedInUnquoted;
    if (!matchedInFull) {
      for (const pattern of rule.patterns) {
        const m = normalizedFull.match(pattern) || cleanText.match(pattern);
        if (m) {
          matchedInFull = m;
          break;
        }
      }
    }

    if (!matchedInFull) continue;

    // Context guard: if the match ONLY existed inside quotation marks or reporting/educational
    // discussion without direct second-person hostility, skip harmless citations.
    const onlyInQuotes = !matchedInUnquoted;
    if (onlyInQuotes && !hasDirectHostility) {
      if (hasBenignFraming || !rule.strictEvenInQuotes) {
        continue;
      }
    }

    if (hasBenignFraming && !hasDirectHostility && !rule.strictEvenInQuotes) {
      // Ambiguous reporting/discussion context -> do not harshly penalize automatically
      uncertain = true;
      continue;
    }

    matchedCategories.push(rule.category);
    matchedLabels.push(rule.labelVi);
    if (severityRank(rule.severity) > severityRank(maxSeverity)) {
      maxSeverity = rule.severity;
    }
    if (!firstExcerpt) {
      firstExcerpt = matchedInFull[0].slice(0, 80);
    }
  }

  // Also check spam patterns
  const spamCheck = detectSpam(cleanText);
  if (spamCheck.isSpam) {
    matchedCategories.push('spam');
    matchedLabels.push(spamCheck.reason);
    if (!firstExcerpt) firstExcerpt = spamCheck.excerpt;
    if (matchedCategories.length === 1) {
      maxSeverity = 'low';
    }
  }

  if (matchedCategories.length === 0) {
    return {
      flagged: false,
      uncertain,
      severity: 'low',
      categories: [],
      reason: '',
      matchedExcerpt: '',
    };
  }

  const uniqueLabels = Array.from(new Set(matchedLabels));
  return {
    flagged: true,
    uncertain: false,
    severity: maxSeverity,
    categories: Array.from(new Set(matchedCategories)),
    reason: uniqueLabels.join('; '),
    matchedExcerpt: firstExcerpt || cleanText.slice(0, 80),
  };
}

export function getEscalationSummaryVi(strikeNumber: number, severity: ModerationSeverity): {
  title: string;
  guidance: string;
  autoRestrictionHours: number;
  notifyAdmin: boolean;
} {
  if (severity === 'high' && strikeNumber < 3) {
    return {
      title: `Cảnh cáo mức độ nghiêm trọng (Lần ${strikeNumber})`,
      guidance:
        'Nội dung có dấu hiệu vi phạm nghiêm trọng nên đã được chuyển Quản trị viên xem xét ngay. Vui lòng chỉnh sửa nội dung văn minh hơn.',
      autoRestrictionHours: 0,
      notifyAdmin: true,
    };
  }
  if (strikeNumber <= 1) {
    return {
      title: 'Cảnh cáo lần 1 · Nhắc nhở nhẹ nhàng',
      guidance:
        'Hãy đọc lại nội quy diễn đàn và chỉnh sửa nội dung cho lịch sự, tôn trọng mọi người hơn nhé.',
      autoRestrictionHours: 0,
      notifyAdmin: false,
    };
  }
  if (strikeNumber === 2) {
    return {
      title: 'Cảnh cáo lần 2 · Lưu ý nghiêm túc',
      guidance:
        'Tài khoản của bạn đã từng nhận cảnh cáo trước đó. Nếu tiếp tục vi phạm lần nữa, hệ thống sẽ báo Quản trị viên và áp dụng hạn chế tạm thời quyền đăng bài/bình luận.',
      autoRestrictionHours: 0,
      notifyAdmin: false,
    };
  }
  if (strikeNumber === 3) {
    return {
      title: 'Cảnh cáo lần 3 · Tạm hạn chế 6 giờ & Báo Admin',
      guidance:
        'Tài khoản đã chạm mốc 3 lần vi phạm. Báo cáo đã được gửi tới Quản trị viên và quyền đăng bài/bình luận tạm hạn chế trong 6 giờ (tự động mở lại khi hết hạn).',
      autoRestrictionHours: 6,
      notifyAdmin: true,
    };
  }
  const hours = Math.min(72, 12 * (strikeNumber - 2));
  return {
    title: `Cảnh cáo lần ${strikeNumber} · Tạm hạn chế ${hours} giờ & Báo Admin`,
    guidance: `Tài khoản tiếp tục vi phạm nhiều lần. Hệ thống áp dụng tạm hạn chế quyền đăng bài/bình luận trong ${hours} giờ và chuyển Quản trị viên xem xét lịch sử.`,
    autoRestrictionHours: hours,
    notifyAdmin: true,
  };
}
