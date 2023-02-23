import * as THREE from "three";
import type { IKTargetBones } from "./types";

import {
  CCDIKSolver,
  CCDIKHelper,
} from "three/examples/jsm/animation/CCDIKSolver.js";

const DEFAULT_INTERVAL_SEC = 1 / 60; // 60fps

type IKTargetBonesStrict = [THREE.Bone, THREE.Bone, THREE.Bone];
function isNotIncludeUndefined(
  bones: IKTargetBones
): bones is IKTargetBonesStrict {
  return !bones.includes(undefined);
}

class Tmps {
  vec: THREE.Vector3;
  vec1: THREE.Vector3;
  // vec2: THREE.Vector3;
  quat: THREE.Quaternion;
  quat1: THREE.Quaternion;
  mat: THREE.Matrix4;

  constructor() {
    this.vec = new THREE.Vector3();
    this.vec1 = new THREE.Vector3();
    // this.vec2 = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.quat1 = new THREE.Quaternion();
    this.mat = new THREE.Matrix4();
  }
}
let _tmps: Tmps;

type SkeletonMesh = THREE.Object3D & { skeleton?: THREE.Skeleton };
/**
 * Get XR controller objects.
 * Use to get the position of the IK hand.
 */
export type VRHandGetter = {
  left?: () => THREE.Object3D | undefined;
  right?: () => THREE.Object3D | undefined;
};

/**
 * x,y,z
 */
export type Vector3Tupple = [number, number, number];
/**
 * Limit the range of rotation of joint.
 */
export type RotationLimit = {
  rotationMin?: Vector3Tupple;
  rotationMax?: Vector3Tupple;
};
/**
 * Limit the range of rotation of joints.
 */
export type RotationLimitSet = {
  leftArm: [RotationLimit, RotationLimit];
  rightArm: [RotationLimit, RotationLimit];
};
/**
 * Offset of rotation angle between the XR controller and the avatar's wrist.
 */
export type WristRotationOffsetSet = {
  left: Vector3Tupple;
  right: Vector3Tupple;
};

/**
 * IK (Inverse Kinematics) to move the avatar's arms in sync with the XR controller's movements.
 * (Experimental Features)
 *
 * @example
 * {@link createAvatarIK}
 */
export class AvatarIK {
  private _solver?: CCDIKSolver;
  private _vrMappings: VRMapping[];
  private _helper?: CCDIKHelper;
  private _intervalSec = 0;
  private _sec = 0;

