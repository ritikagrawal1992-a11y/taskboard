import { test, expect } from "@playwright/test";
test("Taskboard adds a task and persists a status change", async ({ page }) => {
  await page.goto("/#tasks");
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Browser regression task");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const status = page.getByLabel("Status for Browser regression task");
  await expect(status).toBeVisible();
  await status.selectOption("Done");
  await page.reload();
  await expect(status).toHaveValue("Done");
  await page.screenshot({
    path: "docs/screenshots/taskboard.png",
    fullPage: true,
  });
});
