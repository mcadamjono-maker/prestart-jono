const http = require("http");
const fs = require("fs");
const path = require("path");
const sgMail = require("@sendgrid/mail");

const PORT = Number(process.env.EMAIL_SERVER_PORT || 3001);

loadLocalEnv();

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/send-checklist") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (
    !process.env.SENDGRID_API_KEY ||
    process.env.SENDGRID_API_KEY === "REPLACE_WITH_NEW_SENDGRID_KEY"
  ) {
    sendJson(response, 500, {
      error: "SENDGRID_API_KEY is not configured in .env.local",
    });
    return;
  }

  try {
    const data = await readJsonBody(request);
    await sendChecklist(data);
    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 500, { error: String(error.message || error) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Email test server listening on http://0.0.0.0:${PORT}`);
});

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("Invalid JSON request body"));
      }
    });

    request.on("error", reject);
  });
}

async function sendChecklist(data) {
  const {
    operator,
    template,
    machine,
    hours,
    wofExpiry,
    regoExpiry,
    rucExpiry,
    notes,
    answers,
    photoBase64,
    photoName,
    photoType,
  } = data;

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const recipient =
    process.env.RECIPIENT_EMAIL || process.env.SENDER_EMAIL;
  const sender = process.env.SENDER_EMAIL;

  if (!sender || !recipient) {
    throw new Error("SENDER_EMAIL and RECIPIENT_EMAIL must be configured");
  }

  const answersText = Array.isArray(answers)
    ? answers
        .map((answer) => `${answer.section} - ${answer.item}: ${answer.result}`)
        .join("\n")
    : typeof answers === "string"
      ? answers
      : JSON.stringify(answers, null, 2);

  const message = {
    to: recipient,
    from: sender,
    subject: `Prestart Checklist - ${machine || "Unknown"}`,
    text: `Template: ${template || "Unknown"}\nOperator: ${operator}\nMachine: ${machine}\nHours: ${hours}\nWOF/COF: ${wofExpiry}\nRego: ${regoExpiry}\nRUC: ${rucExpiry}\n\nNotes:\n${notes}\n\nAnswers:\n${answersText}`,
  };

  if (photoBase64) {
    message.attachments = [
      {
        content: photoBase64,
        filename: photoName || "photo.jpg",
        type: photoType || "image/jpeg",
        disposition: "attachment",
      },
    ];
  }

  await sgMail.send(message);
}
