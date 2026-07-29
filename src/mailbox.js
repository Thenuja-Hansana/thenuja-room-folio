import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createThemedMaterials } from "./matcap.js";

// Flag rotations: lying along the body, and standing up (shown on hover)
export const FLAG_DOWN = -Math.PI / 2;
export const FLAG_UP = 0;

// Colours picked to sit with the graded room (see ROOM_GRADE in main.js).
// Each material fades from its day colour to its night colour with the theme.
const COLORS = {
  wood: { day: "#9a786c", night: "#1c1a28" },
  body: { day: "#4d6fae", night: "#1a2f5a" },
  door: { day: "#3d5c98", night: "#14264b" },
  metal: { day: "#dfe5ef", night: "#39435a" },
  flag: { day: "#d65a40", night: "#4a1f28" },
  stone: { day: "#9aa5b3", night: "#202a3a" },
  // Multiplies the painted sign texture, so white shows it as painted
  sign: { day: "#ffffff", night: "#4a4658" },
};

// Carved letters in the same font and style as the My Work / About / Contact sign
const createSignTexture = (text) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 224;
  const ctx = canvas.getContext("2d");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const font = '120px "Motley Forces"';
  const draw = () => {
    const x = canvas.width / 2;
    const y = canvas.height / 2 + 6;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    ctx.fillStyle = "rgba(35, 22, 18, 0.45)";
    ctx.fillText(text, x + 5, y + 7);
    ctx.strokeStyle = "#4b342d";
    ctx.lineWidth = 14;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = "#e3cbbd";
    ctx.fillText(text, x, y);

    texture.needsUpdate = true;
  };

  // The font is loaded by the page's CSS, so redraw once it's ready
  draw();
  document.fonts.load(font).then(draw);

  return texture;
};

// Classic mailbox profile: flat sides with a rounded top
const createMailboxShape = (width, sideHeight) => {
  const radius = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, sideHeight);
  shape.absarc(0, sideHeight, radius, 0, Math.PI, false);
  shape.lineTo(-radius, 0);
  return shape;
};

/**
 * Builds a mailbox on a wooden post with a "Resume" sign. The group's origin is
 * at the bottom of the post, so it grows out of the ground when scaled in.
 * The mailbox runs along x with its door facing +x, and the sign faces +z.
 */
export const createResumeMailbox = () => {
  const { createMaterial, setNightMix } = createThemedMaterials();

  const materials = {
    wood: createMaterial(COLORS.wood),
    body: createMaterial(COLORS.body),
    door: createMaterial(COLORS.door),
    metal: createMaterial(COLORS.metal),
    flag: createMaterial(COLORS.flag),
    stone: createMaterial(COLORS.stone),
    sign: createMaterial(COLORS.sign, {
      map: createSignTexture("Resume"),
      transparent: true,
    }),
  };

  const mailbox = new THREE.Group();
  mailbox.name = "Resume_Mailbox_Raycaster_Pointer_Hover";

  // Pebble the post stands on, like the rocks around the pond
  const stone = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 32, 16),
    materials.stone
  );
  stone.scale.set(1, 0.32, 0.9);
  stone.position.y = 0.08;
  mailbox.add(stone);

  // Post
  const postHeight = 3.2;
  const post = new THREE.Mesh(
    new RoundedBoxGeometry(0.3, postHeight, 0.3, 3, 0.06),
    materials.wood
  );
  post.position.y = postHeight / 2;
  mailbox.add(post);

  // Little plank the mailbox sits on
  const shelf = new THREE.Mesh(
    new RoundedBoxGeometry(0.62, 0.14, 0.98, 3, 0.05),
    materials.wood
  );
  shelf.position.y = postHeight + 0.07;
  mailbox.add(shelf);

  // Body
  const bodyWidth = 0.8;
  const bodySide = 0.5;
  const bodyLength = 1.5;
  const bevel = 0.05;
  const bodyBottom = postHeight + 0.14 + bevel;

  const bodyGeometry = new THREE.ExtrudeGeometry(
    createMailboxShape(bodyWidth, bodySide),
    {
      depth: bodyLength,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
      curveSegments: 32,
    }
  );
  bodyGeometry.translate(0, 0, -bodyLength / 2);
  bodyGeometry.rotateY(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeometry, materials.body);
  body.position.y = bodyBottom;
  mailbox.add(body);

  // Door on the front end, a touch bigger than the body so it reads as a lid
  const doorGeometry = new THREE.ExtrudeGeometry(
    createMailboxShape(bodyWidth, bodySide),
    {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.08,
      bevelSegments: 3,
      curveSegments: 32,
    }
  );
  doorGeometry.rotateY(Math.PI / 2);
  const door = new THREE.Mesh(doorGeometry, materials.door);
  door.position.set(bodyLength / 2 + bevel, bodyBottom, 0);
  mailbox.add(door);

  const handle = new THREE.Mesh(
    new RoundedBoxGeometry(0.08, 0.1, 0.26, 2, 0.03),
    materials.metal
  );
  handle.position.set(
    bodyLength / 2 + bevel + 0.1,
    bodyBottom + bodySide + 0.18,
    0
  );
  mailbox.add(handle);

  // Flag on the side facing the camera. It pivots at the bottom of its arm:
  // rotation.z = FLAG_DOWN lies it along the body, 0 stands it up.
  const flag = new THREE.Group();
  flag.position.set(-0.4, bodyBottom + 0.3, bodyWidth / 2 + bevel + 0.03);

  const flagArm = new THREE.Mesh(
    new RoundedBoxGeometry(0.08, 0.72, 0.05, 2, 0.02),
    materials.flag
  );
  flagArm.position.y = 0.32;
  flag.add(flagArm);

  const flagPlate = new THREE.Mesh(
    new RoundedBoxGeometry(0.32, 0.24, 0.05, 2, 0.02),
    materials.flag
  );
  flagPlate.position.set(0.16, 0.56, 0);
  flag.add(flagPlate);

  flag.rotation.z = FLAG_DOWN;
  mailbox.add(flag);

  // "Resume" sign nailed to the front of the post
  const signWidth = 1.6;
  const signHeight = 0.7;
  const signDepth = 0.14;
  const signZ = 0.15 + signDepth / 2;
  const signY = postHeight - 0.95;

  const signPlank = new THREE.Mesh(
    new RoundedBoxGeometry(signWidth, signHeight, signDepth, 3, 0.05),
    materials.wood
  );
  signPlank.position.set(0, signY, signZ);
  mailbox.add(signPlank);

  const signText = new THREE.Mesh(
    new THREE.PlaneGeometry(signWidth * 0.94, signHeight * 0.94),
    materials.sign
  );
  signText.position.set(0, signY, signZ + signDepth / 2 + 0.005);
  mailbox.add(signText);

  return { mailbox, flag, setNightMix };
};