  /**i
   *
   * @param target - Avatar object. Can be an object unrelated to the {@link Avatar} class.
   * @param maybeRightArmBones - Bones moved by IK. If it contains undefined, it is disabled.
   * @param maybeLeftArmBones - Bones moved by IK. If it contains undefined, it is disabled.
   * @param rotationLimitSet - Limit the range of rotation of joints.
   * @param vrHandGetter - Get XR controller objects.
   * @param wristRotationOffsetSet - Offset of rotation angle between the XR controller and the avatar's wrist.
   * @param options - Processing frequency of tick(). Default is 1 / 60 (30fps).
   */
  constructor(
    target: THREE.Object3D,
    maybeRightArmBones: IKTargetBones,
    maybeLeftArmBones: IKTargetBones,
    rotationLimitSet: RotationLimitSet,
    vrHandGetter: VRHandGetter,
    wristRotationOffsetSet: WristRotationOffsetSet,
    options?: {
      isDebug?: boolean;
      intervalSec?: number;
    }
  ) {
    if (!_tmps) {
      _tmps = new Tmps();
    }
    this._intervalSec =
      options?.intervalSec || options?.intervalSec === 0
        ? options.intervalSec
        : DEFAULT_INTERVAL_SEC;

    const person = target as SkeletonMesh;

    const leftArmBones = isNotIncludeUndefined(maybeLeftArmBones)
      ? maybeLeftArmBones
      : undefined;
    const rightArmBones = isNotIncludeUndefined(maybeRightArmBones)
      ? maybeRightArmBones
      : undefined;

    if (!person.skeleton) {
      const bones = [...(leftArmBones || []), ...(rightArmBones || [])];
      person.skeleton = new THREE.Skeleton(bones);
    }

    const skeleton = person.skeleton;

    const iks = [];
    const vrMappings: VRMapping[] = [];
    if (leftArmBones) {
      const { ik, vrMapping } = createIKSettings(
        skeleton,
        person,
        "leftArmIK",
        leftArmBones,
        rotationLimitSet.leftArm,
        vrHandGetter.left,
        wristRotationOffsetSet.left
      );
      iks.push(ik);
      vrMappings.push(vrMapping);
    }
    if (rightArmBones) {
      const { ik, vrMapping } = createIKSettings(
        skeleton,
        person,
        "rightArmIK",
        rightArmBones,
        rotationLimitSet.rightArm,
        vrHandGetter.right,
        wristRotationOffsetSet.right
      );
      iks.push(ik);
      vrMappings.push(vrMapping);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._solver = new CCDIKSolver(person as any, iks as any);
    if (options?.isDebug) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._helper = new CCDIKHelper(person as any, iks as any, 0.01);
      let el = person;
      while (el.parent) {
        el = el.parent;
      }
      el.add(this._helper);
    }

    this._vrMappings = vrMappings;
  }
  /**
   * Processes called periodically
   *
   * @example
   * ```ts
   * const clock = new THREE.Clock();
   * renderer.setAnimationLoop(() => {
   *   const dt = clock.getDelta();
   *   avatarIK.tick(dt);
   * });
   * ```
   * or
   * ```ts
   * const clock = new THREE.Clock();
   * setInterval(() => {
   *   const dt = clock.getDelta();
   *   avatarIK.tick(dt);
   * }, anything);
   * ```
   */
  tick(
    deltaTime: number // THREE.Clock.getDelta()
  ) {
    this._sec += deltaTime;
    if (this._sec < this._intervalSec) {
      return;
    }
    this._sec = 0;

    if (this._solver) {
      for (let i = 0; i < this._vrMappings.length; i++) {
        const m = this._vrMappings[i];
        const vrHandPos = m.getVrHand()?.position;
        if (
          vrHandPos &&
          !(vrHandPos.x === 0 && vrHandPos.y === 0 && vrHandPos.z === 0)
        ) {
          m.mapVRAvatar();
        } else {
          m.reset();
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this._solver.updateOne((this._solver as any).iks[i]);
      }
    }
  }
  /**
   * Releases all resources allocated by this instance.
   */
  dispose() {
    delete this._solver;
    if (this._helper) {
      this._helper.removeFromParent();
      delete this._helper;
    }
  }
}

function findOrAddTargetBone(
  skeleton: THREE.Skeleton,
  person: THREE.Object3D,
  name: string,
  effectorBone: THREE.Bone
): THREE.Bone {
  const b = skeleton.bones.find((v) => v.name === name);
  if (b) {
    return b;
  }
  const targetBone = new THREE.Bone();
  targetBone.name = name;
  skeleton.bones.push(targetBone);
  skeleton.boneInverses.push(new THREE.Matrix4());

  skeleton.boneInverses[skeleton.boneInverses.length - 1]
    .copy(skeleton.bones[skeleton.bones.length - 1].matrixWorld)
    .invert();
  person.add(targetBone);
  person.updateMatrixWorld();
  const initPos = effectorBone.getWorldPosition(new THREE.Vector3());
  targetBone.position.copy(
    initPos.applyMatrix4(person.matrixWorld.clone().invert())
  );
  return targetBone;
}

const limitToVec = (ar: Vector3Tupple | undefined): THREE.Vector3 | undefined =>
  ar
    ? new THREE.Vector3().fromArray(ar.map(THREE.MathUtils.degToRad))
    : undefined;

function createIKSettings(
  skeleton: THREE.Skeleton,
  person: THREE.Object3D,
  name: string,
  bones: IKTargetBonesStrict,
  rotationLimits: [RotationLimit, RotationLimit],
  vrHandGetter: (() => THREE.Object3D | undefined) | undefined,
  rotationOffset: Vector3Tupple
) {
  const targetBone = findOrAddTargetBone(skeleton, person, name, bones[2]);
  const ik = {
    target: skeleton.bones.findIndex((v) => v === targetBone),
    effector: skeleton.bones.findIndex((v) => v === bones[2]),
    iteration: 2,
    minAngle: -0.2,
    maxAngle: 0.2,
    links: [
      {
        index: skeleton.bones.findIndex((v) => v === bones[1]),
        rotationMin: limitToVec(rotationLimits[1].rotationMin),
        rotationMax: limitToVec(rotationLimits[1].rotationMax),
      },
      {
        index: skeleton.bones.findIndex((v) => v === bones[0]),
        rotationMin: limitToVec(rotationLimits[0].rotationMin),
        rotationMax: limitToVec(rotationLimits[0].rotationMax),
      },
    ],
  };
  const vrMapping = new VRMapping(
    person,
    () => vrHandGetter?.(),
    targetBone,
    bones[2],
    bones[0],
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...rotationOffset.map((v) => THREE.MathUtils.degToRad(v)))
    )
  );
  return { ik, vrMapping };
}

