import * as THREE from "three";

// The room's lighting is baked into its textures and the scene has no lights, so the
// objects added in code (mailbox, sign lamp, shelf awards) use matcap materials. A matcap
// is a painted "lit sphere" that gives shading without any lights, which keeps them
// looking like the rest of the room. Light comes from the top left in both.
const MATCAP_STOPS = {
  // Soft, like the baked room
  soft: [
    [0, "#ffffff"],
    [0.45, "#ececec"],
    [0.8, "#b8b8b8"],
    [1, "#8e8e8e"],
  ],
  // Glossy with a bright highlight and dark edges, for metal like the trophy
  shiny: [
    [0, "#ffffff"],
    [0.12, "#fff7e3"],
    [0.35, "#d6d6d6"],
    [0.7, "#8a8a8a"],
    [0.9, "#595959"],
    [1, "#a3a3a3"],
  ],
};

const matcapTextures = {};

const getMatcapTexture = (style) => {
  if (matcapTextures[style]) return matcapTextures[style];

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(
    size * 0.38,
    size * 0.32,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.5
  );
  MATCAP_STOPS[style].forEach(([offset, color]) =>
    gradient.addColorStop(offset, color)
  );
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  matcapTextures[style] = texture;
  return texture;
};

/**
 * Makes matcap materials that fade between a day and a night colour with the theme.
 * createMaterial({ day, night, shiny }, options) makes one (shiny gives it the glossy
 * matcap), and setNightMix(0..1) fades them
 * all (0 is the day colours, 1 the night colours). addLight(material, dayColor), if
 * given, is called for each material to light it with something extra (see fireflies.js).
 */
export const createThemedMaterials = ({ addLight } = {}) => {
  const tintedMaterials = [];

  const createMaterial = ({ day, night, shiny = false }, options = {}) => {
    const dayColor = new THREE.Color(day);
    const nightColor = new THREE.Color(night);
    const material = new THREE.MeshMatcapMaterial({
      matcap: getMatcapTexture(shiny ? "shiny" : "soft"),
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
