# Lemma

A code editor where several people can type in the same file at the same time. You register, you land in a shared room, and everyone in it sees each other's edits and cursors as they happen.

I built it to understand how real-time collaboration actually works under the hood, instead of just using a library and hoping it behaves. Most of the interesting problems turned out to be about what happens when two people edit the same spot at the same moment, and what happens when the server they're connected to isn't the same server as everyone else's.

## Try it

You need Docker. That's it.

```bash
cp .env.example .env     # then put a long random string in JWT_SECRET
docker compose up --build
./scripts/install-runtimes.sh   # once, in a second terminal, so the Run button has languages to run
```

Open http://localhost:8080, register an account, and start typing. Open a second tab to watch it sync. The other tab's cursor shows up in that person's color with their name on it. Pick a language from the dropdown and hit Run to execute the code.

The first boot runs the database migrations and seeds a shared room called `demo-room`. Every new account joins that room automatically, so there's nothing to set up.

`docker compose down` stops everything, and `docker compose down -v` also wipes the database.

## How it works

```mermaid
flowchart LR
    B1["Browser<br/>Monaco + Yjs"] <-->|WebSocket| S1["Server A"]
    B2["Browser<br/>Monaco + Yjs"] <-->|WebSocket| S2["Server B"]
    B1 -->|REST| S1
    S1 <-->|pub/sub| R[("Redis")]
    S2 <-->|pub/sub| R
    S1 --> P[("Postgres")]
    S2 --> P
```

**The editor.** Monaco (the editor VS Code uses) in the browser. Text lives in a Yjs document rather than in React state, and `y-monaco` keeps the two in step.

**Merging edits.** Yjs is a CRDT, which is a data structure designed so that everyone ends up with the same text no matter what order edits arrive in. There's no locking and no "last write wins". Two people typing at the same position both get their text kept.

**Talking to the server.** Each browser holds one WebSocket open. Document changes and cursor positions travel over it as small binary messages using the standard Yjs sync protocol. The server keeps one document per active room and passes every change on to the other people in that room.

**More than one server.** This is what Redis is for. If two people in the same room are connected to different server processes, Server A publishes each change to a Redis channel for that room, and Server B, which is subscribed to it, applies the change and forwards it to its own clients. Without Redis, the second server would silently never hear about edits made on the first. I tested this with two real server processes on different ports sharing nothing but Redis and Postgres.

**Accounts and rooms.** Passwords are hashed with bcrypt and logins return a JWT. Rooms are joined by invite code, and only members of a room can read its document or open a WebSocket to it. The WebSocket check happens during the HTTP upgrade, before the connection exists at all.

**Rate limiting.** Register and login allow 10 attempts per 15 minutes per IP, counted in Redis so the limit is shared across servers and survives restarts.

## Running it for development

You'll want Node 22 and Docker (for Postgres and Redis).

```bash
npm install

docker run -d --name lemma-postgres -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=lemma -p 5432:5432 postgres:16-alpine
docker run -d --name lemma-redis -p 6379:6379 redis:7-alpine
```

Create `apps/server/.env`:

```
DATABASE_URL="postgresql://postgres:devpass@localhost:5432/lemma?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="anything-long-and-random"
```

Then set up the database and start both apps:

```bash
cd apps/server
npx prisma migrate deploy
npx prisma db seed
cd ../..

npm run dev --workspace=apps/server    # API and WebSockets on :3001
npm run dev --workspace=apps/web       # the editor on :5173
```

To try the multi-server setup, start a second copy with `PORT=3002 npm run dev --workspace=apps/server`.

## Running code

The Run button sends the code to the server, which checks the language against an allowlist, rate limits it (20 runs a minute per person, backed by Redis) and forwards it to a [Piston](https://github.com/engineer-man/piston) container. Piston isolates each run, kills it after 3 seconds and caps its memory. Supported: Python, JavaScript, TypeScript, C++, Java, Go, Rust, C#, Ruby and PHP.

## Deploying it

The frontend goes on Vercel and everything else goes on Render. Both have free tiers.

1. **Render.** New, then Blueprint, and point it at this repo. It reads `render.yaml` and creates the server, a Postgres database and a Redis-compatible Key Value store. It will ask for `CORS_ORIGIN`. Put in a placeholder for now, because you don't have the site URL yet.
2. **Copy the server's URL** from Render (something like `https://lemma-server.onrender.com`).
3. **Vercel.** Import the repo, set the Root Directory to `apps/web`, and add an environment variable `VITE_API_URL` set to the server URL from step 2. Deploy.
4. **Back on Render**, change `CORS_ORIGIN` to the Vercel URL, with no trailing slash. The server redeploys and the two are connected.

Two settings are worth knowing about. `CORS_ORIGIN` limits which website is allowed to call the API. `TRUST_PROXY=1` tells Express it's behind Render's proxy, so the login rate limit counts each visitor separately instead of counting everyone as the proxy's one address.

## Tests

```bash
npm test
npm run typecheck
```

There are 25 tests. The database and Redis need to be running, because the server tests are integration tests against the real thing rather than mocks. They cover:

- the REST routes, including that requests without a valid token are rejected
- WebSocket connections without a token being refused
- three real WebSocket clients editing one room at once and ending up with identical text
- a client joining a room that already has content and receiving it
- the CRDT package (below)

GitHub Actions runs the same checks against fresh Postgres and Redis containers on every push, and also confirms the Docker images still build.

## What's in the repo

```
apps/server     Express API, WebSocket server, Prisma, Redis
apps/web        React + Vite frontend with Monaco
packages/crdt   A CRDT I wrote by hand (see below)
```

### The CRDT I didn't end up using

I started by writing my own text CRDT: fractional indexing for character positions, a tie-break so two people inserting at the same spot always resolve the same way, and a test that shuffles the delivery order of edits across several simulated replicas and checks they all converge. It works and it's tested, and it's still in `packages/crdt`.

Then I switched the app over to Yjs, because a real editor also needs cursor handling, a binary sync protocol and years of edge cases that Yjs has already been through. Writing the CRDT taught me what Yjs is doing for me, which was the point. The app just doesn't import it anymore.

## Things it doesn't do yet

I'd rather list these than have you find them.

- **Room contents live in server memory.** There's a REST endpoint that loads and saves a document in Postgres, but the live editor doesn't use it, and the WebSocket path doesn't write to Postgres at all. If every person leaves a room, or the server restarts, the text is gone. A new server also can't catch up on a room it hasn't seen, only on changes made after it joins.
- **Everyone lands in one shared room.** The API supports creating rooms and joining by invite code, but the UI doesn't have a room picker.
- **The free hosting tier sleeps.** After about 15 minutes with no traffic the server spins down, and since room text only lives in memory, it's gone when that happens.
- **Run only works where there's a runner.** Code executes in a self-hosted Piston container, which needs privileged mode. Render's free tier can't host that, so on the deployed site the Run button reports the runner as unavailable. Output is also only shown to the person who pressed Run, and programs can't read input.

## Built with

TypeScript, React, Vite, Monaco, Yjs, Express, `ws`, PostgreSQL, Prisma, Redis (`ioredis`), Vitest, Supertest, Docker, GitHub Actions, Vercel, Render.
