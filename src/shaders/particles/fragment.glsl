// Varyings
varying vec4 vColor;
varying vec2 vGuv;
varying vec2 vScreenUV;


// Uniforms 
uniform vec2 uResolution;
uniform sampler2D uMask;
uniform sampler2D uPositions;

void main() {
    vec2 uv = gl_PointCoord;
    vec4 computeTexture = texture(uPositions, vGuv);

    // gl_FragColor = vColor;
    float pointSZ = 1.0 - smoothstep(0.8, 1.0, computeTexture.a);

    float l = length((uv - vec2(.5)) * 2.0);

    if(l > 1.0) {
        discard;
    }

    // gl_FragColor = vec4(computeTexture.a, 0.0, 0.0,1.0);
    // gl_FragColor = vec4(vScreenUV, 0.0,1.0);
    // gl_FragColor = vec4(gl_PointCoord,1.0);
    gl_FragColor = vColor;

    // Masking
    float mask = texture(uMask,vScreenUV).r;
    gl_FragColor.a *= mask;

    #include <colorspace_fragment>
    #include <tonemapping_fragment>
}