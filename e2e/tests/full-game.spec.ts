import { test, expect, type Page } from "@playwright/test";

/** Join a room through the join form, which saves a session and redirects. */
async function joinRoom(page: Page, code: string, name: string): Promise<void> {
  await page.goto("/en/join");
  await page.getByPlaceholder("ABCD").fill(code);
  await page.getByPlaceholder(/sam/i).fill(name);
  await page.getByRole("button", { name: /^join$/i }).click();
  await page.waitForURL(`**/play/${code}`);
}

test("quip: three players write, vote, and reach the winner screen", async ({ browser }) => {
  test.setTimeout(180_000);

  const host = await browser.newPage();
  await host.goto("/en");
  await host.getByRole("button", { name: /create room/i }).click();
  await host.waitForURL(/\/en\/host\/[A-Z]{4}/);
  const code = host.url().match(/host\/([A-Z]{4})/)![1]!;

  const ctxs = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const players = await Promise.all(ctxs.map((c) => c.newPage()));
  await joinRoom(players[0]!, code, "Alice"); // VIP
  await joinRoom(players[1]!, code, "Bob");
  await joinRoom(players[2]!, code, "Cara");
  await expect(host.getByText("Cara")).toBeVisible();

  // VIP: pick Quip → 2 rounds → start.
  const vip = players[0]!;
  await vip.getByRole("button", { name: /quip/i }).click();
  await vip.getByRole("button", { name: "2", exact: true }).click(); // 2 rounds
  await vip.getByRole("button", { name: /start game/i }).click();

  // Act on whatever each phone shows (write or vote) until the host crowns a
  // winner — robust across the writing/voting/round transitions.
  const winner = host.getByRole("heading", { name: /wins!|it's a tie!/i });
  const deadline = Date.now() + 160_000;
  while (Date.now() < deadline) {
    if (await winner.isVisible().catch(() => false)) break;
    for (const p of players) {
      const box = p.getByPlaceholder(/funny/i);
      if (await box.isVisible().catch(() => false)) {
        await box.fill(`ha ${Date.now()}`);
        await p.getByRole("button", { name: /submit/i }).click().catch(() => {});
        continue;
      }
      const voteButtons = p.locator("main button"); // only present on the voting screen
      if ((await voteButtons.count().catch(() => 0)) > 0) {
        await voteButtons.first().click({ timeout: 1500 }).catch(() => {});
      }
    }
    await host.waitForTimeout(700);
  }

  await expect(winner).toBeVisible();
});

test("fib: two players write lies, spot the truth, and reach the winner screen", async ({ browser }) => {
  test.setTimeout(180_000);

  const host = await browser.newPage();
  await host.goto("/en");
  await host.getByRole("button", { name: /create room/i }).click();
  await host.waitForURL(/\/en\/host\/[A-Z]{4}/);
  const code = host.url().match(/host\/([A-Z]{4})/)![1]!;

  const ctxs = await Promise.all([0, 1].map(() => browser.newContext()));
  const players = await Promise.all(ctxs.map((c) => c.newPage()));
  await joinRoom(players[0]!, code, "Alice"); // VIP
  await joinRoom(players[1]!, code, "Bob");
  await expect(host.getByText("Bob")).toBeVisible();

  // VIP: pick Fib → 5 questions → start.
  const vip = players[0]!;
  await vip.getByRole("button", { name: /fib/i }).click();
  await vip.getByRole("button", { name: "5", exact: true }).click(); // 5 questions
  await vip.getByRole("button", { name: /start game/i }).click();

  // On each phone: write a lie when prompted, else pick an answer during
  // spotting — robust across the writing/spotting/reveal/leaderboard cycle.
  const winner = host.getByRole("heading", { name: /wins!|it's a tie!/i });
  const deadline = Date.now() + 160_000;
  while (Date.now() < deadline) {
    if (await winner.isVisible().catch(() => false)) break;
    for (let i = 0; i < players.length; i++) {
      const p = players[i]!;
      const lieBox = p.getByPlaceholder(/lie/i);
      if (await lieBox.isVisible().catch(() => false)) {
        await lieBox.fill(`fib ${i}-${Date.now()}`);
        await p.getByRole("button", { name: /submit/i }).click().catch(() => {});
        continue;
      }
      // Spotting: pick the first enabled option (a player can't pick their own lie).
      const options = p.locator("main button:not([disabled])");
      if ((await options.count().catch(() => 0)) > 0) {
        await options.first().click({ timeout: 1500 }).catch(() => {});
      }
    }
    await host.waitForTimeout(700);
  }

  await expect(winner).toBeVisible();
});

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

  // ── VIP picks Trivia from the game-picker, shortens it, and starts ───────
  await alice.getByRole("button", { name: /trivia/i }).click();
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
