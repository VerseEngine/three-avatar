import {
  AvatarType,
  AvatarTypeVrmV0,
  AvatarTypeVrmV1,
  AvatarTypeReadyPlayerMe,
} from "./avatar";
import type { RotationLimitSet, WristRotationOffsetSet } from "./avatar-ik";
const RotationLimitSetVrmV1: RotationLimitSet = {
  leftArm: [
    {
      rotationMin: [0, -120, -80],
      rotationMax: [0, 5, 80],
    },
    {
      rotationMin: [0, -150, 0],
      rotationMax: [0, 0, 0],
    },
  ],
  rightArm: [
    {
      rotationMin: [0, -5, -80],
      rotationMax: [0, 120, 80],
    },
    {
      rotationMin: [0, 0, 0],
      rotationMax: [0, 150, 0],
    },
  ],
};
const RotationLimitSetVrmV0: RotationLimitSet = {
  leftArm: [
    {
      rotationMin: [0, -120, -80],
      rotationMax: [0, 5, 80],
    },
    {
      rotationMin: [0, -150, 0],
      rotationMax: [0, 0, 0],
    },
  ],
  rightArm: [
    {
      rotationMin: [0, -5, -80],
      rotationMax: [0, 120, 80],
    },
    {
      rotationMin: [0, 0, 0],
      rotationMax: [0, 150, 0],
    },
  ],
};
const RotationLimitSetRpm: RotationLimitSet = {
  leftArm: [
    {
      rotationMin: [-80, 0, -5],
      rotationMax: [80, 0, 120],
    },
    {
      rotationMin: [0, 0, 0],
      rotationMax: [0, 0, 150],
    },
  ],
  rightArm: [
    {
      rotationMin: [-80, 0, -120],
      rotationMax: [80, 0, 5],
    },
    {
      rotationMin: [0, 0, -150],
      rotationMax: [0, 0, 0],
    },
  ],
};

export const RotationLimitHeadSync = {
  x: { min: -0.6, max: 0.6 },
  y: { min: -0.6, max: 0.6 },
  z: { min: 0, max: 0 },
};

/**
 * Default value of {@link RotationLimitSet}.
 */
export function getDefaultRotationLimitSet(t: AvatarType): RotationLimitSet {
  switch (t) {
    case AvatarTypeVrmV0:
      return RotationLimitSetVrmV0;
    case AvatarTypeVrmV1:
      return RotationLimitSetVrmV1;
    case AvatarTypeReadyPlayerMe:
      return RotationLimitSetRpm;
  }
  throw new Error(`unknown avatar type: ${t}`);
}
const WristRotationOffsetSetVrmV0: WristRotationOffsetSet = {
  left: [110, 0, 70],
  right: [110, 0, -70],
};
const WristRotationOffsetSetVrmV1: WristRotationOffsetSet = {
  left: [-85, 28, 57],
  right: [-85, -28, -57],
};
const WristRotationOffsetSetRpm: WristRotationOffsetSet = {
  left: [-90, 90, 20],
  right: [-90, -90, 20],
};

/**
 * Default value of {@link WristRotationOffsetSet}.
 */
export function getDefaultWristRotationOffsetSet(
  t: AvatarType
): WristRotationOffsetSet {
  switch (t) {
    case AvatarTypeVrmV0:
      return WristRotationOffsetSetVrmV0;
    case AvatarTypeVrmV1:
      return WristRotationOffsetSetVrmV1;
    case AvatarTypeReadyPlayerMe:
      return WristRotationOffsetSetRpm;
  }
  throw new Error(`unknown avatar type: ${t}`);
}
