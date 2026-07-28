import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { parseCredentialKey } from "@rxwf/credential";
import { createSystemSettingsService } from "./system-settings-service.js";
import { getRuntimeConfig } from "./runtime-config.js";
import { SETTING_KEYS } from "./keys.js";

const testKey = parseCredentialKey(
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);

describe("getRuntimeConfig", () => {
  it("uses env defaults when DB empty, DB overrides when set", async () => {
    const db = await createTestDb();
    const svc = createSystemSettingsService(db, testKey);
    const defaults = { publicUrl: "http://env:8787", ollamaUrl: "http://127.0.0.1:11434", ollamaModel: "llama3", webhookSecret: "dev" };
    const a = await getRuntimeConfig(svc, defaults);
    expect(a.publicUrl).toBe("http://env:8787");
    await svc.set(SETTING_KEYS.publicUrl, "http://db:9000");
    const b = await getRuntimeConfig(svc, defaults);
    expect(b.publicUrl).toBe("http://db:9000");
  });

  it("isPasswordResetEnabled requires smtp host/port/from and publicUrl", async () => {
    const db = await createTestDb();
    const svc = createSystemSettingsService(db, testKey);
    const defaults = { publicUrl: "http://x", ollamaUrl: "http://127.0.0.1:11434", ollamaModel: "llama3", webhookSecret: "dev" };
    const cfg = await getRuntimeConfig(svc, defaults);
    expect(cfg.passwordResetEnabled).toBe(false);
    await svc.set(SETTING_KEYS.smtpHost, "smtp.test");
    await svc.set(SETTING_KEYS.smtpPort, "587");
    await svc.set(SETTING_KEYS.smtpFrom, "noreply@test.com");
    const cfg2 = await getRuntimeConfig(svc, defaults);
    expect(cfg2.passwordResetEnabled).toBe(true);
  });
});
