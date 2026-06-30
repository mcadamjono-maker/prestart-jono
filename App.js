import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Text as SvgText,
} from "react-native-svg";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { EmailJSResponseStatus, send } from "@emailjs/react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as MailComposer from "expo-mail-composer";
import * as Print from "expo-print";

const CHECKLIST_TEMPLATES = {
  digger: [
    {
      title: "Digger (Excavator) Pre-Start Checks",
      items: [
        "No visible damage",
        "No hydraulic leaks",
        "Tracks in good condition",
        "Bucket secure",
        "Pins & bushes greased",
        "Handrails secure",
      ],
    },
    {
      title: "Fluid Levels",
      items: [
        "Engine oil OK",
        "Hydraulic oil OK",
        "Coolant OK",
        "Fuel sufficient",
      ],
    },
    {
      title: "Cab & Controls",
      items: [
        "Seatbelt working",
        "Horn operational",
        "Controls responsive",
        "No warning lights",
      ],
    },
  ],
  trailer: [
    {
      title: "General Condition",
      items: [
        "No structural damage",
        "Deck in good condition",
        "Ramps secure",
      ],
    },
    {
      title: "Tyres & Wheels",
      items: [
        "Tyres inflated",
        "Wheel nuts secure",
        "No uneven wear",
      ],
    },
    {
      title: "Lights & Electrical",
      items: [
        "Brake lights working",
        "Indicators working",
        "Tail lights working",
        "Plug secure",
      ],
    },
  ],
  truck: [
    {
      title: "Vehicle Checks",
      items: [
        "Brake fluid",
        "Engine oil level",
        "Radiator fluid",
        "Battery condition",
        "Tyres & wheel nuts",
        "Horn",
        "Lights",
        "Pressure leaks",
        "Fire extinguisher",
        "Reversing beeper/camera",
      ],
    },
    {
      title: "Compliance",
      items: [
        "Rego current",
        "WOF / COF current",
        "Road User Charges current",
      ],
    },
  ],
};

const TEMPLATE_TABS = [
  { key: "truck", label: "Truck/Ute" },
  { key: "digger", label: "Digger/Machinery" },
  { key: "trailer", label: "Trailer" },
];

const MACHINE_FIELD_LABELS = {
  truck: "Vehicle Registration number",
  digger: "Machine",
  trailer: "Trailer registration number",
};

const APP_TABS = [
  {
    key: "prestart",
    label: "Prestart Check",
    description: "Truck, ute, digger, and trailer checks",
  },
  {
    key: "incident",
    label: "Incident Report",
    description: "Record an incident and email the details",
  },
  {
    key: "purchase",
    label: "Purchase Order Request",
    description: "Request a PO for Xero to issue",
  },
  {
    key: "variation",
    label: "Job Variation",
    description: "Record extra work or scope changes",
  },
  {
    key: "hazard",
    label: "Hazard ID",
    description: "Complete a site task analysis",
  },
  {
    key: "asbuilt",
    label: "As-Built's",
    description: "Sketch drainage plans and file the drawing",
  },
];

const EMAILJS_SERVICE_ID =
  process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID || "service_17tkejm";
const EMAILJS_PRESTART_TEMPLATE_ID =
  process.env.EXPO_PUBLIC_EMAILJS_PRESTART_TEMPLATE_ID ||
  process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID ||
  "template_mevf9fq";
const EMAILJS_INCIDENT_TEMPLATE_ID =
  process.env.EXPO_PUBLIC_EMAILJS_INCIDENT_TEMPLATE_ID || "";
const EMAILJS_PURCHASE_TEMPLATE_ID =
  process.env.EXPO_PUBLIC_EMAILJS_PURCHASE_TEMPLATE_ID || "";
const EMAILJS_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY || "HUIGvg0whmV85-RLO";
const RECIPIENT_EMAIL_OPTIONS = [
  "Jonomcadam@hotmail.com",
  "Trish@williamsdrainage.co.nz",
  "Brad@williamsdrainage.co.nz",
];
const DEFAULT_EMAIL_RECIPIENT = RECIPIENT_EMAIL_OPTIONS[0];
const ALLOWED_RECIPIENT_EMAILS = RECIPIENT_EMAIL_OPTIONS.map((email) =>
  email.toLowerCase()
);
const ALLOWED_RECIPIENT_DOMAINS = ["williamsdrainage.co.nz"];
const DEFAULT_FIREBASE_REPORT_ENDPOINT =
  "https://australia-southeast1-wdl-field-forms.cloudfunctions.net/sendReport";
const FIREBASE_REPORT_ENDPOINT =
  process.env.EXPO_PUBLIC_FIREBASE_REPORT_ENDPOINT ||
  DEFAULT_FIREBASE_REPORT_ENDPOINT;
const DEFAULT_FIREBASE_STATIC_MAP_ENDPOINT =
  "https://australia-southeast1-wdl-field-forms.cloudfunctions.net/staticMap";
const FIREBASE_STATIC_MAP_ENDPOINT =
  process.env.EXPO_PUBLIC_FIREBASE_STATIC_MAP_ENDPOINT ||
  DEFAULT_FIREBASE_STATIC_MAP_ENDPOINT;
const DEFAULT_FIREBASE_JOBS_ENDPOINT =
  "https://australia-southeast1-wdl-field-forms.cloudfunctions.net/jobs";
const FIREBASE_JOBS_ENDPOINT =
  process.env.EXPO_PUBLIC_FIREBASE_JOBS_ENDPOINT ||
  DEFAULT_FIREBASE_JOBS_ENDPOINT;
const MAX_REPORT_ATTACHMENT_BYTES = 28 * 1024 * 1024;
const SETTINGS_STORAGE_KEY = "williams-field-forms-settings";
const PRESTART_STORAGE_PREFIX = "williams-prestart-values";
const JOB_STORAGE_KEY = "williams-purchase-order-jobs";
const DEFAULT_JOB_LIST_URL =
  "https://docs.google.com/spreadsheets/d/1P_KMGAMxyer0hRHwEGWnREwzwbp9cccehEmzJH8fGzg/export?format=csv&gid=0";
const JOB_LIST_URL = process.env.EXPO_PUBLIC_JOB_LIST_URL || DEFAULT_JOB_LIST_URL;

const AS_BUILT_LINE_COLORS = [
  { label: "Red", value: "#ff2f2f" },
  { label: "Green", value: "#36d957" },
  { label: "Black", value: "#111111" },
];
const AS_BUILT_LINE_WIDTHS = [
  { label: "Thin", value: "thin", strokeWidth: 1.8 },
  { label: "Thick", value: "thick", strokeWidth: 4.2 },
];
const AS_BUILT_LINE_STYLES = [
  { label: "Solid", value: "solid" },
  { label: "Dotted", value: "dotted" },
];
const AS_BUILT_SYMBOLS = [
  { label: "IP", value: "inspection_point", shortLabel: "IP" },
  { label: "GT", value: "gully_trap", shortLabel: "GT" },
  { label: "Vent", value: "vent", shortLabel: "V" },
  { label: "MH", value: "manhole", shortLabel: "MH" },
  { label: "CP", value: "cesspit", shortLabel: "CP" },
  { label: "DP", value: "downpipe", shortLabel: "DP" },
  { label: "Flow ->", value: "flow_right", shortLabel: "->" },
  { label: "Flow <-", value: "flow_left", shortLabel: "<-" },
  { label: "Flow up", value: "flow_up", shortLabel: "^" },
  { label: "Flow down", value: "flow_down", shortLabel: "v" },
];

const DEFAULT_JOB_OPTIONS = [
  { number: "0902", name: "43 Rimu Street" },
  { number: "0901", name: "1C Dawson Drive" },
  { number: "0883", name: "41 Rimu Street" },
  { number: "0897", name: "Te Ara a Hinera Hamurana" },
  { number: "0893", name: "Utuhina Reservoir" },
  { number: "0886", name: "43a&b Operiana Street" },
  { number: "0885", name: "Luke Place" },
  { number: "0909", name: "31 Ngongotaha Rd" },
  { number: "0887", name: "1356A Pukuatua Street" },
  { number: "0882", name: "33 Gem Street" },
  { number: "0908", name: "39 Pukatea Cres" },
  { number: "0907", name: "54 Bell Road" },
  { number: "0847", name: "8 Pretoria Street" },
  { number: "0892", name: "10 King Street" },
  { number: "0888", name: "268 Ngongotaha Rd" },
  { number: "0903", name: "Hinemoa Street" },
  { number: "0904", name: "1415 Amohia Street" },
  { number: "0894", name: "65 Martin Street" },
  { number: "0873", name: "38A Turner Rd" },
  { number: "0870", name: "403 & 415 Pukehangi Rd" },
  { number: "0869", name: "Arawa Carpark" },
  { number: "0867", name: "26 Sequoia Cres" },
  { number: "0866", name: "50 Browning Cres" },
  { number: "0881", name: "40 Kaska" },
  { number: "0884", name: "18 Alastair Ave" },
  { number: "0889", name: "22 Fenruss Place" },
  { number: "0890", name: "55 Mokoia Rd" },
  { number: "0896", name: "9 Alice Place" },
  { number: "0900", name: "67 Malfroy Rd" },
];

const VARIATION_REASONS = [
  "Client Request",
  "Council request / requirement",
  "Unforeseen Ground Conditions",
  "Additional Quantity",
  "Engineer Instruction",
  "Existing service conflict",
  "Design Change",
  "Health & Safety Requirement",
  "Other",
];

const HAZARD_YARD_CHECKS = [
  "Vehicle visual check and machinery check",
  "Wearing all required PPE gear in good condition",
  "Additional safety equipment available",
  "Close approach permit checked if within 4 metres",
  "WorkSafe notified for any notifiable work",
  "All equipment secure and documentation on board",
  "Plans for underground services and locations obtained",
];

const HAZARD_SITE_CHECKS = [
  "Everyone on site inducted and signed on",
  "Traffic management current and set up",
  "Machinery pre-start checks complete",
  "TMP copy to site",
  "Reviewed site for new hazards or changes",
  "Other onsite induction completed",
  "Hazards specific to our work explained",
];

const HAZARD_CONTROL_OPTIONS = [
  "Site secured and access restricted",
  "Fence off site area",
  "Fence panels 1m",
  "Fence panels 1.8m",
  "Hazard boards and warning signage in place",
  "Public protection from falling objects",
  "Visitors inducted to site",
  "Keep clear of moving machinery",
  "Stay visible to operator",
  "Keep clear of suspended loads",
  "Trench stability checked",
  "Gas monitoring / ventilation checked",
  "Excavations fenced or made safe",
  "Cover holes",
  "Confined space entry permit checked",
  "Utilities located and marked",
  "Hand digging for services",
  "Excavator digging for services",
  "Close approach permit obtained",
  "Spotter used if needed",
  "Equipment maintained and fit for purpose",
  "Competent operator",
  "Additional PPE identified",
  "Emergency procedures and equipment known",
  "Environmental controls in place",
  "Spill kits available",
  "Access ways clear and tidy",
  "Qualified workers allocated",
  "Supervision arranged for inexperienced workers",
];

const formatJobNumber = (value) =>
  String(value || "").replace(/\D/g, "").slice(0, 4).padStart(4, "0");

const parseCsvLine = (line) => {
  const cells = [];
  let currentCell = "";
  let isInsideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
    } else if (character === '"') {
      isInsideQuotes = !isInsideQuotes;
    } else if (character === "," && !isInsideQuotes) {
      cells.push(currentCell.trim());
      currentCell = "";
    } else {
      currentCell += character;
    }
  }

  cells.push(currentCell.trim());
  return cells;
};

const parseJobSheetCsv = (csvText) => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.toLowerCase().replace(/\s+/g, "_")
  );
  const numberIndex = headers.indexOf("job_number");
  const nameIndex = headers.indexOf("job_name");

  if (numberIndex === -1 || nameIndex === -1) return [];

  return lines
    .slice(1)
    .map((line) => {
      const cells = parseCsvLine(line);
      const number = formatJobNumber(cells[numberIndex]);
      const name = (cells[nameIndex] || "").trim();

      if (number.length !== 4 || !name) return null;

      return { number, name };
    })
    .filter(Boolean);
};

const normalizeJobOptions = (jobs) => {
  if (!Array.isArray(jobs)) return [];

  return jobs
    .map((job) => {
      if (typeof job === "string") {
        const number = formatJobNumber(job);

        return { number, name: `Job ${number}` };
      }

      return {
        number: formatJobNumber(job.number),
        name: String(job.name || "").trim(),
      };
    })
    .filter((job) => job.number.length === 4 && job.name)
    .sort((firstJob, secondJob) => firstJob.name.localeCompare(secondJob.name));
};

const mergeJobOptions = (...jobSets) => {
  const jobMap = new Map();

  jobSets.flat().forEach((job) => {
    const normalizedJob = normalizeJobOptions([job])[0];

    if (normalizedJob) {
      jobMap.set(normalizedJob.number, normalizedJob);
    }
  });

  return normalizeJobOptions(Array.from(jobMap.values()));
};

const normalizeEmailAddress = (value) => String(value || "").trim();

const isValidEmailAddress = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmailAddress(value));

const isAllowedRecipientEmail = (value) => {
  const email = normalizeEmailAddress(value).toLowerCase();
  const domain = email.split("@").pop();

  return (
    ALLOWED_RECIPIENT_EMAILS.includes(email) ||
    ALLOWED_RECIPIENT_DOMAINS.includes(domain)
  );
};

const getSubmittedAt = () =>
  new Date().toLocaleString("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const formatFieldValue = (value, fallback = "Not supplied") => {
  const cleanedValue = String(value || "").trim();

  return cleanedValue || fallback;
};

const formatReportRow = ([label, value]) => {
  const formattedValue = formatFieldValue(value);

  if (formattedValue.includes("\n")) {
    return `${label}:\n  ${formattedValue.replace(/\n/g, "\n  ")}`;
  }

  return `${label}: ${formattedValue}`;
};

const buildFiledEmail = ({ title, reference, sections }) => {
  const lines = [
    "WILLIAMS DRAINAGE LIMITED",
    title.toUpperCase(),
    reference ? `Reference: ${reference}` : "",
    `Submitted: ${getSubmittedAt()}`,
    "",
    "----------------------------------------",
  ].filter(Boolean);

  sections.forEach((section) => {
    lines.push("", section.title.toUpperCase());

    section.rows.forEach(([label, value]) => {
      lines.push(formatReportRow([label, value]));
    });
  });

  return lines.join("\n");
};

const escapeXml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const clampPercentage = (value) => Math.max(0, Math.min(100, value));

const clampAsBuiltPoint = (point) => ({
  x: clampPercentage(point.x),
  y: clampPercentage(point.y),
});

const snapAsBuiltLineEnd = (startPoint, endPoint) => {
  const deltaX = endPoint.x - startPoint.x;
  const deltaY = endPoint.y - startPoint.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance < 0.1) {
    return endPoint;
  }

  const snappedAngle =
    Math.round(Math.atan2(deltaY, deltaX) / (Math.PI / 4)) * (Math.PI / 4);

  return clampAsBuiltPoint({
    x: startPoint.x + Math.cos(snappedAngle) * distance,
    y: startPoint.y + Math.sin(snappedAngle) * distance,
  });
};

const getDistanceToAsBuiltSegment = (point, segmentStart, segmentEnd) => {
  const deltaX = segmentEnd.x - segmentStart.x;
  const deltaY = segmentEnd.y - segmentStart.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);
  }

  const amount = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentStart.x) * deltaX +
        (point.y - segmentStart.y) * deltaY) /
        lengthSquared
    )
  );
  const projectedPoint = {
    x: segmentStart.x + amount * deltaX,
    y: segmentStart.y + amount * deltaY,
  };

  return Math.hypot(point.x - projectedPoint.x, point.y - projectedPoint.y);
};

const simplifyAsBuiltRoughPoints = (points, tolerance = 2.6) => {
  if (points.length <= 2) return points;

  let furthestIndex = 0;
  let furthestDistance = 0;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = getDistanceToAsBuiltSegment(
      points[index],
      firstPoint,
      lastPoint
    );

    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }

  if (furthestDistance <= tolerance) {
    return [firstPoint, lastPoint];
  }

  const beforeCorner = simplifyAsBuiltRoughPoints(
    points.slice(0, furthestIndex + 1),
    tolerance
  );
  const afterCorner = simplifyAsBuiltRoughPoints(
    points.slice(furthestIndex),
    tolerance
  );

  return [...beforeCorner.slice(0, -1), ...afterCorner];
};

const createSnappedAsBuiltSegments = (points) => {
  const simplifiedPoints = simplifyAsBuiltRoughPoints(
    points.map(clampAsBuiltPoint)
  );
  const segments = [];
  let startPoint = simplifiedPoints[0];

  simplifiedPoints.slice(1).forEach((point) => {
    const snappedEnd = snapAsBuiltLineEnd(startPoint, point);
    const distance = Math.hypot(
      snappedEnd.x - startPoint.x,
      snappedEnd.y - startPoint.y
    );

    if (distance > 1.4) {
      segments.push({ start: startPoint, end: snappedEnd });
      startPoint = snappedEnd;
    }
  });

  return segments;
};

const createAsBuiltMapUrl = (address, endpoint) => {
  const cleanedAddress = String(address || "").trim();
  const cleanedEndpoint = String(endpoint || "").trim();

  if (!cleanedAddress || !cleanedEndpoint) return "";

  const params = new URLSearchParams({ address: cleanedAddress });

  return `${cleanedEndpoint}?${params.toString()}`;
};

const getAsBuiltColorLabel = (colorValue) =>
  AS_BUILT_LINE_COLORS.find((color) => color.value === colorValue)?.label ||
  "Custom";

const getAsBuiltWidthLabel = (widthValue) =>
  AS_BUILT_LINE_WIDTHS.find((width) => width.value === widthValue)?.label ||
  "Custom";

const getAsBuiltWidth = (widthValue) =>
  AS_BUILT_LINE_WIDTHS.find((width) => width.value === widthValue)
    ?.strokeWidth || AS_BUILT_LINE_WIDTHS[0].strokeWidth;

const getAsBuiltStyleLabel = (styleValue) =>
  AS_BUILT_LINE_STYLES.find((style) => style.value === styleValue)?.label ||
  "Solid";

const getAsBuiltRoughPoints = (line) => line?.roughPoints || [];

const formatAsBuiltRoughPoints = (points) =>
  points.map((point) => `${point.x},${point.y}`).join(" ");

const getAsBuiltSymbol = (symbolValue) =>
  AS_BUILT_SYMBOLS.find((symbol) => symbol.value === symbolValue) ||
  AS_BUILT_SYMBOLS[0];

