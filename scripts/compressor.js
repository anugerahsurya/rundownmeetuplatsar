/**
 * Image Compressor Utility using HTML5 Canvas
 * Performs client-side dual-tier compression:
 * 1. Web-optimized version for smooth in-app gallery loading
 * 2. Thumbnail version for instant feed rendering
 */
const ImageCompressor = {
  /**
   * Reads a File or Blob or dataURL and compresses it
   * @param {File|Blob|string} imageSource 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async compress(imageSource, options = {}) {
    const maxWidth = options.maxWidth || 1280;
    const maxHeight = options.maxHeight || 1280;
    const quality = options.quality !== undefined ? options.quality : 0.75;
    const mimeType = options.mimeType || 'image/jpeg';

    const originalDataUrl = await this.toDataURL(imageSource);
    const originalSize = this.calculateByteSize(originalDataUrl);

    const img = await this.loadImage(originalDataUrl);

    // Calculate dimensions keeping aspect ratio
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }

    // 1. Generate Web Version
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Better interpolation
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const webDataUrl = canvas.toDataURL(mimeType, quality);
    const webSize = this.calculateByteSize(webDataUrl);

    // 2. Generate Micro Thumbnail Version (max 400px)
    const thumbMaxWidth = 420;
    let thumbW = img.width;
    let thumbH = img.height;
    if (thumbW > thumbH) {
      if (thumbW > thumbMaxWidth) {
        thumbH = Math.round((thumbH * thumbMaxWidth) / thumbW);
        thumbW = thumbMaxWidth;
      }
    } else {
      if (thumbH > thumbMaxWidth) {
        thumbW = Math.round((thumbW * thumbMaxWidth) / thumbH);
        thumbH = thumbMaxWidth;
      }
    }

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const thumbCtx = thumbCanvas.getContext('2d');
    thumbCtx.imageSmoothingEnabled = true;
    thumbCtx.imageSmoothingQuality = 'medium';
    thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);

    const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.65);
    const thumbSize = this.calculateByteSize(thumbDataUrl);

    const savedBytes = Math.max(0, originalSize - webSize);
    const savingsPercent = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;

    return {
      originalDataUrl,
      originalSize,
      originalFormattedSize: this.formatBytes(originalSize),
      webDataUrl,
      webSize,
      webFormattedSize: this.formatBytes(webSize),
      thumbDataUrl,
      thumbSize,
      thumbFormattedSize: this.formatBytes(thumbSize),
      savingsPercent,
      width,
      height
    };
  },

  /**
   * Helper to load Image from URL
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error('Gagal memuat gambar untuk kompresi: ' + err));
      img.src = src;
    });
  },

  /**
   * Convert File / Blob to Data URL
   */
  toDataURL(source) {
    return new Promise((resolve, reject) => {
      if (typeof source === 'string') {
        return resolve(source);
      }
      if (source instanceof Blob || source instanceof File) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(source);
      } else {
        reject(new Error('Format sumber gambar tidak didukung'));
      }
    });
  },

  /**
   * Approximate byte size of base64 data URL
   */
  calculateByteSize(dataUrl) {
    if (!dataUrl) return 0;
    const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
    return Math.floor(base64Length * 0.75);
  },

  /**
   * Format bytes to KB / MB
   */
  formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
};
