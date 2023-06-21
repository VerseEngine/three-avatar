# three-avatar
 
Avatar system for three.js.

## Features
* Loads [VRM](https://vrm.dev/)/[VRoid](https://vroid.com/), [Ready Player Me](https://readyplayer.me/)
* Play [mixamo](https://www.mixamo.com/) animation
* Head sync for VR
* Replaceable collision detection
* Replaceable lip sync
* Replaceable IK (Inverse Kinematics)
* Show hand mirror

 ![preview](https://user-images.githubusercontent.com/20784450/211959656-70b52dad-d58e-4b10-86ac-8c38a4de1948.gif)

## Example
```bash
npm run example
```

## Installation
### npm
```bash
npm install @verseengine/three-move-controller @verseengine/three-touch-controller @verseengine/three-xr-controller @verseengine/three-avatar
```

### CDN (ES Mobules)
```html
<script
      async
      src="https://cdn.jsdelivr.net/npm/es-module-shims@1.6.2/dist/es-module-shims.min.js"
    ></script>
<script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.137.0/build/three.module.js",
      "three-avatar": "https://cdn.jsdelivr.net/npm/@verseengine/three-avatar@1.0.0/dist/esm/index.js",
      "@verseengine/three-touch-controller": "https://cdn.jsdelivr.net/npm/@verseengine/three-touch-controller@1.0.0/dist/esm/index.js",
      "@verseengine/three-move-controller": "https://cdn.jsdelivr.net/npm/@verseengine/three-move-controller@1.0.0/dist/esm/index.js",
      "@verseengine/three-xr-controller": "https://cdn.jsdelivr.net/npm/@verseengine/three-xr-controller@1.0.0/dist/esm/index.js"
    }
  }
</script>
```


## Usage
```javascript
import * as THREE from "three";
import * as THREE_VRM from "@pixiv/three-vrm";
import {
  createAvatarIK,
  isAnimationDataLoaded,
  preLoadAnimationData,
  createAvatar,
  Lipsync,
} from "three-avatar";

// Animation fbx files downloaded from mixamo.com
const ANIMATION_MAP = {
  idle: "path/to/idle.fbx",
  walk: "path/to/walk.fbx",
  dance: "path/to/dance.fbx",
};

async function loadAvatar(avatarURL) {
  ...
  if (!isAnimationDataLoaded()) {
    await preLoadAnimationData(ANIMATION_MAP);
  }

  const collisionObjects:THREE.Object3D[] = [wall0, wall1, ...];
  const teleportTargetObjects:THREE.Object3D[] = [ground0, ...];
  const collisionBoxes = [];
  [...collisionObjects, ...teleportTargetObjects].map((el) => {
    el.traverse((c) => {
      if (!c.isMesh) {
        return;
      }
      collisionBoxes.push(new THREE.Box3().setFromObject(c));
    });
  });

  let resp = await fetch(avatarURL);
  const avatarData = new Uint8Array(await resp.arrayBuffer());
  const avatar = await createAvatar(
    avatarData,
    renderer,
    false,
    avatarContainer,
    {
      getCollisionBoxes: () => collisionBoxes,
      isInvisibleFirstPerson: true,
    }
  );
  avatarContainer.add(avatar.object3D);

  const touchController = new TouchController(avatarContainer);
}

const clock = new THREE.Clock();
function animate() {
  _avatar?.tick(clock.getDelta());
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
```

# Reference

## API Reference
[Link](docs/three-avatar.md)
