import { DurableObject } from "cloudflare:workers";

const PAGES_ORIGIN = "https://bmwcooks.github.io";

export class BusCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK (id = 1), n INTEGER NOT NULL)"
    );
    ctx.storage.sql.exec(
      "INSERT INTO counter (id, n) VALUES (1, 0) ON CONFLICT(id) DO NOTHING"
    );
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && (path === "/" || path === "/count")) {
      return Response.json({ count: this.current() });
    }
    if (request.method === "POST" && path === "/increment") {
      return Response.json({ count: this.add(1) });
    }
    if (request.method === "POST" && path === "/decrement") {
      return Response.json({ count: this.add(-1) });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }

  current() {
    return Number(this.ctx.storage.sql.exec("SELECT n FROM counter WHERE id = 1").one().n);
  }

  add(delta) {
    return this.ctx.storage.transactionSync(() => {
      const next = Math.max(0, this.current() + delta);
      this.ctx.storage.sql.exec("UPDATE counter SET n = ? WHERE id = 1", next);
      return next;
    });
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = allowedOrigin(origin);

    if (request.method === "OPTIONS") {
      if (!allowed) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(allowed) });
    }

    if (!allowed) {
      return Response.json(
        { error: "origin not allowed" },
        { status: 403, headers: { Vary: "Origin" } }
      );
    }

    const stub = env.COUNTER.get(env.COUNTER.idFromName("bus-rides"));
    const response = await stub.fetch(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(allowed))) {
      headers.set(key, value);
    }
    return new Response(response.body, { status: response.status, headers });
  },
};

function allowedOrigin(origin) {
  if (!origin) return null;
  if (origin === PAGES_ORIGIN) return origin;
  try {
    const url = new URL(origin);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (local && url.protocol === "http:") return origin;
  } catch (err) {
    return null;
  }
  return null;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
}
