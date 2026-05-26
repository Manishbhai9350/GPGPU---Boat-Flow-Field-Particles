import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { Clock } from "three";
import { GetSceneBounds } from "./utils";
import { Vector3 } from "three";
import { AmbientLight } from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

// Shaders
import ParticlesVertex from "./shaders/particles/vertex.glsl";
import ParticlesFragment from "./shaders/particles/fragment.glsl";
import ComputeShader from "./shaders/compute/compute.glsl";
import { Texture } from "three";
import { DataTexture } from "three";
import { GPGPU } from "./gpgpu/gpgpu";
import { PointsMaterial } from "three";
import { Mesh } from "three";
import { ShaderMaterial } from "three";
import { Points } from "three";
import { SphereGeometry } from "three";
import { BufferAttribute } from "three";
import { Uniform } from "three";
import { PlaneGeometry } from "three";
import { MeshBasicMaterial } from "three";
import { Pane } from "tweakpane";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Group } from "three";

const { PI } = Math;

const IsChartogne = window.location.pathname === "/chartogne";

const canvas = document.querySelector("canvas");

canvas.width = innerWidth;
canvas.height = innerHeight;

const gui = new Pane();

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.1,
  1000,
);
camera.position.set(4, 4, 4);
camera.lookAt(new Vector3(0, 0, 0));

const material = new THREE.MeshNormalMaterial();

const Manager = new THREE.LoadingManager();
const Draco = new DRACOLoader(Manager);
const GLB = new GLTFLoader(Manager);
const TextureLoader = new THREE.TextureLoader(Manager);

Draco.setDecoderPath("/draco/");
Draco.setDecoderConfig({ type: "wasm" });
GLB.setDRACOLoader(Draco);

const Particles = {
  count: 0,
  points: null,

  material: null,

  geometry: {
    source: null,
    buffer: null,
  },

  render: {
    size: 0.1,
    shaders: {
      vertex: ParticlesVertex,
      fragment: ParticlesFragment,
    },
  },

  gpgpu: {
    instance: null,
    textureSize: 0,
    positionTexture: null,
    shader: ComputeShader,
  },
};

