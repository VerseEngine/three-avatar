import { createBridge } from "./setup";
import * as THREE from "three";

export function createWorldObjects({
  scene,
  collisionObjects,
  _interactableObjects,
  teleportTargetObjects,
}) {
  {
    const o = createBridge();
    o.rotateY(180 * (Math.PI / 180));
    o.position.set(1, 0.1, -1.5);
    scene.add(o);
    teleportTargetObjects.push(o);
  }
  {
    const o = createBridge();
    o.rotateY(135 * (Math.PI / 180));
    o.position.set(2, 0.1, -1);
    scene.add(o);
    teleportTargetObjects.push(o);
  }
  const wallMaterial = new THREE.MeshLambertMaterial({
    color: 0x5e5e5e,
    side: THREE.DoubleSide,
  });
  {
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 3, 1, 1),
      wallMaterial
    );
    wall.position.set(-2, 0.5, 0);
    wall.rotation.y = Math.PI / 2;
    scene.add(wall);
    collisionObjects.push(wall);
  }
  {
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 3, 1, 1),
      wallMaterial
    );
    wall.position.set(-0.5, 0.5, -3);
    scene.add(wall);
    collisionObjects.push(wall);
  }
}
