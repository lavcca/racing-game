import assert from 'node:assert/strict';
import test from 'node:test';

import { RaceManager } from '../src/game/RaceManager';
import { Track } from '../src/game/Track';
import { Vehicle } from '../src/game/Vehicle';

function fixture() {
  const track = new Track({checkpointCount: 12});
  const vehicle = new Vehicle();
  vehicle.mesh.position.copy(track.getStartPosition());
  const race = new RaceManager(track, 3);
  race.registerRacer({id:'player', name:'Test', type:'player', vehicle});
  const update = (n: number, onTrack = true) => race.updateRacerProgress('player', {
    normalized: n % 1, distance: (n % 1) * track.getTotalLength(),
    checkpointIndex: Math.floor((n % 1) * 12), onTrack
  });
  return {race, update};
}

test('three complete forward laps finish with exactly 36 checkpoints', () => {
  const {race, update} = fixture();
  for (let step = 1; step <= 360; step++) update(step / 120);
  const status = race.getRacerStatus('player')!;
  assert.equal(status.finished, true);
  assert.equal(status.checkpointsCleared, 36);
  assert.equal(status.score, 36 * 150 + 3 * 500);
  assert.equal(status.progressPercent, 100);
  assert.equal(update(.1).scoreEarned, 0);
});

test('reverse start-line crossing and checkpoint oscillation do not farm points', () => {
  const {race, update} = fixture();
  update(.99); update(0);
  assert.equal(race.getRacerStatus('player')!.score, 0);
  for (let step = 1; step <= 10; step++) update(step / 120);
  assert.equal(race.getRacerStatus('player')!.score, 150);
  for (let i=0;i<10;i++) { update(.08); update(.09); }
  assert.equal(race.getRacerStatus('player')!.score, 150);
  assert.equal(race.getRacerStatus('player')!.lap, 1);
});

test('off-road and skipped checkpoints cannot award a lap', () => {
  const {race, update} = fixture();
  for (let step=1;step<=120;step++) update(step/120, false);
  assert.equal(race.getRacerStatus('player')!.score, 0);
  assert.equal(race.getRacerStatus('player')!.lap, 1);
  update(.5); update(.99); update(0);
  assert.equal(race.getRacerStatus('player')!.finished, false);
  assert.equal(race.getRacerStatus('player')!.score, 0);
});


test('a grid slot behind the start line is not credited with almost a lap', () => {
  const {race, update} = fixture();
  update(.996);
  assert.equal(race.getRacerStatus('player')!.progressPercent, 0);
  assert.equal(race.getRacerStatus('player')!.totalDistance, 0);
});
