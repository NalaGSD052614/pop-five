/* Synthesized sound effects via Web Audio API. No audio files needed. */

let ctx = null;
const getCtx = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
};

const isMuted = () => localStorage.getItem("pf_muted") === "1";
export const setMuted = (m) => localStorage.setItem("pf_muted", m ? "1" : "0");
export const getMuted = isMuted;

function tone({ freq = 440, type = "sine", dur = 0.15, vol = 0.2, delay = 0, slide = 0 }) {
  const ac = getCtx();
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sounds = {
  reveal() {
    if (isMuted()) return;
    tone({ freq: 520, type: "triangle", dur: 0.1, vol: 0.15 });
    tone({ freq: 700, type: "triangle", dur: 0.12, vol: 0.12, delay: 0.06 });
  },
  wrong() {
    if (isMuted()) return;
    tone({ freq: 220, type: "sawtooth", dur: 0.18, vol: 0.12, slide: -90 });
    tone({ freq: 160, type: "sawtooth", dur: 0.22, vol: 0.1, delay: 0.12, slide: -60 });
  },
  win() {
    if (isMuted()) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ freq: f, type: "triangle", dur: 0.22, vol: 0.18, delay: i * 0.1 })
    );
    tone({ freq: 1047, type: "sine", dur: 0.5, vol: 0.1, delay: 0.45 });
  },
  lose() {
    if (isMuted()) return;
    [392, 330, 262, 196].forEach((f, i) =>
      tone({ freq: f, type: "sawtooth", dur: 0.28, vol: 0.1, delay: i * 0.18, slide: -20 })
    );
  },
  click() {
    if (isMuted()) return;
    tone({ freq: 880, type: "sine", dur: 0.05, vol: 0.08 });
  },
  fanfareTick(i) {
    if (isMuted()) return;
    tone({ freq: 600 + i * 120, type: "square", dur: 0.06, vol: 0.06 });
  },
};
