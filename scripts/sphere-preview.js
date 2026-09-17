/**
 * SphereImageGrid - Vanilla 3D Image Sphere Component
 * Mirrors img-sphere.tsx mathematics, Fibonacci sphere distribution,
 * momentum physics, touch & mouse drag, collision handling, and modal view.
 */

const SpherePreviewApp = {
  containerId: 'sphere-3d-container',
  containerSize: 420,
  sphereRadius: 180,
  dragSensitivity: 0.8,
  momentumDecay: 0.96,
  maxRotationSpeed: 6,
  baseImageScale: 0.16,
  perspective: 1000,
  autoRotate: true,
  autoRotateSpeed: 0.25,

  rotation: { x: 15, y: 15, z: 0 },
  velocity: { x: 0, y: 0 },
  isDragging: false,
  lastMousePos: { x: 0, y: 0 },
  animationFrame: null,
  images: [],
  imagePositions: [],
  hoveredIndex: null,
  isInitialized: false,

  defaultImages: [
    {
      id: 'def-1',
      src: 'assets/dresscode.jpg',
      alt: '4 Sahabat Dress Code Coklat & Cream',
      title: 'Momen Kebersamaan 4 Sahabat',
      description: 'Dress code coklat & cream yang hangat, santai, dan kompak!'
    },
    {
      id: 'def-2',
      src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=80',
      alt: 'Keseruan Hangout Sahabat',
      title: 'Keseruan di Perjalanan',
      description: 'Momen tawa santai saat keliling Jakarta dengan transportasi umum.'
    },
    {
      id: 'def-3',
      src: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600&auto=format&fit=crop&q=80',
      alt: 'Diskusi & Kopi Hangat',
      title: 'Coffee Time & Cerita Seru',
      description: 'Obrolan hangat saat rehat kopi di Family Mart Trinity Tower.'
    },
    {
      id: 'def-4',
      src: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=600&auto=format&fit=crop&q=80',
      alt: 'Dessert Manis di Gandaria City',
      title: 'Don Bakeshop Pastry',
      description: 'Menikmati aneka croissant dan bomboloni lezat.'
    },
    {
      id: 'def-5',
      src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80',
      alt: 'Studio Fotohokkie Blok M',
      title: 'Fotohokkie Self Studio',
      description: 'Pose-pose estetik dan lucu mengawali keseruan hari ini.'
    },
    {
      id: 'def-6',
      src: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80',
      alt: 'Nostalgia di Kampus Otista',
      title: 'Golden Hour di Kampus Otista',
      description: 'Menutup hari yang indah dengan nostalgia di kampus tercinta.'
    }
  ],

  SPHERE_MATH: {
    degreesToRadians: (d) => d * (Math.PI / 180),
    radiansToDegrees: (r) => r * (180 / Math.PI),
    normalizeAngle: (angle) => {
      while (angle > 180) angle -= 360;
      while (angle < -180) angle += 360;
      return angle;
    }
  },

  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Load actual photos from DB or fallback
    await this.loadImages();

    // Adjust container size for mobile responsively
    this.updateResponsiveSize();
    window.addEventListener('resize', () => {
      this.updateResponsiveSize();
      this.generateSpherePositions();
    });

    this.generateSpherePositions();
    this.bindEvents();

    if (!this.isInitialized) {
      this.isInitialized = true;
      this.startAnimationLoop();
    }
  },

  updateResponsiveSize() {
    const screenWidth = window.innerWidth;
    if (screenWidth < 480) {
      this.containerSize = Math.min(320, screenWidth - 40);
      this.sphereRadius = this.containerSize * 0.44;
      this.baseImageScale = 0.19;
    } else if (screenWidth < 768) {
      this.containerSize = 380;
      this.sphereRadius = 160;
      this.baseImageScale = 0.17;
    } else {
      this.containerSize = 460;
      this.sphereRadius = 190;
      this.baseImageScale = 0.16;
    }

    const container = document.getElementById(this.containerId);
    if (container) {
      container.style.width = `${this.containerSize}px`;
      container.style.height = `${this.containerSize}px`;
      container.style.perspective = `${this.perspective}px`;
    }
  },

  async loadImages() {
    try {
      const stored = await AppStorage.getAllPhotos();
      
      const userPhotos = (stored || []).map(p => ({
        id: `db-${p.id}`,
        src: p.thumbDataUrl || p.webDataUrl,
        alt: `Foto di ${p.spotName} oleh ${p.userName}`,
        title: p.spotName,
        description: `Diambil oleh ${p.userName} pada ${new Date(p.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
      }));

      // OTOMATIS: Jika user sudah memasukkan foto, 100% foto dummy dihilangkan
      // dan bola 3D sepenuhnya diisi oleh foto-foto asli yang diambil user!
      if (userPhotos.length > 0) {
        const filled = [];
        // Pastikan bola foto terdistribusi secara penuh (minimal 24 titik) dengan mendistribusikan foto asli user
        const targetCount = Math.max(userPhotos.length, 24);
        for (let i = 0; i < targetCount; i++) {
          const basePhoto = userPhotos[i % userPhotos.length];
          filled.push({
            ...basePhoto,
            id: `real-${i + 1}-${basePhoto.id}`
          });
        }
        this.images = filled;
      } else {
        // Belum ada foto yang diupload user sama sekali: tampilkan placeholder dummy sementara
        this.images = this.defaultImages;
      }
    } catch (e) {
      console.warn('SpherePreview: Fallback to default images', e);
      this.images = this.defaultImages;
    }
  },

  async refreshPhotos() {
    await this.loadImages();
    this.generateSpherePositions();
    const container = document.getElementById(this.containerId);
    if (container) {
      const inner = container.querySelector('.sphere-inner-plane');
      if (inner) inner.innerHTML = '';
    }
  },

  generateSpherePositions() {
    const positions = [];
    const imageCount = this.images.length;
    const actualRadius = this.sphereRadius;

    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const angleIncrement = 2 * Math.PI / goldenRatio;

    for (let i = 0; i < imageCount; i++) {
      const t = i / imageCount;
      const inclination = Math.acos(1 - 2 * t);
      const azimuth = angleIncrement * i;

      let phi = inclination * (180 / Math.PI);
      let theta = (azimuth * (180 / Math.PI)) % 360;

      const poleBonus = Math.pow(Math.abs(phi - 90) / 90, 0.6) * 35;
      if (phi < 90) {
        phi = Math.max(5, phi - poleBonus);
      } else {
        phi = Math.min(175, phi + poleBonus);
      }

      phi = 15 + (phi / 180) * 150;

      const randomOffset = (Math.random() - 0.5) * 15;
      theta = (theta + randomOffset) % 360;

      positions.push({
        theta,
        phi,
        radius: actualRadius
      });
    }

    this.imagePositions = positions;
  },

  calculateWorldPositions() {
    const actualRadius = this.sphereRadius;
    const baseImageSize = this.containerSize * this.baseImageScale;

    const positions = this.imagePositions.map((pos, index) => {
      const thetaRad = this.SPHERE_MATH.degreesToRadians(pos.theta);
      const phiRad = this.SPHERE_MATH.degreesToRadians(pos.phi);
      const rotXRad = this.SPHERE_MATH.degreesToRadians(this.rotation.x);
      const rotYRad = this.SPHERE_MATH.degreesToRadians(this.rotation.y);

      let x = pos.radius * Math.sin(phiRad) * Math.cos(thetaRad);
      let y = pos.radius * Math.cos(phiRad);
      let z = pos.radius * Math.sin(phiRad) * Math.sin(thetaRad);

      // Y-axis rotation
      const x1 = x * Math.cos(rotYRad) + z * Math.sin(rotYRad);
      const z1 = -x * Math.sin(rotYRad) + z * Math.cos(rotYRad);
      x = x1;
      z = z1;

      // X-axis rotation
      const y2 = y * Math.cos(rotXRad) - z * Math.sin(rotXRad);
      const z2 = y * Math.sin(rotXRad) + z * Math.cos(rotXRad);
      y = y2;
      z = z2;

      const fadeZoneStart = -10;
      const fadeZoneEnd = -30;
      const isVisible = z > fadeZoneEnd;

      let fadeOpacity = 1;
      if (z <= fadeZoneStart) {
        fadeOpacity = Math.max(0, (z - fadeZoneEnd) / (fadeZoneStart - fadeZoneEnd));
      }

      const distanceFromCenter = Math.sqrt(x * x + y * y);
      const distanceRatio = Math.min(distanceFromCenter / actualRadius, 1);
      const centerScale = Math.max(0.3, 1 - distanceRatio * 0.6);
      const depthScale = (z + actualRadius) / (2 * actualRadius);
      const scale = centerScale * Math.max(0.5, 0.8 + depthScale * 0.3);

      return {
        x,
        y,
        z,
        scale,
        zIndex: Math.round(1000 + z),
        isVisible,
        fadeOpacity,
        originalIndex: index
      };
    });

    // Collision mitigation
    const adjusted = [...positions];
    for (let i = 0; i < adjusted.length; i++) {
      const pos = adjusted[i];
      if (!pos.isVisible) continue;

      let adjScale = pos.scale;
      const imgSize = baseImageSize * adjScale;

      for (let j = 0; j < adjusted.length; j++) {
        if (i === j) continue;
        const other = adjusted[j];
        if (!other.isVisible) continue;

        const otherSize = baseImageSize * other.scale;
        const dx = pos.x - other.x;
        const dy = pos.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = (imgSize + otherSize) / 2 + 18;

        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const factor = Math.max(0.4, 1 - (overlap / minDist) * 0.6);
          adjScale = Math.min(adjScale, adjScale * factor);
        }
      }

      adjusted[i].scale = Math.max(0.24, adjScale);
    }

    return adjusted;
  },

  clampSpeed(speed) {
    return Math.max(-this.maxRotationSpeed, Math.min(this.maxRotationSpeed, speed));
  },

  updateMomentum() {
    if (this.isDragging) return;

    this.velocity.x *= this.momentumDecay;
    this.velocity.y *= this.momentumDecay;

    if (!this.autoRotate && Math.abs(this.velocity.x) < 0.01 && Math.abs(this.velocity.y) < 0.01) {
      this.velocity = { x: 0, y: 0 };
    }

    let newY = this.rotation.y;
    if (this.autoRotate) {
      newY += this.autoRotateSpeed;
    }
    newY += this.clampSpeed(this.velocity.y);

    this.rotation.x = this.SPHERE_MATH.normalizeAngle(this.rotation.x + this.clampSpeed(this.velocity.x));
    this.rotation.y = this.SPHERE_MATH.normalizeAngle(newY);
  },

  renderSphere() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const worldPositions = this.calculateWorldPositions();
    const baseImageSize = this.containerSize * this.baseImageScale;
    const centerOffset = this.containerSize / 2;

    let innerWrapper = container.querySelector('.sphere-inner-plane');
    if (!innerWrapper) {
      innerWrapper = document.createElement('div');
      innerWrapper.className = 'sphere-inner-plane';
      innerWrapper.style.position = 'relative';
      innerWrapper.style.width = '100%';
      innerWrapper.style.height = '100%';
      container.appendChild(innerWrapper);
    }

    // Build or update nodes
    for (let i = 0; i < this.images.length; i++) {
      const imgData = this.images[i];
      const pos = worldPositions[i];
      let node = innerWrapper.querySelector(`[data-sphere-idx="${i}"]`);

      if (!pos || !pos.isVisible) {
        if (node) node.style.display = 'none';
        continue;
      }

      if (!node) {
        node = document.createElement('div');
        node.className = 'sphere-node-item';
        node.setAttribute('data-sphere-idx', i);
        node.style.position = 'absolute';
        node.style.cursor = 'pointer';
        node.style.userSelect = 'none';
        node.style.borderRadius = '50%';
        node.style.overflow = 'hidden';
        node.style.border = '2px solid rgba(255, 255, 255, 0.9)';
        node.style.boxShadow = '0 6px 18px rgba(38, 23, 16, 0.25)';
        node.style.transition = 'transform 0.18s ease-out';

        const imgEl = document.createElement('img');
        imgEl.src = imgData.src;
        imgEl.alt = imgData.alt;
        imgEl.style.width = '100%';
        imgEl.style.height = '100%';
        imgEl.style.objectFit = 'cover';
        imgEl.draggable = false;
        node.appendChild(imgEl);

        node.addEventListener('click', () => {
          this.openSpotlight(imgData);
        });

        node.addEventListener('mouseenter', () => {
          this.hoveredIndex = i;
        });

        node.addEventListener('mouseleave', () => {
          this.hoveredIndex = null;
        });

        innerWrapper.appendChild(node);
      }

      const imageSize = baseImageSize * pos.scale;
      const isHovered = this.hoveredIndex === i;
      const finalScale = isHovered ? Math.min(1.25, 1.25 / pos.scale) : 1;

      node.style.display = 'block';
      node.style.width = `${imageSize}px`;
      node.style.height = `${imageSize}px`;
      node.style.left = `${centerOffset + pos.x}px`;
      node.style.top = `${centerOffset + pos.y}px`;
      node.style.opacity = pos.fadeOpacity;
      node.style.transform = `translate(-50%, -50%) scale(${finalScale})`;
      node.style.zIndex = pos.zIndex;
    }
  },

  startAnimationLoop() {
    const loop = () => {
      this.updateMomentum();
      this.renderSphere();
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  },

  bindEvents() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Mouse handlers
    const onMouseDown = (e) => {
      e.preventDefault();
      this.isDragging = true;
      this.velocity = { x: 0, y: 0 };
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.lastMousePos.x;
      const deltaY = e.clientY - this.lastMousePos.y;

      const rotDelta = {
        x: -deltaY * this.dragSensitivity,
        y: deltaX * this.dragSensitivity
      };

      this.rotation.x = this.SPHERE_MATH.normalizeAngle(this.rotation.x + this.clampSpeed(rotDelta.x));
      this.rotation.y = this.SPHERE_MATH.normalizeAngle(this.rotation.y + this.clampSpeed(rotDelta.y));

      this.velocity = {
        x: this.clampSpeed(rotDelta.x),
        y: this.clampSpeed(rotDelta.y)
      };

      this.lastMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      this.isDragging = false;
    };

    // Touch handlers
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.velocity = { x: 0, y: 0 };
        this.lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - this.lastMousePos.x;
      const deltaY = touch.clientY - this.lastMousePos.y;

      const rotDelta = {
        x: -deltaY * this.dragSensitivity,
        y: deltaX * this.dragSensitivity
      };

      this.rotation.x = this.SPHERE_MATH.normalizeAngle(this.rotation.x + this.clampSpeed(rotDelta.x));
      this.rotation.y = this.SPHERE_MATH.normalizeAngle(this.rotation.y + this.clampSpeed(rotDelta.y));

      this.velocity = {
        x: this.clampSpeed(rotDelta.x),
        y: this.clampSpeed(rotDelta.y)
      };

      this.lastMousePos = { x: touch.clientX, y: touch.clientY };
    };

    const onTouchEnd = () => {
      this.isDragging = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
  },

  openSpotlight(imgData) {
    const modal = document.getElementById('sphere-spotlight-modal');
    if (!modal) return;

    const imgEl = document.getElementById('sphere-spotlight-img');
    const titleEl = document.getElementById('sphere-spotlight-title');
    const descEl = document.getElementById('sphere-spotlight-desc');

    if (imgEl) imgEl.src = imgData.src;
    if (titleEl) titleEl.textContent = imgData.title || 'Momen Hari H';
    if (descEl) descEl.textContent = imgData.description || '';

    modal.classList.add('is-open');
  },

  closeSpotlight() {
    const modal = document.getElementById('sphere-spotlight-modal');
    if (modal) modal.classList.remove('is-open');
  }
};

window.SpherePreviewApp = SpherePreviewApp;
