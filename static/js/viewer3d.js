import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

const root = document.getElementById("viewer3d-root");
const statusEl = root?.querySelector(".viewer-status");
const chips = Array.from(document.querySelectorAll(".viewer-chip"));

if (root) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(root.clientWidth, root.clientHeight);
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8fbfa);

  const camera = new THREE.PerspectiveCamera(42, root.clientWidth / root.clientHeight, 0.01, 5000);
  camera.position.set(0, -75, 36);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;

  const ambient = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambient);

  const grid = new THREE.GridHelper(140, 14, 0xc8d7d3, 0xe2eae8);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  const loader = new PLYLoader();
  const groups = new Map();
  const active = new Set(["c2_cecum_t1_v3-base-static", "c2_cecum_t1_v3-ours-static"]);
  let manifest = [];

  const materials = {
    static: new THREE.PointsMaterial({ size: 0.23, vertexColors: true, sizeAttenuation: true }),
    gt: new THREE.PointsMaterial({ size: 0.2, vertexColors: true, sizeAttenuation: true }),
    transient: new THREE.PointsMaterial({ size: 0.28, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.82 }),
    trajectory: new THREE.PointsMaterial({ size: 0.75, vertexColors: true, sizeAttenuation: true }),
  };

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function fitCameraToVisible() {
    const box = new THREE.Box3();
    let any = false;
    groups.forEach((points) => {
      if (!points.visible) return;
      box.expandByObject(points);
      any = true;
    });
    if (!any) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(0, -radius * 1.15, radius * 0.62));
    camera.near = Math.max(radius / 2000, 0.01);
    camera.far = radius * 20;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function syncVisibility() {
    groups.forEach((points, id) => {
      points.visible = active.has(id);
    });
    chips.forEach((chip) => {
      chip.classList.toggle("active", active.has(chip.dataset.cloud));
    });
    const visibleCount = manifest
      .filter((item) => active.has(item.id))
      .reduce((sum, item) => sum + Number(item.points || 0), 0);
    setStatus(`${active.size} layer${active.size === 1 ? "" : "s"} · ${visibleCount.toLocaleString()} points`);
    fitCameraToVisible();
  }

  function normalizeGeometry(geometry) {
    geometry.computeBoundingBox();
    return geometry;
  }

  async function loadManifest() {
    const response = await fetch("static/pointclouds/manifest.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`manifest ${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data) ? data : data.clouds || [];
    return items.map((item) => ({
      ...item,
      id: item.id || (item.key ? `c2_cecum_t1_v3-${item.key}` : item.label),
      file: item.file || item.url,
    }));
  }

  function loadPointCloud(item) {
    return new Promise((resolve, reject) => {
      loader.load(
        item.file,
        (geometry) => {
          normalizeGeometry(geometry);
          const material = materials[item.kind] || materials.static;
          const points = new THREE.Points(geometry, material);
          points.name = item.label;
          points.visible = active.has(item.id);
          groups.set(item.id, points);
          scene.add(points);
          resolve(points);
        },
        undefined,
        reject,
      );
    });
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.cloud;
      if (!id) return;
      if (active.has(id)) {
        active.delete(id);
      } else {
        active.add(id);
      }
      if (!active.size) active.add(id);
      syncVisibility();
    });
  });

  function resize() {
    const width = root.clientWidth;
    const height = root.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);

  function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  loadManifest()
    .then(async (items) => {
      manifest = items;
      setStatus("Loading point clouds...");
      for (const item of items) {
        await loadPointCloud(item);
      }
      syncVisibility();
      animate();
    })
    .catch((error) => {
      setStatus(`3D viewer failed to load: ${error.message}`);
    });
}
