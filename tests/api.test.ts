import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../server/app";
async function fixture(t: TestContext) {
  const { app, db } = createApp(":memory:", false),
    server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  return async (
    path: string,
    method = "GET",
    body?: unknown,
    headers?: Record<string, string>,
  ) => {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api${path}`,
      {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
    };
  };
}
test("task creation, status transition, and invalid status rejection", async (t) => {
  const call = await fixture(t);
  const task = await call("/tasks", "POST", {
    title: "Review accessibility",
    priority: "High",
  });
  assert.equal(task.status, 201);
  assert.equal(
    (await call("/tasks/" + task.data.id, "PATCH", { status: "Done" })).status,
    200,
  );
  assert.equal((await call("/tasks")).data[0].status, "Done");
  assert.equal(
    (await call("/tasks/" + task.data.id, "PATCH", { status: "invented" }))
      .status,
    400,
  );
  assert.equal(
    (await call("/tasks/999", "PATCH", { status: "Done" })).status,
    404,
  );
});

test("SQL-looking text is stored as data, and markup stays literal", async (t) => {
  const call = await fixture(t),
    title = "<script>alert(1)</script>'; DROP TABLE tasks; --";
  assert.equal((await call("/tasks", "POST", { title })).status, 201);
  assert.equal((await call("/tasks")).data[0].title, title);
  assert.equal((await call("/tasks", "POST", { title: "" })).status, 400);
});

test("SQLite records persist across application restarts", async (t) => {
  const { mkdtempSync, rmSync } = await import("node:fs"),
    { tmpdir } = await import("node:os"),
    { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "workbench-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const first = createApp(join(dir, "test.sqlite"), false);
  first.db
    .prepare("INSERT INTO tasks(title,status,priority) VALUES(?,?,?)")
    .run("Persist me", "Backlog", "Low");
  first.db.close();
  const second = createApp(join(dir, "test.sqlite"), false);
  assert.equal(
    second.db.prepare("SELECT title FROM tasks").get()?.title,
    "Persist me",
  );
  second.db.close();
});
