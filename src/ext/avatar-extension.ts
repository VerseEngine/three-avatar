import type { Avatar } from "../avatar";

/**
 * Interface to extend {@link Avatar}.
 */
export interface AvatarExtension {
  /**
   * initialization
   */
  setup(avatar: Avatar): void;
  /**
   * Processes called periodically
   */
  tick(deltaTime: number): void;
  /**
   * Releases all resources allocated by this instance.
   */
  dispose?(): void;
}
