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
const DefualtFragmentShader = `
    void main(){
        gl_FragColor = vec4(1.0,0.0,0.0,1.0);
    }
`;

export class GPGPU {
  fragmentShader = "";
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
    fragmentShader = DefualtFragmentShader,
    uniforms = {},
    materialOptions = {},
    renderer = null,
    size = 128,
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
      fragmentShader,
      uniforms: this.uniforms,
      ...materialOptions,
    });

    this.quad = new Mesh(new PlaneGeometry(2, 2), this.material);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.scene.add(this.camera, this.quad);

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
    this.renderInitially(initialTexture);
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

  renderInitially(initialTexture) {
    this.material.uniforms.uGPGPUTexture.value = initialTexture;
    this.renderer.setRenderTarget(this.currentRT);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
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
}
