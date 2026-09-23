import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  TorusGeometry,
  Vector3
} from 'three';

export interface VehicleStats {
  maxOnTrackSpeed: number;
  maxReverseSpeed: number;
  acceleration: number;
  brakingForce: number;
  turnRate: number;
}

export interface VehicleConfig {
  bodyColor?: number;
  accentColor?: number;
  stats?: Partial<VehicleStats>;
}

const DEFAULT_STATS: VehicleStats = {
  maxOnTrackSpeed: 55,
  maxReverseSpeed: -14,
  acceleration: 34,
  brakingForce: 52,
  turnRate: 1.6
};

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

const DEFAULT_INPUT: InputState = { forward: false, backward: false, left: false, right: false };
const Y_AXIS = new Vector3(0, 1, 0);

export class Vehicle {
  readonly mesh: Group;
  private readonly stats: VehicleStats;
  private velocity = 0;
  private input: InputState = { ...DEFAULT_INPUT };
  private steering = 0;

  private readonly offTrackTurnScalar = 0.55;
  private readonly offTrackMaxSpeed = 5.5;
  private readonly offTrackMaxReverseSpeed = 3;
  private readonly surfaceProbe = new Vector3();
  private readonly wheelContacts = [
    new Vector3(-1.14, 0, 2.1), new Vector3(1.14, 0, 2.1),
    new Vector3(-1.09, 0, -1.7), new Vector3(1.09, 0, -1.7)
  ];

  private readonly rollingResistanceOnTrack = 0.985;

  private readonly tempDirection = new Vector3();
  private readonly tempQuaternion = new Quaternion();
  private readonly tempLateral = new Vector3();

  private readonly bodyColorHex: string;

