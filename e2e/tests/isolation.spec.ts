import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { authDb } from "../db/auth-client";
import { user } from "../db/auth-schema";
import {
  AUTH_BASE_URL,
  createTestUser,
  provisionCompanyForUser,
  signInWithMagicLink,
} from "./utils/signIn";

// docs/adr/0004 の場面 5・6

const userIdOf = async (email: string) => {
  const [row] = await authDb
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  return row.id;
};

const postToAuth = async (
  context: BrowserContext,
  path: string,
  data?: object,
) => {
  const response = await context.request.post(`${AUTH_BASE_URL}${path}`, {
    data,
    headers: { Origin: AUTH_BASE_URL },
  });
  expect(response.status()).toBe(200);
};

const switchCompany = (context: BrowserContext, companyId: string) =>
  postToAuth(context, "/api/account/current-company", {
    company_id: companyId,
  });

const createTeam = async (page: Page, name: string) => {
  await page.goto("/dashboard/teams");
  await page.getByLabel("チーム名").fill(name);
  await page.getByRole("button", { name: "チームを作る" }).click();
  await expect(page).toHaveURL(/\/dashboard\/teams\/[0-9a-f-]{36}$/);
  return page.url();
};

const assign = async (page: Page, teamUrl: string, userId: string) => {
  await page.goto(teamUrl);
  await page.getByLabel("割り当てるメンバー").selectOption(userId);
  await page.getByRole("button", { name: "割り当てる" }).click();
  await expect(
    page.getByLabel("割り当てるメンバー").locator(`option[value="${userId}"]`),
  ).toHaveCount(0);
};

const teamLink = (page: Page, name: string) =>
  page.getByRole("link", { name, exact: true });

const teamHeading = (page: Page, name: string) =>
  page.getByRole("heading", { name, exact: true });

const expectTeamHidden = async (page: Page, teamUrl: string, name: string) => {
  const response = await page.goto(teamUrl);
  expect(response?.status()).toBe(404);
  await expect(teamHeading(page, name)).toHaveCount(0);

  await page.goto("/dashboard/teams");
  await expect(teamHeading(page, "チーム")).toBeVisible();
  await expect(teamLink(page, name)).toHaveCount(0);
};

test("場面 5: 事業所を切り替えると、別の事業所のチームが見えない", async ({
  browser,
}) => {
  const email = await createTestUser();
  const userId = await userIdOf(email);
  const companyA = `cmp_e2ea${userId.replace(/-/g, "").slice(0, 21)}`;
  const companyB = `cmp_e2eb${userId.replace(/-/g, "").slice(0, 21)}`;
  await provisionCompanyForUser(userId, { companyId: companyB });
  await provisionCompanyForUser(userId, { companyId: companyA });
  const context = await signInWithMagicLink(browser, email);
  const page = await context.newPage();

  const teamUrl = await createTeam(page, "A のチーム");
  await page.goto("/dashboard/teams");
  await expect(teamLink(page, "A のチーム")).toHaveCount(1);

  await switchCompany(context, companyB);
  await expectTeamHidden(page, teamUrl, "A のチーム");

  await switchCompany(context, companyA);
  await page.goto("/dashboard/teams");
  await expect(teamLink(page, "A のチーム")).toHaveCount(1);

  await context.close();
});

test("場面 6: 除名・退会した人は、次の request から元の事業所のチームが見えない", async ({
  browser,
}) => {
  const companyA = `cmp_e2e6${crypto.randomUUID().replace(/-/g, "").slice(0, 21)}`;
  const ownerEmail = await createTestUser({ companyId: companyA });
  // 別の事業所にも所属させ、除名でアカウントごと消えないようにする (taimei-auth の ADR-0010 D2)
  const removedEmail = await createTestUser();
  const removedId = await userIdOf(removedEmail);
  await provisionCompanyForUser(removedId, {
    companyId: companyA,
    role: "MEMBER",
  });
  // 自分の事業所を持たない MEMBER。唯一の OWNER は退会できない
  const leavingEmail = await createTestUser({
    companyId: companyA,
    role: "MEMBER",
  });
  const leavingId = await userIdOf(leavingEmail);

  const owner = await signInWithMagicLink(browser, ownerEmail);
  const ownerPage = await owner.newPage();
  const teamUrl = await createTeam(ownerPage, "場面 6 のチーム");
  await assign(ownerPage, teamUrl, removedId);
  await assign(ownerPage, teamUrl, leavingId);

  const removed = await signInWithMagicLink(browser, removedEmail);
  const removedPage = await removed.newPage();
  await removedPage.goto(teamUrl);
  await expect(teamHeading(removedPage, "場面 6 のチーム")).toBeVisible();

  const leaving = await signInWithMagicLink(browser, leavingEmail);
  const leavingPage = await leaving.newPage();
  await leavingPage.goto(teamUrl);
  await expect(teamHeading(leavingPage, "場面 6 のチーム")).toBeVisible();

  await postToAuth(
    owner,
    `/api/account/companies/${companyA}/members/${removedId}/remove`,
  );
  await expectTeamHidden(removedPage, teamUrl, "場面 6 のチーム");

  await postToAuth(leaving, "/api/account/delete");
  await leavingPage.goto(teamUrl);
  await expect(leavingPage).toHaveURL(new RegExp(`^${AUTH_BASE_URL}/auth`));
  await expect(teamHeading(leavingPage, "場面 6 のチーム")).toHaveCount(0);

  await Promise.all([owner.close(), removed.close(), leaving.close()]);
});
