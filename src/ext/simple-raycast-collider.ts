import * as THREE from "three";
import type { Avatar } from "../avatar";
import type { AvatarExtension } from "./avatar-extension";

const DEFAULT_INTERVAL_SEC = 1 / 30; // 30fps

let _isFirst = true;

/**
 * Avatar extension to determine collision using {@link https://threejs.org/docs/#api/en/core/Raycaster | Raycaster}.
 */
export class SimpleRaycastCollider implements AvatarExtension {
  private _getObjects: () => THREE.Object3D[] | undefined;
  private _raycaster?: THREE.Raycaster;
  private _aroundDirections?: THREE.Vector3[];
  private _groundDirection?: THREE.Vector3;
  private _moveTarget: THREE.Object3D;
  private _origin?: THREE.Object3D;
  private _tmpVec0?: THREE.Vector3;
  private _tmpVec1?: THREE.Vector3;
  private _tmpResults: Array<THREE.Intersection<THREE.Object3D>> = [];
  private _height = 0;
  private _halfWidthX = 0;
  private _halfWidthZ = 0;
  private _lastX?: number;
  private _lastZ?: number;
  private _intervalSec = 0;
  private _sec = 0;
  private _isDebug = false;

  /**
   * @param moveTarget  - Objects to move.
   * @param getObjects - Get a list of collidable objects.
   * @param options - Processing frequency of tick(). Default is 1 / 30 (30fps).
   */
  constructor(
    moveTarget: THREE.Object3D,
    getObjects: () => THREE.Object3D[] | undefined,
    options?: {
      isDebug?: boolean;
      intervalSec?: number;
    }
  ) {
    this._moveTarget = moveTarget;
    this._getObjects = getObjects;
    this._isDebug = !!options?.isDebug;
    this._intervalSec =
      options?.intervalSec || options?.intervalSec === 0
        ? options.intervalSec
        : DEFAULT_INTERVAL_SEC;
  }
  /**
   * {@inheritDoc AvatarExtension.setup}
   */
  setup(avatar: Avatar) {
    this._origin = avatar.object3D;
    const raycaster = new THREE.Raycaster();
    this._raycaster = raycaster;
    this._tmpVec0 = new THREE.Vector3();
    this._tmpVec1 = new THREE.Vector3();
    this._groundDirection = new THREE.Vector3(0, -1, 0);
    this._aroundDirections = [
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
    ];
    this._height = avatar.height;
    this._halfWidthX = avatar.widthX / 2;
    this._halfWidthZ = avatar.widthZ / 2;
  }
  /**
   * {@inheritDoc AvatarExtension.tick}
   */
  tick(
    deltaTime: number // THREE.Clock.getDelta()
  ) {
    this._sec += deltaTime;
    if (this._sec < this._intervalSec) {
      return;
    }
    this._sec = 0;

    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const raycaster = this._raycaster!;
    const objects = this._getObjects();
    if (!objects || objects.length === 0) {
      return;
    }
    const orig = this._origin!;
    orig.updateMatrixWorld();
    const origPos = this._tmpVec0!;
    origPos.setFromMatrixPosition(orig.matrixWorld);

    const results = this._tmpResults;

    const targetPos = this._moveTarget.position;
    let origY = origPos.y;
    {
      raycaster.far = 1;
      const dir = this._groundDirection!;
      origPos.y = origY + 0.5;
      raycaster.set(origPos, dir);

      results.length = 0;
      raycaster.intersectObjects(objects, true, results);
      if (results.length !== 0) {
        const hit = results[0];
        origY = targetPos.y = hit.point.y;
      } else if (this._lastX !== undefined && this._lastZ !== undefined) {
        targetPos.x = this._lastX;
        targetPos.z = this._lastZ;
      }
    }
    const dir = this._tmpVec1!;
    const n = this._height;
    for (let y = Math.min(1, n - 0.1); y < n; y += 0.5) {
      origPos.y = origY + y;
      for (const v of this._aroundDirections!) {
        if (v.x !== 0) {
          raycaster.far = this._halfWidthX + 0.1;
        } else {
          raycaster.far = this._halfWidthZ + 0.3;
        }
        dir.copy(v).transformDirection(orig.matrixWorld).normalize();
        raycaster.set(origPos, dir);

        if (this._isDebug) {
          if (_isFirst) {
            this._moveTarget!.add(
              new THREE.ArrowHelper(
                raycaster.ray.direction,
                raycaster.ray.origin,
                raycaster.far,
                0xff0000
              )
            );
          }
        }

        results.length = 0;
        raycaster.intersectObjects(objects, true, results);
        if (results.length !== 0) {
          if (this._lastX !== undefined && this._lastZ !== undefined) {
            targetPos.x = this._lastX;
            targetPos.z = this._lastZ;
          }
          return;
        }
      }
    }
    this._lastX = targetPos.x;
    this._lastZ = targetPos.z;
    _isFirst = false;
    /* eslint-enable */
  }
}
