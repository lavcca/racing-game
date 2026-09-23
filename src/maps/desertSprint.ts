import { decorateCircuit } from './environment';
import type { GameMap } from './types';

const DESERT_POINTS = [
  {x:0,z:680}, {x:450,z:730}, {x:840,z:480}, {x:930,z:100},
  {x:650,z:-100}, {x:790,z:-450}, {x:430,z:-730}, {x:80,z:-850},
  {x:-290,z:-640}, {x:-570,z:-730}, {x:-880,z:-380}, {x:-690,z:0},
  {x:-820,z:330}, {x:-410,z:570}
];

export const desertSprintMap: GameMap = {
  id: 'desert-sprint',
  name: 'Dune Sprint',
  description: 'An arid high-speed sprint through desert rock formations and scattered cacti.',
  trackConfig: {
    controlPoints: DESERT_POINTS,
    halfWidth: 10,
    groundColor: 0xb89566,
    checkpointCount: 24,
    smoothing: 0.5
  },
  decorateScene: (track, root) => decorateCircuit(track, root, true)
};
