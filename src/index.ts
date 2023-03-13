/**
 * Avatar system
 * @packageDocumentation
 */
export {
  Avatar,
  AvatarOptions,
  AvatarType,
  AvatarTypeVrmV0,
  AvatarTypeVrmV1,
  AvatarTypeReadyPlayerMe,
} from "./avatar";
export {
  registerSyncAvatarHeadAndCamera,
  getRenderInfo,
  setNonVRCameraMode,
  addMirrorHUD,
  AddMirrorHUDOptions,
  isLowSpecDevice,
  isAndroid,
  isIOS,
  isTouchDevice,
} from "./util";
export type { AvatarModel, IKTargetBones } from "./types";
export {
  preLoadAnimationData,
  isAnimationDataLoaded,
  loadAvatarModel,
  AvatarAnimationDataSource,
  DecordersOptions,
} from "./loader";
export {
  AvatarIK,
  Vector3Tupple,
  RotationLimit,
  RotationLimitSet,
  WristRotationOffsetSet,
  VRHandGetter,
} from "./avatar-ik";
export {
  getDefaultRotationLimitSet,
  getDefaultWristRotationOffsetSet,
} from "./defaults";

export type { AvatarExtension } from "./ext/avatar-extension";
export { Blinker } from "./ext/blinker";
export { AutoWalker } from "./ext/auto-walker";
export { SimpleBoundingBoxCollider } from "./collider/simple-bounding-box-collider";

// @ts-ignore
export { Lipsync } from "./external/threelipsync-mod/threelipsync";

import type * as THREE from "three";
import { Avatar, AvatarOptions } from "./avatar";
import { loadAvatarModel, DecordersOptions } from "./loader";
import { Blinker } from "./ext/blinker";
import { AutoWalker } from "./ext/auto-walker";
import {
  AvatarIK,
  VRHandGetter,
  RotationLimitSet,
  WristRotationOffsetSet,
} from "./avatar-ik";
import {
  getDefaultRotationLimitSet,
  getDefaultWristRotationOffsetSet,
} from "./defaults";

export interface CreateAvatarOptions extends DecordersOptions, AvatarOptions {
  /**
   *  Not displayed with a first-person camera. ( But it will be shown in mirrors, etc.).
   */
  isInvisibleFirstPerson?: boolean;
  /**
   * Reduces resource consumption by omitting some processes.
   */
  isLowSpecMode?: boolean;
}

/**
 * Create {@link Avatar}
 *
 * @param avatarData - Data from gltf or vrm files.
 * @param frustumCulled - {@link https://threejs.org/docs/?q=Mesh#api/en/core/Object3D.frustumCulled | Object3D.frustumCulled } applied recursively.
 *
 * @example
```ts

let resp = await fetch(url);
const avatarData = new Uint8Array(await resp.arrayBuffer());
const avatar = createAvatar(avatarData, renderer, false, {
  isInvisibleFirstPerson: true,
  isLowSpecMode: maybeLowSpecDevice,
});
playerObj.add(avatar.object3D);

...

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  ...
  const dt = clock.getDelta();
  avatar.tick(dt);
});
```
 */
export async function createAvatar(
  avatarData: Uint8Array,
  renderer: THREE.WebGLRenderer,
  frustumCulled?: boolean,
  options?: CreateAvatarOptions
): Promise<Avatar> {
  const model = await loadAvatarModel(
    avatarData,
    renderer,
    frustumCulled,
    options
  );
  const res = new Avatar(model, options);
  if (options?.isInvisibleFirstPerson) {
    res.invisibleFirstPerson();
  }
  res.object3D.updateMatrixWorld();
  setDefaultExtensions(res);
  if (options?.isLowSpecMode) {
    if (res.vrm) {
      type unsafeVrm = {
        springBoneManager?: object;
      };
      delete (res.vrm as unsafeVrm).springBoneManager;
    }
  }
  return res;
}

/**
 * Set up default extensions for {@link Avatar}
 * @param moveTarget  - Objects to move. Specify the object that contains {@link Avatar.object3D}.
 */
export function setDefaultExtensions(avatar: Avatar): void {
  avatar.addExtension(new Blinker());
  avatar.addExtension(new AutoWalker());
}

export interface CreateAvatarIKOptions {
  /**
   * Limit the range of rotation of joints. Default is {@link getDefaultRotationLimitSet}.
   */
  rotationLimitSet: RotationLimitSet;
  /**
   * Offset of rotation angle between the XR controller and the avatar's wrist. Default is {@link getDefaultWristRotationOffsetSet}.
   */
  wristRotationOffsetSet: WristRotationOffsetSet;
  /**
   * Processing frequency of tick(). Default is 1 / 60 (30fps).
   */
  intervalSec?: number;
  isDebug?: boolean;
}

/**
 * Create {@link AvatarIK}.
 * (Experimental Features)
 *
 * @param handGetter -  Get XR controller objects.
 *
 * @example
 * ```ts

...

onVR: async () => {
  await avatar.setIKMode(true);
  avatarIK = createAvatarIK(
    avatar,
    {
      left: () => leftXRController,
      right: () => rightXRController,
    },
  );
},
onNonVR: async () => {
  await avatar.setIKMode(false);
  avatarIK?.dispose();
}

...


const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  ...
  const dt = clock.getDelta();
  avatar.tick(dt);
  avatarIK?.tick(dt);
});
 * ```
 */
export function createAvatarIK(
  avatar: Avatar,
  handGetter: VRHandGetter,
  option?: CreateAvatarIKOptions
) {
  return new AvatarIK(
    avatar.object3D,
    avatar.ikTargetRightArmBones,
    avatar.ikTargetLeftArmBones,
    option?.rotationLimitSet || getDefaultRotationLimitSet(avatar.type),
    handGetter,
    option?.wristRotationOffsetSet ||
      getDefaultWristRotationOffsetSet(avatar.type),
    {
      isDebug: option?.isDebug || false,
      intervalSec: option?.intervalSec,
    }
  );
}
