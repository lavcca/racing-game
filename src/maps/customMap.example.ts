import { Vector3 } from 'three';

import { decorateCircuit } from './environment';
import { GameMap } from './types';

/**
 * Copy this module, change the id/config, and call registerMap() from
 * src/maps/index.ts to add a contributor-owned circuit to the start menu.
 */
export const contributorMap: GameMap = {
  id: 'contributor-circuit',
  name: 'Contributor Circuit',
  description: 'A custom circuit authored by a community contributor.',
  trackConfig: {
    controlPoints: [
      new Vector3(0, 0, 560), new Vector3(500, 0, 360),
      new Vector3(420, 0, -420), new Vector3(-160, 0, -600),
      new Vector3(-520, 0, -160), new Vector3(-360, 0, 420)
    ],
    halfWidth: 9,
    checkpointCount: 18,
    smoothing: 0.45
  },
  decorateScene: (track, root) => decorateCircuit(track, root, false)
};
