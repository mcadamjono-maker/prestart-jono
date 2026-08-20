const DASHBOARD_ENDPOINT =
  "https://australia-southeast1-wdl-field-forms.cloudfunctions.net/dashboard";
const JOB_INFO_ENDPOINT =
  "https://australia-southeast1-wdl-field-forms.cloudfunctions.net/jobInfo";
const ACCESS_CODE_KEY = "wdl-dashboard-access-code";
const CALENDAR_REFRESH_MS = 10000;
const REPORT_STATUSES = ["New", "Reviewed", "Needs Action", "Filed", "Archived"];
let calendarRefreshTimer = null;

const state = {
  reports: [],
  chargeUpReports: [],
  hazardReports: [],
  jobs: [],
  calendarEntries: [],
  appConfig: null,
  selectedReport: null,
  selectedJobNumber: "",
  selectedJobInfo: null,
  showCompletedJobs: false,
  showArchivedReports: false,
};
let toastTimer = null;

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

const showNotice = (message, variant = "success") => {
  const toast = $("#adminToast");

  if (!toast) {
    alert(message);
    return;
  }

  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `admin-toast show ${variant}`;
  toastTimer = window.setTimeout(() => {
    toast.className = "admin-toast";
  }, 2600);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getNzIsoDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
};

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const addDaysToIsoDate = (isoDate, days) => {
  if (!isIsoDate(isoDate)) return getNzIsoDate();

  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
};

const getWeekStartFromIsoDate = (isoDate) => {
  const cleanIsoDate = isIsoDate(isoDate) ? isoDate : getNzIsoDate();
  const [year, month, dayOfMonth] = cleanIsoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  return addDaysToIsoDate(cleanIsoDate, diffToMonday);
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

  if (isIsoDate(cleanedValue)) return cleanedValue;

  return "";
};

const getAccessCode = () => localStorage.getItem(ACCESS_CODE_KEY) || "";

const normaliseJobStatus = (status, completed = false) => {
  const cleanedStatus = String(status || "").trim().toLowerCase();

  if (cleanedStatus === "on hold" || cleanedStatus === "on-hold") return "on hold";
  if (cleanedStatus === "completed" || completed) return "completed";

  return "active";
};

const isCompletedJob = (job) =>
  normaliseJobStatus(job?.status, job?.completed) === "completed";

const jobStatusLabel = (status) =>
  normaliseJobStatus(status)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const normaliseJobRecord = (job = {}) => {
  const status = normaliseJobStatus(job.status, job.completed);

  return {
    ...job,
    number: String(job.number || "").trim(),
    name: String(job.name || "").trim(),
    status,
    completed: status === "completed",
  };
};

const sortJobsByName = (jobs = []) =>
  [...jobs]
    .map(normaliseJobRecord)
    .sort((firstJob, secondJob) => {
      const nameCompare = firstJob.name.localeCompare(secondJob.name, undefined, {
        sensitivity: "base",
      });

      return nameCompare || firstJob.number.localeCompare(secondJob.number);
    });

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

const linesToList = (value) =>
  String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const listToLines = (items = []) => (Array.isArray(items) ? items.join("\n") : "");

const sectionsToText = (sections = []) =>
  (Array.isArray(sections) ? sections : [])
    .map((section) => {
      const title = String(section?.title || "").trim();
      const items = Array.isArray(section?.items) ? section.items : [];

      return [title, ...items.map((item) => `- ${item}`)].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

const textToSections = (value) => {
  const sections = [];
  let currentSection = null;

  String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line) {
        currentSection = null;
        return;
      }

      if (!line.startsWith("-")) {
        currentSection = { title: line, items: [] };
        sections.push(currentSection);
        return;
      }

      if (!currentSection) {
        currentSection = { title: "Checklist", items: [] };
        sections.push(currentSection);
      }

      const item = line.replace(/^-+\s*/, "").trim();
      if (item) currentSection.items.push(item);
    });

  return sections.filter((section) => section.title && section.items.length);
};

const dashboardUrl = (params) => {
  const query = new URLSearchParams(params);
  const accessCode = getAccessCode();

  if (accessCode) query.set("accessCode", accessCode);

  return `${DASHBOARD_ENDPOINT}?${query.toString()}`;
};

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

  const cleanedValue = String(value ?? "").trim();

  return cleanedValue && cleanedValue.toLowerCase() !== "not supplied"
    ? cleanedValue
    : "N/A";
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

const isOpenHazard = (hazard) =>
  String(hazard?.status || "").toLowerCase().includes("active draft") ||
  String(hazard?.subject || "").toLowerCase().includes("hazard id draft");

