// Vercel Serverless Function: POST /api/message
// Required Vercel environment variable: RESEND_API_KEY
// Required: RESEND_FROM_EMAIL (a sender/domain verified in Resend)
// Optional: RESEND_TO_EMAIL (defaults to 403_error_4_u@proton.me)

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST to send a message." });
  }

  const payload = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});

  // Honeypot: bots often fill hidden fields. Silently accept without sending.
  if (clean(payload.website, 200)) {
    return res.status(200).json({ ok: true });
  }

  const name = clean(payload.name, 80) || "A mystery person";
  const email = clean(payload.email, 180);
  const message = clean(payload.message, 2000);

  if (message.length < 2) {
    return res.status(400).json({ error: "Please write a slightly longer message." });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please check the email address." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.RESEND_TO_EMAIL || "403_error_4_u@proton.me";

  if (!apiKey || !from) {
    console.error("Contact form is missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
    return res.status(503).json({
      error: "The message service isn't configured yet. Please use the email fallback."
    });
  }

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        ...(email ? { reply_to: email } : {}),
        subject: `Website note from ${name}`,
        text: [
          "A message arrived at 403 degrees of Apon.",
          "",
          `From: ${name}`,
          `Email: ${email || "Not supplied"}`,
          "",
          "Message:",
          message
        ].join("\n")
      })
    });

    if (!resendResponse.ok) {
      const details = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, details.slice(0, 500));
      return res.status(502).json({
        error: "The email provider couldn't send the message. Please try the email link instead."
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Message send failed:", error?.message || "Unknown error");
    return res.status(502).json({
      error: "Couldn't connect to the email provider. Please try the email link instead."
    });
  }
};

function clean(value, maxLength) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
