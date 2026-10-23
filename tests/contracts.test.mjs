import { test } from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { deriveProof } from "../src/password.mjs";
import { parseCSV, serializeCSV } from "../src/csv.mjs";
test("browser password protocol agrees with PBKDF2 SHA256 and rejects downgrade", async () => {
  const c = {
    algorithm: "PBKDF2-SHA256-v1",
    iterations: 600000,
    salt: "1234567890abcdef1234567890abcdef",
  };
  const password = "test-only-long-password!";
  const expected = pbkdf2Sync(
    password,
    Buffer.from(c.salt, "hex"),
    600000,
    32,
    "sha256",
  ).toString("hex");
  assert.equal(await deriveProof(password, c), expected);
  assert.notEqual(await deriveProof(password + "x", c), expected);
  await assert.rejects(() => deriveProof(password, { ...c, iterations: 1 }));
  await assert.rejects(() => deriveProof(password, { ...c, salt: "invalid" }));
});
test("downloaded CSV template round trips Unicode and quoted values", () => {
  const header = ["external_key", "display_name", "username", "A"];
  const rows = [
    { external_key: "001", display_name: '选手,"甲"', username: "", A: 0 },
  ];
  assert.deepEqual(parseCSV(serializeCSV(header, rows)), [
    { external_key: "001", display_name: '选手,"甲"', username: "", A: "0" },
  ]);
});
test("CSV export neutralizes spreadsheet formulas", () => {
  assert.equal(
    parseCSV(serializeCSV(["name"], [{ name: '=HYPERLINK("test")' }]))[0].name,
    '\'=HYPERLINK("test")',
  );
});
