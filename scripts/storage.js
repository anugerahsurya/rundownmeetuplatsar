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
   * Clear all local photo records from IndexedDB
   */
  async clearAllPhotos() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Sync and fetch all photos stored in the "Rundown Meetup" Google Drive folder
   * Two-way reconciliation:
   * 1. Google Drive is the authoritative source of truth.
   * 2. Any photo deleted from Google Drive is automatically deleted from local storage immediately.
   * 3. Prevents browser or proxy caching by using dynamic cache-buster timestamps.
   */
  async syncFromDrive(forceClean = false) {
    if (!this.db) await this.init();
    const settings = this.getSettings();
    if (!settings.scriptUrl || settings.scriptUrl.trim() === '') {
      return { success: false, updated: false, message: 'URL Google Apps Script belum diatur' };
    }

    try {
      // Use cache-busting timestamp param to ensure neither browser nor CDN/proxy serves cached data
      const cacheBuster = (settings.scriptUrl.includes('?') ? '&' : '?') + '_cb=' + Date.now();
      const response = await fetch(settings.scriptUrl + cacheBuster, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        return { success: false, updated: false, message: 'Gagal menghubungi server Google Drive' };
      }

      const resJson = await response.json();
      if (resJson.status !== 'success' || !Array.isArray(resJson.photos)) {
        return { success: false, updated: false, message: resJson.message || 'Format data Drive tidak sesuai' };
      }

      const drivePhotos = resJson.photos;
      const driveFileIds = new Set(drivePhotos.map(p => String(p.driveFileId || p.id)));

      if (forceClean) {
        await this.clearAllPhotos();
      }

      const currentLocalPhotos = await this.getAllPhotos();
      let stateChanged = false;

      // 1. PURGE DELETED PHOTOS:
      // If user deleted photos in Google Drive, remove them from local storage immediately
      if (drivePhotos.length === 0) {
        // If Google Drive folder is empty, purge all local synced/old photos
        for (const localPhoto of currentLocalPhotos) {
          if (localPhoto.syncStatus !== 'syncing') {
            await this.deletePhoto(localPhoto.id);
            stateChanged = true;
          }
        }
      } else {
        for (const localPhoto of currentLocalPhotos) {
          const hasDriveRecord = localPhoto.driveFileId ? driveFileIds.has(String(localPhoto.driveFileId)) : false;
          
          if (localPhoto.driveFileId && !hasDriveRecord) {
            // Photo was uploaded to Drive earlier, but user deleted it from Drive: purge it!
            await this.deletePhoto(localPhoto.id);
            stateChanged = true;
          } else if (localPhoto.syncStatus === 'synced' && (!localPhoto.driveFileId || !hasDriveRecord)) {
            await this.deletePhoto(localPhoto.id);
            stateChanged = true;
          } else if (localPhoto.syncStatus === 'local' || localPhoto.syncStatus === 'error') {
            // Check if this local photo is missing from Drive
            const existsInDrive = drivePhotos.some(dp => 
              (dp.timestamp && dp.timestamp === localPhoto.timestamp && dp.userName === localPhoto.userName)
            );
            if (!existsInDrive) {
              // Delete stale orphaned photo from local store
              await this.deletePhoto(localPhoto.id);
              stateChanged = true;
            }
          }
        }
      }

      // Re-read local photos after deletion
      const updatedLocalPhotos = await this.getAllPhotos();

      // 2. ADD NEW PHOTOS FROM DRIVE:
      for (const driveItem of drivePhotos) {
        const driveId = String(driveItem.driveFileId || driveItem.id);
        const exists = updatedLocalPhotos.some(p => 
          (p.driveFileId && String(p.driveFileId) === driveId) ||
          (driveItem.timestamp && p.timestamp === driveItem.timestamp && p.userName === driveItem.userName)
        );

        if (!exists) {
          const imgUrl = driveItem.webDataUrl || driveItem.driveUrl;
          const thumbUrl = driveItem.thumbDataUrl || driveItem.thumbUrl || imgUrl;

          const newRecord = {
            spotId: driveItem.spotId || 'spot-1',
            spotName: driveItem.spotName || 'Rundown Spot',
            userName: driveItem.userName || 'Teman Main',
            timestamp: driveItem.timestamp || new Date().toISOString(),
            originalSize: 0,
            originalFormattedSize: driveItem.originalFormattedSize || 'Cloud',
            webSize: 0,
            webFormattedSize: driveItem.webFormattedSize || 'Cloud',
            savingsPercent: driveItem.savingsPercent || 0,
            webDataUrl: imgUrl,
            thumbDataUrl: thumbUrl,
            syncStatus: 'synced',
            driveUrl: driveItem.driveUrl,
            driveFileId: driveId,
            driveError: null
          };

          await new Promise((resolve, reject) => {
            const tx = this.db.transaction('photos', 'readwrite');
            const store = tx.objectStore('photos');
            const req = store.add(newRecord);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          stateChanged = true;
        }
      }

      return { success: true, updated: stateChanged, totalInDrive: drivePhotos.length };
    } catch (err) {
      console.warn('syncFromDrive error:', err);
      return { success: false, updated: false, error: err.message };
    }
  },

  /**
   * Force clean cache & re-sync from Google Drive
   */
  async purgeLocalCacheAndSync() {
    return await this.syncFromDrive(true);
  },

  /**
   * Send photo to Google Apps Script Web App for Google Drive upload into "Rundown Meetup"
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
        filename: `Rundown_${(photo.spotName || 'spot').replace(/[^a-zA-Z0-9]/g, '_')}_${(photo.userName || 'user').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        spotId: photo.spotId,
        spotName: photo.spotName,
        userName: photo.userName,
        timestamp: photo.timestamp,
        originalFormattedSize: photo.originalFormattedSize,
        webFormattedSize: photo.webFormattedSize,
        savingsPercent: photo.savingsPercent,
        folderName: 'Rundown Meetup',
        folderId: settings.folderId || ''
      };

      // Send to Apps Script Web App
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
        photo.driveUrl = resJson.driveUrl || resJson.fileUrl || null;
        photo.driveFileId = resJson.fileId || null;
        photo.driveError = null;
      } else {
        photo.syncStatus = 'error';
        photo.driveError = resJson.message || 'Gagal menyimpan ke Drive';
      }
    } catch (err) {
      console.warn('Sync to Google Drive failed or CORS restricted:', err);
      photo.syncStatus = 'error';
      photo.driveError = err.message || 'Koneksi ke Drive terputus';
    }

    await this.updatePhoto(photo);
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('photoSyncUpdate', { detail: photo }));
    }
    return photo;
  },

  DEFAULT_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwJH59GfDV4w7JqvR1I3DpXizDAWgNzF9VK2p97o4ltHKVJn1dsWAxot4T2nZTX5CT7Mg/exec',

  /**
   * Settings management (localStorage with hardcoded default for cross-device sync)
   */
  getSettings() {
    return {
      scriptUrl: localStorage.getItem('gdrive_script_url') || this.DEFAULT_SCRIPT_URL,
      folderId: localStorage.getItem('gdrive_folder_id') || '',
      folderName: localStorage.getItem('gdrive_folder_name') || 'Rundown Meetup',
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
