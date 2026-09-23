import assert from 'node:assert/strict';
import test from 'node:test';

import { Quaternion, Vector3 } from 'three';

import { Track } from '../src/game/Track';
import { Vehicle } from '../src/game/Vehicle';
import { availableMaps } from '../src/maps';

const throttle = {forward:true,backward:false,left:false,right:false};
const neutral = {forward:false,backward:false,left:false,right:false};
const reverse = {...neutral, backward:true};
function simulate(vehicle: Vehicle, seconds: number, onTrack: boolean, fps = 60) {
  for(let frame=0; frame<seconds*fps; frame++) vehicle.update(1/fps,onTrack);
}

test('leaving the road rapidly slows a car even with full throttle', () => {
  const car = new Vehicle();car.setVelocity(55);car.setInput(throttle);
  simulate(car,1,false);
  assert.ok(car.getSpeedKph()<21, `Off-road speed: ${car.getSpeedKph()}`);
  simulate(car,5,false);assert.ok(car.getSpeedKph()<20);
  simulate(car,2,true);assert.ok(car.getSpeedKph()>150, 'Normal acceleration should return on asphalt');
});

test('off-road reverse is limited and releasing throttle stops the vehicle', () => {
  const car = new Vehicle();car.setVelocity(-14);car.setInput(reverse);
  simulate(car,1,false);assert.ok(Math.abs(car.getSignedSpeed())*3.6<11);
  car.setInput(neutral);simulate(car,2,false);assert.equal(car.getSignedSpeed(),0);
});

test('steering eases in and out instead of rotating instantly', () => {
  const car = new Vehicle();
  car.setVelocity(40);
  car.setInput({...throttle, left:true});
  const before = car.mesh.rotation.y;
  car.update(1 / 60, true);
  const firstFrameTurn = Math.abs(car.mesh.rotation.y - before);
  car.update(1 / 60, true);
  const secondFrameTurn = Math.abs(car.mesh.rotation.y - car.mesh.rotation.y + firstFrameTurn);
  assert.ok(firstFrameTurn < 0.02, `First-frame turn was too sharp: ${firstFrameTurn}`);
  assert.ok(secondFrameTurn >= 0);
  car.setInput(throttle);
  const held = car.mesh.rotation.y;
  car.update(1 / 60, true);
  assert.ok(Math.abs(car.mesh.rotation.y - held) > 0, 'Loaded steering should unwind over time');
});

test('off-road slowdown is consistent across different frame rates', () => {
  const values = [30,60,144].map(fps=>{
    const car = new Vehicle();car.setVelocity(55);car.setInput(throttle);
    simulate(car,1,false,fps);return car.getSignedSpeed();
  });
  assert.ok(Math.max(...values)-Math.min(...values)<1e-9);
});

test('wheel contact detects an edge departure before the vehicle center leaves the road', () => {
  const track = new Track({controlPoints:[{x:0,z:0},{x:0,z:300},{x:300,z:300},{x:300,z:0}],halfWidth:9});
  const distance = track.getTotalLength()*.1;
  const position = track.getPointAtDistance(distance);
  const direction = track.getDirectionAtDistance(distance);
  position.addScaledVector(new Vector3(0,1,0).cross(direction),8.7).setY(.4);
  const car = new Vehicle();car.setTransform(position,new Quaternion().setFromUnitVectors(new Vector3(0,0,1),direction));
  assert.equal(track.isPointOnTrack(position),true);
  assert.equal(car.isOnSurface(track.isPointOnTrack),false);
  car.mesh.position.copy(track.getPointAtDistance(distance)).setY(.4);
  assert.equal(car.isOnSurface(track.isPointOnTrack),true);
});

for (const map of availableMaps) {
  test(`${map.id}: full-size circuit, safe grid, and accurate surface detection`, () => {
    const track = new Track(map.trackConfig);
    assert.ok(track.getTotalLength()>4500);
    const bounds=track.getBounds();assert.ok(bounds.max.x-bounds.min.x>1400);
    for(let i=0;i<100;i++) {
      const distance=i/100*track.getTotalLength();
      const point=track.getPointAtDistance(distance);
      assert.equal(track.isPointOnTrack(point.clone().setY(20)),true, 'Height must not alter road footprint');
      const side = new Vector3(0,1,0).cross(track.getDirectionAtDistance(distance));
      assert.equal(track.isPointOnTrack(point.clone().addScaledVector(side,track.getHalfWidth()+2)),false);
    }
    const car=new Vehicle();
    car.setTransform(track.getStartPosition().setY(.4),new Quaternion().setFromUnitVectors(new Vector3(0,0,1),track.getStartDirection()));
    assert.equal(car.isOnSurface(track.isPointOnTrack),true);
    console.log(`${map.id}: ${(track.getTotalLength()/1000).toFixed(2)} km`);
  });
}
