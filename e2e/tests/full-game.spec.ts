import { test, expect, type Page } from "@playwright/test";

/** Join a room through the join form, which saves a session and redirects. */
async function joinRoom(page: Page, code: string, name: string): Promise<void> {
  await page.goto("/en/join");
  await page.getByPlaceholder("ABCD").fill(code);
  await page.getByPlaceholder(/sam/i).fill(name);
  await page.getByRole("button", { name: /^join$/i }).click();
  await page.waitForURL(`**/play/${code}`);
}

test("a player can join straight from the room link (the QR target)", async ({ browser }) => {
  const host = await browser.newPage();
  await host.goto("/en");
  await host.getByRole("button", { name: /create room/i }).click();
  await host.waitForURL(/\/en\/host\/[A-Z]{4}/);
  const code = host.url().match(/host\/([A-Z]{4})/)![1]!;

  // Simulate scanning the QR code: navigate straight to the room URL.
  const player = await (await browser.newContext()).newPage();
  await player.goto(`/en/play/${code}`);
  await player.getByPlaceholder(/sam/i).fill("Lina");
  await player.getByRole("button", { name: /^join$/i }).click();

  await expect(host.getByText("Lina")).toBeVisible();
});

test("two players play a full game to the winner screen", async ({ browser }) => {
  // ── Host creates a room ──────────────────────────────────────────────────
  const host = await browser.newPage();
  await host.goto("/en");
  await host.getByRole("button", { name: /create room/i }).click();
  await host.waitForURL(/\/en\/host\/[A-Z]{4}/);
  const code = host.url().match(/host\/([A-Z]{4})/)![1]!;

  // ── Two players join (separate contexts → separate sockets/sessions) ─────
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();
  await joinRoom(alice, code, "Alice"); // first joiner → VIP
  await joinRoom(bob, code, "Bob");

  await expect(host.getByText("Alice")).toBeVisible();
  await expect(host.getByText("Bob")).toBeVisible();

  // ── VIP shortens the game to 5 questions and starts ──────────────────────
  await alice.getByRole("button", { name: "5", exact: true }).click();
  await alice.getByRole("button", { name: /start game/i }).click();

  // ── Answer all 5 questions; the game auto-advances between them ───────────
  // Players pick a choice (by its shape marker) then commit with "Lock answer".
  // Each click auto-waits for the next question's answer pad to appear.
  for (let i = 0; i < 5; i++) {
    await alice.getByRole("button", { name: /▲/ }).click();
    await alice.getByRole("button", { name: /lock answer/i }).click();
    await bob.getByRole("button", { name: /◆/ }).click();
    await bob.getByRole("button", { name: /lock answer/i }).click();
  }

  // ── Final screen on the host (winner or a tie) ───────────────────────────
  await expect(host.getByRole("heading", { name: /wins!|it's a tie!/i })).toBeVisible();
  await expect(host.getByRole("heading", { name: /final scores/i })).toBeVisible();
  // The VIP sees a Play Again button on their phone.
  await expect(alice.getByRole("button", { name: /play again/i })).toBeVisible();
});
