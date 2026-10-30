import nodemailer from "nodemailer";

/* EMAIL TRANSPORT */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

/* ============================================================
 * OTP EMAIL HTML TEMPLATE
 * ============================================================
 */
export function generateOtpEmailTemplate({ otp, title = "Account Verification", message = "Your One-Time Password (OTP) code is:" }) {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
</head>
<body style="
  margin: 0;
  padding: 0;
  background-color: #0f172a;
  font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="
          background-color: #1e293b;
          border-radius: 12px;
          border: 1px solid #334155;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          overflow: hidden;
          color: #f8fafc;
        ">
          <!-- HEADER -->
          <tr>
            <td style="
              background: linear-gradient(135deg, #3b82f6, #1d4ed8);
              text-align: center;
              padding: 24px;
            ">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;">
                🚦 Live Traffic Management
              </h1>
              <p style="margin: 6px 0 0; font-size: 14px; color: #dbeafe;">
                ${title}
              </p>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="padding: 32px 28px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
              <p style="margin-top: 0; font-size: 15px; color: #f1f5f9;">Hello,</p>

              <p>${message}</p>

              <!-- OTP BOX -->
              <div style="
                background-color: #0f172a;
                border: 1px solid #3b82f6;
                border-radius: 8px;
                text-align: center;
                padding: 16px;
                margin: 24px 0;
              ">
                <span style="
                  font-size: 32px;
                  font-weight: 700;
                  color: #60a5fa;
                  letter-spacing: 8px;
                  font-family: 'Courier New', monospace;
                ">
                  ${otp}
                </span>
              </div>

              <p style="font-size: 13px; color: #94a3b8; margin-bottom: 8px;">
                ⏱ This OTP is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.
              </p>

              <p style="font-size: 13px; color: #94a3b8; margin-top: 0;">
                If you did not request this verification, please ignore this email or contact security.
              </p>

              <div style="border-top: 1px solid #334155; margin-top: 24px; padding-top: 16px;">
                <p style="font-size: 13px; color: #cbd5e1; margin: 0;">
                  Best regards,<br />
                  <strong style="color: #60a5fa;">Live Traffic Management Team</strong>
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="
              background-color: #0f172a;
              text-align: center;
              padding: 14px;
              font-size: 12px;
              color: #64748b;
              border-top: 1px solid #1e293b;
            ">
              © ${year} Live Traffic Management. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/* ============================================================
 * SEND EMAIL FUNCTION
 * ============================================================
 */
export async function sendEmail(to, subject, html, text) {
  try {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.warn("⚠️ MAIL_USER or MAIL_PASS not configured in .env. Email skipped.");
      return { success: false, message: "Email credentials not configured" };
    }

    const info = await transporter.sendMail({
      from: `"Live Traffic Management" <${process.env.MAIL_USER}>`,
      to,
      subject,
      text: text || "Live Traffic Management notification",
      html,
    });

    console.log("✅ EMAIL SENT:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ EMAIL ERROR:", error.message);
    return { success: false, error: error.message };
  }
}

