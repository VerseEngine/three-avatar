import { TouchController } from "@verseengine/three-touch-controller";
import { MoveController } from "@verseengine/three-move-controller";
import { DefaultXrControllerSet } from "@verseengine/three-xr-controller";

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function isVRSupported() {
  return !!navigator.xr;
}

export class PlayerController {
  constructor(
    moveTarget /* :THREE.Object3D */,
    headRotationTarget /* :THREE.Object3D */,
    handContainer /* :THREE.Object3D */,
    scene /* :THREE.Scene */,
    renderer /* :THREE.WebGLRenderer */,
    camera /* :THREE.Camera */,
    controllerOptions
  ) {
    this._enabled = true;
    this._isVR = false;
    this.touchController = new TouchController(moveTarget, {
      moveTo: controllerOptions?.moveTo,
    });
    this.moveController = new MoveController(
      moveTarget,
      moveTarget,
      headRotationTarget,
      {
        moveTo: controllerOptions?.moveTo,
        minVerticalRotation: 1.2,
        maxVerticalRotation: 2.2,
      }
    );
    this.xrController = new DefaultXrControllerSet(
      renderer,
      camera,
      scene,
      handContainer,
      moveTarget,
      moveTarget,
      controllerOptions
    );
    this.isVR = renderer.xr.isPresenting;
  }
  set isVR(v) {
    this._isVR = v;
    if (v) {
      this.touchController.enabled = false;
      this.moveController.enabled = false;
      if (this.xrController) {
        this.xrController.enabled = true;
      }
    } else {
      this.touchController.enabled = isTouchDevice();
      this.moveController.enabled = !this.touchController.enabled;
      if (this.xrController) {
        this.xrController.enabled = false;
      }
    }
  }
  get isVR() {
    return this._isVR;
  }
  set enabled(v) {
    this._enabled = v;
  }
  get enabled() {
    return this._enabled;
  }
  tick(deltaTime /* : number // THREE.Clock.getDelta() */) {
    if (!this._enabled) {
      return;
    }
    this.touchController.tick(deltaTime);
    this.moveController.tick(deltaTime);
    this.xrController.tick(deltaTime);
  }
}
