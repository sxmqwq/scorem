import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const tokenA = "a".repeat(64),
  tokenB = "b".repeat(64);
const userA = {
  id: "alice",
  username: "alice",
  nickname: "Alice",
  role: "member",
  status: "approved",
};
const userB = { ...userA, id: "bob", username: "bob", nickname: "Bob" };
const unauthorized = () =>
  Response.json(
    { error: { code: "unauthorized", message: "登录已失效" } },
    { status: 401 },
  );
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
class Storage {
  data = new Map();
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

async function browser(
  t,
  fetcher = async () => Response.json({ user: userA }),
) {
  const previous = Object.fromEntries(
    ["fetch", "window", "localStorage", "sessionStorage"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const directory = await mkdtemp(join(root, ".session-test-"));
  const persistent = new Storage(),
    tab = new Storage(),
    events = new EventTarget();
  Object.defineProperties(globalThis, {
    fetch: { value: fetcher, writable: true, configurable: true },
    window: { value: events, writable: true, configurable: true },
    localStorage: { value: persistent, writable: true, configurable: true },
    sessionStorage: { value: tab, writable: true, configurable: true },
  });
  t.after(async () => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    await rm(directory, { recursive: true, force: true });
  });
  const source = (await readFile(join(root, "src/api.ts"), "utf8")).replaceAll(
    "import.meta.env",
    `(${JSON.stringify({ VITE_API_BASE_URL: "https://api.scorem.test", BASE_URL: "/scorem/" })})`,
  );
  // Exercise the real client module after stripping TypeScript and supplying
  // the build-time API URL, without mocking the client or its session state.
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  let counter = 0;
  return {
    persistent,
    tab,
    events,
    async load() {
      const path = join(directory, `api-${counter++}.mjs`);
      await writeFile(path, compiled);
      return import(pathToFileURL(path).href);
    },
    storageChanged(key) {
      const event = new Event("storage");
      Object.defineProperty(event, "key", { value: key });
      Object.defineProperty(event, "storageArea", { value: persistent });
      events.dispatchEvent(event);
    },
  };
}

test("an anonymous request's late 401 cannot log out a newly signed-in user", async (t) => {
  const response = deferred();
  const b = await browser(t, () => response.promise);
  const client = await b.load();
  const pending = client.api("/api/me/reviews").catch((error) => error);
  client.setSession(userA, tokenA);
  response.resolve(unauthorized());
  await pending;
  assert.equal(client.auth.token, tokenA);
  assert.equal(client.auth.user.id, userA.id);
});

test("a superseded token's late 401 cannot clear its replacement", async (t) => {
  const response = deferred();
  const b = await browser(t, () => response.promise);
  const client = await b.load();
  client.setSession(userA, tokenA);
  const pending = client.api("/api/contests").catch((error) => error);
  client.setSession(userB, tokenB);
  response.resolve(unauthorized());
  await pending;
  assert.equal(client.auth.token, tokenB);
  assert.equal(client.auth.user.id, userB.id);
});

test("an old profile response cannot overwrite a new login", async (t) => {
  const response = deferred();
  const b = await browser(t, () => response.promise);
  const client = await b.load();
  client.setSession(userA, tokenA);
  const pending = client.refreshUser();
  client.setSession(userB, tokenB);
  response.resolve(Response.json({ user: userA }));
  await pending;
  assert.equal(client.auth.user.id, userB.id);
});

test("a late guest profile response cannot overwrite a new login", async (t) => {
  const response = deferred();
  let requests = 0;
  const b = await browser(t, () => {
    requests++;
    return response.promise;
  });
  const client = await b.load();
  const pending = client.refreshUser();
  client.setSession(userA, tokenA);
  if (requests) response.resolve(Response.json({ user: null }));
  await pending;
  assert.equal(client.auth.user.id, userA.id);
});

test("an old logout response cannot clear a subsequent login", async (t) => {
  const response = deferred();
  const b = await browser(t, () => response.promise);
  const client = await b.load();
  client.setSession(userA, tokenA);
  const pending = client.logout();
  client.setSession(userB, tokenB);
  response.resolve(Response.json({ ok: true }));
  await pending;
  assert.equal(client.auth.token, tokenB);
});

test("concurrent session restoration shares one request", async (t) => {
  const response = deferred();
  let requests = 0;
  const b = await browser(t, () => {
    requests++;
    return response.promise;
  });
  const client = await b.load();
  client.setSession(userA, tokenA);
  const first = client.refreshUser(),
    second = client.refreshUser();
  const count = requests;
  response.resolve(Response.json({ user: userA }));
  const results = await Promise.allSettled([first, second]);
  assert.equal(count, 1);
  assert.ok(results.every((result) => result.status === "fulfilled"));
});

test("page requests and a fresh tab retain the session until the server expiry", async (t) => {
  const sent = [];
  const b = await browser(t, async (url, options) => {
    sent.push(new Headers(options.headers).get("authorization"));
    return Response.json(
      url.endsWith("/auth/me") ? { user: userA } : { items: [] },
    );
  });
  const client = await b.load(),
    expiresAt = Math.floor(Date.now() / 1000) + 3600;
  client.setSession(userA, tokenA, expiresAt);
  for (const path of [
    "/api/contests",
    "/api/problems",
    "/api/users",
    "/api/me/reviews",
  ])
    await client.api(path);
  assert.deepEqual(sent, Array(4).fill("Bearer " + tokenA));
  globalThis.sessionStorage = new Storage();
  const nextTab = await b.load();
  assert.equal(nextTab.auth.token, tokenA);
  assert.equal(nextTab.auth.expiresAt, expiresAt);
  await nextTab.refreshUser();
  assert.equal(nextTab.auth.user.id, userA.id);
});

test("legacy tab sessions migrate without asking users to sign in again", async (t) => {
  const b = await browser(t);
  b.tab.setItem("scorem.session.v1", tokenA);
  const client = await b.load();
  assert.equal(client.auth.token, tokenA);
  assert.equal(b.persistent.data.size, 1);
  assert.equal(b.tab.getItem("scorem.session.v1"), null);
});

test("network errors, rate limiting and server errors keep a valid session", async (t) => {
  const b = await browser(t);
  const client = await b.load();
  client.setSession(userA, tokenA);
  for (const status of [0, 429, 500]) {
    globalThis.fetch = async () => {
      if (!status) throw new TypeError("offline");
      return Response.json(
        { error: { code: status === 429 ? "rate_limited" : "internal" } },
        { status },
      );
    };
    await assert.rejects(() => client.refreshUser());
    assert.equal(client.auth.token, tokenA);
    assert.equal(client.auth.user.id, userA.id);
  }
});

test("a rejected current session clears memory and stored credentials", async (t) => {
  const b = await browser(t, async () => unauthorized());
  const client = await b.load();
  client.setSession(userA, tokenA);
  await assert.rejects(() => client.api("/api/auth/me"));
  assert.equal(client.auth.token, "");
  assert.equal(client.auth.user, null);
  assert.equal(b.persistent.data.size, 0);
  assert.equal(b.tab.data.size, 0);
});

test("storage events synchronize sign-out across open tabs", async (t) => {
  const b = await browser(t);
  const client = await b.load();
  client.setSession(userA, tokenA);
  const [key] = b.persistent.data.keys();
  assert.ok(key);
  b.persistent.removeItem(key);
  b.storageChanged(key);
  assert.equal(client.auth.token, "");
  assert.equal(client.auth.user, null);
});

test("anonymous login calls do not send an obsolete session token", async (t) => {
  const b = await browser(t, async (_url, options) => {
    assert.equal(new Headers(options.headers).get("authorization"), null);
    return Response.json({ user: userB, token: tokenB });
  });
  const client = await b.load();
  client.setSession(userA, tokenA);
  await client.api("/api/auth/login", {
    method: "POST",
    json: {},
    anonymous: true,
  });
  assert.equal(client.auth.token, tokenA);
});

test("expired stored sessions are discarded instead of being restored", async (t) => {
  const b = await browser(t);
  const client = await b.load();
  const now = Date.now,
    timestamp = now();
  client.setSession(userA, tokenA, Math.floor(timestamp / 1000) + 10);
  try {
    Date.now = () => timestamp + 20_000;
    const reopened = await b.load();
    assert.equal(reopened.auth.token, "");
    assert.equal(reopened.auth.user, null);
    assert.equal(b.persistent.data.size, 0);
  } finally {
    Date.now = now;
  }
});

test("blocked persistent storage falls back to a reloadable tab session", async (t) => {
  const b = await browser(t);
  globalThis.localStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  const client = await b.load();
  client.setSession(userA, tokenA);
  const reloaded = await b.load();
  assert.equal(reloaded.auth.token, tokenA);
  await reloaded.refreshUser();
  assert.equal(reloaded.auth.user.id, userA.id);
});

test("cross-tab account changes verify the new session before displaying its user", async (t) => {
  const response = deferred();
  const b = await browser(t, () => response.promise);
  const client = await b.load();
  client.setSession(userA, tokenA);
  const [key] = b.persistent.data.keys();
  const stored = JSON.parse(b.persistent.getItem(key));
  b.persistent.setItem(key, JSON.stringify({ ...stored, token: tokenB }));
  b.storageChanged(key);
  assert.equal(client.auth.token, tokenB);
  assert.equal(client.auth.user, null);
  response.resolve(Response.json({ user: userB }));
  await client.refreshUser();
  assert.equal(client.auth.user.id, userB.id);
});

test("an incomplete server response keeps the session available for retry", async (t) => {
  const b = await browser(t, async () => Response.json({}));
  const client = await b.load();
  client.setSession(userA, tokenA);
  await assert.rejects(() => client.refreshUser(), {
    code: "invalid_response",
  });
  assert.equal(client.auth.token, tokenA);
  assert.equal(client.auth.user.id, userA.id);
});
