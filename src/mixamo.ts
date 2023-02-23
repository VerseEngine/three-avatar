import * as THREE from "three";
import type * as THREE_VRM from "@pixiv/three-vrm";

export function convertForReadyPlayerMe(
  asset: THREE.Group,
  model: THREE.Object3D,
  name: string
) {
  const clip = THREE.AnimationClip.findByName(
    asset.animations,
    "mixamo.com"
  ).clone();

  const getHipsPositionScale = (asset: THREE.Object3D) => {
    // Adjust with reference to hips height.
    const vec3 = new THREE.Vector3();
    const motionHipsHeight =
      asset.getObjectByName("mixamorigHips")?.position?.y;
    if (motionHipsHeight === undefined) {
      throw new Error("mixamorigHips not found");
    }
    const hipsY = model.getObjectByName("Hips")?.getWorldPosition(vec3)?.y;
    if (hipsY === undefined) {
      throw new Error("hip not found");
    }
    const rootY = model.getWorldPosition(vec3).y;
    const hipsHeight = Math.abs(hipsY - rootY);
    return hipsHeight / motionHipsHeight;
  };
  const hipsPositionScale = getHipsPositionScale(asset);

  const tracks: THREE.KeyframeTrack[] = [];
  clip.tracks.forEach((track) => {
    const trackSplitted = track.name.split(".");
    const mixamoRigName = trackSplitted[0];
    const nodeName = mixamoRigName.replace("mixamorig", "");

    const propertyName = trackSplitted[1];
    if (track.ValueTypeName === "quaternion") {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${nodeName}.${propertyName}`,
          track.times as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          track.values as any // eslint-disable-line @typescript-eslint/no-explicit-any
        )
      );
    } else if (track.ValueTypeName === "vector") {
      const value = track.values.map((v, _i) => v * hipsPositionScale);
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${nodeName}.${propertyName}`,
          track.times as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          value as any // eslint-disable-line @typescript-eslint/no-explicit-any
        )
      );
    }
  });

  return new THREE.AnimationClip(name, clip.duration, tracks);
}

