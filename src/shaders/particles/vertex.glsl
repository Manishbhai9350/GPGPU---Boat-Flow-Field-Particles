
// attributes
attribute vec4 color;
attribute vec2 guv;

// varying
varying vec4 vColor;
varying vec2 vGuv;

// uniforms
uniform sampler2D uPositions;
uniform vec2 uResolution;
uniform float uSize;

void main() {
    // varyings
    vColor = color;
    vGuv = guv;

    vec4 computeTexture = texture(uPositions, guv);

    vec3 pos = position;
    pos.xyz = computeTexture.rgb;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float life = computeTexture.a;

    float opacity1 = smoothstep(.1, 1.0, life);
    float opacity2 = 1.0 - smoothstep(.8, 1.0, life);
    float opacity = min(opacity1, opacity2);

    gl_PointSize = opacity * uSize * uResolution.y * (1.0 / -mvPosition.z);
}