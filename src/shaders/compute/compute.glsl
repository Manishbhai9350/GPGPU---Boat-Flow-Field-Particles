uniform sampler2D uGPGPUTexture;
uniform sampler2D uInitPositions;
uniform float uTime;
uniform float uDelta;
varying vec2 vUv;

#include ../includes/noise4d.glsl

void main() {
    // gl_FragColor = vec4(vUv,0.0,1.0);
    vec4 position = texture(uGPGPUTexture, vUv);
    vec3 positionOffset = vec3(0.0);
    float life = position.a;

    life += .01; // tune — lower = longer life

    vec4 initPos = texture(uInitPositions, vUv);
    if(life >= 1.0) {
        gl_FragColor = vec4(initPos.xyz, 0.0); // reset life to 0 not life
        return;
    }

    positionOffset.x = snoise(vec4(initPos.xyz * 0.16, uTime * .1)) * 1.35;
    positionOffset.y = snoise(vec4(initPos.xyz * 0.38, -uTime * .1)) * 1.2;
    positionOffset.z = snoise(vec4(initPos.xyz * 0.285, -uTime * .1)) * 1.15;

    // ease out as life ends
    float ease = sin(life * 3.14159);

    position.xyz = initPos.xyz + positionOffset * ease;
    position.w = life;

    gl_FragColor = position;

    gl_FragColor = position;
}