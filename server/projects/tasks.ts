import type { Express } from "express";
import type { Store } from "../store";
import { fail, text, integer } from "../validation";

export function registerTasks(app: Express, { all, one, run }: Store) {
  app.get("/api/tasks", (_req, res) =>
    res.json(all("SELECT * FROM tasks ORDER BY id DESC")),
  );
  app.post("/api/tasks", (req, res) => {
    const title = text(req.body.title, "Title");
    const priority = req.body.priority ?? "Medium";
    if (!["Low", "Medium", "High"].includes(priority))
      fail(400, "Choose a valid priority.");
    const result = run(
      "INSERT INTO tasks(title,status,priority) VALUES(?,?,?)",
      title,
      "Backlog",
      priority,
    );
    res
      .status(201)
      .json(
        one("SELECT * FROM tasks WHERE id=?", Number(result.lastInsertRowid)),
      );
  });
  app.patch("/api/tasks/:id", (req, res) => {
    if (!["Backlog", "In progress", "Done"].includes(req.body.status))
      fail(400, "Choose a valid task status.");
    if (
      !run(
        "UPDATE tasks SET status=? WHERE id=?",
        req.body.status,
        integer(Number(req.params.id), "Task ID", 1),
      ).changes
    )
      fail(404, "Task not found.");
    res.json({ ok: true });
  });
}
