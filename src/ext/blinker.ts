import * as THREE from "three";
import type * as THREE_VRM from "@pixiv/three-vrm";
import type { Avatar } from "../avatar";
import type { AvatarExtension } from "./avatar-extension";

/**
 * Avatar extension to implement blink.
 */
export class Blinker implements AvatarExtension {
  private _faceMesh?: THREE.Mesh;
  private _vrm?: THREE_VRM.VRM;

  private _blinking = false;
  private _blinkProgress = 0;
  private _blinkTiming = 0;
  private _blinkSpeed = 20;
  private _blinkPrev = 0;

  /**
   * {@inheritDoc AvatarExtension.setup}
   */
  setup(avatar: Avatar) {
    this._faceMesh = avatar.faceMesh;
    this._vrm = avatar.vrm;
  }

  /**
   * {@inheritDoc AvatarExtension.tick}
   */
  tick(dt: number) {
    if (!this._blinking) {
      this._blinkTiming += dt;
      if (this._blinkTiming > 1) {
        this._blinkTiming = 0;
        if (Math.random() < 0.2) {
          this._blinking = true;
          this._blinkProgress = 0;
        }
      }
    } else {
      this._blinkProgress += dt * this._blinkSpeed;
      let i = Math.sin(this._blinkProgress);
      if (i < 0.1 && i < this._blinkPrev) {
        this._blinking = false;
        this._blinkTiming = -2;
        i = 0;
      }
      this._blinkPrev = i;
      if (this._vrm) {
        this._vrm.expressionManager?.setValue("blink", i);
      } else if (this._faceMesh) {
        const faceMesh = this._faceMesh;
        const idx = faceMesh.morphTargetDictionary?.eyesClosed;
        if (idx && faceMesh.morphTargetInfluences) {
          faceMesh.morphTargetInfluences[idx] = i;
        }
      }
    }
  }
}
