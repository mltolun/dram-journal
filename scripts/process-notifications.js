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

const AMBER       = '#A8620A'
const AMBER_LIGHT = '#C07820'
const PEAT        = '#F8F4EE'
const PEAT_LIGHT  = '#8A7060'
const CREAM       = '#2C1F10'

// ── Email builders ────────────────────────────────────────────────────────────

function shell(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital@0;1&family=DM+Sans:ital@0;1&family=Playfair+Display:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#1C1408;font-family:'DM Sans',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1C1408;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table cellpadding="0" cellspacing="0" border="0" width="520"
               style="max-width:520px;background:${PEAT};border-radius:16px;
                      overflow:hidden;border:1px solid rgba(200,130,42,0.2);">
          <tr>
            <td style="padding:24px 32px 20px;border-bottom:1px solid rgba(200,130,42,0.2);
                       background:linear-gradient(to bottom,rgba(200,130,42,0.06),transparent);">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td>
                  <div style="font-family:'Playfair Display',Georgia,serif;font-size:22px;
                              font-weight:400;color:${CREAM};letter-spacing:-0.02em;">
                    The <span style="color:${AMBER_LIGHT};font-style:italic;">Dram</span> Journal
                  </div>
                </td>
                <td align="right"><div style="font-size:24px;">🥃</div></td>
              </tr></table>
            </td>
          </tr>
          ${body}
          <tr>
            <td style="padding:16px 32px;border-top:1px solid rgba(200,130,42,0.15);
                       background:rgba(250,245,236,0.02);">
              <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.06em;
                          color:rgba(122,98,85,0.6);text-align:center;">
                Manage followers in your journal settings ·
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
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ✦ New follow request
        </div>
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:19px;
                    font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:12px;">
          Someone wants to follow your journal
        </div>
        <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;">
          <span style="font-family:'DM Mono',monospace;font-size:11px;color:${AMBER_LIGHT};">${name}</span>
          &nbsp;has sent you a follow request. If you accept, they'll receive
          a weekly digest of the whiskies you add and rate.
        </div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 28px;">
        <a href="${APP_URL}"
           style="display:inline-block;background:${AMBER};color:${PEAT};
                  font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.15em;
                  text-transform:uppercase;text-decoration:none;padding:11px 26px;
                  border-radius:7px;font-weight:500;">
          Review request →
        </a>
      </td>
    </tr>`)
}

function followRequestText(fromEmail) {
  const name = fromEmail.split('@')[0]
  return `THE DRAM JOURNAL — New follow request

${name} wants to follow your whisky journal.

If you accept, they'll receive a weekly digest of the whiskies you add and rate.

Open the app to accept or decline: ${APP_URL}

Sláinte 🥃`
}

function followAcceptedHtml(fromEmail) {
  const name = fromEmail.split('@')[0]
  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:#1D9E75;margin-bottom:10px;">
          ✦ Request accepted
        </div>
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:19px;
                    font-weight:400;color:${CREAM};line-height:1.3;margin-bottom:12px;">
          You're now following their journal
        </div>
        <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:${PEAT_LIGHT};line-height:1.6;">
          <span style="font-family:'DM Mono',monospace;font-size:11px;color:${AMBER_LIGHT};">${name}</span>
          &nbsp;accepted your follow request. You'll now receive their whisky
          additions and ratings in your weekly Monday update.
        </div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 28px;">
        <a href="${APP_URL}"
           style="display:inline-block;background:${AMBER};color:${PEAT};
                  font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.15em;
                  text-transform:uppercase;text-decoration:none;padding:11px 26px;
                  border-radius:7px;font-weight:500;">
          Open My Journal →
        </a>
      </td>
    </tr>`)
}

function followAcceptedText(fromEmail) {
  const name = fromEmail.split('@')[0]
  return `THE DRAM JOURNAL — Follow request accepted

${name} accepted your follow request.

You'll now receive their whisky additions and ratings in your weekly Monday update.

Open your journal: ${APP_URL}

Sláinte 🥃`
}

// ── Direct message ────────────────────────────────────────────────────────────

function directMessageHtml(fromEmail, whiskyName, distillery) {
  const name = fromEmail.split('@')[0]
  const sub  = distillery ? `<div style="font-family:'DM Mono',monospace;font-size:10px;color:${PEAT_LIGHT};margin-bottom:14px;">${distillery}</div>` : ''
  return shell(`
    <tr>
      <td style="padding:28px 32px 8px;">
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.2em;
                    text-transform:uppercase;color:${AMBER};margin-bottom:10px;">
          ✦ A friend shared a dram
        </div>
        <div style="font-family:'DM Sans',sans-serif;font-size:13px;color:${PEAT_LIGHT};
                    line-height:1.6;margin-bottom:16px;">
          <span style="font-family:'DM Mono',monospace;font-size:11px;color:${AMBER_LIGHT};">${name}</span>
          &nbsp;thinks you'd enjoy this:
        </div>
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:20px;
                    font-weight:400;color:${CREAM};line-height:1.2;margin-bottom:4px;">
          ${whiskyName}
        </div>
        ${sub}
        <div style="font-family:'DM Sans',sans-serif;font-size:12px;color:${PEAT_LIGHT};line-height:1.6;">
          Open the app to see the full tasting profile and add it to your wishlist.
        </div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 28px;">
        <a href="${APP_URL}"
           style="display:inline-block;background:${AMBER};color:${PEAT};
                  font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.15em;
                  text-transform:uppercase;text-decoration:none;padding:11px 26px;
                  border-radius:7px;font-weight:500;">
          Open My Inbox →
        </a>
      </td>
    </tr>`)
}

function directMessageText(fromEmail, whiskyName, distillery) {
  const name = fromEmail.split('@')[0]
  return `THE DRAM JOURNAL — A friend shared a dram

${name} thinks you'd enjoy: ${whiskyName}${distillery ? ' (' + distillery + ')' : ''}

Open the app to see the full tasting profile: ${APP_URL}

Sláinte 🥃`
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

  const { data: notifications, error } = await sb
    .from('pending_notifications')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch notifications: ${error.message}`)

  if (!notifications.length) {
    console.log('   No pending notifications.')
    return
  }

  console.log(`   Found ${notifications.length} pending notification(s)`)

  const processed = []
  const failed    = []

  for (const n of notifications) {
    try {
      if (n.type === 'follow_request') {
        await sendEmail(
          n.to_email,
          '🥃 Someone wants to follow your Dram Journal',
          followRequestHtml(n.from_email),
          followRequestText(n.from_email),
        )
        console.log(`   ✉ follow_request → ${n.to_email}`)
      } else if (n.type === 'follow_accepted') {
        await sendEmail(
          n.to_email,
          '🥃 Your follow request was accepted — The Dram Journal',
          followAcceptedHtml(n.from_email),
          followAcceptedText(n.from_email),
        )
        console.log(`   ✉ follow_accepted → ${n.to_email}`)
      } else if (n.type === 'direct_message') {
        const meta = n.meta ? JSON.parse(n.meta) : {}
        await sendEmail(
          n.to_email,
          `🥃 ${n.from_email.split('@')[0]} shared a whisky with you — The Dram Journal`,
          directMessageHtml(n.from_email, meta.whisky_name || 'a whisky', meta.distillery || ''),
          directMessageText(n.from_email, meta.whisky_name || 'a whisky', meta.distillery || ''),
        )
        console.log(`   ✉ direct_message → ${n.to_email} (${meta.whisky_name})`)
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

  console.log(`\n✓ Done — ${processed.length} sent, ${failed.length} failed`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
