import { Hono } from "hono";
import { handle } from "hono/vercel";

import { apply, newGame } from "@/lib/engine/engine";
import { seal, unseal } from "@/lib/engine/seal";
import { IllegalAction, parseAction, type GameState } from "@/lib/engine/state";
import { project } from "@/lib/engine/view";

const app = new Hono().basePath("/api");

/** The client only ever holds the sealed token, never the state itself. */
async function payload(state: GameState, events: unknown) {
  return { view: project(state), events, token: await seal(state) };
}

app.post("/new", async (c) => {
  const { state, events } = newGame();
  return c.json(await payload(state, events));
});

app.post("/action", async (c) => {
  const body = await c.req.json<{ token?: unknown; action?: unknown }>().catch(() => null);
  if (typeof body?.token !== "string") return c.json({ error: "token required" }, 400);

  const action = parseAction(body.action);
  if (!action) return c.json({ error: "unknown action" }, 400);

  let state: GameState;
  try {
    state = await unseal(body.token);
  } catch {
    return c.json({ error: "bad token" }, 400);
  }

  try {
    const events = apply(state, action);
    return c.json(await payload(state, events));
  } catch (e) {
    if (e instanceof IllegalAction) return c.json({ error: e.message }, 400);
    throw e;
  }
});

export const POST = handle(app);
