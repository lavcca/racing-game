import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DataTexture,
  CircleGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RepeatWrapping,
  RGBAFormat,
  Vector3
} from 'three';

export interface ProgressInfo {
  distance: number;
  normalized: number;
  checkpointIndex: number;
  onTrack: boolean;
}

export interface TrackBounds {
  min: Vector3;
  max: Vector3;
}

export interface TrackConfig {
  controlPoints?: Array<Vector3 | { x: number; y?: number; z: number }>;
  halfWidth?: number;
  checkpointCount?: number;
  smoothing?: number;
  loop?: boolean;
  groundColor?: number;
}

export const DEFAULT_CONTROL_POINTS = [
  new Vector3(0, 0, 220),
  new Vector3(140, 0, 180),
  new Vector3(240, 0, 40),
  new Vector3(210, 0, -140),
  new Vector3(60, 0, -240),
  new Vector3(-90, 0, -260),
  new Vector3(-230, 0, -170),
  new Vector3(-280, 0, -10),
  new Vector3(-210, 0, 160),
  new Vector3(-40, 0, 240)
];

const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);

export class Track {
  readonly mesh = new Group();

  private readonly path: CatmullRomCurve3;
  private readonly centerline: Vector3[];
  private readonly halfWidth: number;
  private readonly startPoint: Vector3;
  private readonly startDirection: Vector3;
  private readonly cumulativeLengths: number[];
  private readonly segmentLengths: number[];
  private readonly totalLength: number;
  private readonly checkpointCount: number;
  private readonly checkpointDistances: number[];
  private readonly boundsMin = new Vector3(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
  private readonly boundsMax = new Vector3(Number.NEGATIVE_INFINITY, 0, Number.NEGATIVE_INFINITY);

  private readonly tempVector = new Vector3();
  private readonly tempVectorB = new Vector3();
  private readonly tempQuaternion = new Quaternion();

  constructor(config: TrackConfig = {}) {
    const {
      controlPoints = DEFAULT_CONTROL_POINTS,
      halfWidth = 11,
      checkpointCount = 12,
      smoothing = 0.45,
      loop = true,
      groundColor = 0x1b3c1b
    } = config;

    const curvePoints = controlPoints.map((point) =>
      point instanceof Vector3 ? point.clone() : new Vector3(point.x, point.y ?? 0, point.z)
    );

    this.halfWidth = halfWidth;
    this.checkpointCount = checkpointCount;
    this.path = new CatmullRomCurve3(curvePoints, loop, 'centripetal', smoothing);

    this.path.arcLengthDivisions = 2048;
    this.path.updateArcLengths();
    const segments = Math.max(480, Math.ceil(this.path.getLength() / 3));
    const spacedPoints = this.path.getSpacedPoints(segments);
    if (spacedPoints.length > 0 && loop) {
      spacedPoints.pop();
    }

    const registerBounds = (point: Vector3) => {
      if (point.x < this.boundsMin.x) this.boundsMin.x = point.x;
      if (point.z < this.boundsMin.z) this.boundsMin.z = point.z;
      if (point.x > this.boundsMax.x) this.boundsMax.x = point.x;
      if (point.z > this.boundsMax.z) this.boundsMax.z = point.z;
    };

    this.centerline = spacedPoints.map((point) => {
      registerBounds(point);
      return point.clone();
    });
    this.startPoint = this.centerline[0]?.clone() ?? new Vector3();
    this.startDirection = this.path.getTangentAt(0).clone().normalize();

    const pointCount = spacedPoints.length;
    this.cumulativeLengths = new Array(pointCount).fill(0);
    this.segmentLengths = new Array(pointCount).fill(0);

    let lengthAccumulator = 0;
    for (let i = 0; i < pointCount; i++) {
      const current = spacedPoints[i];
      const next = spacedPoints[(i + 1) % pointCount];
      const segmentLength = current.distanceTo(next);
      this.segmentLengths[i] = segmentLength;
      lengthAccumulator += segmentLength;
      this.cumulativeLengths[i] = lengthAccumulator;
    }

    this.totalLength = lengthAccumulator;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const tangent = new Vector3();
    const side = new Vector3();

    for (let i = 0; i < pointCount; i++) {
      const point = spacedPoints[i];
      const u = i / pointCount;
      tangent.copy(this.path.getTangentAt(u)).normalize();
      side.copy(UP).cross(tangent).normalize();

      const left = point.clone().addScaledVector(side, this.halfWidth);
      const right = point.clone().addScaledVector(side, -this.halfWidth);

      positions.push(left.x, left.y, left.z);
      positions.push(right.x, right.y, right.z);

      registerBounds(left);
      registerBounds(right);

      const v = u * pointCount * 0.2;
      uvs.push(0, v);
      uvs.push(1, v);
    }

    for (let i = 0; i < pointCount; i++) {
      const next = (i + 1) % pointCount;
      const a = i * 2;
      const b = a + 1;
      const c = next * 2;
      const d = c + 1;

      indices.push(a, b, c);
      indices.push(c, b, d);
    }

    const roadGeometry = new BufferGeometry();
    roadGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    roadGeometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    roadGeometry.setIndex(indices);
    roadGeometry.computeVertexNormals();

    const pixels = new Uint8Array(64 * 64 * 4);
    for (let i = 0; i < 64 * 64; i++) {
      const shade = 175 + ((i * 73 + (i >> 3) * 19) % 65);
      pixels.set([shade, shade, shade, 255], i * 4);
    }
    const asphaltTexture = new DataTexture(pixels, 64, 64, RGBAFormat);
    asphaltTexture.wrapS = asphaltTexture.wrapT = RepeatWrapping;
    asphaltTexture.needsUpdate = true;
    const roadMaterial = new MeshStandardMaterial({
      map: asphaltTexture,
      color: 0x2b2c30,
      metalness: 0.1,
      roughness: 0.92,
      side: DoubleSide
    });

    const roadMesh = new Mesh(roadGeometry, roadMaterial);
    roadMesh.receiveShadow = true;
    roadMesh.castShadow = false;
    this.mesh.add(roadMesh);

    const groundRadius = Math.max(
      Math.abs(this.boundsMin.x), Math.abs(this.boundsMax.x),
      Math.abs(this.boundsMin.z), Math.abs(this.boundsMax.z)
    ) + 3000;
    const groundGeometry = new CircleGeometry(groundRadius, 96);
    const groundMaterial = new MeshStandardMaterial({ color: groundColor, roughness: 1, metalness: 0 });
    const ground = new Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.mesh.add(ground);

    const centerlineGeometry = new BufferGeometry().setFromPoints(
      this.centerline.map((point) => point.clone().setY(point.y + 0.02))
    );
    const centerlineMaterial = new LineDashedMaterial({ color: 0xbec1b3, dashSize: 4, gapSize: 10 });
    const centerline = new Line(centerlineGeometry, centerlineMaterial);
    centerline.computeLineDistances();
    this.mesh.add(centerline);

    // Roadside kerbs and a start gate give the driver readable track boundaries.
    const red = new MeshStandardMaterial({ color: 0xe95347 });
    const white = new MeshStandardMaterial({ color: 0xe6edf5 });
    const dark = new MeshStandardMaterial({ color: 0x182333 });
    const kerbCount = Math.ceil(this.totalLength / 3);
    const kerbGeometry = new BoxGeometry(0.8, 0.16, this.totalLength / kerbCount * 1.02);
    const kerbs = new InstancedMesh(kerbGeometry, white, kerbCount * 2);
    const kerbPose = new Object3D();
    const kerbRed = new Color(0xe95347), kerbWhite = new Color(0xffffff);
    for (let i = 0; i < kerbCount; i++) {
      const distance = i / kerbCount * this.totalLength;
      const point = this.getPointAtDistance(distance);
      const direction = this.getDirectionAtDistance(distance);
      const lateral = new Vector3().crossVectors(UP, direction).normalize();
      for (let edge = 0; edge < 2; edge++) {
        kerbPose.position.copy(point).addScaledVector(lateral, (edge * 2 - 1) * this.halfWidth);
        kerbPose.position.y = 0.06;
        kerbPose.quaternion.setFromUnitVectors(FORWARD, direction);
        kerbPose.updateMatrix(); kerbs.setMatrixAt(i * 2 + edge, kerbPose.matrix);
        kerbs.setColorAt(i * 2 + edge, i % 2 ? kerbRed : kerbWhite);
      }
    }
    kerbs.receiveShadow = true; kerbs.computeBoundingSphere(); this.mesh.add(kerbs);
    const gate = new Group();
    gate.position.copy(this.startPoint);
    gate.quaternion.setFromUnitVectors(FORWARD, this.startDirection);
    for (const side of [-1, 1]) {
      const post = new Mesh(new BoxGeometry(0.5, 6, 0.5), dark);
      post.position.set(side * (this.halfWidth + 1), 3, 0);
      gate.add(post);
    }
    const top = new Mesh(new BoxGeometry(this.halfWidth * 2 + 2.5, 0.65, 0.6), red);
    top.position.y = 6; gate.add(top);
    const tileGeometry = new BoxGeometry(this.halfWidth / 8, 0.04, 1.2);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 2; z++) {
      const tile = new Mesh(tileGeometry, (x + z) % 2 ? white : dark);
      tile.position.set(-this.halfWidth + (x + 0.5) * this.halfWidth / 8, 0.035, z * 1.2);
      gate.add(tile);
    }
    this.mesh.add(gate);

    this.checkpointDistances = [];
    const checkpointMaterial = new MeshStandardMaterial({
      color: 0xfad648,
      metalness: 0.2,
      emissive: 0x332200,
      roughness: 0.3,
      transparent: true,
      opacity: 0.8,
      side: DoubleSide
    });

    for (let i = 0; i < this.checkpointCount; i++) {
      const distance = (this.totalLength / this.checkpointCount) * i;
      this.checkpointDistances.push(distance);

      const marker = new Mesh(new CircleGeometry(5, 32), checkpointMaterial);
      const point = this.getPointAtDistance(distance, this.tempVector).setY(0.05);
      const tangentVector = this.getDirectionAtDistance(distance, this.tempVectorB);

      this.tempQuaternion.setFromUnitVectors(FORWARD, tangentVector);
      marker.quaternion.copy(this.tempQuaternion);
      marker.rotateX(Math.PI / 2);
      marker.position.copy(point);
      marker.renderOrder = 1;

      this.mesh.add(marker);
    }
  }

