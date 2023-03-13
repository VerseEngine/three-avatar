import * as THREE from "three";
import type { Avatar } from "../avatar";

class Tmps {
  vec: THREE.Vector3;
  vec1: THREE.Vector3;
  vec2: THREE.Vector3;
  box: THREE.Box3;
  box1: THREE.Box3;
  mat: THREE.Matrix4;
  hits: [THREE.Box3, number][];
  constructor() {
    this.vec = new THREE.Vector3();
    this.vec1 = new THREE.Vector3();
    this.vec2 = new THREE.Vector3();
    this.box = new THREE.Box3();
    this.box1 = new THREE.Box3();
    this.mat = new THREE.Matrix4();
    this.hits = [];
  }
}
let _tmps: Tmps;

/**
 * Avatar extension to determine collision using {@link https://threejs.org/docs/?q=Box3#api/en/math/Box3.setFromObject | BoundingBox}.
 */
export class SimpleBoundingBoxCollider {
  private _getBoxes: () => THREE.Box3[] | undefined;
  private _moveTarget: THREE.Object3D;
  private _isSetup = false;
  private _height = 0;
  private _halfWidthX = 0;
  private _halfWidthZ = 0;
  private _lastX?: number;
  private _lastZ?: number;

  /**
   * @param moveTarget  - Objects to move.
   * @param getBoxes - Get a list of bounding boxes of collisionable objects.
   * @param options - Processing frequency of tick(). Default is 1 / 30 (30fps).
   */
  constructor(
    moveTarget: THREE.Object3D,
    getBoxes: () => THREE.Box3[] | undefined
  ) {
    this._moveTarget = moveTarget;
    this._getBoxes = getBoxes;
  }
  setup(avatar: Avatar) {
    if (!_tmps) {
      _tmps = new Tmps();
    }
    this._isSetup = true;
    this._height = avatar.height;
    this._halfWidthX = avatar.widthX / 2;
    this._halfWidthZ = avatar.widthZ / 2;
  }
  moveTo(x: number, y: number, z: number) {
    if (!this._isSetup) {
      return;
    }
    const [targetBox, targetBoxUpDown] = this._getTargetBox(x, y, z);
    const targetPos = _tmps.vec2.set(x, y, z);

    {
      const hits = _tmps.hits;
      hits.length = 0;
      for (const box of this._getBoxes() || []) {
        if (targetBoxUpDown.intersectsBox(box)) {
          if (
            box.max.y >= targetBoxUpDown.min.y &&
            box.max.y <= targetBoxUpDown.max.y
          ) {
            hits.push([box, targetBoxUpDown.max.y - box.max.y]);
          } else if (
            targetBoxUpDown.max.y >= box.max.y &&
            targetBoxUpDown.min.y <= box.max.y
          ) {
            hits.push([box, box.max.y - targetBoxUpDown.min.y]);
          }
        }
      }
      if (hits.length !== 0) {
        hits.sort((a, b) => a[1] - b[1]);
        // console.log(hits.map((v) => `${v[0].max.y}(${v[1]})`).join(", "));
        if (hits[0][0].max.y !== targetBox.min.y) {
          const pos = this._moveTarget.getWorldPosition(_tmps.vec1);
          pos.y = hits[0][0].max.y;
          // console.log("move y", pos.y);
          targetPos.copy(
            pos.applyMatrix4(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              _tmps.mat.copy(this._moveTarget.parent!.matrixWorld).invert()
            )
          );
          targetBox.min.y = hits[0][0].max.y;
          targetBox.max.y = targetBox.min.y + this._height;
        }
      } else {
        return;
      }
    }
    for (const box of this._getBoxes() || []) {
      if (targetBox.intersectsBox(box)) {
        if (box.max.y === targetBox.min.y) {
          // ground
        } else {
          if (this._lastX !== undefined && this._lastZ !== undefined) {
            if (
              this._lastX > targetPos.x &&
              (box.max.x <= targetBox.min.x ||
                Math.abs(targetBox.min.x - box.max.x) <
                  Math.abs(targetBox.max.x - box.max.x))
            ) {
              return;
            } else if (
              this._lastX < targetPos.x &&
              (box.min.x >= targetBox.max.x ||
                Math.abs(targetBox.max.x - box.min.x) <
                  Math.abs(targetBox.min.x - box.min.x))
            ) {
              return;
            }

            if (
              this._lastZ > targetPos.z &&
              (box.max.z <= targetBox.min.z ||
                Math.abs(targetBox.min.z - box.max.z) <
                  Math.abs(targetBox.max.z - box.max.z))
            ) {
              return;
            } else if (
              this._lastZ < targetPos.z &&
              (box.min.z >= targetBox.max.z ||
                Math.abs(targetBox.max.z - box.min.z) <
                  Math.abs(targetBox.min.z - box.min.z))
            ) {
              return;
            }
          }
        }
      }
    }
    this._moveTarget.position.copy(targetPos);
    this._lastX = targetPos.x;
    this._lastZ = targetPos.z;
  }
  private _getTargetBox(
    x: number,
    y: number,
    z: number
  ): [THREE.Box3, THREE.Box3] {
    const targetBox = _tmps.box;
    targetBox.min.set(x - this._halfWidthX, y, z - this._halfWidthZ);
    targetBox.max.set(
      x + this._halfWidthX,
      y + this._height,
      z + this._halfWidthZ
    );
    const targetBoxUpDown = _tmps.box1.copy(targetBox);
    targetBoxUpDown.min.y = y - 0.5;
    targetBoxUpDown.max.y = y + 0.5;

    return [targetBox, targetBoxUpDown];
  }
}
