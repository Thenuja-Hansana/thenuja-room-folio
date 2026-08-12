import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createThemedMaterials } from "./matcap.js";

// Colours picked to sit with the graded room (see ROOM_GRADE in main.js). The shelf is
// lit by the fairy lights at night, so the night colours are only a bit darker.
const COLORS = {
  gold: { day: "#e9bb52", night: "#c39a45", shiny: true },
  navy: { day: "#34507f", night: "#283e63" },
  // Multiplies the painted certificate, so white shows it as painted
  paper: { day: "#ffffff", night: "#d3d6e2" },
};

// The page of the certificate: cream paper, a double border, a title, a couple of
// signature lines and a gold seal with ribbons
const createCertificateTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 452;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const titleFont = 'bold 58px "Calibri Web", Calibri, sans-serif';
  const subtitleFont = 'italic 30px "Calibri Web", Calibri, sans-serif';

  const draw = () => {
    ctx.fillStyle = "#f8f2e2";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#2c4570";
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, width - 36, height - 36);
    ctx.strokeStyle = "#c9a14a";
    ctx.lineWidth = 4;
    ctx.strokeRect(34, 34, width - 68, height - 68);

    ctx.textAlign = "center";
    ctx.fillStyle = "#1f3354";
    ctx.font = titleFont;
    ctx.fillText("CERTIFICATE", width / 2, 128);
    ctx.font = subtitleFont;
    ctx.fillStyle = "#6b5a3a";
    ctx.fillText("of Achievement", width / 2, 172);

    // Name line and signature lines
    ctx.strokeStyle = "#8a7a5c";
    ctx.lineWidth = 3;
    [
      [150, 490, 250],
      [90, 250, 370],
      [390, 550, 370],
    ].forEach(([x1, x2, y]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    });

    // Seal with ribbons, between the signature lines
    const sealX = width / 2;
    const sealY = 340;
    ctx.fillStyle = "#2c4570";
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(sealX + side * 10, sealY + 10);
      ctx.lineTo(sealX + side * 34, sealY + 78);
      ctx.lineTo(sealX + side * 18, sealY + 66);
      ctx.lineTo(sealX + side * 6, sealY + 84);
      ctx.lineTo(sealX - side * 8, sealY + 16);
      ctx.fill();
    });
    ctx.fillStyle = "#d4a53c";
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const radius = i % 2 === 0 ? 44 : 38;
      ctx.lineTo(
        sealX + Math.cos(angle) * radius,
        sealY + Math.sin(angle) * radius
      );
    }
    ctx.fill();
    ctx.strokeStyle = "#f3d58a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sealX, sealY, 26, 0, Math.PI * 2);
    ctx.stroke();

    texture.needsUpdate = true;
  };

  // The font is loaded by the page's CSS, so redraw once it's ready
  draw();
  Promise.all([
    document.fonts.load(titleFont),
    document.fonts.load(subtitleFont),
  ]).then(draw);

  return texture;
};

// Framed certificate leaning against the wall. Origin is the bottom of the frame.
const createCertificate = (materials) => {
  const certificate = new THREE.Group();
  certificate.name = "Certificate_Raycaster_Hover";

  const frameWidth = 0.8;
  const frameHeight = 0.58;
  const frameDepth = 0.05;

  const frame = new THREE.Mesh(
    new RoundedBoxGeometry(frameWidth, frameHeight, frameDepth, 2, 0.02),
    materials.navy
  );
  frame.position.y = frameHeight / 2;
  certificate.add(frame);

  const page = new THREE.Mesh(
    new THREE.PlaneGeometry(frameWidth - 0.08, frameHeight - 0.08),
    materials.paper
  );
  page.position.set(0, frameHeight / 2, frameDepth / 2 + 0.002);
  certificate.add(page);

  // Lean the top back towards the wall
  certificate.rotation.x = -0.17;

  return certificate;
};

// Gold cup with two handles on a navy base. Origin is the bottom of the base.
const createTrophy = (materials) => {
  const trophy = new THREE.Group();
  trophy.name = "Trophy_Raycaster_Hover";

  const baseHeight = 0.1;
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(0.3, baseHeight, 0.3, 2, 0.025),
    materials.navy
  );
  base.position.y = baseHeight / 2;
  trophy.add(base);

  const plaque = new THREE.Mesh(
    new RoundedBoxGeometry(0.16, 0.05, 0.012, 2, 0.005),
    materials.gold
  );
  plaque.position.set(0, baseHeight / 2, 0.151);
  trophy.add(plaque);

  // Foot, stem and cup in one profile (radius, height), including the inside of the cup
  const cupProfile = [
    [0.0, 0.1],
    [0.12, 0.1],
    [0.12, 0.125],
    [0.075, 0.15],
    [0.035, 0.2],
    [0.03, 0.29],
    [0.055, 0.33],
    [0.09, 0.355],
    [0.15, 0.41],
    [0.19, 0.5],
    [0.2, 0.6],
    [0.185, 0.6],
    [0.172, 0.515],
    [0.12, 0.44],
    [0.0, 0.42],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const cup = new THREE.Mesh(
    new THREE.LatheGeometry(cupProfile, 48),
    materials.gold
  );
  trophy.add(cup);

  // Handles: half rings on each side of the cup
  const handleGeometry = new THREE.TorusGeometry(0.07, 0.016, 12, 24, Math.PI);
  [-1, 1].forEach((side) => {
    const handle = new THREE.Mesh(handleGeometry, materials.gold);
    handle.position.set(side * 0.18, 0.49, 0);
    // The half ring opens towards the cup
    handle.rotation.z = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    trophy.add(handle);
  });

  return trophy;
};

/**
 * A framed certificate and a trophy for the top shelf, where the GitHub, YouTube and
 * X blocks used to be. setNightMix(0..1) fades them with the theme.
 */
export const createShelfAwards = () => {
  const { createMaterial, setNightMix } = createThemedMaterials();
  const materials = {
    gold: createMaterial(COLORS.gold),
    navy: createMaterial(COLORS.navy),
    paper: createMaterial(COLORS.paper, { map: createCertificateTexture() }),
  };

  return {
    certificate: createCertificate(materials),
    trophy: createTrophy(materials),
    setNightMix,
  };
};
