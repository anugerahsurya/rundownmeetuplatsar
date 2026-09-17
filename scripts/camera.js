/**
 * Camera Module & Live Capture Pipeline
 * Manages video stream, switch camera, snapshot, file picker fallback, and compression review
 */
const CameraApp = {
  stream: null,
  facingMode: 'environment', // 'environment' (belakang) or 'user' (depan/selfie)
  capturedRawData: null,
  compressedResult: null,
  currentSpotId: 'spot-1',
  currentSpotName: 'Fotohokkie - Blok M',

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Camera trigger buttons
    const triggerBtn = document.getElementById('btn-open-camera-global');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => this.open());
    }

    // Modal close
    const closeBtn = document.getElementById('camera-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Shutter capture button
    const shutterBtn = document.getElementById('camera-shutter-btn');
    if (shutterBtn) {
      shutterBtn.addEventListener('click', () => this.capture());
    }

    // Switch camera (front / back)
    const switchBtn = document.getElementById('camera-switch-btn');
    if (switchBtn) {
      switchBtn.addEventListener('click', () => this.toggleFacingMode());
    }

    // File input fallback (pick from gallery/native camera)
    const fileInput = document.getElementById('camera-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    // Retake button
    const retakeBtn = document.getElementById('btn-retake-photo');
    if (retakeBtn) {
      retakeBtn.addEventListener('click', () => this.retake());
    }

    // Save & Upload photo button
    const saveBtn = document.getElementById('btn-save-photo');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveAndUpload());
    }

    // Spot select change
    const spotSelect = document.getElementById('camera-spot-select');
    if (spotSelect) {
      spotSelect.addEventListener('change', (e) => {
        this.currentSpotId = e.target.value;
        const selectedOption = e.target.options[e.target.selectedIndex];
        this.currentSpotName = selectedOption ? selectedOption.text : 'Lokasi Main';
      });
    }
  },

  openForSpot(spotId, spotName) {
    this.currentSpotId = spotId;
    this.currentSpotName = spotName;

    const spotSelect = document.getElementById('camera-spot-select');
    if (spotSelect) {
      spotSelect.value = spotId;
    }

    this.open();
  },

  async open() {
    const modal = document.getElementById('camera-modal');
    if (!modal) return;

    // Prefill user name from storage
    const settings = AppStorage.getSettings();
    const nameInput = document.getElementById('camera-user-name');
    if (nameInput && settings.defaultUserName) {
      nameInput.value = settings.defaultUserName;
    }

    modal.classList.add('is-open');
    this.showViewfinderState();

    await this.startStream();
  },

  close() {
    const modal = document.getElementById('camera-modal');
    if (modal) modal.classList.remove('is-open');
    this.stopStream();
    this.capturedRawData = null;
    this.compressedResult = null;
  },

  async startStream() {
    this.stopStream();
    const video = document.getElementById('camera-video-feed');
    if (!video) return;

    const constraints = {
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = this.stream;
      await video.play();
      document.getElementById('camera-stream-wrapper').classList.remove('camera-error');
    } catch (err) {
      console.warn('Cannot access live webcam stream:', err);
      // Fallback: notify and keep file picker ready
      document.getElementById('camera-stream-wrapper').classList.add('camera-error');
      const errorMsg = document.getElementById('camera-error-msg');
      if (errorMsg) {
        errorMsg.textContent = 'Kamera langsung tidak tersedia di peramban ini atau izin ditolak. Anda tetap bisa memilih atau memotret via galeri / native kamera di bawah.';
      }
    }
  },

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    const video = document.getElementById('camera-video-feed');
    if (video) video.srcObject = null;
  },

  toggleFacingMode() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.startStream();
  },

  async capture() {
    const video = document.getElementById('camera-video-feed');
    if (!video || !this.stream) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    // If front camera, mirror horizontally for natural feel
    if (this.facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    this.capturedRawData = rawDataUrl;
    this.stopStream();

    await this.processAndPreview(rawDataUrl);
  },

  async handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    this.stopStream();
    this.showProcessingState();

    try {
      await this.processAndPreview(file);
    } catch (err) {
      alert('Gagal memproses foto: ' + err.message);
      this.showViewfinderState();
    }
  },

  async processAndPreview(imageSource) {
    this.showProcessingState();

    try {
      // Compress with our client-side compressor
      this.compressedResult = await ImageCompressor.compress(imageSource, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.76,
        mimeType: 'image/jpeg'
      });

      // Update preview elements
      const previewImg = document.getElementById('camera-preview-img');
      if (previewImg) {
        previewImg.src = this.compressedResult.webDataUrl;
      }

      // Update compression metrics badges
      const rawSizeBadge = document.getElementById('preview-raw-size');
      const compSizeBadge = document.getElementById('preview-compressed-size');
      const savingBadge = document.getElementById('preview-saving-badge');

      if (rawSizeBadge) rawSizeBadge.textContent = this.compressedResult.originalFormattedSize;
      if (compSizeBadge) compSizeBadge.textContent = this.compressedResult.webFormattedSize;
      if (savingBadge) savingBadge.textContent = `Hemat ${this.compressedResult.savingsPercent}%`;

      this.showPreviewState();
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan kompresi gambar: ' + err.message);
      this.showViewfinderState();
    }
  },

  showViewfinderState() {
    document.getElementById('camera-viewfinder-screen').style.display = 'block';
    document.getElementById('camera-preview-screen').style.display = 'none';
    document.getElementById('camera-processing-screen').style.display = 'none';
  },

  showProcessingState() {
    document.getElementById('camera-viewfinder-screen').style.display = 'none';
    document.getElementById('camera-preview-screen').style.display = 'none';
    document.getElementById('camera-processing-screen').style.display = 'flex';
  },

  showPreviewState() {
    document.getElementById('camera-viewfinder-screen').style.display = 'none';
    document.getElementById('camera-preview-screen').style.display = 'block';
    document.getElementById('camera-processing-screen').style.display = 'none';
  },

  async retake() {
    this.capturedRawData = null;
    this.compressedResult = null;
    const fileInput = document.getElementById('camera-file-input');
    if (fileInput) fileInput.value = '';

    this.showViewfinderState();
    await this.startStream();
  },

  async saveAndUpload() {
    if (!this.compressedResult) return;

    const nameInput = document.getElementById('camera-user-name');
    const userName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : 'Teman Main';

    // Persist default username
    AppStorage.saveSettings({ defaultUserName: userName });

    const spotSelect = document.getElementById('camera-spot-select');
    const spotId = spotSelect ? spotSelect.value : this.currentSpotId;
    const spotName = spotSelect ? spotSelect.options[spotSelect.selectedIndex].text : this.currentSpotName;

    const saveBtn = document.getElementById('btn-save-photo');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...';
    }

    try {
      const photoRecord = await AppStorage.savePhoto({
        spotId,
        spotName,
        userName,
        timestamp: new Date().toISOString(),
        originalSize: this.compressedResult.originalSize,
        originalFormattedSize: this.compressedResult.originalFormattedSize,
        webSize: this.compressedResult.webSize,
        webFormattedSize: this.compressedResult.webFormattedSize,
        savingsPercent: this.compressedResult.savingsPercent,
        webDataUrl: this.compressedResult.webDataUrl,
        thumbDataUrl: this.compressedResult.thumbDataUrl
      });

      // Show toast
      const settings = AppStorage.getSettings();
      if (settings.scriptUrl) {
        showToast('Foto tersimpan & proses unggah ke Google Drive dimulai! ☁️', 'success');
      } else {
        showToast('Foto berhasil dikompres & disimpan ke Galeri! ✨', 'success');
      }

      this.close();

      // Refresh gallery view
      if (window.PhotoGallery) {
        window.PhotoGallery.loadPhotos();
      }

      // Refresh 3D sphere preview with newly added real photos
      if (window.SpherePreviewApp) {
        window.SpherePreviewApp.refreshPhotos();
      }

      // Scroll to gallery section smoothly
      const gallerySec = document.getElementById('gallery-section');
      if (gallerySec) {
        setTimeout(() => {
          gallerySec.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      }

    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan foto: ' + err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="ph ph-check-circle"></i> Simpan & Unggah';
      }
    }
  }
};
