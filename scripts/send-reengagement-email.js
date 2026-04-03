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

// ── Strings (i18n) ────────────────────────────────────────────────────────────

const STRINGS = {
  en: {
    footerManage: 'Manage notification preferences in your journal settings',
    // Streak warning
    streakTag:        '✦ Streak at risk',
    streakUrgency0:   'Tonight is the last chance to keep it going.',
    streakUrgency1:   'You have 1 day left — log one dram tomorrow.',
    streakUrgencyN:   (n) => `You have ${n} days left to keep it alive.`,
    streakHeadline:   (streak, label) => `Your ${streak}-week streak ends ${label}`,
    streakDayTonight: 'tonight',
    streakDayTomorrow:'tomorrow',
    streakDayIn:      (n) => `in ${n} days`,
    streakBody:       "You haven't logged a dram this week.",
    streakCount:      (n) => `${n} week${n !== 1 ? 's' : ''} and counting`,
    streakAlsoClose:  '✦ Also close',
    streakAlsoBody:   (rem, plural) => `You're <strong>${rem} dram${plural}</strong> away from`,
    streakAlsoBodyTxt:(rem, plural, name) => `you're ${rem} dram${plural} away from the ${name} badge`,
    streakCta:        'Log a dram now →',
    // Badge proximity
    badgeTag:    '✦ Almost there',
    badgeBody:   (rem, plural) => `You need <strong style="color:${CREAM};">${rem} more dram${plural}</strong> to unlock this badge.`,
    badgeBodyTxt:(rem, plural) => `You're ${rem} dram${plural} away from unlocking this badge.`,
    badgeProgress:'Progress',
    badgeCta:    'Continue your journey →',
    // Lapsed
    lapsedTag:         '✦ While you were away',
    lapsedHeadline:    (daysText) => `It's been ${daysText} since your last dram`,
    lapsedDaysCouple:  'a couple of weeks',
    lapsedBody:        "Here's where your journal stands — and what your friends have been tasting.",
    lapsedWhiskyLabel: (total) => `whisky${total !== 1 ? 'ies' : 'y'} tasted`,
    lapsedCountryLabel:(n) => `countr${n !== 1 ? 'ies' : 'y'} explored`,
    lapsedFriendsTag:  '✦ Friends this week',
    lapsedNoFriends:   'No recent activity from your friends this week.',
    lapsedCta:         'Open Your Journal →',
    lapsedFriendsHdr:  'FRIENDS THIS WEEK',
    lapsedNoFriendsTxt:'No recent activity from your friends.',
    lapsedYourJournal: 'YOUR JOURNAL',
    // Final nudge
    finalTag:     '✦ Come back when you\'re ready',
    finalHeadline:'Your Dram Journal is waiting for you',
    finalBody:    "No pressure — your journal will be here whenever you're ready. Here's a reminder of what you've built so far.",
    finalCta:     'Return to Your Journal →',
    finalTxtHdr:  'Your journal is still here',
    finalTxtBody: "No pressure — your Dram Journal will be here whenever you're ready.",
    // Onboarding
    onboardingTag:      '✦ Start your journey',
    onboardingHeadline: 'Log your first dram',
    onboardingBody:     'Your journal is ready — just add your first whisky to get started. No tasting notes required; a name and a rating is all it takes.',
    onboardingBadgeTag: '✦ First badge waiting',
    onboardingBadgeBody:'Log one whisky to earn',
    onboardingBadgeName:'First Dram',
    onboardingCta:      'Log My First Dram →',
    onboardingTxtHdr:   'Log your first dram',
    onboardingTxtBody:  "Your journal is ready — just add the first whisky you've been drinking. No tasting notes required; a name and a rating is all it takes.",
    onboardingTxtBadge: 'Log one whisky to earn the First Dram badge',
    // Subjects
    subjectStreak:    (streak, label) => `Your ${streak}-week streak ends ${label} — The Dram Journal`,
    subjectBadge:     (icon, rem, plural, name) => `${icon} You're ${rem} dram${plural} from ${name} — The Dram Journal`,
    subjectLapsed:    'While you were away — The Dram Journal',
    subjectFinal:     'Your journal is still here — The Dram Journal',
    subjectOnboarding:'Log your first dram — The Dram Journal',
    // Plain-text header prefix
    txtBrand: 'THE DRAM JOURNAL',
    txtSignoff: 'Sláinte',
    txtOpenJournal: 'Open your journal',
    txtLogJournal: 'Log a dram',
  },
  es: {
    footerManage: 'Gestiona tus preferencias de notificación en la configuración',
    // Streak warning
    streakTag:        '✦ Racha en riesgo',
    streakUrgency0:   'Esta noche es tu última oportunidad.',
    streakUrgency1:   'Te queda 1 día — registra un dram mañana.',
    streakUrgencyN:   (n) => `Te quedan ${n} días para mantenerla viva.`,
    streakHeadline:   (streak, label) => `Tu racha de ${streak} semanas termina ${label}`,
    streakDayTonight: 'esta noche',
    streakDayTomorrow:'mañana',
    streakDayIn:      (n) => `en ${n} días`,
    streakBody:       'No has registrado un dram esta semana.',
    streakCount:      (n) => `${n} semana${n !== 1 ? 's' : ''} y contando`,
    streakAlsoClose:  '✦ También cerca',
    streakAlsoBody:   (rem, plural) => `Te faltan <strong>${rem} dram${plural}</strong> para`,
    streakAlsoBodyTxt:(rem, plural, name) => `te faltan ${rem} dram${plural} para la insignia ${name}`,
    streakCta:        'Registra un dram ahora →',
    // Badge proximity
    badgeTag:    '✦ Casi lo tienes',
    badgeBody:   (rem, plural) => `Necesitas <strong style="color:${CREAM};">${rem} dram${plural} más</strong> para desbloquear esta insignia.`,
    badgeBodyTxt:(rem, plural) => `Te faltan ${rem} dram${plural} para desbloquear esta insignia.`,
    badgeProgress:'Progreso',
    badgeCta:    'Continúa tu camino →',
    // Lapsed
    lapsedTag:         '✦ Mientras estabas fuera',
    lapsedHeadline:    (daysText) => `Han pasado ${daysText} desde tu último dram`,
    lapsedDaysCouple:  'un par de semanas',
    lapsedBody:        'Aquí está el estado de tu diario — y lo que tus amigos han estado probando.',
    lapsedWhiskyLabel: (total) => `whisky${total !== 1 ? 's' : ''} probado${total !== 1 ? 's' : ''}`,
    lapsedCountryLabel:(n) => `país${n !== 1 ? 'es' : ''} explorado${n !== 1 ? 's' : ''}`,
    lapsedFriendsTag:  '✦ Amigos esta semana',
    lapsedNoFriends:   'Sin actividad reciente de tus amigos esta semana.',
    lapsedCta:         'Abrir Mi Diario →',
    lapsedFriendsHdr:  'AMIGOS ESTA SEMANA',
    lapsedNoFriendsTxt:'Sin actividad reciente de tus amigos.',
    lapsedYourJournal: 'TU DIARIO',
    // Final nudge
    finalTag:     '✦ Vuelve cuando estés listo',
    finalHeadline:'Tu Dram Journal te espera',
    finalBody:    'Sin prisas — tu diario estará aquí cuando estés listo. Un recordatorio de lo que has construido.',
    finalCta:     'Volver a Mi Diario →',
    finalTxtHdr:  'Tu diario te espera',
    finalTxtBody: 'Sin prisas — tu Dram Journal estará aquí cuando estés listo.',
    // Onboarding
    onboardingTag:      '✦ Comienza tu camino',
    onboardingHeadline: 'Registra tu primer dram',
    onboardingBody:     'Tu diario está listo — solo añade tu primer whisky para empezar. No hacen falta notas de cata; basta con el nombre y una valoración.',
    onboardingBadgeTag: '✦ Primera insignia esperando',
    onboardingBadgeBody:'Registra un whisky para ganar',
    onboardingBadgeName:'Primer Dram',
    onboardingCta:      'Registrar Mi Primer Dram →',
    onboardingTxtHdr:   'Registra tu primer dram',
    onboardingTxtBody:  'Tu diario está listo — añade el primer whisky que hayas probado. No hacen falta notas de cata; basta con el nombre y una valoración.',
    onboardingTxtBadge: 'Registra un whisky para ganar la insignia Primer Dram',
    // Subjects
    subjectStreak:    (streak, label) => `Tu racha de ${streak} semanas termina ${label} — The Dram Journal`,
    subjectBadge:     (icon, rem, plural, name) => `${icon} Te faltan ${rem} dram${plural} para ${name} — The Dram Journal`,
    subjectLapsed:    'Mientras estabas fuera — The Dram Journal',
    subjectFinal:     'Tu diario te espera — The Dram Journal',
    subjectOnboarding:'Registra tu primer dram — The Dram Journal',
    // Plain-text header prefix
    txtBrand: 'THE DRAM JOURNAL',
    txtSignoff: 'Sláinte',
    txtOpenJournal: 'Abrir tu diario',
    txtLogJournal: 'Registrar un dram',
  },
}

