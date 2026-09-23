import { decorateCircuit } from './environment';
import type { GameMap } from './types';

export const cityCircuitMap: GameMap = {
  id: 'city-circuit',
  name: 'Neon City Circuit',
  description: 'A high-speed downtown loop lined with trees, street lamps, and sweeping bends.',
  trackConfig: {
    controlPoints: [
      {x:0,z:620}, {x:420,z:620}, {x:740,z:400}, {x:760,z:90},
      {x:530,z:-130}, {x:650,z:-450}, {x:360,z:-710}, {x:70,z:-630},
      {x:-80,z:-350}, {x:-300,z:-460}, {x:-590,z:-700}, {x:-820,z:-450},
      {x:-710,z:-90}, {x:-450,z:40}, {x:-600,z:310}, {x:-310,z:570}
    ],
    halfWidth: 9,
    checkpointCount: 24
  },
  decorateScene: (track, root) => decorateCircuit(track, root, false)
};
