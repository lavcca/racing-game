import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, DoubleSide,
  Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry,
  RepeatWrapping, SphereGeometry, SRGBColorSpace, Vector3
} from 'three';

import type { Track } from '../game/Track';

const up = new Vector3(0, 1, 0);
const forward = new Vector3(0, 0, 1);

function randomSource(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

function instances(root: Group, geometry: BufferGeometry, color: number, poses: Object3D[], shadows = true) {
  const mesh = new InstancedMesh(geometry, new MeshStandardMaterial({color, roughness: .85}), poses.length);
  poses.forEach((pose, index) => { pose.updateMatrix(); mesh.setMatrixAt(index, pose.matrix); });
  mesh.castShadow = shadows; mesh.receiveShadow = true;
  mesh.computeBoundingSphere(); root.add(mesh); return mesh;
}

function pose(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, angle = 0) {
  const object = new Object3D(); object.position.set(x, y, z);
  object.scale.set(sx, sy, sz); object.rotation.y = angle; return object;
}

function sign(text: string, width: number, height: number, color = '#c7fa65') {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#142334'; context.fillRect(0, 0, 1024, 256);
  context.fillStyle = color; context.fillRect(0, 228, 1024, 12);
  context.font = 'bold 92px sans-serif'; context.textAlign = 'center';
  context.fillText(text, 512, 164);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return new Mesh(new PlaneGeometry(width, height), new MeshStandardMaterial({map:texture, side:DoubleSide, roughness:.7}));
}

export function decorateCircuit(track: Track, root: Group, desert: boolean) {
  const random = randomSource(desert ? 9407 : 6213);
  const length = track.getTotalLength();
  const box = new BoxGeometry(1, 1, 1);
  const rails: Object3D[] = [], posts: Object3D[] = [];
  const count = Math.ceil(length / 8);
  for (let i = 0; i < count; i++) {
    const distance = i / count * length;
    const center = track.getPointAtDistance(distance);
    const direction = track.getDirectionAtDistance(distance);
    const side = new Vector3().crossVectors(up, direction);
    const angle = Math.atan2(direction.x, direction.z);
    for (const edge of [-1, 1]) {
      const point = center.clone().addScaledVector(side, edge * (track.getHalfWidth() + 8));
      posts.push(pose(point.x, .65, point.z, .16, 1.3, .16, angle));
      for (const y of [.5, 1]) rails.push(pose(point.x, y, point.z, .14, .28, length / count + .3, angle));
    }
  }
  instances(root, box, 0x929a9d, rails, false);
  instances(root, box, 0x535c60, posts, false);

  // Safety obstacles make the shoulders readable and punish cutting corners.
  const cones: Object3D[] = [];
  const barriers: Object3D[] = [];
  const coneMaterial = new MeshStandardMaterial({ color: 0xf36b31, roughness: 0.65 });
  for (let i = 0; i < Math.ceil(length / 95); i++) {
    const distance = (i + 0.35) / Math.ceil(length / 95) * length;
    const point = track.getPointAtDistance(distance);
    const tangent = track.getDirectionAtDistance(distance);
    const shoulder = new Vector3().crossVectors(up, tangent).normalize();
    const side = i % 2 ? 1 : -1;
    const obstacle = point.addScaledVector(shoulder, side * (track.getHalfWidth() + 3.4));
    cones.push(pose(obstacle.x, 0.55, obstacle.z, 0.55, 1.1, 0.55, i));
    if (i % 3 === 0) {
      const barrier = pose(obstacle.x + shoulder.z * side * 2.2, 0.6, obstacle.z - shoulder.x * side * 2.2, 2.8, 1.2, 0.45, Math.atan2(tangent.x, tangent.z));
      barriers.push(barrier);
    }
  }
  const conesMesh = new InstancedMesh(new ConeGeometry(0.55, 1.1, 12), coneMaterial, cones.length);
  cones.forEach((item, index) => { item.updateMatrix(); conesMesh.setMatrixAt(index, item.matrix); });
  conesMesh.castShadow = true; conesMesh.computeBoundingSphere(); root.add(conesMesh);
  instances(root, box, 0xe3e7e8, barriers);

  // Braking markers, sector boards and a readable start gantry.
  for (let i = 1; i < 10; i++) {
    const distance = length * i / 10;
    const direction = track.getDirectionAtDistance(distance);
    const point = track.getPointAtDistance(distance).addScaledVector(new Vector3().crossVectors(up, direction), track.getHalfWidth() + 5);
    const board = sign(i % 3 === 0 ? `SECTOR ${Math.ceil(i / 3)}` : '100', i % 3 === 0 ? 8 : 2, 2);
    board.position.copy(point).setY(2.6); board.quaternion.setFromUnitVectors(forward, direction); board.rotateY(Math.PI);
    root.add(board);
  }
  const start = track.getStartPosition();
  const direction = track.getStartDirection();
  const gantry = sign('APEX  /  GRAND PRIX', track.getHalfWidth() * 2 + 2, 2);
  gantry.position.copy(start).setY(6.5); gantry.quaternion.setFromUnitVectors(forward, direction); gantry.rotateY(Math.PI); root.add(gantry);

  // Paddock and stepped grandstands, placed beside the start straight.
  const facility = new Group(); facility.position.copy(track.getPointAtDistance(45));
  facility.quaternion.setFromUnitVectors(forward, track.getDirectionAtDistance(45));
  const concrete = new MeshStandardMaterial({color:0xb6b5b0, roughness:.85});
  const glass = new MeshStandardMaterial({color:0x3b697e, metalness:.55, roughness:.25});
  function block(x: number, y: number, z: number, w: number, h: number, d: number, mat = concrete) {
    const mesh = new Mesh(new BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;facility.add(mesh);
  }
  const edge = track.getHalfWidth();
  block(-edge-25, 3, 0, 20, 6, 90);
  block(-edge-25, 8, 0, 18, 4, 90, glass);
  block(-edge-25, 10.3, 0, 23, .7, 94);
  const garage = new MeshStandardMaterial({color:0x293641});
  for(let i=0;i<9;i++) block(-edge-14.9,2, -39+i*9.5,.2,3.7,6.5,garage);
  const seats = new MeshStandardMaterial({color:desert?0xca6b3e:0x316db0});
  for(let row=0;row<6;row++) block(edge+16+row*2, .5+row*.65, 10, 2, 1+row*1.3, 80, seats);
  block(edge+22, 9.5, 10, 19, .45, 88);
  for (const z of [-30,50]) block(edge+28,5,z,.4,10,.4);
  root.add(facility);

  const trunks: Object3D[] = [], leaves: Object3D[] = [], lamps: Object3D[] = [];
  for (let i = 0; i < 240; i++) {
    const distance = (i + .25) / 240 * length;
    const point = track.getPointAtDistance(distance);
    const side = new Vector3().crossVectors(up, track.getDirectionAtDistance(distance));
    point.addScaledVector(side, (i % 2 ? 1 : -1) * (track.getHalfWidth() + 16 + random() * 20));
    // Keep the start straight open for pits and grandstands.
    if (distance < 110 || distance > length - 30) continue;
    const height = desert ? 2.5 + random() * 2 : 5 + random() * 5;
    trunks.push(pose(point.x, height / 2, point.z, desert ? .65 : .4, height, desert ? .65 : .4));
    if (!desert) leaves.push(pose(point.x, height, point.z, 2 + random(), 3 + random(), 2 + random()));
    if (!desert && i % 3 === 0) {
      const lamp = track.getPointAtDistance(distance).addScaledVector(side, track.getHalfWidth() + 10);
      lamps.push(pose(lamp.x, 4, lamp.z, .15, 8, .15));
      lamps.push(pose(lamp.x, 8, lamp.z, 2, .15, .65));
    }
  }
  instances(root, box, desert ? 0x456b39 : 0x655345, trunks);
  if (leaves.length) instances(root, new SphereGeometry(1, 8, 6), 0x4b703e, leaves);
  if (lamps.length) instances(root, box, 0xb5bdc6, lamps);

  // Distant terrain surrounds the whole circuit rather than a small flat disc.
  const bounds = track.getBounds();
  const radius = Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.z),Math.abs(bounds.max.z)) + 550;
  const mountains: Object3D[] = [];
  for(let i=0;i<44;i++) {
    const a=i/44*Math.PI*2, r=radius+random()*500;
    const height=130+random()*380;
    mountains.push(pose(Math.cos(a)*r,height*.43-35,Math.sin(a)*r,180+random()*250,height,180+random()*220,random()*6));
  }
  instances(root,new ConeGeometry(1,1,7,2),desert?0xa88464:0x526c65,mountains,false);

  if (desert) {
    const rocks: Object3D[] = [];
    for(let i=0;i<110;i++) {
      const distance=random()*length;
      const point=track.getPointAtDistance(distance);
      const direction=track.getDirectionAtDistance(distance);
      point.addScaledVector(new Vector3().crossVectors(up,direction),(i%2?1:-1)*(40+random()*170));
      if(track.getProgress(point).onTrack) continue;
      const height=4+random()*16;
      rocks.push(pose(point.x,height*.32,point.z,8+random()*16,height,8+random()*16,random()*6));
    }
    instances(root,new ConeGeometry(1,1,6),0xb4916c,rocks);
  } else {
    const buildings: Object3D[] = [];
    for(let i=0;i<100;i++) {
      const point=track.getPointAtDistance((i+.4)/100*length);
      const direction=track.getDirectionAtDistance((i+.4)/100*length);
      point.addScaledVector(new Vector3().crossVectors(up,direction),(i%2?1:-1)*(75+random()*110));
      if(track.getProgress(point).onTrack) continue;
      const height=15+random()*80;
      buildings.push(pose(point.x,height/2,point.z,16+random()*24,height,15+random()*23,Math.atan2(direction.x,direction.z)));
    }
    const skyline=instances(root,box,0xffffff,buildings);
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
    const context=canvas.getContext('2d')!;context.fillStyle='#72828c';context.fillRect(0,0,128,256);
    for(let x=5;x<128;x+=16) for(let y=5;y<256;y+=16) {
      context.fillStyle=random()>.2?'#263e4d':'#abc3ce';context.fillRect(x,y,9,10);
    }
    const texture=new CanvasTexture(canvas);texture.wrapS=texture.wrapT=RepeatWrapping;texture.colorSpace=SRGBColorSpace;
    (skyline.material as MeshStandardMaterial).map=texture;
    buildings.forEach((_,i)=>skyline.setColorAt(i,new Color().setHSL(.58,.08,.65+random()*.3)));
  }
}
