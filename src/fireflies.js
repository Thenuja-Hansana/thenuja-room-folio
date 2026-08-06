import * as THREE from "three";

import fireflyVertexShader from "./shaders/fireflies/vertex.glsl";
import fireflyFragmentShader from "./shaders/fireflies/fragment.glsl";

const FIREFLY_COLOR = "#d9ff73";
// Colour of the light they cast on the mailbox
const LIGHT_COLOR = "#f2ffcc";
// How far each firefly's light reaches, and how strong it is
const LIGHT_RADIUS = 1.15;
const LIGHT_STRENGTH = 1.4;
// Size of the glowing dots
const POINT_SIZE = 420;

const randomBetween = (min, max) => min + Math.random() * (max - min);
const randomPhase = () => randomBetween(0, Math.PI * 2);

/**
 * Fireflies that drift around the mailbox at night and light up its "Resume" sign.
 * Their flight paths are relative to `points.position`, which should be put at the
 * middle of the sign's front face. The first `signCount` of them always hover in
 * front of the sign (and never go fully dark) so it stays readable; the rest wander
 * around the whole mailbox.
 *
 * addLight(material, dayColor) makes a matcap material lit by them (see matcap.js),
 * and update(time, camera, nightMix) moves them every frame.
 */
export const createFireflies = ({ count, signCount }) => {
  const fireflies = Array.from({ length: count }, (_, index) => {
    const nearSign = index < signCount;
    return {
      // Middle of its flight path
      center: nearSign
        ? new THREE.Vector3(
            randomBetween(-0.35, 0.35),
            randomBetween(-0.1, 0.1),
            randomBetween(0.45, 0.65)
          )
        : new THREE.Vector3(
            randomBetween(-0.3, 0.3),
            randomBetween(0.4, 1.1),
            randomBetween(0.0, 0.4)
          ),
      // How far it strays from the middle on each axis
      radius: nearSign
        ? new THREE.Vector3(0.6, 0.28, 0.18)
        : new THREE.Vector3(
            randomBetween(1.2, 1.7),
            randomBetween(0.9, 1.3),
            randomBetween(0.9, 1.4)
          ),
      speed: new THREE.Vector3(
        randomBetween(0.15, 0.35),
        randomBetween(0.2, 0.45),
        randomBetween(0.15, 0.35)
      ),
      phase: new THREE.Vector3(randomPhase(), randomPhase(), randomPhase()),
      blinkSpeed: randomBetween(0.8, 1.8),
      blinkPhase: randomPhase(),
      minBrightness: nearSign ? 0.55 : 0.08,
    };
  });

  // Shared by every material lit by the fireflies (positions are in view space)
  const lightUniforms = {
    uFireflyPositions: {
      value: Array.from({ length: count }, () => new THREE.Vector3()),
    },
    uFireflyBrightness: { value: new Float32Array(count) },
    uFireflyColor: { value: new THREE.Color(LIGHT_COLOR) },
    uFireflyRadius: { value: LIGHT_RADIUS },
    uFireflyStrength: { value: 0 },
  };

  const lightChunk = /* glsl */ `
    #define FIREFLY_COUNT ${count}
    uniform vec3 uFireflyPositions[FIREFLY_COUNT];
    uniform float uFireflyBrightness[FIREFLY_COUNT];
    uniform vec3 uFireflyColor;
    uniform vec3 uFireflyDayColor;
    uniform float uFireflyRadius;
    uniform float uFireflyStrength;

    float fireflyLight(vec3 viewPosition, vec3 viewNormal) {
      float light = 0.0;
      for (int i = 0; i < FIREFLY_COUNT; i++) {
        vec3 toFirefly = uFireflyPositions[i] - viewPosition;
        float distanceToFirefly = length(toFirefly);
        float falloff = 1.0 - smoothstep(0.0, uFireflyRadius, distanceToFirefly);
        // Mostly lights the side facing the firefly
        float facing = 0.35 + 0.65 * max(dot(viewNormal, toFirefly / distanceToFirefly), 0.0);
        light += uFireflyBrightness[i] * falloff * falloff * facing;
      }
      return clamp(light * uFireflyStrength, 0.0, 1.0);
    }
  `;

  const addLight = (material, dayColor) => {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, lightUniforms, {
        uFireflyDayColor: { value: dayColor },
      });
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${lightChunk}`)
        .replace(
          "vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;",
          `vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
          // Near a firefly the mailbox gets its daytime look back, in the firefly's colour
          vec3 fireflyLit = diffuseColor.rgb / max(diffuse, vec3(1e-4))
            * uFireflyDayColor * matcapColor.rgb * uFireflyColor;
          outgoingLight = mix(outgoingLight, fireflyLit, fireflyLight(-vViewPosition, normal));`
        );
    };
  };

  // The glowing dots themselves
  const positions = new Float32Array(count * 3);
  const brightness = new Float32Array(count);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(FIREFLY_COLOR) },
      uOpacity: { value: 0 },
      uSize: { value: POINT_SIZE },
      uPixelRatio: { value: 1 },
    },
    vertexShader: fireflyVertexShader,
    fragmentShader: fireflyFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.name = "Fireflies";
  // They move every frame, so their bounding sphere would always be out of date
  points.frustumCulled = false;
  points.visible = false;

  const localPosition = new THREE.Vector3();

  const update = (time, camera, nightMix) => {
    points.visible = nightMix > 0;
    lightUniforms.uFireflyStrength.value = nightMix * LIGHT_STRENGTH;
    if (!points.visible) return;

    material.uniforms.uOpacity.value = nightMix;
    material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    camera.updateMatrixWorld();

    fireflies.forEach((firefly, index) => {
      const { center, radius, speed, phase } = firefly;

      // Two sine waves per axis so the paths wander instead of looping neatly
      localPosition.set(
        center.x +
          radius.x *
            (Math.sin(time * speed.x + phase.x) * 0.75 +
              Math.sin(time * speed.x * 2.3 + phase.y) * 0.25),
        center.y +
          radius.y *
            (Math.sin(time * speed.y + phase.y) * 0.75 +
              Math.sin(time * speed.y * 1.9 + phase.z) * 0.25),
        center.z +
          radius.z *
            (Math.cos(time * speed.z + phase.z) * 0.75 +
              Math.sin(time * speed.z * 2.7 + phase.x) * 0.25)
      );
      localPosition.toArray(positions, index * 3);

      // Short bright flashes with dim gaps between them
      const pulse = Math.pow(
        0.5 + 0.5 * Math.sin(time * firefly.blinkSpeed + firefly.blinkPhase),
        3
      );
      brightness[index] =
        firefly.minBrightness + (1 - firefly.minBrightness) * pulse;

      lightUniforms.uFireflyPositions.value[index]
        .copy(localPosition)
        .add(points.position)
        .applyMatrix4(camera.matrixWorldInverse);
      lightUniforms.uFireflyBrightness.value[index] = brightness[index];
    });

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aBrightness.needsUpdate = true;
  };

  return { points, addLight, update };
};
