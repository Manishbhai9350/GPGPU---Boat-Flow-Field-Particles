
// Uniforms
uniform sampler2D uGPGPUTexture;
uniform sampler2D uInitPositions;
uniform float uTime;
uniform float uDelta;
uniform float uFlowFieldInfluence;
uniform float uFlowFieldFrequency;
uniform float uFlowFieldSpeed;

// Varyings
varying vec2 vUv;

#include ../includes/simplexNoise4d.glsl
// #include ../includes/noise4d.glsl

// float simplexNoise4d(vec4 v) {
//     return noise4d(v);
// }

void main() {

    vec4 position = texture(uGPGPUTexture, vUv);
    vec4 InitialPositions = texture(uInitPositions, vUv);
    float life = position.a;

    float time = uTime * .4 * uFlowFieldSpeed;

    if(life >= 1.0) {
        life = fract(life);
        position.xyz = InitialPositions.xyz;
    } else {

        // Strength
        float strength = simplexNoise4d(vec4(InitialPositions.xyz * .15, time * 2.0));
        float influence = (uFlowFieldInfluence - .5) * -2.0;
        strength = smoothstep(influence, 1.0, strength);

        // Flow Field
        vec3 flowField = vec3(simplexNoise4d(vec4(position.xyz * uFlowFieldFrequency + 0.0, time + 1.0)), simplexNoise4d(vec4(position.xyz * uFlowFieldFrequency + 1.0, time + 2.0)), simplexNoise4d(vec4(position.xyz * uFlowFieldFrequency + 2.0, time + 3.0)));
        flowField = normalize(flowField);
        position.xyz += flowField * uDelta * strength * 0.6;

        life += uDelta * .2;

        // position.xyz = InitialPositions.xyz;
    }

    position.a = life;

    gl_FragColor = position;
}