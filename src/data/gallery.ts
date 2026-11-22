import type { GalleryItem } from '../types/archive';

/**
 * ============================================================================
 * THƯ VIỆN ẢNH TRANG TRÍ ĐỘC LẬP (DECORATIVE IMAGE GALLERY)
 * ============================================================================
 * Hoàn toàn tách biệt với dữ liệu nhân vật.
 * Quản trị viên có thể thêm/xóa trực tiếp trong website hoặc đồng bộ lên Firestore.
 */

export const INITIAL_GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'decor-01',
    image: '/src/assets/images/decor_ocean_window_1795314143372.jpg',
    caption: 'Sóng sớm qua khung cửa rèm vải lanh',
    date: 'Tháng 5, 2026',
    category: 'Biển · Phim 35mm',
    span: 'wide',
  },
  {
    id: 'decor-02',
    image: '/src/assets/images/decor_wine_roses_1795314143143.jpg',
    caption: 'Hoa hồng đỏ rượu vang sau hoàng hôn',
    date: 'Tháng 10, 2026',
    category: 'Hoa · Tĩnh vật',
    span: 'tall',
  },
  {
    id: 'decor-03',
    image: '/src/assets/images/decor_european_arch_1795314143278.jpg',
    caption: 'Hành lang đá cổ trong làn sương xanh sáng sớm',
    date: 'Tháng 11, 2026',
    category: 'Kiến trúc · Film',
    span: 'tall',
  },
  {
    id: 'decor-04',
    image: '/src/assets/images/decor_vintage_library_1795314143503.jpg',
    caption: 'Sổ tay bìa vải, bút máy đồng và cánh hoa trà khô',
    date: 'Tháng 8, 2026',
    category: 'Góc bàn · Lưu giữ',
    span: 'wide',
  },
];
