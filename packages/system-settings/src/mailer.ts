import nodemailer from "nodemailer";
import type { RuntimeConfig } from "./runtime-config.js";

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
}

export function createMailer(
  smtp: RuntimeConfig["smtp"],
  transport?: { sendMail: (opts: nodemailer.SendMailOptions) => Promise<unknown> },
) {
  const transporter =
    transport ??
    nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    });

  return {
    async send(payload: MailPayload) {
      await transporter.sendMail({
        from: smtp.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      });
    },
  };
}
