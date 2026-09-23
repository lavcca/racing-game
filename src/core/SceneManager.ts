import {
  AmbientLight,
  Color,
  Fog,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3
} from 'three';

export class SceneManager {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly root = new Group();
  private readonly sun = new DirectionalLight(0xfff2dd, 2.1);

  constructor(desert = false) {
    const sky = desert ? 0xcbd1cb : 0xa7c7dd;
    this.scene.background = new Color(sky);
    this.scene.fog = new Fog(sky, 750, 3200);
    this.scene.add(this.root);
    this.camera = new PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 6000);
    this.camera.position.set(0, 12, 24);
    this.camera.lookAt(new Vector3(0, 0, 0));

    const ambient = new AmbientLight(0xffffff, 0.65);
    const hemi = new HemisphereLight(0xc7e6ff, desert ? 0x9a7450 : 0x546b37, 0.9);

    const directional = this.sun;
    directional.position.set(160, 220, 140);
    directional.castShadow = true;
    directional.shadow.mapSize.set(1024, 1024);
    directional.shadow.camera.near = 10;
    directional.shadow.camera.far = 800;
    directional.shadow.camera.left = -150;
    directional.shadow.camera.right = 150;
    directional.shadow.camera.top = 150;
    directional.shadow.camera.bottom = -150;

    directional.shadow.normalBias = 0.06;
    this.scene.add(directional.target);
    this.scene.add(ambient);
    this.scene.add(hemi);
    this.scene.add(directional);
  }

  follow(position: Vector3) {
    this.sun.position.copy(position).add(new Vector3(160, 220, 140));
    this.sun.target.position.copy(position);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
