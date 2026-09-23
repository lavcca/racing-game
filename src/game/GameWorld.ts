import Stats from 'stats.js';
import { InstancedMesh, Mesh, Quaternion, Texture, Vector3 } from 'three';

import { Loop } from '../core/Loop';
import { Renderer } from '../core/Renderer';
import { SceneManager } from '../core/SceneManager';
import { InputManager } from '../input/InputManager';
import { GameMap } from '../maps/types';
import { Hud } from '../ui/Hud';
import { MiniMap, MiniMapPoint } from '../ui/MiniMap';
import { ScoreBurst } from '../ui/ScoreBurst';

import { AIController, AIProfile } from './AIController';
import { RaceManager, RacerEntry } from './RaceManager';
import { Track } from './Track';
import { Vehicle, VehicleConfig } from './Vehicle';

const FORWARD_REFERENCE = new Vector3(0, 0, 1);
const UP = new Vector3(0, 1, 0);

interface GridSlot {
  id: string;
  name: string;
  lane: number;
  row: number;
  type: 'player' | 'ai';
  vehicleConfig: VehicleConfig;
  aiProfile?: AIProfile;
}

export class GameWorld {
  private readonly renderer: Renderer;
  private readonly sceneManager: SceneManager;
  private readonly loop: Loop;
  private readonly inputManager: InputManager;
  private readonly hud: Hud;
  private readonly miniMap: MiniMap;
  private readonly scoreBurst: ScoreBurst;
  private readonly stats = new Stats();

  private readonly map: GameMap;
  private readonly track: Track;
  private readonly raceManager: RaceManager;
  private readonly racers: RacerEntry[] = [];
  private readonly aiControllers: AIController[] = [];

  private readonly cameraTarget = new Vector3();
  private readonly cameraForward = new Vector3();
  private readonly cameraOffset = new Vector3();
  private readonly desiredCameraPosition = new Vector3();

  private playerId = 'player';
  private playerVehicle!: Vehicle;
  private readonly totalLaps = 3;
  private readonly raceDuration = 600;
  private remainingTime = this.raceDuration;
  private raceOver = false;
  private paused = false;
  private countdown = 3;
  private readonly banner = document.createElement('div');
  private readonly toolbar = document.createElement('div');
  private readonly collisionRadius = 2.6;
  private readonly collisionVector = new Vector3();
  private readonly collisionOpposite = new Vector3();

  constructor(canvas: HTMLCanvasElement, map: GameMap) {
    this.map = map;
    this.renderer = new Renderer(canvas);
    this.sceneManager = new SceneManager(map.id === 'desert-sprint');
    this.track = new Track(map.trackConfig);
    this.raceManager = new RaceManager(this.track, this.totalLaps);

    this.sceneManager.root.add(this.track.mesh);
    map.decorateScene?.(this.track, this.sceneManager.root);

    const centerline2d = this.track.getCenterlinePoints().map((point) => ({ x: point.x, z: point.z }));
    this.miniMap = new MiniMap(centerline2d, this.track.getBounds());

    this.inputManager = new InputManager();
    this.hud = new Hud();
    this.scoreBurst = new ScoreBurst();

    this.loop = new Loop(this.update);
    this.stats.showPanel(0);
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.left = '0';
    this.stats.dom.style.top = '0';

    // The FPS panel is opt-in so it does not cover the minimap.
    if (new URLSearchParams(location.search).has('debug')) document.body.appendChild(this.stats.dom);
    this.banner.className = 'race-banner';
    this.toolbar.className = 'race-toolbar';
    this.toolbar.innerHTML = '<span>WASD / 방향키 · SPACE 감속 · R 복귀 · P 일시정지</span><button data-action="pause">일시정지</button><button data-action="recover">트랙 복귀</button><button data-action="menu">트랙 선택</button>';
    this.toolbar.querySelector('[data-action="pause"]')?.addEventListener('click', this.togglePause);
    this.toolbar.querySelector('[data-action="recover"]')?.addEventListener('click', this.recover);
    this.toolbar.querySelector('[data-action="menu"]')?.addEventListener('click', () => location.reload());
    document.body.append(this.banner, this.toolbar);
    window.addEventListener('keydown', this.handleCommand);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);

