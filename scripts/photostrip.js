/**
 * =========================================================================
 * PHOTOSTRIP KOLABORASI ENGINE
 * Multi-user 4-slot collaborative photostrip with live camera & high-res canvas exporter
 * =========================================================================
 */

// 5 Curated Design Templates
const PHOTOSTRIP_TEMPLATES = [
  {
    id: 'classic-film',
    name: 'Classic Retro Film',
    desc: 'Nuansa film analog 35mm klasik dengan bingkai gelap estetik',
    bgColor: '#18181B',
    textColor: '#F4F4F5',
    accentColor: '#E4E4E7',
    subColor: '#A1A1AA',
    borderClass: 'template-classic-film'
  },
  {
    id: 'minimal-white',
    name: 'Clean Studio White',
    desc: 'Gaya Korean photo studio bersih, minimalis, dan elegan',
    bgColor: '#FFFFFF',
    textColor: '#0F172A',
    accentColor: '#D87A3E',
    subColor: '#64748B',
    borderClass: 'template-minimal-white'
  },
  {
    id: 'warm-earthy',
    name: 'Warm Sand & Latte',
    desc: 'Palet hangat kopi & cream bertema Rundown Meetup Latsar',
    bgColor: '#EFE8DA',
    textColor: '#3E271D',
    accentColor: '#C5984A',
    subColor: '#7A4E3A',
    borderClass: 'template-warm-earthy'
  },
  {
    id: 'pastel-matcha',
    name: 'Pastel Matcha Sage',
    desc: 'Nuansa hijau sage lembut dan segar dengan aksen ceria',
    bgColor: '#E2ECE4',
    textColor: '#1B4332',
    accentColor: '#2D6A4F',
    subColor: '#52796F',
    borderClass: 'template-pastel-matcha'
  },
  {
    id: 'cyber-midnight',
    name: 'Cyber Midnight Glow',
    desc: 'Gaya pesta malam modern dengan aksen neon berenergi',
    bgColor: '#0F172A',
    textColor: '#38BDF8',
    accentColor: '#F43F5E',
    subColor: '#94A3B8',
    borderClass: 'template-cyber-midnight'
  }
];

/**
 * Photostrip Storage & Persistence Manager (IndexedDB)
 */
const PhotostripStorage = {
  dbName: 'RundownPhotostripDB',
  dbVersion: 1,
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('photostrips')) {
          const store = db.createObjectStore('photostrips', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Photostrip IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  },

  async getAllStrips() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('photostrips', 'readonly');
      const store = tx.objectStore('photostrips');
      const req = store.getAll();

      req.onsuccess = () => {
        const strips = (req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(strips);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async saveStrip(strip) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('photostrips', 'readwrite');
      const store = tx.objectStore('photostrips');
      const req = store.put(strip);
      req.onsuccess = () => resolve(strip);
      req.onerror = () => reject(req.error);
    });
  },

  async getStrip(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('photostrips', 'readonly');
      const store = tx.objectStore('photostrips');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async createDefaultIfEmpty() {
    const strips = await this.getAllStrips();
    if (strips.length === 0) {
      const defaultStrip = {
        id: 'strip-init-1',
        title: 'Photostrip Meetup Latsar 2026',
        creator: 'Surya',
        templateId: 'classic-film',
        createdAt: new Date().toISOString(),
        slots: [
          { slotIndex: 0, photoUrl: null, userName: null, timestamp: null },
          { slotIndex: 1, photoUrl: null, userName: null, timestamp: null },
          { slotIndex: 2, photoUrl: null, userName: null, timestamp: null },
          { slotIndex: 3, photoUrl: null, userName: null, timestamp: null }
        ],
        isComplete: false
      };
      await this.saveStrip(defaultStrip);
      return [defaultStrip];
    }
    return strips;
  }
};

/**
 * Main Photostrip App
 */
