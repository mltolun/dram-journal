/**
 * send-recommendations-email.js
 *
 * Sends a branded HTML "Weekly Update" email combining:
 *   - Personalised whisky recommendations (from Gemini)
 *   - Activity digest from followed users (new journal entries & ratings)
 *
 * Required environment variables:
 *   RESEND_API_KEY — your Resend API key
 *   EMAIL_FROM     — sender address e.g. "Dram Journal <hello@yourdomain.com>"
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

// Colour palette
const AMBER       = '#A8620A'
const AMBER_LIGHT = '#C07820'
const PEAT        = '#F8F4EE'
const PEAT_MID    = '#EDE5D8'
const PEAT_LIGHT  = '#8A7060'
const CREAM       = '#2C1F10'
const CREAM_DARK  = '#4A3525'
const BORDER      = 'rgba(200,130,42,0.35)'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function barRow(label, value) {
  const pct = (value || 0) * 20
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

// ─── Recommendation card ──────────────────────────────────────────────────────

function recCard(rec) {
  const typeLabel = TYPE_LABELS[rec.type] || rec.type || ''
  const bars = ATTRS.map(a => barRow(ATTR_LABELS[a], rec[a])).join('')

  return `
  <table cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background:rgba(200,130,42,0.08);border:1px solid ${BORDER};
                border-radius:12px;margin-bottom:16px;overflow:hidden;">
    <tr>
      <td style="padding:18px 20px;">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.18em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:6px;">
          ${typeLabel}
        </div>
        <div style="font-family:'DM Sans',sans-serif;font-size:11px;
                    color:${PEAT_LIGHT};margin-bottom:2px;">
          ${rec.distillery || ''}
        </div>
        <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:400;
                    color:${CREAM};line-height:1.2;margin-bottom:4px;">
          ${rec.name}
        </div>
        <div style="margin-bottom:14px;">
          ${rec.age   ? `<span style="font-family:'DM Mono',monospace;font-size:10px;color:${CREAM_DARK};">${rec.age}</span>` : ''}
          ${rec.age && rec.price ? `<span style="color:${PEAT_LIGHT};margin:0 6px;">·</span>` : ''}
          ${rec.price ? `<span style="font-family:'DM Mono',monospace;font-size:10px;color:${AMBER_LIGHT};">${rec.price}</span>` : ''}
        </div>
        <table cellpadding="0" cellspacing="0" border="0" width="100%"
               style="margin-bottom:14px;">
          ${bars}
        </table>
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

// ─── Activity rendering (grouped by user → type) ─────────────────────────────

/**
 * Groups a flat activity array first by user_id, then by type ('rating'|'entry').
 * Returns an array of user-groups, each containing type-sub-groups:
 *   [ { userId, authorName, groups: [ { type, icon, label, events: [...] } ] } ]
 */
function groupActivity(events, authorEmailMap) {
  const userOrder = []
  const byUser = {}

  for (const event of events) {
    if (!byUser[event.user_id]) {
      const email = authorEmailMap[event.user_id] || 'a friend'
      byUser[event.user_id] = {
        userId: event.user_id,
        authorName: email.split('@')[0],
        byType: {},
      }
      userOrder.push(event.user_id)
    }
    const u = byUser[event.user_id]
    if (!u.byType[event.type]) u.byType[event.type] = []
    u.byType[event.type].push(event)
  }

  return userOrder.map(uid => {
    const u = byUser[uid]
    // Preferred order: ratings first, then journal entries
    const typeOrder = ['rating', 'entry'].filter(t => u.byType[t])
    const groups = typeOrder.map(type => ({
      type,
      icon:   type === 'rating' ? '⭐' : '📖',
      label:  type === 'rating' ? 'Rated' : 'Added to journal',
      events: u.byType[type],
    }))
    return { userId: uid, authorName: u.authorName, groups }
  })
}

