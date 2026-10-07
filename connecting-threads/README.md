# Connecting Threads

A one-page tool for the POV Challenge. Each day, participants drop the link to their LinkedIn post. The page then gives them 5 other people's posts to comment on, choosing the posts with the fewest comments so far.

- No logins. Each person gets a random id saved in their browser, and everything runs on the honour system.
- "Today" means the last 24 hours, so it works across time zones.
- Data lives in Netlify Blobs, which is free and needs no setup.

## Deploy on Netlify

1. In Netlify: **Add new site → Import an existing project →** pick this GitHub repo.
2. Set **Base directory** to `connecting-threads`. Leave the build command empty. Netlify reads the rest from `netlify.toml`.
3. Deploy, then share the site URL with participants.

Drag-and-drop deploys don't include the server function, so connect the repo as described above.

## Run the tests

```
cd connecting-threads && npm install && npm test
```
