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

export interface PendingGuestAction {
  type: 'favorite';
  characterId: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  cover: string;
  duration: number;
  ambientPreset: 'porcelain' | 'burgundy' | 'library';
}