// Active strings — set at the start of sendReengagementEmail based on locale.
// Sequential sends (no parallelism) make this safe.
let _s = STRINGS.en

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
                <td align="right"><div class="email-brand-icon">◆</div></td>
              </tr></table>
            </td>
          </tr>
          ${body}
          <tr>
            <td style="padding:16px 32px;border-top:1px solid rgba(200,130,42,0.15);background:#FAFAFA;">
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

// ── Email 1: Streak Warning ───────────────────────────────────────────────────
// Loss-aversion framing: "you're about to LOSE your streak"

function streakWarningHtml({ streak, daysLeft, badge }) {
  const urgencyLine = daysLeft === 0
    ? _s.streakUrgency0
    : daysLeft === 1
    ? _s.streakUrgency1
    : _s.streakUrgencyN(daysLeft)

  const dayLabel = daysLeft === 0
    ? _s.streakDayTonight
    : daysLeft === 1
    ? _s.streakDayTomorrow
    : _s.streakDayIn(daysLeft)

  const badgeHint = badge ? `
    <tr>
      <td style="padding:0 32px 20px;">
        <div style="padding:12px 16px;background:rgba(200,130,42,0.06);border-radius:8px;
                    border:1px solid rgba(200,130,42,0.15);">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.12em;
                      text-transform:uppercase;color:${AMBER};margin-bottom:4px;">${_s.streakAlsoClose}</div>
          <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${CREAM};line-height:1.5;">
            ${badge.icon} ${_s.streakAlsoBody(badge.rem, badge.rem > 1 ? 's' : '')}
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
          ${_s.streakTag}
        </div>
        <div style="font-size:20px;line-height:1;margin-bottom:12px;color:#E8A84C;">▲▲▲</div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:22px;
                    font-weight:600;color:${CREAM};line-height:1.2;margin-bottom:10px;">
          ${_s.streakHeadline(streak, dayLabel)}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;">
          ${_s.streakBody} ${urgencyLine}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;
                    color:${AMBER_LIGHT};margin-top:10px;letter-spacing:0.06em;">
          ${_s.streakCount(streak)}
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
          ${_s.streakCta}
        </a>
      </td>
    </tr>
    ${badgeHint}`)
}

