const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const MAX_ATTACHMENTS = 8;
const MAX_BASE64_ATTACHMENT_CHARS = 36 * 1024 * 1024;
const DEFAULT_TO_EMAIL = "Jonomcadam@hotmail.com";
const DEFAULT_FROM_EMAIL = "WDL Field Forms <no-reply@maileroo.com>";
const DEFAULT_SMTP_HOST = "smtp.maileroo.com";
const ALLOWED_RECIPIENT_DOMAINS = ["williamsdrainage.co.nz"];
const ALLOWED_RECIPIENT_EMAILS = [DEFAULT_TO_EMAIL.toLowerCase()];

if (!admin.apps.length) {
  admin.initializeApp();
}

const getFirestore = () => admin.firestore();

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

const formatReportHeading = (reportType) => {
  const cleanedReportType = normaliseReportType(reportType)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const knownReportHeadings = {
    prestart: "Prestart Checklist",
    "prestart checklist": "Prestart Checklist",
    incident: "Incident Report",
    "incident report": "Incident Report",
    "purchase order": "Purchase Order Request",
    "purchase order request": "Purchase Order Request",
    "job variation": "Job Variation Request",
    "job variation request": "Job Variation Request",
    "hazard id": "Hazard ID",
    "hazard identification worksheet": "Hazard ID",
    "as built": "As-Built Plan",
    "as built plan": "As-Built Plan",
  };
  const lowerReportType = cleanedReportType.toLowerCase();

  if (knownReportHeadings[lowerReportType]) {
    return knownReportHeadings[lowerReportType];
  }

  return (
    cleanedReportType.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()) ||
    "Report"
  );
};

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

const normaliseMapAddress = (address) =>
  String(address || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);

const normaliseJobNumber = (jobNumber) => {
  const digits = String(jobNumber || "").replace(/\D/g, "");

  if (!digits) return "";

  return digits.slice(0, 4).padStart(4, "0");
};

