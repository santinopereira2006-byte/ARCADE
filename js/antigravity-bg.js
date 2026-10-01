/**
 * Antigravity 3D Particle Field Background
 * Pure Three.js implementation matching @react-bits/Antigravity-JS-CSS
 *
 * Parameters:
 *   count: 300,
 *   magnetRadius: 10,
 *   ringRadius: 10,
 *   waveSpeed: 0.3,
 *   waveAmplitude: 1,
 *   particleSize: 2,
 *   lerpSpeed: 0.1,
 *   color: '#FF9FFC',
 *   autoAnimate: false,
 *   particleVariance: 1,
 *   rotationSpeed: 0,
 *   depthFactor: 1,
 *   pulseSpeed: 3,
 *   particleShape: 'capsule',
 *   fieldStrength: 10
 */

import * as THREE from "three";

export class AntigravityBackground {
  constructor(canvas, options = {}) {
    if (!canvas) throw new Error("Antigravity: Canvas element required.");
    this.canvas = canvas;

    this.count = options.count ?? 300;
    this.magnetRadius = options.magnetRadius ?? 10;
    this.ringRadius = options.ringRadius ?? 10;
    this.waveSpeed = options.waveSpeed ?? 0.3;
    this.waveAmplitude = options.waveAmplitude ?? 1;
    this.particleSize = options.particleSize ?? 2;
    this.lerpSpeed = options.lerpSpeed ?? 0.1;
    this.color = options.color ?? "#FF9FFC";
    this.autoAnimate = options.autoAnimate ?? false;
    this.particleVariance = options.particleVariance ?? 1;
    this.rotationSpeed = options.rotationSpeed ?? 0;
    this.depthFactor = options.depthFactor ?? 1;
    this.pulseSpeed = options.pulseSpeed ?? 3;
    this.particleShape = options.particleShape ?? "capsule";
    this.fieldStrength = options.fieldStrength ?? 10;

    this.dummy = new THREE.Object3D();
    this.lastMousePos = { x: 0, y: 0 };
    this.lastMouseMoveTime = 0;
    this.virtualMouse = { x: 0, y: 0 };
    this.pointer = { x: 0, y: 0 }; // normalized -1 to 1

    this.clock = new THREE.Clock();
    this.running = false;
    this.animationFrameId = null;

    this.init();
  }

