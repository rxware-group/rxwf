import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { parseCredentialKey } from "@rxwf/credential";
import { createSystemSettingsService } from "./system-settings-service.js";
import { SETTING_KEYS, MASK } from "./keys.js";

const testKey = parseCredentialKey(
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);

describe("SystemSettingsService", () => {
  it("stores plaintext and encrypts sensitive values", async () => {
    const db = await createTestDb();
    const svc = createSystemSettingsService(db, testKey);
    await svc.set(SETTING_KEYS.publicUrl, "http://localhost:8787");
    await svc.set(SETTING_KEYS.smtpPassword, "secret-pass", true);
    expect(await svc.get(SETTING_KEYS.publicUrl)).toBe("http://localhost:8787");
    expect(await svc.get(SETTING_KEYS.smtpPassword)).toBe("secret-pass");
    const snap = await svc.getPublicSnapshot();
    expect(snap[SETTING_KEYS.publicUrl]).toBe("http://localhost:8787");
    expect(snap[SETTING_KEYS.smtpPassword]).toBe(MASK);
  });

  it("setMany skips empty sensitive updates", async () => {
    const db = await createTestDb();
    const svc = createSystemSettingsService(db, testKey);
    await svc.set(SETTING_KEYS.webhookSecret, "abc", true);
    await svc.setMany([{ key: SETTING_KEYS.webhookSecret, value: "", sensitive: true }]);
    expect(await svc.get(SETTING_KEYS.webhookSecret)).toBe("abc");
  });
});
