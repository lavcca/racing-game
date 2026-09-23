import type { InputState } from '../game/Vehicle';

const mapping: Record<string, keyof InputState> = {
  ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'backward', KeyS: 'backward',
  Space: 'backward', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
};

export class InputManager {
  private readonly pressed = new Set<string>();
  private readonly listeners: Array<(state: InputState) => void> = [];
  private readonly touch = document.createElement('div');

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clear);
    this.touch.className = 'touch-controls';
    for (const [code, label] of [['ArrowLeft', '◀'], ['ArrowRight', '▶'], ['Space', '감속'], ['ArrowUp', '가속']]) {
      const button = document.createElement('button');
      button.textContent = label;
      button.setAttribute('aria-label', label === '◀' ? '좌회전' : label === '▶' ? '우회전' : label);
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault(); button.setPointerCapture(event.pointerId);
        this.pressed.add(`touch:${code}`); this.broadcast();
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(type, () => { this.pressed.delete(`touch:${code}`); this.broadcast(); });
      }
      this.touch.appendChild(button);
    }
    document.body.appendChild(this.touch);
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clear);
    this.touch.remove(); this.listeners.length = 0;
  }

  subscribe(listener: (state: InputState) => void) { this.listeners.push(listener); }
  clear = () => { this.pressed.clear(); this.broadcast(); };

  getState(): InputState {
    const state = { forward: false, backward: false, left: false, right: false };
    for (const code of this.pressed) {
      const action = mapping[code.replace('touch:', '')];
      if (action) state[action] = true;
    }
    return state;
  }

  private broadcast() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (!mapping[event.code]) return;
    event.preventDefault(); this.pressed.add(event.code); this.broadcast();
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    if (!mapping[event.code]) return;
    event.preventDefault(); this.pressed.delete(event.code); this.broadcast();
  };
}
