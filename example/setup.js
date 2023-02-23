import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import Stats from "three/examples/jsm/libs/stats.module.js";

export function setupScene(
  tickFunc /* ?: (deltaTime: number) => void */,
  withVR,
  withStats
) {
  console.log(getRenderInfo());

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  /* renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1; */
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const camera = new THREE.PerspectiveCamera(
    80,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0.0, 1.5, 2.0);
  const cameraContainer = new THREE.Group();
  cameraContainer.add(camera);

  const scene = new THREE.Scene();

  {
    const light = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(light);
  }
  {
    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(0, 10, -10).normalize();
    scene.add(light);
  }
  {
    const sky = new Sky();
    sky.name = "sky";
    sky.scale.setScalar(450000);
    scene.add(sky);

    const uniforms = sky.material.uniforms;
    const phi = THREE.MathUtils.degToRad(90 - 30);
    const theta = THREE.MathUtils.degToRad(180);

    const sun = new THREE.Vector3();
    sun.setFromSphericalCoords(1, phi, theta);

    uniforms["sunPosition"].value.copy(sun);
  }
  let ground;
  {
    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50, 1, 1),
      new THREE.MeshLambertMaterial({
        color: 0x5e5e5e,
      })
    );
    ground.name = "ground";
    ground.rotation.x = Math.PI / -2;
    scene.add(ground);
  }
  {
    const gridHelper = new THREE.GridHelper(50, 50);
    scene.add(gridHelper);
  }

  let stats;
  if (withStats) {
    stats = createStats();
    document.body.appendChild(stats.stats.dom);
    stats.object3D.position.set(-0.5, -0.3, -1.5);
    stats.object3D.scale.set(0.003, 0.003, 0.003);
    camera.add(stats.object3D);
    stats.object3D.visible = false;
    renderer.xr.addEventListener("sessionstart", () => {
      stats.object3D.visible = true;
    });
    renderer.xr.addEventListener("sessionend", () => {
      stats.object3D.visible = false;
    });
  }

  const clock = new THREE.Clock();
  function animate() {
    if (withStats) {
      stats.stats.begin();
    }

    const dt = clock.getDelta();
    if (tickFunc) {
      tickFunc(dt);
    }

    renderer.render(scene, camera);

    if (withStats) {
      stats.stats.end();
    }
  }
  renderer.setAnimationLoop(animate);

  let vrButton = undefined;
  if (withVR) {
    if ("xr" in navigator) {
      renderer.xr.enabled = true;

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          if (renderer.xr.isPresenting) {
            renderer.xr.getSession()?.end();
          }
        }
      });
      vrButton = VRButton.createButton(renderer);
      document.body.appendChild(vrButton);
    } else {
      if (window.isSecureContext === false) {
        console.warn("webxr needs https");
      } else {
        console.warn("webxr not available");
      }
    }
  }

  {
    // For Three.js Inspector (https://zz85.github.io/zz85-bookmarklets/threelabs.html)
    window.THREE = THREE;
    window._scene = scene;
  }

  const res = {
    camera,
    scene,
    renderer,
    cameraContainer,
    ground,
    stats,
    vrButton,
  };
  window._debugCtx = res; // debug
  return res;
}

export function createBridge() {
  const res = new THREE.Group();
  res.name = "bridge";
  const material = new THREE.MeshStandardMaterial({ color: 0xffd479 });

  let y = 0;
  let z = 0;
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.2), material);
    m.position.set(0, y, z);
    y += 0.2;
    z += 0.2;
    res.add(m);
  }
  z -= 0.1;
  {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 5), material);
    m.position.set(0, y, z + 2.5);
    res.add(m);
    z += 5;
  }
  y -= 0.2;
  z += 0.1;
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.2), material);
    m.position.set(0, y, z);
    y -= 0.2;
    z += 0.2;
    res.add(m);
  }

  return res;
}

export function createTransformControls(
  camera /* :THREE.Camera*/,
  domElement /* ?:HTMLElement*/,
  onToggleTransform /* ?:(enabled:boolean)=>void */
) {
  const tc = new TransformControls(camera, domElement);
  tc.addEventListener("dragging-changed", (e) => {
    if (onToggleTransform) {
      onToggleTransform(e.value);
    }
  });
  let downTm = 0;
  tc.addEventListener("mouseDown", (_e) => {
    downTm = new Date().getTime();
    //
  });
  tc.addEventListener("mouseUp", (_e) => {
    const now = new Date().getTime();
    if (now - downTm > 300) {
      return;
    }
    const prev = tc.getMode();
    if (prev === "translate") {
      tc.setMode("rotate");
    } else {
      tc.setMode("translate");
    }
  });

  return tc;
}

function createStats() {
  const stats = new Stats();
  const canvas = stats.dom.children[0];
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(
      canvas.width * window.devicePixelRatio,
      canvas.height * window.devicePixelRatio
    ),
    new THREE.MeshBasicMaterial()
  );
  panel.name = "stats";
  const textureLoader = new THREE.TextureLoader();

  const updateMesh = () => {
    const img = canvas.toDataURL("image/png");
    textureLoader.load(img, (v) => {
      panel.material.map?.dispose();
      panel.material.map = v;
      panel.material.needsUpdate = true;
    });
  };
  setInterval(updateMesh, 1000);

  return {
    object3D: panel,
    stats,
  };
}

export function getRenderInfo() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      return {
        vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
      };
    }
  } catch (ex) {
    console.warn(ex);
  }
}
