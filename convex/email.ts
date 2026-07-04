import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { absoluteUrl } from "../src/lib/seo";

const FROM = "Atlas <notifications@geoatlas.xyz>";

/** Minimal, inline-styled email shell — matches Atlas's monochrome UI. */
function layout(bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<tr><td style="padding:8px 32px 32px 32px;">
        <a href="${cta.url}" style="display:inline-block;background:#18181b;color:#ffffff;
          text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px;">
          ${cta.label}
        </a>
      </td></tr>`
    : "";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;">
          <tr><td style="padding:28px 32px 0 32px;">
            <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#18181b;">Atlas</div>
          </td></tr>
          <tr><td style="padding:20px 32px 4px 32px;color:#18181b;font-size:15px;line-height:1.6;">
            ${bodyHtml}
          </td></tr>
          ${button}
          <tr><td style="padding:16px 32px 28px 32px;border-top:1px solid #f0f0f0;color:#a1a1aa;font-size:12px;">
            You're getting this because you have an Atlas account.
            <a href="${absoluteUrl("/")}" style="color:#a1a1aa;">geoatlas.xyz</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

const TEMPLATES = {
  friendRequest: (toUsername: string, fromUsername: string) => ({
    subject: `${fromUsername} sent you a friend request on Atlas`,
    html: layout(
      `<p><strong>${fromUsername}</strong> wants to add you as a friend on Atlas, ${toUsername}.</p>`,
      { label: "View request", url: absoluteUrl("/friends") },
    ),
  }),
  friendAccepted: (toUsername: string, fromUsername: string) => ({
    subject: `${fromUsername} accepted your friend request`,
    html: layout(
      `<p><strong>${fromUsername}</strong> accepted your friend request, ${toUsername}. You can now invite each other to rooms and parties.</p>`,
      { label: "See friends", url: absoluteUrl("/friends") },
    ),
  }),
  roomInvite: (toUsername: string, fromUsername: string, roomCode: string) => ({
    subject: `${fromUsername} invited you to a match on Atlas`,
    html: layout(
      `<p><strong>${fromUsername}</strong> invited you to join their match, ${toUsername}. The lobby is still open.</p>`,
      { label: "Join match", url: absoluteUrl(`/room/${roomCode}`) },
    ),
  }),
  partyInvite: (toUsername: string, fromUsername: string) => ({
    subject: `${fromUsername} invited you to their party on Atlas`,
    html: layout(
      `<p><strong>${fromUsername}</strong> invited you to their party, ${toUsername}.</p>`,
      { label: "View invite", url: absoluteUrl("/party") },
    ),
  }),
} as const;

/**
 * Fire-and-forget transactional email, scheduled from mutations via
 * ctx.scheduler.runAfter(0, internal.email.send, {...}) so a slow/failed
 * Resend call never blocks or fails the user-facing action. No-ops (with a
 * console warning) when RESEND_API_KEY isn't configured, so email is purely
 * additive in dev/preview environments — mirrors the other optional
 * integrations documented in .env.example.
 */
export const send = internalAction({
  args: {
    kind: v.union(
      v.literal("friendRequest"),
      v.literal("friendAccepted"),
      v.literal("roomInvite"),
      v.literal("partyInvite"),
    ),
    to: v.string(),
    toUsername: v.string(),
    fromUsername: v.string(),
    roomCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(`[email] RESEND_API_KEY not set — skipped "${args.kind}" email to ${args.to}`);
      return;
    }

    const { subject, html } =
      args.kind === "roomInvite"
        ? TEMPLATES.roomInvite(args.toUsername, args.fromUsername, args.roomCode ?? "")
        : TEMPLATES[args.kind](args.toUsername, args.fromUsername);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: args.to, subject, html }),
    });

    if (!res.ok) {
      console.error(`[email] Resend send failed (${res.status}) for "${args.kind}":`, await res.text());
    }
  },
});
