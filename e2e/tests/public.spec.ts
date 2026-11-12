import { expect, type Page, test } from "@playwright/test";

let errorsNotVisibleOnScreen: string[] = [];
test.beforeEach(({ page }) => {
  errorsNotVisibleOnScreen = [];
  page.on("pageerror", (error) => errorsNotVisibleOnScreen.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      errorsNotVisibleOnScreen.push(message.text());
  });
});
test.afterEach(() => expect(errorsNotVisibleOnScreen).toEqual([]));

const TITLE_BY_PUBLIC_PATH = {
  "/": "Taimei",
  "/privacy": "プライバシーポリシー",
};

const ENTRY_SCRIPT = /\/assets\/index-[^/]+\.js$/;

const waitUntilScriptReplacedPrerenderedRoot = (page: Page) =>
  expect(page.locator("#root")).toHaveCount(0);

const screenshotAfterFontsAndImagesLoad = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all([
      document.fonts.ready,
      ...[...document.images].map((image) => image.decode()),
    ]),
  );
  return page.screenshot({ fullPage: true, animations: "disabled" });
};

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

test("モバイルの幅で / のメニューを開くとログインが出る", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "心安らかな",
  );
  await waitUntilScriptReplacedPrerenderedRoot(page);

  await page.getByRole("button", { name: "メニュー" }).click();

  await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();
});

for (const [path, title] of Object.entries(TITLE_BY_PUBLIC_PATH)) {
  test(`${path} は JS を止めても本文が見え、JS が動いた後の画面は JS を止めた時と一致し、layout がずれない`, async ({
    page,
    browser,
    baseURL,
  }) => {
    const withoutScript = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: page.viewportSize(),
    });
    const prerenderedPage = await withoutScript.newPage();
    await prerenderedPage.goto(path, { waitUntil: "load" });
    await expect(
      prerenderedPage.getByRole("heading", { level: 1 }),
    ).toBeVisible();
    const prerendered =
      await screenshotAfterFontsAndImagesLoad(prerenderedPage);
    await withoutScript.close();

    let startScript = () => {};
    const scriptMayStart = new Promise<void>((resolve) => {
      startScript = resolve;
    });
    await page.route(ENTRY_SCRIPT, async (route) => {
      await scriptMayStart;
      await route.continue();
    });
    await page.addInitScript(() => {
      const layoutShifts: { startTime: number; value: number }[] = [];
      Object.assign(window, { taimeiLayoutShifts: layoutShifts });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          layoutShifts.push({
            startTime: entry.startTime,
            value: Reflect.get(entry, "value"),
          });
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(path, { waitUntil: "commit" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForFunction(
      () =>
        document.fonts.status === "loaded" &&
        [...document.fonts].some((font) => font.status === "loaded"),
    );
    const fontSwapPaintedAt = await page.evaluate(async () => {
      const nextFrame = () =>
        new Promise((resolve) => requestAnimationFrame(resolve));
      do {
        await document.fonts.ready;
        await nextFrame();
        await nextFrame();
      } while (document.fonts.status !== "loaded");
      return performance.now();
    });

    startScript();
    await waitUntilScriptReplacedPrerenderedRoot(page);

    await expect(page).toHaveTitle(title);
    expect(
      (await screenshotAfterFontsAndImagesLoad(page)).equals(prerendered),
      "JS が動いた後の screenshot が、JS を止めた時の screenshot と同じ",
    ).toBe(true);
    expect(
      await page.evaluate(
        (since) =>
          Reflect.get(window, "taimeiLayoutShifts").filter(
            (shift: { startTime: number }) => shift.startTime >= since,
          ),
        fontSwapPaintedAt,
      ),
      "font の差し替えを paint した後、JS の起動で layout がずれない",
    ).toEqual([]);
  });
}

test("/ を開いて JS が動く間、年の無い footer が 2 つの frame の頭に続かない (続けば、間の frame が年なしで paint している)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const footerHasYearAtFrameStarts: boolean[] = [];
    Object.assign(window, { footerHasYearAtFrameStarts });
    const record = () => {
      const copyright = [...document.querySelectorAll("footer p")]
        .map((paragraph) => paragraph.textContent ?? "")
        .find((text) => text.includes("©"));
      if (copyright !== undefined)
        footerHasYearAtFrameStarts.push(/\d{4}/.test(copyright));
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  await page.goto("/", { waitUntil: "load" });
  await waitUntilScriptReplacedPrerenderedRoot(page);
  await expect(page.locator("footer")).toContainText(/© \d{4} Taimei/);

  const footerHasYearAtFrameStarts: boolean[] = await page.evaluate(() =>
    Reflect.get(window, "footerHasYearAtFrameStarts"),
  );

  expect(footerHasYearAtFrameStarts.length).toBeGreaterThan(1);
  expect(
    footerHasYearAtFrameStarts.filter(
      (hasYear, frame) =>
        !hasYear && footerHasYearAtFrameStarts[frame + 1] === false,
    ),
  ).toEqual([]);
});

test("/ で footer まで scroll してプライバシーポリシーを押すと、document を読み直さずに /privacy へ移り、先頭から表示する", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.goto("/");
  await waitUntilScriptReplacedPrerenderedRoot(page);
  await page.evaluate(() => Object.assign(window, { openedAsLanding: true }));
  const privacyLink = page.getByRole("link", { name: "プライバシーポリシー" });
  await privacyLink.scrollIntoViewIfNeeded();
  expect(await scrollY(page)).toBeGreaterThan(0);

  await privacyLink.click();

  await expect(page).toHaveURL("/privacy");
  await expect(page).toHaveTitle("プライバシーポリシー");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "プライバシーポリシー",
  );
  expect(
    await page.evaluate(() => ({
      sameDocument: Reflect.get(window, "openedAsLanding") === true,
      scrollY: window.scrollY,
    })),
  ).toEqual({ sameDocument: true, scrollY: 0 });
});

test("/ でメニューを開いて下へ scroll してロゴを押すと、履歴を増やさずに先頭へ戻り、メニューが閉じる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await waitUntilScriptReplacedPrerenderedRoot(page);
  await page.getByRole("button", { name: "メニュー" }).click();
  await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await scrollY(page)).toBeGreaterThan(0);
  const historyLengthBefore = await page.evaluate(() => history.length);

  await page.getByRole("link", { name: "myservicelogo" }).click();

  await expect(page.getByRole("link", { name: "ログイン" })).toBeHidden();
  await expect.poll(() => scrollY(page)).toBe(0);
  expect(await page.evaluate(() => history.length)).toBe(historyLengthBefore);
});

test("/ を開いても API を呼ばない", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });

  await page.goto("/", { waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "心安らかな",
  );
  await waitUntilScriptReplacedPrerenderedRoot(page);
  await expect(page.locator("footer")).toContainText(/© \d{4} Taimei/);

  expect(apiRequests).toEqual([]);
});
