import { cityCircuitMap } from './cityCircuit';
import { desertSprintMap } from './desertSprint';
import { GameMap } from './types';

export const availableMaps: GameMap[] = [cityCircuitMap, desertSprintMap];

/** Add a contributor map before the selection screen is created. */
export function registerMap(map: GameMap) {
  if (availableMaps.some((candidate) => candidate.id === map.id)) {
    throw new Error(`A map with id "${map.id}" is already registered.`);
  }
  availableMaps.push(map);
}
