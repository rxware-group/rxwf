import { describe, it, expect } from "vitest";
import { createMailer } from "./mailer.js";

describe("createMailer", () => {
  it("sendMail invokes transport", async () => {
    const sent: unknown[] = [];
    const mailer = createMailer(
      {
        host: "smtp.test",
        port: 587,
        secure: false,
        user: "u",
        password: "p",
        from: "noreply@test.com",
      },
      {
        sendMail: async (opts) => {
          sent.push(opts);
          return { messageId: "1" };
        },
      },
    );
    await mailer.send({
      to: "a@test.com",
      subject: "Hi",
      text: "Body",
    });
    expect(sent).toHaveLength(1);
  });
});
