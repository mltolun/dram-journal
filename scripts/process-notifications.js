/**
 * process-notifications.js
 *
 * Daily GitHub Actions script.
 * Reads pending_notifications from Supabase, sends each email via Resend,
 * then deletes the processed rows.
 *
 * Required environment variables:
 *   SUPABASE_URL         — your project URL
 *   SUPABASE_SERVICE_KEY — service role key
 *   RESEND_API_KEY       — Resend API key
 *   EMAIL_FROM           — verified sender address
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const RESEND_API_KEY       = process.env.RESEND_API_KEY
const EMAIL_FROM           = process.env.EMAIL_FROM || 'The Dram Journal <hello@dramjournal.online>'
const APP_URL              = 'https://dramjournal.online'

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

// ── Colour palette ────────────────────────────────────────────────────────────

const AMBER       = '#B06A0A'
const AMBER_LIGHT = '#C8822A'
const PEAT        = '#FFFFFF'
const PEAT_LIGHT  = '#6B6B6B'
const CREAM       = '#111111'

// ── Strings (i18n) ────────────────────────────────────────────────────────────

const STRINGS = {
  en: {
    footerManage: 'Manage followers in your journal settings',
    txtBrand: 'THE DRAM JOURNAL',
    txtSignoff: 'Sláinte 🥃',
    // Follow request
    followReqTag:      '✦ New follow request',
    followReqHeadline: 'Someone wants to follow your journal',
    followReqBody:     (name) => `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${AMBER_LIGHT};">${name}</span>&nbsp;has sent you a follow request. If you accept, they'll receive a weekly digest of the whiskies you add and rate.`,
    followReqCta:      'Review request →',
    followReqSubject:  '🥃 Someone wants to follow your Dram Journal',
    followReqTxtHdr:   'New follow request',
    followReqTxtBody:  (name) => `${name} wants to follow your whisky journal.\n\nIf you accept, they'll receive a weekly digest of the whiskies you add and rate.`,
    followReqTxtCta:   'Open the app to accept or decline',
    // Follow accepted
    followAccTag:      '✦ Request accepted',
    followAccHeadline: "You're now following their journal",
    followAccBody:     (name) => `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${AMBER_LIGHT};">${name}</span>&nbsp;accepted your follow request. You'll now receive their whisky additions and ratings in your weekly Monday update.`,
    followAccCta:      'Open My Journal →',
    followAccSubject:  '🥃 Your follow request was accepted — The Dram Journal',
    followAccTxtHdr:   'Follow request accepted',
    followAccTxtBody:  (name) => `${name} accepted your follow request.\n\nYou'll now receive their whisky additions and ratings in your weekly Monday update.`,
    followAccTxtCta:   'Open your journal',
    // Direct message
    dmTag:      '✦ A friend shared a dram',
    dmIntro:    (name) => `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${AMBER_LIGHT};">${name}</span>&nbsp;thinks you'd enjoy this:`,
    dmFooter:   "Open the app to see the full tasting profile and add it to your wishlist.",
    dmCta:      'Open My Inbox →',
    dmSubject:  (name) => `🥃 ${name} shared a whisky with you — The Dram Journal`,
    dmTxtHdr:   'A friend shared a dram',
    dmTxtIntro: (name) => `${name} thinks you'd enjoy`,
    dmTxtCta:   'Open the app to see the full tasting profile',
    // Badge earned
    badgeTag:     '✦ Badge unlocked',
    badgeCta:     'View My Badges →',
    badgeSubject: (icon, name) => `${icon} You unlocked a badge: ${name} — The Dram Journal`,
    badgeTxtHdr:  'Badge unlocked',
    badgeTxtCta:  'Open the app to view your stats',
    // Feature request
    statusCopy: {
      accepted:    { emoji: '✦', color: '#A8620A', label: 'Request accepted',  body: "Great news — we've accepted your feature request and added it to the roadmap." },
      in_progress: { emoji: '⚙', color: '#A8620A', label: 'Now in progress',   body: "We've started building your feature request. Stay tuned for the update." },
      done:        { emoji: '✓', color: '#1D9E75', label: 'Feature shipped',    body: 'Your feature request has been built and is now live in The Dram Journal.' },
      declined:    { emoji: '✕', color: '#8A7060', label: 'Request declined',   body: "After review we've decided not to build this feature for now. Thank you for the suggestion." },
    },
    statusLabels:    { accepted: 'Accepted', in_progress: 'In Progress', done: 'Shipped', declined: 'Declined' },
    frFromTeam:      'From the team',
    frCta:           'Open My Journal →',
    frSubject:       (label) => `🥃 Feature request ${label} — The Dram Journal`,
    frTxtHdr:        (label) => label,
    frTxtFeature:    'Feature',
    frTxtFromTeam:   'From the team',
    frTxtCta:        'Open the app',
  },
  es: {
    footerManage: 'Gestiona tus seguidores en la configuración',
    txtBrand: 'THE DRAM JOURNAL',
    txtSignoff: 'Sláinte 🥃',
    // Follow request
    followReqTag:      '✦ Nueva solicitud de seguimiento',
    followReqHeadline: 'Alguien quiere seguir tu diario',
    followReqBody:     (name) => `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${AMBER_LIGHT};">${name}</span>&nbsp;te ha enviado una solicitud de seguimiento. Si la aceptas, recibirá un resumen semanal de los whiskies que añadas y valores.`,
    followReqCta:      'Revisar solicitud →',
    followReqSubject:  '🥃 Alguien quiere seguir tu Dram Journal',
    followReqTxtHdr:   'Nueva solicitud de seguimiento',
    followReqTxtBody:  (name) => `${name} quiere seguir tu diario de whiskies.\n\nSi aceptas, recibirá un resumen semanal de los whiskies que añadas y valores.`,
    followReqTxtCta:   'Abre la app para aceptar o rechazar',
    // Follow accepted
    followAccTag:      '✦ Solicitud aceptada',
    followAccHeadline: 'Ahora sigues su diario',
    followAccBody:     (name) => `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${AMBER_LIGHT};">${name}</span>&nbsp;aceptó tu solicitud de seguimiento. Ahora recibirás sus adiciones y valoraciones de whisky en tu actualización semanal de los lunes.`,
    followAccCta:      'Abrir Mi Diario →',
    followAccSubject:  '🥃 Tu solicitud de seguimiento fue aceptada — The Dram Journal',
    followAccTxtHdr:   'Solicitud de seguimiento aceptada',
    followAccTxtBody:  (name) => `${name} aceptó tu solicitud de seguimiento.\n\nAhora recibirás sus adiciones y valoraciones de whisky en tu actualización semanal de los lunes.`,
    followAccTxtCta:   'Abre tu diario',
    // Direct message
    dmTag:      '✦ Un amigo compartió un dram',
    dmIntro:    (name) => `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${AMBER_LIGHT};">${name}</span>&nbsp;cree que te va a gustar esto:`,
    dmFooter:   'Abre la app para ver el perfil de sabor completo y añadirlo a tu lista de deseos.',
    dmCta:      'Abrir Mi Bandeja →',
    dmSubject:  (name) => `🥃 ${name} compartió un whisky contigo — The Dram Journal`,
    dmTxtHdr:   'Un amigo compartió un dram',
    dmTxtIntro: (name) => `${name} cree que te va a gustar`,
    dmTxtCta:   'Abre la app para ver el perfil de sabor completo',
    // Badge earned
    badgeTag:     '✦ Insignia desbloqueada',
    badgeCta:     'Ver Mis Insignias →',
    badgeSubject: (icon, name) => `${icon} Desbloqueaste una insignia: ${name} — The Dram Journal`,
    badgeTxtHdr:  'Insignia desbloqueada',
    badgeTxtCta:  'Abre la app para ver tus estadísticas',
    // Feature request
    statusCopy: {
      accepted:    { emoji: '✦', color: '#A8620A', label: 'Solicitud aceptada',  body: 'Buenas noticias — hemos aceptado tu solicitud de función y la hemos añadido a la hoja de ruta.' },
      in_progress: { emoji: '⚙', color: '#A8620A', label: 'En progreso',          body: 'Hemos comenzado a construir tu solicitud de función. Pronto tendrás novedades.' },
      done:        { emoji: '✓', color: '#1D9E75', label: 'Función publicada',     body: 'Tu solicitud de función ha sido implementada y ya está disponible en The Dram Journal.' },
      declined:    { emoji: '✕', color: '#8A7060', label: 'Solicitud rechazada',   body: 'Tras revisión, hemos decidido no implementar esta función por ahora. Gracias por la sugerencia.' },
    },
    statusLabels:    { accepted: 'Aceptada', in_progress: 'En progreso', done: 'Publicada', declined: 'Rechazada' },
    frFromTeam:      'Del equipo',
    frCta:           'Abrir Mi Diario →',
    frSubject:       (label) => `🥃 Solicitud de función ${label} — The Dram Journal`,
    frTxtHdr:        (label) => label,
    frTxtFeature:    'Función',
    frTxtFromTeam:   'Del equipo',
    frTxtCta:        'Abrir la app',
  },
}

// Active strings — set per-email based on recipient locale.
// Notifications are processed sequentially so this is safe.
let _s = STRINGS.en

// ── Email builders ────────────────────────────────────────────────────────────

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
            <td style="padding:24px 32px 20px;border-bottom:1px solid rgba(200,130,42,0.2);
                       background:#FFFFFF;border-bottom:1px solid #F0EDE8;">
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
            <td style="padding:16px 32px;border-top:1px solid rgba(200,130,42,0.15);
                       background:#FAFAFA;">
              <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.06em;
                          color:#999999;text-align:center;">
                ${_s.footerManage} ·
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

function followRequestHtml(fromEmail) {
  const name = fromEmail.split('@')[0]
  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ${_s.followReqTag}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:19px;
                    font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:12px;">
          ${_s.followReqHeadline}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;">
          ${_s.followReqBody(name)}
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
          ${_s.followReqCta}
        </a>
      </td>
    </tr>`)
}

function followRequestText(fromEmail) {
  const name = fromEmail.split('@')[0]
  return `${_s.txtBrand} — ${_s.followReqTxtHdr}

${_s.followReqTxtBody(name)}

${_s.followReqTxtCta}: ${APP_URL}

${_s.txtSignoff}`
}

function followAcceptedHtml(fromEmail) {
  const name = fromEmail.split('@')[0]
  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:#1D9E75;margin-bottom:10px;">
          ${_s.followAccTag}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:19px;
                    font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:12px;">
          ${_s.followAccHeadline}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;">
          ${_s.followAccBody(name)}
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
          ${_s.followAccCta}
        </a>
      </td>
    </tr>`)
}

function followAcceptedText(fromEmail) {
  const name = fromEmail.split('@')[0]
  return `${_s.txtBrand} — ${_s.followAccTxtHdr}

${_s.followAccTxtBody(name)}

${_s.followAccTxtCta}: ${APP_URL}

${_s.txtSignoff}`
}

// ── Direct message ────────────────────────────────────────────────────────────

function directMessageHtml(fromEmail, whiskyName, distillery, message) {
  const name = fromEmail.split('@')[0]
  const sub  = distillery ? `<div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${PEAT_LIGHT};margin-bottom:14px;">${distillery}</div>` : ''
  const msg  = message ? `<div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;margin-top:12px;padding:10px 14px;background:rgba(200,130,42,0.08);border-radius:6px;">${message}</div>` : ''
  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ${_s.dmTag}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};
                    line-height:1.6;margin-bottom:16px;">
          ${_s.dmIntro(name)}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:20px;
                    font-weight:400;color:${CREAM};line-height:1.2;margin-bottom:4px;">
          ${whiskyName}
        </div>
        ${sub}
        ${msg}
        <div style="font-family:'Inter',Arial,sans-serif;font-size:12px;color:${PEAT_LIGHT};line-height:1.6;${message ? 'margin-top:12px;' : ''}">
          ${_s.dmFooter}
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
          ${_s.dmCta}
        </a>
      </td>
    </tr>`)
}

function directMessageText(fromEmail, whiskyName, distillery, message) {
  const name = fromEmail.split('@')[0]
  return `${_s.txtBrand} — ${_s.dmTxtHdr}

${_s.dmTxtIntro(name)}: ${whiskyName}${distillery ? ' (' + distillery + ')' : ''}${message ? '\n\n"' + message + '"' : ''}

${_s.dmTxtCta}: ${APP_URL}

${_s.txtSignoff}`
}

// ── Badge earned ─────────────────────────────────────────────────────────────

function badgeEarnedHtml(badgeIcon, badgeName, badgeDesc) {
  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ${_s.badgeTag}
        </div>
        <div style="font-size:40px;line-height:1;margin-bottom:14px;">${badgeIcon}</div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:22px;
                    font-weight:600;color:${CREAM};line-height:1.2;margin-bottom:8px;">
          ${badgeName}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;">
          ${badgeDesc}
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
          ${_s.badgeCta}
        </a>
      </td>
    </tr>`)
}

function badgeEarnedText(badgeIcon, badgeName, badgeDesc) {
  return `${_s.txtBrand} — ${_s.badgeTxtHdr}

${badgeIcon} ${badgeName}

${badgeDesc}

${_s.badgeTxtCta}: ${APP_URL}

${_s.txtSignoff}`
}

// ── Feature request status update ────────────────────────────────────────────

function featureRequestHtml(status, featureTitle, adminNote) {
  const s = _s.statusCopy[status] || _s.statusCopy.accepted
  const noteHtml = adminNote
    ? `<div style="margin-top:16px;padding:12px 16px;background:rgba(200,130,42,0.08);border-left:2px solid ${AMBER_LIGHT};border-radius:4px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:${AMBER_LIGHT};margin-bottom:6px;">${_s.frFromTeam}</div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:12px;color:${PEAT_LIGHT};line-height:1.6;">${adminNote}</div>
       </div>`
    : ''
  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${s.color};margin-bottom:10px;">
          ${s.emoji} ${s.label}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:19px;
                    font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:12px;">
          ${featureTitle}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;">
          ${s.body}
        </div>
        ${noteHtml}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 28px;">
        <a href="${APP_URL}"
           style="display:inline-block;background:${AMBER};color:${PEAT};
                  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.15em;
                  text-transform:uppercase;text-decoration:none;padding:11px 26px;
                  border-radius:7px;font-weight:500;">
          ${_s.frCta}
        </a>
      </td>
    </tr>`)
}

function featureRequestText(status, featureTitle, adminNote) {
  const s = _s.statusCopy[status] || _s.statusCopy.accepted
  return `${_s.txtBrand} — ${_s.frTxtHdr(s.label)}

${_s.frTxtFeature}: ${featureTitle}

${s.body}${adminNote ? `\n\n${_s.frTxtFromTeam}: ${adminNote}` : ''}

${_s.frTxtCta}: ${APP_URL}

${_s.txtSignoff}`
}

// ── Send via Resend ───────────────────────────────────────────────────────────

async function sendEmail(to, subject, html, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Resend error ${res.status}: ${err.message || JSON.stringify(err)}`)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📬 Processing pending notifications...')

  // ── Build email → locale map from Supabase auth users ────────────────────

  const localeByEmail = {}
  let page = 1
  while (true) {
    const { data: { users }, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !users?.length) break
    for (const u of users) if (u.email) localeByEmail[u.email] = u.user_metadata?.locale || 'en'
    if (users.length < 1000) break
    page++
  }

  // ── Pass 1: pending_notifications table (follow requests, direct messages) ──

  const { data: notifications, error } = await sb
    .from('pending_notifications')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch notifications: ${error.message}`)

  if (!notifications.length) {
    console.log('   No pending notifications.')
  }

  console.log(`   Found ${notifications.length} pending notification(s)`)

  const processed = []
  const failed    = []

  for (const n of notifications) {
    _s = STRINGS[localeByEmail[n.to_email] || 'en'] ?? STRINGS.en
    try {
      if (n.type === 'follow_request') {
        await sendEmail(
          n.to_email,
          _s.followReqSubject,
          followRequestHtml(n.from_email),
          followRequestText(n.from_email),
        )
        console.log(`   ✉ follow_request → ${n.to_email}`)
      } else if (n.type === 'follow_accepted') {
        await sendEmail(
          n.to_email,
          _s.followAccSubject,
          followAcceptedHtml(n.from_email),
          followAcceptedText(n.from_email),
        )
        console.log(`   ✉ follow_accepted → ${n.to_email}`)
      } else if (n.type === 'direct_message') {
        const meta = n.meta ? JSON.parse(n.meta) : {}
        await sendEmail(
          n.to_email,
          _s.dmSubject(n.from_email.split('@')[0]),
          directMessageHtml(n.from_email, meta.whisky_name || 'a whisky', meta.distillery || '', meta.message || ''),
          directMessageText(n.from_email, meta.whisky_name || 'a whisky', meta.distillery || '', meta.message || ''),
        )
        console.log(`   ✉ direct_message → ${n.to_email} (${meta.whisky_name})`)
      } else if (n.type === 'badge_earned') {
        const meta = n.meta ? JSON.parse(n.meta) : {}
        await sendEmail(
          n.to_email,
          _s.badgeSubject(meta.badge_icon || '🏆', meta.badge_name || 'Achievement'),
          badgeEarnedHtml(meta.badge_icon || '🏆', meta.badge_name || 'Achievement', meta.badge_desc || ''),
          badgeEarnedText(meta.badge_icon || '🏆', meta.badge_name || 'Achievement', meta.badge_desc || ''),
        )
        console.log(`   ✉ badge_earned → ${n.to_email} (${meta.badge_name})`)
      } else if (n.type.startsWith('feature_request_')) {
        const status = n.type.replace('feature_request_', '')
        const meta   = n.meta ? JSON.parse(n.meta) : {}
        await sendEmail(
          n.to_email,
          _s.frSubject(_s.statusLabels[status] || status),
          featureRequestHtml(status, meta.feature_title || 'Your request', meta.admin_note || ''),
          featureRequestText(status, meta.feature_title || 'Your request', meta.admin_note || ''),
        )
        console.log(`   ✉ ${n.type} → ${n.to_email} (${meta.feature_title})`)
      } else {
        console.warn(`   ⚠ Unknown notification type: ${n.type} — skipping`)
      }

      processed.push(n.id)
    } catch (err) {
      console.error(`   ✗ Failed for ${n.to_email}: ${err.message}`)
      failed.push(n.id)
    }
  }

  // Delete successfully sent notifications
  if (processed.length) {
    const { error: deleteError } = await sb
      .from('pending_notifications')
      .delete()
      .in('id', processed)

    if (deleteError) {
      console.error(`   ⚠ Failed to delete processed rows: ${deleteError.message}`)
    } else {
      console.log(`   🗑 Cleared ${processed.length} processed notification(s)`)
    }
  }

  // ── Pass 2: feature request emails from direct_messages ─────────────────────
  // (inserted client-side by admin; pending_notifications RLS blocks that path)

  const { data: frMessages, error: frError } = await sb
    .from('direct_messages')
    .select('*')
    .filter('whisky_payload->>msg_type', 'eq', 'feature_request')
    .filter('whisky_payload->>email_sent', 'is', null)
    .order('created_at', { ascending: true })

  if (frError) {
    console.error(`   ⚠ Failed to fetch feature request messages: ${frError.message}`)
  } else if (frMessages?.length) {
    console.log(`   Found ${frMessages.length} feature request notification(s)`)

    for (const msg of frMessages) {
      _s = STRINGS[localeByEmail[msg.recipient_email] || 'en'] ?? STRINGS.en
      const p = msg.whisky_payload
      try {
        await sendEmail(
          msg.recipient_email,
          _s.frSubject(_s.statusLabels[p.status] || p.status),
          featureRequestHtml(p.status, p.feature_title || 'Your request', p.admin_note || ''),
          featureRequestText(p.status, p.feature_title || 'Your request', p.admin_note || ''),
        )
        // Mark as sent by patching email_sent into the payload
        await sb
          .from('direct_messages')
          .update({ whisky_payload: { ...p, email_sent: true } })
          .eq('id', msg.id)
        console.log(`   ✉ feature_request_${p.status} → ${msg.recipient_email} (${p.feature_title})`)
        processed.push(`fr-${msg.id}`)
      } catch (err) {
        console.error(`   ✗ Failed for ${msg.recipient_email}: ${err.message}`)
        failed.push(`fr-${msg.id}`)
      }
    }
  } else {
    console.log('   No feature request notifications pending.')
  }

  console.log(`\n✓ Done — ${processed.length} sent, ${failed.length} failed`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
