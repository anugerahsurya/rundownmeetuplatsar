/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: GOOGLE DRIVE CLOUD SYNC UNTUK WEB RUNDOWN MEETUP
 * =========================================================================
 * 
 * FOLDER PENYIMPANAN: "Rundown Meetup"
 * Fitur:
 * 1. Simpan Foto (doPost): Menyimpan foto ke folder "Rundown Meetup" di Google Drive
 * 2. Simpan Photostrip (doPost): Sinkronisasi data Photostrip kolaboratif multi-perangkat
 * 3. Ambil Semua Data (doGet): Mengambil seluruh foto dan photostrip sehingga
 *    otomatis terbaca di semua perangkat (smartphone, laptop, iPhone, dll).
 * 
 * PANDUAN PENTING AGAR TIDAK ERROR 403 FORBIDDEN / FOTO TERBACA DI DEVICE LAIN:
 * 1. Buka https://script.google.com/
 * 2. Buka proyek Anda, tempel seluruh kode file ini, lalu Simpan (Ctrl + S).
 * 3. Klik tombol biru "Deploy" di kanan atas -> Pilih "New deployment"
 * 4. Klik ikon gerigi di samping "Select type", pilih "Web app"
 * 5. KONFIGURASI WAJIB:
 *    - Description: "Rundown Meetup & Photostrip Sync"
 *    - Execute as: "Me" (Email akun Google Anda)
 *    - Who has access: "Anyone" (WAJIB pilih "Anyone" / Siapa saja!)
 *      *PERHATIAN: Jika memilih "Only myself", perangkat lain atau HP teman
 *      akan ditolak oleh Google dengan error 403 Forbidden, sehingga foto tidak akan muncul!
 * 6. Klik "Deploy", lalu klik "Authorize access" dan pilih akun Google Anda.
 * 7. Salin Web app URL (berakhiran /exec).
 * =========================================================================
 */

// Nama Folder Utama di Google Drive
var DEFAULT_FOLDER_NAME = "Rundown Meetup";
var PHOTOSTRIP_FILE_NAME = "photostrips_data.json";

/**
 * Endpoint POST: Menerima unggahan foto atau sinkronisasi photostrip
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var parentFolder = getOrCreateFolder(DEFAULT_FOLDER_NAME);

    // =======================================================================
    // TIPE 1: SINKRONISASI PHOTOSTRIP KOLABORATIF
    // =======================================================================
    if (data.type === "photostrip_sync" || data.type === "photostrip") {
      var savedStrips = savePhotostripsData(parentFolder, data.strips || [data.strip]);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Data photostrip berhasil disinkronkan ke Google Drive!",
        photostrips: savedStrips
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =======================================================================
    // TIPE 2: UNGGAHAN FOTO (KAMERA RUNDOWN / SLOT FOTO)
    // =======================================================================
    var base64Data = data.base64Data;
    if (!base64Data) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Data gambar tidak ditemukan dalam request."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var filename = data.filename || ("meetup_" + new Date().getTime() + ".jpg");
    var mimeType = data.mimeType || "image/jpeg";
    var spotId = data.spotId || "spot-1";
    var spotName = data.spotName || "General";
    var userName = data.userName || "Teman Main";
    var timestamp = data.timestamp || new Date().toISOString();

    // Buat subfolder berdasarkan lokasi agar rapi di Drive
    var spotFolder = getOrCreateSubFolder(parentFolder, spotName);

    // Decode Base64 data
    var cleanBase64 = base64Data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType, filename);

    // Buat file di Google Drive
    var file = spotFolder.createFile(blob);
    
    // Buka akses publik untuk link file agar bisa dibaca dari mana saja
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Simpan metadata terstruktur di deskripsi file agar bisa dibaca kembali oleh doGet
    var metadata = {
      spotId: spotId,
      spotName: spotName,
      userName: userName,
      timestamp: timestamp,
      originalFormattedSize: data.originalFormattedSize || "",
      webFormattedSize: data.webFormattedSize || "",
      savingsPercent: data.savingsPercent || 0
    };
    file.setDescription(JSON.stringify(metadata));

    var fileId = file.getId();
    var webDataUrl = "https://lh3.googleusercontent.com/d/" + fileId;
    var thumbDataUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w600";
    var driveUrl = file.getUrl();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Foto berhasil disimpan ke folder 'Rundown Meetup' di Google Drive!",
      fileId: fileId,
      driveUrl: driveUrl,
      webDataUrl: webDataUrl,
      thumbDataUrl: thumbDataUrl,
      spotId: spotId,
      spotName: spotName,
      userName: userName,
      timestamp: timestamp
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Endpoint GET: Mengambil daftar seluruh foto & photostrip dari folder "Rundown Meetup"
 * Ini memungkinkan semua perangkat (HP teman lain / laptop) membaca data yang sama!
 */
