import * as THREE from "three";
import * as THREE_VRM from "@pixiv/three-vrm";
/**
 * Avatar model.
 */
export interface AvatarModel {
  model: THREE.Group;
  vrm?: THREE_VRM.VRM;
}

/**
 * Shoulder, Elbow, Wrist
 */
export type IKTargetBones = [
  THREE.Bone | undefined,
  THREE.Bone | undefined,
  THREE.Bone | undefined
];
