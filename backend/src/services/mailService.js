import nodemailer from "nodemailer";

let cachedTransporter = null;

async function createTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });

  cachedTransporter = transporter;
  console.log("Ethereal email:", testAccount.user);
  console.log("Ethereal pass :", testAccount.pass);
  return transporter;
}

export async function sendMail({ to, subject, html }) {
  const transporter = await createTransporter();
  const info = await transporter.sendMail({
    from: "TwinSide <no-reply@twinside.local>",
    to,
    subject,
    html,
  });
  console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
  return info;
}