function doGet(e) {
  try {
    var rootFolder = getOrCreateFolder(DEFAULT_FOLDER_NAME);
    var photos = [];

    // 1. Kumpulkan file gambar di folder utama
    collectPhotosFromFolder(rootFolder, photos, "Rundown Meetup", "spot-1");

    // 2. Kumpulkan file gambar di seluruh subfolder lokasi
    var subFolders = rootFolder.getFolders();
    while (subFolders.hasNext()) {
      var sub = subFolders.next();
      collectPhotosFromFolder(sub, photos, sub.getName(), "");
    }

    // Urutkan dari foto paling baru ke paling lama
    photos.sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // 3. Ambil data photostrip kolaboratif
    var photostrips = getPhotostripsData(rootFolder);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      folderName: DEFAULT_FOLDER_NAME,
      total: photos.length,
      photos: photos,
      photostrips: photostrips,
      serverTime: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Pembantu: Baca file photostrips_data.json dari folder Drive
 */
function getPhotostripsData(folder) {
  try {
    var files = folder.getFilesByName(PHOTOSTRIP_FILE_NAME);
    if (files.hasNext()) {
      var file = files.next();
      var content = file.getBlob().getDataAsString();
      if (content && content.trim() !== "") {
        return JSON.parse(content);
      }
    }
  } catch (e) {
    Logger.log("Error reading photostrips data: " + e.toString());
  }
  return [];
}

/**
 * Pembantu: Simpan atau update file photostrips_data.json di folder Drive
 */
function savePhotostripsData(folder, stripsList) {
  if (!Array.isArray(stripsList)) stripsList = [];
  var files = folder.getFilesByName(PHOTOSTRIP_FILE_NAME);
  var jsonContent = JSON.stringify(stripsList);

  if (files.hasNext()) {
    var file = files.next();
    file.setContent(jsonContent);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } else {
    var newFile = folder.createFile(PHOTOSTRIP_FILE_NAME, jsonContent, MimeType.PLAIN_TEXT);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  return stripsList;
}

/**
 * Pembantu: Ekstrak foto dan metadata dari sebuah folder Drive
 */
function collectPhotosFromFolder(folder, list, defaultSpotName, defaultSpotId) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    
    // Lewati file metadata JSON
    if (file.getName() === PHOTOSTRIP_FILE_NAME) continue;

    var mime = file.getMimeType();
    // Hanya ambil file gambar
    if (mime.indexOf("image/") !== 0 && mime !== "application/octet-stream") continue;

    var meta = {
      spotId: defaultSpotId || "spot-1",
      spotName: defaultSpotName || "Rundown Meetup",
      userName: "Teman Main",
      timestamp: file.getDateCreated().toISOString(),
      originalFormattedSize: "Drive",
      webFormattedSize: "Drive",
      savingsPercent: 0
    };

    var desc = file.getDescription();
    if (desc && desc.indexOf("{") === 0) {
      try {
        var parsed = JSON.parse(desc);
        if (parsed.spotId) meta.spotId = parsed.spotId;
        if (parsed.spotName) meta.spotName = parsed.spotName;
        if (parsed.userName) meta.userName = parsed.userName;
        if (parsed.timestamp) meta.timestamp = parsed.timestamp;
        if (parsed.originalFormattedSize) meta.originalFormattedSize = parsed.originalFormattedSize;
        if (parsed.webFormattedSize) meta.webFormattedSize = parsed.webFormattedSize;
        if (parsed.savingsPercent) meta.savingsPercent = parsed.savingsPercent;
      } catch (e) {}
    } else if (desc) {
      var userMatch = desc.match(/Diunggah oleh:\s*([^|]+)/);
      if (userMatch) meta.userName = userMatch[1].trim();
      var spotMatch = desc.match(/Lokasi:\s*([^|]+)/);
      if (spotMatch) meta.spotName = spotMatch[1].trim();
    }

    var fileId = file.getId();
    list.push({
      id: fileId,
      driveFileId: fileId,
      spotId: meta.spotId,
      spotName: meta.spotName,
      userName: meta.userName,
      timestamp: meta.timestamp,
      driveUrl: file.getUrl(),
      webDataUrl: "https://lh3.googleusercontent.com/d/" + fileId,
      thumbDataUrl: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w600",
      originalFormattedSize: meta.originalFormattedSize,
      webFormattedSize: meta.webFormattedSize,
      savingsPercent: meta.savingsPercent,
      syncStatus: "synced"
    });
  }
}

/**
 * Pembantu: Ambil atau buat folder utama
 */
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

/**
 * Pembantu: Ambil atau buat subfolder
 */
function getOrCreateSubFolder(parentFolder, subFolderName) {
  var folders = parentFolder.getFoldersByName(subFolderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(subFolderName);
  }
}
