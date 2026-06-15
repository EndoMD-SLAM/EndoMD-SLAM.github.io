import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

const root = document.getElementById("viewer3d-root");
const statusEl = root?.querySelector(".viewer-status");
const nameEl = document.getElementById("viewer-cloud-name");
const tabs = Array.from(document.querySelectorAll(".viewer-tab"));
const defaultCloudId = "c2_cecum_t1_v3-ours-static";

if (root) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(root.clientWidth, root.clientHeight);
  renderer.setClearAlpha(0);
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x071114, 18, 95);

  const camera = new THREE.PerspectiveCamera(42, root.clientWidth / root.clientHeight, 0.01, 5000);
  camera.position.set(0, -75, 36);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.32;

  scene.add(new THREE.AmbientLight(0xffffff, 0.98));

  const loader = new PLYLoader();
  const cloudObjects = new Map();
  const cloudItems = new Map();

  const materials = {
    static: new THREE.PointsMaterial({ size: 0.26, vertexColors: true, sizeAttenuation: true }),
    gt: new THREE.PointsMaterial({ size: 0.23, vertexColors: true, sizeAttenuation: true }),
    transient: new THREE.PointsMaterial({ size: 0.3, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9 }),
    trajectory: new THREE.PointsMaterial({ size: 0.85, vertexColors: true, sizeAttenuation: true }),
  };

  let activeId = defaultCloudId;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function setActiveTab(id) {
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.cloud === id);
    });
  }

  function fitCameraTo(points) {
    const box = new THREE.Box3().setFromObject(points);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(radius * 0.52, -radius * 1.05, radius * 0.54));
    camera.near = Math.max(radius / 2000, 0.01);
    camera.far = radius * 20;
    camera.updateProjectionMatrix();
    controls.update();
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
          geometry.computeBoundingBox();
          const material = materials[item.kind] || materials.static;
          const points = new THREE.Points(geometry, material);
          points.name = item.label;
          points.visible = false;
          scene.add(points);
          cloudObjects.set(item.id, points);
          resolve(points);
        },
        undefined,
        reject,
      );
    });
  }

  async function showCloud(id) {
    const item = cloudItems.get(id);
    if (!item) return;
    activeId = id;
    setActiveTab(id);
    if (nameEl) nameEl.textContent = item.label;
    setStatus(`Loading ${item.label}...`);

    let points = cloudObjects.get(id);
    if (!points) points = await loadPointCloud(item);

    cloudObjects.forEach((object, objectId) => {
      object.visible = objectId === id;
    });
    fitCameraTo(points);
    setStatus(`${Number(item.points || 0).toLocaleString()} colored points`);
  }

  function resize() {
    const width = root.clientWidth;
    const height = root.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.cloud;
      if (id && id !== activeId) showCloud(id).catch((error) => setStatus(error.message));
    });
  });

  function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  loadManifest()
    .then((items) => {
      items.forEach((item) => cloudItems.set(item.id, item));
      setActiveTab(defaultCloudId);
      return showCloud(defaultCloudId);
    })
    .then(animate)
    .catch((error) => {
      setStatus(`3D viewer failed to load: ${error.message}`);
    });
}
