attribute float aBrightness;

uniform float uSize;
uniform float uPixelRatio;

varying float vBrightness;

void main()
{
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    // Smaller the further away, and a little bigger while glowing
    gl_PointSize = uSize * uPixelRatio * (0.6 + 0.4 * aBrightness) / -viewPosition.z;

    vBrightness = aBrightness;
}
