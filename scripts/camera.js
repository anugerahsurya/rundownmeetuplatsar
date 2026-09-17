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

  isMirrored: false,

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

    // Mirror toggle button
    const mirrorBtn = document.getElementById('camera-mirror-btn');
    if (mirrorBtn) {
      mirrorBtn.addEventListener('click', () => this.toggleMirror());
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

    // Use natural full optical resolution without forcing aggressive 9:16 sensor crop
    const constraints = {
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1440 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = this.stream;
      await video.play();

      // Automatically mirror if using front/selfie camera or webcam
      const track = this.stream && this.stream.getVideoTracks()[0];
      const trackSettings = (track && track.getSettings) ? track.getSettings() : {};
      const isUserFacing = (trackSettings.facingMode === 'user') || (this.facingMode === 'user');
      this.isMirrored = isUserFacing;
      this.updateMirrorUI();

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
    this.isMirrored = (this.facingMode === 'user');
    this.startStream();
  },

  toggleMirror() {
    this.isMirrored = !this.isMirrored;
    this.updateMirrorUI();
    if (typeof showToast === 'function') {
      showToast(this.isMirrored ? 'Mode cermin aktif (Mirror ON) 🪞' : 'Mode cermin nonaktif (Mirror OFF)', 'info');
    }
  },

  updateMirrorUI() {
    const video = document.getElementById('camera-video-feed');
    const mirrorBtn = document.getElementById('camera-mirror-btn');
    if (video) {
      video.style.transform = this.isMirrored ? 'scaleX(-1)' : 'none';
    }
    if (mirrorBtn) {
      if (this.isMirrored) {
        mirrorBtn.style.background = 'var(--brown-800)';
        mirrorBtn.style.color = '#FFF';
        mirrorBtn.style.borderColor = 'var(--brown-900)';
      } else {
        mirrorBtn.style.background = '';
        mirrorBtn.style.color = '';
        mirrorBtn.style.borderColor = '';
      }
    }
  },

  async capture() {
    const video = document.getElementById('camera-video-feed');
    const streamContainer = document.getElementById('camera-stream-wrapper');
    if (!video || !this.stream) return;

    const vw = video.videoWidth || 1440;
    const vh = video.videoHeight || 1920;

    // Determine target aspect ratio from the visible viewfinder container (default to 3:4 portrait)
    const boxWidth = streamContainer && streamContainer.clientWidth ? streamContainer.clientWidth : 360;
    const boxHeight = streamContainer && streamContainer.clientHeight ? streamContainer.clientHeight : 480;
    const targetAspect = (boxWidth && boxHeight) ? (boxWidth / boxHeight) : (3 / 4);

    const videoAspect = vw / vh;

    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;

    // Perform exact WYSIWYG crop matching object-fit: cover
    if (videoAspect > targetAspect) {
      // Video is wider than viewfinder (e.g. landscape sensor feed in a portrait container)
      sw = vh * targetAspect;
      sh = vh;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      // Video is taller than viewfinder
      sw = vw;
      sh = vw / targetAspect;
      sx = 0;
      sy = (vh - sh) / 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');

    // MIRROR EFFECT: If mirror mode is active, horizontally flip to match live reflection
    if (this.isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

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
