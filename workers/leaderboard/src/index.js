const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400"
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8"
  }
});

const cleanName = (name) => String(name || "").trim().replace(/\s+/g, " ").slice(0, 18);
const normalizeName = (name) => cleanName(name).toLowerCase();
const clampInt = (value, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function token(size = 24) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (err) {
    return null;
  }
}

async function createSession(env, playerId) {
  const sessionToken = token(32);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token, player_id, expires_at) VALUES (?, ?, ?)"
  ).bind(sessionToken, playerId, expires).run();
  return sessionToken;
}

async function authPlayer(env, request) {
  const header = request.headers.get("Authorization") || "";
  const sessionToken = header.replace(/^Bearer\s+/i, "").trim();
  if (!sessionToken) return null;
  return env.DB.prepare(`
    SELECT p.id, p.username
    FROM sessions s
    JOIN players p ON p.id = s.player_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).bind(sessionToken).first();
}

async function playerPayload(env, player, sessionToken = null) {
  const score = await env.DB.prepare("SELECT * FROM scores WHERE player_id = ?").bind(player.id).first();
  return {
    token: sessionToken || undefined,
    player: { id: player.id, username: player.username },
    score: {
      plays: score?.plays || 0,
      bestLevel: score?.best_level || 1,
      bestWave: score?.best_wave || 0,
      mapsCleared: score?.maps_cleared || 0,
      kills: score?.kills || 0,
      bestCombo: score?.best_combo || 0,
      gold: score?.gold || 0,
      bosses: score?.bosses || 0,
      objectivesCompleted: score?.objectives_completed || 0
    }
  };
}

async function register(env, request) {
  const body = await readJson(request);
  const username = cleanName(body?.username);
  const usernameNorm = normalizeName(username);
  const password = String(body?.password || "");
  if (username.length < 3) return json({ error: "Username needs at least 3 characters." }, 400);
  if (password.length < 4) return json({ error: "Password needs at least 4 characters." }, 400);

  const existing = await env.DB.prepare("SELECT id FROM players WHERE username_norm = ?").bind(usernameNorm).first();
  if (existing) return json({ error: "That username is already taken." }, 409);

  const id = crypto.randomUUID();
  const salt = token(16);
  const passwordHash = await sha256(`${salt}:${password}`);
  await env.DB.prepare(`
    INSERT INTO players (id, username, username_norm, password_hash, salt)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, username, usernameNorm, passwordHash, salt).run();
  await env.DB.prepare("INSERT INTO scores (player_id) VALUES (?)").bind(id).run();

  const sessionToken = await createSession(env, id);
  return json(await playerPayload(env, { id, username }, sessionToken), 201);
}

async function login(env, request) {
  const body = await readJson(request);
  const usernameNorm = normalizeName(body?.username);
  const password = String(body?.password || "");
  const player = await env.DB.prepare("SELECT * FROM players WHERE username_norm = ?").bind(usernameNorm).first();
  if (!player) return json({ error: "Pilot not found." }, 404);
  const passwordHash = await sha256(`${player.salt}:${password}`);
  if (passwordHash !== player.password_hash) return json({ error: "Wrong password." }, 401);
  const sessionToken = await createSession(env, player.id);
  return json(await playerPayload(env, player, sessionToken));
}

async function saveScore(env, request) {
  const player = await authPlayer(env, request);
  if (!player) return json({ error: "Login required." }, 401);
  const body = await readJson(request);
  const plays = clampInt(body?.plays, 0, 1000000);
  const bestLevel = clampInt(body?.bestLevel, 1, 9999);
  const bestWave = clampInt(body?.bestWave, 0, 9999);
  const mapsCleared = clampInt(body?.mapsCleared, 0, 1000000);
  const kills = clampInt(body?.kills, 0, 1000000000);
  const bestCombo = clampInt(body?.bestCombo, 0, 1000000);
  const gold = clampInt(body?.gold, 0, 1000000000);
  const bosses = clampInt(body?.bosses, 0, 1000000);
  const objectivesCompleted = clampInt(body?.objectivesCompleted, 0, 1000000);

  await env.DB.prepare(`
    INSERT INTO scores (player_id, plays, best_level, best_wave, maps_cleared, kills, best_combo, gold, bosses, objectives_completed, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(player_id) DO UPDATE SET
      plays = MAX(scores.plays, excluded.plays),
      best_level = MAX(scores.best_level, excluded.best_level),
      best_wave = MAX(scores.best_wave, excluded.best_wave),
      maps_cleared = MAX(scores.maps_cleared, excluded.maps_cleared),
      kills = MAX(scores.kills, excluded.kills),
      best_combo = MAX(scores.best_combo, excluded.best_combo),
      gold = MAX(scores.gold, excluded.gold),
      bosses = MAX(scores.bosses, excluded.bosses),
      objectives_completed = MAX(scores.objectives_completed, excluded.objectives_completed),
      updated_at = CURRENT_TIMESTAMP
  `).bind(player.id, plays, bestLevel, bestWave, mapsCleared, kills, bestCombo, gold, bosses, objectivesCompleted).run();

  return json(await playerPayload(env, player));
}

async function leaderboard(env) {
  const rows = await env.DB.prepare(`
    SELECT p.id, p.username, s.plays, s.best_level, s.best_wave, s.maps_cleared, s.kills, s.best_combo, s.gold, s.bosses, s.objectives_completed, s.updated_at
    FROM scores s
    JOIN players p ON p.id = s.player_id
    ORDER BY s.best_level DESC, s.best_wave DESC, s.maps_cleared DESC, s.kills DESC, s.best_combo DESC, s.gold DESC, s.updated_at DESC
    LIMIT 25
  `).all();
  return json({
    leaderboard: (rows.results || []).map((row) => ({
      id: row.id,
      name: row.username,
      plays: row.plays,
      bestLevel: row.best_level,
      bestWave: row.best_wave,
      mapsCleared: row.maps_cleared,
      kills: row.kills,
      bestCombo: row.best_combo,
      gold: row.gold,
      bosses: row.bosses,
      objectivesCompleted: row.objectives_completed,
      updatedAt: row.updated_at
    }))
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    const url = new URL(request.url);
    try {
      if (request.method === "POST" && url.pathname === "/api/register") return register(env, request);
      if (request.method === "POST" && url.pathname === "/api/login") return login(env, request);
      if (request.method === "POST" && url.pathname === "/api/score") return saveScore(env, request);
      if (request.method === "GET" && url.pathname === "/api/leaderboard") return leaderboard(env);
      return json({ error: "Not found." }, 404);
    } catch (err) {
      return json({ error: "Leaderboard service error." }, 500);
    }
  }
};
