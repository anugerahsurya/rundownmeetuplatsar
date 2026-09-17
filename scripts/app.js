/**
 * Main Application Orchestrator
 * Connects Countdown, Camera, Gallery, Storage, and UI Modals
 */

// Global toast helper
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  
  let icon = '✨';
  if (type === 'success') icon = '✅';
  if (type === 'warning') icon = '⚠️';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-text">${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger entrance animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

const App = {
  async init() {
    console.log('🚀 Inisialisasi Web Rundown Main...');

    // 1. Initialize Storage
    await AppStorage.init();

    // 2. Initialize Countdown & Itinerary
    RundownCountdown.init();

    // 3. Initialize Camera
    CameraApp.init();

    // 4. Populate sample welcome photo if DB is completely clean
    await this.seedInitialPhotosIfNeeded();

    // 5. Initialize Gallery
    await PhotoGallery.init();

    // 6. Bind Global Settings & UI interactions
    this.bindSettingsModal();
    this.bindNavigation();
  },

  async seedInitialPhotosIfNeeded() {
    const existing = await AppStorage.getAllPhotos();
    if (existing.length === 0) {
      // Seed with a welcoming photo record using the generated dresscode illustration
      try {
        const response = await fetch('assets/dresscode.jpg');
        const blob = await response.blob();
        const compressed = await ImageCompressor.compress(blob, {
          maxWidth: 1200,
          quality: 0.78
        });

        await AppStorage.savePhoto({
          spotId: 'spot-1',
          spotName: 'Fotohokkie - Blok M',
          userName: 'Tim Rundown Main',
          timestamp: new Date().toISOString(),
          originalSize: compressed.originalSize,
          originalFormattedSize: compressed.originalFormattedSize,
          webSize: compressed.webSize,
          webFormattedSize: compressed.webFormattedSize,
          savingsPercent: compressed.savingsPercent,
          webDataUrl: compressed.webDataUrl,
          thumbDataUrl: compressed.thumbDataUrl
        });
      } catch (e) {
        console.log('Skipping seed photo:', e);
      }
    }
  },

  bindSettingsModal() {
    const openBtn = document.getElementById('btn-open-settings');
    const closeBtn = document.getElementById('settings-modal-close');
    const modal = document.getElementById('settings-modal');
    const form = document.getElementById('settings-form');

    const scriptInput = document.getElementById('setting-script-url');
    const folderInput = document.getElementById('setting-folder-id');
    const userNameInput = document.getElementById('setting-user-name');
    const dateInput = document.getElementById('setting-event-date');

    const openModal = () => {
      const settings = AppStorage.getSettings();
      if (scriptInput) scriptInput.value = settings.scriptUrl;
      if (folderInput) folderInput.value = settings.folderId;
      if (userNameInput) userNameInput.value = settings.defaultUserName;
      if (dateInput) {
        if (settings.eventDate) {
          dateInput.value = settings.eventDate;
        } else {
          // default today's date
          const today = new Date().toISOString().split('T')[0];
          dateInput.value = today;
        }
      }
      modal.classList.add('is-open');
    };

    const closeModal = () => {
      modal.classList.remove('is-open');
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        AppStorage.saveSettings({
          scriptUrl: scriptInput ? scriptInput.value : '',
          folderId: folderInput ? folderInput.value : '',
          defaultUserName: userNameInput ? userNameInput.value : '',
          eventDate: dateInput ? dateInput.value : ''
        });

        // Update countdown with new date if changed
        RundownCountdown.updateCountdown();

        showToast('Pengaturan Google Drive & Tanggal Berhasil Disimpan! ✅', 'success');
        closeModal();
      });
    }
  },

  bindNavigation() {
    // Quick scroll links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId && targetId !== '#') {
          const target = document.querySelector(targetId);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });

    // Hari H Preview Toggle for testing
    const toggleBtn = document.getElementById('btn-toggle-hari-h');
    const labelToggle = document.getElementById('label-toggle-hari-h');
    if (toggleBtn) {
      const updateToggleUI = () => {
        const isForce = sessionStorage.getItem('preview_hari_h') === 'true';
        if (isForce) {
          toggleBtn.classList.remove('btn-secondary');
          toggleBtn.classList.add('btn-primary');
          if (labelToggle) labelToggle.textContent = 'Mode Hari H: Aktif';
        } else {
          toggleBtn.classList.remove('btn-primary');
          toggleBtn.classList.add('btn-secondary');
          if (labelToggle) labelToggle.textContent = 'Simulasi Hari H';
        }
      };

      updateToggleUI();

      toggleBtn.addEventListener('click', () => {
        const isCurrentlyActive = sessionStorage.getItem('preview_hari_h') === 'true';
        sessionStorage.setItem('preview_hari_h', isCurrentlyActive ? 'false' : 'true');
        updateToggleUI();

        RundownCountdown.checkHariHStatus();
        const topSec = document.getElementById('top-sphere-preview-section');
        if (!isCurrentlyActive && topSec) {
          topSec.scrollIntoView({ behavior: 'smooth' });
          showToast('Pratinjau Galeri 3D Hari H diaktifkan di bagian atas! 📸✨', 'success');
        } else {
          showToast('Kembali ke tampilan sebelum Hari H.', 'info');
        }
      });
    }
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
