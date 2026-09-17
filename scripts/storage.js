/**
 * Storage & Google Drive Synchronization Manager
 * Handles IndexedDB local persistence and Google Drive integration
 */
const AppStorage = {
  dbName: 'RundownMainDB',
  dbVersion: 1,
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('photos')) {
          const store = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
          store.createIndex('spotId', 'spotId', { unique: false });
          store.createIndex('userName', 'userName', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  },

  /**
   * Save a new compressed photo to IndexedDB and trigger Drive sync if configured
   */
  async savePhoto(photoData) {
    if (!this.db) await this.init();

    const record = {
      spotId: photoData.spotId,
      spotName: photoData.spotName,
      userName: photoData.userName || 'Teman Main',
      timestamp: photoData.timestamp || new Date().toISOString(),
      originalSize: photoData.originalSize || 0,
      originalFormattedSize: photoData.originalFormattedSize || '0 KB',
      webSize: photoData.webSize || 0,
      webFormattedSize: photoData.webFormattedSize || '0 KB',
      savingsPercent: photoData.savingsPercent || 0,
      webDataUrl: photoData.webDataUrl,
      thumbDataUrl: photoData.thumbDataUrl,
      syncStatus: 'local', // 'local' | 'syncing' | 'synced' | 'error'
      driveUrl: null,
      driveFileId: null,
      driveError: null
    };

    const id = await new Promise((resolve, reject) => {
      const tx = this.db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    record.id = id;

    // Check if Google Drive is configured; if so, trigger background upload
    const settings = this.getSettings();
    if (settings.scriptUrl && settings.scriptUrl.trim() !== '') {
      this.syncToDrive(record);
    }

    return record;
  },

  /**
   * Get all photos ordered by newest first
   */
  async getAllPhotos() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('photos', 'readonly');
      const store = tx.objectStore('photos');
      const req = store.getAll();

      req.onsuccess = () => {
        // Sort descending by timestamp
        const photos = (req.result || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        resolve(photos);
      };
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Delete a photo by ID
   */
  async deletePhoto(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      const req = store.delete(Number(id));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Update photo sync info
   */
  async updatePhoto(photo) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      const req = store.put(photo);
      req.onsuccess = () => resolve(photo);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Send photo to Google Apps Script Web App for Google Drive upload
   */
  async syncToDrive(photo) {
    const settings = this.getSettings();
    if (!settings.scriptUrl || settings.scriptUrl.trim() === '') {
      return { success: false, message: 'Google Drive Web App URL belum diatur di Pengaturan.' };
    }

    // Update status to syncing
    photo.syncStatus = 'syncing';
    await this.updatePhoto(photo);
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('photoSyncUpdate', { detail: photo }));
    }

    try {
      const payload = {
        base64Data: photo.webDataUrl,
        filename: `Rundown_${photo.spotName.replace(/[^a-zA-Z0-9]/g, '_')}_${photo.userName}_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        spotName: photo.spotName,
        userName: photo.userName,
        folderId: settings.folderId || ''
      };

      // Send to Apps Script Web App
      // Apps Script requires redirect follow or text/plain POST to bypass strict preflight
      const response = await fetch(settings.scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });

      const resText = await response.text();
      let resJson;
      try {
        resJson = JSON.parse(resText);
      } catch (e) {
        resJson = { status: 'success', message: 'Terkirim ke Apps Script' };
      }

      if (resJson.status === 'success' || response.ok) {
        photo.syncStatus = 'synced';
        photo.driveUrl = resJson.fileUrl || null;
        photo.driveFileId = resJson.fileId || null;
        photo.driveError = null;
      } else {
        photo.syncStatus = 'error';
        photo.driveError = resJson.message || 'Gagal menyimpan ke Drive';
      }
    } catch (err) {
      console.warn('Sync to Google Drive failed or CORS restricted:', err);
      // Even if CORS limits response reading, with no-cors or redirect it can still succeed, but we mark error/local with retry
      photo.syncStatus = 'error';
      photo.driveError = err.message || 'Koneksi ke Drive terputus';
    }

    await this.updatePhoto(photo);
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('photoSyncUpdate', { detail: photo }));
    }
    return photo;
  },

  /**
   * Settings management (localStorage)
   */
  getSettings() {
    return {
      scriptUrl: localStorage.getItem('gdrive_script_url') || '',
      folderId: localStorage.getItem('gdrive_folder_id') || '',
      folderName: localStorage.getItem('gdrive_folder_name') || 'Dokumentasi Rundown Main',
      defaultUserName: localStorage.getItem('rundown_user_name') || '',
      eventDate: localStorage.getItem('rundown_event_date') || '2026-09-27'
    };
  },

  saveSettings(newSettings) {
    if (newSettings.scriptUrl !== undefined) localStorage.setItem('gdrive_script_url', newSettings.scriptUrl.trim());
    if (newSettings.folderId !== undefined) localStorage.setItem('gdrive_folder_id', newSettings.folderId.trim());
    if (newSettings.folderName !== undefined) localStorage.setItem('gdrive_folder_name', newSettings.folderName.trim());
    if (newSettings.defaultUserName !== undefined) localStorage.setItem('rundown_user_name', newSettings.defaultUserName.trim());
    if (newSettings.eventDate !== undefined) localStorage.setItem('rundown_event_date', newSettings.eventDate);
    return this.getSettings();
  }
};