function activityEventRow(event) {
  const dateStr = new Date(event.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })

  const detail = event.type === 'rating'
    ? `<strong>${event.whisky_name}</strong>${event.distillery ? ` <span style="color:${PEAT_LIGHT};">· ${event.distillery}</span>` : ''} — ${event.rating}/5`
    : `<strong>${event.whisky_name}</strong>${event.distillery ? ` <span style="color:${PEAT_LIGHT};">· ${event.distillery}</span>` : ''}`

  const notesHtml = event.notes
    ? `<div style="font-family:'DM Sans',sans-serif;font-size:11px;font-style:italic;
                   color:${PEAT_LIGHT};margin-top:4px;line-height:1.5;
                   padding-left:10px;border-left:2px solid rgba(200,130,42,0.3);">
         "${event.notes}"
       </div>`
    : ''

  return `
    <tr>
      <td style="padding:6px 0 6px 16px;border-bottom:1px solid rgba(200,130,42,0.07);">
        <div style="font-family:'DM Sans',sans-serif;font-size:12px;color:${CREAM_DARK};line-height:1.5;">
          ${detail}
          <span style="white-space:nowrap;font-family:'DM Mono',monospace;font-size:9px;
                       color:${PEAT_LIGHT};margin-left:8px;">${dateStr}</span>
        </div>
        ${notesHtml}
      </td>
    </tr>`
}

function activityUserBlock(userGroup) {
  const typeBlocks = userGroup.groups.map(g => {
    const rows = g.events.map(activityEventRow).join('')
    return `
  <tr>
    <td style="padding:4px 0 2px;">
      <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;
                  text-transform:uppercase;color:${PEAT_LIGHT};">
        ${g.icon}&nbsp;${g.label}
      </div>
    </td>
  </tr>
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${rows}
      </table>
    </td>
  </tr>`
  }).join('')

  return `
  <tr>
    <td style="padding:14px 0 4px;border-bottom:1px solid rgba(200,130,42,0.18);">
      <div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:500;
                  color:${AMBER_LIGHT};margin-bottom:4px;">
        ${userGroup.authorName}
      </div>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${typeBlocks}
      </table>
    </td>
  </tr>`
}

// ─── Full email HTML ──────────────────────────────────────────────────────────

