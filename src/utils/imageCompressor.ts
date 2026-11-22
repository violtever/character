/**
 * Compresses an uploaded image file on the client so it stays compact
 * and well below Firestore's 250,000-char image field limit.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 760,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Tệp hình ảnh không hợp lệ.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length > 240000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.62);
        }
        if (dataUrl.length > 245000) {
          reject(
            new Error(
              'Ảnh quá lớn sau khi nén. Vui lòng chọn ảnh nhẹ hơn hoặc dùng đường dẫn ảnh (URL).'
            )
          );
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
