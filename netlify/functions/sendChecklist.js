const sgMail = require("@sendgrid/mail");

exports.handler = async function (event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true }),
    };
  }

  if (!process.env.SENDGRID_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "SENDGRID_API_KEY not configured" }),
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    const {
      operator,
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

    const recipient = process.env.RECIPIENT_EMAIL || process.env.SENDER_EMAIL || "recipient@example.com";
    const sender = process.env.SENDER_EMAIL || "no-reply@example.com";

    const answersText = typeof answers === "string" ? answers : JSON.stringify(answers, null, 2);

    const text = `Operator: ${operator}\nMachine: ${machine}\nHours: ${hours}\nWOF/COF: ${wofExpiry}\nRego: ${regoExpiry}\nRUC: ${rucExpiry}\n\nNotes:\n${notes}\n\nAnswers:\n${answersText}`;

    const msg = {
      to: recipient,
      from: sender,
      subject: `Prestart Checklist - ${machine || "Unknown"}`,
      text,
    };

    if (photoBase64) {
      msg.attachments = [
        {
          content: photoBase64,
          filename: photoName || "photo.jpg",
          type: photoType || "image/jpeg",
          disposition: "attachment",
        },
      ];
    }

    await sgMail.send(msg);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
