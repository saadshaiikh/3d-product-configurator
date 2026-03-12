const { test, expect, request: playwrightRequest } = require("@playwright/test");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts");

function ensureArtifactsDir() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

function seedShoeData() {
  const sql = `
INSERT INTO models (id, display_name, status, gltf_url, thumbnail_url)
VALUES ('shoe', 'Shoe', 'published', 'http://localhost:8080/static/models/shoe/model.gltf', 'http://localhost:8080/static/models/shoe/thumb.png')
ON CONFLICT (id) DO NOTHING;

INSERT INTO model_parts (model_id, part_id, display_name, selectable, sort_order, default_color, mesh_selectors)
VALUES
  ('shoe','sole','Sole',true,1,'#ffffff','["SoleMesh"]'::jsonb),
  ('shoe','laces','Laces',true,2,'#111111',NULL)
ON CONFLICT (model_id, part_id) DO NOTHING;

INSERT INTO model_aliases (model_id, alias, part_id)
VALUES
  ('shoe','bottom','sole'),
  ('shoe','strings','laces')
ON CONFLICT (model_id, alias) DO NOTHING;
`;

  try {
    execSync(
      `docker compose exec -T db psql -U app -d appdb -v ON_ERROR_STOP=1 -c "${sql.replace(/\n/g, " ").replace(/\s+/g, " ")}"`,
      { stdio: "pipe" }
    );
  } catch (err) {
    const stderr = err?.stderr?.toString?.() || "";
    console.warn("Seed failed:", stderr.trim());
  }
}

async function getColors(page) {
  const raw = await page.getByTestId("colors-json").textContent();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function lowerHex(value) {
  return String(value || "").toLowerCase();
}

test("Save/share + deep-link restore + resave", async ({ browser }, testInfo) => {
  ensureArtifactsDir();
  seedShoeData();

  const consoleLogs = [];

  const context = await browser.newContext({
    recordHar: {
      path: path.join(ARTIFACTS_DIR, "config-save-share-restore.har"),
      content: "embed",
    },
  });

  const page = await context.newPage();
  page.on("console", (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto("/");

  await expect(page.getByTestId("selected-model")).toContainText(/shoe/i);

  await page.getByTestId("style-input").fill("sole #ffffff, laces #111111");
  await page.getByTestId("style-apply").click();

  await expect.poll(async () => lowerHex((await getColors(page)).sole)).toBe("#ffffff");
  await expect.poll(async () => lowerHex((await getColors(page)).laces)).toBe("#111111");

  const saveResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/configs") && res.request().method() === "POST"
  );
  await page.getByTestId("save-config").click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(201);

  await page.waitForURL(/\/c\/[0-9a-f-]{36}/i);
  const url1 = page.url();
  const id1 = url1.split("/c/")[1];

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "after-save.png"),
    fullPage: true,
  });

  const api = await playwrightRequest.newContext({
    baseURL: "http://localhost:8080",
  });

  const cfg1Res = await api.get(`/configs/${id1}`);
  expect(cfg1Res.status()).toBe(200);
  const cfg1 = await cfg1Res.json();

  expect(cfg1?.config?.id).toBe(id1);
  expect(cfg1?.config?.modelId).toBe("shoe");
  expect(lowerHex(cfg1?.config?.colors?.sole)).toBe("#ffffff");
  expect(lowerHex(cfg1?.config?.colors?.laces)).toBe("#111111");

  const page2 = await context.newPage();
  page2.on("console", (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  await page2.goto(`/c/${id1}`);
  await expect(page2.getByTestId("selected-model")).toContainText(/shoe/i);

  await expect.poll(async () => lowerHex((await getColors(page2)).sole)).toBe("#ffffff");
  await expect.poll(async () => lowerHex((await getColors(page2)).laces)).toBe("#111111");

  await page2.reload({ waitUntil: "networkidle" });

  await expect.poll(async () => lowerHex((await getColors(page2)).sole)).toBe("#ffffff");
  await expect.poll(async () => lowerHex((await getColors(page2)).laces)).toBe("#111111");

  await page2.screenshot({
    path: path.join(ARTIFACTS_DIR, "after-restore.png"),
    fullPage: true,
  });

  await page2.getByTestId("style-input").fill("sole #ff00ff");
  await page2.getByTestId("style-apply").click();

  await expect.poll(async () => lowerHex((await getColors(page2)).sole)).toBe("#ff00ff");

  const saveResponsePromise2 = page2.waitForResponse(
    (res) => res.url().includes("/configs") && res.request().method() === "POST"
  );
  await page2.getByTestId("save-config").click();
  const saveResponse2 = await saveResponsePromise2;
  expect(saveResponse2.status()).toBe(201);

  await page2.waitForURL(/\/c\/[0-9a-f-]{36}/i);
  const url2 = page2.url();
  const id2 = url2.split("/c/")[1];

  const cfg2Res = await api.get(`/configs/${id2}`);
  expect(cfg2Res.status()).toBe(200);
  const cfg2 = await cfg2Res.json();
  expect(cfg2?.config?.id).toBe(id2);
  expect(lowerHex(cfg2?.config?.colors?.sole)).toBe("#ff00ff");

  const idsText = `ID1=${id1}\nID2=${id2}\n`;
  const idsPath = path.join(ARTIFACTS_DIR, "config-save-share-restore-ids.txt");
  fs.writeFileSync(idsPath, idsText);

  const consolePath = path.join(ARTIFACTS_DIR, "config-save-share-restore-console.log");
  fs.writeFileSync(consolePath, consoleLogs.join("\n"));

  testInfo.attach("config-ids", { path: idsPath, contentType: "text/plain" });
  testInfo.attach("config-console", { path: consolePath, contentType: "text/plain" });

  await api.dispose();
  await context.close();

  console.log(idsText.trim());
});
