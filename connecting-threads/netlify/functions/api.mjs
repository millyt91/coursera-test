// Connecting Threads API: drop today's post, get served 5 posts to comment on.
//
// Storage (Netlify Blobs, one store):
//   posts/<YYYY-MM-DD>_<userId>          one post per person per UTC day (JSON)
//   done/<postId>/<commenterId>          "I left a comment" marks, one key each
//
// One key per mark means two people ticking at once never overwrite each other.
// There are no logins: a person is a random id kept in their browser, so this
// runs on the honour system, like the rest of the challenge.

import { getStore } from "@netlify/blobs";

const SERVE_COUNT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const dateKey = (t) => new Date(t).toISOString().slice(0, 10);
const isUserId = (s) => typeof s === "string" && /^[a-z0-9]{12,40}$/i.test(s);
const isPostId = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}_[a-z0-9]{12,40}$/i.test(s);
const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function isLinkedInUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "https:" && /(^|\.)linkedin\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

// The last 24 hours of posts, so the feed works across time zones.
async function recentKeys(store, prefix, now) {
  const days = [dateKey(now), dateKey(now - DAY_MS)];
  const lists = await Promise.all(days.map((d) => store.list({ prefix: `${prefix}${d}_` })));
  return lists.flatMap((r) => r.blobs.map((b) => b.key));
}

async function recentPosts(store, now) {
  const keys = await recentKeys(store, "posts/", now);
  const posts = await Promise.all(keys.map((k) => store.get(k, { type: "json" })));
  const latest = new Map();
  for (const p of posts) {
    if (!p || now - p.createdAt > DAY_MS) continue;
    const prev = latest.get(p.userId);
    if (!prev || p.createdAt > prev.createdAt) latest.set(p.userId, p);
  }
  return [...latest.values()];
}

async function recentMarks(store, now) {
  const keys = await recentKeys(store, "done/", now);
  return keys.map((k) => {
    const [, postId, commenterId] = k.split("/");
    return { postId, commenterId };
  });
}

// Serve the posts with the fewest comments first, so quieter people get seen.
// Ties are shuffled so everyone isn't sent to the same five.
export function pickPosts(posts, marks, me, count = SERVE_COUNT, random = Math.random) {
  const tally = new Map();
  const mine = new Set();
  for (const m of marks) {
    tally.set(m.postId, (tally.get(m.postId) || 0) + 1);
    if (m.commenterId === me) mine.add(m.postId);
  }
  return posts
    .filter((p) => p.userId !== me && !mine.has(p.id))
    .map((p) => ({ p, n: tally.get(p.id) || 0, r: random() }))
    .sort((a, b) => a.n - b.n || a.r - b.r)
    .slice(0, count)
    .map(({ p }) => p);
}

const publicPost = ({ id, name, url, pov }) => ({ id, name, url, pov });

export default async (req) => {
  const store = getStore({ name: "connecting-threads", consistency: "strong" });
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/?/, "");
  const now = Date.now();

  try {
    if (req.method === "GET" && route === "feed") {
      const me = url.searchParams.get("me");
      if (!isUserId(me)) return json({ error: "Missing your id. Refresh the page and try again." }, 400);
      const [posts, marks] = await Promise.all([recentPosts(store, now), recentMarks(store, now)]);
      const mine = posts.find((p) => p.userId === me);
      return json({
        mine: mine ? publicPost(mine) : null,
        done: marks.filter((m) => m.commenterId === me).length,
        total: posts.length,
        serve: pickPosts(posts, marks, me).map(publicPost),
      });
    }

    if (req.method === "POST" && route === "post") {
      const body = (await req.json().catch(() => null)) || {};
      const name = clean(body.name, 60);
      const postUrl = clean(body.url, 500);
      const pov = clean(body.pov, 200);
      if (!isUserId(body.userId)) return json({ error: "Missing your id. Refresh the page and try again." }, 400);
      if (!name) return json({ error: "Add your name so people know whose post it is." }, 400);
      if (!isLinkedInUrl(postUrl)) return json({ error: "That doesn't look like a LinkedIn link. Copy it from the post's share menu." }, 400);
      const id = `${dateKey(now)}_${body.userId}`;
      await store.setJSON(`posts/${id}`, { id, userId: body.userId, name, url: postUrl, pov, createdAt: now });
      return json({ ok: true });
    }

    if (req.method === "POST" && route === "done") {
      const body = (await req.json().catch(() => null)) || {};
      if (!isUserId(body.userId) || !isPostId(body.postId)) return json({ error: "That post couldn't be found." }, 400);
      if (body.postId.endsWith(`_${body.userId}`)) return json({ error: "Commenting on your own post doesn't count." }, 400);
      await store.set(`done/${body.postId}/${body.userId}`, String(now));
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong on our side. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/*" };
