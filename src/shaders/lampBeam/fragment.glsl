uniform vec3 uColor;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDirection;

void main()
{
    // vUv.y is 1 at the lamp and 0 at the far end, so the beam fades as it falls
    float fade = pow(vUv.y, 1.3);

    // Fade where the cone is side-on to the camera, so the beam has soft edges
    float facing = abs(dot(normalize(vNormal), normalize(vViewDirection)));
    float softEdges = pow(facing, 2.0);

    float alpha = fade * softEdges * uOpacity;
    gl_FragColor = vec4(uColor * alpha, alpha);

    #include <colorspace_fragment>
}
