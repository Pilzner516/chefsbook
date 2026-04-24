import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface WelcomeEmailProps {
  email: string;
  name: string;
  username: string;
}

/**
 * Send a welcome email to a newly created user.
 * Requires RESEND_API_KEY environment variable.
 */
export async function sendWelcomeEmail({ email, name, username }: WelcomeEmailProps): Promise<boolean> {
  // Skip if API key not configured
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not configured, skipping welcome email');
    return false;
  }

  try {
    const html = generateWelcomeEmailHTML(name, username);

    await resend.emails.send({
      from: 'ChefsBook <noreply@chefsbk.app>',
      to: email,
      subject: `Welcome to ChefsBook, ${name}!`,
      html,
    });

    console.log(`[email] Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[email] Failed to send welcome email:', error);
    return false;
  }
}

/**
 * Generate welcome email HTML with Trattoria branding.
 */
function generateWelcomeEmailHTML(name: string, username: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ChefsBook</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif; background-color: #faf7f0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #faf7f0; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #ce2b37; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">
                ChefsBook
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                Welcome to ChefsBook, ${name}!
              </h2>

              <p style="margin: 0 0 16px 0; color: #7a6a5a; font-size: 16px; line-height: 1.6;">
                Your account <strong style="color: #ce2b37;">@${username}</strong> is now active. We're excited to have you join our community of home cooks and recipe enthusiasts!
              </p>

              <p style="margin: 0 0 16px 0; color: #7a6a5a; font-size: 16px; line-height: 1.6;">
                ChefsBook helps you organize your recipes, plan meals, and discover new dishes. Get started by importing your first recipe from any website, or create one from scratch.
              </p>

              <p style="margin: 0 0 28px 0; color: #7a6a5a; font-size: 16px; line-height: 1.6;">
                Ready to cook? Head to your dashboard and start building your collection.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td style="background-color: #ce2b37; border-radius: 8px;">
                    <a href="https://chefsbk.app/dashboard" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #9a8a7a; font-size: 14px; line-height: 1.5;">
                Need help getting started? Visit our <a href="https://chefsbk.app/dashboard/scan" style="color: #ce2b37; text-decoration: none;">import page</a> to add your first recipe.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f4f0e8; padding: 24px 40px; text-align: center; border-top: 1px solid #e8e0d0;">
              <p style="margin: 0; color: #9a8a7a; font-size: 13px; line-height: 1.5;">
                <strong style="color: #1a1a1a;">ChefsBook</strong> — Your recipes, beautifully organised
              </p>
              <p style="margin: 8px 0 0 0; color: #9a8a7a; font-size: 12px;">
                <a href="https://chefsbk.app" style="color: #ce2b37; text-decoration: none;">chefsbk.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
