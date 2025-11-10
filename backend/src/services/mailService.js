import nodemailer from "nodemailer";
import {
  NODE_ENV,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} from "../config.js";

let cachedTransporter = null;

async function createTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return cachedTransporter;
  }

  if (NODE_ENV === "production") {
    throw new Error("SMTP credentials are not configured");
  }

  const testAccount = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });

  console.log("Mail preview account generated for development use only");
  return cachedTransporter;
}

export async function sendMail({ to, subject, html }) {
  const transporter = await createTransporter();
  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log("Preview URL:", previewUrl);
  }

  return info;
}
