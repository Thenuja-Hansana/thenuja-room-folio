import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createThemedMaterials } from "./matcap.js";

import beamVertexShader from "./shaders/lampBeam/vertex.glsl";
import beamFragmentShader from "./shaders/lampBeam/fragment.glsl";

// Colours picked to sit with the graded room (see ROOM_GRADE in main.js)
const COLORS = {
  metal: { day: "#34425e", night: "#161c2b" },
};
const BULB_OFF = new THREE.Color("#dfe6f0");
const BULB_ON = new THREE.Color("#fff3d1");
const SHADE_INSIDE_OFF = new THREE.Color("#8c99ae");
const SHADE_INSIDE_ON = new THREE.Color("#ffd49a");

// How strong the glow around the bulb and the visible beam get at night
const HALO_OPACITY = 0.9;
const BEAM_OPACITY = 0.32;

const createHaloTexture = () => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.25, "rgba(255, 255, 255, 0.45)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/**
 * Gooseneck lamp that sits on top of the hanging sign and shines down onto it.
 * All positions are in world space: `mount` is where it sits on the sign, `head` is
 * where the bulb ends up and `target` is the point it shines at. The group's origin
 * is the mount, so it grows out of the sign when scaled in. The light it casts on
 * the sign itself is done in the room's shader (see SIGN_LAMP in main.js).
 */
export const createSignLamp = ({ mount, head, target, color, beamLength }) => {
  const { createMaterial, setNightMix: setMetalNightMix } =
    createThemedMaterials();
  const metal = createMaterial(COLORS.metal);

  const lamp = new THREE.Group();
  lamp.name = "Sign_Lamp";
  lamp.position.copy(mount);

  const headPosition = head.clone().sub(mount);
  const direction = target.clone().sub(head).normalize();
  // Rotates things built pointing down (-y) to point where the lamp shines
  const facingDirection = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    direction
  );

  // Bracket screwed onto the top of the sign
  const bracket = new THREE.Mesh(
    new RoundedBoxGeometry(0.16, 0.08, 0.34, 2, 0.03),
    metal
  );
  bracket.position.y = 0.04;
  lamp.add(bracket);

  // Shade: a bell shape, open end towards the sign
  const shadeDepth = 0.24;
  const shadeProfile = [
    new THREE.Vector2(0.0, shadeDepth),
    new THREE.Vector2(0.07, shadeDepth),
    new THREE.Vector2(0.1, shadeDepth - 0.06),
    new THREE.Vector2(0.17, 0.06),
    new THREE.Vector2(0.23, 0.0),
  ];
  const shadeGeometry = new THREE.LatheGeometry(shadeProfile, 40);

  const shade = new THREE.Group();
  shade.position.copy(headPosition);
  shade.quaternion.copy(facingDirection);
  lamp.add(shade);

  shade.add(new THREE.Mesh(shadeGeometry, metal));

  // The inside of the shade lights up warm when the lamp is on
  const shadeInsideMaterial = new THREE.MeshBasicMaterial({
    color: SHADE_INSIDE_OFF.clone(),
    side: THREE.BackSide,
  });
  shade.add(new THREE.Mesh(shadeGeometry, shadeInsideMaterial));

  const bulbMaterial = new THREE.MeshBasicMaterial({ color: BULB_OFF.clone() });
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 24, 16),
    bulbMaterial
  );
  bulb.position.y = 0.04;
  shade.add(bulb);

  // Gooseneck arm from the bracket, up and over to the back of the shade
  const shadeBack = headPosition
    .clone()
    .addScaledVector(direction, -shadeDepth);
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.05, 0),
    new THREE.Vector3(0, 0.32, 0),
    new THREE.Vector3(shadeBack.x * 0.45, shadeBack.y + 0.22, 0),
    shadeBack,
  ]);
  const arm = new THREE.Mesh(
    new THREE.TubeGeometry(armCurve, 32, 0.035, 12, false),
    metal
  );
  lamp.add(arm);

  // Soft glow around the bulb
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createHaloTexture(),
      color: new THREE.Color(color),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    })
  );
  halo.scale.setScalar(1.1);
  halo.position.copy(headPosition).addScaledVector(direction, 0.06);
  lamp.add(halo);

  // Faint cone of light falling from the lamp onto the sign
  const beamGeometry = new THREE.CylinderGeometry(
    0.2,
    1.05,
    beamLength,
    48,
    1,
    true
  );
  // Put the narrow end at the origin so it starts at the lamp
  beamGeometry.translate(0, -beamLength / 2, 0);
  const beamMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 },
    },
    vertexShader: beamVertexShader,
    fragmentShader: beamFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.position.copy(headPosition);
  beam.quaternion.copy(facingDirection);
  beam.visible = false;
  lamp.add(beam);

  // 0 is day (lamp off), 1 is night (lamp on)
  const setNightMix = (mix) => {
    setMetalNightMix(mix);
    bulbMaterial.color.lerpColors(BULB_OFF, BULB_ON, mix);
    shadeInsideMaterial.color.lerpColors(SHADE_INSIDE_OFF, SHADE_INSIDE_ON, mix);
    halo.material.opacity = mix * HALO_OPACITY;
    beamMaterial.uniforms.uOpacity.value = mix * BEAM_OPACITY;
    beam.visible = mix > 0;
  };

  return { lamp, setNightMix };
};
