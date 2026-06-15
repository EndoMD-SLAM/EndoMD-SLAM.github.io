import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

const root = document.getElementById("viewer3d-root");
const statusEl = root?.querySelector(".viewer-status");
const oursCloudId = "c2_cecum_t1_v3-ours-static";

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

  const ambient = new THREE.AmbientLight(0xffffff, 0.95);
  scene.add(ambient);

  const loader = new PLYLoader();
  let pointCloud = null;
  let cloudMeta = null;

  const material = new THREE.PointsMaterial({
    size: 0.26,
    vertexColors: true,
    sizeAttenuation: true,
  });

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function fitCameraToCloud() {
    if (!pointCloud) return;
    const box = new THREE.Box3().setFromObject(pointCloud);
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
    })).find((item) => item.id === oursCloudId);
  }

  function loadPointCloud(item) {
    return new Promise((resolve, reject) => {
      loader.load(
        item.file,
        (geometry) => {
          normalizeGeometry(geometry);
          const points = new THREE.Points(geometry, material);
          points.name = item.label;
          scene.add(points);
          resolve(points);
        },
        undefined,
        reject,
      );
    });
  }

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
    .then(async (item) => {
      if (!item) throw new Error("Ours point cloud not found");
      cloudMeta = item;
      setStatus("Loading reconstruction...");
      pointCloud = await loadPointCloud(item);
      setStatus(`${Number(cloudMeta.points || 0).toLocaleString()} colored points`);
      fitCameraToCloud();
      animate();
    })
    .catch((error) => {
      setStatus(`3D viewer failed to load: ${error.message}`);
    });
}
