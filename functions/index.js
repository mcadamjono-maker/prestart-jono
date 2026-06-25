const { onRequest } = require("firebase-functions/v2/https");
const { Resend } = require("resend");

const MAX_ATTACHMENTS = 8;
const MAX_BASE64_ATTACHMENT_CHARS = 36 * 1024 * 1024;
const DEFAULT_TO_EMAIL = "jonomcadam@hotmail.com";
const DEFAULT_FROM_EMAIL = "WDL Field Forms <onboarding@resend.dev>";

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
      content_type: attachment?.contentType || "image/jpeg",
    };
  });
};

exports.sendReport = onRequest(
  {
    region: "australia-southeast1",
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 60,
    secrets: ["RESEND_API_KEY"],
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
      if (!process.env.RESEND_API_KEY) {
        response.status(500).json({ error: "RESEND_API_KEY is not configured." });
        return;
      }

      const reportType = normaliseReportType(request.body?.reportType);
      const subject = normaliseSubject(request.body?.subject);
      const message = String(request.body?.message || "").trim();

      if (!message) {
        response.status(400).json({ error: "Report message is required." });
        return;
      }

      const resend = new Resend(process.env.RESEND_API_KEY);
      const attachments = normaliseAttachments(request.body?.attachments);
      const emailResult = await resend.emails.send({
        from: process.env.EMAIL_FROM || DEFAULT_FROM_EMAIL,
        to: [process.env.EMAIL_TO || DEFAULT_TO_EMAIL],
        replyTo: process.env.REPLY_TO || process.env.EMAIL_TO || DEFAULT_TO_EMAIL,
        subject,
        text: message,
        html: buildReportHtml({ reportType, subject, message }),
        attachments,
      });

      if (emailResult.error) {
        response.status(502).json({
          error: emailResult.error.message || "Resend failed to send the email.",
        });
        return;
      }

      response.status(200).json({
        ok: true,
        id: emailResult.data?.id || null,
      });
    } catch (error) {
      response.status(500).json({
        error: error.message || "Unable to send report.",
      });
    }
  }
);