function streakWarningText({ streak, daysLeft, badge }) {
  const dayLabel = daysLeft === 0
    ? _s.streakDayTonight
    : daysLeft === 1
    ? _s.streakDayTomorrow
    : _s.streakDayIn(daysLeft)
  const urgency = daysLeft === 0
    ? _s.streakUrgency0
    : daysLeft === 1
    ? _s.streakUrgency1
    : _s.streakUrgencyN(daysLeft)
  const badgeLine = badge
    ? `\n\n${_s.streakAlsoBodyTxt(badge.rem, badge.rem !== 1 ? 's' : '', badge.name)}`
    : ''
  return `${_s.txtBrand} — ${_s.streakTag}

${_s.streakHeadline(streak, dayLabel)}. ${_s.streakBody}
${urgency}${badgeLine}

${_s.txtLogJournal}: ${APP_URL}

${_s.txtSignoff}`
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
          ${_s.badgeTag}
        </div>
        <div style="font-size:40px;line-height:1;margin-bottom:14px;">${badge.icon}</div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:22px;
                    font-weight:600;color:${CREAM};line-height:1.2;margin-bottom:8px;">
          ${badge.name}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};
                    line-height:1.6;margin-bottom:16px;">
          ${_s.badgeBody(badge.rem, plural)}
        </div>
        <div style="background:#F3F3F3;border-radius:8px;padding:12px 16px;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.12em;
                      text-transform:uppercase;color:${PEAT_LIGHT};margin-bottom:8px;">
            ${_s.badgeProgress}
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
          ${_s.badgeCta}
        </a>
      </td>
    </tr>`)
}

function badgeProximityText({ badge }) {
  const plural = badge.rem !== 1 ? 's' : ''
  return `${_s.txtBrand} — ${_s.badgeTag}

