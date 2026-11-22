import type { MusicTrack, SfxName } from '../types/archive';
import coverOceanWindow from '../assets/images/decor_ocean_window_1795314143372.jpg';
import coverWineRoses from '../assets/images/decor_wine_roses_1795314143143.jpg';
import coverVintageLibrary from '../assets/images/decor_vintage_library_1795314143503.jpg';

/**
 * ============================================================================
 * CẤU HÌNH THƯƠNG HIỆU, NHẠC NỀN & SOUND EFFECTS — XOCYBERLUV'S CHARACTER ARCHIVE
 * ============================================================================
 *
 * 1. Nhạc nền (Background Music):
 *    - Đặt file `.mp3` hoặc `.ogg` vào thư mục `public/audio/`.
 *    - Điền đường dẫn vào trường `src` (ví dụ: `'/audio/nhac-nen-1.mp3'`).
 *    - Nếu để trống `""`, trình phát sẽ tự động chạy bản nhạc ambient tích hợp sẵn.
 *
 * 2. Hiệu ứng âm thanh (Sound Effects):
 *    - Đặt file âm thanh ngắn (`.mp3`, `.ogg`, `.wav`) vào `public/sfx/`.
 *    - Điền đường dẫn tương ứng vào `SFX_FILE_PATHS` bên dưới.
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

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'track-1',
    title: 'Nocturne in Porcelain',
    artist: 'Giai điệu lưu trữ · I',
    src: '', // <-- THAY BẰNG FILE MP3/OGG CỦA BẠN, VD: '/audio/track-1.mp3'
    cover: coverOceanWindow,
    duration: 216,
    ambientPreset: 'porcelain',
  },
  {
    id: 'track-2',
    title: 'Velvet Burgundy Waltz',
    artist: 'Giai điệu lưu trữ · II',
    src: '', // <-- THAY BẰNG FILE MP3/OGG CỦA BẠN, VD: '/audio/track-2.mp3'
    cover: coverWineRoses,
    duration: 244,
    ambientPreset: 'burgundy',
  },
  {
    id: 'track-3',
    title: 'Quiet Library Rain',
    artist: 'Giai điệu lưu trữ · III',
    src: '', // <-- THAY BẰNG FILE MP3/OGG CỦA BẠN, VD: '/audio/track-3.mp3'
    cover: coverVintageLibrary,
    duration: 198,
    ambientPreset: 'library',
  },
];

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
