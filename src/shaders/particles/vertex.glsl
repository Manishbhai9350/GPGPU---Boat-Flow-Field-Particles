
// attributes
attribute vec4 color;
attribute vec2 guv;

// varying
varying vec4 vColor;
varying vec2 vUv;
varying vec2 vGuv;

// uniforms
uniform sampler2D uPositions;

void main() {
    // varyings
    vColor = color;
    vUv = uv;
    vGuv = guv;

    vec4 computeTexture = texture(uPositions, guv);

    vec3 pos = position;
    pos.xyz = computeTexture.rgb;

    float pointSZ = smoothstep(0.0, .5, abs(computeTexture.a - .5));

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = 10. * (1.0 / -mvPosition.z); // Size attenuation
    gl_Position = projectionMatrix * mvPosition;
}