import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

//  Shared helpers

const YEAR = new Date().getFullYear();

const baseStyles = `
    body { margin:0; padding:0; background:#f0f2f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; }
    a    { color:inherit; }
`;

/** Wraps any inner <table> content in a full-page shell */
function wrapEmail(inner: string): string {
  return `<!DOCTYPE html>
          <html lang="th">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
            <style>${baseStyles}</style>
          </head>
          <body>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                  style="background:#f0f2f5; padding:48px 16px;">
              <tr>
                <td align="center">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                        style="width:100%; max-width:560px; background:#ffffff; border-radius:16px;
                                overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    ${inner}
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>`;
}

/** Standard header band */
function emailHeader(gradient: string, title: string): string {
  return `
  <tr>
    <td style="background:${gradient}; padding:32px 40px; text-align:center;">
      <p style="margin:0 0 4px 0; color:rgba(255,255,255,0.75); font-size:11px;
                letter-spacing:2px; text-transform:uppercase; font-weight:600;">
        SKLLR ACADEMY
      </p>
      <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.3px;">
        ${title}
      </h1>
    </td>
  </tr>`;
}

/** Standard footer */
function emailFooter(): string {
  return `
  <tr>
    <td style="background:#f8f9fa; padding:20px 40px; text-align:center;
               border-top:1px solid #e9ecef;">
      <p style="margin:0; color:#adb5bd; font-size:12px; line-height:1.5;">
        &copy; ${YEAR} Skllr Academy &nbsp;·&nbsp; All rights reserved
      </p>
    </td>
  </tr>`;
}

