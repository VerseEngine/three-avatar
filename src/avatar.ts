import * as THREE from "three";
import * as THREE_VRM from "@pixiv/three-vrm";
import type { AvatarExtension } from "./ext/avatar-extension";
import { RotationLimitHeadSync } from "./defaults";
import { AvatarModel, IKTargetBones } from "./types";

// https://docs.readyplayer.me/ready-player-me/avatars/avatar-creator/vr-avatar#meshes
const RPM_FACE_PARTS = [
  "EyeLeft",
  "EyeRight",
  "Wolf3D_Glasses",
  "Wolf3D_Hair",
  "Wolf3D_Head",
  "Wolf3D_Beard",
  "Wolf3D_Headwear",
  "Wolf3D_Teeth",
];

function isArrayCamera(camera: THREE.Camera): camera is THREE.ArrayCamera {
  return (camera as THREE.ArrayCamera).cameras instanceof Array;
}

/**
 * Avatar Data Types
 */
export type AvatarType = "VrmV0" | "VrmV1" | "ReadyPlayerMe";
/**
 * {@link https://vrm.dev/en/ | VRM} version less than 1 | Avatar Data Types
 */
export const AvatarTypeVrmV0: AvatarType = "VrmV0";
/**
 * {@link https://vrm.dev/en/ | VRM} version 1.x | Avatar Data Types
 */
export const AvatarTypeVrmV1: AvatarType = "VrmV1";
/**
 * {@link https://readyplayer.me/ | Ready Player Me} | Avatar Data Types
 */
export const AvatarTypeReadyPlayerMe: AvatarType = "ReadyPlayerMe";
const DEFAULT_VRM_INTERVAL_SEC = 1 / 30; // 30fps

class Tmps {
  tmpEuler: THREE.Euler;
  constructor() {
    this.tmpEuler = new THREE.Euler();
  }
}
let _tmps: Tmps;

export interface AvatarOptions {
  /**
   * Processing frequency of vrm.update(). Default is 1 / 30 (30fps).
   */
  vrmIntervalSec?: number;
  /**
   * {@link https://threejs.org/docs/#api/en/core/Layers | Layer number } to be displayed only for first-person camera. (Layer numbers that you do not want displayed on mirrors, etc.)
   */
  firstPersonOnlyLayer?: number;
  /**
   * {@link https://threejs.org/docs/#api/en/core/Layers | Layer number } to be displayed only for 3rd-person camera.
   */
  thirdPersonOnlyLayer?: number;
}