  constructor(config: VehicleConfig = {}) {
    this.stats = { ...DEFAULT_STATS, ...config.stats };

    const bodyColor = config.bodyColor ?? 0x2194ce;
    const accentColor = config.accentColor ?? 0xffffff;

    const chassis = new Mesh(
      new BoxGeometry(1.8, 0.32, 4.4),
      new MeshStandardMaterial({ color: new Color(bodyColor), metalness: 0.35, roughness: 0.32 })
    );
    chassis.position.y = 0.28;

    const floor = new Mesh(
      new BoxGeometry(2.2, 0.08, 4.8),
      new MeshStandardMaterial({ color: 0x0f141a, metalness: 0.4, roughness: 0.4 })
    );
    floor.position.y = 0.2;

    const nose = new Mesh(
      new CapsuleGeometry(0.24, 1.7, 5, 12),
      new MeshStandardMaterial({ color: new Color(bodyColor).offsetHSL(0, -0.02, 0.05) })
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.38, 2.35);

    const frontWing = new Mesh(
      new BoxGeometry(2.6, 0.08, 0.9),
      new MeshStandardMaterial({ color: 0x1b1e24, metalness: 0.4, roughness: 0.45 })
    );
    frontWing.position.set(0, 0.25, 2.9);
    const frontFlap = new Mesh(new BoxGeometry(3.2, 0.055, 0.22), new MeshStandardMaterial({ color: 0x080b10, metalness: 0.65, roughness: 0.28 }));
    frontFlap.position.set(0, 0.22, 3.15);
    const frontWingEndplates = [-1, 1].map((side) => {
      const plate = new Mesh(new BoxGeometry(0.08, 0.35, 0.75), new MeshStandardMaterial({ color: 0x080b10, metalness: 0.55, roughness: 0.3 }));
      plate.position.set(side * 1.34, 0.4, 2.96);
      return plate;
    });

    const rearWing = new Mesh(
      new BoxGeometry(1.6, 0.1, 0.6),
      new MeshStandardMaterial({ color: 0x1b1e24, metalness: 0.35, roughness: 0.5 })
    );
    rearWing.position.set(0, 0.65, -2.1);
    const rearWingUpper = new Mesh(new BoxGeometry(2.45, 0.12, 0.5), new MeshStandardMaterial({ color: 0x11151c, metalness: 0.55, roughness: 0.3 }));
    rearWingUpper.position.set(0, 1.45, -2.12);
    const rearWingEndplates = [-1, 1].map((side) => {
      const plate = new Mesh(new BoxGeometry(0.08, 0.85, 0.5), new MeshStandardMaterial({ color: 0x11151c, metalness: 0.55, roughness: 0.3 }));
      plate.position.set(side * 0.86, 1.05, -2.12);
      return plate;
    });

    const rearWingPillar = new Mesh(
      new BoxGeometry(0.25, 0.5, 0.2),
      new MeshStandardMaterial({ color: 0x1b1e24, metalness: 0.35, roughness: 0.5 })
    );
    rearWingPillar.position.set(0, 0.45, -2.4);

    const cockpit = new Mesh(
      new CapsuleGeometry(0.43, 0.62, 6, 16),
      new MeshStandardMaterial({ color: 0x101d2b, metalness: 0.65, roughness: 0.16 })
    );
    cockpit.rotation.x = Math.PI / 2;
    cockpit.position.set(0, 0.55, -0.2);

    const halo = new Mesh(
      new TorusGeometry(0.5, 0.07, 12, 24, Math.PI * 1.2),
      new MeshStandardMaterial({ color: 0x1c2128, metalness: 0.4, roughness: 0.35 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 0.78, -0.3);

    const sidePodMaterial = new MeshStandardMaterial({
      color: new Color(bodyColor).offsetHSL(0, -0.05, -0.05),
      metalness: 0.25,
      roughness: 0.55
    });
    const leftPod = new Mesh(new BoxGeometry(0.4, 0.3, 1.6), sidePodMaterial);
    leftPod.position.set(-0.95, 0.36, -0.4);
    const rightPod = leftPod.clone();
    rightPod.position.x = 0.95;
    const floorStrakes = [-1, 1].map((side) => {
      const strake = new Mesh(new BoxGeometry(0.1, 0.16, 2.9), new MeshStandardMaterial({ color: new Color(bodyColor), metalness: 0.3, roughness: 0.4 }));
      strake.position.set(side * 0.72, 0.23, 0.15);
      return strake;
    });

    const wheelMaterial = new MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const wheelGeometry = new CylinderGeometry(0.46, 0.46, 0.38, 18);
    const wheelPositions = [
      { x: -0.95, z: 2.1 },
      { x: 0.95, z: 2.1 },
      { x: -0.9, z: -1.7 },
      { x: 0.9, z: -1.7 }
    ];

    this.mesh = new Group();
    this.mesh.add(floor);
    this.mesh.add(chassis);
    this.mesh.add(nose);
    this.mesh.add(frontWing);
    this.mesh.add(frontFlap);
    frontWingEndplates.forEach((plate) => this.mesh.add(plate));
    this.mesh.add(rearWing);
    this.mesh.add(rearWingUpper);
    rearWingEndplates.forEach((plate) => this.mesh.add(plate));
    this.mesh.add(rearWingPillar);
    this.mesh.add(cockpit);
    this.mesh.add(halo);
    this.mesh.add(leftPod);
    this.mesh.add(rightPod);
    floorStrakes.forEach((strake) => this.mesh.add(strake));

    wheelPositions.forEach(({ x, z }) => {
      const wheel = new Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.46, z);
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      this.mesh.add(wheel);
      const rim = new Mesh(new CylinderGeometry(0.23, 0.23, 0.395, 12), new MeshStandardMaterial({ color: accentColor, metalness: 0.8, roughness: 0.2 }));
      rim.rotation.z = Math.PI / 2;
      rim.position.set(x, 0.46, z);
      this.mesh.add(rim);
    });

    this.mesh.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.bodyColorHex = `#${bodyColor.toString(16).padStart(6, '0')}`;
  }

  setInput(state: InputState) {
    this.input = state;
  }

  setTransform(position: Vector3, rotation: Quaternion) {
    this.mesh.position.copy(position);
    this.mesh.quaternion.copy(rotation);
  }

  halt() {
    this.velocity = 0;
    this.steering = 0;
    this.input = { ...DEFAULT_INPUT };
  }

  getVelocity() {
    return this.velocity;
  }

  setVelocity(value: number) {
    const clamped = Math.max(this.stats.maxReverseSpeed, Math.min(value, this.stats.maxOnTrackSpeed * 1.2));
    this.velocity = clamped;
  }

  update(delta: number, onTrack = true) {
    const forwardPressed = this.input.forward ? 1 : 0;
    const backwardPressed = this.input.backward ? 1 : 0;

    if (!onTrack) {
      // A time-based response gives the same slowdown at 30, 60, or 144 FPS.
      // Both forward and reverse remain slow enough to penalize shortcuts.
      const target = backwardPressed
        ? -Math.min(this.offTrackMaxReverseSpeed, Math.abs(this.stats.maxReverseSpeed))
        : forwardPressed ? Math.min(this.offTrackMaxSpeed, this.stats.maxOnTrackSpeed) : 0;
      const slowing = Math.abs(this.velocity) > Math.abs(target) || this.velocity * target < 0;
      this.velocity = MathUtils.damp(this.velocity, target, slowing ? 6 : 1.2, delta);
      if (Math.abs(this.velocity) < 0.05 && !forwardPressed && !backwardPressed) this.velocity = 0;
    } else {
      if (forwardPressed) this.velocity += this.stats.acceleration * delta;
      if (backwardPressed) this.velocity -= this.stats.brakingForce * delta;
      if (!forwardPressed && !backwardPressed) {
        this.velocity *= Math.pow(this.rollingResistanceOnTrack, delta * 60);
        if (Math.abs(this.velocity) < 0.05) this.velocity = 0;
      }
      this.velocity = MathUtils.clamp(this.velocity, this.stats.maxReverseSpeed, this.stats.maxOnTrackSpeed);
    }

    this.tempDirection.set(0, 0, 1).applyQuaternion(this.mesh.quaternion).normalize();
    const displacement = this.tempDirection.multiplyScalar(this.velocity * delta);
    this.mesh.position.add(displacement);

    if (Math.abs(this.velocity) > 0.2) {
      const turnInput = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0);
      // Steering has its own inertia. The car needs a little time to load the tires,
      // and releasing the key lets the wheel naturally unwind instead of snapping straight.
      const steeringTarget = turnInput * (onTrack ? 1 : this.offTrackTurnScalar);
      const steeringResponse = onTrack ? 4.6 : 2.2;
      this.steering = MathUtils.damp(this.steering, steeringTarget, steeringResponse, delta);
      const speedFactor = Math.min(1, Math.abs(this.velocity) / (this.stats.maxOnTrackSpeed * 0.95));
      const grip = onTrack ? 0.43 : 0.27;
      const response = Math.max(0.12, speedFactor * grip);
      const angularVelocity = this.steering * this.stats.turnRate * response * Math.sign(this.velocity);
      this.tempQuaternion.setFromAxisAngle(Y_AXIS, angularVelocity * delta);
      this.mesh.quaternion.multiply(this.tempQuaternion);
    } else {
      this.steering = MathUtils.damp(this.steering, 0, 5, delta);
    }
  }