    window.addEventListener('resize', this.handleResize);
    this.handleResize();

    this.setupGrid();
  }

  initialize() {
    if (!this.playerVehicle) {
      throw new Error('Player vehicle failed to initialize');
    }
    this.inputManager.subscribe((state) => {
      if (this.raceOver || this.paused || this.countdown > 0) {
        return;
      }
      this.playerVehicle.setInput(state);
    });
  }

  start() {
    this.loop.start();
  }

  dispose() {
    this.loop.stop();
    this.sceneManager.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
          material.dispose();
        });
        if (object instanceof InstancedMesh) object.dispose();
      }
    });
    this.renderer.dispose();
    this.inputManager.dispose();
    this.hud.dispose();
    this.miniMap.dispose();
    this.scoreBurst.dispose();
    this.stats.dom.remove();
    this.banner.remove(); this.toolbar.remove();
    window.removeEventListener('keydown', this.handleCommand);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('resize', this.handleResize);
  }

  private setupGrid() {
    const startPosition = this.track.getStartPosition();
    const startDirection = this.track.getStartDirection();
    const startRotation = new Quaternion().setFromUnitVectors(FORWARD_REFERENCE, startDirection);
    const right = startDirection.clone().cross(UP).normalize();

    const laneSpacing = 4.2;
    const rowSpacing = 6.5;

    const grid: GridSlot[] = [
      {
        id: 'player',
        name: '나',
        lane: 0,
        row: 0,
        type: 'player',
        vehicleConfig: {
          bodyColor: 0x2194ce,
          accentColor: 0xffffff,
          stats: { maxOnTrackSpeed: 58, acceleration: 36, turnRate: 1.9 }
        }
      },
      {
        id: 'ari',
        name: 'Ari Blaze',
        lane: -1,
        row: 0,
        type: 'ai',
        vehicleConfig: {
          bodyColor: 0xe94f37,
          accentColor: 0xfee08b,
          stats: { maxOnTrackSpeed: 76, acceleration: 50, turnRate: 2.3 }
        },
        aiProfile: {
          id: 'ari',
          name: 'Ari Blaze',
          targetSpeedKph: 270,
          lookAheadDistance: 14,
          corneringSensitivity: 1.05,
          recoveryBias: 0.6
        }
      },
      {
        id: 'nova',
        name: 'Nova Drift',
        lane: 1,
        row: 0,
        type: 'ai',
        vehicleConfig: {
          bodyColor: 0x8c54ff,
          accentColor: 0xf8f9ff,
          stats: { maxOnTrackSpeed: 72, acceleration: 47, turnRate: 2.8 }
        },
        aiProfile: {
          id: 'nova',
          name: 'Nova Drift',
          targetSpeedKph: 258,
          lookAheadDistance: 13,
          corneringSensitivity: 0.85,
          recoveryBias: 0.7
        }
      },
      {
        id: 'rhett',
        name: 'Rhett Torque',
        lane: 0,
        row: 1,
        type: 'ai',
        vehicleConfig: {
          bodyColor: 0x2ecc71,
          accentColor: 0xd1ffd6,
          stats: { maxOnTrackSpeed: 68, acceleration: 45, turnRate: 2.1 }
        },
        aiProfile: {
          id: 'rhett',
          name: 'Rhett Torque',
          targetSpeedKph: 245,
          lookAheadDistance: 10,
          corneringSensitivity: 1.05,
          recoveryBias: 0.8
        }
      }
    ];

    grid.forEach((slot) => {
      const vehicle = new Vehicle(slot.vehicleConfig);
      const offsetSide = right.clone().multiplyScalar(laneSpacing * slot.lane);
      const offsetRow = startDirection.clone().multiplyScalar(-rowSpacing * slot.row);

      const spawnPosition = startPosition.clone().add(offsetSide).add(offsetRow);
      spawnPosition.y = 0.4;

      vehicle.setTransform(spawnPosition, startRotation);
      this.sceneManager.root.add(vehicle.mesh);

      const racerEntry: RacerEntry = {
        id: slot.id,
        name: slot.name,
        vehicle,
        type: slot.type
      };

      this.racers.push(racerEntry);
      this.raceManager.registerRacer(racerEntry);

      if (slot.type === 'ai' && slot.aiProfile) {
        this.aiControllers.push(new AIController(this.track, vehicle, slot.aiProfile));
      }

      if (slot.id === this.playerId) {
        this.playerVehicle = vehicle;
      }
    });

    if (!this.playerVehicle) {
      throw new Error('Player grid slot not configured');
    }

    this.sceneManager.camera.position.set(startPosition.x, startPosition.y + 12, startPosition.z + 22);
    this.sceneManager.camera.lookAt(startPosition);
  }

  private update = (delta: number, elapsed: number) => {
    this.stats.begin();

    let raceElapsed = elapsed;
    if (!this.paused && this.countdown > 0) {
      raceElapsed = Math.max(0, elapsed - this.countdown);
      this.countdown = Math.max(0, this.countdown - elapsed);
      this.banner.textContent = this.countdown > 0 ? String(Math.ceil(this.countdown)) : '';
      if (this.countdown === 0) this.playerVehicle.setInput(this.inputManager.getState());
    }
    const active = !this.paused && this.countdown === 0;
    if (!this.raceOver && active) {
      this.remainingTime = Math.max(0, this.remainingTime - raceElapsed);
      if (this.remainingTime <= 0) {
        this.finishRace();
      }
    }

    if (!this.raceOver && active) {
      this.aiControllers.forEach((controller) => controller.update(delta));

      this.racers.forEach((racer) => {
        const onTrack = racer.vehicle.isOnSurface(this.track.isPointOnTrack);
        racer.vehicle.update(delta, onTrack);
      });

      this.resolveCollisions();

      this.racers.forEach((racer) => {
        const progress = this.track.getProgress(racer.vehicle.mesh.position);
        progress.onTrack = racer.vehicle.isOnSurface(this.track.isPointOnTrack);
        const progressUpdate = this.raceManager.updateRacerProgress(racer.id, progress);
        if (racer.id === this.playerId && progressUpdate.scoreEarned > 0) {
          this.hud.flashScore(progressUpdate.scoreEarned);
          this.scoreBurst.show(progressUpdate.scoreEarned, progressUpdate.lapCompleted);
        }
      });
    }

    if (!this.raceOver && this.raceManager.getRacerStatus(this.playerId)?.finished) this.finishRace();
    const leaderboard = this.raceManager.getLeaderboard();
    const playerStatus = this.raceManager.getRacerStatus(this.playerId);

    if (playerStatus && active && !this.raceOver) {
      this.banner.classList.toggle('off-road', !playerStatus.onTrack);
      this.banner.textContent = playerStatus.onTrack ? '' : '트랙 이탈 · 감속 중 (약 20 km/h)';
    }
    if (playerStatus) {
      const playerEntry = leaderboard.find((entry) => entry.id === this.playerId);
      const position = playerEntry ? playerEntry.position : 1;

      this.hud.update({
        speed: this.playerVehicle.getSpeedKph(),
        lap: playerStatus.lap,
        totalLaps: this.totalLaps,
        lapsRemaining: playerStatus.lapsRemaining,
        position,
        racerCount: leaderboard.length,
        progressPercent: playerStatus.progressPercent,
        checkpointIndex: playerStatus.checkpointIndex,
        checkpointCount: this.raceManager.getCheckpointCount(),
        offTrack: !playerStatus.onTrack,
        leaderboard: leaderboard.slice(0, 3).map((entry) => ({
          position: entry.position,
          name: entry.name,
          lap: entry.lap,
          progressPercent: entry.progressPercent,
          score: entry.score
        })),
        score: playerStatus.score,
        timeRemaining: this.remainingTime,
        raceOver: this.raceOver
      });
    }

    const minimapPoints: MiniMapPoint[] = this.racers.map((racer) => ({
      x: racer.vehicle.mesh.position.x,
      z: racer.vehicle.mesh.position.z,
      color: racer.vehicle.getBodyColorHex(),
      isPlayer: racer.id === this.playerId,
      heading: racer.vehicle.mesh.rotation.y,
      speed: racer.vehicle.getSpeedKph()
    }));
    this.miniMap.update(minimapPoints);

    this.sceneManager.follow(this.playerVehicle.mesh.position);
    this.updateCamera(delta);
    this.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    this.stats.end();
  };

  private resolveCollisions() {
    const count = this.racers.length;
    for (let i = 0; i < count; i++) {
      const vehicleA = this.racers[i].vehicle;
      for (let j = i + 1; j < count; j++) {
        const vehicleB = this.racers[j].vehicle;
        this.collisionVector
          .copy(vehicleB.mesh.position)
          .sub(vehicleA.mesh.position);

        this.collisionVector.y = 0;
        const distanceSq = this.collisionVector.lengthSq();
        if (distanceSq === 0) {
          continue;
        }

        const radiusSq = this.collisionRadius * this.collisionRadius;
        if (distanceSq >= radiusSq) {
          continue;
        }

        const distance = Math.sqrt(distanceSq);
        this.collisionVector.multiplyScalar(1 / distance);
        this.collisionOpposite.copy(this.collisionVector).multiplyScalar(-1);

        const penetration = (this.collisionRadius - distance) * 0.5;
        vehicleA.applyCollisionResponse(this.collisionOpposite, penetration);
        vehicleB.applyCollisionResponse(this.collisionVector, penetration);
      }
    }
  }

  private finishRace() {
    if (this.raceOver) {
      return;
    }

    this.raceOver = true;
    this.racers.forEach((racer) => racer.vehicle.halt());
    const finalStandings = this.raceManager.getLeaderboard();
    this.hud.showFinalResults(
      finalStandings.map((entry) => ({
        position: entry.position,
        name: entry.name,
        score: entry.score,
        lap: entry.lap
      }))
    );
  }

  private updateCamera(delta: number) {
    const { camera } = this.sceneManager;

    this.cameraTarget.copy(this.playerVehicle.mesh.position);
    this.cameraForward.copy(FORWARD_REFERENCE).applyQuaternion(this.playerVehicle.mesh.quaternion).normalize();
    this.cameraOffset.copy(this.cameraForward).multiplyScalar(-13);
    this.cameraOffset.y = 5.5;

    this.desiredCameraPosition.copy(this.cameraTarget).add(this.cameraOffset);
    const lerpFactor = 1 - Math.pow(0.12, delta * 60);
    camera.position.lerp(this.desiredCameraPosition, lerpFactor);
    camera.lookAt(this.cameraTarget);
  }

  private togglePause = () => {
    if (this.raceOver) return;
    this.paused = !this.paused;
    this.inputManager.clear();
    this.playerVehicle.setInput(this.inputManager.getState());
    this.banner.textContent = this.paused ? '일시정지' : '';
    const button = this.toolbar.querySelector('[data-action="pause"]');
    if (button) button.textContent = this.paused ? '계속하기' : '일시정지';
  };

  private recover = () => {
    if (this.raceOver || this.paused || this.countdown > 0) return;
    const progress = this.track.getProgress(this.playerVehicle.mesh.position);
    const position = this.track.getPointAtDistance(progress.distance).setY(0.4);
    const direction = this.track.getDirectionAtDistance(progress.distance);
    this.playerVehicle.halt();
    this.inputManager.clear();
    this.playerVehicle.setTransform(position, new Quaternion().setFromUnitVectors(FORWARD_REFERENCE, direction));
    this.remainingTime = Math.max(0, this.remainingTime - 3);
  };

  private handleCommand = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.code === 'KeyP' || event.code === 'Escape') this.togglePause();
    if (event.code === 'KeyR') this.recover();
  };

  private handleBlur = () => { if (!this.paused && !this.raceOver) this.togglePause(); };
  private handleVisibility = () => { if (document.hidden) this.handleBlur(); };

  private handleResize = () => {
    this.sceneManager.onResize();
    this.renderer.resize();
  };
}