/**
 * Avatar
 *
 * @example
```ts
let resp = await fetch(url);
const avatarData = new Uint8Array(await resp.arrayBuffer());
const model = await loadAvatarModel(avatarData, renderer, false);
const avatar = new Avatar(model);
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
export class Avatar {
  private _object3D: THREE.Group;
  private _headBone: THREE.Bone;
  private _leftArmBones: IKTargetBones;
  private _rightArmBones: IKTargetBones;

  private _vrm?: THREE_VRM.VRM;
  private _faceMesh?: THREE.Mesh;
  private _mixer: THREE.AnimationMixer;
  private _activeAction?: THREE.AnimationAction;
  private _syncBonesBuffer?: number[];
  private _ikEnabled: boolean;
  private _extensions: AvatarExtension[] = [];
  private _height = 0;
  private _widthX = 0;
  private _widthZ = 0;
  private _headBoneOffset: THREE.Vector3;
  private _isInvisibleFirstPerson = false;
  private _faceExpressionNames: string[];
  private _firstPersonOnlyLayer: number;
  private _thirdPersonOnlyLayer: number;
  private _syncTargetBones: THREE.Bone[];

  private _vrmIntervalSec = 0;
  private _vrmSec = 0;

  /**
   * @param model - Avatar Model.
   * @param  vrm - VRM Data
   */
  constructor(model: AvatarModel, options?: AvatarOptions) {
    if (!_tmps) {
      _tmps = new Tmps();
    }
    this._vrmIntervalSec =
      options?.vrmIntervalSec || options?.vrmIntervalSec === 0
        ? options.vrmIntervalSec
        : DEFAULT_VRM_INTERVAL_SEC;

    this._firstPersonOnlyLayer =
      options?.firstPersonOnlyLayer ||
      THREE_VRM.VRMFirstPerson.DEFAULT_FIRSTPERSON_ONLY_LAYER;
    this._thirdPersonOnlyLayer =
      options?.thirdPersonOnlyLayer ||
      THREE_VRM.VRMFirstPerson.DEFAULT_THIRDPERSON_ONLY_LAYER;

    const object3D = model.model;
    const vrm = model.vrm;
    this._object3D = object3D;
    this._vrm = vrm;
    if (vrm) {
      this._headBone = vrm.humanoid.getNormalizedBoneNode(
        THREE_VRM.VRMHumanBoneName.Head
      ) as THREE.Bone;
      this._leftArmBones = [
        THREE_VRM.VRMHumanBoneName.LeftUpperArm,
        THREE_VRM.VRMHumanBoneName.LeftLowerArm,
        THREE_VRM.VRMHumanBoneName.LeftHand,
      ].map((v) => vrm.humanoid.getNormalizedBoneNode(v)) as IKTargetBones;
      this._rightArmBones = [
        THREE_VRM.VRMHumanBoneName.RightUpperArm,
        THREE_VRM.VRMHumanBoneName.RightLowerArm,
        THREE_VRM.VRMHumanBoneName.RightHand,
      ].map((v) => vrm.humanoid.getNormalizedBoneNode(v)) as IKTargetBones;

      if (vrm.expressionManager) {
        const em = vrm.expressionManager;
        this._faceExpressionNames = Object.keys(em.expressionMap).filter(
          (v) =>
            !em.blinkExpressionNames.find((vv) => vv === v) &&
            !em.lookAtExpressionNames.find((vv) => vv === v) &&
            !em.mouthExpressionNames.find((vv) => vv === v)
        );
      } else {
        this._faceExpressionNames = [];
      }
    } else {
      this._faceMesh = (object3D.getObjectByName("Wolf3D_Head") ||
        object3D.getObjectByName("Wolf3D_Avatar")) as THREE.Mesh;
      this._headBone = this._object3D.getObjectByName("Head") as THREE.Bone;
      this._leftArmBones = ["LeftArm", "LeftForeArm", "LeftHand"].map((v) =>
        this.object3D.getObjectByName(v)
      ) as IKTargetBones;
      this._rightArmBones = ["RightArm", "RightForeArm", "RightHand"].map((v) =>
        this.object3D.getObjectByName(v)
      ) as IKTargetBones;
      const mtd = this._faceMesh.morphTargetDictionary;
      if (mtd) {
        this._faceExpressionNames = Object.keys(mtd).filter(
          (v) => !v.startsWith("viseme_")
        );
      } else {
        this._faceExpressionNames = [];
      }
    }
    this._mixer = new THREE.AnimationMixer(this._object3D);
    this._ikEnabled = false;
    this._idle();

    {
      const box = new THREE.Box3().setFromObject(this.object3D);
      this._height = Math.abs(box.min.y) + Math.abs(box.max.y);
      this._widthZ = Math.abs(box.min.z) + Math.abs(box.max.z);
      const l = this._leftArmBones[1];
      const r = this._leftArmBones[1];
      this._widthX =
        Math.abs(l?.position?.x || 0) + Math.abs(r?.position?.x || 0);
    }
    //_headBoneOffset
    if (this._vrm?.lookAt) {
      this._headBoneOffset = this._vrm.lookAt.offsetFromHeadBone;
    } else {
      this._headBoneOffset = new THREE.Vector3(0, 0.06, 0);
    }
    this._syncTargetBones = [
      this.headBone,
      ...(this.ikTargetLeftArmBones.filter((v) => !!v) as THREE.Bone[]),
      ...(this.ikTargetRightArmBones.filter((v) => !!v) as THREE.Bone[]),
    ];
  }
  /**
   * Object3D of this avatar.
   *
   * @example
   * ```ts
   * player.add(avatar.object3D);
   * ```
   */
  get object3D() {
    return this._object3D;
  }
  /**
   * VRM  Data
   */
  get vrm() {
    return this._vrm;
  }
  /**
   * Mesh for changing facial expressions.
   *
   * @remarks
   * For VRM, use `avatar.vrm.expressionManager` instead of this mesh.
   *
   * see {@link https://pixiv.github.io/three-vrm/packages/three-vrm/docs/classes/VRMExpressionManager.html | VRMExpressionManager }
   */
  get faceMesh() {
    return this._faceMesh;
  }
  /**
   * Avatar Data Type
   */
  get type(): AvatarType {
    if (this._vrm) {
      if (this._vrm?.meta?.metaVersion !== "0") {
        return AvatarTypeVrmV1;
      }
      return AvatarTypeVrmV0;
    }
    return AvatarTypeReadyPlayerMe;
  }
  /**
   * {@inheritDoc AvatarOptions.firstPersonOnlyLayer}
   */
  get firstPersonOnlyLayer() {
    return this._firstPersonOnlyLayer;
  }
  /**
   * {@inheritDoc AvatarOptions.thirdPersonOnlyLayer}
   */
  get thirdPersonOnlyLayer() {
    return this._thirdPersonOnlyLayer;
  }
  /**
   * Add an extension.
   */
  addExtension(ext: AvatarExtension) {
    ext.setup(this);
    this._extensions.push(ext);
  }
  /**
   * Remove an extension.
   */
  removeExtension(ext: AvatarExtension) {
    this._extensions = this._extensions.filter((v) => v !== ext);
  }
  /**
   * Releases all resources allocated by this instance.
   */
  dispose() {
    this._mixer.stopAllAction();
    this._object3D.removeFromParent();
    if (this._vrm) {
      THREE_VRM.VRMUtils.deepDispose(this._vrm.scene);
      delete this._vrm;
    } else {
      THREE_VRM.VRMUtils.deepDispose(this._object3D);
    }
    for (const ext of this._extensions) {
      if (ext.dispose) {
        ext.dispose();
      }
    }
  }
  /**
   * Processes called periodically
   *
   * @example
   * ```ts
   * const clock = new THREE.Clock();
   * renderer.setAnimationLoop(() => {
   *   const dt = clock.getDelta();
   *   avatar.tick(dt);
   * });
   * ```
   * or
   * ```ts
   * const clock = new THREE.Clock();
   * setInterval(() => {
   *   const dt = clock.getDelta();
   *   avatar.tick(dt);
   * }, anything);
   * ```
   */
  tick(
    deltaTime: number // THREE.Clock.getDelta()
  ) {
    this._vrmSec += deltaTime;
    if (this._vrmSec >= this._vrmIntervalSec) {
      this._vrm?.update(this._vrmSec);
      this._vrmSec = 0;
    }

    for (const ext of this._extensions) {
      ext.tick(deltaTime);
    }
    if (this._activeAction) {
      this._mixer?.update(deltaTime);
    }
  }

  /**
  * Follow the avatar's head (neck) movements to the XR headset.
  *
  * @example
  * ```ts
renderer.setAnimationLoop(() => {
  ...
 if (renderer.xr?.enabled) {
   avatar.headSync(camera.rotation);
 }
});
  * ```
  */
  headSync(rotation: THREE.Euler) {
    const headEuler = _tmps.tmpEuler.set(
      rotation.x * -1,
      rotation.y,
      rotation.z * -1
    );
    headEuler.x = Math.min(
      RotationLimitHeadSync.x.max,
      Math.max(RotationLimitHeadSync.x.min, headEuler.x)
    );
    headEuler.y = Math.min(
      RotationLimitHeadSync.y.max,
      Math.max(RotationLimitHeadSync.y.min, headEuler.y)
    );
    headEuler.z = Math.min(
      RotationLimitHeadSync.z.max,
      Math.max(RotationLimitHeadSync.z.min, headEuler.z)
    );
    this.headBone.rotation.copy(this._eulerForAvatar(headEuler));
  }
  /**
   * Synchronize lip movements with the voice.
   *
   * @remarks
   * see {@link https://repositori.upf.edu/bitstream/handle/10230/28139/llorach_VSG16_web.pdf | Web-based live speech-driven lip-sync}
*
* summary
* ```
Our method generates
reliable speech animation based on live speech using three blend
shapes and no training, and it only needs manual adjustment of
three parameters for each speaker (sensitivity, smoothness and
vocal tract length). 
* ```
   *
   * @example
   * ```ts
import {
  createAvatar,
  addMirrorHUD,
  ...
  Lipsync,
} from "three-avatar";

...

const ms = await navigator.mediaDevices.getUserMedia({
  audio: true,
});
const lipSync = new Lipsync(THREE.AudioContext.getContext(), ms);

...

renderer.setAnimationLoop(() => {
  ...
  avatar.lipSync(...lipSync.update());
});
   * ```
   */
  lipSync(kiss: number, lipsClosed: number, jaw: number) {
    const vrm = this._vrm;
    if (vrm) {
      // https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/expressions.ja.md
      if (vrm.expressionManager) {
        vrm.expressionManager.setValue("ou", kiss);
        vrm.expressionManager.setValue("ih", lipsClosed);
        vrm.expressionManager.setValue("aa", jaw);
      }
    } else if (this._faceMesh) {
      const head = this._faceMesh;
      const idxKiss = head.morphTargetDictionary?.viseme_U;
      const idxLipsClosed = head.morphTargetDictionary?.mouthClose;
      const idxJawOpen = head.morphTargetDictionary?.jawOpen;
      if (head.morphTargetInfluences) {
        if (idxKiss) {
          head.morphTargetInfluences[idxKiss] = kiss;
        }
        if (idxLipsClosed) {
          head.morphTargetInfluences[idxLipsClosed] = lipsClosed;
        }
        if (idxJawOpen) {
          head.morphTargetInfluences[idxJawOpen] = jaw;
        }
      }
    }
  }
  /**
   * List of possible names for {@link Avatar.setFaceExpression}.
   */
  get faceExpressionNames(): string[] {
    return this._faceExpressionNames;
  }
  /**
   * Reset face expression to default.
   */
  resetFaceExpression() {
    if (this._vrm) {
      const em = this._vrm.expressionManager;
      if (!em) {
        return;
      }
      for (const n of this._faceExpressionNames) {
        em.setValue(n, 0);
      }
    } else {
      const mtd = this._faceMesh?.morphTargetDictionary;
      const mti = this._faceMesh?.morphTargetInfluences;
      if (!mtd || !mti) {
        return;
      }
      for (const n of this._faceExpressionNames) {
        const idx = mtd[n];
        if (idx === undefined) {
          continue;
        }
        mti[idx] = 0;
      }
    }
  }
  /**
   * Set face expression.
   * @param name - One of the values get by {@link Avatar.faceExpressionNames}.
   * @param value - 0.0 to 1.0
   */
  setFaceExpression(name: string, value = 1.0) {
    if (value < 0) {
      value = 0;
    } else if (1 < value) {
      value = 1;
    }
    if (this._vrm) {
      const em = this._vrm.expressionManager;
      if (!em) {
        return;
      }
      em.setValue(name, value);
    } else {
      const mtd = this._faceMesh?.morphTargetDictionary;
      const mti = this._faceMesh?.morphTargetInfluences;
      if (!mtd || !mti) {
        return;
      }
      const idx = mtd[name];
      if (idx === undefined) {
        return;
      }
      mti[idx] = value;
    }
  }
  /**
   * Play an animation clip.
   * idle animation is playing by default.
   *
   * Must be loaded beforehand by executing {@link preLoadAnimationData}.
   *
   * @param name - {@link AvatarAnimationDataSource}'s key.
   */
  playClip(name: string) {
    const withIK = this._ikEnabled;
    this._activeAction?.fadeOut(0.5);
    const hasPrev = !!this._activeAction;

    const clip = this._getClip(name, withIK);
    if (!clip) {
      return;
    }
    if (withIK) {
      this._setDefaultProperties(name);
    }
    this._activeAction = this._mixer.clipAction(clip);
    this._activeAction.enabled = true;
    if (hasPrev) {
      this._activeAction.fadeIn(0.5).play();
    } else {
      this._activeAction.play();
    }
  }
  /**
   * Stop an animation clip.
   */
  stopClip() {
    if (this._activeAction) {
      this._activeAction.enabled = false;
      this._mixer.stopAllAction();
      delete this._activeAction;
    }
  }
  private _setDefaultProperties(name: string) {
    const origClip = this._getClip(name, false);
    if (!origClip) {
      return;
    }
    const ar = this.syncTargetBones.map((v) => v.name + ".");
    const tracks = origClip.tracks.filter((v) =>
      ar.find((n) => v.name.startsWith(n))
    );
    for (const track of tracks) {
      const pb = THREE.PropertyBinding.create(
        this._mixer.getRoot(),
        track.name
      );
      pb.setValue(track.values, 0);
    }
  }
  /**
   * Get IK(Inverse Kinematics) mode or not.
   */
  get isIKMode() {
    return this._ikEnabled;
  }
  /**
   * Set to IK mode.
   *
   * @remarks
   * From the movement of the animation clip,
   * the Exclude IK target bones from the motion of an animation clip.
   */
  async setIKMode(v: boolean) {
    this._ikEnabled = v;
    await this._idle();
  }
  private async _idle() {
    if (this._ikEnabled) {
      this.stopClip();
      this.playClip("idle");
      await new Promise((resolve) => setTimeout(resolve));
    } else {
      this.playClip("idle");
    }
  }
  private _getClip(
    name: string,
    withIK?: boolean
  ): THREE.AnimationClip | undefined {
    if (!withIK) {
      return this._object3D.animations.find((v) => v.name === name);
    }
    const name1 = name + ".with-ik";
    let clip = this._object3D.animations.find((v) => v.name === name1);
    if (clip) {
      return clip;
    }
    clip = this._object3D.animations.find((v) => v.name === name);
    if (!clip) {
      return;
    }
    const ar = this.syncTargetBones.map((v) => v.name + ".");
    const tracks = clip.tracks.filter(
      (v) => !ar.find((n) => v.name.startsWith(n))
    );
    clip = new THREE.AnimationClip(name1, clip.duration, tracks);
    this._object3D.animations.push(clip);
    return clip;
  }
  /**
   * Hide avatar when in 1st person view.
   */
  invisibleFirstPerson() {
    this._isInvisibleFirstPerson = true;
    this._invisibleFirstPerson();
  }
  private _invisibleFirstPerson() {
    this.object3D.traverse((el: THREE.Object3D) => {
      el.layers.set(this._thirdPersonOnlyLayer);
    });
  }
  /**
   * Switching the camera display to a first-person view.
   */
  setFirstPersonMode(cameras: Array<THREE.Camera>) {
    // https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/firstPerson.ja.md
    this._setupFirstPerson();
    for (const camera of cameras) {
      camera.layers.enable(this._firstPersonOnlyLayer);
      camera.layers.disable(this._thirdPersonOnlyLayer);
      if (isArrayCamera(camera)) {
        for (const c of camera.cameras) {
          c.layers.enable(this._firstPersonOnlyLayer);
          c.layers.disable(this._thirdPersonOnlyLayer);
        }
      }
    }
  }
  /**
   * Switching the camera display to third-person view.
   */
  setThirdPersonMode(cameras: Array<THREE.Camera>) {
    this._setupFirstPerson();
    for (const camera of cameras) {
      camera.layers.disable(this._firstPersonOnlyLayer);
      camera.layers.enable(this._thirdPersonOnlyLayer);
      if (isArrayCamera(camera)) {
        for (const c of camera.cameras) {
          c.layers.disable(this._firstPersonOnlyLayer);
          c.layers.enable(this._thirdPersonOnlyLayer);
        }
      }
    }
  }
  private _setupFirstPerson() {
    if (!this._vrm) {
      for (const n of RPM_FACE_PARTS) {
        const o = this._object3D.getObjectByName(n);
        if (o) {
          o.layers.set(this._thirdPersonOnlyLayer);
          o.traverse((child) => child.layers.set(this._thirdPersonOnlyLayer));
        }
      }
    } else {
      // firstPerson設定がされていないVRMもある
      if (
        this._vrm.firstPerson?.meshAnnotations &&
        this._vrm.firstPerson.meshAnnotations.filter((v) => v.type === "both")
          .length === this._vrm.firstPerson.meshAnnotations.length
      ) {
        this._vrm.firstPerson.meshAnnotations.forEach((v) => (v.type = "auto"));
      }
      this._vrm.firstPerson?.setup({
        firstPersonOnlyLayer: this._firstPersonOnlyLayer,
        thirdPersonOnlyLayer: this._thirdPersonOnlyLayer,
      });
    }
    if (this._isInvisibleFirstPerson) {
      this._invisibleFirstPerson();
    }
  }
  /**
   * Head bone
   */
  get headBone(): THREE.Bone {
    return this._headBone;
  }
  /**
   * Height
   */
  get height(): number {
    return this._height;
  }
  /**
   * Width along z-axis
   */
  get widthZ(): number {
    return this._widthZ;
  }
  /**
   * Width along x-axis
   */
  get widthX(): number {
    return this._widthX;
  }
  /**
   * Head height.
   * Use to adjust the height of the XR camera.
   */
  getHeadHeight(): number {
    const head = this.headBone as THREE.Object3D;
    const root = this._object3D;

    let v: THREE.Object3D | null = head;
    let y = 0;
    while (v && v !== root) {
      y += v.position.y;
      v = v.parent;
    }
    return y;
  }
  /**
   * Position offset from the head bone.
   *
   * @example
   * ```ts
camera.position.copy(
  new THREE.Vector3(0, avatar.getHeadHeight(), 0).add(
    avatar.headBoneOffset
  )
);
   * ```
   */
  get headBoneOffset(): THREE.Vector3 {
    return this._headBoneOffset;
  }
  /**
   * IK target bones of left arm.
   */
  get ikTargetLeftArmBones(): IKTargetBones {
    return this._leftArmBones;
  }
  /**
   * IK target bones of right arm.
   */
  get ikTargetRightArmBones(): IKTargetBones {
    return this._rightArmBones;
  }
  /**
   * Bones to be synchronized.
   */
  get syncTargetBones(): THREE.Bone[] {
    return this._syncTargetBones;
  }
  /**
   * Get bones motion.
   * Use to synchronize to another location.
   *
   * @example
   * ```ts
import { encode, decode } from "@msgpack/msgpack";

...

function startSenderLoop() {
  setInterval(() => {
    const data = player.avatar.getSyncBonesData();
    send(encode(data));
  }, 100);
}

...

function onReceive(data) {
  person0.avatar.setSyncBonesData(decode(data));
}
   * ```
   */
  getSyncBonesData() {
    const bones = this.syncTargetBones;
    if (!this._syncBonesBuffer) {
      this._syncBonesBuffer = new Array(bones.length * 4);
    }
    let i = 0;
    for (const bone of bones) {
      bone.quaternion.toArray(this._syncBonesBuffer, i);
      i += 4;
    }
    return this._syncBonesBuffer;
  }
  /**
   * Set bones motion.
   * Synchronize data obtained with {@link Avatar.getSyncBonesData} at another location.
   */
  setSyncBonesData(syncBonesData: number[]) {
    const bones = this.syncTargetBones;
    let i = 0;
    for (const bone of bones) {
      bone.quaternion.fromArray(syncBonesData, i);
      i += 4;
    }
  }

  private _eulerForAvatar(e: THREE.Euler): THREE.Euler {
    if (!this._vrm) {
      return e;
    }
    if (this._vrm?.meta?.metaVersion !== "0") {
      return e;
    }
    e.x *= -1;
    e.z *= -1;
    return e;
  }
}
