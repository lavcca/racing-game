import './styles.css';

import { CatmullRomCurve3, Vector3 } from 'three';

import { GameWorld } from './game/GameWorld';
import { DEFAULT_CONTROL_POINTS } from './game/Track';
import { availableMaps } from './maps';
import type { GameMap } from './maps/types';

const mount = document.getElementById('app');
if (!mount) throw new Error('게임 화면을 찾을 수 없습니다.');
let world: GameWorld | null = null;

function preview(map: GameMap) {
  const controlPoints = (map.trackConfig.controlPoints ?? DEFAULT_CONTROL_POINTS).map(p => new Vector3(p.x, p.y ?? 0, p.z));
  const points = new CatmullRomCurve3(controlPoints, true).getPoints(100);
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
  const scale = Math.min(270 / (maxX - minX), 210 / (maxZ - minZ));
  const x = (p: Vector3) => 160 + (p.x - (minX + maxX) / 2) * scale;
  const z = (p: Vector3) => 130 + (p.z - (minZ + maxZ) / 2) * scale;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p)},${z(p)}`).join(' ') + ' Z';
  return `<svg viewBox="0 0 320 260" aria-hidden="true"><defs><pattern id="grid-${map.id}" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" opacity=".06"/></pattern></defs><rect width="320" height="260" fill="url(#grid-${map.id})"/><path d="${path}" fill="none" stroke="currentColor" stroke-width="18" opacity=".08"/><path d="${path}" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="${x(points[0])}" cy="${z(points[0])}" r="6" fill="white"/></svg>`;
}

const selection = document.createElement('section');
selection.className = 'selection';
selection.innerHTML = `<header class="menu-header"><b>APEX<span> / CIRCUIT CLUB</span></b><span>THREE.JS RACING EXPERIENCE</span></header><div class="menu-title"><span class="eyebrow">01 / SELECT YOUR CIRCUIT</span><h1>당신의 레이스를<br><em>시작하세요.</em></h1><p>두 개의 서킷, 세 명의 라이벌. 다음 코너를 지배하세요.</p></div><div class="profile-preview"><div><img src="/avatars/player-profile.jpg" alt="플레이어 프로필"><span>내 차 / PLAYER</span></div><div><img src="/avatars/rival-profile.jpg" alt="경쟁자 프로필"><span>경쟁자 / AI RIVAL</span></div></div><div class="circuits"></div><footer class="menu-footer"><span>3 LAPS <i> / </i> 600 SECONDS <i> / </i> 4 DRIVERS</span><p>WASD / 방향키 주행 · SPACE 감속 · R 복귀 (−3초) · P 일시정지<br>체크포인트 +150 · 랩 완주 +500 · 제한 시간 내 점수 경쟁</p></footer>`;
const names = ['네온 시티 서킷', '듄 스프린트'];
const descriptions = ['긴 직선과 시케인, 피트와 관중석을 갖춘 도심 그랑프리', '협곡과 산악 지형을 배경으로 달리는 장거리 사막 서킷'];
availableMaps.forEach((map, index) => {
  const circuitCurve = new CatmullRomCurve3((map.trackConfig.controlPoints ?? DEFAULT_CONTROL_POINTS).map(p => new Vector3(p.x, p.y ?? 0, p.z)), true);
  circuitCurve.arcLengthDivisions = 2048;
  const kilometers = (circuitCurve.getLength() / 1000).toFixed(2);
  const card = document.createElement('button');
  card.type = 'button'; card.className = `circuit-card ${index ? 'desert' : 'city'}`;
  card.innerHTML = `<div class="card-top"><span>0${index + 1} / ${index ? 'DESERT' : 'CITY'}</span><span>↗</span></div>${preview(map)}<div class="card-info"><small>${map.name.toUpperCase()}</small><h2>${names[index] ?? map.name}</h2><p>${descriptions[index] ?? map.description}</p><div class="card-bottom"><span>${kilometers} KM / ${map.trackConfig.checkpointCount} CP</span><b>레이스 시작 →</b></div></div>`;
  card.addEventListener('click', () => {
    try {
      world?.dispose(); world = null;
      mount.replaceChildren();
      const canvas = document.createElement('canvas'); canvas.id = 'game-canvas'; mount.appendChild(canvas);
      world = new GameWorld(canvas, map); world.initialize(); world.start(); selection.remove();
    } catch (error) {
      console.error(error);
      world?.dispose(); world = null;
      let message = selection.querySelector('.error');
      if (!message) { message = document.createElement('p'); message.className = 'error'; message.setAttribute('role', 'alert'); selection.appendChild(message); }
      message.textContent = '게임 실행에 실패했습니다. WebGL 지원 브라우저에서 하드웨어 가속을 켜고 다시 시도해 주세요.';
    }
  });
  selection.querySelector('.circuits')?.appendChild(card);
});
document.body.appendChild(selection);

if (import.meta.hot) {
  import.meta.hot.dispose(() => { world?.dispose(); world = null; selection.remove(); mount.replaceChildren(); });
}
