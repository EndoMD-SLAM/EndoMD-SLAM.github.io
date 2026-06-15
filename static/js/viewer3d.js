import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

const STYLES = `
#viewer3d-root {
  font-family: Inter, sans-serif;
}
#viewer3d-canvas-wrap {
  position: relative;
  width: 100%;
  height: 500px;
  background: #ffffff;
}
#viewer3d-canvas-wrap canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
#viewer3d-overlay {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
}
#viewer3d-model-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1.5px solid #d8e1de;
  border-radius: 9px;
  background: #fff;
  color: #1e293b;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(24,34,38,0.08);
}
#viewer3d-model-pill::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0d6b62;
  box-shadow: 0 0 0 3px rgba(13,107,98,0.12);
}
#viewer3d-scene-label {
  border: 1.5px solid #e2e8f0;
  border-radius: 9px;
  background: rgba(255,255,255,0.92);
  color: #475569;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(24,34,38,0.06);
}
#viewer3d-spinner {
  display: none;
  position: absolute;
  inset: 0;
  z-index: 10;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 18px;
  background: linear-gradient(135deg, rgba(255,255,255,0.97), rgba(237,244,242,0.96));
  backdrop-filter: blur(8px);
}
#viewer3d-spinner.active {
  display: flex;
}
.viewer3d-spin-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #0d6b62, #c0892b, #b94b47, #0d6b62);
  animation: viewer3d-spin 1.1s linear infinite;
  mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px));
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px));
}
@keyframes viewer3d-spin {
  to { transform: rotate(360deg); }
}
.viewer3d-spin-label {
  color: #475569;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
#viewer3d-error {
  display: none;
  position: absolute;
  inset: 0;
  z-index: 11;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.92);
  color: #b94b47;
  font-size: 14px;
  text-align: center;
  padding: 24px;
}
#viewer3d-error.active {
  display: flex;
}
#viewer3d-scene-strip {
  display: flex;
  gap: 8px;
  align-items: stretch;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 10px;
}
.viewer3d-scene-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
}
.viewer3d-scene-thumb {
  width: 100%;
  height: 88px;
  border: 2.5px solid transparent;
  border-radius: 9px;
  object-fit: cover;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.viewer3d-scene-btn:hover .viewer3d-scene-thumb {
  border-color: rgba(13,107,98,0.35);
}
.viewer3d-scene-btn.active .viewer3d-scene-thumb {
  border-color: #0d6b62;
  box-shadow: 0 0 0 2px rgba(13,107,98,0.18);
}
.viewer3d-scene-lbl {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
}
.viewer3d-scene-btn.active .viewer3d-scene-lbl {
  color: #0d6b62;
  font-weight: 800;
}
@media (max-width: 720px) {
  #viewer3d-canvas-wrap {
    height: 430px;
  }
  #viewer3d-overlay {
    flex-direction: column;
    align-items: flex-start;
  }
  #viewer3d-scene-strip {
    overflow-x: auto;
  }
  .viewer3d-scene-btn {
    flex: 0 0 132px;
  }
  .viewer3d-scene-thumb {
    height: 76px;
  }
}
`;

class EndoViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scenes = [];
    this.currentSceneIdx = 0;
    this.pointCloud = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.loader = new PLYLoader();
  }

  async init() {
    const styleEl = document.createElement("style");
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);

    try {
      const response = await fetch("static/pointclouds/manifest.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      this.scenes = manifest.scenes || [];
      if (!this.scenes.length) throw new Error("No sequences in manifest");
    } catch (error) {
      this.container.innerHTML = `<div style="padding:24px;color:#b94b47;text-align:center;">Failed to load point cloud manifest: ${error.message}</div>`;
      return;
    }

    this.buildUI();
    this.initThree();
    await this.loadScene(0);
  }

  buildUI() {
    const canvasWrap = document.createElement("div");
    canvasWrap.id = "viewer3d-canvas-wrap";

    const overlay = document.createElement("div");
    overlay.id = "viewer3d-overlay";
    overlay.innerHTML = `
      <div id="viewer3d-model-pill">Ours</div>
      <div id="viewer3d-scene-label">${this.scenes[0].label}</div>
    `;

    const spinner = document.createElement("div");
    spinner.id = "viewer3d-spinner";
    spinner.innerHTML = '<div class="viewer3d-spin-ring"></div><div class="viewer3d-spin-label">Loading point cloud</div>';

    const error = document.createElement("div");
    error.id = "viewer3d-error";

    canvasWrap.appendChild(overlay);
    canvasWrap.appendChild(spinner);
    canvasWrap.appendChild(error);

    const strip = document.createElement("div");
    strip.id = "viewer3d-scene-strip";
    this.scenes.forEach((scene, idx) => {
      const button = document.createElement("button");
      button.className = `viewer3d-scene-btn${idx === 0 ? " active" : ""}`;
      button.type = "button";
      button.dataset.idx = String(idx);
      button.innerHTML = `
        <img class="viewer3d-scene-thumb" src="${scene.thumb}" alt="${scene.label}" loading="lazy">
        <span class="viewer3d-scene-lbl">${scene.label}</span>
      `;
      button.addEventListener("click", () => {
        if (idx !== this.currentSceneIdx) this.loadScene(idx);
      });
      strip.appendChild(button);
    });

    this.container.innerHTML = "";
    this.container.appendChild(canvasWrap);
    this.container.appendChild(strip);
  }

  initThree() {
    const wrap = document.getElementById("viewer3d-canvas-wrap");
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    wrap.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.camera = new THREE.PerspectiveCamera(60, wrap.clientWidth / wrap.clientHeight, 0.01, 5000);
    this.camera.position.set(0, 0, 3);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;

    new ResizeObserver(() => {
      renderer.setSize(wrap.clientWidth, wrap.clientHeight);
      this.camera.aspect = wrap.clientWidth / wrap.clientHeight;
      this.camera.updateProjectionMatrix();
    }).observe(wrap);

    const animate = () => {
      requestAnimationFrame(animate);
      this.controls.update();
      renderer.render(this.scene, this.camera);
    };
    animate();
  }

  async loadScene(idx) {
    const sceneMeta = this.scenes[idx];
    if (!sceneMeta) return;

    this.currentSceneIdx = idx;
    this.setSpinner(true);
    this.setError(null);
    document.getElementById("viewer3d-scene-label").textContent = sceneMeta.label;
    document.querySelectorAll(".viewer3d-scene-btn").forEach((button, buttonIdx) => {
      button.classList.toggle("active", buttonIdx === idx);
    });

    if (this.pointCloud) {
      this.scene.remove(this.pointCloud);
      this.pointCloud.geometry.dispose();
      this.pointCloud.material.dispose();
      this.pointCloud = null;
    }

    try {
      const geometry = await this.loadPly(sceneMeta.url);
      geometry.computeBoundingBox();
      const material = new THREE.PointsMaterial({
        size: 0.24,
        vertexColors: true,
        sizeAttenuation: true,
      });
      this.pointCloud = new THREE.Points(geometry, material);
      this.scene.add(this.pointCloud);
      this.fitCamera(geometry);
      this.setSpinner(false);
    } catch (error) {
      this.setSpinner(false);
      this.setError(`Failed to load ${sceneMeta.label}: ${error.message}`);
    }
  }

  loadPly(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });
  }

  fitCamera(geometry) {
    const box = geometry.boundingBox;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(radius * 0.42, -radius * 0.95, radius * 0.42));
    this.camera.near = Math.max(radius / 2500, 0.01);
    this.camera.far = radius * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  setSpinner(active) {
    document.getElementById("viewer3d-spinner")?.classList.toggle("active", active);
  }

  setError(message) {
    const error = document.getElementById("viewer3d-error");
    if (!error) return;
    error.textContent = message || "";
    error.classList.toggle("active", Boolean(message));
  }
}

new EndoViewer("viewer3d-root").init();
