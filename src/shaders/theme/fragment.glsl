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

vec3 grade(vec3 linearColor, Grade g) {
    // Tint works like a coloured light over the room, so do it in linear space
    vec3 color = mix(linearColor, linearColor * g.tint, g.tintStrength);

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
