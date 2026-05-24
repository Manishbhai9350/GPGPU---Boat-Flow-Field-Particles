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


const { PI } = Math;

const canvas = document.querySelector("canvas");

canvas.width = innerWidth;
canvas.height = innerHeight;

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  1,
  1000,
);
camera.position.set(7, 7, 10);
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
  model: null,
  count: 0,
  particles: null,
  size: 0.1,
  particleShaders: {
    vertex: ParticlesVertex,
    fragment: ParticlesFragment,
  },
  computeShader: {
    shader: ComputeShader,
    rows: 0,
    positionTexture: null,
  },
  gpgpu: null
};

GLB.load("/models/boat.glb", (glb) => {
  Particles.model = glb.scene.children[0];

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    wireframe: true,
  });
  Particles.model.material = material;

  const BoatGeo = Particles.model.geometry;

  // The number of particles
  Particles.count = BoatGeo.attributes.position.count;
  Particles.computeShader.rows = Math.floor(Math.sqrt(Particles.count)) + 1;

  const ParticlePositions = new Float32Array(
    Particles.computeShader.rows ** 2 * 4,
  );

  const BoatPos = BoatGeo.attributes.position;
  for (let i = 0; i < BoatPos.count; i++) {
    const i0 = i * 3 + 0;
    const i1 = i * 3 + 1;
    const i2 = i * 3 + 2;
    const i3 = i * 3 + 3;

    const I0 = BoatPos.array[i0];
    const I1 = BoatPos.array[i1];
    const I2 = BoatPos.array[i2];
    const I3 = 0;

    ParticlePositions[i0] = 0;
    ParticlePositions[i1] = 0;
    ParticlePositions[i2] = 0;
    ParticlePositions[i3] = 1;

    // ParticlePositions[i0] = I0;
    // ParticlePositions[i1] = I1;
    // ParticlePositions[i2] = I2;
    // ParticlePositions[i3] = I3;
  }

  const PositionTexture = new DataTexture(
    ParticlePositions,
    Particles.computeShader.rows,
    Particles.computeShader.rows,
    THREE.RGBAFormat,
    THREE.FloatType,
  );

  PositionTexture.needsUpdate = true;

  // Nearest filter if gpu land betwen pixel it picks the nearest pixel rather than interpolating the value;
  PositionTexture.magFilter = PositionTexture.minFilter = THREE.NearestFilter;
  
  // Clamps the value to edge rather then cycling the value;
  PositionTexture.wrapS = PositionTexture.wrapT = THREE.ClampToEdgeWrapping;

  Particles.computeShader.positionTexture = PositionTexture;

  Particles.gpgpu = new GPGPU({
    computeShader: Particles.computeShader.shader,
    initialTexture: Particles.computeShader.positionTexture,
    size: Particles.computeShader.rows,
    renderer
  })

  scene.add(Particles.model);
});

const controls = new OrbitControls(camera, canvas);

const clock = new Clock();
let PrevTime = clock.getElapsedTime();

function Animate() {
  const CurrentTime = clock.getElapsedTime();
  const DT = CurrentTime - PrevTime;
  PrevTime = CurrentTime;
  if(Particles.gpgpu) {
    renderer.render(Particles.gpgpu.scene,Particles.gpgpu.camera)
  } else {
    renderer.render(scene, camera);
  }
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