//  Service

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly isResendConfigured: boolean;

  private readonly transporter: nodemailer.Transporter | null;
  private readonly smtpConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    // ── Resend ──────────────────────────────
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    this.isResendConfigured = !!resendKey;
    this.resend = this.isResendConfigured ? new Resend(resendKey as string) : null;

    // ── From address ────────────────────────
    this.fromEmail =
      this.configService.get<string>('MAIL_FROM') ?? 'no-reply@skllracademy.com';

    // ── SMTP (primary transport) ─────────────
    const smtpHost =
      this.configService.get<string>('EMAIL_HOST') ??
      this.configService.get<string>('SMTP_HOST');
    const smtpPort = Number(
      this.configService.get<number>('EMAIL_PORT') ??
      this.configService.get<number>('SMTP_PORT') ??
      587,
    );
    const smtpUser =
      this.configService.get<string>('EMAIL_USER') ??
      this.configService.get<string>('SMTP_USER');
    const smtpPass =
      this.configService.get<string>('EMAIL_PASS') ??
      this.configService.get<string>('SMTP_PASS');

    this.smtpConfigured = !!(smtpHost && smtpUser && smtpPass);
    this.transporter = this.smtpConfigured
      ? nodemailer.createTransport({
        host: smtpHost as string,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser as string, pass: smtpPass as string },
      })
      : null;
  }

  // ─── Public send methods ──────────────────────────────────────────────────

  async sendOtpEmail(to: string, otp: string): Promise<boolean> {
    const subject = 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน';
    const html = wrapEmail(`
      ${emailHeader('linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'รีเซ็ตรหัสผ่าน')}
      <tr>
        <td style="padding:40px 40px 32px;">

          <p style="margin:0 0 28px 0; color:#495057; font-size:15px; line-height:1.6;">
            เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ
            ใช้รหัส OTP ด้านล่างเพื่อดำเนินการต่อ
          </p>

          <!-- OTP Box -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center" style="padding:0 0 28px 0;">
                <div style="background:#f3f0ff; border:2px dashed #7c5cfc;
                            border-radius:12px; padding:28px 40px; display:inline-block;">
                  <p style="margin:0 0 4px 0; color:#7c5cfc; font-size:11px;
                             letter-spacing:2px; text-transform:uppercase; font-weight:600;">
                    รหัสยืนยัน
                  </p>
                  <p style="margin:0; font-size:40px; font-weight:800; color:#4c1d95;
                             letter-spacing:12px; font-family:'Courier New',monospace;">
                    ${otp}
                  </p>
                </div>
              </td>
            </tr>
          </table>

          <!-- Warning -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="background:#fffbeb; border-left:4px solid #f59e0b;
                         border-radius:0 8px 8px 0; padding:14px 16px; margin-bottom:24px;">
                <p style="margin:0; color:#92400e; font-size:13px; line-height:1.5;">
                  ⏱ รหัสนี้จะหมดอายุใน <strong>10 นาที</strong>
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 0 0; color:#adb5bd; font-size:12px; line-height:1.6;">
            หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้
            บัญชีของคุณยังคงปลอดภัย
          </p>
        </td>
      </tr>
      ${emailFooter()}
    `);

    const text = `รหัส OTP: ${otp} (หมดอายุใน 10 นาที)`;
    return this.sendEmail(to, subject, html, text);
  }

  async sendPasswordChangedEmail(to: string): Promise<boolean> {
    const subject = 'รหัสผ่านถูกเปลี่ยนเรียบร้อย';
    const html = wrapEmail(`
      ${emailHeader('linear-gradient(135deg, #10b981 0%, #059669 100%)', 'เปลี่ยนรหัสผ่านสำเร็จ')}
      <tr>
        <td style="padding:48px 40px; text-align:center;">

          <!-- Success Icon -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                 align="center" style="margin:0 auto 28px auto;">
            <tr>
              <td style="width:72px; height:72px; background:linear-gradient(135deg,#10b981,#059669);
                         border-radius:50%; text-align:center; vertical-align:middle;
                         font-size:34px; color:#ffffff; line-height:72px;">
                ✓
              </td>
            </tr>
          </table>

          <h2 style="margin:0 0 12px 0; color:#111827; font-size:21px; font-weight:700;">
            รหัสผ่านใหม่พร้อมใช้งานแล้ว
          </h2>
          <p style="margin:0 0 32px 0; color:#6b7280; font-size:15px; line-height:1.6;
                     max-width:360px; margin-left:auto; margin-right:auto;">
            บัญชีของคุณได้รับการอัปเดตเรียบร้อย
            คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
          </p>

          <!-- Divider -->
          <hr style="border:none; border-top:1px solid #e5e7eb; margin:0 0 24px 0;">

          <p style="margin:0; color:#9ca3af; font-size:13px; line-height:1.6;">
            หากคุณไม่ได้ทำการเปลี่ยนแปลงนี้ กรุณาติดต่อทีมสนับสนุนทันที
          </p>
        </td>
      </tr>
      ${emailFooter()}
    `);

    const text = 'รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที';
    return this.sendEmail(to, subject, html, text);
  }

  async sendInvitationCanceledEmail(input: {
    to: string;
    firstName: string;
    lastName: string;
  }): Promise<boolean> {
    const subject = 'คำเชิญให้เป็นผู้ดูแลระบบถูกยกเลิก';
    const fullName = `${input.firstName} ${input.lastName}`.trim();

    const html = wrapEmail(`
      ${emailHeader('linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 'คำเชิญถูกยกเลิก')}
      <tr>
        <td style="padding:40px 40px 32px;">

          <p style="margin:0 0 20px 0; color:#111827; font-size:15px; line-height:1.6;">
            เรียน <strong>${fullName}</strong>
          </p>

          <p style="margin:0 0 24px 0; color:#374151; font-size:15px; line-height:1.6;">
            คำเชิญให้คุณเป็น <strong>ผู้ดูแลระบบ</strong> ของ Skllr Academy
            ได้ถูกยกเลิกโดยผู้ดูแลระบบแล้ว
          </p>

          <!-- Note Box -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="background:#fef9c3; border-left:4px solid #eab308;
                         border-radius:0 8px 8px 0; padding:14px 16px; margin-bottom:28px;">
                <p style="margin:0; color:#713f12; font-size:13px; line-height:1.5;">
                  <strong>หมายเหตุ:</strong>&nbsp;
                  หากคุณคิดว่านี่เป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 4px 0; color:#6b7280; font-size:14px; line-height:1.6;">
            ขอบคุณที่สนใจร่วมงานกับเรา
          </p>
          <p style="margin:0; color:#6b7280; font-size:14px; line-height:1.6;">
            ด้วยความเคารพ,<br>
            <strong style="color:#374151;">ทีมงาน Skllr Academy</strong>
          </p>
        </td>
      </tr>
      ${emailFooter()}
    `);

    const text = `เรียน ${fullName}\n\nคำเชิญให้คุณเป็นผู้ดูแลระบบของ Skllr Academy ได้ถูกยกเลิกไปแล้ว\nหากคุณคิดว่านี่เป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ`;
    return this.sendEmail(input.to, subject, html, text);
  }

  async sendAdminInviteEmail(input: {
    to: string;
    inviteUrl: string;
    temporaryPassword?: string;
    responsibility?: string;
  }): Promise<boolean> {
    const subject = 'คุณได้รับเชิญให้เป็นผู้ดูแลระบบ';
    const inviteUrl = input.inviteUrl ?? '';

    const responsibilityBlock = input.responsibility
      ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="background:#f0f9ff; border-left:4px solid #0ea5e9;
                       border-radius:0 8px 8px 0; padding:14px 16px; margin-bottom:16px;">
              <p style="margin:0; color:#0c4a6e; font-size:13px; line-height:1.5;">
                <strong>หน้าที่รับผิดชอบ:</strong>&nbsp;${input.responsibility}
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:0;"></p>
      `
      : '';

    const tempPasswordBlock = input.temporaryPassword
      ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="background:#f8f9fa; border:1px solid #e9ecef;
                       border-radius:8px; padding:14px 16px; margin-bottom:16px;">
              <p style="margin:0 0 4px 0; color:#6b7280; font-size:11px;
                         letter-spacing:1.5px; text-transform:uppercase; font-weight:600;">
                Temporary Password
              </p>
              <p style="margin:0; color:#111827; font-size:18px; font-weight:700;
                         font-family:'Courier New',monospace; letter-spacing:2px;">
                ${input.temporaryPassword}
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:0;"></p>
      `
      : '';

    const html = wrapEmail(`
      ${emailHeader('linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'คำเชิญผู้ดูแลระบบ')}
      <tr>
        <td style="padding:40px 40px 32px;">

          <p style="margin:0 0 8px 0; color:#111827; font-size:16px; font-weight:600;">
            ยินดีต้อนรับสู่ Skllr Academy! 🎉
          </p>
          <p style="margin:0 0 28px 0; color:#374151; font-size:15px; line-height:1.6;">
            คุณได้รับเชิญให้เป็น <strong>ผู้ดูแลระบบ</strong> ของ Skllr Academy
            กรุณายืนยันตัวตนเพื่อเริ่มต้นใช้งาน
          </p>

          ${responsibilityBlock}
          ${tempPasswordBlock}

          <!-- CTA Button -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center" style="padding:8px 0 28px 0;">
                <a href="${inviteUrl}"
                   style="display:inline-block; background:linear-gradient(135deg,#667eea,#764ba2);
                          color:#ffffff; text-decoration:none; padding:14px 36px;
                          border-radius:10px; font-size:15px; font-weight:700;
                          letter-spacing:0.3px; box-shadow:0 4px 14px rgba(102,126,234,0.4);">
                  ✓ &nbsp; ยืนยันการเชิญ
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0 0; color:#d1d5db; font-size:12px; line-height:1.5;">
            ลิงก์นี้จะหมดอายุใน 48 ชั่วโมง
          </p>
        </td>
      </tr>
      ${emailFooter()}
    `);

    const text = `คุณได้รับเชิญให้เป็นผู้ดูแลระบบ\n\nลิงก์ยืนยัน: ${inviteUrl}`;
    return this.sendEmail(input.to, subject, html, text);
  }

  // ─── Private core sender ──────────────────────────────────────────────────

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<boolean> {
    // 1. Try SMTP first
    if (this.smtpConfigured && this.transporter) {
      try {
        await this.transporter.sendMail({ from: this.fromEmail, to, subject, text, html });
        return true;
      } catch (err) {
        this.logger.error(`SMTP send failed to ${to}: ${(err as Error).message}`);
      }
    }

    // 2. Fall back to Resend
    if (this.isResendConfigured && this.resend) {
      try {
        const result = await this.resend.emails.send({
          from: this.fromEmail, to, subject, html, text,
        });
        if (result.error) {
          this.logger.error(`Resend failed to ${to}: ${result.error.message}`);
          return false;
        }
        return true;
      } catch (err) {
        this.logger.error(`Resend send failed to ${to}: ${(err as Error).message}`);
      }
    }

    // 3. No transport configured — log and return true (dev/preview mode)
    this.logger.warn(`[Preview] Email to: ${to} | Subject: ${subject} | ${text}`);
    return true;
  }
}