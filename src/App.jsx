import React, { useState, useMemo, useEffect } from "react";
import { PUZZLES, LAUNCH_DATE } from "./puzzles.js";
import { sounds, getMuted, setMuted } from "./sounds.js";

const POINTS = [5, 4, 3, 2, 1];
const CATEGORY_META = {
  Movie: { icon: "🎬", color: "#FF5C8A" },
  Music: { icon: "🎵", color: "#4DD6C1" },
  Celebrity: { icon: "⭐", color: "#FFC940" },
  "TV Show": { icon: "📺", color: "#8C7BFF" },
};

const normalize = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ").trim();

function daysSinceLaunch() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - LAUNCH_DATE) / 86400000));
}

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

export default function App() {
  const dayNum = useMemo(() => daysSinceLaunch(), []);
  const puzzleNum = dayNum + 1;
  const dailyIndex = (dayNum * 17) % PUZZLES.length;

  const [name, setName] = useState(() => store.get("pf_name", ""));
  const [nameInput, setNameInput] = useState("");
  const [muted, setMutedState] = useState(getMuted());
  const [mode, setMode] = useState("daily");
  const [freeIndex, setFreeIndex] = useState(null);
  const [view, setView] = useState("game"); // game | board

  const savedResult = store.get(`pf_result_${puzzleNum}`, null);
  const [cluesShown, setCluesShown] = useState(savedResult ? savedResult.clues : 1);
  const [status, setStatus] = useState(savedResult ? (savedResult.pts > 0 ? "won" : "lost") : "playing");
  const [guess, setGuess] = useState("");
  const [guessLog, setGuessLog] = useState([]);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const [board, setBoard] = useState(null);
  const [boardErr, setBoardErr] = useState(false);

  const streak = store.get("pf_streak", 0);
  const maxStreak = store.get("pf_max_streak", 0);
  const totalPts = store.get("pf_total_pts", 0);
  const played = store.get("pf_played", 0);

  const puzzle = mode === "daily" ? PUZZLES[dailyIndex] : PUZZLES[freeIndex];
  const meta = CATEGORY_META[puzzle.category];

  const toggleMute = () => { const m = !muted; setMutedState(m); setMuted(m); };

  const fetchBoard = async () => {
    try {
      const res = await fetch(`/api/leaderboard?puzzle=${puzzleNum}`);
      if (!res.ok) throw new Error();
      setBoard(await res.json());
      setBoardErr(false);
    } catch { setBoardErr(true); }
  };

  useEffect(() => { fetchBoard(); }, []);

  const submitScore = async (pts, clues) => {
    if (!name) return;
    try {
      await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzle: puzzleNum, name, pts, clues }),
      });
      fetchBoard();
    } catch {}
  };

  const finishDaily = (won, clues) => {
    const pts = won ? POINTS[clues - 1] : 0;
    store.set(`pf_result_${puzzleNum}`, { pts, clues });
    store.set("pf_total_pts", totalPts + pts);
    store.set("pf_played", played + 1);
    const lastWin = store.get("pf_last_win_puzzle", 0);
    if (won) {
      const newStreak = lastWin === puzzleNum - 1 ? streak + 1 : 1;
      store.set("pf_streak", newStreak);
      store.set("pf_last_win_puzzle", puzzleNum);
      if (newStreak > maxStreak) store.set("pf_max_streak", newStreak);
    } else {
      store.set("pf_streak", 0);
    }
    submitScore(pts, clues);
  };

  const submitGuess = () => {
    if (!guess.trim() || status !== "playing") return;
    const g = normalize(guess);
    const correct = puzzle.accept.some((a) => normalize(a) === g);
    setGuessLog((l) => [...l, guess.trim()]);
    if (correct) {
      sounds.win();
      setStatus("won");
      if (mode === "daily") finishDaily(true, cluesShown);
    } else {
      sounds.wrong();
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 500);
      if (cluesShown >= 5) {
        sounds.lose();
        setStatus("lost");
        if (mode === "daily") finishDaily(false, 5);
      } else setCluesShown((c) => c + 1);
    }
    setGuess("");
  };

  const revealNext = () => {
    if (status !== "playing") return;
    if (cluesShown >= 5) {
      sounds.lose();
      setStatus("lost");
      if (mode === "daily") finishDaily(false, 5);
    } else {
      sounds.reveal();
      setCluesShown((c) => c + 1);
    }
  };

  const startFreePlay = () => {
    sounds.click();
    let idx = Math.floor(Math.random() * PUZZLES.length);
    if (idx === dailyIndex) idx = (idx + 1) % PUZZLES.length;
    setMode("free"); setFreeIndex(idx); setCluesShown(1);
    setStatus("playing"); setGuess(""); setGuessLog([]); setCopied(false);
    setView("game");
  };

  const shareText = () => {
    const r = mode === "daily" && savedResult ? savedResult : { pts: status === "won" ? POINTS[cluesShown - 1] : 0, clues: cluesShown };
    const solvedAt = r.pts > 0 ? r.clues : null;
    const row = [1, 2, 3, 4, 5]
      .map((n) => (solvedAt && n === solvedAt ? "🟩" : n <= r.clues ? "🟨" : "⬜")).join("");
    return `POP FIVE #${puzzleNum} ${meta.icon}\n${row} ${r.pts}/5 pts\n${window.location.origin}`;
  };

  const copyShare = async () => {
    sounds.click();
    try { await navigator.clipboard.writeText(shareText()); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = shareText(); document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const saveName = () => {
    const n = nameInput.trim().slice(0, 20);
    if (!n) return;
    sounds.click();
    store.set("pf_name", n);
    setName(n);
  };

  /* ---------- styles ---------- */
  const S = {
    page: { minHeight: "100vh", background: "#14122B", fontFamily: "'Archivo', sans-serif", color: "#FFF6E3", padding: "0 16px 48px" },
    wrap: { maxWidth: 560, margin: "0 auto" },
    btn: (bg, fg, extra = {}) => ({ padding: "13px 24px", fontSize: 15, fontWeight: 800, borderRadius: 10, border: "none", background: bg, color: fg, cursor: "pointer", fontFamily: "inherit", ...extra }),
    ghostBtn: { padding: "11px 18px", fontSize: 14, fontWeight: 600, borderRadius: 10, border: "1px solid #3B3566", background: "transparent", color: "#B8B3DC", cursor: "pointer", fontFamily: "inherit" },
  };

  if (!name) {
    return (
      <div style={S.page}>
        <GlobalCss />
        <div style={{ ...S.wrap, paddingTop: 80, textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Bungee', cursive", fontSize: 48, margin: 0, color: "#FFC940", textShadow: "0 0 24px rgba(255,201,64,.35), 3px 3px 0 #FF5C8A" }}>POP FIVE</h1>
          <p style={{ color: "#B8B3DC", fontWeight: 600, marginBottom: 32 }}>Five clues. One icon. A new mystery every day.</p>
          <div style={{ background: "#221D45", border: "1px solid #3B3566", borderRadius: 14, padding: 24 }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Pick a player name for the leaderboard</div>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="e.g. John from New Lenox"
              maxLength={20}
              aria-label="Player name"
              style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", fontSize: 16, borderRadius: 10, border: "2px solid #3B3566", background: "#1B1738", color: "#FFF6E3", fontFamily: "inherit", marginBottom: 14 }}
            />
            <button onClick={saveName} style={S.btn("#FFC940", "#14122B", { width: "100%" })}>Let's play</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <GlobalCss />
      <div style={S.wrap}>
        <header style={{ textAlign: "center", padding: "28px 0 4px", position: "relative" }}>
          <button onClick={toggleMute} aria-label={muted ? "Unmute sounds" : "Mute sounds"} style={{ position: "absolute", right: 0, top: 30, background: "transparent", border: "1px solid #3B3566", borderRadius: 8, color: "#B8B3DC", padding: "6px 10px", cursor: "pointer", fontSize: 16 }}>
            {muted ? "🔇" : "🔊"}
          </button>
          <h1 style={{ fontFamily: "'Bungee', cursive", fontSize: "clamp(34px, 9vw, 50px)", margin: 0, letterSpacing: 2, color: "#FFC940", textShadow: "0 0 24px rgba(255,201,64,.35), 3px 3px 0 #FF5C8A" }}>POP FIVE</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#B8B3DC", fontWeight: 600 }}>
            {mode === "daily" ? `Daily Puzzle #${puzzleNum}` : "Free Play"} · Hey, {name}
          </p>
        </header>

        {/* Stats strip */}
        <div style={{ display: "flex", justifyContent: "center", gap: 18, padding: "14px 0 18px", fontSize: 13, fontWeight: 700, color: "#B8B3DC", flexWrap: "wrap" }}>
          <span>🔥 Streak {streak}</span>
          <span>🏆 Best {maxStreak}</span>
          <span style={{ color: "#FFC940" }}>★ {totalPts} pts</span>
          <button onClick={() => { sounds.click(); setView(view === "game" ? "board" : "game"); if (view === "game") fetchBoard(); }} style={{ background: "transparent", border: "none", color: "#4DD6C1", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: 0 }}>
            {view === "game" ? "Leaderboard →" : "← Back to game"}
          </button>
        </div>

        {view === "board" ? (
          <Leaderboard board={board} err={boardErr} puzzleNum={puzzleNum} myName={name} onRefresh={fetchBoard} />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ background: meta.color, color: "#14122B", fontWeight: 800, fontSize: 13, padding: "6px 14px", borderRadius: 999, letterSpacing: 1, textTransform: "uppercase" }}>
                {meta.icon} {puzzle.category}
              </span>
              <div style={{ display: "flex", gap: 8 }} aria-label={`${POINTS[Math.min(cluesShown, 5) - 1]} points available`}>
                {POINTS.map((p, i) => {
                  const lit = status === "playing" ? i >= cluesShown - 1 : false;
                  const wonHere = status === "won" && i === cluesShown - 1;
                  return (
                    <div key={p} style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: wonHere ? "#4DD6C1" : lit ? "#FFC940" : "#2E2952",
                      border: "2px solid " + (wonHere ? "#4DD6C1" : lit ? "#FFD96B" : "#3B3566"),
                      animation: lit && i === cluesShown - 1 ? "bulbPulse 1.6s infinite" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 800, color: lit || wonHere ? "#14122B" : "#55507A",
                    }}>{p}</div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {puzzle.clues.slice(0, cluesShown).map((clue, i) => (
                <div key={i} style={{ background: "#221D45", border: "1px solid #3B3566", borderLeft: `5px solid ${meta.color}`, borderRadius: 10, padding: "14px 16px", animation: "slideIn .35s ease" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: 1.5, marginBottom: 4 }}>CLUE {i + 1}</div>
                  <div style={{ fontSize: 16, lineHeight: 1.45 }}>{clue}</div>
                </div>
              ))}
            </div>

            {status === "playing" ? (
              <div style={{ animation: wrongFlash ? "shake .45s" : "none" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitGuess()}
                    placeholder="Who or what is it?"
                    aria-label="Your guess"
                    style={{ flex: 1, minWidth: 0, padding: "14px 16px", fontSize: 16, borderRadius: 10, border: wrongFlash ? "2px solid #FF5C8A" : "2px solid #3B3566", background: "#1B1738", color: "#FFF6E3", fontFamily: "inherit" }}
                  />
                  <button onClick={submitGuess} style={S.btn("#FFC940", "#14122B")}>Guess</button>
                </div>
                <button onClick={revealNext} style={{ ...S.ghostBtn, marginTop: 10, width: "100%" }}>
                  {cluesShown < 5 ? `Reveal next clue (drops to ${POINTS[cluesShown]} pts)` : "Give up and reveal answer"}
                </button>
                {guessLog.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 13, color: "#807AA8" }}>Wrong so far: {guessLog.join(", ")}</div>
                )}
              </div>
            ) : (
              <div style={{
                background: status === "won" ? "rgba(77,214,193,.08)" : "rgba(255,92,138,.08)",
                border: `2px solid ${status === "won" ? "#4DD6C1" : "#FF5C8A"}`,
                borderRadius: 14, padding: "22px 20px", textAlign: "center", animation: "slideIn .35s ease",
              }}>
                <div style={{ fontFamily: "'Bungee', cursive", fontSize: 22, color: status === "won" ? "#4DD6C1" : "#FF5C8A", marginBottom: 6 }}>
                  {status === "won" ? "NAILED IT!" : "STUMPED!"}
                </div>
                <div style={{ fontSize: 17, marginBottom: 4 }}>
                  The answer was <strong style={{ color: "#FFC940" }}>{puzzle.answer}</strong>
                </div>
                <div style={{ fontSize: 14, color: "#B8B3DC", marginBottom: 14 }}>
                  {status === "won" ? `Solved on clue ${cluesShown} for ${POINTS[cluesShown - 1]} points` : "Zero points this round"}
                </div>
                {mode === "daily" && (
                  <div style={{ fontSize: 16, letterSpacing: 1.5, marginBottom: 16, fontFamily: "monospace", whiteSpace: "pre-line" }}>{shareText()}</div>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  {mode === "daily" && (
                    <button onClick={copyShare} style={S.btn(copied ? "#4DD6C1" : "#FFC940", "#14122B")}>
                      {copied ? "Copied! ✓" : "Copy result to share"}
                    </button>
                  )}
                  <button onClick={startFreePlay} style={mode === "daily" ? S.ghostBtn : S.btn("#FFC940", "#14122B")}>
                    {mode === "daily" ? "Keep playing (free play)" : "Next puzzle →"}
                  </button>
                </div>
                {mode === "daily" && (
                  <div style={{ marginTop: 14, fontSize: 12, color: "#807AA8" }}>New daily puzzle drops at midnight</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Leaderboard({ board, err, puzzleNum, myName, onRefresh }) {
  if (err) {
    return (
      <div style={{ background: "#221D45", border: "1px solid #3B3566", borderRadius: 14, padding: 24, textAlign: "center", color: "#B8B3DC" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Leaderboard not connected yet</div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          This appears once the Upstash Redis database is linked in Vercel. See the README for the two minute setup.
        </div>
      </div>
    );
  }
  if (!board) return <div style={{ textAlign: "center", color: "#807AA8", padding: 30 }}>Loading scores…</div>;

  const Section = ({ title, rows, ptsLabel }) => (
    <div style={{ background: "#221D45", border: "1px solid #3B3566", borderRadius: 14, padding: "18px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: "#807AA8", marginBottom: 12 }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ color: "#807AA8", fontSize: 14 }}>No scores yet. Be the first!</div>
      ) : rows.map((r, i) => (
        <div key={r.name} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "9px 10px", borderRadius: 8, marginBottom: 4,
          background: r.name === myName ? "rgba(255,201,64,.1)" : "transparent",
          border: r.name === myName ? "1px solid rgba(255,201,64,.4)" : "1px solid transparent",
        }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            <span style={{ color: "#807AA8", marginRight: 10, fontSize: 13 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
            {r.name}
          </span>
          <span style={{ color: "#FFC940", fontWeight: 800, fontSize: 14 }}>{r.pts} {ptsLabel}{r.clues ? ` · clue ${r.clues}` : ""}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <Section title={`TODAY · PUZZLE #${puzzleNum}`} rows={board.today} ptsLabel="pts" />
      <Section title="ALL TIME" rows={board.allTime} ptsLabel="total" />
      <button onClick={onRefresh} style={{ width: "100%", padding: 11, fontSize: 14, fontWeight: 600, borderRadius: 10, border: "1px solid #3B3566", background: "transparent", color: "#B8B3DC", cursor: "pointer", fontFamily: "inherit" }}>
        Refresh scores
      </button>
    </div>
  );
}

function GlobalCss() {
  return (
    <style>{`
      @keyframes bulbPulse { 0%,100% { box-shadow: 0 0 8px 2px rgba(255,201,64,.7);} 50% { box-shadow: 0 0 14px 4px rgba(255,201,64,.95);} }
      @keyframes slideIn { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: translateY(0);} }
      @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      input:focus, button:focus-visible { outline: 3px solid #FFC940; outline-offset: 2px; }
      body { background: #14122B; }
    `}</style>
  );
}
