/**
 * send-reengagement-email.js
 *
 * Sends smart re-engagement emails via Resend.
 *
 * Four types, in priority order:
 *   streak_warning  — loss-aversion nudge when a streak is about to break (Thu–Sun)
 *   badge_proximity — "you're N drams from [Badge]" when within 3 entries
 *   lapsed          — social digest + stats recap after 15–30 days inactive
 *   final           — soft "we miss you" for users gone 30+ days (max 3 total)
 *
 * Required environment variables:
 *   RESEND_API_KEY — Resend API key
 *   EMAIL_FROM     — verified sender address
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM     = process.env.EMAIL_FROM || 'The Dram Journal <hello@dramjournal.online>'
const APP_URL        = 'https://dramjournal.online'

// ── Colour palette (matches process-notifications.js) ────────────────────────

const AMBER       = '#B06A0A'
const AMBER_LIGHT = '#C8822A'
const PEAT        = '#FFFFFF'
const PEAT_LIGHT  = '#6B6B6B'
const CREAM       = '#111111'

// ── Shared shell ──────────────────────────────────────────────────────────────

function shell(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'Inter',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F5F5;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table cellpadding="0" cellspacing="0" border="0" width="520"
               style="max-width:520px;background:#FFFFFF;border-radius:16px;
                      overflow:hidden;border:1px solid rgba(200,130,42,0.2);">
          <tr>
            <td style="padding:24px 32px 20px;border-bottom:1px solid #F0EDE8;background:#FFFFFF;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td>
                  <div style="font-family:'Inter',Arial,sans-serif;font-size:22px;
                              font-weight:600;color:#111111;letter-spacing:-0.02em;">
                    The <span style="color:${AMBER_LIGHT};">Dram</span> Journal
                  </div>
                </td>
                <td align="right"><div style="font-size:24px;">🥃</div></td>
              </tr></table>
            </td>
          </tr>
          ${body}
          <tr>
            <td style="padding:16px 32px;border-top:1px solid rgba(200,130,42,0.15);background:#FAFAFA;">
              <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.06em;
                          color:#999999;text-align:center;">
                Manage notification preferences in your journal settings ·
                <a href="${APP_URL}" style="color:${AMBER_LIGHT};text-decoration:none;">dramjournal.online</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Email 1: Streak Warning ───────────────────────────────────────────────────
// Loss-aversion framing: "you're about to LOSE your streak"

function streakWarningHtml({ streak, daysLeft, badge }) {
  const urgencyLine = daysLeft === 0
    ? 'Tonight is the last chance to keep it going.'
    : daysLeft === 1
    ? 'You have 1 day left — log one dram tomorrow.'
    : `You have ${daysLeft} days left to keep it alive.`

  const dayLabel = daysLeft === 0 ? 'tonight' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`

  const badgeHint = badge ? `
    <tr>
      <td style="padding:0 32px 20px;">
        <div style="padding:12px 16px;background:rgba(200,130,42,0.06);border-radius:8px;
                    border:1px solid rgba(200,130,42,0.15);">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.12em;
                      text-transform:uppercase;color:${AMBER};margin-bottom:4px;">✦ Also close</div>
          <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${CREAM};line-height:1.5;">
            ${badge.icon} You're <strong>${badge.rem} dram${badge.rem > 1 ? 's' : ''}</strong> away from
            <span style="color:${AMBER_LIGHT};">${badge.name}</span>
          </div>
        </div>
      </td>
    </tr>` : ''

  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:#CC4400;margin-bottom:10px;">
          ✦ Streak at risk
        </div>
        <div style="font-size:36px;line-height:1;margin-bottom:12px;">🔥</div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:22px;
                    font-weight:600;color:${CREAM};line-height:1.2;margin-bottom:10px;">
          Your ${streak}-week streak ends ${dayLabel}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;">
          You haven't logged a dram this week. ${urgencyLine}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;
                    color:${AMBER_LIGHT};margin-top:10px;letter-spacing:0.06em;">
          ${streak} week${streak !== 1 ? 's' : ''} and counting
        </div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 20px;">
        <a href="${APP_URL}"
           style="display:inline-block;background:${AMBER};color:${PEAT};
                  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.15em;
                  text-transform:uppercase;text-decoration:none;padding:11px 26px;
                  border-radius:7px;font-weight:500;">
          Log a dram now →
        </a>
      </td>
    </tr>
    ${badgeHint}`)
}

function streakWarningText({ streak, daysLeft, badge }) {
  const urgency = daysLeft === 0
    ? 'Tonight is the last chance.'
    : `You have ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left.`
  const badgeLine = badge
    ? `\n\nAlso: you're ${badge.rem} dram${badge.rem !== 1 ? 's' : ''} away from the ${badge.name} badge ${badge.icon}`
    : ''
  return `THE DRAM JOURNAL — Streak at risk 🔥

Your ${streak}-week streak ends this week and you haven't logged a dram yet.
${urgency} One dram is all it takes.${badgeLine}

Log a dram: ${APP_URL}

Sláinte 🥃`
}

// ── Email 2: Badge Proximity ──────────────────────────────────────────────────
// Progress + proximity — the user is close to something tangible

function badgeProximityHtml({ badge }) {
  const pct = Math.round(((badge.target - badge.rem) / badge.target) * 100)
  const plural = badge.rem !== 1 ? 's' : ''

  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ✦ Almost there
        </div>
        <div style="font-size:40px;line-height:1;margin-bottom:14px;">${badge.icon}</div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:22px;
                    font-weight:600;color:${CREAM};line-height:1.2;margin-bottom:8px;">
          ${badge.name}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};
                    line-height:1.6;margin-bottom:16px;">
          You need <strong style="color:${CREAM};">${badge.rem} more dram${plural}</strong> to unlock this badge.
        </div>
        <div style="background:#F3F3F3;border-radius:8px;padding:12px 16px;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.12em;
                      text-transform:uppercase;color:${PEAT_LIGHT};margin-bottom:8px;">
            Progress
          </div>
          <div style="background:#E0E0E0;border-radius:4px;height:6px;overflow:hidden;">
            <div style="background:${AMBER};width:${pct}%;height:6px;border-radius:4px;"></div>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:10px;
                      color:${AMBER_LIGHT};margin-top:6px;">
            ${badge.target - badge.rem} / ${badge.target}
          </div>
        </div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 28px;">
        <a href="${APP_URL}"
           style="display:inline-block;background:${AMBER};color:${PEAT};
                  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.15em;
                  text-transform:uppercase;text-decoration:none;padding:11px 26px;
                  border-radius:7px;font-weight:500;">
          Continue your journey →
        </a>
      </td>
    </tr>`)
}

function badgeProximityText({ badge }) {
  const plural = badge.rem !== 1 ? 's' : ''
  return `THE DRAM JOURNAL — Almost there

${badge.icon} ${badge.name}

You're ${badge.rem} dram${plural} away from unlocking this badge.
Progress: ${badge.target - badge.rem} / ${badge.target}

Open your journal: ${APP_URL}

Sláinte 🥃`
}

// ── Email 3: Lapsed digest ────────────────────────────────────────────────────
// Social proof + stats recap for users gone 15–30 days

function lapsedHtml({ friendActivity, stats, daysSince }) {
  const daysText = daysSince >= 20
    ? `${Math.round(daysSince)} days`
    : 'a couple of weeks'

  const statCells = [
    { icon: '🥃', value: stats.total,     label: `whisky${stats.total !== 1 ? 'ies' : 'y'} tasted` },
    { icon: '🌍', value: stats.countries, label: `countr${stats.countries !== 1 ? 'ies' : 'y'} explored` },
  ].map(s => `
    <td style="text-align:center;padding:10px 16px;">
      <div style="font-size:20px;">${s.icon}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:500;
                  color:${CREAM};margin:4px 0 2px;">${s.value}</div>
      <div style="font-family:'Inter',Arial,sans-serif;font-size:11px;color:${PEAT_LIGHT};">${s.label}</div>
    </td>`).join('')

  const actRows = friendActivity && friendActivity.length > 0
    ? friendActivity.slice(0, 6).map(a => {
        const detail = a.type === 'rating'
          ? `${a.whisky_name}${a.whisky_distillery ? ' · ' + a.whisky_distillery : ''} — ${a.rating}/5`
          : `${a.whisky_name}${a.whisky_distillery ? ' · ' + a.whisky_distillery : ''}`
        return `
        <tr>
          <td style="padding:7px 0;border-bottom:1px solid rgba(200,130,42,0.08);">
            <div style="font-family:'Inter',Arial,sans-serif;font-size:12px;
                        color:${CREAM};line-height:1.5;">
              ${detail}
            </div>
          </td>
        </tr>`
      }).join('')
    : `<tr><td style="padding:12px 0;">
         <div style="font-family:'Inter',Arial,sans-serif;font-size:12px;color:${PEAT_LIGHT};line-height:1.6;">
           No recent activity from your friends this week.
         </div>
       </td></tr>`

  return shell(`
    <tr>
      <td style="padding:28px 32px 12px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ✦ While you were away
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:19px;
                    font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:8px;">
          It's been ${daysText} since your last dram
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;">
          Here's where your journal stands — and what your friends have been tasting.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 16px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>${statCells}</tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 8px;">
        <div style="border-top:1px solid rgba(200,130,42,0.15);margin-bottom:14px;"></div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:8px;">
          ✦ Friends this week
        </div>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          ${actRows}
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 28px;">
        <a href="${APP_URL}"
           style="display:inline-block;background:${AMBER};color:${PEAT};
                  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.15em;
                  text-transform:uppercase;text-decoration:none;padding:11px 26px;
                  border-radius:7px;font-weight:500;">
          Open Your Journal →
        </a>
      </td>
    </tr>`)
}

function lapsedText({ friendActivity, stats, daysSince }) {
  const daysText = daysSince >= 20 ? `${Math.round(daysSince)} days` : 'a couple of weeks'
  const friendLines = friendActivity && friendActivity.length > 0
    ? '\n\nFRIENDS THIS WEEK\n' + friendActivity.slice(0, 6).map(a =>
        `  • ${a.whisky_name}${a.whisky_distillery ? ' (' + a.whisky_distillery + ')' : ''}${a.type === 'rating' ? ' — ' + a.rating + '/5' : ''}`
      ).join('\n')
    : '\n\nNo recent activity from your friends.'
  return `THE DRAM JOURNAL — While you were away

It's been ${daysText} since your last dram.

YOUR JOURNAL
  🥃 ${stats.total} whisky${stats.total !== 1 ? 'ies' : 'y'} tasted
  🌍 ${stats.countries} countr${stats.countries !== 1 ? 'ies' : 'y'} explored
${friendLines}

Open your journal: ${APP_URL}

Sláinte 🥃`
}

// ── Email 4: Final nudge ──────────────────────────────────────────────────────
// Soft, no-pressure re-engagement for users gone 30+ days

function finalNudgeHtml({ stats }) {
  const statCells = [
    { icon: '🥃', value: stats.total,     label: `whisky${stats.total !== 1 ? 'ies' : 'y'} tasted` },
    { icon: '🌍', value: stats.countries, label: `countr${stats.countries !== 1 ? 'ies' : 'y'} explored` },
  ].map(s => `
    <td style="text-align:center;padding:10px 16px;">
      <div style="font-size:20px;">${s.icon}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:500;
                  color:${CREAM};margin:4px 0 2px;">${s.value}</div>
      <div style="font-family:'Inter',Arial,sans-serif;font-size:11px;color:${PEAT_LIGHT};">${s.label}</div>
    </td>`).join('')

  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ✦ Come back when you're ready
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:19px;
                    font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:12px;">
          Your Dram Journal is waiting for you
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};
                    line-height:1.6;margin-bottom:18px;">
          No pressure — your journal will be here whenever you're ready.
          Here's a reminder of what you've built so far.
        </div>
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>${statCells}</tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 28px;">
        <a href="${APP_URL}"
           style="display:inline-block;background:${AMBER};color:${PEAT};
                  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.15em;
                  text-transform:uppercase;text-decoration:none;padding:11px 26px;
                  border-radius:7px;font-weight:500;">
          Return to Your Journal →
        </a>
      </td>
    </tr>`)
}

function finalNudgeText({ stats }) {
  return `THE DRAM JOURNAL — Your journal is still here

No pressure — your Dram Journal will be here whenever you're ready.

  🥃 ${stats.total} whisky${stats.total !== 1 ? 'ies' : 'y'} tasted
  🌍 ${stats.countries} countr${stats.countries !== 1 ? 'ies' : 'y'} explored

Open your journal: ${APP_URL}

Sláinte 🥃`
}

// ── Email 5: Onboarding nudge ─────────────────────────────────────────────────
// For users who signed up but never logged a single whisky

function onboardingHtml() {
  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ✦ Start your journey
        </div>
        <div style="font-size:36px;line-height:1;margin-bottom:12px;">🥃</div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:22px;
                    font-weight:600;color:${CREAM};line-height:1.2;margin-bottom:10px;">
          Log your first dram
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};
                    line-height:1.6;margin-bottom:16px;">
          Your journal is ready — just add your first whisky to get started.
          No tasting notes required; a name and a rating is all it takes.
        </div>
        <div style="padding:12px 16px;background:rgba(200,130,42,0.06);border-radius:8px;
                    border:1px solid rgba(200,130,42,0.15);">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.12em;
                      text-transform:uppercase;color:${AMBER};margin-bottom:4px;">✦ First badge waiting</div>
          <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${CREAM};line-height:1.5;">
            🥃 Log one whisky to earn <span style="color:${AMBER_LIGHT};">First Dram</span>
          </div>
        </div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 28px;">
        <a href="${APP_URL}"
           style="display:inline-block;background:${AMBER};color:${PEAT};
                  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.15em;
                  text-transform:uppercase;text-decoration:none;padding:11px 26px;
                  border-radius:7px;font-weight:500;">
          Log My First Dram →
        </a>
      </td>
    </tr>`)
}

function onboardingText() {
  return `THE DRAM JOURNAL — Log your first dram 🥃

Your journal is ready — just add the first whisky you've been drinking.
No tasting notes required; a name and a rating is all it takes.

Log one whisky to earn the First Dram badge 🥃

Open your journal: ${APP_URL}

Sláinte 🥃`
}

// ── Send via Resend ───────────────────────────────────────────────────────────

/**
 * Sends a re-engagement email via Resend.
 *
 * @param {string} toEmail
 * @param {'streak_warning'|'badge_proximity'|'lapsed'|'final'|'onboarding'} type
 * @param {Object} payload
 *   streak_warning:  { streak, daysLeft, badge? }
 *   badge_proximity: { badge: { icon, name, rem, target } }
 *   lapsed:          { friendActivity, stats, daysSince }
 *   final:           { stats }
 *   onboarding:      {} (no payload needed)
 */
