import type { CategoryRecord, CharacterRecord } from '../types/archive';
import imgSeraphina from '../assets/images/char_seraphina_velvet_1795314142482.jpg';
import imgRen from '../assets/images/char_ren_ocean_1795314143246.jpg';
import imgKaelen from '../assets/images/char_kael_knight_1795314142296.jpg';
import imgMira from '../assets/images/char_mira_botanist_1795314143041.jpg';
import imgLucian from '../assets/images/char_lucian_detective_1795314143182.jpg';
import imgIris from '../assets/images/char_iris_violinist_1795314143309.jpg';

/**
 * ============================================================================
 * DỮ LIỆU NHÂN VẬT MẪU BAN ĐẦU — XOCYBERLUV'S CHARACTER ARCHIVE
 * ============================================================================
 * Khi cơ sở dữ liệu Firestore còn trống, thư viện công khai vẫn hiển thị bộ sưu tập
 * mẫu này để khách truy cập có thể trải nghiệm ngay. Khi Quản trị viên đăng nhập,
 * có thể nhấn 1 nút trong Trung tâm Quản trị để đồng bộ bộ mẫu lên Firestore
 * hoặc tự thêm/sửa/xóa nhân vật trực tiếp.
 */

export const ALL_CATEGORY_LABEL = 'Tất cả nhân vật';

export const DEFAULT_CATEGORY_SEEDS: Array<Omit<CategoryRecord, 'id'>> = [
  { name: 'Romance', slug: 'romance', order: 1 },
  { name: 'Angst', slug: 'angst', order: 2 },
  { name: 'Drama', slug: 'drama', order: 3 },
  { name: 'Fantasy', slug: 'fantasy', order: 4 },
  { name: 'Slice of Life', slug: 'slice-of-life', order: 5 },
  { name: 'Action', slug: 'action', order: 6 },
  { name: 'Horror', slug: 'horror', order: 7 },
  { name: 'Original Character', slug: 'original-character', order: 8 },
  { name: 'Anime', slug: 'anime', order: 9 },
  { name: 'Game', slug: 'game', order: 10 },
  { name: 'Khác', slug: 'khac', order: 11 },
];

