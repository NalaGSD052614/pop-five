/* Vercel serverless function: shared leaderboard backed by Upstash Redis.
   Works with either the Upstash integration env vars or Vercel KV env vars. */

const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(command) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  const data = await res.json();
  return data.result;
}

function hashToPairs(flat) {
  // Upstash returns HGETALL as a flat array [field, value, field, value, ...]
  const out = [];
  if (!Array.isArray(flat)) return out;
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
  return out;
}

const cleanName = (n) =>
  String(n || "").trim().slice(0, 20).replace(/[<>]/g, "");

export default async function handler(req, res) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({ error: "Leaderboard database not configured" });
  }

  try {
    if (req.method === "GET") {
      const puzzle = parseInt(req.query.puzzle, 10);
      if (!Number.isFinite(puzzle) || puzzle < 1 || puzzle > 100000) {
        return res.status(400).json({ error: "Invalid puzzle number" });
      }

      const [todayFlat, totalFlat] = await Promise.all([
        redis(["HGETALL", `pf:day:${puzzle}`]),
        redis(["HGETALL", "pf:total"]),
      ]);

      const today = hashToPairs(todayFlat)
        .map(([name, json]) => {
          try { const v = JSON.parse(json); return { name, pts: v.pts, clues: v.clues }; }
          catch { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => b.pts - a.pts || a.clues - b.clues)
        .slice(0, 50);

      const allTime = hashToPairs(totalFlat)
        .map(([name, pts]) => ({ name, pts: parseInt(pts, 10) || 0 }))
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 50);

      return res.status(200).json({ today, allTime });
    }

    if (req.method === "POST") {
      const { puzzle, name, pts, clues } = req.body || {};
      const p = parseInt(puzzle, 10);
      const n = cleanName(name);
      const score = parseInt(pts, 10);
      const c = parseInt(clues, 10);

      if (!n) return res.status(400).json({ error: "Name required" });
      if (!Number.isFinite(p) || p < 1 || p > 100000) return res.status(400).json({ error: "Invalid puzzle" });
      if (!Number.isFinite(score) || score < 0 || score > 5) return res.status(400).json({ error: "Invalid score" });
      if (!Number.isFinite(c) || c < 1 || c > 5) return res.status(400).json({ error: "Invalid clues" });

      // HSETNX = only the first submission per name per day counts. No retry sniping.
      const wasSet = await redis([
        "HSETNX", `pf:day:${p}`, n, JSON.stringify({ pts: score, clues: c }),
      ]);

      if (wasSet === 1 && score > 0) {
        await redis(["HINCRBY", "pf:total", n, String(score)]);
      }

      return res.status(200).json({ ok: true, recorded: wasSet === 1 });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
