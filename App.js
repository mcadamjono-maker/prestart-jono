import React, { useEffect, useMemo, useState } from "react";
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
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { EmailJSResponseStatus, send } from "@emailjs/react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as MailComposer from "expo-mail-composer";

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
        "Reversing beeper",
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
const EMAIL_RECIPIENT = "jonomcadam@hotmail.com";
const PRESTART_STORAGE_PREFIX = "williams-prestart-values";
const JOB_STORAGE_KEY = "williams-purchase-order-jobs";
const JOB_LIST_URL = process.env.EXPO_PUBLIC_JOB_LIST_URL || "";

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

export default function App() {
  const [activePage, setActivePage] = useState("menu");
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
  const [variationImpact, setVariationImpact] = useState("");
  const [variationAdditionalTime, setVariationAdditionalTime] = useState("");
  const [variationAdditionalDaysReason, setVariationAdditionalDaysReason] =
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
  const [hasLoadedJobs, setHasLoadedJobs] = useState(false);

  const checklist = CHECKLIST_TEMPLATES[selectedTemplate];
  const machineFieldLabel =
    MACHINE_FIELD_LABELS[selectedTemplate] || "Machine ID / Rego";
  const selectedPurchaseJobOption = jobOptions.find(
    (job) => job.number === selectedPurchaseJob
  );
  const selectedVariationJobOption = jobOptions.find(
    (job) => job.number === selectedVariationJob
  );

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
        const savedJobs = await AsyncStorage.getItem(JOB_STORAGE_KEY);

        if (!isMounted) return;

        if (savedJobs) {
          const parsedJobs = JSON.parse(savedJobs);
          const validJobs = normalizeJobOptions(parsedJobs);

          if (validJobs.length > 0) {
            setJobOptions(validJobs);
          }
        }

        if (JOB_LIST_URL) {
          const response = await fetch(JOB_LIST_URL);

          if (!response.ok) {
            throw new Error(`Job list request failed: ${response.status}`);
          }

          const csvText = await response.text();
          const remoteJobs = normalizeJobOptions(parseJobSheetCsv(csvText));

          if (remoteJobs.length > 0 && isMounted) {
            setJobOptions(remoteJobs);
          }
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
    setVariationImpact("");
    setVariationAdditionalTime("");
    setVariationAdditionalDaysReason("");
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
        to_email: EMAIL_RECIPIENT,
        recipient_email: EMAIL_RECIPIENT,
        sender_email: EMAIL_RECIPIENT,
        from_email: EMAIL_RECIPIENT,
        reply_to: EMAIL_RECIPIENT,
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

  const clearHazardSignature = () => {
    setHazardSignatureStrokes([]);
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

  const submitForm = async () => {
    if (!validateForm()) return;

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

      if (photoAttachments.length > 0) {
        const canCompose = await MailComposer.isAvailableAsync();

        if (!canCompose) {
          Alert.alert(
            "Email App Required",
            "To send a photo, this device needs an email app set up."
          );
          return;
        }

        const mailResult = await MailComposer.composeAsync({
          recipients: [EMAIL_RECIPIENT],
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

      if (incidentPhotoAttachments.length > 0) {
        const canCompose = await MailComposer.isAvailableAsync();

        if (!canCompose) {
          Alert.alert(
            "Email App Required",
            "To send a photo, this device needs an email app set up."
          );
          return;
        }

        const mailResult = await MailComposer.composeAsync({
          recipients: [EMAIL_RECIPIENT],
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
          recipients: [EMAIL_RECIPIENT],
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

      if (EMAILJS_PURCHASE_TEMPLATE_ID) {
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
          recipients: [EMAIL_RECIPIENT],
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
          {
            title: "Project Impact",
            rows: [
              ["No Impact on Completion Date", variationImpact.trim()],
              ["Additional Time Required", variationAdditionalTime.trim()],
              [
                "Additional Days Required Reason",
                variationAdditionalDaysReason.trim(),
              ],
            ],
          },
        ],
      });

      const canCompose = await MailComposer.isAvailableAsync();

      if (!canCompose) {
        Alert.alert(
          "Email App Required",
          "To send a variation request, this device needs an email app set up."
        );
        return;
      }

      const mailResult = await MailComposer.composeAsync({
        recipients: [EMAIL_RECIPIENT],
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

      const canCompose = await MailComposer.isAvailableAsync();

      if (!canCompose) {
        Alert.alert(
          "Email App Required",
          "To send a Hazard ID, this device needs an email app set up."
        );
        return;
      }

      const mailResult = await MailComposer.composeAsync({
        recipients: [EMAIL_RECIPIENT],
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

  const JobSelect = ({
    selectedJobNumber,
    selectedJobOption,
    isOpen,
    setIsOpen,
    onSelectJob,
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

  const LabeledInput = ({ label, style, ...inputProps }) => (
    <View style={styles.labeledInput}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        placeholder={label}
        placeholderTextColor="#8a8a8a"
        style={[styles.input, style]}
        {...inputProps}
      />
    </View>
  );

  const PhotoPreviewList = ({ photoList }) => {
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

  const SignatureInk = ({ strokes, small = false }) => (
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

  const SignaturePreview = ({ strokes, small = false }) => (
    <View style={[styles.signaturePad, small && styles.signaturePreviewSmall]}>
      <SignatureInk strokes={strokes} small={small} />
    </View>
  );

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
          <Text style={styles.tick}>✓</Text>
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
          <Text style={styles.xText}>✕</Text>
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
              scrollEnabled={!isDrawingSignature}
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
            <LabeledInput
              label="Operator Name"
              value={operator}
              onChangeText={setOperator}
              editable={!isSubmitting}
            />

            <LabeledInput
              label={machineFieldLabel}
              value={machine}
              onChangeText={setMachine}
              editable={!isSubmitting}
            />

            {(selectedTemplate === "truck" || selectedTemplate === "digger") && (
              <LabeledInput
                label={selectedTemplate === "truck" ? "Hours / KMs" : "Hours"}
                value={hours}
                onChangeText={setHours}
                editable={!isSubmitting}
              />
            )}

            {selectedTemplate === "truck" && (
              <>
                <LabeledInput
                  label="WOF / COF Expiry"
                  value={wofExpiry}
                  onChangeText={setWofExpiry}
                  editable={!isSubmitting}
                />

                <LabeledInput
                  label="Registration Expiry"
                  value={regoExpiry}
                  onChangeText={setRegoExpiry}
                  editable={!isSubmitting}
                />

                <LabeledInput
                  label="RUC Expiry"
                  value={rucExpiry}
                  onChangeText={setRucExpiry}
                  editable={!isSubmitting}
                />
              </>
            )}

            {selectedTemplate === "trailer" && (
              <>
                <LabeledInput
                  label="Trailer Registration Expiry"
                  value={regoExpiry}
                  onChangeText={setRegoExpiry}
                  editable={!isSubmitting}
                />

                <LabeledInput
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
                      <CheckRow
                        key={answerKey}
                        label={item}
                        value={answers[answerKey]}
                        answerKey={answerKey}
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

            <PhotoPreviewList photoList={photos} />

            <Text style={styles.inputLabel}>Fault Notes</Text>
            <TextInput
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
                <TextInput
                  placeholder="Reported By"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={incidentReporter}
                  onChangeText={setIncidentReporter}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Date / Time"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={incidentDate}
                  onChangeText={setIncidentDate}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Location"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={incidentLocation}
                  onChangeText={setIncidentLocation}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Machine / Vehicle Involved"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={incidentMachine}
                  onChangeText={setIncidentMachine}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Describe the incident..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={incidentDescription}
                  onChangeText={setIncidentDescription}
                  editable={!isSubmitting}
                />

                <View style={styles.inputGap} />

                <TextInput
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

                <PhotoPreviewList photoList={incidentPhotos} />
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
                <TextInput
                  placeholder="Requested By"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={poRequester}
                  onChangeText={setPoRequester}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Supplier"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={poSupplier}
                  onChangeText={setPoSupplier}
                  editable={!isSubmitting}
                />

                <JobSelect
                  selectedJobNumber={selectedPurchaseJob}
                  selectedJobOption={selectedPurchaseJobOption}
                  isOpen={isPurchaseJobDropdownOpen}
                  setIsOpen={setIsPurchaseJobDropdownOpen}
                  onSelectJob={setSelectedPurchaseJob}
                />

                <TextInput
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
                  Record extra work, scope changes, impact, and supporting details.
                </Text>
              </View>

              <View style={styles.card}>
                <JobSelect
                  selectedJobNumber={selectedVariationJob}
                  selectedJobOption={selectedVariationJobOption}
                  isOpen={isVariationJobDropdownOpen}
                  setIsOpen={setIsVariationJobDropdownOpen}
                  onSelectJob={setSelectedVariationJob}
                />

                <TextInput
                  placeholder="Requested By"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationRequestedBy}
                  onChangeText={setVariationRequestedBy}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Date"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationDate}
                  onChangeText={setVariationDate}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Client"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationClient}
                  onChangeText={setVariationClient}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Site Address"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationSiteAddress}
                  onChangeText={setVariationSiteAddress}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Variation Number"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationNumber}
                  onChangeText={setVariationNumber}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="WDL Representative"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationRepresentative}
                  onChangeText={setVariationRepresentative}
                  editable={!isSubmitting}
                />

                <TextInput
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

                <TextInput
                  placeholder="Other reason"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationOtherReason}
                  onChangeText={setVariationOtherReason}
                  editable={!isSubmitting}
                />

                <Text style={styles.formSectionTitle}>Resources Used</Text>
                <TextInput
                  placeholder="Labour description"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationLabourDescription}
                  onChangeText={setVariationLabourDescription}
                  editable={!isSubmitting}
                />
                <TextInput
                  placeholder="Labour hours"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationLabourHours}
                  onChangeText={setVariationLabourHours}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                <TextInput
                  placeholder="Plant used"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationPlantUsed}
                  onChangeText={setVariationPlantUsed}
                  editable={!isSubmitting}
                />
                <TextInput
                  placeholder="Plant hours"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationPlantHours}
                  onChangeText={setVariationPlantHours}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                <TextInput
                  placeholder="Materials used"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationMaterialsUsed}
                  onChangeText={setVariationMaterialsUsed}
                  editable={!isSubmitting}
                />
                <TextInput
                  placeholder="Materials quantity"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationMaterialsQuantity}
                  onChangeText={setVariationMaterialsQuantity}
                  editable={!isSubmitting}
                />

                <Text style={styles.formSectionTitle}>Project Impact</Text>
                <TextInput
                  placeholder="No impact on completion date"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationImpact}
                  onChangeText={setVariationImpact}
                  editable={!isSubmitting}
                />
                <TextInput
                  placeholder="Additional time required"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={variationAdditionalTime}
                  onChangeText={setVariationAdditionalTime}
                  editable={!isSubmitting}
                />
                <TextInput
                  placeholder="Additional days required reason"
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={variationAdditionalDaysReason}
                  onChangeText={setVariationAdditionalDaysReason}
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

                <PhotoPreviewList photoList={variationPhotos} />
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
                <TextInput
                  placeholder="Site Address"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={hazardSiteAddress}
                  onChangeText={setHazardSiteAddress}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Task Description"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={hazardTaskDescription}
                  onChangeText={setHazardTaskDescription}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Prepared By"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={hazardPreparedBy}
                  onChangeText={setHazardPreparedBy}
                  editable={!isSubmitting}
                />

                <TextInput
                  placeholder="Start Date"
                  placeholderTextColor="#8a8a8a"
                  style={styles.input}
                  value={hazardStartDate}
                  onChangeText={setHazardStartDate}
                  editable={!isSubmitting}
                />

                <TextInput
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

                <TextInput
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

                <TextInput
                  placeholder="Other controls / notes..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={hazardExtraControls}
                  onChangeText={setHazardExtraControls}
                  editable={!isSubmitting}
                />

                <View style={styles.inputGap} />

                <TextInput
                  placeholder="Toolbox meeting notes..."
                  placeholderTextColor="#8a8a8a"
                  multiline
                  style={styles.notes}
                  value={hazardToolboxMeeting}
                  onChangeText={setHazardToolboxMeeting}
                  editable={!isSubmitting}
                />

                <View style={styles.inputGap} />

                <TextInput
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
                          <Text style={styles.checkboxTick}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.checkboxText}>
                        I have read and understand
                      </Text>
                    </Pressable>

                    <View style={styles.labeledInput}>
                      <Text style={styles.inputLabel}>Name</Text>
                      <TextInput
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
                      <SignatureInk strokes={hazardSignatureStrokes} />
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
                        <SignaturePreview
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
            </ScrollView>
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

  tick: {
    color: "#000",
    fontSize: 24,
    fontWeight: "800",
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

  xText: {
    color: "#000",
    fontSize: 22,
    fontWeight: "800",
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
