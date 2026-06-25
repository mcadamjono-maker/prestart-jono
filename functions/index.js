const { onRequest } = require("firebase-functions/v2/https");

const MAX_ATTACHMENTS = 8;
const MAX_BASE64_ATTACHMENT_CHARS = 36 * 1024 * 1024;
const DEFAULT_TO_EMAIL = "Jonomcadam@hotmail.com";
const DEFAULT_FROM_EMAIL = "WDL Field Forms <no-reply@maileroo.com>";
const DEFAULT_SMTP_HOST = "smtp.maileroo.com";
const ALLOWED_RECIPIENT_DOMAINS = ["williamsdrainage.co.nz"];
const ALLOWED_RECIPIENT_EMAILS = [DEFAULT_TO_EMAIL.toLowerCase()];

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normaliseSubject = (subject) =>
  String(subject || "WDL Field Forms report").replace(/[\r\n]+/g, " ").trim();

const normaliseReportType = (reportType) =>
  String(reportType || "report").replace(/[^a-zA-Z0-9 _-]/g, "").trim();

const normaliseRecipientEmail = (email) => {
  const recipientEmail = String(email || "").trim();

  if (!recipientEmail) return smtpTo;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    throw new Error("Recipient email is not valid.");
  }

  const lowerRecipientEmail = recipientEmail.toLowerCase();
  const recipientDomain = lowerRecipientEmail.split("@").pop();

  if (
    !ALLOWED_RECIPIENT_EMAILS.includes(lowerRecipientEmail) &&
    !ALLOWED_RECIPIENT_DOMAINS.includes(recipientDomain)
  ) {
    throw new Error(
      "Recipient email must be the default address or a Williams Drainage email address."
    );
  }

  return recipientEmail;
};

const normaliseFilename = (filename, index) =>
  String(filename || `report-photo-${index + 1}.jpg`)
    .replace(/[^\w.\- ]/g, "_")
    .slice(0, 100);

const buildReportHtml = ({ reportType, subject, message }) => `
  <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.45; max-width: 760px;">
    <div style="border-bottom: 4px solid #d7ff2f; padding-bottom: 14px; margin-bottom: 18px;">
      <p style="margin: 0; color: #555; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">
        Williams Drainage Limited
      </p>
      <h2 style="margin: 4px 0 0; font-size: 24px;">${escapeHtml(reportType)}</h2>
    </div>

    <table style="border-collapse: collapse; width: 100%; margin-bottom: 18px;">
      <tr>
        <td style="padding: 9px 10px; border: 1px solid #ddd; font-weight: bold; width: 34%;">Subject</td>
        <td style="padding: 9px 10px; border: 1px solid #ddd;">${escapeHtml(subject)}</td>
      </tr>
    </table>

    <h3 style="margin: 18px 0 8px; font-size: 16px;">Filed Report</h3>
    <pre style="background: #f7f7f7; border: 1px solid #ddd; padding: 14px; white-space: pre-wrap; font-family: Consolas, monospace; font-size: 13px;">${escapeHtml(message)}</pre>

    <p style="margin-top: 18px; color: #666; font-size: 12px;">
      Submitted from the WDL Field Forms app.
    </p>
  </div>
`;

const normaliseAttachments = (attachments = []) => {
  if (!Array.isArray(attachments)) return [];

  let totalBase64Chars = 0;

  return attachments.slice(0, MAX_ATTACHMENTS).map((attachment, index) => {
    const content = String(attachment?.content || "");

    totalBase64Chars += content.length;

    if (totalBase64Chars > MAX_BASE64_ATTACHMENT_CHARS) {
      throw new Error("Attachments are too large to send.");
    }

    if (!content) {
      throw new Error("One or more attachments are missing file content.");
    }

    return {
      filename: normaliseFilename(attachment?.filename, index),
      content,
      contentType: attachment?.contentType || "image/jpeg",
      encoding: "base64",
    };
  });
};

const smtpHost = process.env.MAILEROO_SMTP_HOST || DEFAULT_SMTP_HOST;
const smtpPort = Number(process.env.MAILEROO_SMTP_PORT || 587);
const smtpUser = (process.env.MAILEROO_SMTP_USER || "").trim();
const smtpPass = (process.env.MAILEROO_SMTP_PASS || "").trim();
const smtpFrom = process.env.MAILEROO_FROM || DEFAULT_FROM_EMAIL;
const smtpTo = process.env.MAILEROO_TO || DEFAULT_TO_EMAIL;
const smtpReplyTo = process.env.MAILEROO_REPLY_TO || smtpTo;

exports.sendReport = onRequest(
  {
    region: "australia-southeast1",
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 60,
    secrets: ["MAILEROO_SMTP_USER", "MAILEROO_SMTP_PASS"],
  },
  async (request, response) => {
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({ error: "POST required." });
      return;
    }

    try {
      if (!smtpUser || !smtpPass) {
        response.status(500).json({
          error: "MAILEROO_SMTP_USER and MAILEROO_SMTP_PASS are not configured.",
        });
        return;
      }

      const reportType = normaliseReportType(request.body?.reportType);
      const subject = normaliseSubject(request.body?.subject);
      const message = String(request.body?.message || "").trim();
      const recipientEmail = normaliseRecipientEmail(
        request.body?.recipientEmail || request.body?.fields?.recipient_email
      );

      if (!message) {
        response.status(400).json({ error: "Report message is required." });
        return;
      }

      const nodemailer = require("nodemailer");

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const attachments = normaliseAttachments(request.body?.attachments);

      const emailResult = await transporter.sendMail({
        from: smtpFrom,
        to: recipientEmail,
        replyTo: smtpReplyTo,
        subject,
        text: message,
        html: buildReportHtml({ reportType, subject, message }),
        attachments,
      });

      response.status(200).json({
        ok: true,
        id: emailResult.messageId || null,
      });
    } catch (error) {
      console.error("sendReport failed", {
        message: error.message,
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
      });

      response.status(500).json({
        error: error.message || "Unable to send report.",
      });
    }
  }
);
