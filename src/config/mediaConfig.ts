import type { MusicTrack, SfxName } from '../types/archive';

/**
 * ============================================================================
 * CẤU HÌNH THƯƠNG HIỆU, NHẠC NỀN & SOUND EFFECTS — XOCYBERLUV'S CHARACTER ARCHIVE
 * ============================================================================
 *
 * Danh sách nhạc nền được quản lý trực tiếp từ cơ sở dữ liệu trong
 * Trung tâm quản trị -> Quản lý nhạc. Không dùng bài hát mẫu hay autoplay mẫu.
 */

export const ARCHIVE_META = {
  brandHandle: 'xocyberluv',
  brandSuffix: '’s character archive',
  title: 'xocyberluv’s character archive',
  tagline: 'Một góc nhỏ lưu giữ những nhân vật và câu chuyện của riêng tôi.',
  subtitleEn: 'YOUR LITTLE WORLD OF CHARACTERS & STORIES',
  archiveNumber: 'Lưu trữ số 001',
  collectionLabel: 'Thư viện cá nhân',
  established: 'Thành lập 2026',
};

export const PERSONAL_QUOTES: Array<{ text: string; note: string }> = [
  {
    text: 'Mỗi nhân vật đều bắt đầu từ một tia sáng thoáng qua và ở lại như một ký ức đẹp vượt khỏi trang viết.',
    note: 'Ghi chú lưu trữ · Quyển I',
  },
  {
    text: 'Có những câu chuyện được cất giữ không phải để khép lại, mà để ghé thăm mỗi khi không gian trở nên tĩnh lặng.',
    note: 'Nhật ký cá nhân · Mục 04',
  },
  {
    text: 'Giữa bầu trời xanh mây và ánh rượu vang trầm, mỗi hồ sơ đều lưu giữ một giọng nói từng mong được nhớ đến.',
    note: 'Lời đề từ · 2026',
  },
  {
    text: 'Một thư viện nhân vật cũng giống như một chiếc hộp nhạc — chỉ cần mở ra là cả thế giới nhỏ lại cất lời.',
    note: 'xocyberluv · Sổ tay lưu trữ',
  },
];

// Không chứa bài hát placeholder — playlist chỉ lấy dữ liệu thực tế do Admin tải lên
export const MUSIC_TRACKS: MusicTrack[] = [];

export const SFX_FILE_PATHS: Record<SfxName, string> = {
  welcomeClick: '',
  hover: '',
  openCharacter: '',
  close: '',
  themeSwitch: '',
  filterSelect: '',
  loadingComplete: '',
  favorite: '',
  copy: '',
};
