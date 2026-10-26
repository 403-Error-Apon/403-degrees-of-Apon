// Vercel serverless function. Requires RESEND_API_KEY and RESEND_FROM_EMAIL
// environment variables. Optional RESEND_TO_EMAIL defaults to the owner's inbox.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST to send a message." });
  }

  const payload = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  if (payload.website) return res.status(200).json({ ok: true }); // honeypot for basic bot filtering

  const name = clean(payload.name, 80) || "A mystery person";
  const email = clean(payload.email, 180);
  const message = clean(payload.message, 2000);
  if (message.length < 2) return res.status(400).json({ error: "Please write a slightly longer message." });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Please check the email address." });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.RESEND_TO_EMAIL || "403_error_4_u@proton.me";
  if (!apiKey || !from) {
    return res.status(503).json({ error: "Message service isn't configured. Please use the email fallback." });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email || undefined,
        subject: `Website note from ${name}`,
        text: `A message arrived at 403 degrees of Apon.\n\nFrom: ${name}\nEmail: ${email || "Not supplied"}\n\nMessage:\n${message}`
      })
    });
    if (!response.ok) {
      const details = await response.text();
      console.error("Resend API error:", response.status, details.slice(0, 500));
      return res.status(502).json({ error: "The email provider could not send the message." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Message send failed:", error.message);
    return res.status(502).json({ error: "Could not connect to the email provider." });
  }
};

function clean(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maxLength);
}
function safeParse(value) {
  try { return JSON.parse(value); } catch (_) { return {}; }
}
