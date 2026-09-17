/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: GOOGLE DRIVE CLOUD SYNC UNTUK WEB RUNDOWN MEETUP
 * =========================================================================
 * 
 * FOLDER PENYIMPANAN: "Rundown Meetup"
 * Fitur:
 * 1. Simpan Foto (doPost): Menyimpan foto ke folder "Rundown Meetup" di Google Drive
 * 2. Ambil Foto (doGet): Mengambil semua foto dari folder "Rundown Meetup"
 *    sehingga foto otomatis muncul di semua perangkat (smartphone, laptop, dll).
 * 
 * PANDUAN DEPLOY / UPDATE (1 MENIT):
 * 1. Buka https://script.google.com/
 * 2. Buat proyek baru atau buka proyek yang sudah ada
 * 3. Hapus semua kode, ganti dengan seluruh isi file ini
 * 4. Klik "Deploy" (kanan atas) -> "New deployment"
 * 5. Pilih "Web app" (ikon gerigi)
 * 6. Setting:
 *    - Description: "Rundown Meetup Cloud Storage v2"
 *    - Execute as: "Me" (Email akun Google Anda)
 *    - Who has access: "Anyone" (Siapa saja, agar semua teman bisa melihat & upload)
 * 7. Klik "Deploy", beri izin akses jika diminta (Authorize Access)
 * 8. Salin "Web app URL" (berakhiran /exec)
 * 9. Tempelkan URL tersebut ke web Rundown Meetup di menu Pengaturan Drive!
 * =========================================================================
 */

// Nama Folder Utama di Google Drive
var DEFAULT_FOLDER_NAME = "Rundown Meetup";

/**
 * Endpoint POST: Menerima unggahan foto dari web dan menyimpannya ke Google Drive
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var base64Data = data.base64Data;
    var filename = data.filename || ("meetup_" + new Date().getTime() + ".jpg");
    var mimeType = data.mimeType || "image/jpeg";
    var spotId = data.spotId || "spot-1";
    var spotName = data.spotName || "General";
    var userName = data.userName || "Teman Main";
    var timestamp = data.timestamp || new Date().toISOString();
    var folderId = data.folderId;

    // Ambil atau buat folder utama "Rundown Meetup"
    var parentFolder;
    if (folderId && folderId.trim() !== "") {
      try {
        parentFolder = DriveApp.getFolderById(folderId.trim());
      } catch (err) {
        parentFolder = getOrCreateFolder(DEFAULT_FOLDER_NAME);
      }
    } else {
      parentFolder = getOrCreateFolder(DEFAULT_FOLDER_NAME);
    }

    // Buat subfolder berdasarkan lokasi agar rapi di Drive
    var spotFolder = getOrCreateSubFolder(parentFolder, spotName);

    // Decode Base64 data
    var cleanBase64 = base64Data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType, filename);

    // Buat file di Google Drive
    var file = spotFolder.createFile(blob);
    
    // Buka akses publik untuk link file
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
 * Endpoint GET: Mengambil daftar seluruh foto dari folder "Rundown Meetup"
 * Ini memungkinkan semua perangkat (HP teman lain / laptop) melihat foto yang sama secara realtime!
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

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      folderName: DEFAULT_FOLDER_NAME,
      total: photos.length,
      photos: photos
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Pembantu: Ekstrak foto dan metadata dari sebuah folder Drive
 */
function collectPhotosFromFolder(folder, list, defaultSpotName, defaultSpotId) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
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
      // Fallback format text lama
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