const PhotostripApp = {
  strips: [],
  activeFilter: 'all',
  activeTargetSlot: null, // { stripId, slotIndex }
  selectedTemplateId: 'classic-film',

  // Camera State
  stream: null,
  currentFacingMode: 'user',
  isMirrored: true,
  capturedBlobUrl: null,

  async init() {
    await PhotostripStorage.init();
    this.strips = await PhotostripStorage.createDefaultIfEmpty();
    this.renderTemplateSelector();
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Filter buttons
    document.querySelectorAll('.strip-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.strip-filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeFilter = e.currentTarget.dataset.filter;
        this.render();
      });
    });

    // Create Strip modal open
    const btnOpenCreate = document.getElementById('btn-open-create-strip');
    if (btnOpenCreate) {
      btnOpenCreate.addEventListener('click', () => this.openCreateModal());
    }

    // Create Strip form submit
    const createForm = document.getElementById('form-create-strip');
    if (createForm) {
      createForm.addEventListener('submit', (e) => this.handleCreateStrip(e));
    }

    // Camera Modal controls
    const btnCapture = document.getElementById('strip-btn-capture');
    if (btnCapture) btnCapture.addEventListener('click', () => this.capturePhoto());

    const btnFlipCam = document.getElementById('strip-btn-flip');
    if (btnFlipCam) btnFlipCam.addEventListener('click', () => this.toggleCameraFacing());

    const btnMirror = document.getElementById('strip-btn-mirror');
    if (btnMirror) btnMirror.addEventListener('click', () => this.toggleMirror());

    const btnRetake = document.getElementById('strip-btn-retake');
    if (btnRetake) btnRetake.addEventListener('click', () => this.resetCameraToLive());

    const btnConfirmPhoto = document.getElementById('strip-btn-confirm');
    if (btnConfirmPhoto) btnConfirmPhoto.addEventListener('click', () => this.confirmSlotPhoto());
  },

  renderTemplateSelector() {
    const container = document.getElementById('template-selector-container');
    if (!container) return;

    container.innerHTML = PHOTOSTRIP_TEMPLATES.map(t => {
      const isSel = t.id === this.selectedTemplateId;
      return `
        <div class="template-option-card ${isSel ? 'selected' : ''}" data-template-id="${t.id}" onclick="PhotostripApp.selectTemplate('${t.id}')">
          <div class="template-mini-preview" style="background: ${t.bgColor};">
            <div class="mini-slot" style="border: 1px solid ${t.subColor};"></div>
            <div class="mini-slot" style="border: 1px solid ${t.subColor};"></div>
            <div class="mini-slot" style="border: 1px solid ${t.subColor};"></div>
            <div class="mini-slot" style="border: 1px solid ${t.subColor};"></div>
          </div>
          <span class="template-name">${t.name}</span>
        </div>
      `;
    }).join('');
  },

  selectTemplate(templateId) {
    this.selectedTemplateId = templateId;
    document.querySelectorAll('.template-option-card').forEach(el => {
      el.classList.toggle('selected', el.dataset.templateId === templateId);
    });
  },

  async handleCreateStrip(e) {
    e.preventDefault();
    const titleInput = document.getElementById('input-strip-title');
    const creatorInput = document.getElementById('input-strip-creator');

    const title = (titleInput && titleInput.value.trim()) || 'Photostrip Kolaborasi';
    const creator = (creatorInput && creatorInput.value.trim()) || 'Teman Main';

    const newStrip = {
      id: `strip-${Date.now()}`,
      title: title,
      creator: creator,
      templateId: this.selectedTemplateId,
      createdAt: new Date().toISOString(),
      slots: [
        { slotIndex: 0, photoUrl: null, userName: null, timestamp: null },
        { slotIndex: 1, photoUrl: null, userName: null, timestamp: null },
        { slotIndex: 2, photoUrl: null, userName: null, timestamp: null },
        { slotIndex: 3, photoUrl: null, userName: null, timestamp: null }
      ],
      isComplete: false
    };

    await PhotostripStorage.saveStrip(newStrip);
    this.strips.unshift(newStrip);
    this.closeCreateModal();
    this.render();

    if (typeof showToast === 'function') {
      showToast('Photostrip baru berhasil dibuat! Klik slot untuk mengambil foto 📸', 'success');
    }
  },

  openCreateModal() {
    const modal = document.getElementById('create-strip-modal');
    if (modal) modal.classList.add('is-open');
  },

  closeCreateModal() {
    const modal = document.getElementById('create-strip-modal');
    if (modal) modal.classList.remove('is-open');
  },

  render() {
    const grid = document.getElementById('photostrips-grid');
    if (!grid) return;

    let filtered = this.strips;
    if (this.activeFilter === 'incomplete') {
      filtered = filtered.filter(s => !s.isComplete);
    } else if (this.activeFilter === 'complete') {
      filtered = filtered.filter(s => s.isComplete);
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: #F8FAFC; border-radius: var(--radius-lg); border: 1.5px dashed var(--strip-border);">
          <i class="ph ph-film-strip" style="font-size: 2.5rem; color: #94A3B8; margin-bottom: 12px; display: block;"></i>
          <h4 style="font-size: 1.1rem; font-weight: 800; color: #1E293B;">Belum Ada Photostrip</h4>
          <p style="font-size: 0.88rem; color: #64748B; margin: 6px 0 16px 0;">Ayo buat photostrip pertama dan ajak temanmu berfoto bersama!</p>
          <button class="btn btn-primary btn-sm" onclick="PhotostripApp.openCreateModal()">
            <i class="ph ph-plus-circle"></i> Buat Photostrip Baru
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(strip => {
      const template = PHOTOSTRIP_TEMPLATES.find(t => t.id === strip.templateId) || PHOTOSTRIP_TEMPLATES[0];
      const filledCount = strip.slots.filter(s => s.photoUrl).length;
      const isComplete = filledCount === 4;

      return `
        <div class="photostrip-card">
          <div class="strip-card-header">
            <div>
              <h3 class="strip-card-title">${this.escapeHtml(strip.title)}</h3>
              <span class="strip-card-creator">
                <i class="ph ph-user"></i> Oleh <strong>${this.escapeHtml(strip.creator)}</strong> • ${new Date(strip.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <span class="strip-progress-badge ${isComplete ? 'is-complete' : 'is-incomplete'}">
              ${isComplete ? '✨ Lengkap (4/4)' : `${filledCount}/4 Foto`}
            </span>
          </div>

          <!-- Vertical Photostrip Visual -->
          <div class="photostrip-wrapper ${template.borderClass}">
            <div class="strip-header-banner">
              ${this.escapeHtml(strip.title)}
            </div>

            <div class="strip-slots-container">
              ${strip.slots.map(slot => {
                if (slot.photoUrl) {
                  return `
                    <div class="strip-slot" title="Klik untuk mengganti foto ${slot.userName ? 'oleh ' + slot.userName : ''}" onclick="PhotostripApp.openCameraForSlot('${strip.id}', ${slot.slotIndex})">
                      <img src="${slot.photoUrl}" alt="Slot ${slot.slotIndex + 1}" class="filled-slot-img" loading="lazy">
                      <span class="filled-slot-tag">${this.escapeHtml(slot.userName || 'Foto ' + (slot.slotIndex + 1))}</span>
                    </div>
                  `;
                } else {
                  return `
                    <div class="strip-slot is-empty" onclick="PhotostripApp.openCameraForSlot('${strip.id}', ${slot.slotIndex})" title="Klik untuk mengambil foto slot ${slot.slotIndex + 1}">
                      <div class="empty-slot-prompt">
                        <i class="ph ph-camera empty-slot-icon"></i>
                        <span class="empty-slot-text">+ Slot ${slot.slotIndex + 1}</span>
                        <span class="empty-slot-sub">Klik foto</span>
                      </div>
                    </div>
                  `;
                }
              }).join('')}
            </div>

            <div class="strip-footer-banner">
              <span>MEETUP LATSAR 2026</span>
              <span style="font-size: 0.6rem; opacity: 0.75;">${new Date(strip.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="strip-card-actions">
            ${isComplete ? `
              <button class="btn btn-primary" onclick="PhotostripApp.exportAndDownload('${strip.id}')">
                <i class="ph ph-download-simple"></i> Unduh Photostrip HD
              </button>
            ` : `
              <button class="btn btn-outline" onclick="PhotostripApp.openCameraForNextEmptySlot('${strip.id}')">
                <i class="ph ph-camera"></i> Isi Foto Berikutnya (${filledCount}/4)
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  },

  openCameraForNextEmptySlot(stripId) {
    const strip = this.strips.find(s => s.id === stripId);
    if (!strip) return;
    const emptySlot = strip.slots.find(s => !s.photoUrl);
    if (emptySlot) {
      this.openCameraForSlot(stripId, emptySlot.slotIndex);
    } else {
      this.exportAndDownload(stripId);
    }
  },

  /**
   * Camera Module Integration
   */
  async openCameraForSlot(stripId, slotIndex) {
    this.activeTargetSlot = { stripId, slotIndex };
    const modal = document.getElementById('strip-camera-modal');
    const slotBadge = document.getElementById('strip-camera-slot-badge');
    if (slotBadge) {
      slotBadge.textContent = `Mengisi Slot #${slotIndex + 1} dari 4`;
    }

    if (modal) modal.classList.add('is-open');
    this.resetCameraToLive();
    await this.startStream();
  },

  closeCameraModal() {
    this.stopStream();
    const modal = document.getElementById('strip-camera-modal');
    if (modal) modal.classList.remove('is-open');
    this.activeTargetSlot = null;
  },

  async startStream() {
    this.stopStream();
    const video = document.getElementById('strip-video-feed');
    if (!video) return;

    try {
      // Natural unzoomed optical resolution matching camera.js without digital sensor crop
      const constraints = {
        video: {
          facingMode: { ideal: this.currentFacingMode },
          width: { ideal: 1920 },
          height: { ideal: 1440 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = this.stream;
      await video.play();

      const track = this.stream && this.stream.getVideoTracks()[0];
      const trackSettings = (track && track.getSettings) ? track.getSettings() : {};
      const isUserFacing = (trackSettings.facingMode === 'user') || (this.currentFacingMode === 'user');
      this.isMirrored = isUserFacing;
      this.applyMirrorTransform();
    } catch (err) {
      console.warn('Camera stream error:', err);
      if (typeof showToast === 'function') {
        showToast('Izin kamera ditolak atau tidak tersedia.', 'error');
      }
    }
  },

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  },

  toggleCameraFacing() {
    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    this.isMirrored = this.currentFacingMode === 'user';
    this.startStream();
  },

  toggleMirror() {
    this.isMirrored = !this.isMirrored;
    this.applyMirrorTransform();
  },

  applyMirrorTransform() {
    const video = document.getElementById('strip-video-feed');
    const mirrorBtn = document.getElementById('strip-btn-mirror');
    if (video) {
      video.style.transform = this.isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
    }
    if (mirrorBtn) {
      mirrorBtn.classList.toggle('active', this.isMirrored);
    }
  },

  capturePhoto() {
    const video = document.getElementById('strip-video-feed');
    const streamContainer = document.getElementById('strip-camera-stream-wrapper') || (video && video.parentElement);
    if (!video || !this.stream) return;

    const vw = video.videoWidth || 1440;
    const vh = video.videoHeight || 1920;

    const boxWidth = streamContainer && streamContainer.clientWidth ? streamContainer.clientWidth : 360;
    const boxHeight = streamContainer && streamContainer.clientHeight ? streamContainer.clientHeight : 480;
    const targetAspect = (boxWidth && boxHeight) ? (boxWidth / boxHeight) : (3 / 4);

    const videoAspect = vw / vh;

    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;

    // Perform exact WYSIWYG unzoomed crop matching object-fit: cover
    if (videoAspect > targetAspect) {
      sw = vh * targetAspect;
      sh = vh;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      sw = vw;
      sh = vw / targetAspect;
      sx = 0;
      sy = (vh - sh) / 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');

    if (this.isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    // Compress to efficient JPEG dataUrl
    this.capturedBlobUrl = canvas.toDataURL('image/jpeg', 0.88);

    // Show preview box
    const liveView = document.getElementById('strip-camera-live-view');
    const reviewView = document.getElementById('strip-camera-review-view');
    const previewImg = document.getElementById('strip-camera-preview-img');

    if (previewImg) previewImg.src = this.capturedBlobUrl;
    if (liveView) liveView.style.display = 'none';
    if (reviewView) reviewView.style.display = 'block';

    this.stopStream();
  },

  resetCameraToLive() {
    const liveView = document.getElementById('strip-camera-live-view');
    const reviewView = document.getElementById('strip-camera-review-view');
    if (liveView) liveView.style.display = 'block';
    if (reviewView) reviewView.style.display = 'none';
    this.capturedBlobUrl = null;
    this.startStream();
  },

  async confirmSlotPhoto() {
    if (!this.capturedBlobUrl || !this.activeTargetSlot) return;

    const nameInput = document.getElementById('strip-user-name-input');
    const userName = (nameInput && nameInput.value) || 'Teman Main';

    const { stripId, slotIndex } = this.activeTargetSlot;
    const strip = this.strips.find(s => s.id === stripId);

    if (strip) {
      strip.slots[slotIndex] = {
        slotIndex: slotIndex,
        photoUrl: this.capturedBlobUrl,
        userName: userName,
        timestamp: new Date().toISOString()
      };

      // Check if all slots filled
      strip.isComplete = strip.slots.every(s => s.photoUrl !== null);

      await PhotostripStorage.saveStrip(strip);

      // Also backup photo to Google Drive under Rundown Meetup folder if connected
      if (window.AppStorage && typeof window.AppStorage.savePhoto === 'function') {
        window.AppStorage.savePhoto({
          spotId: `photostrip-${strip.id}`,
          spotName: `Photostrip - ${strip.title} (Slot ${slotIndex + 1})`,
          userName: userName,
          timestamp: new Date().toISOString(),
          webDataUrl: this.capturedBlobUrl,
          thumbDataUrl: this.capturedBlobUrl
        }).catch(err => console.warn('Photostrip cloud backup note:', err));
      }

      this.closeCameraModal();
      this.render();

      if (typeof showToast === 'function') {
        if (strip.isComplete) {
          showToast(`Semua 4 slot terisi! Photostrip siap diunduh 🎉`, 'success');
        } else {
          showToast(`Slot #${slotIndex + 1} berhasil diisi oleh ${userName}! ✨`, 'success');
        }
      }
    }
  },

  /**
   * HTML5 Canvas High-Resolution Exporter & Download
   */
  async exportAndDownload(stripId) {
    const strip = this.strips.find(s => s.id === stripId);
    if (!strip) return;

    if (typeof showToast === 'function') {
      showToast('Membuat Photostrip resolusi tinggi... 🎨', 'info');
    }

    const template = PHOTOSTRIP_TEMPLATES.find(t => t.id === strip.templateId) || PHOTOSTRIP_TEMPLATES[0];

    // High resolution canvas: 1200 x 3800 px (Crisp for print & social media)
    const canvas = document.createElement('canvas');
    const W = 1200;
    const H = 3800;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 1. Draw Background
    ctx.fillStyle = template.bgColor;
    ctx.fillRect(0, 0, W, H);

    // If cyber theme: draw subtle gradient
    if (template.id === 'cyber-midnight') {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0F172A');
      grad.addColorStop(1, '#1E1B4B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Draw Classic Sprocket Holes if classic film
    if (template.id === 'classic-film') {
      ctx.fillStyle = '#27272A';
      const holeW = 28;
      const holeH = 42;
      const holeGap = 70;
      for (let y = 80; y < H - 80; y += holeGap) {
        // Left side sprockets
        ctx.beginPath();
        ctx.roundRect(24, y, holeW, holeH, 6);
        ctx.fill();

        // Right side sprockets
        ctx.beginPath();
        ctx.roundRect(W - 24 - holeW, y, holeW, holeH, 6);
        ctx.fill();
      }
    }

    // 3. Draw Header
    const marginX = template.id === 'classic-film' ? 100 : 70;
    const photoW = W - (marginX * 2);
    const photoH = Math.round(photoW * 0.75); // 4:3 ratio

    ctx.textAlign = 'center';
    ctx.fillStyle = template.textColor;
    ctx.font = 'bold 54px Plus Jakarta Sans, sans-serif';
    ctx.fillText(strip.title.toUpperCase(), W / 2, 160);

    ctx.fillStyle = template.subColor;
    ctx.font = '600 32px Plus Jakarta Sans, sans-serif';
    ctx.fillText(`KOLABORASI OLEH ${strip.creator.toUpperCase()}`, W / 2, 220);

    // 4. Draw 4 Photos
    const startY = 270;
    const slotGap = 50;

    for (let i = 0; i < 4; i++) {
      const slot = strip.slots[i];
      const slotY = startY + (i * (photoH + slotGap + 40));

      // Draw Photo Mat / Frame
      ctx.fillStyle = template.id === 'classic-film' ? '#27272A' : (template.id === 'minimal-white' ? '#F8FAFC' : '#FFFFFF');
      ctx.beginPath();
      ctx.roundRect(marginX - 10, slotY - 10, photoW + 20, photoH + 20, 16);
      ctx.fill();

      if (slot && slot.photoUrl) {
        const img = await this.loadImage(slot.photoUrl);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(marginX, slotY, photoW, photoH, 12);
        ctx.clip();
        ctx.drawImage(img, marginX, slotY, photoW, photoH);
        ctx.restore();

        // Draw Contributor label
        ctx.textAlign = 'left';
        ctx.fillStyle = template.textColor;
        ctx.font = 'bold 28px Plus Jakarta Sans, sans-serif';
        ctx.fillText(`Slot ${i + 1} • ${slot.userName || 'Teman'}`, marginX + 10, slotY + photoH + 34);
      } else {
        // Empty slot placeholder
        ctx.fillStyle = '#CBD5E1';
        ctx.textAlign = 'center';
        ctx.font = 'italic 34px Plus Jakarta Sans, sans-serif';
        ctx.fillText(`+ Slot ${i + 1} (Belum Terisi)`, W / 2, slotY + (photoH / 2));
      }
    }

    // 5. Draw Footer
    const footerY = H - 120;
    ctx.textAlign = 'center';
    ctx.fillStyle = template.accentColor;
    ctx.font = 'bold 36px Plus Jakarta Sans, sans-serif';
    ctx.fillText('RUNDOWN MEETUP LATSAR 2026', W / 2, footerY);

    ctx.fillStyle = template.subColor;
    ctx.font = '500 28px Plus Jakarta Sans, sans-serif';
    const dateStr = new Date(strip.createdAt).toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    ctx.fillText(`Memory Vault • ${dateStr}`, W / 2, footerY + 45);

    // 6. Trigger Download
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `Photostrip_${strip.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof showToast === 'function') {
      showToast('Photostrip HD berhasil diunduh ke galeri perangkatmu! 📸🎉', 'success');
    }
  },

  loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img);
      img.src = src;
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  PhotostripApp.init();
});
