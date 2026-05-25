uniform sampler2D uGPGPUTexture;
uniform sampler2D uInitPositions;
uniform float uTime;
uniform float uDelta;
varying vec2 vUv;

#include ../includes/noise4d.glsl

void main() {

    vec4 position = texture(uGPGPUTexture, vUv);
    vec4 InitialPositions = texture(uInitPositions, vUv);
    float life = fract(position.a);

    if(life >= 1.0) {
        life = 0.0;
        position.xyz = InitialPositions.xyz;
    } else {

        vec3 flowField = vec3(snoise(vec4(position.xyz * .1 + 0.0, uTime * .1)), snoise(vec4(position.xyz + 1.0, uTime * .2)), snoise(vec4(position.xyz + 2.0, uTime * .3)));

        flowField = normalize(flowField);
        life += uDelta * .5;

        float strength = snoise(vec4(InitialPositions.xyz * .2,uTime * .3 + 2.0));

        position.xyz += flowField * 0.03 * strength;
    }

    position.a = life;

    gl_FragColor = position;
}