  init() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06070c, 0.018);

    // Camera (matching React Three Fiber default Canvas config: position [0, 0, 50], fov: 35)
    this.camera = new THREE.PerspectiveCamera(35, width / Math.max(1, height), 0.1, 1000);
    this.camera.position.set(0, 0, 50);

    // Compute visible viewport at z = 0
    this.updateViewportDimensions();

    // Create particles data
    this.createParticles();

    // Create instanced mesh
    this.createInstancedMesh();

    // Event listeners
    this.onPointerMove = (e) => {
      // Normalized coordinates (-1 to 1)
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    this.onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
      this.updateViewportDimensions();
    };

    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("resize", this.onResize, { passive: true });

    this.start();
  }

  updateViewportDimensions() {
    const distance = this.camera.position.z;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * distance;
    const width = height * this.camera.aspect;
    this.viewport = { width, height };
  }

  createParticles() {
    this.particles = [];
    const width = this.viewport.width || 100;
    const height = this.viewport.height || 100;

    for (let i = 0; i < this.count; i++) {
      const t = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;
      const xFactor = -50 + Math.random() * 100;
      const yFactor = -50 + Math.random() * 100;
      const zFactor = -50 + Math.random() * 100;

      const x = (Math.random() - 0.5) * width;
      const y = (Math.random() - 0.5) * height;
      const z = (Math.random() - 0.5) * 20;

      const randomRadiusOffset = (Math.random() - 0.5) * 2;

      this.particles.push({
        t,
        factor,
        speed,
        xFactor,
        yFactor,
        zFactor,
        mx: x,
        my: y,
        mz: z,
        cx: x,
        cy: y,
        cz: z,
        vx: 0,
        vy: 0,
        vz: 0,
        randomRadiusOffset
      });
    }
  }

  createInstancedMesh() {
    let geometry;
    if (this.particleShape === "capsule") {
      geometry = new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
    } else if (this.particleShape === "sphere") {
      geometry = new THREE.SphereGeometry(0.2, 16, 16);
    } else if (this.particleShape === "box") {
      geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    } else {
      geometry = new THREE.TetrahedronGeometry(0.3);
    }

    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.color),
      transparent: true,
      opacity: 0.85
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const tick = () => {
      if (!this.running) return;
      this.render();
      this.animationFrameId = requestAnimationFrame(tick);
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  render() {
    if (!this.mesh) return;

    // Check if 3D arcade room is currently active; if so, skip render to save resources
    if (document.body.classList.contains("room3d-mode")) {
      return;
    }

    const m = this.pointer;
    const v = this.viewport;
    const elapsedTime = this.clock.getElapsedTime();

    const mouseDist = Math.sqrt(
      Math.pow(m.x - this.lastMousePos.x, 2) + Math.pow(m.y - this.lastMousePos.y, 2)
    );

    if (mouseDist > 0.001) {
      this.lastMouseMoveTime = Date.now();
      this.lastMousePos = { x: m.x, y: m.y };
    }

    let destX = (m.x * v.width) / 2;
    let destY = (m.y * v.height) / 2;

    if (this.autoAnimate && Date.now() - this.lastMouseMoveTime > 2000) {
      destX = Math.sin(elapsedTime * 0.5) * (v.width / 4);
      destY = Math.cos(elapsedTime * 0.5 * 2) * (v.height / 4);
    }

    const smoothFactor = 0.05;
    this.virtualMouse.x += (destX - this.virtualMouse.x) * smoothFactor;
    this.virtualMouse.y += (destY - this.virtualMouse.y) * smoothFactor;

    const targetX = this.virtualMouse.x;
    const targetY = this.virtualMouse.y;
    const globalRotation = elapsedTime * this.rotationSpeed;

    const {
      waveSpeed,
      waveAmplitude,
      fieldStrength,
      magnetRadius,
      ringRadius,
      depthFactor,
      lerpSpeed,
      pulseSpeed,
      particleVariance,
      particleSize
    } = this;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      let { mx, my, mz, cz, randomRadiusOffset } = particle;

      particle.t += particle.speed / 2;
      const t = particle.t;

      const projectionFactor = 1 - cz / 50;
      const projectedTargetX = targetX * projectionFactor;
      const projectedTargetY = targetY * projectionFactor;

      const dx = mx - projectedTargetX;
      const dy = my - projectedTargetY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let targetPos = { x: mx, y: my, z: mz * depthFactor };

      if (dist < magnetRadius) {
        const angle = Math.atan2(dy, dx) + globalRotation;
        const wave = Math.sin(t * waveSpeed + angle) * (0.5 * waveAmplitude);
        const deviation = randomRadiusOffset * (5 / (fieldStrength + 0.1));
        const currentRingRadius = ringRadius + wave + deviation;

        targetPos.x = projectedTargetX + currentRingRadius * Math.cos(angle);
        targetPos.y = projectedTargetY + currentRingRadius * Math.sin(angle);
        targetPos.z = mz * depthFactor + Math.sin(t) * (1 * waveAmplitude * depthFactor);
      }

      particle.cx += (targetPos.x - particle.cx) * lerpSpeed;
      particle.cy += (targetPos.y - particle.cy) * lerpSpeed;
      particle.cz += (targetPos.z - particle.cz) * lerpSpeed;

      this.dummy.position.set(particle.cx, particle.cy, particle.cz);
      this.dummy.lookAt(projectedTargetX, projectedTargetY, particle.cz);
      this.dummy.rotateX(Math.PI / 2);

      const currentDistToMouse = Math.sqrt(
        Math.pow(particle.cx - projectedTargetX, 2) + Math.pow(particle.cy - projectedTargetY, 2)
      );

      const distFromRing = Math.abs(currentDistToMouse - ringRadius);
      let scaleFactor = 1 - distFromRing / 10;
      scaleFactor = Math.max(0, Math.min(1, scaleFactor));

      const finalScale = scaleFactor * (0.8 + Math.sin(t * pulseSpeed) * 0.2 * particleVariance) * particleSize;
      this.dummy.scale.set(finalScale, finalScale, finalScale);
      this.dummy.updateMatrix();

      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.stop();
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("resize", this.onResize);
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    this.renderer.dispose();
  }
}
