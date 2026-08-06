import * as THREE from "three";

// The room's lighting is baked into its textures and the scene has no lights, so the
// objects added in code (mailbox, sign lamp) use matcap materials. A matcap is a painted
// "lit sphere" that gives soft shading without any lights, which keeps them looking like
// the rest of the room.
let matcapTexture = null;

const getMatcapTexture = () => {
  if (matcapTexture) return matcapTexture;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Light coming from the top left
  const gradient = ctx.createRadialGradient(
    size * 0.38,
    size * 0.32,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.5
  );
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.45, "#ececec");
  gradient.addColorStop(0.8, "#b8b8b8");
  gradient.addColorStop(1, "#8e8e8e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  matcapTexture = new THREE.CanvasTexture(canvas);
  matcapTexture.colorSpace = THREE.SRGBColorSpace;
  return matcapTexture;
};

/**
 * Makes matcap materials that fade between a day and a night colour with the theme.
 * createMaterial({ day, night }, options) makes one, and setNightMix(0..1) fades them
 * all (0 is the day colours, 1 the night colours). addLight(material, dayColor), if
 * given, is called for each material to light it with something extra (see fireflies.js).
 */
export const createThemedMaterials = ({ addLight } = {}) => {
  const tintedMaterials = [];

  const createMaterial = ({ day, night }, options = {}) => {
    const dayColor = new THREE.Color(day);
    const nightColor = new THREE.Color(night);
    const material = new THREE.MeshMatcapMaterial({
      matcap: getMatcapTexture(),
      color: dayColor.clone(),
      ...options,
    });
    tintedMaterials.push({ material, day: dayColor, night: nightColor });
    addLight?.(material, dayColor);
    return material;
  };

  const setNightMix = (mix) => {
    tintedMaterials.forEach(({ material, day, night }) => {
      material.color.lerpColors(day, night, mix);
    });
  };

  return { createMaterial, setNightMix };
};