  isOnSurface(contains: (point: Vector3) => boolean) {
    return this.wheelContacts.every((contact) => {
      this.surfaceProbe.copy(contact).applyQuaternion(this.mesh.quaternion).add(this.mesh.position);
      return contains(this.surfaceProbe);
    });
  }

  getSpeedKph() {
    return Math.max(0, this.velocity) * 3.6;
  }

  getSignedSpeed() {
    return this.velocity;
  }

  getForwardVector(out = new Vector3()) {
    return out.set(0, 0, 1).applyQuaternion(this.mesh.quaternion).normalize();
  }

  applyCollisionResponse(normal: Vector3, strength: number) {
    this.tempLateral.copy(normal);
    this.tempLateral.y = 0;
    const length = this.tempLateral.length();
    if (length === 0) {
      return;
    }

    this.tempLateral.multiplyScalar(1 / length);

    const pushDistance = Math.max(0.1, strength * 0.6);
    this.mesh.position.addScaledVector(this.tempLateral, pushDistance);
    this.mesh.position.y = Math.max(0.35, this.mesh.position.y);

    if (this.velocity > 0) {
      this.velocity *= 0.82;
      this.velocity = Math.min(this.velocity + strength * 6, this.stats.maxOnTrackSpeed * 1.05);
    }

    const forward = this.getForwardVector(this.tempDirection);
    const deflectSign = Math.sign(this.tempLateral.cross(forward).y || 1);
    const deflectAmount = strength * 0.12 * deflectSign;
    this.tempQuaternion.setFromAxisAngle(Y_AXIS, deflectAmount);
    this.mesh.quaternion.multiply(this.tempQuaternion);
  }

  getBodyColorHex() {
    return this.bodyColorHex;
  }
}