  getStartPosition() {
    return this.startPoint.clone();
  }

  getStartDirection() {
    return this.startDirection.clone();
  }

  getTotalLength() {
    return this.totalLength;
  }

  getCheckpointDistances() {
    return [...this.checkpointDistances];
  }

  getPointAtDistance(distance: number, target = new Vector3()) {
    const wrapped = ((distance % this.totalLength) + this.totalLength) % this.totalLength;
    const t = wrapped / this.totalLength;
    return this.path.getPointAt(t, target);
  }

  getDirectionAtDistance(distance: number, target = new Vector3()) {
    const wrapped = ((distance % this.totalLength) + this.totalLength) % this.totalLength;
    const t = wrapped / this.totalLength;
    return this.path.getTangentAt(t, target).normalize();
  }

  isPointOnTrack = (position: Vector3) => this.getProgress(position).onTrack;

  getProgress(position: Vector3): ProgressInfo {
    let nearestDistanceSq = Infinity;
    let distance = 0;
    for (let i = 0; i < this.centerline.length; i++) {
      const start = this.centerline[i];
      const end = this.centerline[(i + 1) % this.centerline.length];
      const dx = end.x - start.x, dz = end.z - start.z;
      const lengthSq = dx * dx + dz * dz;
      const t = lengthSq > 0 ? Math.max(0, Math.min(1,
        ((position.x - start.x) * dx + (position.z - start.z) * dz) / lengthSq)) : 0;
      const ex = position.x - start.x - t * dx, ez = position.z - start.z - t * dz;
      const distanceSq = ex * ex + ez * ez;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        distance = (i === 0 ? 0 : this.cumulativeLengths[i - 1]) + this.segmentLengths[i] * t;
      }
    }
    const normalized = distance / this.totalLength;
    return {
      distance, normalized,
      checkpointIndex: Math.floor((normalized % 1) * this.checkpointCount),
      onTrack: nearestDistanceSq <= this.halfWidth * this.halfWidth
    };
  }

  getHalfWidth() {
    return this.halfWidth;
  }

  getCenterlinePoints() {
    return this.centerline.map((point) => point.clone());
  }

  getBounds(): TrackBounds {
    return { min: this.boundsMin.clone(), max: this.boundsMax.clone() };
  }
}