const normaliseJobName = (jobName) =>
  String(jobName || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

const formatJob = (doc) => {
  const data = doc.data() || {};

  return {
    number: data.number || doc.id,
    name: data.name || "",
  };
};

const buildReportHtml = ({ reportType, subject, message }) => `
  <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.45; max-width: 760px;">
    <div style="border-bottom: 4px solid #d7ff2f; padding-bottom: 14px; margin-bottom: 18px;">
      <p style="margin: 0; color: #555; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">
        Williams Drainage Limited
      </p>
      <h2 style="margin: 4px 0 0; font-size: 24px;">${escapeHtml(formatReportHeading(reportType))}</h2>
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

const toPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const toSearchText = (...values) =>
  values
    .flatMap((value) => {
      if (Array.isArray(value)) return value.map((item) => JSON.stringify(item));
      if (value && typeof value === "object") return JSON.stringify(value);
      return String(value || "");
    })
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);

const getStringField = (fields, keys) => {
  for (const key of keys) {
    const value = fields?.[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
};

const getReportStatus = (reportType, fields = {}) => {
  const heading = formatReportHeading(reportType).toLowerCase();

  if (heading === "purchase order request") {
    return getStringField(fields, ["status"]) || "Pending";
  }

  if (heading === "hazard id") return "Active";

  return "Filed";
};

const getWeekStartIso = (date = new Date()) => {
  const weekDate = new Date(date);
  const day = weekDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  weekDate.setHours(0, 0, 0, 0);
  weekDate.setDate(weekDate.getDate() + diffToMonday);

  return weekDate.toISOString().slice(0, 10);
};

const normaliseWeekStart = (weekStart) => {
  const cleanedWeekStart = String(weekStart || "").trim().slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanedWeekStart)) {
    return cleanedWeekStart;
  }

  return getWeekStartIso(new Date());
};

const buildHazardDraftId = (jobNumber, weekStart) =>
  `${normaliseWeekStart(weekStart)}_${normaliseJobNumber(jobNumber)}`;

const normaliseStringMap = (value = {}) => {
  const source = toPlainObject(value);
  const output = {};

  Object.keys(source)
    .slice(0, 80)
    .forEach((key) => {
      output[String(key).slice(0, 160)] = Boolean(source[key]);
    });

  return output;
};

const parseSignedAtDate = (signedAt, fallbackDate = new Date()) => {
  const parsedDate = new Date(String(signedAt || ""));

  if (!Number.isNaN(parsedDate.getTime())) return parsedDate;

  return fallbackDate;
};

const normaliseSignOns = (formData = {}, fields = {}, submittedAt = new Date()) => {
  if (Array.isArray(formData.signOns)) {
    return formData.signOns
      .map((signOn) => {
        const name = String(signOn?.name || "").trim();
        const signedAt = String(signOn?.signedAt || "").trim();
        const signedDate = parseSignedAtDate(signedAt, submittedAt);

        if (!name) return null;

        return {
          name,
          signedAt: signedAt || submittedAt.toISOString(),
          date: signedDate.toISOString().slice(0, 10),
          weekStart: getWeekStartIso(signedDate),
          signatureCaptured: Boolean(signOn?.signatureCaptured),
        };
      })
      .filter(Boolean);
  }

  const summary = String(fields.signed_on_workers || "");

  if (!summary || summary.toLowerCase().includes("no workers")) return [];

  return summary
    .split(/\n+/)
    .map((line) => {
      const match = line.match(/^\s*\d+\.\s*(.*?)\s+-\s+(.*?)\s+-/);

      if (!match) return null;

      const signedDate = parseSignedAtDate(match[2], submittedAt);

      return {
        name: match[1].trim(),
        signedAt: match[2].trim(),
        date: signedDate.toISOString().slice(0, 10),
        weekStart: getWeekStartIso(signedDate),
        signatureCaptured: true,
      };
    })
    .filter(Boolean);
};

const normaliseHazardDraftSignOns = (signOns = [], submittedAt = new Date()) => {
  if (!Array.isArray(signOns)) return [];

  return signOns
    .slice(0, 250)
    .map((signOn) => {
      const name = String(signOn?.name || "").trim().slice(0, 120);
      const signedAt = String(signOn?.signedAt || "").trim();
      const signedDate = parseSignedAtDate(signedAt, submittedAt);
      const signatureStrokes = Array.isArray(signOn?.signatureStrokes)
        ? signOn.signatureStrokes.slice(0, 20).map((stroke) =>
            Array.isArray(stroke)
              ? stroke.slice(0, 220).map((point) => ({
                  x: Number(point?.x) || 0,
                  y: Number(point?.y) || 0,
                }))
              : []
          )
        : [];

      if (!name) return null;

      return {
        name,
        signedAt: signedAt || submittedAt.toISOString(),
        date: signedDate.toISOString().slice(0, 10),
        weekStart: getWeekStartIso(signedDate),
        signatureCaptured: signatureStrokes.length > 0,
        signatureStrokesJson: JSON.stringify(signatureStrokes).slice(0, 60000),
      };
    })
    .filter(Boolean);
};

const publicHazardSignOns = (signOns = []) =>
  Array.isArray(signOns)
    ? signOns.map((signOn) => {
        let signatureStrokes = [];

        try {
          signatureStrokes = JSON.parse(signOn.signatureStrokesJson || "[]");
        } catch {
          signatureStrokes = [];
        }

        return {
          name: signOn.name || "",
          signedAt: signOn.signedAt || "",
          date: signOn.date || "",
          weekStart: signOn.weekStart || "",
          signatureCaptured: Boolean(signOn.signatureCaptured),
          signatureStrokes,
        };
      })
    : [];

const buildHazardDraft = (body = {}) => {
  const now = new Date();
  const jobNumber = normaliseJobNumber(body.jobNumber);
  const jobName = normaliseJobName(body.jobName);
  const weekStart = normaliseWeekStart(body.weekStart);
  const signOns = normaliseHazardDraftSignOns(body.signOns, now);

  if (!jobNumber) {
    throw new Error("Job number is required.");
  }

  if (!jobName) {
    throw new Error("Job name is required.");
  }

  return {
    reportType: "Hazard ID",
    status: "Active Draft",
    jobNumber,
    jobName,
    weekStart,
    siteAddress: String(body.siteAddress || "").trim().slice(0, 180),
    taskDescription: String(body.taskDescription || "").trim().slice(0, 500),
    preparedBy: String(body.preparedBy || "").trim().slice(0, 120),
    startDate: String(body.startDate || "").trim().slice(0, 80),
    finishDate: String(body.finishDate || "").trim().slice(0, 80),
    yardChecks: normaliseStringMap(body.yardChecks),
    siteChecks: normaliseStringMap(body.siteChecks),
    risks: String(body.risks || "").trim().slice(0, 2500),
    controls: normaliseStringMap(body.controls),
    extraControls: String(body.extraControls || "").trim().slice(0, 2500),
    toolboxMeeting: String(body.toolboxMeeting || "").trim().slice(0, 2500),
    signOffNotes: String(body.signOffNotes || "").trim().slice(0, 2500),
    signOns,
    searchText: toSearchText(
      "Hazard ID",
      jobNumber,
      jobName,
      body.siteAddress,
      body.taskDescription,
      body.preparedBy,
      signOns
    ),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAtIso: now.toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

const publicHazardDraft = (doc) => {
  const data = doc.data() || {};
  const signOns = publicHazardSignOns(data.signOns || []);

  return {
    id: doc.id,
    reportType: "Hazard ID",
    subject: `Hazard ID Draft - ${data.jobName || data.jobNumber || doc.id}`,
    message: "Active weekly Hazard ID draft.",
    fields: {
      job_number: data.jobNumber || "",
      job_name: data.jobName || "",
      week_start: data.weekStart || "",
      site_address: data.siteAddress || "",
      task_description: data.taskDescription || "",
      prepared_by: data.preparedBy || "",
    },
    formData: {
      jobNumber: data.jobNumber || "",
      jobName: data.jobName || "",
      weekStart: data.weekStart || "",
      siteAddress: data.siteAddress || "",
      taskDescription: data.taskDescription || "",
      preparedBy: data.preparedBy || "",
      startDate: data.startDate || "",
      finishDate: data.finishDate || "",
      yardChecks: data.yardChecks || {},
      siteChecks: data.siteChecks || {},
      risks: data.risks || "",
      controls: data.controls || {},
      extraControls: data.extraControls || "",
      toolboxMeeting: data.toolboxMeeting || "",
      signOffNotes: data.signOffNotes || "",
      signOns,
    },
    status: data.status || "Active Draft",
    jobNumber: data.jobNumber || "",
    jobName: data.jobName || "",
    siteAddress: data.siteAddress || "",
    requestedBy: data.preparedBy || "",
    yardChecks: data.yardChecks || {},
    siteChecks: data.siteChecks || {},
    risks: data.risks || "",
    controls: data.controls || {},
    extraControls: data.extraControls || "",
    toolboxMeeting: data.toolboxMeeting || "",
    signOffNotes: data.signOffNotes || "",
    signOns,
    submittedAtIso: data.updatedAtIso || "",
    weekStart: data.weekStart || "",
  };
};

const buildStoredReport = ({
  reportType,
  subject,
  message,
  recipientEmail,
  fields,
  formData,
  attachments,
}) => {
  const now = new Date();
  const safeFields = toPlainObject(fields);
  const safeFormData = toPlainObject(formData);
  const heading = formatReportHeading(reportType);
  const jobNumber = getStringField(safeFields, [
    "job_number",
    "machine",
    "template",
  ]);
  const jobName = getStringField(safeFields, [
    "job_name",
    "site_address",
    "address",
    "incident_location",
  ]);
  const signOns = normaliseSignOns(safeFormData, safeFields, now);

  return {
    reportType: heading,
    subject,
    message,
    recipientEmail,
    fields: safeFields,
    formData: safeFormData,
    status: getReportStatus(reportType, safeFields),
    jobNumber,
    jobName,
    siteAddress: getStringField(safeFields, ["site_address", "address"]),
    requestedBy: getStringField(safeFields, [
      "requested_by",
      "operator",
      "prepared_by",
      "incident_reporter",
    ]),
    supplier: getStringField(safeFields, ["supplier"]),
    purchaseOrderNumber: getStringField(safeFields, [
      "purchase_order_number",
      "po_number",
    ]),
    attachmentSummary: attachments.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
    })),
    signOns,
    submittedAt: admin.firestore.Timestamp.fromDate(now),
    submittedAtIso: now.toISOString(),
    weekStart:
      getStringField(safeFields, ["week_start"]) ||
      safeFormData.weekStart ||
      signOns[0]?.weekStart ||
      getWeekStartIso(now),
    searchText: toSearchText(
      heading,
      subject,
      message,
      safeFields,
      safeFormData,
      signOns
    ),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

const publicReport = (doc) => {
  const data = doc.data() || {};

  return {
    id: doc.id,
    reportType: data.reportType || "",
    subject: data.subject || "",
    message: data.message || "",
    fields: data.fields || {},
    formData: data.formData || {},
    status: data.status || "Filed",
    jobNumber: data.jobNumber || "",
    jobName: data.jobName || "",
    siteAddress: data.siteAddress || "",
    requestedBy: data.requestedBy || "",
    supplier: data.supplier || "",
    purchaseOrderNumber: data.purchaseOrderNumber || "",
    adminNote: data.adminNote || "",
    attachmentSummary: data.attachmentSummary || [],
    signOns: data.signOns || [],
    submittedAtIso: data.submittedAtIso || "",
    weekStart: data.weekStart || "",
  };
};

const getDashboardAccessCode = () =>
  String(process.env.DASHBOARD_ACCESS_CODE || "").trim();

const assertDashboardAccess = (request) => {
  const accessCode = getDashboardAccessCode();

  if (!accessCode) return;

  const suppliedCode = String(
    request.get("x-dashboard-code") ||
      request.query?.accessCode ||
      request.body?.accessCode ||
      ""
  ).trim();

  if (suppliedCode !== accessCode) {
    const error = new Error("Dashboard access code is not valid.");

    error.statusCode = 401;
    throw error;
  }
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
      const fields = toPlainObject(request.body?.fields);
      const formData = toPlainObject(request.body?.formData);

      const emailResult = await transporter.sendMail({
        from: smtpFrom,
        to: recipientEmail,
        replyTo: smtpReplyTo,
        subject,
        text: message,
        html: buildReportHtml({ reportType, subject, message }),
        attachments,
      });
      const reportRef = await getFirestore().collection("reports").add(
        buildStoredReport({
          reportType,
          subject,
          message,
          recipientEmail,
          fields,
          formData,
          attachments,
        })
      );

      response.status(200).json({
        ok: true,
        id: emailResult.messageId || null,
        reportId: reportRef.id,
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

exports.jobs = onRequest(
  {
    region: "australia-southeast1",
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request, response) => {
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    try {
      const jobsCollection = getFirestore().collection("jobs");

      if (request.method === "GET") {
        const snapshot = await jobsCollection.orderBy("number").get();
        const jobs = snapshot.docs.map(formatJob).filter((job) => job.name);

        response.status(200).json({ ok: true, jobs });
        return;
      }

      if (request.method === "POST") {
        const jobNumber = normaliseJobNumber(request.body?.number);
        const jobName = normaliseJobName(request.body?.name);

        if (!jobNumber) {
          response.status(400).json({ error: "Job number is required." });
          return;
        }

        if (!jobName) {
          response.status(400).json({ error: "Job name is required." });
          return;
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const jobRef = jobsCollection.doc(jobNumber);

        await jobRef.set(
          {
            number: jobNumber,
            name: jobName,
            updatedAt: now,
            createdAt: now,
          },
          { merge: true }
        );

        response.status(200).json({
          ok: true,
          job: {
            number: jobNumber,
            name: jobName,
          },
        });
        return;
      }

      response.status(405).json({ error: "GET or POST required." });
    } catch (error) {
      console.error("jobs failed", { message: error.message });
      response.status(500).json({
        error: error.message || "Unable to update jobs.",
      });
    }
  }
);

exports.hazardId = onRequest(
  {
    region: "australia-southeast1",
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (request, response) => {
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    try {
      const db = getFirestore();
      const hazardCollection = db.collection("hazardIds");

      if (request.method === "GET") {
        const jobNumber = normaliseJobNumber(request.query?.jobNumber);
        const weekStart = normaliseWeekStart(request.query?.weekStart);

        if (jobNumber) {
          const doc = await hazardCollection
            .doc(buildHazardDraftId(jobNumber, weekStart))
            .get();

          response.status(200).json({
            ok: true,
            draft: doc.exists ? publicHazardDraft(doc) : null,
          });
          return;
        }

        const snapshot = await hazardCollection
          .where("weekStart", "==", weekStart)
          .limit(200)
          .get();

        response.status(200).json({
          ok: true,
          drafts: snapshot.docs.map(publicHazardDraft),
        });
        return;
      }

      if (request.method === "POST") {
        const action = String(request.body?.action || "save");
        const jobNumber = normaliseJobNumber(request.body?.jobNumber);
        const weekStart = normaliseWeekStart(request.body?.weekStart);

        if (!jobNumber) {
          response.status(400).json({ error: "Job number is required." });
          return;
        }

        const docRef = hazardCollection.doc(
          buildHazardDraftId(jobNumber, weekStart)
        );

        if (action === "delete" || action === "submitted") {
          await docRef.delete();
          response.status(200).json({ ok: true });
          return;
        }

        const draft = buildHazardDraft(request.body);

        await docRef.set(draft, { merge: true });

        response.status(200).json({
          ok: true,
          draft: publicHazardDraft(await docRef.get()),
        });
        return;
      }

      response.status(405).json({ error: "GET or POST required." });
    } catch (error) {
      console.error("hazardId failed", { message: error.message });
      response.status(500).json({
        error: error.message || "Unable to update the Hazard ID.",
      });
    }
  }
);

exports.dashboard = onRequest(
  {
    region: "australia-southeast1",
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (request, response) => {
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    try {
      assertDashboardAccess(request);

      const db = getFirestore();
      const reportsCollection = db.collection("reports");
      const resource = String(
        request.query?.resource || request.body?.resource || "summary"
      );

      if (request.method === "GET") {
        if (resource === "summary") {
          const currentWeekStart = getWeekStartIso(new Date());
          const [reportsSnapshot, jobsSnapshot, hazardDraftsSnapshot] =
            await Promise.all([
            reportsCollection.orderBy("submittedAt", "desc").limit(120).get(),
            db.collection("jobs").orderBy("number").get(),
            db
              .collection("hazardIds")
              .where("weekStart", "==", currentWeekStart)
              .limit(200)
              .get(),
          ]);
          const reports = reportsSnapshot.docs.map(publicReport);
          const purchaseRequests = reports.filter(
            (report) => report.reportType === "Purchase Order Request"
          );
          const hazardReports = [
            ...hazardDraftsSnapshot.docs.map(publicHazardDraft),
            ...reports.filter((report) => report.reportType === "Hazard ID"),
          ];

          response.status(200).json({
            ok: true,
            jobs: jobsSnapshot.docs.map(formatJob).filter((job) => job.name),
            reports,
            purchaseRequests,
            hazardReports,
          });
          return;
        }

        if (resource === "reports") {
          const search = String(request.query?.search || "").toLowerCase().trim();
          const type = String(request.query?.type || "").trim();
          const limit = Math.min(Number(request.query?.limit || 120), 250);
          const snapshot = await reportsCollection
            .orderBy("submittedAt", "desc")
            .limit(limit)
            .get();
          let reports = snapshot.docs.map(publicReport);

          if (type) {
            reports = reports.filter((report) => report.reportType === type);
          }

          if (search) {
            reports = reports.filter((report) =>
              toSearchText(
                report.reportType,
                report.subject,
                report.message,
                report.fields,
                report.formData,
                report.signOns
              ).includes(search)
            );
          }

          response.status(200).json({ ok: true, reports });
          return;
        }

        if (resource === "calendar") {
          const weekStart = String(
            request.query?.weekStart || getWeekStartIso(new Date())
          ).slice(0, 10);
          const [reportsSnapshot, draftsSnapshot] = await Promise.all([
            reportsCollection
              .where("reportType", "==", "Hazard ID")
              .where("weekStart", "==", weekStart)
              .limit(200)
              .get(),
            db
              .collection("hazardIds")
              .where("weekStart", "==", weekStart)
              .limit(200)
              .get(),
          ]);
          const entries = [];
          const hazardDocs = [
            ...draftsSnapshot.docs.map(publicHazardDraft),
            ...reportsSnapshot.docs.map(publicReport),
          ];

          hazardDocs.forEach((report) => {
            (report.signOns || []).forEach((signOn) => {
              entries.push({
                reportId: report.id,
                jobName: report.jobName || report.siteAddress || report.subject,
                siteAddress: report.siteAddress,
                taskDescription: report.formData?.taskDescription || "",
                name: signOn.name,
                date: signOn.date,
                signedAt: signOn.signedAt,
              });
            });
          });

          response.status(200).json({ ok: true, weekStart, entries });
          return;
        }

        response.status(400).json({ error: "Unknown dashboard resource." });
        return;
      }

      if (request.method === "POST") {
        const action = String(request.body?.action || "");

        if (action === "addJob") {
          const jobNumber = normaliseJobNumber(request.body?.number);
          const jobName = normaliseJobName(request.body?.name);

          if (!jobNumber || !jobName) {
            response
              .status(400)
              .json({ error: "Job number and job name are required." });
            return;
          }

          await db.collection("jobs").doc(jobNumber).set(
            {
              number: jobNumber,
              name: jobName,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          response.status(200).json({
            ok: true,
            job: { number: jobNumber, name: jobName },
          });
          return;
        }

        if (action === "updatePurchase") {
          const reportId = String(request.body?.reportId || "").trim();
          const status = String(request.body?.status || "Pending").trim();
          const poNumber = String(request.body?.poNumber || "").trim();
          const adminNote = String(request.body?.adminNote || "").trim();

          if (!reportId) {
            response.status(400).json({ error: "Report ID is required." });
            return;
          }

          await reportsCollection.doc(reportId).set(
            {
              status,
              purchaseOrderNumber: poNumber,
              adminNote,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          response.status(200).json({ ok: true });
          return;
        }

        response.status(400).json({ error: "Unknown dashboard action." });
        return;
      }

      response.status(405).json({ error: "GET or POST required." });
    } catch (error) {
      console.error("dashboard failed", { message: error.message });
      response.status(error.statusCode || 500).json({
        error: error.message || "Dashboard request failed.",
      });
    }
  }
);

exports.staticMap = onRequest(
  {
    region: "australia-southeast1",
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: ["GOOGLE_STATIC_MAPS_API_KEY"],
  },
  async (request, response) => {
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    if (request.method !== "GET") {
      response.status(405).json({ error: "GET required." });
      return;
    }

    try {
      const mapsApiKey = (process.env.GOOGLE_STATIC_MAPS_API_KEY || "").trim();
      const address = normaliseMapAddress(request.query?.address);

      if (!mapsApiKey) {
        response.status(500).json({ error: "Map template is not configured." });
        return;
      }

      if (!address) {
        response.status(400).json({ error: "Address is required." });
        return;
      }

      const params = new URLSearchParams({
        center: address,
        zoom: "20",
        size: "640x640",
        scale: "2",
        maptype: "roadmap",
        key: mapsApiKey,
      });
      const mapResponse = await fetch(
        `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
      );

      if (!mapResponse.ok) {
        const errorText = await mapResponse.text().catch(() => "");

        console.error("staticMap failed", {
          status: mapResponse.status,
          message: errorText.slice(0, 200),
        });
        response.status(502).json({ error: "Unable to load map template." });
        return;
      }

      const contentType =
        mapResponse.headers.get("content-type") || "image/png";
      const imageBytes = Buffer.from(await mapResponse.arrayBuffer());

      response.set("Content-Type", contentType);
      response.set("Cache-Control", "no-store");
      response.status(200).send(imageBytes);
    } catch (error) {
      console.error("staticMap failed", { message: error.message });
      response.status(500).json({ error: "Unable to load map template." });
    }
  }
);
