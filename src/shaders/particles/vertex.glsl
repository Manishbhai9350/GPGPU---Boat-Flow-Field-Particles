
// attributes
attribute vec4 color;
attribute vec2 guv;

// varying
varying vec4 vColor;
varying vec2 vGuv;
varying vec2 vScreenUV;

// uniforms
uniform sampler2D uPositions;
uniform sampler2D uMask;
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
    float opacity2 = 1.0 - smoothstep(.9, 1.0, life);
    float opacity = min(opacity1, opacity2);
    vec2 ScreenUV = (gl_Position.xy / gl_Position.w) * 0.5 + 0.5;
    vScreenUV = ScreenUV;
    // opacity = 1.0;

    float mask = texture(uMask, ScreenUV).r;

    gl_PointSize = opacity * mask * uSize * uResolution.y * (1.0 / -mvPosition.z);
}