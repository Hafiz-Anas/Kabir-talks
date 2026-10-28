import "../src/db/load-env";

/**
 * Newsletter queue from the command line (or a cron job on the server):
 *
 *   npm run newsletter:process   send the next batch of queued emails (repeat until nothing is waiting)
 *   npm run newsletter:digest    queue this week's digest (once per ISO week; a second run does nothing)
 *
 * Runs with the react-server condition so the app's server-only modules load outside Next.js.
 */

const task = process.argv[2];

async function main() {
  const { pgClient } = await import("../src/db");
  try {
    if (task === "process") {
      const { processNewsletterQueue } = await import("../src/server/newsletter/process");
      let total = { sent: 0, failed: 0, skipped: 0 };
      // Keep going while there is work, up to ~5 minutes per run.
      const until = Date.now() + 5 * 60_000;
      for (;;) {
        const summary = await processNewsletterQueue({ maxEmails: 200, timeBudgetMs: 50_000 });
        total = { sent: total.sent + summary.sent, failed: total.failed + summary.failed, skipped: total.skipped + summary.skipped };
        const progressed = summary.sent + summary.failed + summary.skipped + summary.retrying > 0;
        if (summary.remaining === 0 || !progressed || Date.now() > until) {
          console.log(`newsletter: sent ${total.sent}, failed ${total.failed}, skipped ${total.skipped}, waiting ${summary.remaining}`);
          break;
        }
      }
    } else if (task === "digest") {
      const { features } = await import("../src/lib/features");
      if (!features.newsletterEnabled) {
        console.error("newsletter: email sending is not configured (RESEND_API_KEY and EMAIL_FROM); nothing queued.");
        process.exitCode = 1;
        return;
      }
      const { queueDigest } = await import("../src/server/newsletter/sends");
      const result = await queueDigest(null);
      console.log(
        result.ok
          ? `newsletter: digest ${result.week} queued for ${result.recipients} subscribers. Run newsletter:process to send it.`
          : `newsletter: digest ${result.week} not queued (${result.error}).`,
      );
    } else {
      console.error("Usage: tsx --conditions=react-server scripts/newsletter.ts process|digest");
      process.exitCode = 2;
    }
  } finally {
    await pgClient.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