class VRMapping {
  vrPerson: THREE.Object3D;
  getVrHand: () => THREE.Object3D | undefined;
  ikTarget: THREE.Object3D;
  ikTargetInitPos: THREE.Vector3;
  wristBone: THREE.Object3D;
  wristRotationOffset: THREE.Quaternion | undefined;
  wristBoneInitQuat: THREE.Quaternion;
  maxDistanceSquared: number;
  maxShoulderToControllderDistanceSquared = 0;
  shoulderBone: THREE.Object3D;

  constructor(
    vrPerson: THREE.Object3D,
    getVrHand: () => THREE.Object3D | undefined,
    ikTarget: THREE.Object3D,
    wristBone: THREE.Object3D,
    shoulderBone: THREE.Object3D,
    wristRotationOffset?: THREE.Quaternion
  ) {
    this.vrPerson = vrPerson;
    this.getVrHand = getVrHand;
    this.ikTarget = ikTarget;
    this.ikTargetInitPos = new THREE.Vector3().copy(ikTarget.position);
    this.wristBone = wristBone;
    this.wristRotationOffset = wristRotationOffset;
    this.wristBoneInitQuat = new THREE.Quaternion().copy(wristBone.quaternion);
    this.shoulderBone = shoulderBone;
    this.maxDistanceSquared = shoulderBone
      .getWorldPosition(_tmps.vec)
      .distanceToSquared(wristBone.getWorldPosition(_tmps.vec1));
  }

  mapVRAvatar() {
    const vrHand = this.getVrHand();
    if (!vrHand) {
      return;
    }

    {
      {
        const v = this.shoulderBone
          .getWorldPosition(_tmps.vec)
          .distanceToSquared(this.wristBone.getWorldPosition(_tmps.vec1));
        if (this.maxDistanceSquared < v) {
          this.maxDistanceSquared = v;
        }
      }
      const controllerPos = vrHand.getWorldPosition(_tmps.vec);
      const shoulderPos = this.shoulderBone.getWorldPosition(_tmps.vec1);
      const shoulderToControllderDistanceSquared =
        shoulderPos.distanceToSquared(controllerPos);
      if (
        this.maxShoulderToControllderDistanceSquared <
        shoulderToControllderDistanceSquared
      ) {
        this.maxShoulderToControllderDistanceSquared =
          shoulderToControllderDistanceSquared;
      }
      if (shoulderToControllderDistanceSquared > this.maxDistanceSquared) {
        const alpha = Math.sqrt(
          this.maxDistanceSquared / this.maxShoulderToControllderDistanceSquared
        );
        this.ikTarget.position.copy(
          shoulderPos.lerp(controllerPos, alpha).applyMatrix4(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            _tmps.mat.copy(this.ikTarget.parent!.matrixWorld).invert()
          )
        );
      } else {
        const controllerPos = vrHand.getWorldPosition(_tmps.vec);
        this.ikTarget.position.copy(
          controllerPos.applyMatrix4(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            _tmps.mat.copy(this.ikTarget.parent!.matrixWorld).invert()
          )
        );
      }
    }

    {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const parentWorldQuat = this.wristBone.parent!.getWorldQuaternion(
        _tmps.quat1
      );
      // https://github.com/mrdoob/three.js/issues/13704
      const vrHandQuat = vrHand
        .getWorldQuaternion(_tmps.quat)
        .premultiply(parentWorldQuat.invert());

      if (this.wristRotationOffset) {
        this.wristBone.quaternion.multiplyQuaternions(
          vrHandQuat,
          this.wristRotationOffset
        );
      } else {
        this.wristBone.quaternion.copy(vrHandQuat);
      }
    }
  }
  reset() {
    this.ikTarget.position.copy(this.ikTargetInitPos);
    this.wristBone.quaternion.copy(this.wristBoneInitQuat);
  }
}
