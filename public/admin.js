const DASHBOARD_ENDPOINT =
  "https://australia-southeast1-wdl-field-forms.cloudfunctions.net/dashboard";
const JOB_INFO_ENDPOINT =
  "https://australia-southeast1-wdl-field-forms.cloudfunctions.net/jobInfo";
const ACCESS_CODE_KEY = "wdl-dashboard-access-code";
const CALENDAR_REFRESH_MS = 10000;
let calendarRefreshTimer = null;

const state = {
  reports: [],
  chargeUpReports: [],
  hazardReports: [],
  jobs: [],
  calendarEntries: [],
  selectedReport: null,
  selectedJobNumber: "",
  selectedJobInfo: null,
  showCompletedJobs: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const setText = (selector, value) => {
  const element = $(selector);
  if (element) element.textContent = value;
};

const setValue = (selector, value) => {
  const element = $(selector);
  if (element) element.value = value;
};

const setHtml = (selector, value) => {
  const element = $(selector);
  if (element) element.innerHTML = value;
};

const setDisabled = (selector, isDisabled) => {
  const element = $(selector);
  if (element) element.disabled = isDisabled;
};

const setAttributeSafe = (selector, name, value) => {
  const element = $(selector);
  if (element) element.setAttribute(name, value);
};

const addClassSafe = (selector, className) => {
  const element = $(selector);
  if (element) element.classList.add(className);
};

const removeClassSafe = (selector, className) => {
  const element = $(selector);
  if (element) element.classList.remove(className);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDate = (value) => {
  if (!value) return "Not supplied";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatDisplayDate = (isoDate) => {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(isoDate || "");

  return `${match[3]}/${match[2]}/${match[1]}`;
};

const parseDisplayDate = (value) => {
  const cleanedValue = String(value || "").trim();
  const displayMatch = cleanedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (displayMatch) {
    const day = displayMatch[1].padStart(2, "0");
    const month = displayMatch[2].padStart(2, "0");

    return `${displayMatch[3]}-${month}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanedValue)) return cleanedValue;

  return "";
};

const getAccessCode = () => localStorage.getItem(ACCESS_CODE_KEY) || "";

const apiFetch = async (endpoint, path = "", options = {}) => {
  const response = await fetch(`${endpoint}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-dashboard-code": getAccessCode(),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Dashboard request failed (${response.status}).`);
  }

  return payload;
};

const dashboardFetch = (path = "", options = {}) =>
  apiFetch(DASHBOARD_ENDPOINT, path, options);

const jobInfoFetch = (path = "", options = {}) =>
  apiFetch(JOB_INFO_ENDPOINT, path, options);

const emptyHtml = () => $("#emptyTemplate").innerHTML;

const reportMeta = (report) =>
  [
    report.jobName || report.siteAddress || report.jobNumber,
    report.requestedBy,
    report.supplier,
    formatDate(report.submittedAtIso),
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" | ");

const INTERNAL_REPORT_FIELDS = new Set([
  "template",
  "report_type",
  "recipient_email",
  "to_email",
  "sender_email",
  "from_email",
  "email_body",
]);

const titleCaseWords = (value) =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bId\b/g, "ID")
    .replace(/\bPo\b/g, "PO")
    .replace(/\bDps\b/g, "DPS")
    .replace(/\bWof\b/g, "WOF")
    .replace(/\bCof\b/g, "COF")
    .replace(/\bRuc\b/g, "RUC")
    .replace(/\bTmp\b/g, "TMP");

const formatReportLabel = (key) => titleCaseWords(key);

const shouldShowReportField = ([key]) =>
  !INTERNAL_REPORT_FIELDS.has(String(key || "").toLowerCase());

const formatReportValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object"
          ? Object.entries(item)
              .map(([key, nestedValue]) => `${formatReportLabel(key)}: ${formatReportValue(nestedValue)}`)
              .join(", ")
          : formatReportValue(item)
      )
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${formatReportLabel(key)}: ${formatReportValue(nestedValue)}`)
      .join("\n");
  }

  return String(value ?? "").trim() || "Not supplied";
};

const signaturePolylineMarkup = (strokes = []) =>
  (Array.isArray(strokes) ? strokes : [])
    .filter((stroke) => Array.isArray(stroke) && stroke.length > 1)
    .map((stroke) => {
      const points = stroke
        .map((point) => {
          const x = Math.max(0, Math.min(100, Number(point?.x) || 0));
          const y = Math.max(0, Math.min(100, Number(point?.y) || 0));

          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");

      return `<polyline points="${points}" fill="none" stroke="#111" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
    })
    .join("");

