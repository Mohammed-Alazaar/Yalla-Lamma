import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { env } from "./env";
import { store, RedisStore, usingRedis } from "./store";
import { registerHandlers } from "./handlers";
import type { AppServer } from "./lib/types";

async function main(): Promise<void> {
  await store.connect();

  const httpServer = createServer((req, res) => {
    // Health check for Render + simple liveness probe.
    if (req.url === "/healthz" || req.url === "/") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const io: AppServer = new Server(httpServer, {
    cors: { origin: env.allowedOrigins },
    transports: ["websocket", "polling"],
  });

  // Enable the Redis adapter for horizontal scaling when Redis is configured.
  if (store instanceof RedisStore) {
    io.adapter(createAdapter(store.pub, store.sub));
  }

  io.on("connection", (socket) => {
    registerHandlers(io, socket);
  });

  httpServer.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[realtime] listening on :${env.port} (store=${usingRedis ? "redis" : "memory"}, origins=${env.allowedOrigins.join(",")})`,
    );
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[realtime] fatal:", err);
  process.exit(1);
});
