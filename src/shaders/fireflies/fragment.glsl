uniform vec3 uColor;
uniform float uOpacity;

varying float vBrightness;

void main()
{
    float distanceToCenter = length(gl_PointCoord - 0.5);

    // Bright little body with a soft glow around it
    float body = smoothstep(0.08, 0.0, distanceToCenter);
    float glow = pow(max(1.0 - distanceToCenter * 2.0, 0.0), 3.0) * 0.9;

    float strength = vBrightness * uOpacity;
    vec3 color = (uColor * (body + glow) + vec3(body * 0.6)) * strength;
    gl_FragColor = vec4(color, (body + glow) * strength);

    #include <colorspace_fragment>
}