${badge.icon} ${badge.name}

${_s.badgeBodyTxt(badge.rem, plural)}
${_s.badgeProgress}: ${badge.target - badge.rem} / ${badge.target}

${_s.txtOpenJournal}: ${APP_URL}

${_s.txtSignoff}`
}

// ── Email 3: Lapsed digest ────────────────────────────────────────────────────
// Social proof + stats recap for users gone 15–30 days

function lapsedHtml({ friendActivity, stats, daysSince }) {
  const daysText = daysSince >= 20
    ? `${Math.round(daysSince)} days`
    : _s.lapsedDaysCouple

  const statCells = [
    { icon: 'glass-water', value: stats.total,     label: _s.lapsedWhiskyLabel(stats.total) },
    { icon: 'globe', value: stats.countries, label: _s.lapsedCountryLabel(stats.countries) },
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
           ${_s.lapsedNoFriends}
         </div>
       </td></tr>`

  return shell(`
    <tr>
      <td style="padding:28px 32px 12px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ${_s.lapsedTag}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:19px;
                    font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:8px;">
          ${_s.lapsedHeadline(daysText)}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;">
          ${_s.lapsedBody}
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
          ${_s.lapsedFriendsTag}
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
          ${_s.lapsedCta}
        </a>
      </td>
    </tr>`)
}

function lapsedText({ friendActivity, stats, daysSince }) {
  const daysText = daysSince >= 20 ? `${Math.round(daysSince)} days` : _s.lapsedDaysCouple
  const friendLines = friendActivity && friendActivity.length > 0
    ? '\n\n' + _s.lapsedFriendsHdr + '\n' + friendActivity.slice(0, 6).map(a =>
        `  • ${a.whisky_name}${a.whisky_distillery ? ' (' + a.whisky_distillery + ')' : ''}${a.type === 'rating' ? ' — ' + a.rating + '/5' : ''}`
      ).join('\n')
    : '\n\n' + _s.lapsedNoFriendsTxt
  return `${_s.txtBrand} — ${_s.lapsedTag}

${_s.lapsedHeadline(daysText)}.

${_s.lapsedYourJournal}
  ${stats.total} ${_s.lapsedWhiskyLabel(stats.total)}
  ${stats.countries} ${_s.lapsedCountryLabel(stats.countries)}
${friendLines}

${_s.txtOpenJournal}: ${APP_URL}

${_s.txtSignoff}`
}

// ── Email 4: Final nudge ──────────────────────────────────────────────────────
// Soft, no-pressure re-engagement for users gone 30+ days

