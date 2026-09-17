/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: GOOGLE DRIVE UPLOADER UNTUK WEB RUNDOWN MAIN
 * =========================================================================
 * 
 * PANDUAN PEMASANGAN (HANYA BUTUH 1 MENIT):
 * 1. Buka https://script.google.com/
 * 2. Klik "New Project" (Proyek Baru)
 * 3. Hapus semua kode default, lalu Copy & Paste seluruh isi file ini
 * 4. (Opsional) Ganti FOLDER_NAME di bawah dengan nama folder Drive yang Anda inginkan
 * 5. Klik tombol "Deploy" (di kanan atas) -> "New deployment"
 * 6. Pilih tipe (gear icon): "Web app"
 * 7. Pada setting:
 *    - Description: "Rundown Main Photo Uploader"
 *    - Execute as: "Me" (Email akun Google Anda)
 *    - Who has access: "Anyone" (Siapa saja, agar web bisa mengunggah)
 * 8. Klik "Deploy", izinkan akses Google Drive jika diminta (Authorize Access)
 * 9. Salin "Web app URL" yang dihasilkan (berakhiran /exec)
 * 10. Buka Web Rundown Main -> Klik icon Gerigi ⚙️ (Pengaturan Google Drive)
 *     -> Tempelkan URL tersebut -> Simpan!
 * =========================================================================
 */

// Konfigurasi Default Folder Google Drive
var DEFAULT_FOLDER_NAME = "Dokumentasi Rundown Main";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Ambil parameter data
    var base64Data = data.base64Data; // data gambar base64
    var filename = data.filename || ("photo_" + new Date().getTime() + ".jpg");
    var mimeType = data.mimeType || "image/jpeg";
    var spotName = data.spotName || "General";
    var userName = data.userName || "Teman Main";
    var folderId = data.folderId; // opsional jika user mengisi folder spesifik

    // Cari atau buat folder tujuan di Google Drive
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

    // Buat subfolder berdasarkan nama lokasi kegiatan agar rapi
    var spotFolder = getOrCreateSubFolder(parentFolder, spotName);

    // Bersihkan header data URL base64 jika ada (contoh: "data:image/jpeg;base64,")
    var cleanBase64 = base64Data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType, filename);

    // Simpan file ke Google Drive
    var file = spotFolder.createFile(blob);
    
    // Set file agar bisa dilihat melalui link oleh siapa saja
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Tambahkan deskripsi metadata
    file.setDescription("Diunggah oleh: " + userName + " | Lokasi: " + spotName + " | Tanggal: " + new Date().toLocaleString());

    var fileUrl = file.getUrl();
    var downloadUrl = file.getDownloadUrl();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Foto berhasil disimpan ke Google Drive!",
      fileId: file.getId(),
      fileUrl: fileUrl,
      downloadUrl: downloadUrl,
      spotName: spotName,
      userName: userName
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    message: "Google Apps Script Web App siap menerima upload foto dari Rundown Main!"
  })).setMimeType(ContentService.MimeType.JSON);
}

// Fungsi pembantu untuk membuat / mencari folder utama
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

// Fungsi pembantu untuk membuat / mencari subfolder kegiatan
function getOrCreateSubFolder(parentFolder, subFolderName) {
  var folders = parentFolder.getFoldersByName(subFolderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(subFolderName);
  }
}
