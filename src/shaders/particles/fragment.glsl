varying vec4 vColor;
varying vec2 vUv;
varying vec2 vGuv;

uniform sampler2D uPositions;

void main() {

    vec4 computeTexture = texture(uPositions, vGuv);

    // gl_FragColor = vColor;
    float pointSZ = 1.0 - smoothstep(0.8, 1.0, computeTexture.a);

    // gl_FragColor = vec4(computeTexture.a, 0.0, 0.0,0.0);
    gl_FragColor = vColor;
}