/**
 * Email Queue Worker
 * 
 * This script processes email jobs from the queue one by one.
 * Run this via: npx tsx scripts/process-email-queue.ts
 * 
 * For production, set up a cron job to run this every minute:
 * * * * * * cd /path/to/operation-automation && npx tsx scripts/process-email-queue.ts
 */

const QUEUE_PROCESS_URL = process.env.QUEUE_PROCESS_URL || "http://localhost:3000/api/email-queue/process";

async function processQueue() {
  try {
    console.log("Checking email queue...");
    
    const response = await fetch(QUEUE_PROCESS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      if (data.success) {
        if (data.results) {
          console.log(`Processed email job:`, data.results);
        } else {
          console.log("No pending jobs in queue");
        }
      } else {
        console.error("Failed to process job:", data.error);
      }
    } else {
      console.error("API error:", response.status, data.error);
    }
  } catch (error) {
    console.error("Error processing queue:", error);
  }
}

// Process one job
processQueue().then(() => {
  console.log("Queue check complete");
  process.exit(0);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
