import * as THREE from "three";
import { Scene } from "three";
import { Uniform } from "three";
import { ShaderMaterial } from "three";
import { PlaneGeometry } from "three";
import { Mesh } from "three";

const DefualtVertexShader = `
    varying vec2 vUv;
    void main(){
        vUv = uv;
        gl_Position = vec4(position,1.0);
    }
`;
const DefualtComputeShader = `
    void main(){
        gl_FragColor = vec4(1.0,0.0,0.0,1.0);
    }
`;

export class GPGPU {
  computeShader = "";
  target1 = null;
  target2 = null;
  quad = null;
  size = null;
  camera = null;
  renderer = null;
  scene = new Scene();
  textureType = null;
  uniforms = {
    uGPGPUTexture: new Uniform(null),
  };

  constructor({
    computeShader = DefualtComputeShader,
    uniforms = {},
    materialOptions = {},
    renderer = null,
    size,
    initialTexture,
  }) {
    this.size = size;
    this.uniforms = {
      ...this.uniforms,
      ...uniforms,
    };

    this.renderer =
      renderer ||
      new THREE.WebGLRenderer({
        powerPreference: "high-performance",
        alpha: true,
        antialias: true,
      });

    this.material = new ShaderMaterial({
      vertexShader: DefualtVertexShader,
      fragmentShader: computeShader,
      uniforms: this.uniforms,
      ...materialOptions,
    });

    this.quad = new Mesh(new PlaneGeometry(2, 2), this.material);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.scene.add(this.quad);

    const isWebGL2 = this.renderer.capabilities.isWebGL2;

    const hasFloatRT =
      isWebGL2 || this.renderer.extensions.get("EXT_color_buffer_float");

    const hasHalfFloatRT = this.renderer.extensions.get(
      "EXT_color_buffer_half_float",
    );

    if (hasFloatRT) {
      this.textureType = THREE.FloatType;
    } else if (hasHalfFloatRT) {
      this.textureType = THREE.HalfFloatType;
    } else {
      this.textureType = THREE.UnsignedByteType; // fallback
    }

    this.initRenderTargets();
    this.seedTexture(initialTexture);
  }

  initRenderTargets() {
    this.target1 = new THREE.WebGLRenderTarget(this.size, this.size, {
      type: this.textureType,
      format: THREE.RGBAFormat,
      internalFormat: this.isWebGL2 ? "RGBA32F" : undefined,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.target2 = new THREE.WebGLRenderTarget(this.size, this.size, {
      type: this.textureType,
      format: THREE.RGBAFormat,
      internalFormat: this.isWebGL2 ? "RGBA32F" : undefined,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });

    this.currentRT = this.target1;
    this.nextRT = this.target2;
  }

  seedTexture(initialTexture) {
    const passThroughMat = new ShaderMaterial({
      vertexShader: DefualtVertexShader,
      fragmentShader: `
      uniform sampler2D uTex;
      varying vec2 vUv;
      void main() { gl_FragColor = texture(uTex, vUv); }
    `,
      uniforms: { uTex: new Uniform(initialTexture) },
    });

    const prevMat = this.quad.material;
    this.quad.material = passThroughMat;

    this.renderer.setRenderTarget(this.target1);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(this.target2);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);

    this.quad.material = prevMat;
    passThroughMat.dispose();
  }

  addUniform(key, value) {
    this.material.uniforms[key] = { value };
  }

  updateUniform(key, value) {
    this.material.uniforms[key].value = value;
  }

  update(delta) {
    this.material.uniforms.uGPGPUTexture.value = this.currentRT.texture;

    this.renderer.setRenderTarget(this.nextRT);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);

    let temp = this.currentRT;
    this.currentRT = this.nextRT;
    this.nextRT = temp;
  }

  getComputedData() {
    return this.currentRT.texture;
  }
}
