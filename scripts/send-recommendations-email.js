/**
 * send-recommendations-email.js
 *
 * Sends a branded HTML email to a user with their whisky recommendations.
 * Called from generate-recommendations.js after upsert.
 *
 * Required environment variable:
 *   RESEND_API_KEY — your Resend API key
 *   EMAIL_FROM     — sender address e.g. "Dram Journal <hello@yourdomain.com>"
 *                    (must be a verified domain in Resend)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM     = process.env.EMAIL_FROM || 'The Dram Journal <hello@dramjournal.online>'

const TYPE_LABELS = {
  scotch: 'Scotch', irish: 'Irish', bourbon: 'Bourbon',
  japanese: 'Japanese', other: 'Other',
}

const ATTR_LABELS = {
  dulzor:    'Sweetness',
  ahumado:   'Smokiness',
  cuerpo:    'Body',
  frutado:   'Fruitiness',
  especiado: 'Spiciness',
}

const ATTRS = ['dulzor', 'ahumado', 'cuerpo', 'frutado', 'especiado']

// Amber colour used for filled bars — matches --amber-light
const AMBER      = '#A8620A'
const AMBER_LIGHT = '#C07820'
const PEAT       = '#F8F4EE'
const PEAT_MID   = '#EDE5D8'
const PEAT_LIGHT = '#8A7060;'
const CREAM      = '#2C1F10;'
const CREAM_DARK = '#4A3525'
const BORDER     = 'rgba(200,130,42,0.35)'

// ─── Bar HTML helper ──────────────────────────────────────────────────────────

function barRow(label, value) {
  const pct = (value || 0) * 20  // 0-5 → 0-100%
  return `
    <tr>
      <td style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.08em;
                 color:${PEAT_LIGHT};text-transform:uppercase;padding:3px 8px 3px 0;
                 white-space:nowrap;width:70px;">${label}</td>
      <td style="padding:3px 8px 3px 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="background:rgba(250,245,236,0.10);border-radius:4px;height:5px;
                       overflow:hidden;min-width:80px;">
              <div style="background:${AMBER_LIGHT};width:${pct}%;height:5px;
                          border-radius:4px;"></div>
            </td>
          </tr>
        </table>
      </td>
      <td style="font-family:'DM Mono',monospace;font-size:10px;color:${AMBER_LIGHT};
                 padding:3px 0;white-space:nowrap;width:16px;text-align:right;">
        ${value || 0}
      </td>
    </tr>`
}

// ─── Single recommendation card ───────────────────────────────────────────────

function recCard(rec) {
  const typeLabel = TYPE_LABELS[rec.type] || rec.type || ''
  const bars = ATTRS.map(a => barRow(ATTR_LABELS[a], rec[a])).join('')

  return `
  <table cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background:rgba(200,130,42,0.08);border:1px solid ${BORDER};
                border-radius:12px;margin-bottom:16px;overflow:hidden;">
    <tr>
      <td style="padding:18px 20px;">

        <!-- Type badge -->
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.18em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:6px;">
          ${typeLabel}
        </div>

        <!-- Distillery -->
        <div style="font-family:'DM Sans',sans-serif;font-size:11px;
                    color:${PEAT_LIGHT};margin-bottom:2px;">
          ${rec.distillery || ''}
        </div>

        <!-- Name -->
        <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:400;
                    color:${CREAM};line-height:1.2;margin-bottom:4px;">
          ${rec.name}
        </div>

        <!-- Age + Price row -->
        <div style="margin-bottom:14px;">
          ${rec.age   ? `<span style="font-family:'DM Mono',monospace;font-size:10px;
                                     color:${CREAM_DARK};">${rec.age}</span>` : ''}
          ${rec.age && rec.price ? `<span style="color:${PEAT_LIGHT};margin:0 6px;">·</span>` : ''}
          ${rec.price ? `<span style="font-family:'DM Mono',monospace;font-size:10px;
                                     color:${AMBER_LIGHT};">${rec.price}</span>` : ''}
        </div>

        <!-- Flavour bars -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%"
               style="margin-bottom:14px;">
          ${bars}
        </table>

        <!-- Reason -->
        ${rec.reason ? `
        <div style="font-family:'DM Sans',sans-serif;font-size:12px;font-style:italic;
                    color:${PEAT_LIGHT};line-height:1.55;border-top:1px solid rgba(200,130,42,0.2);
                    padding-top:12px;">
          ${rec.reason}
        </div>` : ''}

      </td>
    </tr>
  </table>`
}

// ─── Full email HTML ──────────────────────────────────────────────────────────

function buildEmailHtml(recs, generatedAt) {
  const dateStr = new Date(generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const cards = recs.map(recCard).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your weekly whisky picks — The Dram Journal</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital@0;1&family=DM+Sans:ital@0;1&family=Playfair+Display:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#1C1408;font-family:'DM Sans',Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1C1408;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">

        <!-- Card -->
        <table cellpadding="0" cellspacing="0" border="0" width="600"
               style="max-width:600px;background:${PEAT};border-radius:16px;
                      overflow:hidden;border:1px solid rgba(200,130,42,0.2);">

          <!-- ── HEADER ── -->
          <tr>
            <td style="padding:28px 32px 24px;border-bottom:1px solid rgba(200,130,42,0.2);
                       background:linear-gradient(to bottom,rgba(200,130,42,0.06),transparent);">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <!-- Logo -->
                    <div style="font-family:'Playfair Display',Georgia,serif;font-size:26px;
                                font-weight:400;color:${CREAM};letter-spacing:-0.02em;line-height:1;">
                      The <span style="color:${AMBER_LIGHT};font-style:italic;">Dram</span> Journal
                    </div>
                    <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.22em;
                                text-transform:uppercase;color:${PEAT_LIGHT};margin-top:4px;">
                      Your personal whisky companion
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <!-- Whisky glass emoji badge -->
                    <div style="font-size:28px;line-height:1;">🥃</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── INTRO ── -->
          <tr>
            <td style="padding:28px 32px 20px;">
              <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.2em;
                          text-transform:uppercase;color:${AMBER};margin-bottom:8px;">
                ✦ Weekly Picks
              </div>
              <div style="font-family:'Playfair Display',Georgia,serif;font-size:20px;
                          font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:10px;">
                Your personalised whisky recommendations
              </div>
              <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:${PEAT_LIGHT};
                          line-height:1.6;">
                Based on your tasting journal, our sommelier AI has handpicked five whiskies
                that match your flavour preferences. Open the app to add any of them to
                your wishlist.
              </div>
            </td>
          </tr>

          <!-- ── CARDS ── -->
          <tr>
            <td style="padding:0 32px 8px;">
              ${cards}
            </td>
          </tr>

          <!-- ── CTA ── -->
          <tr>
            <td align="center" style="padding:12px 32px 28px;">
              <a href="https://dramjournal.online"
                 style="display:inline-block;background:${AMBER};color:${PEAT};
                        font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.15em;
                        text-transform:uppercase;text-decoration:none;padding:12px 28px;
                        border-radius:7px;font-weight:500;">
                Open My Journal →
              </a>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(200,130,42,0.15);
                       background:rgba(250,245,236,0.02);">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.1em;
                                color:${PEAT_LIGHT};">
                      Generated on ${dateStr}
                    </div>
                    <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.06em;
                                color:rgba(122,98,85,0.6);margin-top:4px;">
                      Recommendations refresh every Monday · Unsubscribe in app settings
                    </div>
                  </td>
                  <td align="right">
                    <div style="font-family:'Playfair Display',Georgia,serif;font-size:13px;
                                font-style:italic;color:rgba(200,130,42,0.5);">
                      Sláinte
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`
}

// ─── Plain-text fallback ──────────────────────────────────────────────────────

function buildEmailText(recs, generatedAt) {
  const dateStr = new Date(generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const lines = recs.map((rec, i) => {
    const attrs = ATTRS.map(a => `${ATTR_LABELS[a]}: ${rec[a] || 0}/5`).join(' · ')
    return [
      `${i + 1}. ${rec.name}`,
      `   ${rec.distillery || ''}${rec.age ? ' · ' + rec.age : ''}${rec.price ? ' · ' + rec.price : ''}`,
      `   ${attrs}`,
      rec.reason ? `   "${rec.reason}"` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  return `THE DRAM JOURNAL — YOUR WEEKLY PICKS
=====================================

Based on your tasting journal, here are 5 personalised whisky recommendations:

${lines}

Generated on ${dateStr}
Open your journal at https://dramjournal.online

Sláinte 🥃`
}

// ─── Resend API call ──────────────────────────────────────────────────────────

/**
 * Sends the recommendations email via Resend.
 *
 * @param {string} toEmail   - recipient email address
 * @param {Array}  recs      - array of recommendation objects from Gemini
 * @param {string} generatedAt - ISO timestamp
 */
export async function sendRecommendationsEmail(toEmail, recs, generatedAt) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY env var is not set')

  const html = buildEmailHtml(recs, generatedAt)
  const text = buildEmailText(recs, generatedAt)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    EMAIL_FROM,
      to:      [toEmail],
      subject: '🥃 Your weekly whisky picks — The Dram Journal',
      html,
      text,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(`Resend API error ${res.status}: ${data.message || JSON.stringify(data)}`)
  }

  return data  // { id: "...", ... }
}