const parseSignatureStrokes = (strokes = []) => {
  if (Array.isArray(strokes)) return strokes;

  if (typeof strokes === "string") {
    try {
      const parsed = JSON.parse(strokes || "[]");

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const signatureSvgHtml = (strokes = []) => {
  const markup = signaturePolylineMarkup(parseSignatureStrokes(strokes));

  if (!markup) return "";

  return `<svg class="report-signature" viewBox="0 0 100 100" preserveAspectRatio="none">${markup}</svg>`;
};

const signatureSectionsHtml = (report) => {
  const formData = report.formData || {};
  const sections = [];
  const drainlayerSignature = signatureSvgHtml(
    formData.drainlayerSignatureStrokes ||
      formData.drainlayerSignatureStrokesJson
  );

  if (drainlayerSignature) {
    sections.push(`
      <h3>Drainlayer Signature</h3>
      <div class="signature-list">
        <article class="signature-card">${drainlayerSignature}</article>
      </div>`);
  }

  const signOns = Array.isArray(formData.signOns) ? formData.signOns : [];
  const signOnCards = signOns
    .map((signOn) => {
      const signature = signatureSvgHtml(
        signOn.signatureStrokes || signOn.signatureStrokesJson
      );

      if (!signature) return "";

      return `
        <article class="signature-card">
          <strong>${escapeHtml(signOn.name || "Worker")}</strong>
          <span>${escapeHtml(signOn.signedAt || "")}</span>
          ${signature}
        </article>`;
    })
    .filter(Boolean)
    .join("");

  if (signOnCards) {
    sections.push(`<h3>Worker Signatures</h3><div class="signature-list">${signOnCards}</div>`);
  }

  return sections.join("");
};

const renderMetrics = () => {
  setText("#reportCount", state.reports.length);
  setText("#chargeUpCount", state.chargeUpReports.length);
  setText("#hazardCount", state.hazardReports.length);
  setText("#jobCount", state.jobs.filter((job) => !job.completed).length);
};

const renderReports = () => {
  const search = $("#reportSearch").value.toLowerCase().trim();
  const type = $("#reportTypeFilter").value;
  const filtered = state.reports.filter((report) => {
    const haystack = JSON.stringify(report).toLowerCase();

    return (!type || report.reportType === type) && (!search || haystack.includes(search));
  });

  setHtml(
    "#reportsList",
    filtered
      .map(
        (report) => `
          <article class="record">
            <div>
              <h3>${escapeHtml(report.subject || report.reportType)}</h3>
              <div class="meta">${reportMeta(report)}</div>
            </div>
            <div class="actions">
              <span class="badge">${escapeHtml(report.reportType)}</span>
              <button type="button" data-open-report="${report.id}">Open</button>
            </div>
          </article>`
      )
      .join("") || emptyHtml()
  );
};

const getWeekDates = (weekStart) => {
  const start = new Date(`${weekStart}T00:00:00`);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day.toISOString().slice(0, 10);
  });
};

const renderCalendar = () => {
  const weekStart = parseDisplayDate($("#calendarWeek").value);

  if (!weekStart) return;

  const days = getWeekDates(weekStart);
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  setHtml(
    "#calendarGrid",
    days
      .map((date, index) => {
        const entries = state.calendarEntries.filter((entry) => entry.date === date);

        return `
          <section class="day">
            <h3>${dayLabels[index]}<br />${formatDisplayDate(date)}</h3>
            ${
              entries
                .map(
                  (entry) => `
                    <div class="signon">
                      <strong>${escapeHtml(entry.name)}</strong>
                      <div>${escapeHtml(entry.jobName || entry.siteAddress || "Job")}</div>
                      <small>${escapeHtml(entry.signedAt || "")}</small>
                    </div>`
                )
                .join("") || '<div class="empty">No sign-ons</div>'
            }
          </section>`;
      })
      .join("")
  );
};

const renderJobs = () => {
  const activeJobs = state.jobs.filter((job) => !job.completed);
  const completedJobs = state.jobs.filter((job) => job.completed);
  const visibleJobs = state.showCompletedJobs
    ? [...activeJobs, ...completedJobs]
    : activeJobs;

  setHtml(
    "#jobsList",
    `${
      visibleJobs
      .map(
        (job) => `
          <article class="job-row-card ${job.completed ? "completed" : ""}">
            <button
              class="job-row ${state.selectedJobNumber === job.number ? "selected" : ""}"
              type="button"
              data-select-job="${escapeHtml(job.number)}"
            >
              <strong>${escapeHtml(job.number)}</strong>
              <span>${escapeHtml(job.name)}</span>
              ${job.completed ? '<em>Completed</em>' : ""}
            </button>
            <button
              class="job-complete-button"
              type="button"
              data-complete-job="${escapeHtml(job.number)}"
              data-completed="${job.completed ? "false" : "true"}"
            >
              ${job.completed ? "Restore" : "Mark Completed"}
            </button>
          </article>`
      )
      .join("") || emptyHtml()
    }
    ${
      completedJobs.length
        ? `<button class="show-completed-jobs" type="button" id="toggleCompletedJobs">
            ${state.showCompletedJobs ? "Hide completed jobs" : "Show completed jobs"}
          </button>`
        : ""
    }`
  );
};

const setJobEditorDisabled = (isDisabled) => {
  [
    "#saveJobInfo",
    "#jobNotes",
    "#serviceLocationInfo",
    "#trafficManagementPlan",
    "#purchaseOrderNumbers",
    "#jobContacts",
    "#otherDetails",
    "#jobFileInput",
    "#chooseFiles",
    "#fileCategory",
    "#fileNotes",
  ].forEach((selector) => {
    setDisabled(selector, isDisabled);
  });
};

const renderSelectedJobInfo = () => {
  const selectedJob = state.jobs.find((job) => job.number === state.selectedJobNumber);
  const jobInfo = state.selectedJobInfo || {};

  setText(
    "#selectedJobTitle",
    selectedJob ? `${selectedJob.number} - ${selectedJob.name}` : "Select a job"
  );
  setText(
    "#selectedJobMeta",
    selectedJob
      ? "Office notes and files shown here are available in the field app."
      : "Choose a job to manage notes and files."
  );

  setValue("#jobNotes", jobInfo.notes || "");
  setValue("#serviceLocationInfo", jobInfo.serviceLocationInfo || "");
  setValue("#trafficManagementPlan", jobInfo.trafficManagementPlan || "");
  setValue("#purchaseOrderNumbers", jobInfo.purchaseOrderNumbers || "");
  setValue("#jobContacts", jobInfo.contacts || "");
  setValue("#otherDetails", jobInfo.otherDetails || "");

  setJobEditorDisabled(!selectedJob);

  setHtml(
    "#jobFilesList",
    jobInfo.files?.length > 0
      ? jobInfo.files
          .map(
            (file) => `
              <article class="file-record">
                <div>
                  <h4>${escapeHtml(file.filename)}</h4>
                  <p>${escapeHtml(file.category || "File")} | ${escapeHtml(
              file.notes || "No note"
            )}</p>
                  <small>${escapeHtml(formatDate(file.uploadedAtIso))}</small>
                </div>
                <div class="actions">
                  ${
                    file.url
                      ? `<a class="button-link" href="${escapeHtml(
                          file.url
                        )}" target="_blank" rel="noreferrer">Open</a>`
                      : ""
                  }
                  <button class="secondary" type="button" data-delete-file="${escapeHtml(
                    file.id
                  )}">Delete</button>
                </div>
              </article>`
          )
          .join("")
      : '<div class="empty">No files uploaded for this job yet.</div>'
  );
};

const selectJob = async (jobNumber) => {
  state.selectedJobNumber = jobNumber;
  renderJobs();
  setJobEditorDisabled(true);
  setHtml("#jobFilesList", '<div class="empty">Loading job information...</div>');

  const payload = await jobInfoFetch(`?jobNumber=${encodeURIComponent(jobNumber)}`);
  state.selectedJobInfo = payload.job || null;
  renderSelectedJobInfo();
};

const saveSelectedJobInfo = async () => {
  if (!state.selectedJobNumber) return;

  const selectedJob = state.jobs.find((job) => job.number === state.selectedJobNumber);
  const payload = await jobInfoFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "updateInfo",
      jobNumber: state.selectedJobNumber,
      name: selectedJob?.name || "",
      notes: $("#jobNotes").value,
      serviceLocationInfo: $("#serviceLocationInfo").value,
      trafficManagementPlan: $("#trafficManagementPlan").value,
      purchaseOrderNumbers: $("#purchaseOrderNumbers").value,
      contacts: $("#jobContacts").value,
      otherDetails: $("#otherDetails").value,
    }),
  });

  state.selectedJobInfo = payload.job || null;
  renderSelectedJobInfo();
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const uploadFiles = async (files) => {
  if (!files.length) return;

  if (!state.selectedJobNumber) {
    alert("Select a job before uploading files.");
    setValue("#jobFileInput", "");
    return;
  }

  const selectedJob = state.jobs.find((job) => job.number === state.selectedJobNumber);

  for (const file of files) {
    const content = await fileToBase64(file);
    const payload = await jobInfoFetch("", {
      method: "POST",
      body: JSON.stringify({
        action: "uploadFile",
        jobNumber: state.selectedJobNumber,
        jobName: selectedJob?.name || "",
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        category: $("#fileCategory").value,
        notes: $("#fileNotes").value,
        content,
      }),
    });

    state.selectedJobInfo = payload.job || null;
  }

  setValue("#jobFileInput", "");
  setValue("#fileNotes", "");
  renderSelectedJobInfo();
};

const deleteJobFile = async (fileId) => {
  if (!state.selectedJobNumber || !fileId) return;

  if (!window.confirm("Delete this file from the job?")) return;

  const payload = await jobInfoFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "deleteFile",
      jobNumber: state.selectedJobNumber,
      fileId,
    }),
  });

  state.selectedJobInfo = payload.job || null;
  renderSelectedJobInfo();
};

const detailRows = (report) =>
  Object.entries(report.fields || {})
    .filter(shouldShowReportField)
    .map(
      ([key, value]) => `
        <tr>
          <th>${escapeHtml(formatReportLabel(key))}</th>
          <td>${escapeHtml(formatReportValue(value))}</td>
        </tr>`
    )
    .join("");

const attachmentRows = (report) =>
  (report.attachmentSummary || [])
    .map(
      (attachment, index) => `
        <tr>
          <th>Attachment ${index + 1}</th>
          <td>${escapeHtml(attachment.filename || `File ${index + 1}`)}</td>
        </tr>`
    )
    .join("");

const reportSummaryHtml = (report) => `
  <section class="report-summary-grid">
    <article>
      <span>Report</span>
      <strong>${escapeHtml(report.reportType || "Report")}</strong>
    </article>
    <article>
      <span>Submitted</span>
      <strong>${escapeHtml(formatDate(report.submittedAtIso))}</strong>
    </article>
    <article>
      <span>Job / Site</span>
      <strong>${escapeHtml(report.jobName || report.siteAddress || report.jobNumber || "Not supplied")}</strong>
    </article>
    <article>
      <span>Status</span>
      <strong>${escapeHtml(report.status || "Filed")}</strong>
    </article>
  </section>`;

const printableHtml = (report) => `
<!doctype html>
<html>
  <head>
    <title>${escapeHtml(report.subject || report.reportType)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; color: #111; margin: 0; background: #f2f4f1; }
      .page { max-width: 920px; margin: 24px auto; background: #fff; border: 1px solid #d8ddd3; }
      header { background: #080808; color: #fff; padding: 24px 28px 20px; border-bottom: 7px solid #d7ff2f; }
      .eyebrow { margin: 0 0 8px; color: #d7ff2f; font-size: 12px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
      h1 { margin: 0; font-size: 30px; line-height: 1.1; }
      header p:last-child { margin: 10px 0 0; color: #d7d7d7; }
      main { padding: 24px 28px 30px; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
      .summary article { border: 1px solid #dde2d8; background: #f7f8f4; padding: 10px; }
      .summary span { display: block; color: #60685d; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
      .summary strong { display: block; margin-top: 4px; font-size: 13px; }
      h2 { margin: 24px 0 8px; padding: 10px 12px; background: #101010; border-left: 7px solid #d7ff2f; color: #d7ff2f; font-size: 15px; letter-spacing: 0.05em; text-transform: uppercase; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid #e3e3e3; padding: 9px 10px; text-align: left; vertical-align: top; white-space: pre-line; }
      th { width: 32%; color: #596067; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
      td { font-size: 13px; }
      .signature-list { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0 18px; }
      .signature-card { width: 240px; max-width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 10px; background: #fff; }
      .signature-card strong { display: block; font-size: 13px; }
      .signature-card span { display: block; margin: 2px 0 7px; color: #666; font-size: 11px; }
      .report-signature { display: block; width: 220px; max-width: 100%; height: 82px; background: #fff; border: 1px solid #ddd; border-radius: 6px; }
      pre { white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid #ddd; background: #f8f8f8; padding: 14px; font-size: 12px; }
      footer { margin-top: 20px; color: #777; font-size: 11px; }
      @media print {
        body { background: #fff; }
        .page { margin: 0; border: 0; max-width: none; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <p class="eyebrow">Williams Drainage Limited</p>
        <h1>${escapeHtml(report.reportType || "Report")}</h1>
        <p>${escapeHtml(report.subject || "")}</p>
      </header>
      <main>
        <section class="summary">
          <article><span>Report</span><strong>${escapeHtml(report.reportType || "Report")}</strong></article>
          <article><span>Submitted</span><strong>${escapeHtml(formatDate(report.submittedAtIso))}</strong></article>
          <article><span>Job / Site</span><strong>${escapeHtml(report.jobName || report.siteAddress || report.jobNumber || "Not supplied")}</strong></article>
          <article><span>Status</span><strong>${escapeHtml(report.status || "Filed")}</strong></article>
        </section>
        <h2>Report Details</h2>
        <table>${detailRows(report) || "<tr><td>No extra fields supplied.</td></tr>"}</table>
        ${signatureSectionsHtml(report)}
        ${
          attachmentRows(report)
            ? `<h2>Attachments</h2><table>${attachmentRows(report)}</table>`
            : ""
        }
        <footer>Filed from the WDL Field Forms app.</footer>
      </main>
    </div>
  </body>
</html>`;

const openReport = (reportId) => {
  const report = state.reports.find((item) => item.id === reportId);

  if (!report) return;

  state.selectedReport = report;
  setHtml(
    "#reportDetail",
    `
    <div class="print-actions">
      <button type="button" id="printReport">Print / Save PDF</button>
      <button type="button" id="downloadReport">Download HTML</button>
    </div>
    <article class="report-preview">
      <header>
        <span>Williams Drainage Limited</span>
        <h2>${escapeHtml(report.subject || report.reportType)}</h2>
        <p>${reportMeta(report)}</p>
      </header>
      ${reportSummaryHtml(report)}
      <h3>Report Details</h3>
      <table class="detail-table">${detailRows(report) || "<tr><td>No extra fields supplied.</td></tr>"}</table>
      ${signatureSectionsHtml(report)}
      ${
        attachmentRows(report)
          ? `<h3>Attachments</h3><table class="detail-table">${attachmentRows(report)}</table>`
          : ""
      }
    </article>`
  );
  setAttributeSafe("#reportDrawer", "aria-hidden", "false");
};

const closeReport = () => {
  setAttributeSafe("#reportDrawer", "aria-hidden", "true");
  state.selectedReport = null;
};

const loadSummary = async () => {
  const payload = await dashboardFetch("?resource=summary");

  state.reports = payload.reports || [];
  state.chargeUpReports = payload.chargeUpReports || [];
  state.hazardReports = payload.hazardReports || [];
  state.jobs = payload.jobs || [];

  if (
    state.selectedJobNumber &&
    !state.showCompletedJobs &&
    state.jobs.find((job) => job.number === state.selectedJobNumber)?.completed
  ) {
    state.selectedJobNumber = "";
    state.selectedJobInfo = null;
  }

  renderMetrics();
  renderReports();
  renderJobs();
  renderSelectedJobInfo();
};

const loadCalendar = async ({ silent = false } = {}) => {
  const weekStart = parseDisplayDate($("#calendarWeek").value);

  if (!weekStart) {
    if (!silent) alert("Enter the week starting date as dd/mm/yyyy.");
    return;
  }

  const payload = await dashboardFetch(`?resource=calendar&weekStart=${weekStart}`);

  state.calendarEntries = payload.entries || [];
  renderCalendar();
};

const refreshCalendarQuietly = () =>
  loadCalendar({ silent: true }).catch((error) => {
    console.warn("Calendar refresh failed", error);
  });

const startCalendarAutoRefresh = () => {
  if (calendarRefreshTimer) {
    window.clearInterval(calendarRefreshTimer);
  }

  calendarRefreshTimer = window.setInterval(() => {
    if (!document.hidden) {
      refreshCalendarQuietly();
    }
  }, CALENDAR_REFRESH_MS);
};

const addJob = async (event) => {
  event.preventDefault();
  const number = $("#jobNumber").value.trim();
  const name = $("#jobName").value.trim();

  if (!number || !name) return;

  const payload = await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "addJob",
      number,
      name,
    }),
  });

  state.jobs = [...state.jobs.filter((job) => job.number !== payload.job.number), payload.job]
    .sort((a, b) => a.number.localeCompare(b.number));
  setValue("#jobNumber", "");
  setValue("#jobName", "");
  renderMetrics();
  renderJobs();
};

const setJobCompleted = async (jobNumber, completed) => {
  const payload = await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "setJobCompleted",
      number: jobNumber,
      completed,
    }),
  });
  const updatedJob = payload.job;

  if (!updatedJob) return;

  state.jobs = [
    ...state.jobs.filter((job) => job.number !== updatedJob.number),
    updatedJob,
  ].sort((a, b) => a.number.localeCompare(b.number));

  if (completed && state.selectedJobNumber === updatedJob.number) {
    state.selectedJobNumber = "";
    state.selectedJobInfo = null;
  }

  renderMetrics();
  renderJobs();
  renderSelectedJobInfo();
};

const toggleCompletedJobs = () => {
  state.showCompletedJobs = !state.showCompletedJobs;
  renderJobs();
};

const handleCalendarWeekInput = () => {
  const parsedDate = parseDisplayDate($("#calendarWeek").value);

  if (parsedDate) {
    setValue("#calendarWeek", formatDisplayDate(parsedDate));
    loadCalendar().catch((error) => alert(error.message));
  }
};

const initialiseWeek = () => {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + diffToMonday);
  setValue("#calendarWeek", formatDisplayDate(today.toISOString().slice(0, 10)));
};

const init = () => {
  if (!$("#accessCode")) return;

  setValue("#accessCode", getAccessCode());
  initialiseWeek();
  renderSelectedJobInfo();

  $("#saveAccessCode").addEventListener("click", () => {
    localStorage.setItem(ACCESS_CODE_KEY, $("#accessCode").value.trim());
    loadSummary().then(loadCalendar).catch((error) => alert(error.message));
  });

  $("#refreshDashboard").addEventListener("click", () =>
    loadSummary().then(loadCalendar).catch((error) => alert(error.message))
  );
  $("#reportSearch").addEventListener("input", renderReports);
  $("#reportTypeFilter").addEventListener("change", renderReports);
  $("#calendarWeek").addEventListener("change", handleCalendarWeekInput);
  window.addEventListener("focus", refreshCalendarQuietly);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshCalendarQuietly();
    }
  });
  $("#jobForm").addEventListener("submit", (event) =>
    addJob(event).catch((error) => alert(error.message))
  );
  $("#saveJobInfo").addEventListener("click", () =>
    saveSelectedJobInfo().catch((error) => alert(error.message))
  );
  $("#chooseFiles").addEventListener("click", () => $("#jobFileInput").click());
  $("#jobFileInput").addEventListener("change", (event) =>
    uploadFiles(Array.from(event.target.files || [])).catch((error) => alert(error.message))
  );

  ["dragenter", "dragover"].forEach((eventName) => {
    $("#dropZone").addEventListener(eventName, (event) => {
      event.preventDefault();
      addClassSafe("#dropZone", "dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    $("#dropZone").addEventListener(eventName, (event) => {
      event.preventDefault();
      removeClassSafe("#dropZone", "dragging");
    });
  });

  $("#dropZone").addEventListener("drop", (event) =>
    uploadFiles(Array.from(event.dataTransfer.files || [])).catch((error) =>
      alert(error.message)
    )
  );

  $$(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".tabs button").forEach((item) => item.classList.remove("active"));
      $$(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      addClassSafe(`#${button.dataset.tab}`, "active");
    });
  });

  document.body.addEventListener("click", (event) => {
    const openReportId = event.target.closest("[data-open-report]")?.dataset.openReport;
    const selectJobNumber = event.target.closest("[data-select-job]")?.dataset.selectJob;
    const deleteFileId = event.target.closest("[data-delete-file]")?.dataset.deleteFile;
    const completeJobButton = event.target.closest("[data-complete-job]");

    if (openReportId) openReport(openReportId);
    if (selectJobNumber) selectJob(selectJobNumber).catch((error) => alert(error.message));
    if (deleteFileId) deleteJobFile(deleteFileId).catch((error) => alert(error.message));
    if (event.target.closest("#toggleCompletedJobs")) toggleCompletedJobs();
    if (completeJobButton) {
      const jobNumber = completeJobButton.dataset.completeJob;
      const completed = completeJobButton.dataset.completed === "true";
      setJobCompleted(jobNumber, completed).catch((error) => alert(error.message));
    }
  });

  $("#closeDrawer").addEventListener("click", closeReport);
  $("#reportDrawer").addEventListener("click", (event) => {
    if (event.target === $("#reportDrawer")) closeReport();
  });

  document.body.addEventListener("click", (event) => {
    if (event.target.id === "printReport" && state.selectedReport) {
      const printWindow = window.open("", "_blank");
      printWindow.document.write(printableHtml(state.selectedReport));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }

    if (event.target.id === "downloadReport" && state.selectedReport) {
      const blob = new Blob([printableHtml(state.selectedReport)], {
        type: "text/html",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${state.selectedReport.reportType || "report"}-${
        state.selectedReport.id
      }.html`;
      link.click();
      URL.revokeObjectURL(url);
    }
  });

  startCalendarAutoRefresh();
  loadSummary().then(loadCalendar).catch((error) => alert(error.message));
};

document.addEventListener("DOMContentLoaded", init);
