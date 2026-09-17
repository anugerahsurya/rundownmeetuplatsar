/**
 * Countdown & Itinerary Schedule Controller
 * Handles the live countdown to 27 September 2026 07:30 WIB, event progress,
 * public transit recommendations (TJ, JakLingko, KRL), and Hari H preview trigger.
 */

const RundownCountdown = {
  itinerary: [
    {
      id: 'spot-1',
      name: 'Fotohokkie - Blok M',
      timeRange: '07:30 - 09:30 WIB',
      startHour: 7.5,
      endHour: 9.5,
      category: 'Self Photo Studio',
      address: 'Blok M Square / Kawasan Melawai, Jakarta Selatan',
      mapUrl: 'https://maps.google.com/?q=Fotohokkie+Blok+M',
      desc: 'Sesi foto studio estetik bareng sahabat dengan dress code coklat & cream!',
      icon: '📸',
      transit: {
        tj: ['Koridor 1 (Blok M - Kota)', '1E (Pondok Labu - Blok M)', '6M (St. Manggarai - Blok M)', '7B (Kp. Rambutan - Blok M)', '13A (Puri Beta - Blok M)'],
        jaklingko: ['JAK-31 (Andara - Blok M)', 'JAK-102 (Lebak Bulus - Blok M)'],
        krl: 'Stasiun Kebayoran (Lin Rangkasbitung), lanjut TransJakarta Koridor 13 (Velbak ke CSW/Blok M) atau JAK-102.',
        mrt: 'Stasiun MRT Blok M BCA (Pintu B, jalan kaki 3 menit ke Blok M Square).'
      }
    },
    {
      id: 'spot-2',
      name: 'Obihiro Nikudon - Blok M',
      timeRange: '10:00 - 12:00 WIB',
      startHour: 10.0,
      endHour: 12.0,
      category: 'Lunch & Kulineran',
      address: 'Kawasan Kuliner Melawai Blok M, Jakarta Selatan',
      mapUrl: 'https://maps.google.com/?q=Obihiro+Nikudon+Blok+M',
      desc: 'Makan siang nikmat dengan menu signature rice bowl daging sapi khas Obihiro.',
      icon: '🥩',
      transit: {
        tj: ['Cukup jalan kaki santai 3 menit dari Fotohokkie di area Melawai Blok M'],
        jaklingko: ['Akses sama dengan Spot 1 (Terminal Blok M / MRT Blok M BCA)'],
        krl: 'Stasiun Kebayoran atau Stasiun Sudirman (transit MRT ke Blok M).',
        mrt: 'Stasiun MRT Blok M BCA.'
      }
    },
    {
      id: 'spot-3',
      name: 'Don Bakeshop - Gandaria City',
      timeRange: '12:30 - 14:00 WIB',
      startHour: 12.5,
      endHour: 14.0,
      category: 'Bakery & Dessert',
      address: 'Gandaria City Mall, Jl. Sultan Iskandar Muda, Jakarta Selatan',
      mapUrl: 'https://maps.google.com/?q=Don+Bakeshop+Gandaria+City',
      desc: 'Waktunya dessert! Cicipi artisan pastry, bomboloni, croissant dan kopi santai.',
      icon: '🥐',
      transit: {
        tj: ['Rute 8E (Blok M - Bintaro, turun seberang Gandaria City)', 'Rute 1Q (Blok M - Rempoa, turun halte Gandaria City)'],
        jaklingko: ['JAK-93 (Kebayoran Lama - Jeruk Purut lewat Gandaria City)'],
        krl: 'Stasiun Kebayoran (jarak 1.8 km, lanjut Mikrotrans JAK-93 atau ojol 5 menit).',
        mrt: 'Dari Blok M langsung sambung TJ 8E/1Q (hanya 10-15 menit perjalanan).'
      }
    },
    {
      id: 'spot-4',
      name: 'Family Mart - Trinity Tower',
      timeRange: '14:30 - 15:45 WIB',
      startHour: 14.5,
      endHour: 15.75,
      category: 'Quick Recharge & Chitchat',
      address: 'Trinity Tower, Jl. H. R. Rasuna Said, Kuningan, Jakarta Selatan',
      mapUrl: 'https://maps.google.com/?q=Trinity+Tower+Jakarta',
      desc: 'Nongkrong santai, kopi susu favorit, FamiIce, dan obrolan seru sore hari.',
      icon: '🥤',
      transit: {
        tj: ['Koridor 6 (Ragunan - Galunggung via Rasuna Said)', '6H (Lebak Bulus - Senen via Kuningan)', '6M (Blok M - St. Manggarai, turun Halte GOR Sumantri / Kuningan Madya)'],
        jaklingko: ['Akses feeder terintegrasi Halte GOR Sumantri'],
        krl: 'Stasiun Tebet atau Stasiun Sudirman, lanjut TransJakarta Koridor 6/6M ke Halte Kuningan Madya.',
        mrt: 'MRT ke Dukuh Atas, lanjut LRT Jabodebek turun tepat di Stasiun LRT Rasuna Said (depan Trinity Tower).'
      }
    },
    {
      id: 'spot-5',
      name: 'Kampus Tercinta - Otista',
      timeRange: '16:00 - 17:00 WIB',
      startHour: 16.0,
      endHour: 17.0,
      category: 'Nostalgia & Golden Hour',
      address: 'Jl. Otto Iskandardinata (Otista) No. 64C, Jakarta Timur',
      mapUrl: 'https://maps.google.com/?q=Otista+Jakarta',
      desc: 'Penutupan kegiatan main, napak tilas kenangan kampus, dan foto bareng sunset golden hour.',
      icon: '🏫',
      transit: {
        tj: ['Koridor 7 (Kampung Rambutan - Kampung Melayu)', '7F (Kampung Rambutan - Juanda via Cawang)', '5C (PGC - Juanda)', 'Turun langsung di Halte Gelanggang Remaja Otista atau Halte Bidara Cina (tepat di depan kampus)'],
        jaklingko: ['JAK-43 (Tongtek - Tebet - Otista)'],
        krl: 'Stasiun Tebet (Lin Bogor), lanjut JakLingko JAK-43 atau ojol 5-7 menit ke gerbang kampus.',
        mrt: 'Dari Kuningan: TJ Koridor 9 ke Cawang UKI/BNN, transit Koridor 7 ke Halte Gelanggang Remaja.'
      }
    }
  ],

  intervalId: null,

  init() {
    this.renderItineraryList();
    this.updateCountdown();
    this.checkHariHStatus();
    this.intervalId = setInterval(() => {
      this.updateCountdown();
      this.checkHariHStatus();
    }, 1000);
  },

  getTargetDate() {
    const settings = AppStorage.getSettings();
    if (settings.eventDate) {
      const parts = settings.eventDate.split('-');
      return new Date(parts[0], parts[1] - 1, parts[2], 7, 30, 0);
    }
    // Default fixed date: 27 September 2026 at 07:30 WIB
    return new Date(2026, 8, 27, 7, 30, 0);
  },

  isHariH() {
    const now = new Date();
    const target = this.getTargetDate();
    // Same calendar day check
    const isSameDay = (
      now.getFullYear() === target.getFullYear() &&
      now.getMonth() === target.getMonth() &&
      now.getDate() === target.getDate()
    );
    // Or user manually toggled Hari H preview
    const forcePreview = sessionStorage.getItem('preview_hari_h') === 'true';
    return isSameDay || forcePreview;
  },

  checkHariHStatus() {
    const topPreviewSection = document.getElementById('top-sphere-preview-section');
    const toggleBadge = document.getElementById('hari-h-active-badge');
    const isDayH = this.isHariH();

    if (topPreviewSection) {
      if (isDayH) {
        topPreviewSection.style.display = 'block';
        if (toggleBadge) toggleBadge.style.display = 'inline-flex';
        // Initialize or update sphere if not yet done
        if (window.SpherePreviewApp && !window.SpherePreviewApp.isInitialized) {
          window.SpherePreviewApp.init();
        }
      } else {
        // Keep hidden by default before Hari H unless user clicks preview
        topPreviewSection.style.display = 'none';
        if (toggleBadge) toggleBadge.style.display = 'none';
      }
    }
  },

  updateCountdown() {
    const now = new Date();
    const target = this.getTargetDate();

    // End of event is 17:00 on the same date
    const endEvent = new Date(target);
    endEvent.setHours(17, 0, 0, 0);

    const diffToStart = target.getTime() - now.getTime();
    const diffToEnd = endEvent.getTime() - now.getTime();

    const statusBadge = document.getElementById('event-status-badge');
    const statusText = document.getElementById('event-status-text');

    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minutesEl = document.getElementById('cd-minutes');
    const secondsEl = document.getElementById('cd-seconds');

    if (diffToStart > 0) {
      // Event hasn't started yet
      if (statusBadge) {
        statusBadge.className = 'status-pill status-upcoming';
        statusBadge.innerHTML = '⏳ Menuju 27 September 2026';
      }
      if (statusText) {
        statusText.innerHTML = `Kegiatan dimulai Minggu, 27 September 2026 pukul <strong>07:30 WIB</strong>. Siapkan outfit coklat & cream terbaikmu!`;
      }

      const totalSecs = Math.floor(diffToStart / 1000);
      const d = Math.floor(totalSecs / 86400);
      const h = Math.floor((totalSecs % 86400) / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;

      if (daysEl) daysEl.textContent = String(d).padStart(2, '0');
      if (hoursEl) hoursEl.textContent = String(h).padStart(2, '0');
      if (minutesEl) minutesEl.textContent = String(m).padStart(2, '0');
      if (secondsEl) secondsEl.textContent = String(s).padStart(2, '0');

    } else if (diffToEnd > 0) {
      // Event is currently happening
      if (statusBadge) {
        statusBadge.className = 'status-pill status-active pulse-glow';
        statusBadge.innerHTML = '✨ Hari H Sedang Berlangsung!';
      }
      if (statusText) {
        statusText.innerHTML = `Selamat menikmati keseruan main hari ini! Buka galeri 3D di atas dan abadikan setiap momen.`;
      }

      const totalSecs = Math.floor(diffToEnd / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;

      if (daysEl) daysEl.textContent = '00';
      if (hoursEl) hoursEl.textContent = String(h).padStart(2, '0');
      if (minutesEl) minutesEl.textContent = String(m).padStart(2, '0');
      if (secondsEl) secondsEl.textContent = String(s).padStart(2, '0');

    } else {
      // Event completed
      if (statusBadge) {
        statusBadge.className = 'status-pill status-finished';
        statusBadge.innerHTML = '🏁 Kegiatan Selesai';
      }
      if (statusText) {
        statusText.innerHTML = `Kegiatan main 27 September 2026 telah selesai dengan penuh kenangan manis. Terima kasih semuanya!`;
      }

      if (daysEl) daysEl.textContent = '00';
      if (hoursEl) hoursEl.textContent = '00';
      if (minutesEl) minutesEl.textContent = '00';
      if (secondsEl) secondsEl.textContent = '00';
    }

    this.highlightActiveSpot(now, target);
  },

  highlightActiveSpot(now, targetDate) {
    const isSameDay = (
      now.getFullYear() === targetDate.getFullYear() &&
      now.getMonth() === targetDate.getMonth() &&
      now.getDate() === targetDate.getDate()
    );
    const currentDecimalHour = now.getHours() + (now.getMinutes() / 60);

    this.itinerary.forEach((spot) => {
      const card = document.getElementById(`card-${spot.id}`);
      const badge = document.getElementById(`badge-${spot.id}`);
      if (!card || !badge) return;

      if (!isSameDay) {
        card.classList.remove('is-active', 'is-done');
        badge.className = 'spot-status-tag status-tag-upcoming';
        badge.textContent = 'Akan Datang';
      } else {
        if (currentDecimalHour < spot.startHour) {
          card.classList.remove('is-active', 'is-done');
          badge.className = 'spot-status-tag status-tag-upcoming';
          badge.textContent = 'Segera';
        } else if (currentDecimalHour >= spot.startHour && currentDecimalHour <= spot.endHour) {
          card.classList.add('is-active');
          card.classList.remove('is-done');
          badge.className = 'spot-status-tag status-tag-active';
          badge.textContent = '📍 Sedang Berlangsung';
        } else {
          card.classList.remove('is-active');
          card.classList.add('is-done');
          badge.className = 'spot-status-tag status-tag-done';
          badge.textContent = '✓ Selesai';
        }
      }
    });
  },

  renderItineraryList() {
    const container = document.getElementById('itinerary-timeline-container');
    if (!container) return;

    container.innerHTML = this.itinerary.map((spot, index) => {
      return `
        <div class="timeline-item" id="card-${spot.id}">
          <div class="timeline-marker">
            <span class="timeline-icon">${spot.icon}</span>
            <div class="timeline-line"></div>
          </div>
          <div class="timeline-content-card">
            <div class="spot-header">
              <div class="spot-time-meta">
                <span class="spot-time"><i class="ph ph-clock"></i> ${spot.timeRange}</span>
                <span class="spot-category">${spot.category}</span>
              </div>
              <span id="badge-${spot.id}" class="spot-status-tag status-tag-upcoming">Akan Datang</span>
            </div>
            
            <h3 class="spot-title">${spot.name}</h3>
            <p class="spot-desc">${spot.desc}</p>
            <p class="spot-address"><i class="ph ph-map-pin"></i> ${spot.address}</p>

            <!-- Compact Transit Trigger Button (Hemat tempat di mobile, muncul pop-up saat diklik) -->
            <div class="spot-transit-compact">
              <button class="btn btn-transit-compact" onclick="RundownCountdown.openTransitModal('${spot.id}')" title="Buka penjelasan rute angkutan umum">
                <i class="ph ph-bus"></i>
                <span>Lihat Panduan Rute & Angkutan Umum</span>
                <i class="ph ph-arrow-right" style="font-size: 0.9rem;"></i>
              </button>
            </div>

            <div class="spot-actions">
              <button class="btn btn-sm btn-camera" onclick="CameraApp.openForSpot('${spot.id}', '${spot.name}')">
                <i class="ph ph-camera"></i> Ambil Foto di Sini
              </button>
              <a href="${spot.mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">
                <i class="ph ph-navigation-arrow"></i> Google Maps
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Populate spot selector dropdown in camera modal
    const spotSelect = document.getElementById('camera-spot-select');
    if (spotSelect) {
      spotSelect.innerHTML = this.itinerary.map(spot => 
        `<option value="${spot.id}">${spot.name}</option>`
      ).join('');
    }
  },

  openTransitModal(spotId) {
    const spot = this.itinerary.find(s => s.id === spotId);
    if (!spot) return;

    const modal = document.getElementById('transit-info-modal');
    if (!modal) return;

    const titleEl = document.getElementById('transit-modal-title');
    const subEl = document.getElementById('transit-modal-subtitle');
    const iconEl = document.getElementById('transit-modal-icon');
    const mapLink = document.getElementById('transit-modal-map-link');
    const contentEl = document.getElementById('transit-modal-content');

    if (titleEl) titleEl.textContent = spot.name;
    if (subEl) subEl.textContent = `${spot.timeRange} • ${spot.address}`;
    if (iconEl) iconEl.textContent = spot.icon;
    if (mapLink) mapLink.href = spot.mapUrl;

    const tjItems = spot.transit.tj.map(r => `
      <li class="transit-list-item">
        <span class="transit-badge badge-tj">TJ</span>
        <span>${r}</span>
      </li>
    `).join('');

    const jakItems = spot.transit.jaklingko.map(r => `
      <li class="transit-list-item">
        <span class="transit-badge badge-jaklingko">JakLingko</span>
        <span>${r}</span>
      </li>
    `).join('');

    if (contentEl) {
      contentEl.innerHTML = `
        <div class="transit-pop-group">
          <h4 class="transit-pop-heading"><i class="ph ph-bus"></i> TransJakarta (TJ)</h4>
          <ul class="transit-pop-list">${tjItems}</ul>
        </div>

        <div class="transit-pop-group">
          <h4 class="transit-pop-heading"><i class="ph ph-van"></i> JakLingko (Mikrotrans)</h4>
          <ul class="transit-pop-list">${jakItems}</ul>
        </div>

        <div class="transit-pop-group">
          <h4 class="transit-pop-heading"><i class="ph ph-train-simple"></i> KRL Commuter Line</h4>
          <p class="transit-pop-text">${spot.transit.krl}</p>
        </div>

        ${spot.transit.mrt ? `
          <div class="transit-pop-group">
            <h4 class="transit-pop-heading"><i class="ph ph-subway"></i> MRT / LRT</h4>
            <p class="transit-pop-text">${spot.transit.mrt}</p>
          </div>
        ` : ''}
      `;
    }

    modal.classList.add('is-open');
  },

  closeTransitModal() {
    const modal = document.getElementById('transit-info-modal');
    if (modal) modal.classList.remove('is-open');
  }
};

window.RundownCountdown = RundownCountdown;