if (IsChartogne) {
  GLB.load("/models/garden.glb", (glb) => {
    const garden = glb.scene;
    const geometries = [];

    garden.traverse((child) => {
      if (child.isMesh) {
        // clone so you don't mutate the original
        const geo = child.geometry.clone();
        // apply world transform so positions are in world space
        geo.applyMatrix4(child.matrixWorld);
        geo.scale(15, 15, 15);
        geometries.push(geo);
      }
    });
    console.log(geometries);
    const mg = mergeGeometries(geometries);
    Particles.geometry.source = mg;

    const geo = Particles.geometry.source;
    Particles.count = geo.attributes.position.count;

    const texSize = Math.floor(Math.sqrt(Particles.count)) + 1;
    Particles.gpgpu.textureSize = texSize;

    // Positions;
    const positionData = new Float32Array(texSize ** 2 * 4);
    const srcPos = geo.attributes.position;

    for (let i = 0; i < srcPos.count; i++) {
      const base = i * 4;
      positionData[base + 0] = srcPos.getX(i);
      positionData[base + 1] = srcPos.getY(i);
      positionData[base + 2] = srcPos.getZ(i);
      positionData[base + 3] = Math.random();
    }

    // Initial Position Texture;
    const positionTexture = new DataTexture(
      positionData,
      texSize,
      texSize,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    positionTexture.needsUpdate = true;
    positionTexture.magFilter = THREE.NearestFilter;
    positionTexture.minFilter = THREE.NearestFilter;
    positionTexture.wrapS = THREE.ClampToEdgeWrapping;
    positionTexture.wrapT = THREE.ClampToEdgeWrapping;

    // GPGPU Initialization;
    Particles.gpgpu.positionTexture = positionTexture;
    Particles.gpgpu.instance = new GPGPU({
      computeShader: Particles.gpgpu.shader,
      initialTexture: Particles.gpgpu.positionTexture,
      size: Particles.gpgpu.textureSize,
      renderer,
    });

    // Particles GPGPU UV's;

    const GPUV = new Float32Array(Particles.count * 2);

    for (let i = 0; i < Particles.count; i++) {
      const base = i * 2;
      const uvx =
        (i % Particles.gpgpu.textureSize) / Particles.gpgpu.textureSize;
      const uvy =
        Math.floor(i / Particles.gpgpu.textureSize) /
        Particles.gpgpu.textureSize;
      GPUV[base + 0] = uvx;
      GPUV[base + 1] = uvy;
    }

    // Creating Particles;
    Particles.geometry.buffer = Particles.geometry.source;
    Particles.geometry.buffer.setAttribute("guv", new BufferAttribute(GPUV, 2));
    Particles.material = new ShaderMaterial({
      vertexShader: ParticlesVertex,
      fragmentShader: ParticlesFragment,
      // depthWrite:false,
      transparent: true,
      uniforms: {
        uPositions: new Uniform(null),
        uResolution: new Uniform(new THREE.Vector2(innerWidth, innerHeight)),
        uSize: new Uniform(0.03),
      },
    });

    // GPGPU Compute Texture;
    Particles.gpgpu.computed = Particles.gpgpu.instance.getComputedData();
    Particles.material.uniforms.uPositions.value = Particles.gpgpu.computed;

    Particles.gpgpu.instance.addUniform("uTime", 0);
    Particles.gpgpu.instance.addUniform("uDelta", 0);
    Particles.gpgpu.instance.addUniform("uInitPositions", positionTexture);

    // GUI Uniforms
    Particles.gpgpu.instance.addUniform("uFlowFieldInfluence", 0.2);
    Particles.gpgpu.instance.addUniform("uFlowFieldFrequency", 1.2);
    Particles.gpgpu.instance.addUniform("uFlowFieldSpeed", 0.6);

    // GUI Bindings
    console.log(Particles.gpgpu.instance.getUniform("uFlowFieldInfluence"));
    console.log(
      gui.addBinding(
        Particles.gpgpu.instance.getUniform("uFlowFieldInfluence"),
        "value",
        {
          min: 0,
          max: 1,
          label: "Flow Field Influence",
        },
      ),
    );
    gui.addBinding(
      Particles.gpgpu.instance.getUniform("uFlowFieldFrequency"),
      "value",
      {
        min: 0,
        max: 2,
        label: "Flow Field Frequency",
      },
    );
    gui.addBinding(
      Particles.gpgpu.instance.getUniform("uFlowFieldSpeed"),
      "value",
      {
        min: 0,
        max: 5,
        label: "Flow Field Speed",
      },
    );

    Particles.points = new Points(
      Particles.geometry.buffer,
      Particles.material,
    );

    const PGroup = new Group();
    PGroup.add(Particles.points);

    PGroup.position.set(5, 0, 5);
    camera.position.y = 0.7;
    // camera.position.z += 1.5
    // camera.position.x += 1.5
    camera.lookAt(new Vector3(0, 0, 0));
    camera.fov = 75;
    PGroup.rotation.y = Math.PI / 4;

    document.body.style.background = `#FFFBE1`;

    scene.add(PGroup);
  });
} else {
  GLB.load("/models/boat.glb", (glb) => {
    // Model Goemetry;
    Particles.geometry.source = glb.scene.children[0];
    // Geometry For Particles;
    const geo = Particles.geometry.source.geometry;
    Particles.count = geo.attributes.position.count;

    const texSize = Math.floor(Math.sqrt(Particles.count)) + 1;
    Particles.gpgpu.textureSize = texSize;

    // Positions;
    const positionData = new Float32Array(texSize ** 2 * 4);
    const srcPos = geo.attributes.position;

    for (let i = 0; i < srcPos.count; i++) {
      const base = i * 4;
      positionData[base + 0] = srcPos.getX(i);
      positionData[base + 1] = srcPos.getY(i);
      positionData[base + 2] = srcPos.getZ(i);
      positionData[base + 3] = Math.random();
    }

    // Initial Position Texture;
    const positionTexture = new DataTexture(
      positionData,
      texSize,
      texSize,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    positionTexture.needsUpdate = true;
    positionTexture.magFilter = THREE.NearestFilter;
    positionTexture.minFilter = THREE.NearestFilter;
    positionTexture.wrapS = THREE.ClampToEdgeWrapping;
    positionTexture.wrapT = THREE.ClampToEdgeWrapping;

    // GPGPU Initialization;
    Particles.gpgpu.positionTexture = positionTexture;
    Particles.gpgpu.instance = new GPGPU({
      computeShader: Particles.gpgpu.shader,
      initialTexture: Particles.gpgpu.positionTexture,
      size: Particles.gpgpu.textureSize,
      renderer,
    });

    // Particles GPGPU UV's;

    const GPUV = new Float32Array(Particles.count * 2);

    for (let i = 0; i < Particles.count; i++) {
      const base = i * 2;
      const uvx =
        (i % Particles.gpgpu.textureSize) / Particles.gpgpu.textureSize;
      const uvy =
        Math.floor(i / Particles.gpgpu.textureSize) /
        Particles.gpgpu.textureSize;
      GPUV[base + 0] = uvx;
      GPUV[base + 1] = uvy;
    }

    // Creating Particles;
    Particles.geometry.buffer = Particles.geometry.source.geometry;
    Particles.geometry.buffer.setAttribute("guv", new BufferAttribute(GPUV, 2));
    Particles.material = new ShaderMaterial({
      vertexShader: ParticlesVertex,
      fragmentShader: ParticlesFragment,
      // depthWrite:false,
      transparent: true,
      uniforms: {
        uPositions: new Uniform(null),
        uResolution: new Uniform(new THREE.Vector2(innerWidth, innerHeight)),
        uSize: new Uniform(0.03),
      },
    });

    // GPGPU Compute Texture;
    Particles.gpgpu.computed = Particles.gpgpu.instance.getComputedData();
    Particles.material.uniforms.uPositions.value = Particles.gpgpu.computed;

    Particles.gpgpu.instance.addUniform("uTime", 0);
    Particles.gpgpu.instance.addUniform("uDelta", 0);
    Particles.gpgpu.instance.addUniform("uInitPositions", positionTexture);

    // GUI Uniforms
    Particles.gpgpu.instance.addUniform("uFlowFieldInfluence", 0.5);
    Particles.gpgpu.instance.addUniform("uFlowFieldFrequency", 0.8);
    Particles.gpgpu.instance.addUniform("uFlowFieldSpeed", 0.6);

    // GUI Bindings
    console.log(Particles.gpgpu.instance.getUniform("uFlowFieldInfluence"));
    console.log(
      gui.addBinding(
        Particles.gpgpu.instance.getUniform("uFlowFieldInfluence"),
        "value",
        {
          min: 0,
          max: 1,
          label: "Flow Field Influence",
        },
      ),
    );
    gui.addBinding(
      Particles.gpgpu.instance.getUniform("uFlowFieldFrequency"),
      "value",
      {
        min: 0,
        max: 2,
        label: "Flow Field Frequency",
      },
    );
    gui.addBinding(
      Particles.gpgpu.instance.getUniform("uFlowFieldSpeed"),
      "value",
      {
        min: 0,
        max: 5,
        label: "Flow Field Speed",
      },
    );

    Particles.points = new Points(
      Particles.geometry.buffer,
      Particles.material,
    );

    scene.add(Particles.points);
  });
}

const controls = new OrbitControls(camera, canvas);

const clock = new Clock();
let PrevTime = clock.getElapsedTime();

function Animate() {
  const CurrentTime = clock.getElapsedTime();
  const DT = CurrentTime - PrevTime;
  PrevTime = CurrentTime;

  if (Particles.gpgpu.instance) {
    Particles.gpgpu.instance.updateUniform("uTime", CurrentTime);
    Particles.gpgpu.instance.updateUniform("uDelta", DT);
    Particles.gpgpu.instance.update(DT);
    // re-fetch after swap, not before
    Particles.material.uniforms.uPositions.value =
      Particles.gpgpu.instance.getComputedData();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(Animate);
}

requestAnimationFrame(Animate);

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  renderer.setSize(innerWidth, innerHeight);
}

window.addEventListener("resize", resize);
