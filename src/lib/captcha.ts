// Cloudflare Turnstile verification utility

/** Check if CAPTCHA verification is enabled via environment variable */
export function isCaptchaEnabled(): boolean {
  const enabled = process.env.TURNSTILE_ENABLED;
  return enabled !== "0" && enabled !== "false" && enabled !== "FALSE";
}

export async function verifyTurnstile(token: string): Promise<boolean> {
  try {
    // Skip verification if CAPTCHA is disabled
    if (!isCaptchaEnabled()) {
      return true;
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      console.error("TURNSTILE_SECRET_KEY is not configured");
      return false;
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    });

    const result = await response.json();

    return result.success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}