function buildEmailHtml(recs, followerActivity, authorEmailMap, generatedAt) {
  const dateStr = new Date(generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const cards         = recs.map(recCard).join('')
  const hasActivity   = followerActivity && followerActivity.length > 0
  const activityRows  = hasActivity
    ? groupActivity(followerActivity, authorEmailMap).map(activityUserBlock).join('')
    : `<tr><td style="padding:16px 0;font-family:'DM Sans',sans-serif;font-size:12px;
                      font-style:italic;color:${PEAT_LIGHT};line-height:1.6;">
         Your friends had no new activity this week — check back next Monday.
       </td></tr>`

  const activitySection = `
          <!-- ── ACTIVITY DIVIDER ── -->
          <tr>
            <td style="padding:8px 32px 0;">
              <div style="border-top:1px solid rgba(200,130,42,0.2);"></div>
            </td>
          </tr>

          <!-- ── ACTIVITY HEADER ── -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.2em;
                          text-transform:uppercase;color:${AMBER};margin-bottom:8px;">
                ✦ Friends this week
              </div>
              <div style="font-family:'Playfair Display',Georgia,serif;font-size:17px;
                          font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:6px;">
                What your friends are tasting
              </div>
              <div style="font-family:'DM Sans',sans-serif;font-size:12px;color:${PEAT_LIGHT};
                          line-height:1.6;">
                Updates from people you follow in The Dram Journal.
              </div>
            </td>
          </tr>

          <!-- ── ACTIVITY ROWS ── -->
          <tr>
            <td style="padding:0 32px 8px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${activityRows}
              </table>
            </td>
          </tr>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your weekly dram update — The Dram Journal</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital@0;1&family=DM+Sans:ital@0;1&family=Playfair+Display:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#1C1408;font-family:'DM Sans',Arial,sans-serif;">

  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1C1408;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">

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
                ✦ Weekly Update
              </div>
              <div style="font-family:'Playfair Display',Georgia,serif;font-size:20px;
                          font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:10px;">
                Your picks &amp; what's new with friends
              </div>
              <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:${PEAT_LIGHT};
                          line-height:1.6;">
                Your AI sommelier has selected five whiskies matched to your palate,
                plus a roundup of what your friends have been tasting this week.
              </div>
            </td>
          </tr>

          <!-- ── RECOMMENDATION SUBHEADING ── -->
          <tr>
            <td style="padding:0 32px 12px;">
              <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.2em;
                          text-transform:uppercase;color:${AMBER};margin-bottom:4px;">
                ✦ Your picks this week
              </div>
            </td>
          </tr>

          <!-- ── REC CARDS ── -->
          <tr>
            <td style="padding:0 32px 8px;">
              ${cards}
            </td>
          </tr>

          ${activitySection}

          <!-- ── CTA ── -->
          <tr>
            <td align="center" style="padding:16px 32px 28px;">
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
                      Sent every Monday · Manage followers in app settings
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

      </td>
    </tr>
  </table>

</body>
</html>`
}

// ─── Plain-text fallback ──────────────────────────────────────────────────────

function buildEmailText(recs, followerActivity, authorEmailMap, generatedAt) {
  const dateStr = new Date(generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const recLines = recs.map((rec, i) => {
    const attrs = ATTRS.map(a => `${ATTR_LABELS[a]}: ${rec[a] || 0}/5`).join(' · ')
    return [
      `${i + 1}. ${rec.name}`,
      `   ${rec.distillery || ''}${rec.age ? ' · ' + rec.age : ''}${rec.price ? ' · ' + rec.price : ''}`,
      `   ${attrs}`,
      rec.reason ? `   "${rec.reason}"` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  let activityText = ''
  if (followerActivity && followerActivity.length > 0) {
    const userGroups = groupActivity(followerActivity, authorEmailMap)
    const actLines = userGroups.map(ug => {
      const typeLines = ug.groups.map(g => {
        const label = g.type === 'rating' ? 'Rated' : 'Added to journal'
        const items = g.events.map(e => {
          const detail = g.type === 'rating'
            ? `"${e.whisky_name}" ${e.rating}/5${e.distillery ? ' (' + e.distillery + ')' : ''}`
            : `"${e.whisky_name}"${e.distillery ? ' (' + e.distillery + ')' : ''}`
          return `    • ${detail}`
        }).join('\n')
        return `  ${label}:\n${items}`
      }).join('\n')
      return `${ug.authorName}\n${typeLines}`
    }).join('\n\n')

    activityText = `\n\nFRIENDS THIS WEEK\n-----------------\n${actLines}`
  }

  return `THE DRAM JOURNAL — WEEKLY UPDATE
==================================

YOUR PICKS THIS WEEK
Based on your tasting journal, here are 5 personalised whisky recommendations:

${recLines}${activityText}

Generated on ${dateStr}
Open your journal at https://dramjournal.online

Sláinte 🥃`
}

// ─── Resend API call ──────────────────────────────────────────────────────────

/**
 * Sends the weekly combined email via Resend.
 *
 * @param {string} toEmail          - recipient email address
 * @param {Array}  recs             - recommendation objects from Gemini
 * @param {Array}  followerActivity - activity_feed rows from followed users
 * @param {Object} authorEmailMap   - map of user_id → email for activity authors
 * @param {string} generatedAt      - ISO timestamp
 */
export async function sendWeeklyEmail(toEmail, recs, followerActivity, authorEmailMap, generatedAt) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY env var is not set')

  const html = buildEmailHtml(recs, followerActivity, authorEmailMap, generatedAt)
  const text = buildEmailText(recs, followerActivity, authorEmailMap, generatedAt)

  const subject = '🥃 Your weekly dram update — The Dram Journal'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [toEmail], subject, html, text }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(`Resend API error ${res.status}: ${data.message || JSON.stringify(data)}`)
  }

  return data
}

// Keep the old export name as an alias for any tooling that calls it directly
export const sendRecommendationsEmail = (toEmail, recs, generatedAt) =>
  sendWeeklyEmail(toEmail, recs, [], {}, generatedAt)