export function convertForVrm(
  asset: THREE.Group,
  vrm: THREE_VRM.VRM,
  name: string
) {
  // reference: https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm/examples/humanoidAnimation/loadMixamoAnimation.js
  const clip = THREE.AnimationClip.findByName(
    asset.animations,
    "mixamo.com"
  ).clone();

  const tracks: THREE.KeyframeTrack[] = []; // KeyframeTracks compatible with VRM will be added here

  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const _quatA = new THREE.Quaternion();
  const _vec3 = new THREE.Vector3();

  // Adjust with reference to hips height.
  const motionHipsHeight = asset.getObjectByName("mixamorigHips")?.position?.y;
  if (motionHipsHeight === undefined) {
    throw new Error("mixamorigHips not found");
  }
  const hipsY = vrm.humanoid
    .getNormalizedBoneNode("hips")
    ?.getWorldPosition(_vec3)?.y;
  if (hipsY === undefined) {
    throw new Error("hip not found");
  }
  const rootY = vrm.scene.getWorldPosition(_vec3).y;
  const hipsHeight = Math.abs(hipsY - rootY);
  const hipsPositionScale = hipsHeight / motionHipsHeight;

  clip.tracks.forEach((track) => {
    // Convert each tracks for VRM use, and push to `tracks`
    const trackSplitted = track.name.split(".");
    const mixamoRigName = trackSplitted[0];
    const boneName = mixamoVRMRigMap[mixamoRigName];
    const nodeName = vrm.humanoid?.getNormalizedBoneNode(boneName)?.name;
    const mixamoRigNode = asset.getObjectByName(mixamoRigName);

    if (nodeName && mixamoRigNode) {
      const propertyName = trackSplitted[1];

      // Store rotations of rest-pose.
      mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
      if (!mixamoRigNode.parent) {
        throw new Error("mixamoRigNode.parent is null");
      }
      mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);

      if (track.ValueTypeName === "quaternion") {
        // Retarget rotation of mixamoRig to NormalizedBone.
        for (let i = 0; i < track.values.length; i += 4) {
          const flatQuaternion = track.values.slice(i, i + 4);

          _quatA.fromArray(flatQuaternion);

          // 親のレスト時ワールド回転 * トラックの回転 * レスト時ワールド回転の逆
          _quatA
            .premultiply(parentRestWorldRotation)
            .multiply(restRotationInverse);

          _quatA.toArray(flatQuaternion);

          flatQuaternion.forEach((v, index) => {
            track.values[index + i] = v;
          });
        }

        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${nodeName}.${propertyName}`,
            track.times as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            track.values.map((v, i) =>
              vrm.meta?.metaVersion === "0" && i % 2 === 0 ? -v : v
            ) as any // eslint-disable-line @typescript-eslint/no-explicit-any
          )
        );
      } else if (track.ValueTypeName === "vector") {
        const value = track.values.map(
          (v, i) =>
            (vrm.meta?.metaVersion === "0" && i % 3 !== 1 ? -v : v) *
            hipsPositionScale
        );
        tracks.push(
          new THREE.VectorKeyframeTrack(
            `${nodeName}.${propertyName}`,
            track.times as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            value as any // eslint-disable-line @typescript-eslint/no-explicit-any
          )
        );
      }
    }
  });

  return new THREE.AnimationClip(name, clip.duration, tracks);
}

/**
 * A map from Mixamo rig name to VRM Humanoid bone name
 */
const mixamoVRMRigMap: { [key: string]: THREE_VRM.VRMHumanBoneName } = {
  mixamorigHips: "hips",
  mixamorigSpine: "spine",
  mixamorigSpine1: "chest",
  mixamorigSpine2: "upperChest",
  mixamorigNeck: "neck",
  mixamorigHead: "head",
  mixamorigLeftShoulder: "leftShoulder",
  mixamorigLeftArm: "leftUpperArm",
  mixamorigLeftForeArm: "leftLowerArm",
  mixamorigLeftHand: "leftHand",
  mixamorigLeftHandThumb1: "leftThumbMetacarpal",
  mixamorigLeftHandThumb2: "leftThumbProximal",
  mixamorigLeftHandThumb3: "leftThumbDistal",
  mixamorigLeftHandIndex1: "leftIndexProximal",
  mixamorigLeftHandIndex2: "leftIndexIntermediate",
  mixamorigLeftHandIndex3: "leftIndexDistal",
  mixamorigLeftHandMiddle1: "leftMiddleProximal",
  mixamorigLeftHandMiddle2: "leftMiddleIntermediate",
  mixamorigLeftHandMiddle3: "leftMiddleDistal",
  mixamorigLeftHandRing1: "leftRingProximal",
  mixamorigLeftHandRing2: "leftRingIntermediate",
  mixamorigLeftHandRing3: "leftRingDistal",
  mixamorigLeftHandPinky1: "leftLittleProximal",
  mixamorigLeftHandPinky2: "leftLittleIntermediate",
  mixamorigLeftHandPinky3: "leftLittleDistal",
  mixamorigRightShoulder: "rightShoulder",
  mixamorigRightArm: "rightUpperArm",
  mixamorigRightForeArm: "rightLowerArm",
  mixamorigRightHand: "rightHand",
  mixamorigRightHandPinky1: "rightLittleProximal",
  mixamorigRightHandPinky2: "rightLittleIntermediate",
  mixamorigRightHandPinky3: "rightLittleDistal",
  mixamorigRightHandRing1: "rightRingProximal",
  mixamorigRightHandRing2: "rightRingIntermediate",
  mixamorigRightHandRing3: "rightRingDistal",
  mixamorigRightHandMiddle1: "rightMiddleProximal",
  mixamorigRightHandMiddle2: "rightMiddleIntermediate",
  mixamorigRightHandMiddle3: "rightMiddleDistal",
  mixamorigRightHandIndex1: "rightIndexProximal",
  mixamorigRightHandIndex2: "rightIndexIntermediate",
  mixamorigRightHandIndex3: "rightIndexDistal",
  mixamorigRightHandThumb1: "rightThumbMetacarpal",
  mixamorigRightHandThumb2: "rightThumbProximal",
  mixamorigRightHandThumb3: "rightThumbDistal",
  mixamorigLeftUpLeg: "leftUpperLeg",
  mixamorigLeftLeg: "leftLowerLeg",
  mixamorigLeftFoot: "leftFoot",
  mixamorigLeftToeBase: "leftToes",
  mixamorigRightUpLeg: "rightUpperLeg",
  mixamorigRightLeg: "rightLowerLeg",
  mixamorigRightFoot: "rightFoot",
  mixamorigRightToeBase: "rightToes",
};
