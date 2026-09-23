import { ScoreTicker } from './ScoreTicker';

interface HudLeaderboardRow {
  position: number;
  name: string;
  lap: number;
  progressPercent: number;
  score: number;
}

interface FinalResultRow {
  position: number;
  name: string;
  score: number;
  lap: number;
}

interface HudState {
  speed: number;
  lap: number;
  totalLaps: number;
  lapsRemaining: number;
  position: number;
  racerCount: number;
  progressPercent: number;
  checkpointIndex: number;
  checkpointCount: number;
  offTrack: boolean;
  leaderboard: HudLeaderboardRow[];
  score: number;
  timeRemaining: number;
  raceOver: boolean;
}

const formatTime = (seconds: number) => {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const millis = Math.floor((clamped % 1) * 1000);
  const paddedSecs = secs.toString().padStart(2, '0');
  const paddedMillis = Math.floor(millis / 10)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${paddedSecs}.${paddedMillis}`;
};

export class Hud {
  private readonly container: HTMLDivElement;
  private readonly ticker: ScoreTicker;
  private readonly content = document.createElement('div');
  private readonly finalOverlay: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.right = '24px';
    this.container.style.bottom = '24px';
    this.container.style.padding = '18px 20px';
    this.container.style.background = 'rgba(0, 0, 0, 0.45)';
    this.container.style.color = '#fff';
    this.container.style.fontFamily = 'system-ui, sans-serif';
    this.container.style.fontSize = '14px';
    this.container.style.borderRadius = '12px';
    this.container.style.pointerEvents = 'none';
    this.container.style.backdropFilter = 'blur(6px)';
    this.container.style.minWidth = '240px';
    this.container.style.lineHeight = '1.55';
    this.container.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.35)';

    document.body.appendChild(this.container);

    this.container.className = 'race-hud';
    const profiles = document.createElement('div');
    profiles.className = 'driver-profiles';
    profiles.innerHTML = '<div class="driver-profile player-profile"><img src="/avatars/player-profile.jpg" alt="플레이어 프로필"><span><b>YOU</b><small>PLAYER</small></span></div><div class="driver-profile rival-profile"><img src="/avatars/rival-profile.jpg" alt="경쟁자 프로필"><span><b>RIVAL</b><small>AI PACK</small></span></div>';
    this.container.appendChild(profiles);
    this.container.appendChild(this.content);
    this.ticker = new ScoreTicker(this.container);

    this.finalOverlay = document.createElement('div');
    this.finalOverlay.style.position = 'fixed';
    this.finalOverlay.style.left = '0';
    this.finalOverlay.style.top = '0';
    this.finalOverlay.style.width = '100%';
    this.finalOverlay.style.height = '100%';
    this.finalOverlay.style.display = 'none';
    this.finalOverlay.style.alignItems = 'center';
    this.finalOverlay.style.justifyContent = 'center';
    this.finalOverlay.style.flexDirection = 'column';
    this.finalOverlay.style.color = '#fff';
    this.finalOverlay.style.background = 'rgba(5, 5, 12, 0.82)';
    this.finalOverlay.style.fontFamily = 'system-ui, sans-serif';
    this.finalOverlay.style.zIndex = '1000';
    this.finalOverlay.style.textAlign = 'center';

    document.body.appendChild(this.finalOverlay);
  }

  update(state: HudState) {
    const roundedSpeed = Math.round(state.speed);
    const progress = state.progressPercent.toFixed(1);
    const checkpointDisplay = `${state.checkpointIndex + 1} / ${state.checkpointCount}`;
    const timeDisplay = formatTime(state.timeRemaining);

    const lines = [
      `<strong>남은 시간:</strong> ${timeDisplay}`,
      `<strong>점수:</strong> ${state.score}`,
      `<strong>속도:</strong> ${roundedSpeed} km/h`,
      `<strong>랩:</strong> ${state.lap} / ${state.totalLaps} (left: ${state.lapsRemaining})`,
      `<strong>진행률:</strong> ${progress}%`,
      `<strong>체크포인트:</strong> ${checkpointDisplay}`,
      `<strong>순위:</strong> ${state.position} / ${state.racerCount}`
    ];

    if (state.offTrack && !state.raceOver) {
      lines.push('<em>트랙 이탈 · R 키로 복귀</em>');
    }

    if (state.raceOver) {
      lines.push('<br /><strong>레이스 종료</strong>');
    }

    if (state.leaderboard.length > 0) {
      const leaderboardLines = state.leaderboard
        .map(
          (entry) =>
            `${entry.position}. ${entry.name} — ${entry.score.toLocaleString()} pts (Lap ${entry.lap}, ${entry.progressPercent.toFixed(
              1
            )}%)`
        )
        .join('<br />');

      lines.push('<br /><strong>실시간 순위</strong>');
      lines.push(leaderboardLines);
    }

    this.content.innerHTML = lines.join('<br />');
  }

  flashScore(amount: number) {
    this.ticker.flash(amount);
  }

  showFinalResults(rows: FinalResultRow[]) {
    const list = rows
      .map(
        (row) =>
          `<li style="margin:6px 0; font-size:18px; list-style:none;">${row.position}. <strong>${row.name}</strong> — ${row.score.toLocaleString()} pts (Lap ${row.lap})</li>`
      )
      .join('');

    this.finalOverlay.innerHTML = `
      <div style="padding:32px 48px; background:rgba(0, 0, 0, 0.65); border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,0.45); max-width:480px;">
        <h2 style="margin:0 0 12px; font-size:32px;">레이스 결과</h2>
        <p style="margin:0 0 16px; color:#d1d1ff;">체크포인트와 랩 점수를 합산한 결과입니다.</p>
        <ol style="margin:0; padding:0;">${list}</ol>
        <button class="primary" onclick="location.reload()">다시 플레이 · 트랙 선택</button>
      </div>
    `;
    this.finalOverlay.style.display = 'flex';
  }

  dispose() {
    this.ticker.dispose();
    this.container.remove();
    this.finalOverlay.remove();
  }
}