const isAsBuiltFlowSymbol = (symbolType) =>
  String(symbolType || "").startsWith("flow_");

const getAsBuiltFlowPoints = (symbol) => {
  const length = 7.2;

  if (symbol.type === "flow_left") {
    return {
      start: { x: symbol.x + length / 2, y: symbol.y },
      end: { x: symbol.x - length / 2, y: symbol.y },
    };
  }

  if (symbol.type === "flow_up") {
    return {
      start: { x: symbol.x, y: symbol.y + length / 2 },
      end: { x: symbol.x, y: symbol.y - length / 2 },
    };
  }

  if (symbol.type === "flow_down") {
    return {
      start: { x: symbol.x, y: symbol.y - length / 2 },
      end: { x: symbol.x, y: symbol.y + length / 2 },
    };
  }

  return {
    start: { x: symbol.x - length / 2, y: symbol.y },
    end: { x: symbol.x + length / 2, y: symbol.y },
  };
};

const buildSvgPolylineMarkup = ({
  strokes = [],
  x = 0,
  y = 0,
  width = 20,
  height = 8,
  stroke = "#111111",
  strokeWidth = 0.45,
}) =>
  strokes
    .filter((strokePoints) => strokePoints.length > 1)
    .map((strokePoints) => {
      const points = strokePoints
        .map(
          (point) =>
            `${(x + (point.x / 100) * width).toFixed(2)},${(
              y +
              (point.y / 100) * height
            ).toFixed(2)}`
        )
        .join(" ");

      return `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join("\n");

const buildAsBuiltSvg = ({
  address,
  owner,
  lotNumber,
  dpsNumber,
  buildingConsentNumber,
  inspectionDate,
  inspector,
  drainlayer,
  drainageLicenseNumber,
  drainlayerSignatureStrokes,
  notes,
  lines,
  symbols,
  mapUrl,
  mapScale,
  mapOffset,
}) => {
  const lineMarkup = lines
    .map((line) => {
      const strokeWidth = getAsBuiltWidth(line.width);
      const dashMarkup =
        line.style === "dotted" ? ' stroke-dasharray="1.8 3.2"' : "";

      return `<line x1="${line.start.x.toFixed(2)}" y1="${line.start.y.toFixed(
        2
      )}" x2="${line.end.x.toFixed(2)}" y2="${line.end.y.toFixed(
        2
      )}" stroke="${escapeXml(line.color)}" stroke-width="${strokeWidth}"${dashMarkup} stroke-linecap="round" />`;
    })
    .join("\n");
  const symbolMarkup = symbols
    .map((symbol) => {
      const symbolConfig = getAsBuiltSymbol(symbol.type);

      if (isAsBuiltFlowSymbol(symbol.type)) {
        const flow = getAsBuiltFlowPoints(symbol);

        return `
        <line x1="${flow.start.x.toFixed(2)}" y1="${flow.start.y.toFixed(
          2
        )}" x2="${flow.end.x.toFixed(2)}" y2="${flow.end.y.toFixed(
          2
        )}" stroke="#111111" stroke-width="1.3" stroke-linecap="round" marker-end="url(#arrowhead)" />`;
      }

      return `
        <circle cx="${symbol.x.toFixed(2)}" cy="${symbol.y.toFixed(
        2
      )}" r="3.6" fill="#ffffff" stroke="#111111" stroke-width="0.9" />
        <text x="${symbol.x.toFixed(2)}" y="${(symbol.y + 1.25).toFixed(
        2
      )}" text-anchor="middle" font-family="Arial, sans-serif" font-size="2.7" font-weight="700" fill="#111111">${escapeXml(
        symbolConfig.shortLabel
      )}</text>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1400" viewBox="0 0 100 118">
  <defs>
    <marker id="arrowhead" markerWidth="5" markerHeight="5" refX="4.4" refY="2.5" orient="auto">
      <path d="M0,0 L5,2.5 L0,5 Z" fill="#111111" />
    </marker>
  </defs>
  <rect width="100" height="118" fill="#ffffff" />
  <text x="4" y="6" font-family="Arial, sans-serif" font-size="4.5" font-weight="700" fill="#111111">Williams Drainage Limited - As-Built Plan</text>
  <text x="4" y="11" font-family="Arial, sans-serif" font-size="2.6" fill="#333333">Address: ${escapeXml(
    address || "Not supplied"
  )}</text>
  <text x="4" y="15" font-family="Arial, sans-serif" font-size="2.6" fill="#333333">Owner: ${escapeXml(
    owner || "Not supplied"
  )} | Lot: ${escapeXml(lotNumber || "Not supplied")} | DPS: ${escapeXml(
    dpsNumber || "Not supplied"
  )}</text>
  <text x="4" y="19" font-family="Arial, sans-serif" font-size="2.6" fill="#333333">Submitted: ${escapeXml(
    getSubmittedAt()
  )}</text>
  <text x="4" y="23" font-family="Arial, sans-serif" font-size="2.3" fill="#333333">Building Consent: ${escapeXml(
    buildingConsentNumber || "Not supplied"
  )} | Inspection Date: ${escapeXml(
    inspectionDate || "Not supplied"
  )} | Inspector: ${escapeXml(inspector || "Not supplied")}</text>
  <text x="4" y="26.5" font-family="Arial, sans-serif" font-size="2.3" fill="#333333">Drainlayer: ${escapeXml(
    drainlayer || "Not supplied"
  )} | Drainage License#: ${escapeXml(
    drainageLicenseNumber || "Not supplied"
  )}</text>
  ${
    mapUrl
      ? `<text x="4" y="30" font-family="Arial, sans-serif" font-size="2" fill="#555555">Map template used: ${escapeXml(
          mapUrl
        )}</text>`
      : ""
  }
  ${
    mapUrl
      ? `<text x="4" y="31.8" font-family="Arial, sans-serif" font-size="1.8" fill="#555555">Map crop: ${escapeXml(
          `${Number(mapScale || 1).toFixed(1)}x zoom, offset ${Math.round(
            mapOffset?.x || 0
          )}/${Math.round(mapOffset?.y || 0)}`
        )}</text>`
      : ""
  }
  <rect x="4" y="32" width="92" height="68" fill="#fbfbfb" stroke="#222222" stroke-width="0.7" />
  <g transform="translate(4 32) scale(0.92 0.68)">
    <g stroke="#d6d6d6" stroke-width="0.16">
      ${Array.from({ length: 11 })
        .map(
          (_, index) =>
            `<line x1="${index * 10}" y1="0" x2="${index * 10}" y2="100" />`
        )
        .join("\n")}
      ${Array.from({ length: 11 })
        .map(
          (_, index) =>
            `<line x1="0" y1="${index * 10}" x2="100" y2="${index * 10}" />`
        )
        .join("\n")}
    </g>
    ${lineMarkup}
    ${symbolMarkup}
  </g>
  <text x="4" y="105" font-family="Arial, sans-serif" font-size="2.4" fill="#333333">Notes: ${escapeXml(
    notes || "None"
  )}</text>
  <rect x="4" y="108" width="38" height="7" fill="#ffffff" stroke="#222222" stroke-width="0.4" />
  <text x="4" y="106.9" font-family="Arial, sans-serif" font-size="2.1" fill="#333333">Drainlayer Signature</text>
  ${buildSvgPolylineMarkup({
    strokes: drainlayerSignatureStrokes,
    x: 4,
    y: 108,
    width: 38,
    height: 7,
  })}
</svg>`;
};

const buildAsBuiltPlanOnlySvg = ({ lines, symbols }) => {
  const lineMarkup = lines
    .map((line) => {
      const strokeWidth = getAsBuiltWidth(line.width);
      const dashMarkup =
        line.style === "dotted" ? ' stroke-dasharray="1.8 3.2"' : "";

      return `<line x1="${line.start.x.toFixed(2)}" y1="${line.start.y.toFixed(
        2
      )}" x2="${line.end.x.toFixed(2)}" y2="${line.end.y.toFixed(
        2
      )}" stroke="${escapeXml(line.color)}" stroke-width="${strokeWidth}"${dashMarkup} stroke-linecap="round" />`;
    })
    .join("\n");
  const symbolMarkup = symbols
    .map((symbol) => {
      const symbolConfig = getAsBuiltSymbol(symbol.type);

      if (isAsBuiltFlowSymbol(symbol.type)) {
        const flow = getAsBuiltFlowPoints(symbol);

        return `
        <line x1="${flow.start.x.toFixed(2)}" y1="${flow.start.y.toFixed(
          2
        )}" x2="${flow.end.x.toFixed(2)}" y2="${flow.end.y.toFixed(
          2
        )}" stroke="#111111" stroke-width="1.3" stroke-linecap="round" marker-end="url(#arrowhead)" />`;
      }

      return `
        <circle cx="${symbol.x.toFixed(2)}" cy="${symbol.y.toFixed(
        2
      )}" r="3.6" fill="#ffffff" stroke="#111111" stroke-width="0.9" />
        <text x="${symbol.x.toFixed(2)}" y="${(symbol.y + 1.25).toFixed(
        2
      )}" text-anchor="middle" font-family="Arial, sans-serif" font-size="2.7" font-weight="700" fill="#111111">${escapeXml(
        symbolConfig.shortLabel
      )}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
    <defs>
      <marker id="arrowhead" markerWidth="5" markerHeight="5" refX="4.4" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="#111111" />
      </marker>
    </defs>
    <rect width="100" height="100" fill="rgba(255,255,255,0.54)" />
    <g stroke="#d6d6d6" stroke-width="0.16">
      ${Array.from({ length: 11 })
        .map(
          (_, index) =>
            `<line x1="${index * 10}" y1="0" x2="${index * 10}" y2="100" />`
        )
        .join("\n")}
      ${Array.from({ length: 11 })
        .map(
          (_, index) =>
            `<line x1="0" y1="${index * 10}" x2="100" y2="${index * 10}" />`
        )
        .join("\n")}
    </g>
    ${lineMarkup}
    ${symbolMarkup}
  </svg>`;
};

const buildAsBuiltPdfHtml = ({
  fieldRows,
  planSvg,
  mapImageBase64,
  mapScale,
  mapOffset,
  mapRotation,
  boardSize,
}) => {
  const planWidth = 780;
  const planHeight = 405;
  const boardWidth = Math.max(boardSize?.width || 1, 1);
  const boardHeight = Math.max(boardSize?.height || 1, 1);
  const mapTranslateX = ((mapOffset?.x || 0) / boardWidth) * planWidth;
  const mapTranslateY = ((mapOffset?.y || 0) / boardHeight) * planHeight;
  const fieldMarkup = fieldRows
    .map(
      ([label, value]) => `
        <div class="field">
          <span>${escapeXml(label)}</span>
          <strong>${escapeXml(value || "Not supplied")}</strong>
        </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page {
        size: A4 landscape;
        margin: 18px;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        color: #111111;
        font-family: Arial, Helvetica, sans-serif;
      }

      .page {
        width: 100%;
        height: 100%;
      }

      .header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        border-bottom: 2px solid #111111;
        padding-bottom: 6px;
        margin-bottom: 7px;
      }

      h1 {
        margin: 0;
        font-size: 18px;
        line-height: 1.1;
      }

      .submitted {
        font-size: 9px;
        color: #444444;
      }

      .fields {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 5px 9px;
        margin-bottom: 8px;
      }

      .field {
        min-height: 25px;
        border: 1px solid #d2d2d2;
        padding: 4px 6px;
      }

      .field span {
        display: block;
        color: #555555;
        font-size: 7.5px;
        font-weight: 700;
        letter-spacing: 0.2px;
        text-transform: uppercase;
      }

      .field strong {
        display: block;
        margin-top: 2px;
        color: #111111;
        font-size: 10px;
        line-height: 1.2;
        font-weight: 700;
      }

      .plan {
        position: relative;
        width: ${planWidth}px;
        height: ${planHeight}px;
        overflow: hidden;
        border: 2px solid #111111;
        background: #f7f7f7;
      }

      .map {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.72;
        transform: translate(${mapTranslateX.toFixed(2)}px, ${mapTranslateY.toFixed(
    2
  )}px) rotate(${Number(mapRotation || 0).toFixed(0)}deg) scale(${Number(
    mapScale || 1
  ).toFixed(2)});
        transform-origin: center center;
      }

      .plan svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <h1>Williams Drainage Limited - As-Built Plan</h1>
        <div class="submitted">Submitted: ${escapeXml(getSubmittedAt())}</div>
      </div>
      <div class="fields">${fieldMarkup}</div>
      <div class="plan">
        ${
          mapImageBase64
            ? `<img class="map" src="data:image/png;base64,${mapImageBase64}" />`
            : ""
        }
        ${planSvg}
      </div>
    </div>
  </body>
</html>`;
};

const DraftTextInput = ({
  value,
  onChangeText,
  onBlur,
  onEndEditing,
  commitOnChange = false,
  ...props
}) => {
  const [draftValue, setDraftValue] = useState(value || "");

  useEffect(() => {
    setDraftValue(value || "");
  }, [value]);

  const commitDraftValue = () => {
    if (onChangeText && draftValue !== (value || "")) {
      onChangeText(draftValue);
    }
  };

  const handleChangeText = (nextValue) => {
    setDraftValue(nextValue);

    if (commitOnChange && onChangeText) {
      onChangeText(nextValue);
    }
  };

  return (
    <TextInput
      {...props}
      value={draftValue}
      onChangeText={handleChangeText}
      onBlur={(event) => {
        commitDraftValue();
        onBlur?.(event);
      }}
      onEndEditing={(event) => {
        commitDraftValue();
        onEndEditing?.(event);
      }}
    />
  );
};

const SettingsGearIcon = () => (
  <Svg width={19} height={19} viewBox="0 0 24 24" pointerEvents="none">
    <Path
      d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      fill="none"
      stroke="#D7FF2F"
      strokeWidth={1.55}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .92l-.03.08A2 2 0 0 1 12.12 21h-.24a2 2 0 0 1-1.85-1.6l-.03-.08a1.7 1.7 0 0 0-1-.92 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.92-1l-.08-.03A2 2 0 0 1 3 12.12v-.24a2 2 0 0 1 1.6-1.85l.08-.03a1.7 1.7 0 0 0 .92-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.92l.03-.08A2 2 0 0 1 11.88 3h.24a2 2 0 0 1 1.85 1.6l.03.08a1.7 1.7 0 0 0 1 .92 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.12.39.42.72.92 1l.08.03A2 2 0 0 1 21 11.88v.24a2 2 0 0 1-1.6 1.85l-.08.03a1.7 1.7 0 0 0-.92 1Z"
      fill="none"
      stroke="#D7FF2F"
      strokeWidth={1.55}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx={12} cy={12} r={0.95} fill="#D7FF2F" />
  </Svg>
);

const PassCheckIcon = ({ active }) => (
  <Svg width={26} height={22} viewBox="0 0 24 24" pointerEvents="none">
    <Path
      d="M4.5 12.7 9.3 17.2 19.5 6.8"
      fill="none"
      stroke={active ? "#000" : "#D7FF2F"}
      strokeWidth={3.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const FailCrossIcon = ({ active }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" pointerEvents="none">
    <Path
      d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"
      fill="none"
      stroke={active ? "#000" : "#ff4444"}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const StableAsBuiltSymbol = ({ symbol }) => {
  const symbolConfig = getAsBuiltSymbol(symbol.type);

  if (isAsBuiltFlowSymbol(symbol.type)) {
    const flow = getAsBuiltFlowPoints(symbol);

    return (
      <>
        <Line
          x1={flow.start.x}
          y1={flow.start.y}
          x2={flow.end.x}
          y2={flow.end.y}
          stroke="#111"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Circle cx={flow.end.x} cy={flow.end.y} r={1.8} fill="#111" />
      </>
    );
  }

  return (
    <>
      <Circle
        cx={symbol.x}
        cy={symbol.y}
        r={4.1}
        fill="#fff"
        stroke="#111"
        strokeWidth={1.1}
      />
      <SvgText
        x={symbol.x}
        y={symbol.y + 1.45}
        fill="#111"
        fontSize={3.2}
        fontWeight="800"
        textAnchor="middle"
      >
        {symbolConfig.shortLabel}
      </SvgText>
    </>
  );
};

const StableJobSelect = ({
  selectedJobNumber,
  selectedJobOption,
  isOpen,
  setIsOpen,
  onSelectJob,
  jobOptions,
  isSubmitting,
}) => (
  <>
    <View style={styles.jobPickerRow}>
      <Pressable
        style={[
          styles.jobSelectButton,
          isOpen && styles.jobSelectButtonOpen,
          isSubmitting && styles.disabledControl,
        ]}
        onPress={() => setIsOpen((currentValue) => !currentValue)}
        disabled={isSubmitting}
        accessibilityRole="button"
      >
        <Text
          style={[
            styles.jobSelectText,
            !selectedJobNumber && styles.jobSelectPlaceholder,
          ]}
        >
          {selectedJobOption?.name || "Select job"}
        </Text>
        <Text style={styles.jobSelectArrow}>{isOpen ? "-" : "+"}</Text>
      </Pressable>
    </View>

    {isOpen && (
      <View style={styles.jobDropdownList}>
        {jobOptions.length === 0 ? (
          <Text style={styles.emptyJobText}>No jobs available.</Text>
        ) : (
          jobOptions.map((job) => {
            const isSelected = selectedJobNumber === job.number;

            return (
              <Pressable
                key={job.number}
                style={[
                  styles.jobDropdownOption,
                  isSelected && styles.jobDropdownOptionSelected,
                ]}
                onPress={() => {
                  onSelectJob(job.number);
                  setIsOpen(false);
                }}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.jobDropdownOptionText,
                    isSelected && styles.jobDropdownOptionTextSelected,
                  ]}
                >
                  {job.name}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>
    )}
  </>
);

const StableLabeledInput = ({ label, style, ...inputProps }) => (
  <View style={styles.labeledInput}>
    <Text style={styles.inputLabel}>{label}</Text>
    <DraftTextInput
      placeholder={label}
      placeholderTextColor="#8a8a8a"
      style={[styles.input, style]}
      {...inputProps}
    />
  </View>
);

const StablePhotoPreviewList = ({ photoList }) => {
  if (photoList.length === 0) return null;

  return (
    <View style={styles.photoPreviewGrid}>
      {photoList.map((capturedPhoto, index) => (
        <Image
          key={`${capturedPhoto.uri}-${index}`}
          source={{ uri: capturedPhoto.uri }}
          style={styles.photoPreviewThumb}
        />
      ))}
    </View>
  );
};

const StableSignatureInk = ({ strokes, small = false }) => (
  <Svg
    style={styles.signatureCanvas}
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    pointerEvents="none"
  >
    {strokes.map((stroke, strokeIndex) =>
      stroke.length > 1 ? (
        <Polyline
          key={strokeIndex}
          points={stroke.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="#111"
          strokeWidth={small ? 3.2 : 2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null
    )}
  </Svg>
);

const StableSignaturePreview = ({ strokes, small = false }) => (
  <View style={[styles.signaturePad, small && styles.signaturePreviewSmall]}>
    <StableSignatureInk strokes={strokes} small={small} />
  </View>
);

const StableCheckRow = ({
  label,
  value,
  answerKey,
  isSubmitting,
  onSetAnswer,
}) => (
  <View style={styles.checkRow}>
    <Text style={styles.checkText}>{label}</Text>

    <View style={styles.buttonGroup}>
      <Pressable
        style={[
          styles.checkButton,
          value === "Pass" && styles.checkButtonActive,
          isSubmitting && styles.disabledControl,
        ]}
        onPress={() => onSetAnswer(answerKey, "Pass")}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={`${label} pass`}
      >
        <PassCheckIcon active={value === "Pass"} />
      </Pressable>

      <Pressable
        style={[
          styles.xButton,
          value === "Fail" && styles.xButtonActive,
          isSubmitting && styles.disabledControl,
        ]}
        onPress={() => onSetAnswer(answerKey, "Fail")}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={`${label} fail`}
      >
        <FailCrossIcon active={value === "Fail"} />
      </Pressable>
    </View>
  </View>
);

export default function App() {
  const windowDimensions = useWindowDimensions();
  const [activePage, setActivePage] = useState("menu");
  const [recipientEmail, setRecipientEmail] = useState(DEFAULT_EMAIL_RECIPIENT);
  const [settingsRecipientEmail, setSettingsRecipientEmail] =
    useState(DEFAULT_EMAIL_RECIPIENT);
  const [isSettingsEmailDropdownOpen, setIsSettingsEmailDropdownOpen] =
    useState(false);
  const [settingsJobNumber, setSettingsJobNumber] = useState("");
  const [settingsJobName, setSettingsJobName] = useState("");
  const [isRefreshingJobs, setIsRefreshingJobs] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("truck");
  const [collapsedSections, setCollapsedSections] = useState({});
  const [operator, setOperator] = useState("");
  const [machine, setMachine] = useState("");
  const [hours, setHours] = useState("");
  const [wofExpiry, setWofExpiry] = useState("");
  const [regoExpiry, setRegoExpiry] = useState("");
  const [rucExpiry, setRucExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState([]);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLoadedSavedPrestart, setHasLoadedSavedPrestart] = useState(false);
  const [incidentReporter, setIncidentReporter] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentLocation, setIncidentLocation] = useState("");
  const [incidentMachine, setIncidentMachine] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentAction, setIncidentAction] = useState("");
  const [incidentPhotos, setIncidentPhotos] = useState([]);
  const [poRequester, setPoRequester] = useState("");
  const [poSupplier, setPoSupplier] = useState("");
  const [poDetails, setPoDetails] = useState("");
  const [jobOptions, setJobOptions] = useState(DEFAULT_JOB_OPTIONS);
  const [selectedPurchaseJob, setSelectedPurchaseJob] = useState("");
  const [isPurchaseJobDropdownOpen, setIsPurchaseJobDropdownOpen] =
    useState(false);
  const [selectedVariationJob, setSelectedVariationJob] = useState("");
  const [isVariationJobDropdownOpen, setIsVariationJobDropdownOpen] =
    useState(false);
  const [variationRequestedBy, setVariationRequestedBy] = useState("");
  const [variationDate, setVariationDate] = useState("");
  const [variationClient, setVariationClient] = useState("");
  const [variationSiteAddress, setVariationSiteAddress] = useState("");
  const [variationNumber, setVariationNumber] = useState("V001");
  const [variationRepresentative, setVariationRepresentative] = useState("");
  const [variationDescription, setVariationDescription] = useState("");
  const [variationReasons, setVariationReasons] = useState({});
  const [variationOtherReason, setVariationOtherReason] = useState("");
  const [variationLabourDescription, setVariationLabourDescription] =
    useState("");
  const [variationLabourHours, setVariationLabourHours] = useState("");
  const [variationPlantUsed, setVariationPlantUsed] = useState("");
  const [variationPlantHours, setVariationPlantHours] = useState("");
  const [variationMaterialsUsed, setVariationMaterialsUsed] = useState("");
  const [variationMaterialsQuantity, setVariationMaterialsQuantity] =
    useState("");
  const [variationPhotos, setVariationPhotos] = useState([]);
  const [hazardSiteAddress, setHazardSiteAddress] = useState("");
  const [hazardTaskDescription, setHazardTaskDescription] = useState("");
  const [hazardPreparedBy, setHazardPreparedBy] = useState("");
  const [hazardStartDate, setHazardStartDate] = useState("");
  const [hazardFinishDate, setHazardFinishDate] = useState("");
  const [hazardYardChecks, setHazardYardChecks] = useState({});
  const [hazardSiteChecks, setHazardSiteChecks] = useState({});
  const [hazardRisks, setHazardRisks] = useState("");
  const [hazardControls, setHazardControls] = useState({});
  const [hazardExtraControls, setHazardExtraControls] = useState("");
  const [hazardToolboxMeeting, setHazardToolboxMeeting] = useState("");
  const [hazardSignOffNotes, setHazardSignOffNotes] = useState("");
  const [hazardSignOns, setHazardSignOns] = useState([]);
  const [isHazardSignOnOpen, setIsHazardSignOnOpen] = useState(false);
  const [hazardSignOnName, setHazardSignOnName] = useState("");
  const [hasHazardSignOnConfirmed, setHasHazardSignOnConfirmed] =
    useState(false);
  const [hazardSignatureStrokes, setHazardSignatureStrokes] = useState([]);
  const [signaturePadSize, setSignaturePadSize] = useState({
    width: 1,
    height: 1,
  });
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [asBuiltAddress, setAsBuiltAddress] = useState("");
  const [asBuiltOwner, setAsBuiltOwner] = useState("");
  const [asBuiltLotNumber, setAsBuiltLotNumber] = useState("");
  const [asBuiltDpsNumber, setAsBuiltDpsNumber] = useState("");
  const [asBuiltBuildingConsentNumber, setAsBuiltBuildingConsentNumber] =
    useState("");
  const [asBuiltInspectionDate, setAsBuiltInspectionDate] = useState("");
  const [asBuiltInspector, setAsBuiltInspector] = useState("");
  const [asBuiltDrainlayer, setAsBuiltDrainlayer] = useState("");
  const [asBuiltDrainageLicenseNumber, setAsBuiltDrainageLicenseNumber] =
    useState("");
  const [asBuiltDrainlayerSignatureStrokes, setAsBuiltDrainlayerSignatureStrokes] =
    useState([]);
  const [asBuiltSignaturePadSize, setAsBuiltSignaturePadSize] = useState({
    width: 1,
    height: 1,
  });
  const [isDrawingAsBuiltSignature, setIsDrawingAsBuiltSignature] =
    useState(false);
  const [asBuiltNotes, setAsBuiltNotes] = useState("");
  const [asBuiltLineColor, setAsBuiltLineColor] = useState(
    AS_BUILT_LINE_COLORS[0].value
  );
  const [asBuiltLineWidth, setAsBuiltLineWidth] = useState(
    AS_BUILT_LINE_WIDTHS[0].value
  );
  const [asBuiltLineStyle, setAsBuiltLineStyle] = useState(
    AS_BUILT_LINE_STYLES[0].value
  );
  const [asBuiltTool, setAsBuiltTool] = useState("line");
  const [asBuiltToolPanel, setAsBuiltToolPanel] = useState("draw");
  const [asBuiltLines, setAsBuiltLines] = useState([]);
  const [asBuiltSymbols, setAsBuiltSymbols] = useState([]);
  const [currentAsBuiltLine, setCurrentAsBuiltLine] = useState(null);
  const [asBuiltMapScale, setAsBuiltMapScale] = useState(1);
  const [asBuiltMapOffset, setAsBuiltMapOffset] = useState({ x: 0, y: 0 });
  const [asBuiltMapRotation, setAsBuiltMapRotation] = useState(0);
  const [asBuiltBoardSize, setAsBuiltBoardSize] = useState({
    width: 1,
    height: 1,
  });
  const [isAsBuiltFocused, setIsAsBuiltFocused] = useState(false);
  const [isDrawingAsBuilt, setIsDrawingAsBuilt] = useState(false);
  const [hasLoadedJobs, setHasLoadedJobs] = useState(false);
  const asBuiltLineStartRef = useRef(null);
  const currentAsBuiltLineRef = useRef(null);
  const asBuiltMapGestureRef = useRef(null);

  const checklist = CHECKLIST_TEMPLATES[selectedTemplate];
  const machineFieldLabel =
    MACHINE_FIELD_LABELS[selectedTemplate] || "Machine ID / Rego";
  const activeRecipientEmail =
    normalizeEmailAddress(recipientEmail) || DEFAULT_EMAIL_RECIPIENT;
  const selectedPurchaseJobOption = jobOptions.find(
    (job) => job.number === selectedPurchaseJob
  );
  const selectedVariationJobOption = jobOptions.find(
    (job) => job.number === selectedVariationJob
  );
  const asBuiltMapImageUrl = useMemo(
    () => createAsBuiltMapUrl(asBuiltAddress, FIREBASE_STATIC_MAP_ENDPOINT),
    [asBuiltAddress]
  );
  const asBuiltBoardHeight = isAsBuiltFocused
    ? Math.max(560, windowDimensions.height - 170)
    : 430;

  const answersSummary = useMemo(
    () =>
      checklist.flatMap((section, sectionIndex) =>
        section.items.map((item, itemIndex) => {
          const key = `${selectedTemplate}-${sectionIndex}-${itemIndex}`;

          return {
            section: section.title,
            item,
            result: answers[key] || "Not checked",
          };
        })
      ),
    [answers, checklist, selectedTemplate]
  );

  const answersText = useMemo(
    () =>
      answersSummary
        .map(
          (answer) =>
            `${answer.section} - ${answer.item}: ${answer.result}`
        )
        .join("\n"),
    [answersSummary]
  );

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);

        if (!isMounted || !savedSettings) return;

        const parsedSettings = JSON.parse(savedSettings);
        const savedRecipientEmail = normalizeEmailAddress(
          parsedSettings.recipientEmail
        );

        if (
          isValidEmailAddress(savedRecipientEmail) &&
          isAllowedRecipientEmail(savedRecipientEmail)
        ) {
          setRecipientEmail(savedRecipientEmail);
          setSettingsRecipientEmail(savedRecipientEmail);
        }

      } catch (error) {
        console.warn("Unable to load settings", error);
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSavedPrestartValues = async () => {
      setHasLoadedSavedPrestart(false);

      try {
        const savedValue = await AsyncStorage.getItem(
          `${PRESTART_STORAGE_PREFIX}:${selectedTemplate}`
        );

        if (!isMounted) return;

        if (savedValue) {
          const savedFields = JSON.parse(savedValue);

          setOperator(savedFields.operator || "");
          setMachine(savedFields.machine || "");
          setHours(savedFields.hours || "");
          setWofExpiry(savedFields.wofExpiry || "");
          setRegoExpiry(savedFields.regoExpiry || "");
          setRucExpiry(savedFields.rucExpiry || "");
        } else {
          setOperator("");
          setMachine("");
          setHours("");
          setWofExpiry("");
          setRegoExpiry("");
          setRucExpiry("");
        }
      } catch (error) {
        console.warn("Unable to load saved prestart values", error);
      } finally {
        if (isMounted) {
          setHasLoadedSavedPrestart(true);
        }
      }
    };

    loadSavedPrestartValues();

    return () => {
      isMounted = false;
    };
  }, [selectedTemplate]);

  useEffect(() => {
    if (!hasLoadedSavedPrestart) return;

    const savePrestartValues = async () => {
      try {
        await AsyncStorage.setItem(
          `${PRESTART_STORAGE_PREFIX}:${selectedTemplate}`,
          JSON.stringify({
            operator,
            machine,
            hours,
            wofExpiry,
            regoExpiry,
            rucExpiry,
          })
        );
      } catch (error) {
        console.warn("Unable to save prestart values", error);
      }
    };

    savePrestartValues();
  }, [
    hasLoadedSavedPrestart,
    selectedTemplate,
    operator,
    machine,
    hours,
    wofExpiry,
    regoExpiry,
    rucExpiry,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadSavedJobs = async () => {
      try {
        let nextJobOptions = DEFAULT_JOB_OPTIONS;
        const savedJobs = await AsyncStorage.getItem(JOB_STORAGE_KEY);

        if (!isMounted) return;

        if (savedJobs) {
          const parsedJobs = JSON.parse(savedJobs);
          const validJobs = normalizeJobOptions(parsedJobs);

          if (validJobs.length > 0) {
            nextJobOptions = mergeJobOptions(nextJobOptions, validJobs);
          }
        }

        try {
          if (FIREBASE_JOBS_ENDPOINT) {
            const response = await fetch(FIREBASE_JOBS_ENDPOINT);

            if (!response.ok) {
              throw new Error(`Job list request failed: ${response.status}`);
            }

            const payload = await response.json();
            const remoteJobs = normalizeJobOptions(payload.jobs || []);

            if (remoteJobs.length > 0) {
              nextJobOptions = mergeJobOptions(nextJobOptions, remoteJobs);
            }
          }
        } catch (error) {
          console.warn("Unable to load Firebase jobs", error);
        }

        if (JOB_LIST_URL && nextJobOptions.length === DEFAULT_JOB_OPTIONS.length) {
          const response = await fetch(JOB_LIST_URL);

          if (!response.ok) {
            throw new Error(`Job list request failed: ${response.status}`);
          }

          const csvText = await response.text();
          const sheetJobs = normalizeJobOptions(parseJobSheetCsv(csvText));

          if (sheetJobs.length > 0) {
            nextJobOptions = mergeJobOptions(nextJobOptions, sheetJobs);
          }
        }

        if (isMounted) {
          setJobOptions(nextJobOptions);
        }
      } catch (error) {
        console.warn("Unable to load saved jobs", error);
      } finally {
        if (isMounted) {
          setHasLoadedJobs(true);
        }
      }
    };

    loadSavedJobs();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedJobs) return;

    const saveJobs = async () => {
      try {
        await AsyncStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobOptions));
      } catch (error) {
        console.warn("Unable to save jobs", error);
      }
    };

    saveJobs();
  }, [hasLoadedJobs, jobOptions]);

  const saveSettings = async (nextSettings) => {
    const settings = {
      recipientEmail,
      ...nextSettings,
    };

    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  };

  const saveRecipientEmailSetting = async (email) => {
    const nextRecipientEmail = normalizeEmailAddress(email);

    if (!isValidEmailAddress(nextRecipientEmail)) {
      Alert.alert("Check Email", "Please enter a valid receiving email address.");
      return;
    }

    if (!isAllowedRecipientEmail(nextRecipientEmail)) {
      Alert.alert(
        "Email Not Allowed",
        "Use the default email or a Williams Drainage email address."
      );
      return;
    }

    try {
      setRecipientEmail(nextRecipientEmail);
      setSettingsRecipientEmail(nextRecipientEmail);
      await saveSettings({ recipientEmail: nextRecipientEmail });
      Alert.alert(
        "Settings Saved",
        `Reports will now send to ${nextRecipientEmail}.`
      );
    } catch (error) {
      Alert.alert("Settings Error", "Unable to save the receiving email.");
    }
  };

  const selectRecipientEmail = (email) => {
    setIsSettingsEmailDropdownOpen(false);
    saveRecipientEmailSetting(email);
  };

  const restoreDefaultRecipient = async () => {
    setIsSettingsEmailDropdownOpen(false);
    saveRecipientEmailSetting(DEFAULT_EMAIL_RECIPIENT);
  };

  const addSettingsJob = async () => {
    const digits = String(settingsJobNumber || "").replace(/\D/g, "");
    const jobName = settingsJobName.trim();

    if (!digits) {
      Alert.alert("Job Number Needed", "Please enter the job number.");
      return;
    }

    if (!jobName) {
      Alert.alert("Job Name Needed", "Please enter the job name.");
      return;
    }

    const jobNumber = digits.slice(0, 4).padStart(4, "0");

    setIsRefreshingJobs(true);

    try {
      const response = await fetch(FIREBASE_JOBS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: jobNumber,
          name: jobName,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Unable to save the job.");
      }

      const savedJob = normalizeJobOptions([payload.job])[0] || {
        number: jobNumber,
        name: jobName,
      };

      setJobOptions((currentJobs) => mergeJobOptions(currentJobs, [savedJob]));
      setSettingsJobNumber("");
      setSettingsJobName("");
      Alert.alert(
        "Job Added",
        `${jobName} has been added to the shared Firebase job list.`
      );
    } catch (error) {
      Alert.alert(
        "Job Save Error",
        "Unable to add the job to Firebase. Check the Firebase job database is enabled."
      );
    } finally {
      setIsRefreshingJobs(false);
    }
  };

  const refreshJobs = async () => {
    if (!FIREBASE_JOBS_ENDPOINT && !JOB_LIST_URL) {
      Alert.alert("No Job List Set", "No shared job list is configured.");
      return;
    }

    setIsRefreshingJobs(true);

    try {
      if (FIREBASE_JOBS_ENDPOINT) {
        const response = await fetch(FIREBASE_JOBS_ENDPOINT);

        if (!response.ok) {
          throw new Error(`Job list request failed: ${response.status}`);
        }

        const payload = await response.json();
        const remoteJobs = normalizeJobOptions(payload.jobs || []);

        if (remoteJobs.length === 0) {
          Alert.alert("No Jobs Found", "Firebase did not return any jobs.");
          return;
        }

        setJobOptions((currentJobs) => mergeJobOptions(currentJobs, remoteJobs));
        Alert.alert(
          "Jobs Updated",
          `${remoteJobs.length} jobs loaded from Firebase.`
        );
        return;
      }

      const response = await fetch(JOB_LIST_URL);

      if (!response.ok) {
        throw new Error(`Job list request failed: ${response.status}`);
      }

      const csvText = await response.text();
      const sheetJobs = normalizeJobOptions(parseJobSheetCsv(csvText));

      if (sheetJobs.length === 0) {
        Alert.alert("No Jobs Found", "The Google Sheet did not return any jobs.");
        return;
      }

      setJobOptions((currentJobs) => mergeJobOptions(currentJobs, sheetJobs));
      Alert.alert("Jobs Updated", `${sheetJobs.length} jobs loaded from the sheet.`);
    } catch (error) {
      Alert.alert("Job List Error", "Unable to refresh the shared job list.");
    } finally {
      setIsRefreshingJobs(false);
    }
  };

  const clearSavedPrestartDetails = () => {
    Alert.alert(
      "Clear Saved Details?",
      "This clears saved operator, machine, hours, and expiry fields on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(
                TEMPLATE_TABS.map(
                  (tab) => `${PRESTART_STORAGE_PREFIX}:${tab.key}`
                )
              );
              setOperator("");
              setMachine("");
              setHours("");
              setWofExpiry("");
              setRegoExpiry("");
              setRucExpiry("");
              Alert.alert("Cleared", "Saved prestart details were cleared.");
            } catch (error) {
              Alert.alert("Clear Failed", "Unable to clear saved details.");
            }
          },
        },
      ]
    );
  };

  const setAnswer = (key, value) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [key]: value,
    }));
  };

  const toggleSection = (title) => {
    setCollapsedSections((currentSections) => ({
      ...currentSections,
      [title]: !currentSections[title],
    }));
  };

  const captureCompressedPhoto = async (fallbackFileName) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Camera access is needed.");
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.45,
    });

    if (!result.canceled && result.assets?.[0]) {
      const capturedPhoto = result.assets[0];
      const compressedPhoto = await ImageManipulator.manipulateAsync(
        capturedPhoto.uri,
        [{ resize: { width: 900 } }],
        {
          compress: 0.45,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return {
        ...capturedPhoto,
        uri: compressedPhoto.uri,
        fileName: capturedPhoto.fileName || fallbackFileName,
        mimeType: "image/jpeg",
      };
    }

    return null;
  };

  const pickImage = async () => {
    const capturedPhoto = await captureCompressedPhoto("fault-photo.jpg");

    if (capturedPhoto) {
      setPhotos((currentPhotos) => [...currentPhotos, capturedPhoto]);
    }
  };

  const pickIncidentPhoto = async () => {
    const capturedPhoto = await captureCompressedPhoto("incident-photo.jpg");

    if (capturedPhoto) {
      setIncidentPhotos((currentPhotos) => [...currentPhotos, capturedPhoto]);
    }
  };

  const pickVariationPhoto = async () => {
    const capturedPhoto = await captureCompressedPhoto("variation-photo.jpg");

    if (capturedPhoto) {
      setVariationPhotos((currentPhotos) => [...currentPhotos, capturedPhoto]);
    }
  };

  const resetForm = () => {
    setAnswers({});
    setNotes("");
    setPhotos([]);
    setCollapsedSections({});
  };

  const resetIncidentForm = () => {
    setIncidentReporter("");
    setIncidentDate("");
    setIncidentLocation("");
    setIncidentMachine("");
    setIncidentDescription("");
    setIncidentAction("");
    setIncidentPhotos([]);
  };

  const resetPurchaseOrderForm = () => {
    setPoRequester("");
    setPoSupplier("");
    setPoDetails("");
    setIsPurchaseJobDropdownOpen(false);
  };

  const resetVariationForm = () => {
    setVariationRequestedBy("");
    setVariationDate("");
    setVariationClient("");
    setVariationSiteAddress("");
    setVariationNumber("V001");
    setVariationRepresentative("");
    setVariationDescription("");
    setVariationReasons({});
    setVariationOtherReason("");
    setVariationLabourDescription("");
    setVariationLabourHours("");
    setVariationPlantUsed("");
    setVariationPlantHours("");
    setVariationMaterialsUsed("");
    setVariationMaterialsQuantity("");
    setVariationPhotos([]);
    setIsVariationJobDropdownOpen(false);
  };

  const resetHazardForm = () => {
    setHazardSiteAddress("");
    setHazardTaskDescription("");
    setHazardPreparedBy("");
    setHazardStartDate("");
    setHazardFinishDate("");
    setHazardYardChecks({});
    setHazardSiteChecks({});
    setHazardRisks("");
    setHazardControls({});
    setHazardExtraControls("");
    setHazardToolboxMeeting("");
    setHazardSignOffNotes("");
    setHazardSignOns([]);
    setIsHazardSignOnOpen(false);
    setHazardSignOnName("");
    setHasHazardSignOnConfirmed(false);
    setHazardSignatureStrokes([]);
  };

  const resetAsBuiltForm = () => {
    setAsBuiltAddress("");
    setAsBuiltOwner("");
    setAsBuiltLotNumber("");
    setAsBuiltDpsNumber("");
    setAsBuiltBuildingConsentNumber("");
    setAsBuiltInspectionDate("");
    setAsBuiltInspector("");
    setAsBuiltDrainlayer("");
    setAsBuiltDrainageLicenseNumber("");
    setAsBuiltDrainlayerSignatureStrokes([]);
    setAsBuiltNotes("");
    setAsBuiltLines([]);
    setAsBuiltSymbols([]);
    setCurrentAsBuiltLine(null);
    setAsBuiltMapScale(1);
    setAsBuiltMapOffset({ x: 0, y: 0 });
    setAsBuiltMapRotation(0);
    setAsBuiltToolPanel("draw");
    asBuiltLineStartRef.current = null;
    currentAsBuiltLineRef.current = null;
  };

  const validateForm = () => {
    if (!operator.trim()) {
      Alert.alert("Validation", "Please enter Operator Name.");
      return false;
    }

    if (!machine.trim()) {
      Alert.alert("Validation", `Please enter ${machineFieldLabel}.`);
      return false;
    }

    return true;
  };

  const getEmailErrorMessage = (error) =>
    error instanceof EmailJSResponseStatus
      ? error.text || `EmailJS returned status ${error.status}.`
      : error.message || String(error);

  const confirmEmailSubmit = (reportName) =>
    new Promise((resolve) => {
      Alert.alert(
        "Send Email?",
        `Are you sure you want to submit this ${reportName}? The form will reset after it sends.`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: "Send",
            onPress: () => resolve(true),
          },
        ]
      );
    });

  const createPhotoAttachments = async (photoList, filenamePrefix) => {
    let totalBytes = 0;
    const attachments = [];

    for (const [index, capturedPhoto] of photoList.entries()) {
      const base64Content = await FileSystem.readAsStringAsync(
        capturedPhoto.uri,
        { encoding: FileSystem.EncodingType.Base64 }
      );
      const estimatedBytes = Math.ceil((base64Content.length * 3) / 4);

      totalBytes += estimatedBytes;

      if (totalBytes > MAX_REPORT_ATTACHMENT_BYTES) {
        throw new Error(
          "The selected photos are too large to send. Please use fewer photos."
        );
      }

      attachments.push({
        filename:
          capturedPhoto.fileName ||
          `${filenamePrefix}-${String(index + 1).padStart(2, "0")}.jpg`,
        content: base64Content,
        contentType: capturedPhoto.mimeType || "image/jpeg",
      });
    }

    return attachments;
  };

  const createTextFileAttachment = async ({
    filename,
    content,
    contentType,
  }) => {
    const safeFilename = filename.replace(/[^\w.\-]/g, "_");
    const baseDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;

    if (!baseDirectory) {
      throw new Error("Unable to create the plan attachment on this device.");
    }

    const fileUri = `${baseDirectory}${safeFilename}`;

    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const base64Content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      attachment: {
        filename: safeFilename,
        content: base64Content,
        contentType,
      },
      uri: fileUri,
    };
  };

  const createPdfAttachment = async ({ filename, html }) => {
    const safeFilename = filename.replace(/[^\w.\-]/g, "_");
    const baseDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;

    if (!baseDirectory) {
      throw new Error("Unable to create the plan attachment on this device.");
    }

    const printedFile = await Print.printToFileAsync({
      html,
      width: 842,
      height: 595,
      base64: true,
    });
    const fileUri = `${baseDirectory}${safeFilename}`;

    await FileSystem.copyAsync({
      from: printedFile.uri,
      to: fileUri,
    });

    const base64Content =
      printedFile.base64 ||
      (await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      }));

    return {
      attachment: {
        filename: safeFilename,
        content: base64Content,
        contentType: "application/pdf",
      },
      uri: fileUri,
    };
  };

  const getMapImageBase64 = async (imageUrl) => {
    if (!imageUrl) return "";

    const baseDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;

    if (!baseDirectory) return "";

    try {
      const downloadedMap = await FileSystem.downloadAsync(
        imageUrl,
        `${baseDirectory}as-built-map-${Date.now()}.png`
      );

      return await FileSystem.readAsStringAsync(downloadedMap.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      return "";
    }
  };

  const sendFirebaseReport = async ({
    reportType,
    subject,
    message,
    fields = {},
    photoList = [],
    photoFilenamePrefix = "report-photo",
    extraAttachments = [],
  }) => {
    const endpoint = FIREBASE_REPORT_ENDPOINT.trim();

    if (!endpoint) {
      return false;
    }

    const attachments = await createPhotoAttachments(
      photoList,
      photoFilenamePrefix
    );
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipientEmail: activeRecipientEmail,
        reportType,
        subject,
        message,
        fields,
        attachments: [...attachments, ...extraAttachments],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        errorBody.error || `Report email failed with status ${response.status}.`
      );
    }

    return true;
  };

  const sendEmailReport = async ({
    subject,
    message,
    fields,
    templateId = EMAILJS_PRESTART_TEMPLATE_ID,
  }) => {
    await send(
      EMAILJS_SERVICE_ID,
      templateId,
      {
        subject,
        message,
        filed_report: message,
        to_email: activeRecipientEmail,
        recipient_email: activeRecipientEmail,
        sender_email: activeRecipientEmail,
        from_email: activeRecipientEmail,
        reply_to: activeRecipientEmail,
        ...fields,
      },
      {
        publicKey: EMAILJS_PUBLIC_KEY,
      }
    );
  };

  const toggleVariationReason = (reason) => {
    setVariationReasons((currentReasons) => ({
      ...currentReasons,
      [reason]: !currentReasons[reason],
    }));
  };

  const toggleSelectedItem = (setSelectedItems, item) => {
    setSelectedItems((currentItems) => ({
      ...currentItems,
      [item]: !currentItems[item],
    }));
  };

  const getSelectedLabels = (selectedItems, fallback = "None selected") => {
    const labels = Object.entries(selectedItems)
      .filter(([, isSelected]) => isSelected)
      .map(([label]) => label);

    return labels.length > 0 ? labels.join(", ") : fallback;
  };

  const getPhotoAttachments = (photoList) =>
    photoList.map((capturedPhoto) => capturedPhoto.uri).filter(Boolean);

  const getPhotoSummary = (photoList, emptyText) => {
    if (photoList.length === 0) return emptyText;

    return photoList
      .map((capturedPhoto, index) => {
        const photoName =
          capturedPhoto.fileName ||
          capturedPhoto.uri?.split("/").pop() ||
          `photo-${index + 1}.jpg`;
        const photoType = capturedPhoto.mimeType || "image/jpeg";

        return `${index + 1}. ${photoName} (${photoType})`;
      })
      .join("\n");
  };

  const getSignaturePointCount = (signatureStrokes) =>
    signatureStrokes.reduce((total, stroke) => total + stroke.length, 0);

  const getHazardSignOnSummary = () => {
    if (hazardSignOns.length === 0) return "No workers signed on.";

    return hazardSignOns
      .map(
        (signOn, index) =>
          `${index + 1}. ${signOn.name} - ${signOn.signedAt} - signature captured`
      )
      .join("\n");
  };

  const getSignaturePoint = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const width = Math.max(signaturePadSize.width, 1);
    const height = Math.max(signaturePadSize.height, 1);

    if (
      locationX < 0 ||
      locationX > width ||
      locationY < 0 ||
      locationY > height
    ) {
      return null;
    }

    return {
      x: (locationX / width) * 100,
      y: (locationY / height) * 100,
    };
  };

  const getAsBuiltPoint = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const width = Math.max(asBuiltBoardSize.width, 1);
    const height = Math.max(asBuiltBoardSize.height, 1);

    if (
      locationX < 0 ||
      locationX > width ||
      locationY < 0 ||
      locationY > height
    ) {
      return null;
    }

    return {
      x: (locationX / width) * 100,
      y: (locationY / height) * 100,
    };
  };

  const getAsBuiltTouchPoints = (event) =>
    Array.from(event.nativeEvent.touches || [])
      .map((touch) => ({
        x: Number.isFinite(touch.locationX) ? touch.locationX : touch.pageX,
        y: Number.isFinite(touch.locationY) ? touch.locationY : touch.pageY,
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  const getAsBuiltTwoFingerInfo = (event) => {
    const touchPoints = getAsBuiltTouchPoints(event);

    if (touchPoints.length < 2) return null;

    const [firstTouch, secondTouch] = touchPoints;
    const xDistance = secondTouch.x - firstTouch.x;
    const yDistance = secondTouch.y - firstTouch.y;

    return {
      center: {
        x: (firstTouch.x + secondTouch.x) / 2,
        y: (firstTouch.y + secondTouch.y) / 2,
      },
      distance: Math.max(1, Math.hypot(xDistance, yDistance)),
      angle: Math.atan2(yDistance, xDistance),
    };
  };

  const normaliseMapRotation = (rotation) => {
    const nextRotation = rotation % 360;

    return nextRotation < 0 ? nextRotation + 360 : nextRotation;
  };

  const cancelCurrentAsBuiltLine = () => {
    asBuiltLineStartRef.current = null;
    currentAsBuiltLineRef.current = null;
    setCurrentAsBuiltLine(null);
    setIsDrawingAsBuilt(false);
  };

  const startAsBuiltMapGesture = (event) => {
    const gestureInfo = getAsBuiltTwoFingerInfo(event);

    if (!gestureInfo || !asBuiltMapImageUrl) return false;

    asBuiltMapGestureRef.current = {
      ...gestureInfo,
      initialScale: asBuiltMapScale,
      initialOffset: asBuiltMapOffset,
      initialRotation: asBuiltMapRotation,
    };
    cancelCurrentAsBuiltLine();

    return true;
  };

  const updateAsBuiltMapGesture = (event) => {
    const gestureInfo = getAsBuiltTwoFingerInfo(event);

    if (!gestureInfo || !asBuiltMapImageUrl) return false;

    if (!asBuiltMapGestureRef.current && !startAsBuiltMapGesture(event)) {
      return false;
    }

    const gestureStart = asBuiltMapGestureRef.current;
    const nextScale = Math.max(
      1,
      Math.min(
        4,
        Number(
          (
            (gestureStart.initialScale * gestureInfo.distance) /
            gestureStart.distance
          ).toFixed(2)
        )
      )
    );

    setAsBuiltMapScale(nextScale);
    setAsBuiltMapOffset({
      x:
        gestureStart.initialOffset.x +
        gestureInfo.center.x -
        gestureStart.center.x,
      y:
        gestureStart.initialOffset.y +
        gestureInfo.center.y -
        gestureStart.center.y,
    });
    setAsBuiltMapRotation(
      normaliseMapRotation(
        gestureStart.initialRotation +
          ((gestureInfo.angle - gestureStart.angle) * 180) / Math.PI
      )
    );

    return true;
  };

  const getAsBuiltSignaturePoint = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const width = Math.max(asBuiltSignaturePadSize.width, 1);
    const height = Math.max(asBuiltSignaturePadSize.height, 1);

    if (
      locationX < 0 ||
      locationX > width ||
      locationY < 0 ||
      locationY > height
    ) {
      return null;
    }

    return {
      x: (locationX / width) * 100,
      y: (locationY / height) * 100,
    };
  };

  const signaturePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isSubmitting,
        onStartShouldSetPanResponderCapture: () => !isSubmitting,
        onMoveShouldSetPanResponder: () => !isSubmitting,
        onMoveShouldSetPanResponderCapture: () => !isSubmitting,
        onPanResponderGrant: (event) => {
          const point = getSignaturePoint(event);

          if (!point) return;

          setIsDrawingSignature(true);

          setHazardSignatureStrokes((currentStrokes) => [
            ...currentStrokes,
            [point],
          ]);
        },
        onPanResponderMove: (event) => {
          const point = getSignaturePoint(event);

          if (!point) return;

          setHazardSignatureStrokes((currentStrokes) => {
            if (currentStrokes.length === 0) {
              return [[point]];
            }

            const nextStrokes = [...currentStrokes];
            const lastStroke = nextStrokes[nextStrokes.length - 1];
            const lastPoint = lastStroke[lastStroke.length - 1] || point;

            if (
              Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) > 22
            ) {
              return [...currentStrokes, [point]];
            }

            nextStrokes[nextStrokes.length - 1] = [
              ...lastStroke,
              point,
            ];

            return nextStrokes;
          });
        },
        onPanResponderRelease: () => {
          setIsDrawingSignature(false);
        },
        onPanResponderTerminate: () => {
          setIsDrawingSignature(false);
        },
        onShouldBlockNativeResponder: () => true,
      }),
    [isSubmitting, signaturePadSize]
  );

  const asBuiltPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isSubmitting,
        onStartShouldSetPanResponderCapture: () => !isSubmitting,
        onMoveShouldSetPanResponder: () => !isSubmitting,
        onMoveShouldSetPanResponderCapture: () => !isSubmitting,
        onPanResponderGrant: (event) => {
          if (getAsBuiltTouchPoints(event).length >= 2) {
            startAsBuiltMapGesture(event);
            return;
          }

          const point = getAsBuiltPoint(event);

          if (!point) return;

          if (asBuiltTool !== "line") {
            setAsBuiltSymbols((currentSymbols) => [
              ...currentSymbols,
              {
                id: `${Date.now()}-${currentSymbols.length}`,
                type: asBuiltTool,
                x: point.x,
                y: point.y,
                createdAt: Date.now(),
              },
            ]);
            return;
          }

          setIsDrawingAsBuilt(true);
          asBuiltLineStartRef.current = point;
          const nextLine = {
            start: point,
            end: point,
            roughPoints: [point],
            color: asBuiltLineColor,
            width: asBuiltLineWidth,
            style: asBuiltLineStyle,
          };

          currentAsBuiltLineRef.current = nextLine;
          setCurrentAsBuiltLine(nextLine);
        },
        onPanResponderMove: (event) => {
          if (getAsBuiltTouchPoints(event).length >= 2) {
            updateAsBuiltMapGesture(event);
            return;
          }

          if (asBuiltMapGestureRef.current) return;

          if (asBuiltTool !== "line" || !asBuiltLineStartRef.current) return;

          const point = getAsBuiltPoint(event);

          if (!point) return;

          setCurrentAsBuiltLine((currentLine) => {
            const previousPoints = currentLine?.roughPoints || [
              asBuiltLineStartRef.current,
            ];
            const lastPoint =
              previousPoints[previousPoints.length - 1] ||
              asBuiltLineStartRef.current;

            if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 0.6) {
              const nextLine = {
                ...(currentLine || {}),
                start: asBuiltLineStartRef.current,
                end: point,
              };

              currentAsBuiltLineRef.current = nextLine;
              return nextLine;
            }

            const nextLine = {
              start: asBuiltLineStartRef.current,
              end: point,
              roughPoints: [...previousPoints, point],
              color: asBuiltLineColor,
              width: asBuiltLineWidth,
              style: asBuiltLineStyle,
            };

            currentAsBuiltLineRef.current = nextLine;
            return nextLine;
          });
        },
        onPanResponderRelease: (event) => {
          const wasMapGesture = !!asBuiltMapGestureRef.current;
          const startPoint = asBuiltLineStartRef.current;
          const point = getAsBuiltPoint(event);

          if (!wasMapGesture && asBuiltTool === "line" && startPoint && point) {
            const roughPoints = [
              ...(currentAsBuiltLineRef.current?.roughPoints || [startPoint]),
              point,
            ];
            const snappedSegments = createSnappedAsBuiltSegments(roughPoints);

            if (snappedSegments.length > 0) {
              setAsBuiltLines((currentLines) => {
                const createdAt = Date.now();
                const groupId = `${createdAt}-${currentLines.length}`;

                return [
                  ...currentLines,
                  ...snappedSegments.map((segment, segmentIndex) => ({
                    id: `${groupId}-${segmentIndex}`,
                    groupId,
                    start: segment.start,
                    end: segment.end,
                    color: asBuiltLineColor,
                    width: asBuiltLineWidth,
                    style: asBuiltLineStyle,
                    createdAt,
                  })),
                ];
              });
            }
          }

          asBuiltMapGestureRef.current = null;
          cancelCurrentAsBuiltLine();
        },
        onPanResponderTerminate: () => {
          asBuiltMapGestureRef.current = null;
          cancelCurrentAsBuiltLine();
        },
        onShouldBlockNativeResponder: () => true,
      }),
    [
      asBuiltBoardSize,
      asBuiltLineColor,
      asBuiltLineStyle,
      asBuiltLineWidth,
      asBuiltMapImageUrl,
      asBuiltMapOffset,
      asBuiltMapRotation,
      asBuiltMapScale,
      asBuiltTool,
      isSubmitting,
    ]
  );

  const asBuiltSignaturePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isSubmitting,
        onStartShouldSetPanResponderCapture: () => !isSubmitting,
        onMoveShouldSetPanResponder: () => !isSubmitting,
        onMoveShouldSetPanResponderCapture: () => !isSubmitting,
        onPanResponderGrant: (event) => {
          const point = getAsBuiltSignaturePoint(event);

          if (!point) return;

          setIsDrawingAsBuiltSignature(true);

          setAsBuiltDrainlayerSignatureStrokes((currentStrokes) => [
            ...currentStrokes,
            [point],
          ]);
        },
        onPanResponderMove: (event) => {
          const point = getAsBuiltSignaturePoint(event);

          if (!point) return;

          setAsBuiltDrainlayerSignatureStrokes((currentStrokes) => {
            if (currentStrokes.length === 0) {
              return [[point]];
            }

            const nextStrokes = [...currentStrokes];
            const lastStroke = nextStrokes[nextStrokes.length - 1];
            const lastPoint = lastStroke[lastStroke.length - 1] || point;

            if (
              Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) > 22
            ) {
              return [...currentStrokes, [point]];
            }

            nextStrokes[nextStrokes.length - 1] = [
              ...lastStroke,
              point,
            ];

            return nextStrokes;
          });
        },
        onPanResponderRelease: () => {
          setIsDrawingAsBuiltSignature(false);
        },
        onPanResponderTerminate: () => {
          setIsDrawingAsBuiltSignature(false);
        },
        onShouldBlockNativeResponder: () => true,
      }),
    [asBuiltSignaturePadSize, isSubmitting]
  );

  const clearHazardSignature = () => {
    setHazardSignatureStrokes([]);
  };

  const clearAsBuiltSignature = () => {
    setAsBuiltDrainlayerSignatureStrokes([]);
  };

  const confirmHazardSignOn = () => {
    if (!hazardSignOnName.trim()) {
      Alert.alert("Validation", "Please enter the worker name.");
      return;
    }

    if (!hasHazardSignOnConfirmed) {
      Alert.alert(
        "Validation",
        "Please tick that the worker has read and understood the Hazard ID."
      );
      return;
    }

    if (getSignaturePointCount(hazardSignatureStrokes) < 3) {
      Alert.alert("Validation", "Please draw a signature.");
      return;
    }

    setHazardSignOns((currentSignOns) => [
      ...currentSignOns,
      {
        name: hazardSignOnName.trim(),
        signedAt: getSubmittedAt(),
        signatureStrokes: hazardSignatureStrokes,
      },
    ]);
    setHazardSignOnName("");
    setHasHazardSignOnConfirmed(false);
    setHazardSignatureStrokes([]);
  };

  const undoAsBuiltMark = () => {
    const lastLine = asBuiltLines[asBuiltLines.length - 1];
    const lastSymbol = asBuiltSymbols[asBuiltSymbols.length - 1];

    if (!lastLine && !lastSymbol) return;

    if (!lastSymbol || (lastLine && lastLine.createdAt > lastSymbol.createdAt)) {
      setAsBuiltLines((currentLines) => {
        if (!lastLine.groupId) {
          return currentLines.slice(0, -1);
        }

        return currentLines.filter((line) => line.groupId !== lastLine.groupId);
      });
      return;
    }

    setAsBuiltSymbols((currentSymbols) => currentSymbols.slice(0, -1));
  };

  const clearAsBuiltDrawing = () => {
    setAsBuiltLines([]);
    setAsBuiltSymbols([]);
    setCurrentAsBuiltLine(null);
    asBuiltLineStartRef.current = null;
    currentAsBuiltLineRef.current = null;
  };

  const resetAsBuiltMapCrop = () => {
    setAsBuiltMapScale(1);
    setAsBuiltMapOffset({ x: 0, y: 0 });
    setAsBuiltMapRotation(0);
  };

  const submitAsBuilt = async () => {
    if (!asBuiltAddress.trim()) {
      Alert.alert("Validation", "Please enter the site address.");
      return;
    }

    if (!asBuiltDrainlayer.trim()) {
      Alert.alert("Validation", "Please enter the drainlayer.");
      return;
    }

    if (getSignaturePointCount(asBuiltDrainlayerSignatureStrokes) < 3) {
      Alert.alert("Validation", "Please add the drainlayer signature.");
      return;
    }

    if (asBuiltLines.length === 0 && asBuiltSymbols.length === 0) {
      Alert.alert(
        "Validation",
        "Please draw at least one drain line or add a symbol."
      );
      return;
    }

    if (!(await confirmEmailSubmit("As-Built plan"))) return;

    setIsSubmitting(true);

    try {
      const asBuiltFieldRows = [
        ["Address", asBuiltAddress.trim()],
        ["Owner", asBuiltOwner.trim()],
        ["Lot#", asBuiltLotNumber.trim()],
        ["DPS#", asBuiltDpsNumber.trim()],
        ["Building Consent#", asBuiltBuildingConsentNumber.trim()],
        ["Inspection Date", asBuiltInspectionDate.trim()],
        ["Inspector", asBuiltInspector.trim()],
        ["Drainlayer", asBuiltDrainlayer.trim()],
        ["Drainage License#", asBuiltDrainageLicenseNumber.trim()],
        ["Drainlayer Signature", "Signature captured"],
        ["Notes", asBuiltNotes.trim() || "None"],
      ];
      const planSvg = buildAsBuiltPlanOnlySvg({
        lines: asBuiltLines,
        symbols: asBuiltSymbols,
      });
      const mapImageBase64 = await getMapImageBase64(asBuiltMapImageUrl);
      const planAttachment = await createPdfAttachment({
        filename: `as-built-${Date.now()}.pdf`,
        html: buildAsBuiltPdfHtml({
          fieldRows: asBuiltFieldRows,
          planSvg,
          mapImageBase64,
          mapScale: asBuiltMapScale,
          mapOffset: asBuiltMapOffset,
          mapRotation: asBuiltMapRotation,
          boardSize: asBuiltBoardSize,
        }),
      });
      const subject = `As-Built plan - ${asBuiltAddress.trim()}`;
      const message = buildFiledEmail({
        title: "As-Built Plan",
        reference: asBuiltAddress.trim(),
        sections: [
          {
            title: "Plan Details",
            rows: asBuiltFieldRows,
          },
        ],
      });

      const sentByFirebase = await sendFirebaseReport({
        reportType: "As-Built Plan",
        subject,
        message,
        fields: {
          report_type: "As-Built Plan",
          template: "as_built",
          address: asBuiltAddress.trim(),
          owner: asBuiltOwner.trim() || "Not supplied",
          lot_number: asBuiltLotNumber.trim() || "Not supplied",
          dps_number: asBuiltDpsNumber.trim() || "Not supplied",
          building_consent_number:
            asBuiltBuildingConsentNumber.trim() || "Not supplied",
          inspection_date: asBuiltInspectionDate.trim() || "Not supplied",
          inspector: asBuiltInspector.trim() || "Not supplied",
          drainlayer: asBuiltDrainlayer.trim(),
          drainage_license_number:
            asBuiltDrainageLicenseNumber.trim() || "Not supplied",
          drainlayer_signature: "Signature captured",
          notes: asBuiltNotes.trim() || "None",
        },
        extraAttachments: [planAttachment.attachment],
      });

      if (sentByFirebase) {
        Alert.alert("Success", "As-Built plan emailed successfully.");
        resetAsBuiltForm();
        return;
      }

      const canCompose = await MailComposer.isAvailableAsync();

      if (!canCompose) {
        Alert.alert(
          "Email App Required",
          "To send an As-Built plan, this device needs an email app set up."
        );
        return;
      }

      const mailResult = await MailComposer.composeAsync({
        recipients: [activeRecipientEmail],
        subject,
        body: message,
        attachments: [planAttachment.uri],
      });

      if (mailResult.status === "cancelled") {
        return;
      }

      Alert.alert(
        "Success",
        "As-Built email opened. Tap send in your email app to finish."
      );
      resetAsBuiltForm();
    } catch (error) {
      Alert.alert("Email Failed", getEmailErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitForm = async () => {
    if (!validateForm()) return;

    if (!(await confirmEmailSubmit("prestart checklist"))) return;

    setIsSubmitting(true);

    try {
      let successMessage = "Checklist emailed successfully.";
      const photoAttachments = getPhotoAttachments(photos);
      const photoSummary = getPhotoSummary(photos, "No fault photos captured");

      const subject = `Prestart checklist - ${machine.trim()}`;
      const message = buildFiledEmail({
        title: "Prestart Checklist",
        reference: machine.trim(),
        sections: [
          {
            title: "Asset Details",
            rows: [
              ["Checklist Type", selectedTemplate],
              ["Operator", operator.trim()],
              [machineFieldLabel, machine.trim()],
              ["Hours / KMs", hours.trim() || "N/A"],
              ["WOF / COF Expiry", wofExpiry.trim() || "N/A"],
              ["Registration Expiry", regoExpiry.trim() || "N/A"],
              ["RUC Expiry", rucExpiry.trim() || "N/A"],
            ],
          },
          {
            title: "Checklist Results",
            rows: [["Items", answersText || "No checklist items recorded"]],
          },
          {
            title: "Notes and Attachments",
            rows: [
              ["Notes", notes.trim() || "None"],
              ["Fault Photos", photoSummary],
            ],
          },
        ],
      });
      const fields = {
        template: selectedTemplate,
        report_type: "Prestart Checklist",
        operator: operator.trim(),
        machine: machine.trim(),
        hours: hours.trim(),
        wofExpiry: wofExpiry.trim(),
        regoExpiry: regoExpiry.trim(),
        rucExpiry: rucExpiry.trim(),
        notes: notes.trim(),
        answers: answersText,
        photoName:
          photos.length > 0 ? `${photos.length} photo(s) captured` : "No photo captured",
        photoType: photos.length > 0 ? "image/jpeg" : "",
        photoStatus:
          photos.length > 0
            ? `${photos.length} fault photo(s) were captured on the device.`
            : "No fault photos captured.",
      };

      const sentByFirebase = await sendFirebaseReport({
        reportType: "Prestart Checklist",
        subject,
        message,
        fields,
        photoList: photos,
        photoFilenamePrefix: "prestart-photo",
      });

      if (sentByFirebase) {
        successMessage = "Checklist emailed successfully.";
      } else if (photoAttachments.length > 0) {
        const canCompose = await MailComposer.isAvailableAsync();

        if (!canCompose) {
          Alert.alert(
            "Email App Required",
            "To send a photo, this device needs an email app set up."
          );
          return;
        }

        const mailResult = await MailComposer.composeAsync({
          recipients: [activeRecipientEmail],
          subject,
          body: message,
          attachments: photoAttachments,
        });

        if (mailResult.status === "cancelled") {
          return;
        }

        successMessage = "Photo email opened. Tap send in your email app to finish.";
      } else {
        await sendEmailReport({
          subject,
          message,
          fields,
          templateId: EMAILJS_PRESTART_TEMPLATE_ID,
        });
      }

      Alert.alert("Success", successMessage);
      resetForm();
    } catch (error) {
      Alert.alert("Email Failed", getEmailErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitIncidentReport = async () => {
    if (!incidentReporter.trim()) {
      Alert.alert("Validation", "Please enter who is reporting the incident.");
      return;
    }

    if (!incidentDescription.trim()) {
      Alert.alert("Validation", "Please describe the incident.");
      return;
    }

    if (!(await confirmEmailSubmit("incident report"))) return;

    setIsSubmitting(true);

    try {
      let successMessage = "Incident report emailed successfully.";
      const incidentPhotoAttachments = getPhotoAttachments(incidentPhotos);
      const incidentPhotoSummary = getPhotoSummary(
        incidentPhotos,
        "No incident photos captured"
      );
      const subject = `Incident report - ${incidentLocation.trim() || "Williams Drainage"}`;
      const message = buildFiledEmail({
        title: "Incident Report",
        reference: incidentLocation.trim() || "Williams Drainage",
        sections: [
          {
            title: "Incident Details",
            rows: [
              ["Reported By", incidentReporter.trim()],
              ["Date / Time", incidentDate.trim()],
              ["Location", incidentLocation.trim()],
              ["Machine / Vehicle", incidentMachine.trim()],
            ],
          },
          {
            title: "Description",
            rows: [["What Happened", incidentDescription.trim()]],
          },
          {
            title: "Action and Attachments",
            rows: [
              ["Action Taken", incidentAction.trim()],
              ["Photos", incidentPhotoSummary],
            ],
          },
        ],
      });

      const fields = {
        report_type: "Incident Report",
        template: "incident",
        incident_reporter: incidentReporter.trim(),
        incident_date: incidentDate.trim() || "Not supplied",
        incident_location: incidentLocation.trim() || "Not supplied",
        incident_machine: incidentMachine.trim() || "Not supplied",
        incident_description: incidentDescription.trim(),
        incident_action: incidentAction.trim() || "Not supplied",
        operator: incidentReporter.trim(),
        machine: incidentMachine.trim(),
        notes: incidentDescription.trim(),
        answers: incidentAction.trim(),
        photoName:
          incidentPhotos.length > 0
            ? `${incidentPhotos.length} photo(s) captured`
            : "No photo captured",
        photoType: incidentPhotos.length > 0 ? "image/jpeg" : "",
        photoStatus:
          incidentPhotos.length > 0
            ? `${incidentPhotos.length} incident photo(s) were captured on the device.`
            : "No incident photos captured.",
      };

      const sentByFirebase = await sendFirebaseReport({
        reportType: "Incident Report",
        subject,
        message,
        fields,
        photoList: incidentPhotos,
        photoFilenamePrefix: "incident-photo",
      });

      if (sentByFirebase) {
        successMessage = "Incident report emailed successfully.";
      } else if (incidentPhotoAttachments.length > 0) {
        const canCompose = await MailComposer.isAvailableAsync();

        if (!canCompose) {
          Alert.alert(
            "Email App Required",
            "To send a photo, this device needs an email app set up."
          );
          return;
        }

        const mailResult = await MailComposer.composeAsync({
          recipients: [activeRecipientEmail],
          subject,
          body: message,
          attachments: incidentPhotoAttachments,
        });

        if (mailResult.status === "cancelled") {
          return;
        }

        successMessage = "Photo email opened. Tap send in your email app to finish.";
      } else if (EMAILJS_INCIDENT_TEMPLATE_ID) {
        await sendEmailReport({
          subject,
          message,
          fields,
          templateId: EMAILJS_INCIDENT_TEMPLATE_ID,
        });
      } else {
        const canCompose = await MailComposer.isAvailableAsync();

        if (!canCompose) {
          Alert.alert(
            "Incident Template Needed",
            "Create an Incident Report template in EmailJS, then add its template ID to the app."
          );
          return;
        }

        const mailResult = await MailComposer.composeAsync({
          recipients: [activeRecipientEmail],
          subject,
          body: message,
        });

        if (mailResult.status === "cancelled") {
          return;
        }

        successMessage = "Incident email opened. Tap send in your email app to finish.";
      }

      Alert.alert("Success", successMessage);
      resetIncidentForm();
    } catch (error) {
      Alert.alert("Email Failed", getEmailErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitPurchaseOrder = async () => {
    if (!poRequester.trim()) {
      Alert.alert("Validation", "Please enter who requested the purchase order.");
      return;
    }

    if (!poSupplier.trim()) {
      Alert.alert("Validation", "Please enter the supplier.");
      return;
    }

    if (!selectedPurchaseJob) {
      Alert.alert("Validation", "Please select a job.");
      return;
    }

    if (!(await confirmEmailSubmit("purchase order request"))) return;

    setIsSubmitting(true);

    try {
      const subject = `Purchase order request - ${poSupplier.trim()}`;
      const message = buildFiledEmail({
        title: "Purchase Order Request",
        reference: selectedPurchaseJobOption?.name || selectedPurchaseJob,
        sections: [
          {
            title: "Request Details",
            rows: [
              ["Job Name", selectedPurchaseJobOption?.name],
              ["Job Number", selectedPurchaseJob],
              ["PO Number", "To be generated in Xero"],
              ["Requested By", poRequester.trim()],
              ["Supplier", poSupplier.trim()],
            ],
          },
          {
            title: "Purchase Details",
            rows: [["Details", poDetails.trim()]],
          },
          {
            title: "Admin Note",
            rows: [["Action Required", "Issue purchase order number in Xero"]],
          },
        ],
      });

      const purchaseFields = {
        report_type: "Purchase Order Request",
        template: "purchase_order_request",
        purchase_order_number: "To be generated in Xero",
        job_number: selectedPurchaseJob,
        job_name: selectedPurchaseJobOption?.name || "",
        requested_by: poRequester.trim(),
        supplier: poSupplier.trim(),
        purchase_details: poDetails.trim() || "Not supplied",
        operator: poRequester.trim(),
        machine: selectedPurchaseJob,
        notes: poDetails.trim(),
        answers: `Job Number: ${selectedPurchaseJob}\nJob Name: ${
          selectedPurchaseJobOption?.name || "Not supplied"
        }\nSupplier: ${poSupplier.trim()}`,
        email_body: message,
      };

      const sentByFirebase = await sendFirebaseReport({
        reportType: "Purchase Order Request",
        subject,
        message,
        fields: purchaseFields,
      });

      if (sentByFirebase) {
        // Sent through Firebase/Resend.
      } else if (EMAILJS_PURCHASE_TEMPLATE_ID) {
        await sendEmailReport({
          subject,
          message,
          templateId: EMAILJS_PURCHASE_TEMPLATE_ID,
          fields: purchaseFields,
        });
      } else {
        const canCompose = await MailComposer.isAvailableAsync();

        if (!canCompose) {
          Alert.alert(
            "Purchase Template Needed",
            "Create a Purchase Order template in EmailJS, then add its template ID to the app."
          );
          return;
        }

        const mailResult = await MailComposer.composeAsync({
          recipients: [activeRecipientEmail],
          subject,
          body: message,
        });

        if (mailResult.status === "cancelled") {
          return;
        }
      }

      Alert.alert("Success", "Purchase order request emailed successfully.");
      resetPurchaseOrderForm();
    } catch (error) {
      Alert.alert("Email Failed", getEmailErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitVariationRequest = async () => {
    if (!variationRequestedBy.trim()) {
      Alert.alert("Validation", "Please enter who requested the variation.");
      return;
    }

    if (!selectedVariationJob) {
      Alert.alert("Validation", "Please select a job.");
      return;
    }

    if (!variationDescription.trim()) {
      Alert.alert("Validation", "Please describe the variation.");
      return;
    }

    if (!(await confirmEmailSubmit("job variation request"))) return;

    setIsSubmitting(true);

    try {
      const selectedReasons = getSelectedLabels(variationReasons);
      const variationPhotoAttachments = getPhotoAttachments(variationPhotos);
      const variationPhotoSummary = getPhotoSummary(
        variationPhotos,
        "No photos captured"
      );
      const subject = `Job variation request - ${
        selectedVariationJobOption?.name || selectedVariationJob
      }`;
      const message = buildFiledEmail({
        title: "Job Variation Request",
        reference: variationNumber.trim() || selectedVariationJob,
        sections: [
          {
            title: "Project Details",
            rows: [
              ["Project Name", selectedVariationJobOption?.name],
              ["Job Number", selectedVariationJob],
              ["Client", variationClient.trim()],
              ["Site Address", variationSiteAddress.trim()],
              ["Date", variationDate.trim()],
              ["Variation Number", variationNumber.trim()],
              ["Requested By", variationRequestedBy.trim()],
              ["WDL Representative", variationRepresentative.trim()],
            ],
          },
          {
            title: "Variation Details",
            rows: [
              ["Description", variationDescription.trim()],
              ["Reason for Variation", selectedReasons],
              ["Other Reason", variationOtherReason.trim()],
              ["Photos", variationPhotoSummary],
            ],
          },
          {
            title: "Resources Used",
            rows: [
              ["Labour Description", variationLabourDescription.trim()],
              ["Labour Hours", variationLabourHours.trim()],
              ["Plant Used", variationPlantUsed.trim()],
              ["Plant Hours", variationPlantHours.trim()],
              ["Materials Used", variationMaterialsUsed.trim()],
              ["Materials Quantity", variationMaterialsQuantity.trim()],
            ],
          },
        ],
      });
      const variationFields = {
        report_type: "Job Variation Request",
        template: "job_variation",
        job_number: selectedVariationJob,
        job_name: selectedVariationJobOption?.name || "",
        requested_by: variationRequestedBy.trim(),
        variation_number: variationNumber.trim() || "Not supplied",
        site_address: variationSiteAddress.trim() || "Not supplied",
        description: variationDescription.trim(),
        reasons: selectedReasons,
        photos:
          variationPhotos.length > 0
            ? `${variationPhotos.length} photo(s) captured`
            : "No photos captured",
      };

      const sentByFirebase = await sendFirebaseReport({
        reportType: "Job Variation Request",
        subject,
        message,
        fields: variationFields,
        photoList: variationPhotos,
        photoFilenamePrefix: "variation-photo",
      });

      if (sentByFirebase) {
        Alert.alert("Success", "Variation request emailed successfully.");
        resetVariationForm();
        return;
      }

      const canCompose = await MailComposer.isAvailableAsync();

      if (!canCompose) {
        Alert.alert(
          "Email App Required",
          "To send a variation request, this device needs an email app set up."
        );
        return;
      }

      const mailResult = await MailComposer.composeAsync({
        recipients: [activeRecipientEmail],
        subject,
        body: message,
        attachments:
          variationPhotoAttachments.length > 0
            ? variationPhotoAttachments
            : undefined,
      });

      if (mailResult.status === "cancelled") {
        return;
      }

      Alert.alert(
        "Success",
        "Variation email opened. Tap send in your email app to finish."
      );
      resetVariationForm();
    } catch (error) {
      Alert.alert("Email Failed", getEmailErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitHazardId = async () => {
    if (!hazardPreparedBy.trim()) {
      Alert.alert("Validation", "Please enter who prepared the Hazard ID.");
      return;
    }

    if (!hazardSiteAddress.trim()) {
      Alert.alert("Validation", "Please enter the site address.");
      return;
    }

    if (!hazardTaskDescription.trim()) {
      Alert.alert("Validation", "Please enter the task description.");
      return;
    }

    if (!(await confirmEmailSubmit("Hazard ID"))) return;

    setIsSubmitting(true);

    try {
      const selectedYardChecks = getSelectedLabels(hazardYardChecks);
      const selectedSiteChecks = getSelectedLabels(hazardSiteChecks);
      const selectedControls = getSelectedLabels(hazardControls);
      const subject = `Hazard ID - ${hazardSiteAddress.trim()}`;
      const message = buildFiledEmail({
        title: "Hazard Identification Worksheet",
        reference: hazardSiteAddress.trim(),
        sections: [
          {
            title: "Task Details",
            rows: [
              ["Site Address", hazardSiteAddress.trim()],
              ["Task Description", hazardTaskDescription.trim()],
              ["Prepared By", hazardPreparedBy.trim()],
              ["Start Date", hazardStartDate.trim()],
              ["Finish Date", hazardFinishDate.trim()],
            ],
          },
          {
            title: "Pre Start Checks",
            rows: [
              ["At Yard", selectedYardChecks],
              ["At Site", selectedSiteChecks],
            ],
          },
          {
            title: "Hazards and Controls",
            rows: [
              ["Hazards / Risks", hazardRisks.trim()],
              ["Controls in Place", selectedControls],
              ["Other Controls / Notes", hazardExtraControls.trim()],
            ],
          },
          {
            title: "Communication",
            rows: [
              ["Toolbox Meeting Notes", hazardToolboxMeeting.trim()],
              ["Worker / Contractor Sign-off Notes", hazardSignOffNotes.trim()],
              ["Signed-On Workers", getHazardSignOnSummary()],
            ],
          },
        ],
      });
      const hazardFields = {
        report_type: "Hazard Identification Worksheet",
        template: "hazard_id",
        site_address: hazardSiteAddress.trim(),
        task_description: hazardTaskDescription.trim(),
        prepared_by: hazardPreparedBy.trim(),
        start_date: hazardStartDate.trim() || "Not supplied",
        finish_date: hazardFinishDate.trim() || "Not supplied",
        signed_on_workers: getHazardSignOnSummary(),
      };

      const sentByFirebase = await sendFirebaseReport({
        reportType: "Hazard ID",
        subject,
        message,
        fields: hazardFields,
      });

      if (sentByFirebase) {
        Alert.alert("Success", "Hazard ID emailed successfully.");
        resetHazardForm();
        return;
      }

      const canCompose = await MailComposer.isAvailableAsync();

      if (!canCompose) {
        Alert.alert(
          "Email App Required",
          "To send a Hazard ID, this device needs an email app set up."
        );
        return;
      }

      const mailResult = await MailComposer.composeAsync({
        recipients: [activeRecipientEmail],
        subject,
        body: message,
      });

      if (mailResult.status === "cancelled") {
        return;
      }

      Alert.alert(
        "Success",
        "Hazard ID email opened. Tap send in your email app to finish."
      );
      resetHazardForm();
    } catch (error) {
      Alert.alert("Email Failed", getEmailErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchTemplate = (template) => {
    setSelectedTemplate(template);
    resetForm();
  };

  const CheckRow = ({ label, value, answerKey }) => (
    <View style={styles.checkRow}>
      <Text style={styles.checkText}>{label}</Text>

      <View style={styles.buttonGroup}>
        <Pressable
          style={[
            styles.checkButton,
            value === "Pass" && styles.checkButtonActive,
            isSubmitting && styles.disabledControl,
          ]}
          onPress={() => setAnswer(answerKey, "Pass")}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={`${label} pass`}
        >
          <PassCheckIcon active={value === "Pass"} />
        </Pressable>

        <Pressable
          style={[
            styles.xButton,
            value === "Fail" && styles.xButtonActive,
            isSubmitting && styles.disabledControl,
          ]}
          onPress={() => setAnswer(answerKey, "Fail")}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={`${label} fail`}
        >
          <FailCrossIcon active={value === "Fail"} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaProvider>
      <ImageBackground
        source={require("./assets/bg.png")}
        style={styles.background}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={
                !isDrawingSignature &&
                !isDrawingAsBuilt &&
                !isDrawingAsBuiltSignature
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
          <View style={styles.logoContainer}>
            <Image
              source={require("./assets/header-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {activePage === "menu" && (
            <View style={styles.menu}>
              {APP_TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  style={styles.menuButton}
                  onPress={() => setActivePage(tab.key)}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.menuButtonText}>{tab.label}</Text>
                  <Text style={styles.menuButtonSubtext}>{tab.description}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {activePage !== "menu" && (
            <Pressable
              style={[styles.backButton, isSubmitting && styles.disabledButton]}
              onPress={() => setActivePage("menu")}
              disabled={isSubmitting}
              accessibilityRole="button"
            >
              <Text style={styles.backButtonText}>BACK TO MENU</Text>
            </Pressable>
          )}

          {activePage === "settings" && (
            <>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Settings</Text>
                <Text style={styles.pageSubtitle}>
                  Manage where reports go and keep the job list up to date.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.formSectionTitle}>Email Submissions</Text>
                <Text style={styles.settingsHelpText}>
                  Current receiving email: {activeRecipientEmail}
                </Text>

                <View style={styles.labeledInput}>
                  <Text style={styles.inputLabel}>Receiving Email</Text>
                  <Pressable
                    style={[
                      styles.settingsSelectButton,
                      isSettingsEmailDropdownOpen &&
                        styles.settingsSelectButtonOpen,
                    ]}
                    onPress={() =>
                      setIsSettingsEmailDropdownOpen(
                        (currentValue) => !currentValue
                      )
                    }
                    disabled={isSubmitting}
                    accessibilityRole="button"
                  >
                    <Text style={styles.settingsSelectText}>
                      {settingsRecipientEmail}
                    </Text>
                    <Text style={styles.settingsSelectArrow}>
                      {isSettingsEmailDropdownOpen ? "-" : "+"}
                    </Text>
                  </Pressable>

                  {isSettingsEmailDropdownOpen && (
                    <View style={styles.settingsDropdownList}>
                      {RECIPIENT_EMAIL_OPTIONS.map((email) => {
                        const isSelected =
                          normalizeEmailAddress(settingsRecipientEmail).toLowerCase() ===
                          email.toLowerCase();

                        return (
                          <Pressable
                            key={email}
                            style={[
                              styles.settingsDropdownOption,
                              isSelected &&
                                styles.settingsDropdownOptionSelected,
                            ]}
                            onPress={() => selectRecipientEmail(email)}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.settingsDropdownOptionText,
                                isSelected &&
                                  styles.settingsDropdownOptionTextSelected,
                              ]}
                            >
                              {email}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.settingsButtonStack}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={restoreDefaultRecipient}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>
                      RESTORE DEFAULT EMAIL
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.formSectionTitle}>Map Template</Text>
                <Text style={styles.settingsHelpText}>
                  As-Built map snapshots are handled securely through Williams
                  Drainage backend settings.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.formSectionTitle}>Job List</Text>
                <Text style={styles.settingsHelpText}>
                  Add a job to the shared Firebase list, or refresh the jobs
                  saved for all devices.
                </Text>

                <StableLabeledInput
                  label="Job Number"
                  value={settingsJobNumber}
                  onChangeText={setSettingsJobNumber}
                  keyboardType="number-pad"
                  commitOnChange
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="Job Name"
                  value={settingsJobName}
                  onChangeText={setSettingsJobName}
                  commitOnChange
                  editable={!isSubmitting}
                />

                <View style={styles.settingsButtonStack}>
                  <Pressable
                    style={styles.settingsPrimaryButton}
                    onPress={addSettingsJob}
                    disabled={isSubmitting || isRefreshingJobs}
                    accessibilityRole="button"
                  >
                    {isRefreshingJobs ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.settingsPrimaryButtonText}>
                        ADD JOB TO SHARED LIST
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={[
                      styles.secondaryButton,
                      isRefreshingJobs && styles.disabledButton,
                    ]}
                    onPress={refreshJobs}
                    disabled={isSubmitting || isRefreshingJobs}
                    accessibilityRole="button"
                  >
                    {isRefreshingJobs ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.secondaryButtonText}>
                        REFRESH SHARED JOB LIST
                      </Text>
                    )}
                  </Pressable>
                </View>

                <Text style={styles.settingsHelpText}>
                  Jobs on this device: {jobOptions.length}
                </Text>

                <View style={styles.settingsJobList}>
                  {jobOptions.slice(0, 12).map((job) => (
                    <View key={job.number} style={styles.settingsJobPill}>
                      <Text style={styles.settingsJobPillText}>
                        {job.number} - {job.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.formSectionTitle}>Saved Device Details</Text>
                <Text style={styles.settingsHelpText}>
                  Clear the saved prestart operator, machine, hours, and expiry
                  fields from this phone.
                </Text>

                <Pressable
                  style={styles.settingsDangerButton}
                  onPress={clearSavedPrestartDetails}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.settingsDangerButtonText}>
                    CLEAR SAVED PRESTART DETAILS
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {activePage === "prestart" && (
            <>
          <View style={styles.tabs}>
            {TEMPLATE_TABS.map((tab) => {
              const isActive = selectedTemplate === tab.key;

              return (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.tab,
                    isActive && styles.activeTab,
                    isSubmitting && styles.disabledControl,
                  ]}
                  onPress={() => switchTemplate(tab.key)}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.tabText,
                      isActive && styles.activeTabText,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.card}>
            <StableLabeledInput
              label="Operator Name"
              value={operator}
              onChangeText={setOperator}
              editable={!isSubmitting}
            />

            <StableLabeledInput
              label={machineFieldLabel}
              value={machine}
              onChangeText={setMachine}
              editable={!isSubmitting}
            />

            {(selectedTemplate === "truck" || selectedTemplate === "digger") && (
              <StableLabeledInput
                label={selectedTemplate === "truck" ? "Hours / KMs" : "Hours"}
                value={hours}
                onChangeText={setHours}
                editable={!isSubmitting}
              />
            )}

            {selectedTemplate === "truck" && (
              <>
                <StableLabeledInput
                  label="WOF / COF Expiry"
                  value={wofExpiry}
                  onChangeText={setWofExpiry}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="Registration Expiry"
                  value={regoExpiry}
                  onChangeText={setRegoExpiry}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="RUC Expiry"
                  value={rucExpiry}
                  onChangeText={setRucExpiry}
                  editable={!isSubmitting}
                />
              </>
            )}

            {selectedTemplate === "trailer" && (
              <>
                <StableLabeledInput
                  label="Trailer Registration Expiry"
                  value={regoExpiry}
                  onChangeText={setRegoExpiry}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="Trailer WOF Expiry"
                  value={wofExpiry}
                  onChangeText={setWofExpiry}
                  editable={!isSubmitting}
                />
              </>
            )}
          </View>

          {checklist.map((section, sectionIndex) => (
            <View key={section.title} style={styles.section}>
              <Pressable
                style={styles.sectionHeader}
                onPress={() => toggleSection(section.title)}
                accessibilityRole="button"
              >
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.arrow}>
                  {collapsedSections[section.title] ? "⌄" : "⌃"}
                </Text>
              </Pressable>

              {!collapsedSections[section.title] && (
                <View style={styles.sectionContent}>
                  {section.items.map((item, itemIndex) => {
                    const answerKey = `${selectedTemplate}-${sectionIndex}-${itemIndex}`;

                    return (
                      <StableCheckRow
                        key={answerKey}
                        label={item}
                        value={answers[answerKey]}
                        answerKey={answerKey}
                        isSubmitting={isSubmitting}
                        onSetAnswer={setAnswer}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          ))}

          <View style={styles.card}>
            <Pressable
              onPress={pickImage}
              disabled={isSubmitting}
              style={[
                styles.photoButton,
                isSubmitting && styles.disabledButton,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.photoText}>Take Fault Photo</Text>
            </Pressable>

            <StablePhotoPreviewList photoList={photos} />

            <Text style={styles.inputLabel}>Fault Notes</Text>
            <DraftTextInput
              placeholder="Describe any issues or faults..."
              placeholderTextColor="#8a8a8a"
              multiline
              style={styles.notes}
              value={notes}
              onChangeText={setNotes}
              editable={!isSubmitting}
            />
          </View>

          <Pressable
            style={[
              styles.submitButton,
              isSubmitting && styles.disabledButton,
            ]}
            onPress={submitForm}
            disabled={isSubmitting}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>SUBMIT PRESTART</Text>
            )}
          </Pressable>
            </>
          )}

          {activePage === "incident" && (
            <>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Incident Report</Text>
                <Text style={styles.pageSubtitle}>
                  Record what happened and email it through for follow-up.
                </Text>
              </View>

              <View style={styles.card}>
                <DraftTextInput
                  placeholder="Reported By"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={incidentReporter}
                  onChangeText={setIncidentReporter}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Date / Time"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={incidentDate}
                  onChangeText={setIncidentDate}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Location"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={incidentLocation}
                  onChangeText={setIncidentLocation}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Machine / Vehicle Involved"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={incidentMachine}
                  onChangeText={setIncidentMachine}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Describe the incident..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={incidentDescription}
                  onChangeText={setIncidentDescription}
                  editable={!isSubmitting}
                />

                <View style={styles.inputGap} />

                <DraftTextInput
                  placeholder="Action taken / immediate response..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={incidentAction}
                  onChangeText={setIncidentAction}
                  editable={!isSubmitting}
                />

                <View style={styles.inputGap} />

                <Pressable
                  onPress={pickIncidentPhoto}
                  disabled={isSubmitting}
                  style={[
                    styles.photoButton,
                    isSubmitting && styles.disabledButton,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.photoText}>Take Incident Photo</Text>
                </Pressable>

                <StablePhotoPreviewList photoList={incidentPhotos} />
              </View>

              <Pressable
                style={[
                  styles.submitButton,
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={submitIncidentReport}
                disabled={isSubmitting}
                accessibilityRole="button"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitText}>SUBMIT INCIDENT</Text>
                )}
              </Pressable>
            </>
          )}

          {activePage === "purchase" && (
            <>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Purchase Order Request</Text>
                <Text style={styles.pageSubtitle}>
                  Send the request through so the PO number can be issued in Xero.
                </Text>
              </View>

              <View style={styles.card}>
                <DraftTextInput
                  placeholder="Requested By"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={poRequester}
                  onChangeText={setPoRequester}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Supplier"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={poSupplier}
                  onChangeText={setPoSupplier}
                  editable={!isSubmitting}
                />

                <StableJobSelect
                  selectedJobNumber={selectedPurchaseJob}
                  selectedJobOption={selectedPurchaseJobOption}
                  isOpen={isPurchaseJobDropdownOpen}
                  setIsOpen={setIsPurchaseJobDropdownOpen}
                  onSelectJob={setSelectedPurchaseJob}
                  jobOptions={jobOptions}
                  isSubmitting={isSubmitting}
                />

                <DraftTextInput
                  placeholder="Purchase details..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={poDetails}
                  onChangeText={setPoDetails}
                  editable={!isSubmitting}
                />
              </View>

              <Pressable
                style={[
                  styles.submitButton,
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={submitPurchaseOrder}
                disabled={isSubmitting}
                accessibilityRole="button"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitText}>
                    SUBMIT PURCHASE ORDER REQUEST
                  </Text>
                )}
              </Pressable>
            </>
          )}

          {activePage === "variation" && (
            <>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Job Variation</Text>
                <Text style={styles.pageSubtitle}>
                  Record extra work, scope changes, and supporting details.
                </Text>
              </View>

              <View style={styles.card}>
                <StableJobSelect
                  selectedJobNumber={selectedVariationJob}
                  selectedJobOption={selectedVariationJobOption}
                  isOpen={isVariationJobDropdownOpen}
                  setIsOpen={setIsVariationJobDropdownOpen}
                  onSelectJob={setSelectedVariationJob}
                  jobOptions={jobOptions}
                  isSubmitting={isSubmitting}
                />

                <DraftTextInput
                  placeholder="Requested By"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationRequestedBy}
                  onChangeText={setVariationRequestedBy}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Date"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationDate}
                  onChangeText={setVariationDate}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Client"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationClient}
                  onChangeText={setVariationClient}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Site Address"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationSiteAddress}
                  onChangeText={setVariationSiteAddress}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Variation Number"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationNumber}
                  onChangeText={setVariationNumber}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="WDL Representative"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationRepresentative}
                  onChangeText={setVariationRepresentative}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Description of variation..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={variationDescription}
                  onChangeText={setVariationDescription}
                  editable={!isSubmitting}
                />

                <Text style={styles.formSectionTitle}>Reason for Variation</Text>
                <View style={styles.optionGrid}>
                  {VARIATION_REASONS.map((reason) => {
                    const isSelected = !!variationReasons[reason];

                    return (
                      <Pressable
                        key={reason}
                        style={[
                          styles.optionButton,
                          isSelected && styles.optionButtonSelected,
                          isSubmitting && styles.disabledControl,
                        ]}
                        onPress={() => toggleVariationReason(reason)}
                        disabled={isSubmitting}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            isSelected && styles.optionButtonTextSelected,
                          ]}
                        >
                          {reason}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <DraftTextInput
                  placeholder="Other reason"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationOtherReason}
                  onChangeText={setVariationOtherReason}
                  editable={!isSubmitting}
                />

                <Text style={styles.formSectionTitle}>Resources Used</Text>
                <DraftTextInput
                  placeholder="Labour description"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationLabourDescription}
                  onChangeText={setVariationLabourDescription}
                  editable={!isSubmitting}
                />
                <DraftTextInput
                  placeholder="Labour hours"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationLabourHours}
                  onChangeText={setVariationLabourHours}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                <DraftTextInput
                  placeholder="Plant used"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationPlantUsed}
                  onChangeText={setVariationPlantUsed}
                  editable={!isSubmitting}
                />
                <DraftTextInput
                  placeholder="Plant hours"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationPlantHours}
                  onChangeText={setVariationPlantHours}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                <DraftTextInput
                  placeholder="Materials used"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationMaterialsUsed}
                  onChangeText={setVariationMaterialsUsed}
                  editable={!isSubmitting}
                />
                <DraftTextInput
                  placeholder="Materials quantity"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationMaterialsQuantity}
                  onChangeText={setVariationMaterialsQuantity}
                  editable={!isSubmitting}
                />

                <View style={styles.inputGap} />

                <Pressable
                  onPress={pickVariationPhoto}
                  disabled={isSubmitting}
                  style={[
                    styles.photoButton,
                    isSubmitting && styles.disabledButton,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.photoText}>Take Variation Photo</Text>
                </Pressable>

                <StablePhotoPreviewList photoList={variationPhotos} />
              </View>

              <Pressable
                style={[
                  styles.submitButton,
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={submitVariationRequest}
                disabled={isSubmitting}
                accessibilityRole="button"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitText}>SUBMIT VARIATION</Text>
                )}
              </Pressable>
            </>
          )}

          {activePage === "hazard" && (
            <>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Hazard ID</Text>
                <Text style={styles.pageSubtitle}>
                  Complete the task analysis and site hazard controls.
                </Text>
              </View>

              <View style={styles.card}>
                <DraftTextInput
                  placeholder="Site Address"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={hazardSiteAddress}
                  onChangeText={setHazardSiteAddress}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Task Description"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={hazardTaskDescription}
                  onChangeText={setHazardTaskDescription}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Prepared By"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={hazardPreparedBy}
                  onChangeText={setHazardPreparedBy}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Start Date"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={hazardStartDate}
                  onChangeText={setHazardStartDate}
                  editable={!isSubmitting}
                />

                <DraftTextInput
                  placeholder="Finish Date"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={hazardFinishDate}
                  onChangeText={setHazardFinishDate}
                  editable={!isSubmitting}
                />

                <Text style={styles.formSectionTitle}>Pre Start at Yard</Text>
                <View style={styles.optionGrid}>
                  {HAZARD_YARD_CHECKS.map((item) => {
                    const isSelected = !!hazardYardChecks[item];

                    return (
                      <Pressable
                        key={item}
                        style={[
                          styles.optionButton,
                          isSelected && styles.optionButtonSelected,
                          isSubmitting && styles.disabledControl,
                        ]}
                        onPress={() =>
                          toggleSelectedItem(setHazardYardChecks, item)
                        }
                        disabled={isSubmitting}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            isSelected && styles.optionButtonTextSelected,
                          ]}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.formSectionTitle}>
                  Pre Start Checklist At Site
                </Text>
                <View style={styles.optionGrid}>
                  {HAZARD_SITE_CHECKS.map((item) => {
                    const isSelected = !!hazardSiteChecks[item];

                    return (
                      <Pressable
                        key={item}
                        style={[
                          styles.optionButton,
                          isSelected && styles.optionButtonSelected,
                          isSubmitting && styles.disabledControl,
                        ]}
                        onPress={() =>
                          toggleSelectedItem(setHazardSiteChecks, item)
                        }
                        disabled={isSubmitting}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            isSelected && styles.optionButtonTextSelected,
                          ]}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <DraftTextInput
                  placeholder="Hazards / Risks..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={hazardRisks}
                  onChangeText={setHazardRisks}
                  editable={!isSubmitting}
                />

                <Text style={styles.formSectionTitle}>
                  Controls We Have Put In Place
                </Text>
                <View style={styles.optionGrid}>
                  {HAZARD_CONTROL_OPTIONS.map((item) => {
                    const isSelected = !!hazardControls[item];

                    return (
                      <Pressable
                        key={item}
                        style={[
                          styles.optionButton,
                          isSelected && styles.optionButtonSelected,
                          isSubmitting && styles.disabledControl,
                        ]}
                        onPress={() =>
                          toggleSelectedItem(setHazardControls, item)
                        }
                        disabled={isSubmitting}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            isSelected && styles.optionButtonTextSelected,
                          ]}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <DraftTextInput
                  placeholder="Other controls / notes..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={hazardExtraControls}
                  onChangeText={setHazardExtraControls}
                  editable={!isSubmitting}
                />

                <View style={styles.inputGap} />

                <DraftTextInput
                  placeholder="Toolbox meeting notes..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={hazardToolboxMeeting}
                  onChangeText={setHazardToolboxMeeting}
                  editable={!isSubmitting}
                />

                <View style={styles.inputGap} />

                <DraftTextInput
                  placeholder="Worker / contractor sign-off notes..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={hazardSignOffNotes}
                  onChangeText={setHazardSignOffNotes}
                  editable={!isSubmitting}
                />

                <View style={styles.inputGap} />

                <Pressable
                  onPress={() =>
                    setIsHazardSignOnOpen((currentValue) => !currentValue)
                  }
                  disabled={isSubmitting}
                  style={[
                    styles.photoButton,
                    isSubmitting && styles.disabledButton,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.photoText}>
                    {isHazardSignOnOpen ? "Close Sign On" : "Sign On"}
                  </Text>
                </Pressable>

                {isHazardSignOnOpen && (
                  <View style={styles.signOnPanel}>
                    <Text style={styles.signOnStatement}>
                      I have read and understand this Hazard ID and agree to
                      follow the controls listed for this task.
                    </Text>

                    <Pressable
                      style={styles.checkboxRow}
                      onPress={() =>
                        setHasHazardSignOnConfirmed((currentValue) => !currentValue)
                      }
                      disabled={isSubmitting}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: hasHazardSignOnConfirmed }}
                    >
                      <View
                        style={[
                          styles.checkboxBox,
                          hasHazardSignOnConfirmed && styles.checkboxBoxChecked,
                        ]}
                      >
                        {hasHazardSignOnConfirmed && (
                          <View style={styles.checkboxTickIcon}><View style={styles.checkboxTickShort} /><View style={styles.checkboxTickLong} /></View>
                        )}
                      </View>
                      <Text style={styles.checkboxText}>
                        I have read and understand
                      </Text>
                    </Pressable>

                    <View style={styles.labeledInput}>
                      <Text style={styles.inputLabel}>Name</Text>
                      <DraftTextInput
                        placeholder="Name"
                        placeholderTextColor="#8a8a8a"
                        style={styles.input}
                        value={hazardSignOnName}
                        onChangeText={setHazardSignOnName}
                        editable={!isSubmitting}
                      />
                    </View>

                    <Text style={styles.inputLabel}>Signature</Text>
                    <View
                      style={styles.signaturePad}
                      onLayout={(event) => {
                        const { width, height } = event.nativeEvent.layout;

                        setSignaturePadSize({ width, height });
                      }}
                      {...signaturePanResponder.panHandlers}
                    >
                      <StableSignatureInk strokes={hazardSignatureStrokes} />
                    </View>

                    <View style={styles.signOnActions}>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={clearHazardSignature}
                        disabled={isSubmitting}
                        accessibilityRole="button"
                      >
                        <Text style={styles.secondaryButtonText}>
                          CLEAR SIGNATURE
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.confirmSignOnButton,
                          isSubmitting && styles.disabledButton,
                        ]}
                        onPress={confirmHazardSignOn}
                        disabled={isSubmitting}
                        accessibilityRole="button"
                      >
                        <Text style={styles.confirmSignOnText}>
                          CONFIRM SIGN ON
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {hazardSignOns.length > 0 && (
                  <View style={styles.signOnList}>
                    <Text style={styles.formSectionTitle}>People Signed On</Text>
                    {hazardSignOns.map((signOn, index) => (
                      <View
                        key={`${signOn.name}-${signOn.signedAt}-${index}`}
                        style={styles.signOnListItem}
                      >
                        <View style={styles.signOnListText}>
                          <Text style={styles.signOnName}>{signOn.name}</Text>
                          <Text style={styles.signOnTime}>{signOn.signedAt}</Text>
                        </View>
                        <StableSignaturePreview
                          strokes={signOn.signatureStrokes}
                          small
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <Pressable
                style={[
                  styles.submitButton,
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={submitHazardId}
                disabled={isSubmitting}
                accessibilityRole="button"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitText}>SUBMIT HAZARD ID</Text>
                )}
              </Pressable>
            </>
          )}

          {activePage === "asbuilt" && (
            <>
              <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>As-Built's</Text>
                <Text style={styles.pageSubtitle}>
                  Sketch drain runs, fittings, and site notes for filing.
                </Text>
              </View>

              <View style={styles.card}>
                <StableLabeledInput
                  label="Address"
                  value={asBuiltAddress}
                  onChangeText={setAsBuiltAddress}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="Owner"
                  value={asBuiltOwner}
                  onChangeText={setAsBuiltOwner}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="Lot#"
                  value={asBuiltLotNumber}
                  onChangeText={setAsBuiltLotNumber}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="DPS#"
                  value={asBuiltDpsNumber}
                  onChangeText={setAsBuiltDpsNumber}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="Building Consent#"
                  value={asBuiltBuildingConsentNumber}
                  onChangeText={setAsBuiltBuildingConsentNumber}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="Inspection Date"
                  value={asBuiltInspectionDate}
                  onChangeText={setAsBuiltInspectionDate}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="Inspector"
                  value={asBuiltInspector}
                  onChangeText={setAsBuiltInspector}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="Drainlayer"
                  value={asBuiltDrainlayer}
                  onChangeText={setAsBuiltDrainlayer}
                  editable={!isSubmitting}
                />

                <StableLabeledInput
                  label="Drainage License#"
                  value={asBuiltDrainageLicenseNumber}
                  onChangeText={setAsBuiltDrainageLicenseNumber}
                  editable={!isSubmitting}
                />

                <Pressable
                  style={styles.asBuiltFocusButton}
                  onPress={() => setIsAsBuiltFocused((current) => !current)}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.asBuiltFocusButtonText}>
                    {isAsBuiltFocused ? "EXIT FULL SCREEN" : "EDIT FULL SCREEN"}
                  </Text>
                </Pressable>

                <View
                  style={[
                    styles.asBuiltBoard,
                    { height: asBuiltBoardHeight },
                    isAsBuiltFocused && styles.asBuiltBoardFocused,
                  ]}
                  onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;

                    setAsBuiltBoardSize({ width, height });
                  }}
                >
                  {asBuiltMapImageUrl ? (
                    <Image
                      source={{ uri: asBuiltMapImageUrl }}
                      style={[
                        styles.asBuiltMapImage,
                        {
                          transform: [
                            { translateX: asBuiltMapOffset.x },
                            { translateY: asBuiltMapOffset.y },
                            { rotate: `${asBuiltMapRotation}deg` },
                            { scale: asBuiltMapScale },
                          ],
                        },
                      ]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.asBuiltMapPlaceholder}>
                      <Text style={styles.asBuiltMapPlaceholderText}>
                        Enter an address to show the map template.
                      </Text>
                    </View>
                  )}

                  <Svg
                    style={styles.asBuiltSvgLayer}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {Array.from({ length: 11 }).map((_, index) => (
                      <Line
                        key={`grid-v-${index}`}
                        x1={index * 10}
                        y1={0}
                        x2={index * 10}
                        y2={100}
                        stroke="rgba(0,0,0,0.18)"
                        strokeWidth={0.18}
                      />
                    ))}
                    {Array.from({ length: 11 }).map((_, index) => (
                      <Line
                        key={`grid-h-${index}`}
                        x1={0}
                        y1={index * 10}
                        x2={100}
                        y2={index * 10}
                        stroke="rgba(0,0,0,0.18)"
                        strokeWidth={0.18}
                      />
                    ))}

                    {asBuiltLines.map((line) => (
                      <Line
                        key={line.id}
                        x1={line.start.x}
                        y1={line.start.y}
                        x2={line.end.x}
                        y2={line.end.y}
                        stroke={line.color}
                        strokeWidth={getAsBuiltWidth(line.width)}
                        strokeDasharray={
                          line.style === "dotted" ? "2 4" : undefined
                        }
                        strokeLinecap="round"
                      />
                    ))}

                    {getAsBuiltRoughPoints(currentAsBuiltLine).length > 1 && (
                      <Polyline
                        points={formatAsBuiltRoughPoints(
                          getAsBuiltRoughPoints(currentAsBuiltLine)
                        )}
                        fill="none"
                        stroke={currentAsBuiltLine.color}
                        strokeWidth={getAsBuiltWidth(currentAsBuiltLine.width)}
                        strokeDasharray={
                          currentAsBuiltLine.style === "dotted"
                            ? "2 4"
                            : undefined
                        }
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.72}
                      />
                    )}

                    {asBuiltSymbols.map((symbol) => (
                      <StableAsBuiltSymbol key={symbol.id} symbol={symbol} />
                    ))}
                  </Svg>

                  <View
                    style={styles.asBuiltDrawingTouchLayer}
                    {...asBuiltPanResponder.panHandlers}
                  />

                  <View style={styles.asBuiltOverlayControls} pointerEvents="box-none">
                    <View style={styles.asBuiltModeTabs}>
                      {[
                        { key: "draw", label: "Draw" },
                        { key: "symbols", label: "Symbols" },
                        { key: "map", label: "Map" },
                      ].map((panel) => {
                        const isSelected = asBuiltToolPanel === panel.key;

                        return (
                          <Pressable
                            key={panel.key}
                            style={[
                              styles.asBuiltModeTab,
                              isSelected && styles.asBuiltModeTabSelected,
                            ]}
                            onPress={() =>
                              setAsBuiltToolPanel((currentPanel) =>
                                currentPanel === panel.key ? "" : panel.key
                              )
                            }
                            disabled={isSubmitting}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.asBuiltModeTabText,
                                isSelected && styles.asBuiltModeTabTextSelected,
                              ]}
                            >
                              {panel.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {asBuiltToolPanel === "draw" && (
                      <View style={styles.asBuiltOverlayPanel}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                        >
                          <View style={styles.asBuiltOverlayOptionRow}>
                            <Pressable
                              style={[
                                styles.asBuiltToolButton,
                                asBuiltTool === "line" &&
                                  styles.asBuiltToolSelected,
                              ]}
                              onPress={() => {
                                setAsBuiltTool("line");
                                setAsBuiltToolPanel("");
                              }}
                              disabled={isSubmitting}
                              accessibilityRole="button"
                            >
                              <Text
                                style={[
                                  styles.asBuiltToolText,
                                  asBuiltTool === "line" &&
                                    styles.asBuiltToolTextSelected,
                                ]}
                              >
                                Line
                              </Text>
                            </Pressable>

                            {AS_BUILT_LINE_COLORS.map((color) => {
                              const isSelected = asBuiltLineColor === color.value;

                              return (
                                <Pressable
                                  key={color.value}
                                  style={[
                                    styles.asBuiltSwatchButton,
                                    isSelected && styles.asBuiltToolSelected,
                                  ]}
                                  onPress={() => {
                                    setAsBuiltLineColor(color.value);
                                    setAsBuiltTool("line");
                                    setAsBuiltToolPanel("");
                                  }}
                                  disabled={isSubmitting}
                                  accessibilityRole="button"
                                >
                                  <View
                                    style={[
                                      styles.asBuiltSwatch,
                                      { backgroundColor: color.value },
                                    ]}
                                  />
                                  <Text
                                    style={[
                                      styles.asBuiltToolText,
                                      isSelected &&
                                        styles.asBuiltToolTextSelected,
                                    ]}
                                  >
                                    {color.label}
                                  </Text>
                                </Pressable>
                              );
                            })}

                            {AS_BUILT_LINE_WIDTHS.map((width) => {
                              const isSelected = asBuiltLineWidth === width.value;

                              return (
                                <Pressable
                                  key={width.value}
                                  style={[
                                    styles.asBuiltToolButton,
                                    isSelected && styles.asBuiltToolSelected,
                                  ]}
                                  onPress={() => {
                                    setAsBuiltLineWidth(width.value);
                                    setAsBuiltTool("line");
                                    setAsBuiltToolPanel("");
                                  }}
                                  disabled={isSubmitting}
                                  accessibilityRole="button"
                                >
                                  <Text
                                    style={[
                                      styles.asBuiltToolText,
                                      isSelected &&
                                        styles.asBuiltToolTextSelected,
                                    ]}
                                  >
                                    {width.label}
                                  </Text>
                                </Pressable>
                              );
                            })}

                            {AS_BUILT_LINE_STYLES.map((lineStyle) => {
                              const isSelected =
                                asBuiltLineStyle === lineStyle.value;

                              return (
                                <Pressable
                                  key={lineStyle.value}
                                  style={[
                                    styles.asBuiltToolButton,
                                    isSelected && styles.asBuiltToolSelected,
                                  ]}
                                  onPress={() => {
                                    setAsBuiltLineStyle(lineStyle.value);
                                    setAsBuiltTool("line");
                                    setAsBuiltToolPanel("");
                                  }}
                                  disabled={isSubmitting}
                                  accessibilityRole="button"
                                >
                                  <Text
                                    style={[
                                      styles.asBuiltToolText,
                                      isSelected &&
                                        styles.asBuiltToolTextSelected,
                                    ]}
                                  >
                                    {lineStyle.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </ScrollView>
                      </View>
                    )}

                    {asBuiltToolPanel === "symbols" && (
                      <View style={styles.asBuiltOverlayPanel}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                        >
                          <View style={styles.asBuiltOverlayOptionRow}>
                            {AS_BUILT_SYMBOLS.map((symbol) => {
                              const isSelected = asBuiltTool === symbol.value;

                              return (
                                <Pressable
                                  key={symbol.value}
                                  style={[
                                    styles.asBuiltToolButton,
                                    isSelected && styles.asBuiltToolSelected,
                                  ]}
                                  onPress={() => {
                                    setAsBuiltTool(symbol.value);
                                    setAsBuiltToolPanel("");
                                  }}
                                  disabled={isSubmitting}
                                  accessibilityRole="button"
                                >
                                  <Text
                                    style={[
                                      styles.asBuiltToolText,
                                      isSelected &&
                                        styles.asBuiltToolTextSelected,
                                    ]}
                                  >
                                    {symbol.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </ScrollView>
                      </View>
                    )}

                    {asBuiltToolPanel === "map" && (
                      <View style={styles.asBuiltOverlayPanel}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                        >
                          <View style={styles.asBuiltOverlayOptionRow}>
                            <Text style={styles.asBuiltMapZoomText}>
                              {asBuiltMapScale.toFixed(1)}x
                            </Text>
                            <Text style={styles.asBuiltMapZoomText}>
                              {Math.round(asBuiltMapRotation)} deg
                            </Text>
                            <Text style={styles.asBuiltMapGestureHint}>
                              Use two fingers on the drawing to move, zoom, and
                              rotate the map.
                            </Text>
                            <Pressable
                              style={[
                                styles.asBuiltMapControlButton,
                                (!asBuiltMapImageUrl || isSubmitting) &&
                                  styles.disabledControl,
                              ]}
                              onPress={resetAsBuiltMapCrop}
                              disabled={!asBuiltMapImageUrl || isSubmitting}
                              accessibilityRole="button"
                            >
                              <Text style={styles.asBuiltMapControlText}>
                                Reset
                              </Text>
                            </Pressable>
                          </View>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.asBuiltBoardActions}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={undoAsBuiltMark}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>UNDO</Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondaryButton}
                    onPress={clearAsBuiltDrawing}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>CLEAR DRAWING</Text>
                  </Pressable>
                </View>

                <View style={styles.inputGap} />

                <Text style={styles.inputLabel}>Drainlayer Signature</Text>
                <View
                  style={styles.signaturePad}
                  onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;

                    setAsBuiltSignaturePadSize({ width, height });
                  }}
                  {...asBuiltSignaturePanResponder.panHandlers}
                >
                  <StableSignatureInk
                    strokes={asBuiltDrainlayerSignatureStrokes}
                  />
                </View>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={clearAsBuiltSignature}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryButtonText}>
                    CLEAR SIGNATURE
                  </Text>
                </Pressable>

                <View style={styles.inputGap} />

                <DraftTextInput
                  placeholder="Notes..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={asBuiltNotes}
                  onChangeText={setAsBuiltNotes}
                  editable={!isSubmitting}
                />
              </View>

              <Pressable
                style={[
                  styles.submitButton,
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={submitAsBuilt}
                disabled={isSubmitting}
                accessibilityRole="button"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitText}>SUBMIT AS-BUILT</Text>
                )}
              </Pressable>
            </>
          )}

          {activePage !== "menu" && (
            <Pressable
              style={[
                styles.bottomBackButton,
                isSubmitting && styles.disabledButton,
              ]}
              onPress={() => setActivePage("menu")}
              disabled={isSubmitting}
              accessibilityRole="button"
            >
              <Text style={styles.backButtonText}>BACK TO MAIN MENU</Text>
            </Pressable>
          )}
            </ScrollView>
            {activePage === "menu" && (
              <Pressable
                style={styles.settingsFloatingButton}
                onPress={() => setActivePage("settings")}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Open settings"
              >
                <SettingsGearIcon />
              </Pressable>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#080a0c",
  },

  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
  },

  keyboardAvoidingView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 140,
  },

  logoContainer: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 2,
    paddingHorizontal: 18,
  },

  logo: {
    width: "100%",
    maxWidth: 360,
    height: 150,
  },

  tabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 14,
    marginHorizontal: 12,
  },

  menu: {
    gap: 14,
    marginTop: 24,
    marginHorizontal: 18,
  },

  menuButton: {
    backgroundColor: "rgba(8,8,8,0.82)",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: "rgba(215,255,47,0.32)",
  },

  menuButtonText: {
    color: "#D7FF2F",
    fontSize: 24,
    fontWeight: "800",
  },

  menuButtonSubtext: {
    color: "#d8d8d8",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
  },

  settingsFloatingButton: {
    position: "absolute",
    right: 14,
    bottom: 18,
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.52)",
    borderWidth: 1,
    borderColor: "rgba(215,255,47,0.22)",
    opacity: 0.76,
  },

  backButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    marginHorizontal: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.74)",
    borderWidth: 1,
    borderColor: "rgba(215,255,47,0.38)",
  },

  backButtonText: {
    color: "#D7FF2F",
    fontSize: 13,
    fontWeight: "800",
  },

  bottomBackButton: {
    marginTop: 20,
    marginHorizontal: 18,
    marginBottom: 8,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.74)",
    borderWidth: 1,
    borderColor: "rgba(215,255,47,0.42)",
  },

  tab: {
    flex: 1,
    backgroundColor: "#111",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2c2c2c",
  },

  activeTab: {
    backgroundColor: "#D7FF2F",
  },

  activeTabText: {
    color: "#000",
  },

  tabText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  card: {
    backgroundColor: "rgba(8,8,8,0.78)",
    marginTop: 20,
    marginHorizontal: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  input: {
    backgroundColor: "#050505",
    color: "#fff",
    fontSize: 18,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1f1f1f",
  },

  labeledInput: {
    marginBottom: 2,
  },

  inputLabel: {
    color: "#D7FF2F",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
    paddingHorizontal: 4,
  },

  section: {
    backgroundColor: "rgba(8,8,8,0.78)",
    marginTop: 20,
    marginHorizontal: 18,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  sectionTitle: {
    color: "#D7FF2F",
    fontSize: 22,
    fontWeight: "800",
    flex: 1,
  },

  arrow: {
    color: "#D7FF2F",
    fontSize: 32,
    fontWeight: "800",
  },

  sectionContent: {
    marginTop: 22,
  },

  checkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },

  checkText: {
    color: "#fff",
    fontSize: 20,
    flex: 1,
  },

  buttonGroup: {
    flexDirection: "row",
    gap: 12,
  },

  checkButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#D7FF2F",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },

  checkButtonActive: {
    backgroundColor: "#D7FF2F",
  },

  xButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#ff4444",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },

  xButtonActive: {
    backgroundColor: "#ff4444",
  },

  photoButton: {
    backgroundColor: "#1748d1",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 18,
  },

  photoText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },

  photoPreview: {
    width: "100%",
    height: 220,
    borderRadius: 18,
    marginBottom: 16,
  },

  photoPreviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },

  photoPreviewThumb: {
    width: 96,
    height: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  notes: {
    backgroundColor: "#050505",
    color: "#fff",
    fontSize: 18,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#1f1f1f",
  },

  pageHeader: {
    marginTop: 22,
    marginHorizontal: 18,
  },

  pageTitle: {
    color: "#D7FF2F",
    fontSize: 26,
    fontWeight: "800",
  },

  pageSubtitle: {
    color: "#d6d6d6",
    fontSize: 16,
    lineHeight: 22,
    marginTop: 6,
  },

  inputGap: {
    height: 16,
  },

  formSectionTitle: {
    color: "#D7FF2F",
    fontSize: 19,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 12,
  },

  settingsHelpText: {
    color: "#d6d6d6",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 14,
  },

  settingsButtonStack: {
    gap: 10,
    marginTop: 2,
    marginBottom: 14,
  },

  settingsSelectButton: {
    backgroundColor: "#050505",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  settingsSelectButtonOpen: {
    borderColor: "rgba(215,255,47,0.62)",
  },

  settingsSelectText: {
    color: "#fff",
    fontSize: 17,
    flex: 1,
  },

  settingsSelectArrow: {
    color: "#D7FF2F",
    fontSize: 22,
    fontWeight: "800",
  },

  settingsDropdownList: {
    backgroundColor: "#080808",
    borderRadius: 18,
    marginTop: -4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(215,255,47,0.24)",
    overflow: "hidden",
  },

  settingsDropdownOption: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  settingsDropdownOptionSelected: {
    backgroundColor: "#D7FF2F",
  },

  settingsDropdownOptionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  settingsDropdownOptionTextSelected: {
    color: "#000",
  },

  settingsPrimaryButton: {
    backgroundColor: "#D7FF2F",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },

  settingsPrimaryButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "900",
  },

  settingsDangerButton: {
    backgroundColor: "#180808",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.68)",
  },

  settingsDangerButtonText: {
    color: "#ff6b6b",
    fontSize: 14,
    fontWeight: "900",
  },

  settingsJobList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  settingsJobPill: {
    backgroundColor: "#050505",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  settingsJobPillText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },

  optionButton: {
    backgroundColor: "#050505",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#1f1f1f",
  },

  optionButtonSelected: {
    backgroundColor: "#D7FF2F",
    borderColor: "#D7FF2F",
  },

  optionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  optionButtonTextSelected: {
    color: "#000",
  },

  signOnPanel: {
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(215,255,47,0.24)",
    marginBottom: 16,
  },

  signOnStatement: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 14,
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },

  checkboxBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#D7FF2F",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050505",
  },

  checkboxBoxChecked: {
    backgroundColor: "#D7FF2F",
  },

  checkboxTick: {
    color: "#000",
    fontSize: 19,
    fontWeight: "900",
  },

  checkboxTickIcon: {
    width: 18,
    height: 14,
    position: "relative",
  },

  checkboxTickShort: {
    position: "absolute",
    left: 2,
    top: 7,
    width: 7,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#000",
    transform: [{ rotate: "45deg" }],
  },

  checkboxTickLong: {
    position: "absolute",
    left: 7,
    top: 5,
    width: 11,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#000",
    transform: [{ rotate: "-48deg" }],
  },

  checkboxText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },

  signaturePad: {
    height: 150,
    backgroundColor: "#f8f8f8",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9d9d9",
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
  },

  signatureCanvas: {
    ...StyleSheet.absoluteFillObject,
  },

  signaturePreviewSmall: {
    width: 150,
    height: 58,
    marginBottom: 0,
  },

  signOnActions: {
    gap: 10,
  },

  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "#111",
  },

  secondaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  confirmSignOnButton: {
    backgroundColor: "#D7FF2F",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },

  confirmSignOnText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "900",
  },

  signOnList: {
    marginTop: 6,
  },

  signOnListItem: {
    backgroundColor: "#050505",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },

  signOnListText: {
    marginBottom: 10,
  },

  signOnName: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },

  signOnTime: {
    color: "#aaa",
    fontSize: 13,
    marginTop: 3,
  },

  jobPickerRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginBottom: 16,
  },

  jobSelectButton: {
    flex: 1,
    backgroundColor: "#050505",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  jobSelectButtonOpen: {
    borderColor: "rgba(215,255,47,0.62)",
  },

  jobSelectText: {
    color: "#fff",
    fontSize: 18,
    flex: 1,
  },

  jobSelectPlaceholder: {
    color: "#8a8a8a",
  },

  jobSelectArrow: {
    color: "#D7FF2F",
    fontSize: 22,
    fontWeight: "800",
  },

  jobDropdownList: {
    backgroundColor: "#080808",
    borderRadius: 18,
    marginTop: -8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(215,255,47,0.24)",
    overflow: "hidden",
  },

  jobDropdownOption: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  jobDropdownOptionSelected: {
    backgroundColor: "#D7FF2F",
  },

  jobDropdownOptionText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  jobDropdownOptionTextSelected: {
    color: "#000",
  },

  emptyJobText: {
    color: "#8a8a8a",
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },

  poNumberRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },

  poInput: {
    flex: 1,
  },

  generateButton: {
    backgroundColor: "#1748d1",
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 108,
  },

  generateText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  asBuiltSwatchButton: {
    backgroundColor: "#050505",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  asBuiltSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
  },

  asBuiltToolButton: {
    backgroundColor: "#050505",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#1f1f1f",
  },

  asBuiltToolSelected: {
    backgroundColor: "#D7FF2F",
    borderColor: "#D7FF2F",
  },

  asBuiltToolText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },

  asBuiltToolTextSelected: {
    color: "#000",
  },

  asBuiltBoard: {
    backgroundColor: "#f4f4f4",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(215,255,47,0.38)",
    marginTop: 4,
    marginBottom: 14,
    position: "relative",
  },

  asBuiltBoardFocused: {
    marginHorizontal: -10,
    borderRadius: 12,
  },

  asBuiltFocusButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(215,255,47,0.34)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 2,
    marginBottom: 10,
  },

  asBuiltFocusButtonText: {
    color: "#D7FF2F",
    fontSize: 12,
    fontWeight: "900",
  },

  asBuiltDrawingTouchLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },

  asBuiltOverlayControls: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    zIndex: 8,
    gap: 6,
  },

  asBuiltModeTabs: {
    flexDirection: "row",
    gap: 6,
  },

  asBuiltModeTab: {
    backgroundColor: "rgba(0,0,0,0.74)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  asBuiltModeTabSelected: {
    backgroundColor: "#D7FF2F",
    borderColor: "#D7FF2F",
  },

  asBuiltModeTabText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },

  asBuiltModeTabTextSelected: {
    color: "#000",
  },

  asBuiltOverlayPanel: {
    backgroundColor: "rgba(0,0,0,0.78)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(215,255,47,0.32)",
    padding: 8,
  },

  asBuiltOverlayOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },

  asBuiltMapImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.72,
  },

  asBuiltMapControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },

  asBuiltMapControlButton: {
    backgroundColor: "#050505",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(215,255,47,0.42)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 48,
    alignItems: "center",
  },

  asBuiltMapControlText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  asBuiltMapZoomText: {
    color: "#D7FF2F",
    fontSize: 14,
    fontWeight: "900",
    minWidth: 42,
    textAlign: "center",
  },

  asBuiltMapGestureHint: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    maxWidth: 260,
  },

  asBuiltMapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: "#ededed",
  },

  asBuiltMapPlaceholderText: {
    color: "#555",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "700",
  },

  asBuiltSvgLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  asBuiltBoardActions: {
    gap: 10,
  },

  submitButton: {
    backgroundColor: "#D7FF2F",
    marginTop: 24,
    marginHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
  },

  submitText: {
    color: "#000",
    fontSize: 22,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.6,
  },

  disabledControl: {
    opacity: 0.5,
  },
});


