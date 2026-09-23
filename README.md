# APEX / Circuit Club — 저장소 기반 플레이 버전

원본: https://github.com/dante01yoon/codex-3d-racing-game-new

원본의 TypeScript / Three.js / Vite 구조, 차량·AI·트랙·점수 시스템을 기반으로 확장했습니다.

## 바로 실행

현재 작업 환경에서는 `./start.sh`를 실행하고 http://localhost:5173 으로 접속하세요.
스크립트는 Node.js가 PATH에 없으면 이 환경에 설치한 사용자용 Node.js를 사용합니다.
다른 환경에서는 Node.js 22 이상을 설치한 후 다음 명령을 사용하세요.

```sh
npm ci
npm run dev
```

## 플레이

- 도시와 사막 트랙 중 하나를 선택하면 3초 카운트다운 후 AI 3대와 출발합니다.
- 600초 제한 또는 플레이어 3랩 완주 시 결과를 표시합니다. 순위는 원본 규칙대로 점수 우선입니다.
- 순서대로 도로 위에서 통과한 체크포인트 +150점, 랩 완주 +500점.
- WASD / 방향키: 가속·감속/후진·조향. Space: 감속/후진.
- P / Escape: 일시정지. 다른 창으로 전환하면 자동 일시정지합니다.
- R / 트랙 복귀 버튼: 가까운 도로로 복귀, 남은 시간 3초 차감.
- 터치 기기에서는 화면 하단 조작 버튼이 표시됩니다.
- 결과의 다시 플레이 버튼 또는 상단 트랙 선택 버튼으로 새 게임을 시작합니다.

## 확장된 서킷과 도로 이탈 페널티

- 도시 5.56 km / 사막 5.83 km, 각 24개 체크포인트와 3랩 구성입니다.
- 도심 건물, 피트·차고, 관중석, 가드레일, 섹터 표지판, 주변 산악 지형을 배치했습니다.
- 커브와 긴 직선 구간을 새로 구성하고, 도로 길이에 맞춰 지면·카메라·그림자 범위를 확장했습니다.
- 바퀴가 도로 경계를 벗어나면 가속 중에도 약 20 km/h로 빠르게 감속합니다. 후진은 약 11 km/h입니다.
- 도로 밖에서는 출발 가속도도 낮아집니다. 도로로 돌아오면 정상 가속이 복원됩니다.
- AI 경쟁자는 플레이어보다 높은 최고속도와 가속도를 사용해 직선에서 적극적으로 압박합니다.
- 이탈 중 화면 중앙에 경고가 표시되고 체크포인트 점수를 얻을 수 없습니다.
- 반복되는 연석·가드레일·건물·산은 InstancedMesh로 묶어 렌더링합니다.
- 가로수, 가로등, 주황색 콘, 이동식 배리어를 도로 가장자리에 배치했습니다.
- 차량은 아케이드 물리이며, 산은 배경 지형입니다. 가드레일과 건물의 충돌 물리는 포함하지 않습니다.

## 커스텀 맵 모듈

맵은 `src/maps/`의 독립 모듈입니다. 새 맵은 `customMap.example.ts`를 복사해 `GameMap`을 정의하고, `src/maps/index.ts`에서 `registerMap(myMap)`을 호출하면 게임 시작 화면에 자동으로 카드가 추가됩니다. `trackConfig.controlPoints`, 폭, 체크포인트 수, `decorateScene`만으로 코스를 구성할 수 있습니다.

## 변경 및 검증

한국어 트랙 선택 화면, 트랙 미리보기, 출발선과 연석, 사막 지면 색상,
터치 조작, 카운트다운, 일시정지, 재시작, 복귀 기능을 추가했습니다.
역주행·체크포인트 왕복으로 점수가 중복되는 문제와 HUD 갱신 시 점수 효과가 사라지는 문제를 수정했습니다.

```sh
npm run build
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

이 작업 환경에서는 관리자 권한 없이 브라우저 라이브러리를 사용자 폴더에 설치했습니다.
브라우저 테스트 시 `LD_LIBRARY_PATH=/home/lavcca/.local/lib/racing-browser-deps/usr/lib/x86_64-linux-gnu`를 설정합니다.
`?debug` 쿼리를 붙이면 FPS 패널을 볼 수 있습니다.

---

# codex-3d-racing-game-new

A modern 3D racing game prototype built with TypeScript and Three.js. The project ships with a modular architecture that keeps core game systems (rendering, physics, input, UI) loosely coupled so you can iterate quickly.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server with hot reload:
   ```bash
   npm run dev
   ```
3. Build an optimized production bundle:
   ```bash
   npm run build
   ```
4. Preview the production build locally:
   ```bash
   npm run preview
   ```

## Project Goals

- Responsive vehicle controls (keyboard + gamepad)
- Modular track generation pipeline
- Expandable physics layer with future integration hooks for Ammo.js/Cannon.js
- Camera system that supports cinematic replays
- HUD overlays for race position, lap time, and speedometer
- AI opponents with configurable difficulty profiles

## Directory Structure

```
├── public/                # Static assets served as-is
├── src/
│   ├── assets/            # Textures, models, audio
│   ├── core/              # Game loop, scene setup, time step utilities
│   ├── game/              # Gameplay systems (vehicles, tracks, AI)
│   ├── input/             # Keyboard + gamepad mappings
│   ├── ui/                # HUD components and overlay management
│   ├── main.ts            # Entry point
│   └── vite-env.d.ts      # Vite type declarations
├── package.json
└── tsconfig.json
```

## Roadmap

- Flesh out vehicle handling using raycast suspension
- Implement spline-based track authoring tools
- Integrate audio manager (engine, skid, ambient soundscapes)
- Add post-processing pipeline (motion blur, bloom)
- Ship CI/CD via GitHub Actions for automated lint/build/test

## License

MIT
