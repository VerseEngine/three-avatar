import * as THREE from "three";
import * as THREE_VRM from "@pixiv/three-vrm";
import {
  GLTFLoader,
  GLTFParser,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { convertForReadyPlayerMe, convertForVrm } from "./mixamo";
import { AvatarModel } from "./types";
// import { MeshoptDecoder } from "meshoptimizer";

// https://github.com/google/draco
const DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.5/";
const BASIS_TRANSCODER_PATH =
  "https://cdn.jsdelivr.net/npm/three@0.149.0/examples/jsm/libs/basis/";
const MESHOPT_DECODER_PATH =
  "https://cdn.jsdelivr.net/npm/meshoptimizer@0.18.1/meshopt_decoder.js";

/**
 * URL of the library required if GLTF data is compressed. If omitted, decompress with default values.
 *
 * @remarks
 * {@link https://threejs.org/docs/#examples/en/loaders/DRACOLoader | DRACOLoader},  {@link https://threejs.org/docs/?q=KTX2Loader#examples/en/loaders/KTX2Loader | KTX2Loader}, {@link https://threejs.org/docs/?q=gltfl#examples/en/loaders/GLTFLoader | GLTFLoader}
 */
export type DecordersOptions = {
  dracoDecoderPath?: string;
  basisTranscoderPath?: string;
  meshoptDecoderPath?: string;
};

type AvatarAnimationData = {
  walk: THREE.Group;
  idle: THREE.Group;
  [key: string]: THREE.Group;
};
let avatarAnimationData: AvatarAnimationData | null = null;

// export type AvatarDataType = "mixamo" | "readyplayerme" | "vrm";
// type FileType = "fbx" | "gltf";

/**
* {@link https://www.mixamo.com/ | mixamo} animation file URLs
*
* @example
* ```ts
const ANIMATION_MAP = {
  idle: "asset/animation/idle.fbx",
  walk: "asset/animation/walk.fbx",
  dance: "asset/animation/dance.fbx",
};
* ```
*/
export type AvatarAnimationDataSource = {
  walk: string;
  idle: string;
  [key: string]: string;
};

/**
 * Whether animation data is pre-loaded or not
 */
export function isAnimationDataLoaded() {
  return !!avatarAnimationData;
}

/**
 * Pre-load animation data.
*
* @example
```ts
// Animation fbx files downloaded from mixamo.com
const ANIMATION_MAP = {
  idle: "path/to/idle.fbx",
  walk: "path/to/walk.fbx",
  dance: "path/to/dance.fbx",
  ...
};
if (!isAnimationDataLoaded()) {
  await preLoadAnimationData(ANIMATION_MAP);
}
```
 */
export async function preLoadAnimationData(
  source: AvatarAnimationDataSource,
  fetchFunc: (url: string) => Promise<Response> = fetch
) {
  const ps = Object.entries(source).map(([k, v]) => {
    return (async (k) => {
      const res = await (await fetchFunc(v)).arrayBuffer();
      const asset = new FBXLoader().parse(
        res,
        "about:blank" // No additional data is needed. about:blank
      );
      return [k, asset];
    })(k);
  });
  avatarAnimationData = Object.fromEntries(await Promise.all(ps));
}

async function createGLTFLoader(
  renderer: THREE.WebGLRenderer,
  options?: DecordersOptions
) {
  const loader = new GLTFLoader();

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(options?.dracoDecoderPath || DRACO_DECODER_PATH);
  loader.setDRACOLoader(dracoLoader);

  const ktx2Loader = new KTX2Loader();
  ktx2Loader
    .setTranscoderPath(options?.basisTranscoderPath || BASIS_TRANSCODER_PATH)
    .detectSupport(renderer);
  loader.setKTX2Loader(ktx2Loader);

  const meshoptDecoder = await fetchScript(
    options?.meshoptDecoderPath || MESHOPT_DECODER_PATH
  )
    .then(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).MeshoptDecoder.ready;
    })
    .then(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).MeshoptDecoder;
    });
  loader.setMeshoptDecoder(meshoptDecoder);

  loader.register((parser: GLTFParser) => {
    return new THREE_VRM.VRMLoaderPlugin(parser);
  });
  return loader;
}

/**
 * Load avatar file data.
 *
 * @param avatarData - Data from gltf or vrm files.
 * @param frustumCulled - {@link https://threejs.org/docs/?q=Mesh#api/en/core/Object3D.frustumCulled | Object3D.frustumCulled } applied recursively.
 *
 * @example
```ts
let resp = await fetch(url);
const avatarData = new Uint8Array(await resp.arrayBuffer());
const model = await loadAvatarModel(avatarData, renderer, false);
```
 */
export async function loadAvatarModel(
  avatarData: Uint8Array,
  renderer: THREE.WebGLRenderer,
  frustumCulled?: boolean,
  options?: DecordersOptions
): Promise<AvatarModel> {
  let model: THREE.Group | undefined;
  const gltfLoader = await createGLTFLoader(renderer, options);
  const gltf = await gltfLoader.parseAsync(
    avatarData.buffer,
    "about:blank" // Assume only avatars consisting of a single file.
  );
  const vrm: THREE_VRM.VRM = gltf.userData.vrm;
  if (vrm) {
    THREE_VRM.VRMUtils.removeUnnecessaryVertices(gltf.scene);
    THREE_VRM.VRMUtils.removeUnnecessaryJoints(gltf.scene);
    THREE_VRM.VRMUtils.rotateVRM0(vrm);

    model = vrm.scene;
  } else {
    model = gltf.scene || gltf.scenes[0];
  }
  model.animations = gltf.animations;

  if (!model) {
    throw new Error("invalid avatar data");
  }

  if (frustumCulled !== undefined) {
    // Keep body parts from disappearing when approaching the camera.
    model.traverse((obj) => {
      if (obj.frustumCulled !== undefined) {
        obj.frustumCulled = frustumCulled;
      }
    });
  }

  model.rotateY(180 * (Math.PI / 180));

  if (!avatarAnimationData) {
    throw new Error("preLoadAnimationData is required");
  }
  const animationData = avatarAnimationData;
  if (vrm) {
    model.animations = [
      ...model.animations,
      ...Object.entries(animationData).map(([k, v]) =>
        convertForVrm(v, vrm, k)
      ),
    ];
  } else {
    model.animations = [
      ...model.animations,
      ...Object.entries(animationData).map(([k, v]) =>
        convertForReadyPlayerMe(v, model as THREE.Object3D, k)
      ),
    ];
  }

  return {
    model,
    vrm,
  };
}

function fetchScript(src: string) {
  return new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    document.body.appendChild(script);
    script.onload = resolve;
    script.onerror = reject;
    script.async = true;
    script.src = src;
  });
}

/* function getFileType(data: Uint8Array): FileType | undefined {
  const hasPrefix = (v: Uint8Array, prefix: Uint8Array) => {
    const n = prefix.length;
    for (let i = 0; i < n; i++) {
      if (v[i] !== prefix[i]) {
        return false;
      }
    }
    return true;
  };
  {
    const prefix = new TextEncoder().encode("glTF");
    if (hasPrefix(data, prefix)) {
      return "gltf";
    }
  }
  {
    const prefix = new TextEncoder().encode("Kaydara FBX Binary");
    if (hasPrefix(data, prefix)) {
      return "fbx";
    }
  }
} */
