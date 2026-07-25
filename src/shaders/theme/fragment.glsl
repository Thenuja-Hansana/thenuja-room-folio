uniform sampler2D uDayTexture1;
uniform sampler2D uNightTexture1;
uniform sampler2D uDayTexture2;
uniform sampler2D uNightTexture2;
uniform sampler2D uDayTexture3;
uniform sampler2D uNightTexture3;
uniform sampler2D uDayTexture4;
uniform sampler2D uNightTexture4;
uniform float uMixRatio;
uniform int uTextureSet;

// Colour grade applied on top of the baked textures (see ROOM_GRADE in main.js)
struct Grade {
    float recolor;
    float hueFrom;
    float hueTo;
    float brightness;
    float depth;
    float contrast;
    float saturation;
    vec3 tint;
    float tintStrength;
};
uniform Grade uDayGrade;
uniform Grade uNightGrade;

varying vec2 vUv;

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * clamp(p - 1.0, 0.0, 1.0);
}

// The room was baked in pinks, purples and lilacs. This squeezes every hue from
// cyan round to red (180° to 365°) into the hueFrom..hueTo band of blues, keeping
// their order so objects stay distinguishable. The wood (around 15° to 30°), greens
// and yellows are outside that range and are left alone. Works in display space so
// the hue cut-offs match what you see in the texture files.
vec3 recolor(vec3 color, Grade g) {
    vec3 hsv = rgb2hsv(color);
    // Unwrap reds so they sit just after magenta instead of at 0°
    float hue = hsv.x * 360.0;
    if (hue < 90.0) hue += 360.0;

    float weight = smoothstep(160.0, 180.0, hue) * (1.0 - smoothstep(364.0, 372.0, hue));
    float t = clamp((hue - 180.0) / (365.0 - 180.0), 0.0, 1.0);
    vec3 blue = hsv2rgb(vec3(mix(g.hueFrom, g.hueTo, t) / 360.0, hsv.y, hsv.z));

    return mix(color, blue, weight * g.recolor);
}

vec3 grade(vec3 linearColor, Grade g) {
    vec3 color = recolor(pow(linearColor, vec3(1.0/2.2)), g);

    // Tint works like a coloured light over the room, so do it in linear space
    color = pow(color, vec3(2.2));
    color = mix(color, color * g.tint, g.tintStrength);

    color = pow(color, vec3(1.0/2.2));

    // Depth deepens the mid tones while keeping highlights, so pastels get richer instead of greyer
    color = pow(color, vec3(g.depth));
    color *= g.brightness;
    color = (color - 0.5) * g.contrast + 0.5;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, g.saturation);

    return clamp(color, 0.0, 1.0);
}

void main() {
    vec3 dayColor;
    vec3 nightColor;

    if(uTextureSet == 1) {
        dayColor = texture2D(uDayTexture1, vUv).rgb;
        nightColor = texture2D(uNightTexture1, vUv).rgb;
    } else if(uTextureSet == 2) {
        dayColor = texture2D(uDayTexture2, vUv).rgb;
        nightColor = texture2D(uNightTexture2, vUv).rgb;
    } else if(uTextureSet == 3) {
        dayColor = texture2D(uDayTexture3, vUv).rgb;
        nightColor = texture2D(uNightTexture3, vUv).rgb;
    } else {
        dayColor = texture2D(uDayTexture4, vUv).rgb;
        nightColor = texture2D(uNightTexture4, vUv).rgb;
    }

    // Remove the pow() inside grade() and add the other #includes if you want your glass to be unaffected
    vec3 finalColor = mix(grade(dayColor, uDayGrade), grade(nightColor, uNightGrade), uMixRatio);
    gl_FragColor = vec4(finalColor, 1.0);

    // Use this instead of the pow() calculation to avoid issues with the glass
    // I actually just like the white looking glass better.
    // #include <tonemapping_fragment>
    // #include <colorspace_fragment>
}
