import * as THREE from "three";
import {
  createAvatarIK,
  isAnimationDataLoaded,
  preLoadAnimationData,
  createAvatar,
  registerSyncAvatarHeadAndCamera,
  setNonVRCameraMode,
  addMirrorHUD,
  Lipsync,
} from "three-avatar";
import { setupScene, createTransformControls } from "./setup";
import { PlayerController } from "./player-controller";

let _avatar;
let _avatarIK;
let _collisionObjects = [];
let _interactableObjects = [];
let _teleportTargetObjects = [];
let _isFPS = false;

export const main = (initialLoad /* :?()=>Promise<void>*/) => {
  let lipSync;
  const ctx = setupScene((dt) => {
    _avatar?.tick(dt);
    _avatarIK?.tick(dt);

    if (ctx?.renderer.xr?.enabled) {
      _avatar?.headSync(ctx?.camera.rotation);
    }
    if (lipSync) {
      _avatar?.lipSync(...lipSync.update());
    }
    playerController?.tick(dt);
  }, true);
  _teleportTargetObjects.push(ctx.ground);

  const { scene, cameraContainer, renderer, camera } = ctx;
  const playerObj = new THREE.Group();
  playerObj.name = "playerObj";
  playerObj.add(cameraContainer);
  scene.add(playerObj);

  const playerController = new PlayerController(
    playerObj,
    cameraContainer,
    cameraContainer,
    scene,
    renderer,
    camera,
    {
      getCollisionObjects: () => _collisionObjects,
      getInteractableObjects: () => _interactableObjects,
      getTeleportTargetObjects: () => _teleportTargetObjects,
    }
  );

  if (!initialLoad) {
    setupVR(ctx, playerController);
  } else {
    ctx.vrButton.style.visibility = "hidden";
    setTimeout(async () => {
      await initialLoad();
      ctx.vrButton.style.visibility = "visible";
      setupVR(ctx, playerController);
    });
  }
  const setTestIKEnabled = setupTestIK(ctx, playerObj, playerController);
  let mirrorHUD;
  let lastUrl;
  let lastAnimationMap;
  let isLowSpecMode = false;
  return {
    scene,
    collisionObjects: _collisionObjects,
    interactableObjects: _interactableObjects,
    teleportTargetObjects: _teleportTargetObjects,
    getAvatar: () => _avatar,
    setLowSpecMode: (enabled) => {
      enabled = !!enabled;
      if (enabled === isLowSpecMode) {
        return;
      }
      isLowSpecMode = enabled;
      if (lastUrl) {
        return changeAvatar(
          camera,
          lastUrl,
          lastAnimationMap,
          playerObj,
          renderer,
          isLowSpecMode
        );
      }
    },
    changeAvatar: (url, animationMap) => {
      lastUrl = url;
      lastAnimationMap = animationMap;
      return changeAvatar(
        camera,
        url,
        animationMap,
        playerObj,
        renderer,
        isLowSpecMode
      );
    },
    setLipsyncEnabled: async (enabled) => {
      if (enabled) {
        const ms = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        lipSync = new Lipsync(THREE.AudioContext.getContext(), ms);
      } else {
        lipSync = undefined;
      }
    },
    setTestIKEnabled,
    setFPSMode: (enabled) => {
      _isFPS = enabled;
      updateNonVrCameraMode(_isFPS, _avatar, ctx.camera);
    },
    showMirrorHUD: async (enabled) => {
      mirrorHUD?.removeFromParent();
      mirrorHUD?.dispose();
      if (enabled) {
        while (!_avatar) {
          await new Promise((resolve) => setTimeout(resolve));
        }
        mirrorHUD = addMirrorHUD(_avatar, playerObj, {
          xr: renderer.xr,
        });
      } else {
        mirrorHUD = undefined;
      }
    },
  };
};

const changeAvatar = async (
  camera,
  url,
  animationMap,
  playerObj,
  renderer,
  isLowSpecMode
) => {
  _avatar?.dispose();

  if (!isAnimationDataLoaded()) {
    await preLoadAnimationData(animationMap);
  }

  const collisionBoxes = [];
  [..._collisionObjects, ..._teleportTargetObjects].map((el) => {
    el.traverse((c) => {
      if (!c.isMesh) {
        return;
      }
      collisionBoxes.push(new THREE.Box3().setFromObject(c));
    });
  });

  let resp = await fetch(url);
  const avatarData = new Uint8Array(await resp.arrayBuffer());

  _avatar = await createAvatar(avatarData, renderer, false, playerObj, {
    getCollisionBoxes: () => collisionBoxes,
    isInvisibleFirstPerson: true,
    isLowSpecMode,
  });
  window._avatar = _avatar;
  _avatar.object3D.name = "myAvatar";
  playerObj.add(_avatar.object3D);

  if (renderer.xr.isPresenting) {
    const getCameras = () =>
      [camera, renderer.xr?.getCamera()].filter((v) => !!v);
    _avatar.setFirstPersonMode(getCameras());
  } else {
    updateNonVrCameraMode(_isFPS, _avatar, camera);
  }
};

const setupVR = ({ camera, renderer }, playerController) => {
  const getCameras = () =>
    [camera, renderer.xr?.getCamera()].filter((v) => !!v);

  registerSyncAvatarHeadAndCamera(
    renderer.xr,
    camera,
    camera,
    camera.parent,
    () => _avatar,
    {
      onVR: async () => {
        playerController.isVR = true;
        await _avatar.setIKMode(true);
        _avatar.setFirstPersonMode(getCameras());
        _avatarIK?.dispose();
        _avatarIK = createAvatarIK(
          _avatar,
          {
            left: () => playerController.xrController.handHolder.leftHand,
            right: () => playerController.xrController.handHolder.rightHand,
          },
          { isDebug: true }
        );
        window._debugAik = _avatarIK;
      },
      onNonVR: async () => {
        await _avatar.setIKMode(false);
        updateNonVrCameraMode(_isFPS, _avatar, camera);
        _avatarIK?.dispose();
        _avatarIK = undefined;

        playerController.isVR = false;
      },
    }
  );
};
const updateNonVrCameraMode = (isFPS, avatar, camera) => {
  setNonVRCameraMode(camera, camera.parent, avatar, isFPS);
};
const setupTestIK = (
  { renderer, camera, scene },
  playerObj,
  playerController
) => {
  const createTarget = (pos) => {
    const tc = createTransformControls(
      camera,
      renderer.domElement,
      (enabled) => {
        playerController.enabled = !enabled;
      }
    );
    scene.add(tc);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.01, 0.01),
      new THREE.MeshNormalMaterial()
    );
    mesh.position.set(...pos);
    playerObj.add(mesh);
    tc.attach(mesh);
    tc.visible = tc.enabled = mesh.visible = false;
    return { tc, mesh };
  };
  const targets = [
    createTarget([0.26, 0.7, -0.26]),
    createTarget([-0.26, 0.7, -0.26]),
  ];

  const f = async (enabled) => {
    targets.forEach((v) => {
      v.tc.visible = v.tc.enabled = v.mesh.visible = enabled;
    });
    await _avatar.setIKMode(enabled);
    _avatarIK?.dispose();
    if (enabled) {
      _avatarIK = createAvatarIK(
        _avatar,
        { right: () => targets[0].mesh, left: () => targets[1].mesh },
        { isDebug: true }
      );
    } else {
      _avatarIK = undefined;
    }
    window._debugAik = _avatarIK;
  };
  return f;
};