const hazardStatusLabel = (hazard) =>
  isOpenHazard(hazard) ? "Active" : String(hazard?.status || "Active");

const isArchivedReport = (report) =>
  Boolean(report?.archived) ||
  String(report?.status || "").toLowerCase() === "archived";

const hazardSignOnCount = (hazard) => {
  const formSignOns = hazard?.formData?.signOns;

  if (Array.isArray(formSignOns)) return formSignOns.length;
  if (Array.isArray(hazard?.signOns)) return hazard.signOns.length;

  return 0;
};

const renderMetrics = () => {
  const openHazards = state.hazardReports.filter(isOpenHazard);
  const activeReports = state.reports.filter((report) => !isArchivedReport(report));

  setText("#reportCount", activeReports.length);
  setText(
    "#chargeUpCount",
    activeReports.filter((report) => report.reportType === "Charge Up Job Record").length
  );
  setText("#hazardCount", openHazards.length);
  setText("#jobCount", state.jobs.filter((job) => !isCompletedJob(job)).length);
};

const renderSettings = () => {
  const config = state.appConfig || {};
  const templates = config.checklistTemplates || {};

  setValue("#settingRecipientEmails", listToLines(config.recipientEmails || []));
  setValue("#settingExpiryWarningDays", config.expiryWarningDays || 30);
  setValue("#settingTruckChecklist", sectionsToText(templates.truck || []));
  setValue("#settingDiggerChecklist", sectionsToText(templates.digger || []));
  setValue("#settingTrailerChecklist", sectionsToText(templates.trailer || []));
  setValue("#settingHazardYardChecks", listToLines(config.hazardYardChecks || []));
  setValue("#settingHazardSiteChecks", listToLines(config.hazardSiteChecks || []));
  setValue("#settingHazardControls", listToLines(config.hazardControls || []));
};

