// WhatsApp integration — two tiers:
//
//   1. wa.me share links (always available): the inviter taps a button and
//      WhatsApp opens with a prefilled message to the invitee's number.
//   2. Meta Cloud API (optional): direct programmatic sends when
//      WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID are configured. Note that
//      freeform messages only reach users inside the 24h service window;
//      proactive notifications need approved message templates.
//
// Normalizes phone numbers to international digits (wa.me + Cloud API both
// want digits only).

const isWhatsAppConfigured = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

const normalizePhone = (phone) => {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  // Nigerian local numbers (0803...) -> international
  if (digits.startsWith('0') && digits.length === 11) digits = `234${digits.slice(1)}`;
  return digits.length >= 8 ? digits : null;
};

const whatsappShareLink = (phone, text) => {
  const num = normalizePhone(phone);
  const encoded = encodeURIComponent(text);
  return num ? `https://wa.me/${num}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
};

const sendWhatsAppText = async ({ to, text }) => {
  if (!isWhatsAppConfigured()) return { sent: false };
  const toNumber = normalizePhone(to);
  if (!toNumber) return { sent: false };

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'text',
        text: { body: text },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${body}`);
  }
  const data = await res.json();
  return { sent: true, messageId: data.messages?.[0]?.id };
};

module.exports = { isWhatsAppConfigured, whatsappShareLink, sendWhatsAppText, normalizePhone };
