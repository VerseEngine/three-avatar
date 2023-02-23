import * as THREE from "three";
import type { Avatar } from "../avatar";
import type { AvatarExtension } from "./avatar-extension";

/**
 * Avatar extension for automatic walking animation when moving.
 */
export class AutoWalker implements AvatarExtension {
  private _isWalking = false;
  private _walkCheckTimer = 0;
  private _avatar?: WeakRef<Avatar>;
  private _object3D?: THREE.Object3D;
  private _lastPosition?: THREE.Vector3;
  private _tmpVec?: THREE.Vector3;

  /**
   * {@inheritDoc AvatarExtension.setup}
   */
  setup(avatar: Avatar) {
    this._avatar = new WeakRef(avatar);
    this._object3D = avatar.object3D;
    this._tmpVec = new THREE.Vector3();
  }
  /**
   * {@inheritDoc AvatarExtension.tick}
   */
  tick(dt: number) {
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const object3D = this._object3D;
    if (!object3D?.visible) {
      return;
    }

    const newPos = object3D.getWorldPosition(this._tmpVec!);
    if (!this._lastPosition) {
      this._lastPosition = new THREE.Vector3().copy(newPos);
    } else if (
      Math.abs(this._lastPosition.x - newPos.x) > 0.05 ||
      Math.abs(this._lastPosition.z - newPos.z) > 0.05
    ) {
      this._lastPosition.copy(newPos);
      if (!this._isWalking) {
        this._isWalking = true;
        this._avatar?.deref()?.playClip("walk");
      }
      this._walkCheckTimer = 0;
    } else {
      if (this._isWalking) {
        this._walkCheckTimer += dt;
        if (this._walkCheckTimer > 0.3) {
          this._isWalking = false;
          this._avatar?.deref()?.playClip("idle");
        }
      }
    }
    /* eslint-enable */
  }
}