const renderReports = () => {
  const search = $("#reportSearch").value.toLowerCase().trim();
  const type = $("#reportTypeFilter").value;
  const showArchived = state.showArchivedReports;
  const filtered = state.reports.filter((report) => {
    const haystack = JSON.stringify(report).toLowerCase();
    const archived = isArchivedReport(report);

    return (
      (showArchived || !archived) &&
      (!type || report.reportType === type) &&
      (!search || haystack.includes(search))
    );
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
              ${
                isArchivedReport(report)
                  ? '<span class="badge archived">Archived</span>'
                  : ""
              }
              <span class="badge">${escapeHtml(report.reportType)}</span>
              <button type="button" data-open-report="${report.id}">Open</button>
              ${
                isArchivedReport(report)
                  ? `<button class="secondary" type="button" data-restore-report="${escapeHtml(report.id)}">Restore</button>`
                  : `<button class="secondary" type="button" data-archive-report="${escapeHtml(report.id)}">Archive</button>`
              }
              <button class="secondary danger" type="button" data-delete-report="${escapeHtml(report.id)}">Delete</button>
            </div>
          </article>`
      )
      .join("") || emptyHtml()
  );
};

const renderOpenHazards = () => {
  const openHazards = state.hazardReports.filter(isOpenHazard);

  setHtml(
    "#openHazardsList",
    openHazards
      .map((hazard) => {
        const title =
          hazard.jobName ||
          hazard.siteAddress ||
          hazard.jobNumber ||
          "Untitled Hazard ID";
        const weekStart = formatDisplayDate(hazard.weekStart || hazard.formData?.weekStart);
        const signOnCount = hazardSignOnCount(hazard);

        return `
          <article class="record hazard-draft-record">
            <div>
              <h3>${escapeHtml(title)}</h3>
              <div class="meta">
                ${escapeHtml(hazard.jobNumber ? `Job ${hazard.jobNumber}` : "No job number")}
                ${weekStart ? ` | Week starting ${escapeHtml(weekStart)}` : ""}
                ${hazard.requestedBy ? ` | Prepared by ${escapeHtml(hazard.requestedBy)}` : ""}
              </div>
              <div class="hazard-draft-summary">
                <span>${escapeHtml(signOnCount)} signed on</span>
                <span>Last saved ${escapeHtml(formatDate(hazard.submittedAtIso))}</span>
              </div>
            </div>
            <div class="actions">
              <span class="badge">${escapeHtml(hazardStatusLabel(hazard))}</span>
              <button type="button" data-open-hazard="${escapeHtml(hazard.id)}">Open</button>
              <button type="button" data-submit-hazard="${escapeHtml(hazard.id)}">Submit</button>
              <button class="secondary danger" type="button" data-delete-hazard="${escapeHtml(hazard.id)}">Delete</button>
            </div>
          </article>`;
      })
      .join("") ||
      '<div class="empty">No open Hazard IDs. Saved weekly Hazard IDs will appear here until they are submitted.</div>'
  );
};

const getWeekDates = (weekStart) => {
  const start = getWeekStartFromIsoDate(weekStart);

  return Array.from({ length: 7 }, (_, index) => addDaysToIsoDate(start, index));
};

const renderCalendar = () => {
  const parsedWeekStart = parseDisplayDate($("#calendarWeek").value);

  if (!parsedWeekStart) return;

  const weekStart = getWeekStartFromIsoDate(parsedWeekStart);
  const days = getWeekDates(weekStart);
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  setHtml(
    "#calendarGrid",
    days
      .map((date, index) => {
        const entries = state.calendarEntries.filter((entry) => entry.date === date);
        const groupedEntries = entries.reduce((groups, entry) => {
          const jobTitle =
            entry.jobName ||
            entry.siteAddress ||
            (entry.jobNumber ? `Job ${entry.jobNumber}` : "Job");
          const key = `${jobTitle}-${entry.jobNumber || ""}`;

          if (!groups.has(key)) {
            groups.set(key, {
              title: jobTitle,
              jobNumber: entry.jobNumber || "",
              entries: [],
            });
          }

          groups.get(key).entries.push(entry);
          return groups;
        }, new Map());

        return `
          <section class="day">
            <h3>${dayLabels[index]}<br />${formatDisplayDate(date)}</h3>
            ${
              Array.from(groupedEntries.values())
                .map(
                  (group) => `
                    <div class="calendar-job-group">
                      <h4>${escapeHtml(group.title)}</h4>
                      ${
                        group.jobNumber
                          ? `<small class="calendar-job-number">Job ${escapeHtml(group.jobNumber)}</small>`
                          : ""
                      }
                      ${group.entries
                        .map(
                          (entry) => `
                            <div class="signon">
                              <strong>${escapeHtml(entry.name)}</strong>
                              <small>${escapeHtml(entry.signedAt || "")}</small>
                            </div>`
                        )
                        .join("")}
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
  const sortedJobs = sortJobsByName(state.jobs);
  const activeJobs = sortedJobs.filter((job) => !isCompletedJob(job));
  const completedJobs = sortedJobs.filter(isCompletedJob);
  const visibleJobs = state.showCompletedJobs
    ? [...activeJobs, ...completedJobs]
    : activeJobs;

  setHtml(
    "#jobsList",
    `${
      visibleJobs
      .map(
        (job) => {
          const status = normaliseJobStatus(job.status, job.completed);

          return `
          <article class="job-row-card ${status === "completed" ? "completed" : ""}">
            <button
              class="job-row ${state.selectedJobNumber === job.number ? "selected" : ""}"
              type="button"
              data-select-job="${escapeHtml(job.number)}"
            >
              <strong>${escapeHtml(job.name)}</strong>
              <span>${escapeHtml(job.number || "Number to add")}</span>
              <em>${escapeHtml(jobStatusLabel(status))}</em>
            </button>
          </article>`;
        }
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
    "#saveJobFloating",
    "#deleteJob",
    "#editJobName",
    "#editJobNumber",
    "#editJobStatus",
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
  const selectedJobStatus = normaliseJobStatus(selectedJob?.status, selectedJob?.completed);

  setText(
    "#selectedJobTitle",
    selectedJob ? selectedJob.name : "Select a job"
  );
  setText(
    "#selectedJobMeta",
    selectedJob
      ? `${selectedJob.number || "Number to add"} | ${jobStatusLabel(selectedJobStatus)}`
      : "Choose a job to manage notes and files."
  );

  setHtml(
    "#jobShortcuts",
    selectedJob
      ? `
        <article class="shortcut-card">
          <h4>Job Overview Report</h4>
          <p>Open, print, or save all job info, files, reports, and open Hazard IDs.</p>
          <div class="shortcut-actions">
            <a class="job-pack-button" href="${escapeHtml(
              dashboardUrl({ resource: "jobPack", jobNumber: selectedJob.number })
            )}" target="_blank" rel="noreferrer">Open Job Overview Report</a>
          </div>
        </article>`
      : ""
  );

  setValue("#jobNotes", jobInfo.notes || "");
  setValue("#serviceLocationInfo", jobInfo.serviceLocationInfo || "");
  setValue("#trafficManagementPlan", jobInfo.trafficManagementPlan || "");
  setValue("#purchaseOrderNumbers", jobInfo.purchaseOrderNumbers || "");
  setValue("#jobContacts", jobInfo.contacts || "");
  setValue("#otherDetails", jobInfo.otherDetails || "");
  setValue("#editJobName", selectedJob?.name || "");
  setValue("#editJobNumber", selectedJob?.number || "");
  setValue("#editJobStatus", selectedJobStatus);

  setJobEditorDisabled(!selectedJob);

  setHtml(
    "#jobFilesList",
    jobInfo.files?.length > 0
      ? jobInfo.files
          .map(
            (file) => `
              <article class="file-record">
                <div>
                  <h4>${escapeHtml(file.notes || "File description")}</h4>
                  <p>${escapeHtml(file.category || "File")} | ${escapeHtml(
              file.filename || "Uploaded file"
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

  const progressUpdates = Array.isArray(jobInfo.progressUpdates)
    ? jobInfo.progressUpdates
    : [];

  setHtml(
    "#jobProgressList",
    selectedJob
      ? progressUpdates.length > 0
        ? progressUpdates
            .map(
              (update) => `
                <article class="progress-record">
                  <h4>${escapeHtml(
                    update.title || formatDate(update.submittedAtIso)
                  )}</h4>
                  <p>${escapeHtml(update.text || "")}</p>
                </article>`
            )
            .join("")
        : '<div class="empty">No daily progress updates saved for this job yet.</div>'
      : '<div class="empty">Select a job to view progress updates.</div>'
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
  showNotice("Job info saved.");
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

const saveSelectedJobDetails = async () => {
  if (!state.selectedJobNumber) return;

  const name = $("#editJobName").value.trim();
  const number = $("#editJobNumber").value.trim();
  const status = normaliseJobStatus($("#editJobStatus").value);

  if (!name) {
    showNotice("Enter a job name before saving.", "error");
    return;
  }

  const previousJobNumber = state.selectedJobNumber;
  const payload = await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "updateJob",
      currentNumber: previousJobNumber,
      number,
      name,
      status,
    }),
  });
  const updatedJob = normaliseJobRecord(payload.job);

  if (!updatedJob.number) return;

  state.jobs = sortJobsByName([
    ...state.jobs.filter(
      (job) => job.number !== previousJobNumber && job.number !== updatedJob.number
    ),
    updatedJob,
  ]);
  state.selectedJobNumber =
    isCompletedJob(updatedJob) && !state.showCompletedJobs ? "" : updatedJob.number;
  state.selectedJobInfo = null;

  renderMetrics();
  renderJobs();

  if (state.selectedJobNumber) {
    await selectJob(state.selectedJobNumber);
  } else {
    renderSelectedJobInfo();
  }

  showNotice("Job details saved.");
};

const saveSelectedJobChanges = async () => {
  if (!state.selectedJobNumber) {
    showNotice("Select a job before saving.", "error");
    return;
  }

  const name = $("#editJobName").value.trim();
  const number = $("#editJobNumber").value.trim();
  const status = normaliseJobStatus($("#editJobStatus").value);
  const infoValues = {
    notes: $("#jobNotes").value,
    serviceLocationInfo: $("#serviceLocationInfo").value,
    trafficManagementPlan: $("#trafficManagementPlan").value,
    purchaseOrderNumbers: $("#purchaseOrderNumbers").value,
    contacts: $("#jobContacts").value,
    otherDetails: $("#otherDetails").value,
  };

  if (!name) {
    showNotice("Enter a job name before saving.", "error");
    return;
  }

  const saveButton = $("#saveJobFloating");
  const previousJobNumber = state.selectedJobNumber;

  setDisabled("#saveJobFloating", true);
  setText("#saveJobFloating", "Saving");

  try {
    const jobPayload = await dashboardFetch("", {
      method: "POST",
      body: JSON.stringify({
        action: "updateJob",
        currentNumber: previousJobNumber,
        number,
        name,
        status,
      }),
    });
    const updatedJob = normaliseJobRecord(jobPayload.job);

    if (!updatedJob.number) {
      showNotice("Job could not be saved.", "error");
      return;
    }

    const jobInfoPayload = await jobInfoFetch("", {
      method: "POST",
      body: JSON.stringify({
        action: "updateInfo",
        jobNumber: updatedJob.number,
        name: updatedJob.name,
        ...infoValues,
      }),
    });

    state.jobs = sortJobsByName([
      ...state.jobs.filter(
        (job) =>
          job.number !== previousJobNumber && job.number !== updatedJob.number
      ),
      updatedJob,
    ]);
    state.selectedJobNumber =
      isCompletedJob(updatedJob) && !state.showCompletedJobs
        ? ""
        : updatedJob.number;
    state.selectedJobInfo = state.selectedJobNumber
      ? jobInfoPayload.job || null
      : null;

    renderMetrics();
    renderJobs();
    renderSelectedJobInfo();
    showNotice("Job updates saved.");
  } finally {
    if (saveButton) {
      setText("#saveJobFloating", "Save");
      setDisabled("#saveJobFloating", !state.selectedJobNumber);
    }
  }
};

const deleteSelectedJob = async () => {
  if (!state.selectedJobNumber) return;

  if (!window.confirm("Are you sure you want to delete this job?")) return;

  const jobNumber = state.selectedJobNumber;

  await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "deleteJob",
      number: jobNumber,
    }),
  });

  state.jobs = state.jobs.filter((job) => job.number !== jobNumber);
  state.selectedJobNumber = "";
  state.selectedJobInfo = null;

  renderMetrics();
  renderJobs();
  renderSelectedJobInfo();
  showNotice("Job deleted.");
};

const saveSettings = async () => {
  const config = {
    recipientEmails: linesToList($("#settingRecipientEmails").value),
    expiryWarningDays: Number($("#settingExpiryWarningDays").value || 30),
    checklistTemplates: {
      truck: textToSections($("#settingTruckChecklist").value),
      digger: textToSections($("#settingDiggerChecklist").value),
      trailer: textToSections($("#settingTrailerChecklist").value),
    },
    hazardYardChecks: linesToList($("#settingHazardYardChecks").value),
    hazardSiteChecks: linesToList($("#settingHazardSiteChecks").value),
    hazardControls: linesToList($("#settingHazardControls").value),
  };
  const payload = await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "updateSettings",
      config,
    }),
  });

  state.appConfig = payload.config || state.appConfig;
  renderSettings();
  showNotice("Settings saved.");
};

const saveReportWorkflow = async () => {
  if (!state.selectedReport) return;

  const payload = await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "updateReportStatus",
      reportId: state.selectedReport.id,
      status: $("#reportWorkflowStatus").value,
      adminNote: $("#reportWorkflowNote").value,
    }),
  });
  const updatedReport = payload.report;

  if (!updatedReport) return;

  replaceReportInState(updatedReport);
  openReportObject(updatedReport);
  showNotice("Review status saved.");
};

const replaceReportInState = (updatedReport) => {
  if (!updatedReport) return;

  state.selectedReport = updatedReport;
  state.reports = [
    updatedReport,
    ...state.reports.filter((report) => report.id !== updatedReport.id),
  ].sort((a, b) =>
    String(b.submittedAtIso || "").localeCompare(String(a.submittedAtIso || ""))
  );
  state.chargeUpReports = state.reports.filter(
    (report) => report.reportType === "Charge Up Job Record" && !isArchivedReport(report)
  );
  state.hazardReports = [
    ...state.hazardReports.filter(
      (report) => report.id !== updatedReport.id || isOpenHazard(report)
    ),
    ...(updatedReport.reportType === "Hazard ID" ? [updatedReport] : []),
  ];
  renderReports();
  renderMetrics();
};

const setReportArchived = async (reportId, archived) => {
  const report = state.reports.find((item) => item.id === reportId);
  const title = report?.subject || report?.reportType || "this report";
  const actionLabel = archived ? "Archive" : "Restore";

  if (!confirm(`${actionLabel} ${title}?`)) return;

  const payload = await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: archived ? "archiveReport" : "restoreReport",
      reportId,
    }),
  });

  replaceReportInState(payload.report);
  if (payload.report) openReportObject(payload.report);
  showNotice(archived ? "Report archived." : "Report restored.");
};

const deleteReport = async (reportId) => {
  const report = state.reports.find((item) => item.id === reportId);
  const title = report?.subject || report?.reportType || "this report";

  if (
    !confirm(
      `Delete ${title}? This permanently removes the filed report and stored attachments.`
    )
  ) {
    return;
  }

  await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "deleteReport",
      reportId,
    }),
  });

  state.reports = state.reports.filter((item) => item.id !== reportId);
  state.chargeUpReports = state.chargeUpReports.filter((item) => item.id !== reportId);
  state.hazardReports = state.hazardReports.filter((item) => item.id !== reportId);
  if (state.selectedReport?.id === reportId) closeReport();
  renderReports();
  renderMetrics();
  renderOpenHazards();
  showNotice("Report deleted.");
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
    showNotice("Select a job before uploading files.", "error");
    setValue("#jobFileInput", "");
    return;
  }

  const selectedJob = state.jobs.find((job) => job.number === state.selectedJobNumber);
  const fileNotes = $("#fileNotes").value.trim();

  if (!fileNotes) {
    showNotice("Enter a file description before uploading.", "error");
    setValue("#jobFileInput", "");
    return;
  }

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
        notes: fileNotes,
        content,
      }),
    });

    state.selectedJobInfo = payload.job || null;
  }

  setValue("#jobFileInput", "");
  setValue("#fileNotes", "");
  renderSelectedJobInfo();
  showNotice(files.length === 1 ? "File uploaded." : `${files.length} files uploaded.`);
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
  showNotice("Job file deleted.");
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

const attachmentUrl = (report, attachment, index) => {
  const attachmentId = attachment?.id || String(index + 1);

  if (!report?.id || !attachmentId || !attachment?.storagePath) return "";

  return `${DASHBOARD_ENDPOINT}?resource=attachment&reportId=${encodeURIComponent(
    report.id
  )}&attachmentId=${encodeURIComponent(attachmentId)}&accessCode=${encodeURIComponent(
    getAccessCode()
  )}`;
};

const isImageAttachment = (attachment) =>
  String(attachment?.contentType || "").toLowerCase().startsWith("image/");

const attachmentRows = (report) =>
  (report.attachmentSummary || [])
    .map(
      (attachment, index) => {
        const url = attachmentUrl(report, attachment, index);

        return `
        <tr>
          <th>Attachment ${index + 1}</th>
          <td>
            ${escapeHtml(attachment.filename || `File ${index + 1}`)}
            ${
              url
                ? `<br /><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open attachment</a>`
                : '<br /><small>Stored before dashboard file links were added.</small>'
            }
          </td>
        </tr>`;
      }
    )
    .join("");

const attachmentPreviewHtml = (report) => {
  const previews = (report.attachmentSummary || [])
    .map((attachment, index) => {
      const url = attachmentUrl(report, attachment, index);

      if (!url || !isImageAttachment(attachment)) return "";

      return `
        <figure>
          <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
            <img src="${escapeHtml(url)}" alt="${escapeHtml(
        attachment.filename || `Attachment ${index + 1}`
      )}" />
          </a>
          <figcaption>${escapeHtml(attachment.filename || `Photo ${index + 1}`)}</figcaption>
        </figure>`;
    })
    .filter(Boolean)
    .join("");

  return previews ? `<div class="attachment-previews">${previews}</div>` : "";
};

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
      <strong>${escapeHtml(report.jobName || report.siteAddress || report.jobNumber || "N/A")}</strong>
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
      .attachment-previews { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 18px 0; }
      .attachment-previews figure { margin: 0; border: 1px solid #ddd; border-radius: 8px; padding: 8px; background: #fff; }
      .attachment-previews img { display: block; width: 100%; max-height: 260px; object-fit: contain; border-radius: 5px; background: #f3f3f3; }
      .attachment-previews figcaption { margin-top: 6px; color: #555; font-size: 11px; overflow-wrap: anywhere; }
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
          <article><span>Job / Site</span><strong>${escapeHtml(report.jobName || report.siteAddress || report.jobNumber || "N/A")}</strong></article>
          <article><span>Status</span><strong>${escapeHtml(report.status || "Filed")}</strong></article>
        </section>
        <h2>Report Details</h2>
        <table>${detailRows(report) || "<tr><td>No extra fields supplied.</td></tr>"}</table>
        ${signatureSectionsHtml(report)}
        ${attachmentPreviewHtml(report)}
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

const openReportObject = (report) => {
  state.selectedReport = report;
  setHtml(
    "#reportDetail",
    `
    <div class="print-actions">
      <button type="button" id="printReport">Print / Save PDF</button>
      <button type="button" id="downloadReport">Download HTML</button>
      ${
        isArchivedReport(report)
          ? '<button class="secondary" type="button" id="restoreReport">Restore</button>'
          : '<button class="secondary" type="button" id="archiveReport">Archive</button>'
      }
      <button class="secondary danger" type="button" id="deleteReport">Delete</button>
    </div>
    <article class="report-preview">
      <header>
        <span>Williams Drainage Limited</span>
        <h2>${escapeHtml(report.subject || report.reportType)}</h2>
        <p>${reportMeta(report)}</p>
      </header>
      ${reportSummaryHtml(report)}
      <section class="report-workflow">
        <label>
          Review Status
          <select id="reportWorkflowStatus">
            ${REPORT_STATUSES.map(
              (status) =>
                `<option value="${escapeHtml(status)}" ${
                  (report.status || "New") === status ? "selected" : ""
                }>${escapeHtml(status)}</option>`
            ).join("")}
          </select>
        </label>
        <label>
          Admin Note
          <textarea id="reportWorkflowNote" placeholder="Optional filing note or follow-up...">${escapeHtml(
            report.adminNote || ""
          )}</textarea>
        </label>
        <button type="button" id="saveReportWorkflow">Save Review Status</button>
      </section>
      <h3>Report Details</h3>
      <table class="detail-table">${detailRows(report) || "<tr><td>No extra fields supplied.</td></tr>"}</table>
      ${signatureSectionsHtml(report)}
      ${attachmentPreviewHtml(report)}
      ${
        attachmentRows(report)
          ? `<h3>Attachments</h3><table class="detail-table">${attachmentRows(report)}</table>`
          : ""
      }
    </article>`
  );
  setAttributeSafe("#reportDrawer", "aria-hidden", "false");
};

const openReport = (reportId) => {
  const report = state.reports.find((item) => item.id === reportId);

  if (report) openReportObject(report);
};

const openHazard = (hazardId) => {
  const hazard = state.hazardReports.find((item) => item.id === hazardId);

  if (hazard) openReportObject(hazard);
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
  state.jobs = sortJobsByName(payload.jobs || []);
  state.appConfig = payload.appConfig || state.appConfig;

  if (
    state.selectedJobNumber &&
    !state.showCompletedJobs &&
    isCompletedJob(state.jobs.find((job) => job.number === state.selectedJobNumber))
  ) {
    state.selectedJobNumber = "";
    state.selectedJobInfo = null;
  }

  renderMetrics();
  renderReports();
  renderOpenHazards();
  renderJobs();
  renderSelectedJobInfo();
  renderSettings();
};

const loadCalendar = async ({ silent = false } = {}) => {
  const parsedWeekStart = parseDisplayDate($("#calendarWeek").value);

  if (!parsedWeekStart) {
    if (!silent) showNotice("Enter the week starting date as dd/mm/yyyy.", "error");
    return;
  }

  const weekStart = getWeekStartFromIsoDate(parsedWeekStart);
  setValue("#calendarWeek", formatDisplayDate(weekStart));

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

  if (!name) {
    showNotice("Enter a job name before adding the job.", "error");
    return;
  }

  const payload = await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "addJob",
      number,
      name,
    }),
  });

  const savedJob = normaliseJobRecord(payload.job);

  state.jobs = sortJobsByName([
    ...state.jobs.filter((job) => job.number !== savedJob.number),
    savedJob,
  ]);
  state.selectedJobNumber = savedJob.number;
  setValue("#jobNumber", "");
  setValue("#jobName", "");
  renderMetrics();
  renderJobs();
  await selectJob(savedJob.number);
  showNotice("Job added.");
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
    normaliseJobRecord(updatedJob),
  ];
  state.jobs = sortJobsByName(state.jobs);

  if (completed && state.selectedJobNumber === updatedJob.number) {
    state.selectedJobNumber = "";
    state.selectedJobInfo = null;
  }

  renderMetrics();
  renderJobs();
  renderSelectedJobInfo();
  showNotice(completed ? "Job marked completed." : "Job restored.");
};

const submitOpenHazard = async (hazardId) => {
  if (!hazardId) return;

  const hazard = state.hazardReports.find((item) => item.id === hazardId);
  const title =
    hazard?.jobName || hazard?.siteAddress || hazard?.jobNumber || "this Hazard ID";

  if (
    !window.confirm(
      `Submit ${title}? This will email it, file it as a report, and remove it from Open Hazard IDs.`
    )
  ) {
    return;
  }

  await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "submitHazardDraft",
      hazardId,
    }),
  });

  await loadSummary();
  await loadCalendar({ silent: true });
  showNotice("Hazard ID submitted.");
};

const deleteOpenHazard = async (hazardId) => {
  if (!hazardId) return;

  const hazard = state.hazardReports.find((item) => item.id === hazardId);
  const title =
    hazard?.jobName || hazard?.siteAddress || hazard?.jobNumber || "this Hazard ID";

  if (
    !window.confirm(
      `Delete ${title}? This removes the saved open Hazard ID and cannot be undone.`
    )
  ) {
    return;
  }

  await dashboardFetch("", {
    method: "POST",
    body: JSON.stringify({
      action: "deleteHazardDraft",
      hazardId,
    }),
  });

  await loadSummary();
  await loadCalendar({ silent: true });
  showNotice("Open Hazard ID deleted.");
};

const toggleCompletedJobs = () => {
  state.showCompletedJobs = !state.showCompletedJobs;
  renderJobs();
};

const handleCalendarWeekInput = () => {
  const parsedDate = parseDisplayDate($("#calendarWeek").value);

  if (parsedDate) {
    setValue("#calendarWeek", formatDisplayDate(getWeekStartFromIsoDate(parsedDate)));
    loadCalendar().catch((error) => alert(error.message));
  }
};

const initialiseWeek = () => {
  setValue("#calendarWeek", formatDisplayDate(getWeekStartFromIsoDate(getNzIsoDate())));
};

const init = () => {
  if (!$("#accessCode")) return;

  setValue("#accessCode", getAccessCode());
  initialiseWeek();
  renderSelectedJobInfo();

  $("#saveAccessCode").addEventListener("click", () => {
    localStorage.setItem(ACCESS_CODE_KEY, $("#accessCode").value.trim());
    loadSummary()
      .then(loadCalendar)
      .then(() => showNotice("Access code saved."))
      .catch((error) => alert(error.message));
  });

  $("#refreshDashboard").addEventListener("click", () =>
    loadSummary()
      .then(loadCalendar)
      .then(() => showNotice("Dashboard refreshed."))
      .catch((error) => alert(error.message))
  );
  $("#saveSettings").addEventListener("click", () =>
    saveSettings().catch((error) => alert(error.message))
  );
  $("#reportSearch").addEventListener("input", renderReports);
  $("#reportTypeFilter").addEventListener("change", renderReports);
  $("#showArchivedReports").addEventListener("change", (event) => {
    state.showArchivedReports = Boolean(event.target.checked);
    renderReports();
  });
  $("#calendarWeek").addEventListener("change", handleCalendarWeekInput);
  window.addEventListener("focus", refreshCalendarQuietly);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshCalendarQuietly();
    }
  });
  document.addEventListener("focusin", (event) => {
    if (event.target.closest("input, textarea, select")) {
      document.body.classList.add("is-inputting");
    }
  });
  document.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!document.activeElement?.closest?.("input, textarea, select")) {
        document.body.classList.remove("is-inputting");
      }
    }, 80);
  });
  $("#jobForm").addEventListener("submit", (event) =>
    addJob(event).catch((error) => alert(error.message))
  );
  $("#saveJobFloating").addEventListener("click", () =>
    saveSelectedJobChanges().catch((error) => alert(error.message))
  );
  $("#deleteJob").addEventListener("click", () =>
    deleteSelectedJob().catch((error) => alert(error.message))
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
    const archiveReportId = event.target.closest("[data-archive-report]")?.dataset.archiveReport;
    const restoreReportId = event.target.closest("[data-restore-report]")?.dataset.restoreReport;
    const deleteReportId = event.target.closest("[data-delete-report]")?.dataset.deleteReport;
    const openHazardId = event.target.closest("[data-open-hazard]")?.dataset.openHazard;
    const submitHazardId = event.target.closest("[data-submit-hazard]")?.dataset.submitHazard;
    const deleteHazardId = event.target.closest("[data-delete-hazard]")?.dataset.deleteHazard;
    const selectJobNumber = event.target.closest("[data-select-job]")?.dataset.selectJob;
    const deleteFileId = event.target.closest("[data-delete-file]")?.dataset.deleteFile;
    const completeJobButton = event.target.closest("[data-complete-job]");

    if (openReportId) openReport(openReportId);
    if (archiveReportId) {
      setReportArchived(archiveReportId, true).catch((error) => alert(error.message));
    }
    if (restoreReportId) {
      setReportArchived(restoreReportId, false).catch((error) => alert(error.message));
    }
    if (deleteReportId) deleteReport(deleteReportId).catch((error) => alert(error.message));
    if (openHazardId) openHazard(openHazardId);
    if (submitHazardId) submitOpenHazard(submitHazardId).catch((error) => alert(error.message));
    if (deleteHazardId) deleteOpenHazard(deleteHazardId).catch((error) => alert(error.message));
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
      showNotice("Print window opened.");
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
      showNotice("Report download started.");
    }

    if (event.target.id === "saveReportWorkflow" && state.selectedReport) {
      saveReportWorkflow().catch((error) => alert(error.message));
    }

    if (event.target.id === "archiveReport" && state.selectedReport) {
      setReportArchived(state.selectedReport.id, true).catch((error) =>
        alert(error.message)
      );
    }

    if (event.target.id === "restoreReport" && state.selectedReport) {
      setReportArchived(state.selectedReport.id, false).catch((error) =>
        alert(error.message)
      );
    }

    if (event.target.id === "deleteReport" && state.selectedReport) {
      deleteReport(state.selectedReport.id).catch((error) => alert(error.message));
    }
  });

  startCalendarAutoRefresh();
  loadSummary().then(loadCalendar).catch((error) => alert(error.message));
};

document.addEventListener("DOMContentLoaded", init);