function finalNudgeHtml({ stats }) {
  const statCells = [
    { icon: 'glass-water', value: stats.total,     label: _s.lapsedWhiskyLabel(stats.total) },
    { icon: 'globe', value: stats.countries, label: _s.lapsedCountryLabel(stats.countries) },
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
          ${_s.finalTag}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:19px;
                    font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:12px;">
          ${_s.finalHeadline}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};
                    line-height:1.6;margin-bottom:18px;">
          ${_s.finalBody}
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
          ${_s.finalCta}
        </a>
      </td>
    </tr>`)
}

function finalNudgeText({ stats }) {
  return `${_s.txtBrand} — ${_s.finalTxtHdr}

${_s.finalTxtBody}

  ${stats.total} ${_s.lapsedWhiskyLabel(stats.total)}
  ${stats.countries} ${_s.lapsedCountryLabel(stats.countries)}

${_s.txtOpenJournal}: ${APP_URL}

${_s.txtSignoff}`
}

// ── Email 5: Onboarding nudge ─────────────────────────────────────────────────
// For users who signed up but never logged a single whisky

function onboardingHtml() {
  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ${_s.onboardingTag}
        </div>
        <div class="email-brand-icon" style="font-size:20px;margin-bottom:12px;color:#C8822A;">◆</div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:22px;
                    font-weight:600;color:${CREAM};line-height:1.2;margin-bottom:10px;">
          ${_s.onboardingHeadline}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${PEAT_LIGHT};
                    line-height:1.6;margin-bottom:16px;">
          ${_s.onboardingBody}
        </div>
        <div style="padding:12px 16px;background:rgba(200,130,42,0.06);border-radius:8px;
                    border:1px solid rgba(200,130,42,0.15);">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.12em;
                      text-transform:uppercase;color:${AMBER};margin-bottom:4px;">${_s.onboardingBadgeTag}</div>
          <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${CREAM};line-height:1.5;">
            ${_s.onboardingBadgeBody} <span style="color:${AMBER_LIGHT};">${_s.onboardingBadgeName}</span>
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
          ${_s.onboardingCta}
        </a>
      </td>
    </tr>`)
}

function onboardingText() {
  return `${_s.txtBrand} — ${_s.onboardingTxtHdr}

${_s.onboardingTxtBody}

${_s.onboardingTxtBadge}

${_s.txtOpenJournal}: ${APP_URL}

${_s.txtSignoff}`
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
 * @param {string} [locale='en']  — 'en' or 'es'
 */
export async function sendReengagementEmail(toEmail, type, payload, locale = 'en') {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY env var is not set')

  _s = STRINGS[locale] ?? STRINGS.en

  const { streak = 0, daysLeft = 3, badge = null,
          friendActivity = [], stats = {}, daysSince = 0 } = payload

  let subject, html, text

  if (type === 'streak_warning') {
    const dayLabel = daysLeft === 0
      ? _s.streakDayTonight
      : daysLeft === 1
      ? _s.streakDayTomorrow
      : _s.streakDayIn(daysLeft)
    subject = _s.subjectStreak(streak, dayLabel)
    html    = streakWarningHtml({ streak, daysLeft, badge })
    text    = streakWarningText({ streak, daysLeft, badge })

  } else if (type === 'badge_proximity') {
    const plural = badge.rem !== 1 ? 's' : ''
    subject = _s.subjectBadge(badge.icon, badge.rem, plural, badge.name)
    html    = badgeProximityHtml({ badge })
    text    = badgeProximityText({ badge })

  } else if (type === 'lapsed') {
    subject = _s.subjectLapsed
    html    = lapsedHtml({ friendActivity, stats, daysSince })
    text    = lapsedText({ friendActivity, stats, daysSince })

  } else if (type === 'final') {
    subject = _s.subjectFinal
    html    = finalNudgeHtml({ stats })
    text    = finalNudgeText({ stats })

  } else if (type === 'onboarding') {
    subject = _s.subjectOnboarding
    html    = onboardingHtml()
    text    = onboardingText()

  } else {
    throw new Error(`Unknown re-engagement email type: ${type}`)
  }

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
