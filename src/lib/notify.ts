// Email (through SBD's Google Workspace SMTP) and SMS (through an HTTP SMS gateway).
// Both are optional: if the settings are missing, nothing is sent and nothing breaks.
import { SITE } from "./config";

export const emailConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
export const smsConfigured = () => Boolean(process.env.SMS_API_URL);

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailConfigured() || !to) return false;
  try {
    const nodemailer = (await import("nodemailer")).default;
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com", port: Number(process.env.SMTP_PORT ?? 465), secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.sendMail({ from: `"${SITE.name}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`, to, subject, text: `${text}\n\n${SITE.name}\n${SITE.phone} · ${SITE.emailSupport}` });
    return true;
  } catch (e) {
    console.error("email failed", e);
    return false;
  }
}

/** SMS_API_URL is the gateway's send address with {to} and {text} placeholders, as given by the SMS provider. */
export async function sendSms(to: string, text: string): Promise<boolean> {
  const tpl = process.env.SMS_API_URL;
  if (!tpl || !to) return false;
  try {
    const digits = to.replace(/\D/g, "");
    const number = digits.startsWith("880") ? digits : `88${digits.slice(-11)}`;
    const res = await fetch(tpl.replace("{to}", encodeURIComponent(number)).replace("{text}", encodeURIComponent(text)), { cache: "no-store", signal: AbortSignal.timeout(10000) });
    return res.ok;
  } catch (e) {
    console.error("sms failed", e);
    return false;
  }
}

/** Tells the customer about an order update by every channel we have for them. Never throws. */
export async function notifyOrder(order: { name: string; phone: string; email: string; number: string; code: string }, message: string, base: string): Promise<void> {
  const link = `${base}/order/${order.code}`;
  await Promise.allSettled([
    sendSms(order.phone, `SBD ${order.number}: ${message} ${link}`),
    sendEmail(order.email, `Order ${order.number}: ${message}`, `Hello ${order.name || ""},\n\n${message}\n\nTrack your order: ${link}`),
  ]);
}
