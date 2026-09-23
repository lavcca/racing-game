import assert from 'node:assert/strict';
import test from 'node:test';

import { Loop } from '../src/core/Loop';

test('low frame rates preserve elapsed time while capping the physics step', () => {
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  let frame!: FrameRequestCallback;
  globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };
  globalThis.cancelAnimationFrame = () => {};
  const samples: number[][] = [];
  const loop = new Loop((delta, elapsed) => samples.push([delta, elapsed]));
  try {
    loop.start();
    frame(0); // A RAF timestamp preceding startup must never reverse time.
    assert.deepEqual(samples[0], [0, 0]);
    frame(1000);
    assert.deepEqual(samples[1], [.05, 1]);
  } finally {
    loop.stop();
    globalThis.requestAnimationFrame = previousRequest;
    globalThis.cancelAnimationFrame = previousCancel;
  }
});
