import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPosts, isLinkedInUrl } from "../netlify/functions/api.mjs";

const post = (userId) => ({ id: `2026-10-07_${userId}`, userId, name: userId, url: "https://www.linkedin.com/posts/x" });

test("never serves your own post or ones you've already commented on", () => {
  const posts = ["me0000000000", "aaaaaaaaaaaa", "bbbbbbbbbbbb"].map(post);
  const marks = [{ postId: posts[1].id, commenterId: "me0000000000" }];
  const served = pickPosts(posts, marks, "me0000000000");
  assert.deepEqual(served.map((p) => p.userId), ["bbbbbbbbbbbb"]);
});

test("serves the least-commented posts first, five at most", () => {
  const ids = ["aaaaaaaaaaaa", "bbbbbbbbbbbb", "cccccccccccc", "dddddddddddd", "eeeeeeeeeeee", "ffffffffffff"];
  const posts = ids.map(post);
  const marks = [
    { postId: posts[0].id, commenterId: "x1xxxxxxxxxx" },
    { postId: posts[0].id, commenterId: "x2xxxxxxxxxx" },
    { postId: posts[1].id, commenterId: "x1xxxxxxxxxx" },
  ];
  const served = pickPosts(posts, marks, "me0000000000");
  assert.equal(served.length, 5);
  assert.ok(!served.some((p) => p.userId === "aaaaaaaaaaaa"), "most-commented post is left out");
  assert.equal(served.at(-1).userId, "bbbbbbbbbbbb");
});

test("only accepts https LinkedIn links", () => {
  assert.ok(isLinkedInUrl("https://www.linkedin.com/posts/milly_abc"));
  assert.ok(isLinkedInUrl("https://linkedin.com/feed/update/urn:li:activity:1"));
  assert.ok(!isLinkedInUrl("http://www.linkedin.com/posts/x"));
  assert.ok(!isLinkedInUrl("https://linkedin.com.evil.example/x"));
  assert.ok(!isLinkedInUrl("javascript:alert(1)"));
});
