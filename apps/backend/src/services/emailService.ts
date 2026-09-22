import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

type MailInput = {
  to: string;
  subject: string;
  text: string;
};

function resendEndpoint() {
  return `${env.RESEND_BASE_URL.replace(/\/+$/, "")}/emails`;
}

async function deliverViaResend(input: MailInput) {
  const response = await fetch(resendEndpoint(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend delivery failed with status ${response.status}: ${detail.slice(0, 200)}`);
  }
}

export async function sendMail(app: FastifyInstance, input: MailInput) {
  // A configured real transport actually delivers the message.
  if (env.EMAIL_PROVIDER === "RESEND" && env.RESEND_API_KEY) {
    try {
      await deliverViaResend(input);
      // SECURITY: never log the body — it carries verification/reset tokens.
      app.log.info({ to: input.to, subject: input.subject }, "Email sent");
    } catch (error) {
      app.log.error({ to: input.to, subject: input.subject, error }, "Email delivery failed");
    }
    return;
  }

  // No real transport configured.
  if (env.NODE_ENV === "production") {
    // SECURITY: do not log the body in production. It contains single-use
    // verification/password-reset tokens and must never reach the logs.
    app.log.error(
      { to: input.to, subject: input.subject },
      "Email delivery is not configured (EMAIL_PROVIDER=LOG); message was not sent"
    );
    return;
  }

  // Development/test transport: tokens are also surfaced via the API in these
  // environments, so logging the body here is acceptable for local testing.
  app.log.info(
    {
      to: input.to,
      from: env.EMAIL_FROM,
      subject: input.subject,
      text: input.text
    },
    "Email queued via development transport"
  );
}

export function shouldExposeDevEmailToken() {
  return env.NODE_ENV !== "production";
}
