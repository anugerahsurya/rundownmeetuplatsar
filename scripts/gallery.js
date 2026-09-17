/**
 * Photo Gallery Module
 * Renders compressed photo feed, filters by spot/user, and displays lightbox modal
 */
const PhotoGallery = {
  photos: [],
  activeSpotFilter: 'all',
  activeUserFilter: 'all',
  currentViewingPhoto: null,

  async init() {
    this.bindEvents();
    await this.loadPhotos();

    // Listen for background sync updates
    window.addEventListener('photoSyncUpdate', (e) => {
      this.updateSinglePhotoSync(e.detail);
    });
  },

  bindEvents() {
    // Filter spot buttons
    const filterContainer = document.getElementById('gallery-spot-filters');
    if (filterContainer) {
      filterContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-pill');
        if (!btn) return;
        
        filterContainer.querySelectorAll('.filter-pill').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');

        this.activeSpotFilter = btn.dataset.spotId || 'all';
        this.render();
      });
    }

    // User filter dropdown
    const userSelect = document.getElementById('gallery-user-filter');
    if (userSelect) {
      userSelect.addEventListener('change', (e) => {
        this.activeUserFilter = e.target.value;
        this.render();
      });
    }

    // Lightbox close
    const lightboxClose = document.getElementById('lightbox-close-btn');
    if (lightboxClose) {
      lightboxClose.addEventListener('click', () => this.closeLightbox());
    }

    // Close lightbox on backdrop click
    const lightboxModal = document.getElementById('lightbox-modal');
    if (lightboxModal) {
      lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) this.closeLightbox();
      });
    }

    // Lightbox download
    const downloadBtn = document.getElementById('lightbox-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadCurrentPhoto());
    }

    // Lightbox delete
    const deleteBtn = document.getElementById('lightbox-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteCurrentPhoto());
    }

    // Lightbox resync Drive
    const syncBtn = document.getElementById('lightbox-sync-drive-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.resyncCurrentPhoto());
    }
  },

  async loadPhotos() {
    this.photos = await AppStorage.getAllPhotos();
    this.populateUserFilterOptions();
    this.render();

    // Asynchronously fetch photos from "Rundown Meetup" Google Drive so photos uploaded from other devices appear
    this.syncFromDriveBackground();
  },

  async syncFromDriveBackground() {
    try {
      const res = await AppStorage.syncFromDrive();
      if (res && res.updated) {
        this.photos = await AppStorage.getAllPhotos();
        this.populateUserFilterOptions();
        this.render();
        if (window.SphereGallery && typeof window.SphereGallery.renderSphere === 'function') {
          window.SphereGallery.renderSphere();
        }
      }
    } catch (e) {
      console.warn('Sync from drive notice:', e);
    }
  },

  populateUserFilterOptions() {
    const userSelect = document.getElementById('gallery-user-filter');
    if (!userSelect) return;

    const currentVal = userSelect.value;
    const defaultFriends = ['Surya', 'Zakki', 'Lia', 'Sofi'];
    const uploadedUsers = this.photos.map(p => p.userName).filter(Boolean);
    const users = Array.from(new Set([...defaultFriends, ...uploadedUsers]));

    userSelect.innerHTML = '<option value="all">Semua Teman (Semua Pengunggah)</option>' +
      users.map(u => `<option value="${this.escapeHtml(u)}">${this.escapeHtml(u)}</option>`).join('');

    if (users.includes(currentVal)) {
      userSelect.value = currentVal;
    }
  },

  render() {
    const grid = document.getElementById('gallery-grid-container');
    const emptyState = document.getElementById('gallery-empty-state');
    const countBadge = document.getElementById('gallery-count-badge');

    if (!grid) return;

    // Filter list
    let filtered = this.photos;
    if (this.activeSpotFilter !== 'all') {
      filtered = filtered.filter(p => p.spotId === this.activeSpotFilter);
    }
    if (this.activeUserFilter !== 'all') {
      filtered = filtered.filter(p => p.userName === this.activeUserFilter);
    }

    if (countBadge) {
      countBadge.textContent = `${filtered.length} Foto`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    grid.innerHTML = filtered.map(photo => {
      const timeStr = new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const initial = (photo.userName || 'T').charAt(0).toUpperCase();

      let syncBadgeHtml = '';
      if (photo.syncStatus === 'synced') {
        syncBadgeHtml = `<span class="badge-sync badge-synced" title="Tersimpan di Google Drive"><i class="ph ph-cloud-check"></i> Drive</span>`;
      } else if (photo.syncStatus === 'syncing') {
        syncBadgeHtml = `<span class="badge-sync badge-syncing" title="Sedang menyinkronkan ke Drive"><i class="ph ph-arrows-clockwise spin"></i> Sync</span>`;
      } else if (photo.syncStatus === 'error') {
        syncBadgeHtml = `<span class="badge-sync badge-error" title="Gagal sync Drive"><i class="ph ph-warning-circle"></i> Error</span>`;
      } else {
        syncBadgeHtml = `<span class="badge-sync badge-local" title="Tersimpan lokal di browser"><i class="ph ph-device-mobile"></i> Lokal</span>`;
      }

      return `
        <div class="gallery-card" onclick="PhotoGallery.openLightbox(${photo.id})">
          <div class="gallery-thumb-wrapper">
            <img src="${photo.thumbDataUrl || photo.webDataUrl}" alt="${this.escapeHtml(photo.spotName)}" loading="lazy" class="gallery-img">
            <div class="gallery-img-overlay">
              <span class="gallery-zoom-icon"><i class="ph ph-magnifying-glass-plus"></i></span>
            </div>
            <div class="gallery-card-badges">
              <span class="badge-saving">⚡ ${photo.webFormattedSize || 'ringan'}</span>
              ${syncBadgeHtml}
            </div>
          </div>
          <div class="gallery-info">
            <div class="gallery-spot-line">
              <span class="gallery-spot-name">${this.escapeHtml(photo.spotName)}</span>
            </div>
            <div class="gallery-meta-row">
              <div class="gallery-author">
                <span class="author-avatar">${initial}</span>
                <span class="author-name">${this.escapeHtml(photo.userName)}</span>
              </div>
              <span class="gallery-time">${timeStr}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  openLightbox(photoId) {
    const photo = this.photos.find(p => p.id === Number(photoId));
    if (!photo) return;

    this.currentViewingPhoto = photo;
    const modal = document.getElementById('lightbox-modal');
    if (!modal) return;

    const img = document.getElementById('lightbox-img');
    const spot = document.getElementById('lightbox-spot-name');
    const user = document.getElementById('lightbox-user-name');
    const time = document.getElementById('lightbox-time');
    const compressionInfo = document.getElementById('lightbox-compression-info');
    const driveStatus = document.getElementById('lightbox-drive-status');
    const driveLinkBtn = document.getElementById('lightbox-drive-link-btn');

    if (img) img.src = photo.webDataUrl;
    if (spot) spot.textContent = photo.spotName;
    if (user) user.textContent = photo.userName;
    if (time) time.textContent = new Date(photo.timestamp).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    if (compressionInfo) {
      compressionInfo.innerHTML = `
        <span>Ukuran Web: <strong>${photo.webFormattedSize}</strong></span>
        <span>Original: <del>${photo.originalFormattedSize || '-'}</del></span>
        <span class="badge-saving-inline">Hemat ${photo.savingsPercent}%</span>
      `;
    }

    if (driveStatus) {
      if (photo.syncStatus === 'synced') {
        driveStatus.className = 'drive-sync-pill synced';
        driveStatus.innerHTML = '<i class="ph ph-check-circle"></i> Tersimpan di Google Drive';
        if (driveLinkBtn && photo.driveUrl) {
          driveLinkBtn.style.display = 'inline-flex';
          driveLinkBtn.href = photo.driveUrl;
        } else if (driveLinkBtn) {
          driveLinkBtn.style.display = 'none';
        }
      } else if (photo.syncStatus === 'syncing') {
        driveStatus.className = 'drive-sync-pill syncing';
        driveStatus.innerHTML = '<i class="ph ph-arrows-clockwise spin"></i> Sedang mengunggah ke Drive...';
        if (driveLinkBtn) driveLinkBtn.style.display = 'none';
      } else if (photo.syncStatus === 'error') {
        driveStatus.className = 'drive-sync-pill error';
        driveStatus.innerHTML = '<i class="ph ph-warning-circle"></i> Gagal sync Drive (Klik Sinkron Ulang)';
        if (driveLinkBtn) driveLinkBtn.style.display = 'none';
      } else {
        driveStatus.className = 'drive-sync-pill local';
        driveStatus.innerHTML = '<i class="ph ph-device-mobile"></i> Tersimpan Lokal (Web Browser)';
        if (driveLinkBtn) driveLinkBtn.style.display = 'none';
      }
    }

    modal.classList.add('is-open');
  },

  closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) modal.classList.remove('is-open');
    this.currentViewingPhoto = null;
  },

  downloadCurrentPhoto() {
    if (!this.currentViewingPhoto) return;
    const a = document.createElement('a');
    a.href = this.currentViewingPhoto.webDataUrl;
    a.download = `Rundown_${this.currentViewingPhoto.spotName.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  async deleteCurrentPhoto() {
    if (!this.currentViewingPhoto) return;
    if (!confirm('Apakah Anda yakin ingin menghapus foto kenangan ini dari web?')) return;

    await AppStorage.deletePhoto(this.currentViewingPhoto.id);
    this.closeLightbox();
    showToast('Foto berhasil dihapus', 'info');
    await this.loadPhotos();
    if (window.SpherePreviewApp) {
      window.SpherePreviewApp.refreshPhotos();
    }
  },

  async resyncCurrentPhoto() {
    if (!this.currentViewingPhoto) return;
    const settings = AppStorage.getSettings();
    if (!settings.scriptUrl) {
      showToast('Atur URL Google Apps Script di Pengaturan ⚙️ terlebih dahulu!', 'warning');
      return;
    }

    showToast('Memulai sinkronisasi ke Google Drive...', 'info');
    await AppStorage.syncToDrive(this.currentViewingPhoto);
    this.openLightbox(this.currentViewingPhoto.id);
  },

  updateSinglePhotoSync(updatedPhoto) {
    const index = this.photos.findIndex(p => p.id === updatedPhoto.id);
    if (index !== -1) {
      this.photos[index] = updatedPhoto;
      this.render();
      if (this.currentViewingPhoto && this.currentViewingPhoto.id === updatedPhoto.id) {
        this.openLightbox(updatedPhoto.id);
      }
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
