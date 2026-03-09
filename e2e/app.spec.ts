import { test, expect } from "@playwright/test";

test.describe("Video Clip Creator", () => {
  test("full flow: generate clip, open editor, regenerate a frame", async ({
    page,
  }) => {
    await page.goto("/");

    // 1. Create clip: fill prompt and generate
    await expect(
      page.getByRole("heading", { name: /Create 30s Clip/i })
    ).toBeVisible();

    const promptInput = page.getByPlaceholder(/serene sunset/i);
    await promptInput.fill("A calm ocean at sunset");

    const generateBtn = page.getByRole("button", {
      name: /Generate 30s clip/i,
    });
    await generateBtn.click();

    // 2. Wait for editor: Back button and Frames section
    await expect(page.getByRole("button", { name: /Back/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: /Frames \(click to edit\)/i })
    ).toBeVisible({ timeout: 20_000 });

    // 3. Wait for frame thumbnails (extraction can take a few seconds)
    const frameThumbnails = page.locator('[alt^="Frame "]');
    await expect(frameThumbnails.first()).toBeVisible({ timeout: 30_000 });
    const count = await frameThumbnails.count();
    expect(count).toBeGreaterThan(0);

    // 4. Click first frame to open edit panel
    await frameThumbnails.first().click();

    // 5. Edit panel: frame prompt input and Regenerate button visible
    const framePromptInput = page.getByPlaceholder(/Describe this frame/i);
    await expect(framePromptInput).toBeVisible({ timeout: 5000 });

    await framePromptInput.fill("golden sunset sky");

    const regenerateBtn = page.getByRole("button", {
      name: /Regenerate frame/i,
    });
    await regenerateBtn.click();

    // 6. Wait for success: "Frame updated!" or thumbnail change
    await expect(
      page.getByText("Frame updated!", { exact: true })
    ).toBeVisible({ timeout: 10_000 });

    // 7. No error message
    await expect(page.getByText(/Regeneration failed/i)).not.toBeVisible();
  });

  test("home page loads and shows create form", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Create 30s Clip/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Generate 30s clip/i })
    ).toBeVisible();
  });
});