export async function sendReengagementEmail(toEmail, type, payload) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY env var is not set')

  const { streak = 0, daysLeft = 3, badge = null,
          friendActivity = [], stats = {}, daysSince = 0 } = payload

  let subject, html, text

  if (type === 'streak_warning') {
    const dayLabel = daysLeft === 0 ? 'tonight' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`
    subject = `🔥 Your ${streak}-week streak ends ${dayLabel} — The Dram Journal`
    html    = streakWarningHtml({ streak, daysLeft, badge })
    text    = streakWarningText({ streak, daysLeft, badge })

  } else if (type === 'badge_proximity') {
    const plural = badge.rem !== 1 ? 's' : ''
    subject = `${badge.icon} You're ${badge.rem} dram${plural} from ${badge.name} — The Dram Journal`
    html    = badgeProximityHtml({ badge })
    text    = badgeProximityText({ badge })

  } else if (type === 'lapsed') {
    subject = `🥃 While you were away — The Dram Journal`
    html    = lapsedHtml({ friendActivity, stats, daysSince })
    text    = lapsedText({ friendActivity, stats, daysSince })

  } else if (type === 'final') {
    subject = `🥃 Your journal is still here — The Dram Journal`
    html    = finalNudgeHtml({ stats })
    text    = finalNudgeText({ stats })

  } else if (type === 'onboarding') {
    subject = `🥃 Log your first dram — The Dram Journal`
    html    = onboardingHtml()
    text    = onboardingText()

  } else {
    throw new Error(`Unknown re-engagement email type: ${type}`)
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [toEmail], subject, html, text }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${data.message || JSON.stringify(data)}`)
  return data
}
