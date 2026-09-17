import SphereImageGrid, { ImageData } from "@/components/ui/img-sphere";
import React from 'react';

// ==========================================
// CONFIGURATION & ASSETS
// ==========================================

const BASE_IMAGES: Omit<ImageData, 'id'>[] = [
  {
    src: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=80",
    alt: "Sahabat hangout bersama",
    title: "Momen Kebersamaan",
    description: "Hangout seru bareng sahabat tercinta di akhir pekan."
  },
  {
    src: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600&auto=format&fit=crop&q=80",
    alt: "Tawa hangat teman",
    title: "Cerita & Gelak Tawa",
    description: "Obrolan hangat yang tak ada habisnya saat kumpul santai."
  },
  {
    src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80",
    alt: "Diskusi dan foto bersama",
    title: "Potret Persahabatan",
    description: "Mengabadikan kehangatan persahabatan yang tulus dan solid."
  },
  {
    src: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80",
    alt: "Perayaan momen manis",
    title: "Kenangan Berharga",
    description: "Waktu berlalu cepat, namun kenangan indah ini abadi."
  },
  {
    src: "https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=600&auto=format&fit=crop&q=80",
    alt: "Kopi santai di kafe",
    title: "Coffee & Sweet Pastry",
    description: "Menikmati secangkir kopi favorit sambil bernostalgia."
  },
  {
    src: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=600&auto=format&fit=crop&q=80",
    alt: "Jalan santai bersama",
    title: "Keliling Kota",
    description: "Menjelajahi sudut-sudut kota Jakarta dengan transportasi umum."
  }
];

// Generate images to fill sphere distribution
const IMAGES: ImageData[] = [];
for (let i = 0; i < 48; i++) {
  const baseIndex = i % BASE_IMAGES.length;
  const base = BASE_IMAGES[baseIndex];
  IMAGES.push({
    id: `sphere-img-${i + 1}`,
    ...base,
    alt: `${base.alt} (${i + 1})`
  });
}

const CONFIG = {
  containerSize: 550,
  sphereRadius: 210,
  dragSensitivity: 0.8,
  momentumDecay: 0.96,
  maxRotationSpeed: 6,
  baseImageScale: 0.16,
  hoverScale: 1.25,
  perspective: 1000,
  autoRotate: true,
  autoRotateSpeed: 0.2
};

export default function DemoSphere() {
  return (
    <main className="w-full min-h-screen bg-white flex flex-col justify-center items-center p-6">
      <div className="text-center mb-6">
        <span className="text-xs font-semibold tracking-wider text-[#7A4E3A] uppercase">3D Sphere Memory</span>
        <h1 className="text-2xl md:text-3xl font-bold text-[#261710] mt-1">Galeri Bola Kenangan</h1>
        <p className="text-sm text-[#5C4F47] mt-1">Putar bola gambar 3D untuk melihat momen seru bersama</p>
      </div>

      <SphereImageGrid
        images={IMAGES}
        {...CONFIG}
      />
    </main>
  );
}