export const INITIAL_CHARACTERS: CharacterRecord[] = [
  {
    id: 'ARC-001',
    name: 'Seraphina de Valois',
    image: imgSeraphina,
    subtitle: 'Người giữ cuốn sổ chép dang dở',
    genre: 'Fantasy',
    tags: ['Original Character', 'Drama', 'Angst', 'Quý tộc Gothic'],
    description:
      'Nữ lưu trữ gia bị lưu đày của một gia tộc phương Bắc đã sụp đổ, người cất giữ những bức thư mật trong các tập sách bọc nhung đỏ. Điềm tĩnh và sắc sảo trong từng câu chữ, cô chưa từng quên một lời hứa nào bị phá vỡ.',
    plot:
      'Khi nghị viện mùa đông giải tán gia tộc Valois chỉ sau một đêm, Seraphina từ chối giao nộp những quyển mật thư do người mẹ quá cố để lại. Sống lặng lẽ trong gian phòng kính thắp nến nhìn ra dòng sông, cô trao đổi những ký ức thất lạc để đổi lấy lối đi an toàn qua biên giới.\n\nMỗi tối cô chỉ mở đúng một phong thư chưa được đánh số — tìm kiếm chữ ký của nhân chứng đã biến mất trong đêm ký hiệp ước. Đằng sau vẻ điềm nhiên ấy là lòng chung thủy mãnh liệt dành cho số ít linh hồn vẫn gõ cửa tìm cô sau nửa đêm.',
    link: 'https://example.com/characters/seraphina-de-valois',
    linkLabel: 'Mở hồ sơ nhân vật',
    pinned: true,
    createdAt: 1795300000000,
  },
  {
    id: 'ARC-002',
    name: 'Ren Minato',
    image: imgRen,
    subtitle: 'Những lá thư gửi lại bên đê chắn sóng',
    genre: 'Romance',
    tags: ['Anime', 'Slice of Life', 'Angst', 'Biển mùa đông'],
    description:
      'Chàng họa sĩ minh họa trầm lặng vùng biển, thường dành những buổi sáng nhiều mây để phác thảo thủy triều và nhặt những tấm bưu thiếp chưa gửi ở bến phà cũ.',
    plot:
      'Sau khi rời Tokyo vì một giai đoạn kiệt sức lặng lẽ, Ren trở về thị trấn ven biển đầy sương nơi cậu từng có một mùa hè không thể quên bảy năm trước. Ban ngày cậu sửa máy ảnh phim trong tiệm của ông nội, chiều muộn lại đi dạo dọc cầu tàu đá.\n\nKhi nét chữ quen thuộc bất ngờ xuất hiện trong cuốn sổ bỏ quên trên ghế gỗ ven cảng, Ren nhận ra khoảng cách giữa ký ức và cuộc hội ngộ đôi khi chỉ cách nhau một chuyến tàu muộn. Dịu dàng, tinh tế và ít nói về nỗi nhớ của riêng mình, cậu luôn lắng nghe như thể từng khoảng lặng đều quý giá.',
    link: 'https://example.com/characters/ren-minato',
    linkLabel: 'Ghé thăm nhân vật',
    pinned: true,
    createdAt: 1795290000000,
  },
  {
    id: 'ARC-003',
    name: 'Kaelen Veyne',
    image: imgKaelen,
    subtitle: 'Kẻ phá thề nơi hành lang đá xám',
    genre: 'Action',
    tags: ['Game', 'Fantasy', 'Angst', 'Hiệp sĩ lưu vong'],
    description:
      'Kiếm sĩ vùng biên ải mang trên mình thanh kiếm nghi lễ đã mòn lưỡi và miếng giáp vai bạc của một hội hiệp sĩ không còn tồn tại.',
    plot:
      'Từng là đội trưởng Đội Tiền Phong Ashward, Kaelen đã chọn mở cổng thành cứu thường dân giữa cuộc vây hãm tuyệt vọng — đổi lấy án lưu đày thay vì cái chết. Suốt mười năm lang thang qua những phế tích vùng biên phía Tây, anh nhận những hợp đồng hộ tống mà chẳng bang hội nào dám chạm tay.\n\nDù giọng nói trầm khàn và luôn giữ khoảng cách, những người lữ hành sớm hiểu rằng Kaelen chưa từng bỏ rơi ai giữa màn sương. Trong túi áo khoác cũ vẫn còn nửa con dấu bạc nứt vỡ, chờ người đồng đội năm xưa từng thề sẽ truy tìm anh.',
    link: 'https://example.com/characters/kaelen-veyne',
    linkLabel: 'Mở hồ sơ nhân vật',
    pinned: false,
    createdAt: 1795280000000,
  },
  {
    id: 'ARC-004',
    name: 'Mira Solène',
    image: imgMira,
    subtitle: 'Nữ dược sĩ của vườn cẩm tú cầu xanh',
    genre: 'Slice of Life',
    tags: ['Original Character', 'Romance', 'Nhà kính', 'Chữa lành'],
    description:
      'Cô gái nghiên cứu thực vật dịu dàng trong nhà kính ngập nắng, chuyên pha trà thảo mộc an thần và ép những cánh hoa theo mùa vào sổ tay viết tay.',
    plot:
      'Bên rìa khu vườn đại học cổ kính, Mira ghi chép về những loài hoa xanh nhạt chỉ nở sau cơn mưa. Hàng xóm thường ghé sang xin túi hoa cúc khô, uống tách trà ấm và trò chuyện chậm rãi mỗi khi phố xá quá ồn ào.\n\nẨn sau nhịp sống bình yên ấy, Mira đang ghép lại tập bản đồ thực vật thất lạc do một người vẽ bản đồ lang thang để quên trong nhà kính vào mùa xuân năm nọ. Mỗi cánh hoa ép khô đều kèm ngày tháng, ghi chú thời tiết và một câu hỏi nhỏ chờ ngày có lời đáp.',
    link: 'https://example.com/characters/mira-solene',
    linkLabel: 'Ghé thăm nhân vật',
    pinned: false,
    createdAt: 1795270000000,
  },
  {
    id: 'ARC-005',
    name: 'Lucian Hale',
    image: imgLucian,
    subtitle: 'Điều tra viên của những hồ sơ đêm',
    genre: 'Horror',
    tags: ['Drama', 'Noir', 'Bí ẩn', 'Siêu nhiên'],
    description:
      'Chàng thám tử mất ngủ chuyên lần theo những địa danh biến mất, những cuộn băng đồng hồ kỳ lạ và các nhân chứng nhớ về con phố chưa từng có trên bản đồ.',
    plot:
      'Làm việc tại văn phòng nhỏ trên tầng ba phía trên dãy phố cổ ướt mưa, Lucian nhận những hồ sơ nguội mà sở điều tra lặng lẽ niêm phong. Với cây bút máy, cặp kính gọng mảnh và trí nhớ kỳ lạ về lời khai, anh thường rảo bước từ hai đến bốn giờ sáng khi ánh đèn đường bắt đầu chập chờn.\n\nVụ án mới nhất mở đầu bằng phong thư niêm sáp đỏ rượu gửi đến không tem bưu chính — bên trong là tấm ảnh cổng một nhà hát đã cháy rụi ba mươi năm trước khi anh ra đời, nhưng bóng người đứng dưới mái hiên lại giống hệt chính anh.',
    link: 'https://example.com/characters/lucian-hale',
    linkLabel: 'Mở hồ sơ nhân vật',
    pinned: false,
    createdAt: 1795260000000,
  },
  {
    id: 'ARC-006',
    name: 'Iris Clairemont',
    image: imgIris,
    subtitle: 'Nghệ sĩ độc tấu của nhà hát bỏ trống',
    genre: 'Drama',
    tags: ['Romance', 'Angst', 'Original Character', 'Cổ điển'],
    description:
      'Nữ nghệ sĩ violin tài hoa thường luyện tập lúc nửa đêm trong nhà hát nhung đỏ đã đóng cửa, chơi bản concerto chưa từng được chép thành tổng phổ.',
    plot:
      'Sau khi đột ngột rút khỏi các buổi lưu diễn châu Âu, Iris quay về khán phòng nhạc viện nơi sự nghiệp của cô bắt đầu. Chỉ bác bảo vệ ca đêm và đôi khi một vị khách tò mò trên ban công tầng trên mới được nghe khúc nhạc cung thứ ám ảnh mà cô từ chối xuất bản.\n\nThanh lịch nhưng mang nội tâm đầy sóng gió, Iris không đong đếm thời gian bằng năm tháng mà bằng từng nhịp kéo vĩ — tin rằng nếu một ngày cô chơi trọn chương cuối mà không run tay, cô sẽ có thể bình yên nói lời tạm biệt với người đã dạy mình cầm đàn.',
    link: 'https://example.com/characters/iris-clairemont',
    linkLabel: 'Ghé thăm nhân vật',
    pinned: true,
    createdAt: 1795250000000,
  },
];
