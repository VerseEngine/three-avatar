import * as THREE from "three";
import type { Avatar } from "./avatar";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

/**
 * Automatically adjust camera when switching between VR and non-VR modes.
*
* @param getAvatar - If the avatar is changed after calling registerSyncAvatarHeadAndCamera, it will continue to work correctly.
* @example
* ```ts
registerSyncAvatarHeadAndCamera(
  renderer.xr,
  camera,
  camera,
  camera.parent,
  () => _avatar,
  {
    onVR: async () => {
      playerController.isVR = true;
    },
    onNonVR: async () => {
      playerController.isVR = false;
      setNonVRCameraMode(camera, camera.parent, avatar, isFPS);
    },
  }
);
* ```
 */
export async function registerSyncAvatarHeadAndCamera(
  xr: THREE.WebXRManager,
  nonVrCamera: THREE.PerspectiveCamera,
  head: THREE.Object3D,
  headOffset: THREE.Object3D,
  getAvatar: () => Avatar | undefined,
  options: {
    onVR: () => Promise<void> | void;
    onNonVR: () => Promise<void> | void;
  }
) {
  let positions: [THREE.Vector3, THREE.Vector3] | undefined;
  let rotation: THREE.Euler | undefined;

  const setupVR = async () => {
    positions = [head.position.clone(), headOffset.position.clone()];
    rotation = headOffset.rotation.clone(); // save Non VR camera rotation
    headOffset.rotation.set(0, 0, 0);

    let avatar: Avatar | undefined;
    while (!(avatar = getAvatar())) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    xr.updateCamera(nonVrCamera);
    // waitForVRCameraInitialized
    while (Math.round(xr.getCamera().position.y * 10) === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    headOffset.position.setY(avatar.getHeadHeight() - head.position.y);

    const p = options?.onVR?.();
    if (p) {
      await p;
    }
  };
  const setupNonVR = async () => {
    head.rotation.set(0, 0, 0);
    if (rotation) {
      headOffset.rotation.copy(rotation); // restore Non VR camera rotation
    }
    if (positions) {
      head.position.copy(positions[0]);
      headOffset.position.copy(positions[1]);
    }
    const p = options?.onNonVR?.();
    if (p) {
      await p;
    }
  };
  xr.addEventListener("sessionstart", setupVR);
  xr.addEventListener("sessionend", setupNonVR);

  if (xr.isPresenting) {
    setupVR();
  } else {
    setupNonVR();
  }
}

/**
 * Whether the device does not have a GPU capable of processing enough.
 * (Experimental Features)
 *
 * @remarks
 * Intended to be used to adjust texture size, processing load, etc.
 * The current implementation is a very tentative decision and needs to be improved.
 */
export function isLowSpecDevice(): boolean {
  const info = getRenderInfo();
  if (!info) {
    return false;
  }
  if (info.vendor === "Qualcomm") {
    return true;
  }
  if (info.vendor.includes("Intel")) {
    if (info.renderer.includes("Iris")) {
      return true;
    }
  }
  if (isAndroid() || isIOS()) {
    return true;
  }
  return false;
}
export function isAndroid() {
  return navigator.userAgent.includes("Android");
}
export function isIOS() {
  return navigator.userAgent.includes("Mac") && isTouchDevice();
}
export function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/**
 * Get GPU information.
 * See also {@link https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info | WEBGL_debug_renderer_info}
 */
export function getRenderInfo():
  | { vendor: string; renderer: string }
  | undefined {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      return;
    }
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      return {
        vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "",
        renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "",
      };
    }
  } catch (ex) {
    console.warn(ex);
  }
}

/**
 * Adjust the camera for non-VR mode.
 * @param isFirstPerson - First person view or 3rd person view.
 */
export async function setNonVRCameraMode(
  camera: THREE.Camera,
  cameraOffset: THREE.Object3D,
  avatar: Avatar,
  isFirstPerson: boolean // first person view or third person view
) {
  if (isFirstPerson) {
    avatar.setFirstPersonMode([camera]);
    camera.position.set(0, avatar.getHeadHeight(), 0);
    cameraOffset.rotation.set(0, 0, 0);
  } else {
    avatar.setThirdPersonMode([camera]);
    camera.position.set(0.0, avatar.getHeadHeight() + 0.2, 2.0);
    cameraOffset.rotation.set(-0.2, 0, 0);
  }
}

const DEFAULT_MIRROR_DISTANCE_VR = 0.3;
const DEFAULT_MIRROR_DISTANCE_NON_VR = 1.2;

export interface AddMirrorHUDOptions {
  /**
   * `renderer.xr`
   */
  xr?: THREE.WebXRManager;
  /**
   * Distance between avatar and mirror  (In VR mode). Default is 0.3.
   */
  distanceVR?: number;
  /**
   * Distance between avatar and mirror  (In non-VR mode). Default is 1.2.
   */
  distanceNonVR?: number;
}

/**
 * Create a mirror in front of the avatar.
 *
 * @param container - Where to ADD mirrors.
 */
export function addMirrorHUD(
  avatar: Avatar,
  container: THREE.Object3D,
  options?: AddMirrorHUDOptions
): Reflector {
  const distanceNonVR =
    options?.distanceNonVR || DEFAULT_MIRROR_DISTANCE_NON_VR;
  const distanceVR = options?.distanceVR || DEFAULT_MIRROR_DISTANCE_VR;
  const mirror = new Reflector(new THREE.PlaneGeometry(0.6, 1.2), {
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio,
    color: 0x777777,
  });
  mirror.camera.layers.enableAll();
  mirror.camera.layers.disable(avatar.firstPersonOnlyLayer);
  mirror.name = "mirrorHUD";

  if (options?.xr) {
    const xr = options.xr;
    const ref = new WeakRef(mirror);
    const update = () => {
      ref
        .deref()
        ?.position?.set(
          0,
          avatar.getHeadHeight(),
          (options?.xr?.isPresenting ? distanceVR : distanceNonVR) * -1
        );
    };
    xr.addEventListener("sessionstart", update);
    xr.addEventListener("sessionend", update);
    const dispose = mirror.dispose.bind(mirror);
    mirror.dispose = () => {
      dispose();
      xr.removeEventListener("sessionstart", update);
      xr.removeEventListener("sessionend", update);
    };
  }

  mirror.position.set(
    0,
    avatar.getHeadHeight(),
    (options?.xr?.isPresenting ? distanceVR : distanceNonVR) * -1
  );
  container.add(mirror);
  return mirror;
}
