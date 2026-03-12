import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { Resend } from 'resend';

import nodemailer from 'nodemailer';



@Injectable()

export class EmailService {

  private readonly logger = new Logger(EmailService.name);

  private readonly resend: Resend | null;

  private readonly fromEmail: string;

  private readonly isResendConfigured: boolean;

  private readonly smtpConfigured: boolean;

  private readonly transporter: nodemailer.Transporter | null;



  constructor(private readonly configService: ConfigService) {

    const resendKey = this.configService.get<string>('RESEND_API_KEY');

    this.fromEmail = this.configService.get<string>('MAIL_FROM') ?? 'no-reply@skillracademy.com';

    this.isResendConfigured = !!resendKey;

    this.resend = this.isResendConfigured ? new Resend(resendKey as string) : null;



    const smtpHost = this.configService.get<string>('EMAIL_HOST') ?? this.configService.get<string>('SMTP_HOST');

    const smtpPort = Number(this.configService.get<number>('EMAIL_PORT') ?? this.configService.get<number>('SMTP_PORT') ?? 587);

    const smtpUser = this.configService.get<string>('EMAIL_USER') ?? this.configService.get<string>('SMTP_USER');

    const smtpPass = this.configService.get<string>('EMAIL_PASS') ?? this.configService.get<string>('SMTP_PASS');



    this.smtpConfigured = !!(smtpHost && smtpUser && smtpPass);

    this.transporter = this.smtpConfigured

      ? nodemailer.createTransport({

        host: smtpHost as string,

        port: smtpPort,

        secure: smtpPort === 465,

        auth: {

          user: smtpUser as string,

          pass: smtpPass as string,

        },

      })

      : null;



    // this.logger.log(`EmailService initialized - Resend: ${this.isResendConfigured}, SMTP: ${this.smtpConfigured}, From: ${this.fromEmail}`);

  }



  async sendOtpEmail(to: string, otp: string): Promise<boolean> {

    const subject = 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน';

    const html = `

      <!DOCTYPE html>

      <html lang="th">

      <head>

        <meta charset="UTF-8">

        <meta name="viewport" content="width=device-width, initial-scale=1.0">

      </head>

      <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; padding: 40px 20px;">

          <tr>

            <td align="center">

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

                

                <!-- Header -->

                <tr>

                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center;">

                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">

                      Skillr Academy

                    </h1>

                  </td>

                </tr>



                <!-- Content -->

                <tr>

                  <td style="padding: 40px 32px;">

                    <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 20px; font-weight: 600;">

                      รีเซ็ตรหัสผ่าน

                    </h2>

                    <p style="margin: 0 0 32px 0; color: #666; font-size: 15px; line-height: 1.5;">

                      ใช้รหัส OTP ด้านล่างเพื่อรีเซ็ตรหัสผ่าน

                    </p>



                    <!-- OTP Box -->

                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

                      <tr>

                        <td align="center" style="padding: 0 0 32px 0;">

                          <div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 24px; display: inline-block;">

                            <div style="font-size: 36px; font-weight: 700; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">

                              ${otp}

                            </div>

                          </div>

                        </td>

                      </tr>

                    </table>



                    <!-- Warning -->

                    <div style="background-color: #fff3cd; border-left: 3px solid #ffc107; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">

                      <p style="margin: 0; color: #856404; font-size: 14px;">

                        รหัสนี้จะหมดอายุใน <strong>10 นาที</strong>

                      </p>

                    </div>



                    <p style="margin: 0; color: #999; font-size: 13px; line-height: 1.5;">

                      หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้

                    </p>

                  </td>

                </tr>



                <!-- Footer -->

                <tr>

                  <td style="background-color: #f8f9fa; padding: 24px; text-align: center; border-top: 1px solid #e9ecef;">

                    <p style="margin: 0; color: #999; font-size: 12px;">

                      &copy; ${new Date().getFullYear()} Skillr Academy

                    </p>

                  </td>

                </tr>



              </table>

            </td>

          </tr>

        </table>

      </body>

      </html>

    `;

    const text = `รหัส OTP: ${otp} (หมดอายุใน 10 นาที)`;

    return this.sendEmail(to, subject, html, text);

  }



  async sendPasswordChangedEmail(to: string): Promise<boolean> {

    const subject = 'รหัสผ่านถูกเปลี่ยนเรียบร้อย';

    const html = `

      <!DOCTYPE html>

      <html lang="th">

      <head>

        <meta charset="UTF-8">

        <meta name="viewport" content="width=device-width, initial-scale=1.0">

      </head>

      <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; padding: 40px 20px;">

          <tr>

            <td align="center">

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

                

                <!-- Header -->

                <tr>

                  <td style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 32px; text-align: center;">

                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">

                      Skillr Academy

                    </h1>

                  </td>

                </tr>



                <!-- Content -->

                <tr>

                  <td style="padding: 48px 32px; text-align: center;">

                    

                    <!-- Success Icon -->

                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 50%; margin: 0 auto 24px auto; display: flex; align-items: center; justify-content: center;">

                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">

                        <tr>

                          <td style="font-size: 36px; line-height: 64px; color: #ffffff;">&check;</td>

                        </tr>

                      </table>

                    </div>



                    <h2 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 22px; font-weight: 600;">

                      เปลี่ยนรหัสผ่านสำเร็จ

                    </h2>

                    

                    <p style="margin: 0; color: #666; font-size: 15px; line-height: 1.5;">

                      คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว

                    </p>



                  </td>

                </tr>



                <!-- Footer -->

                <tr>

                  <td style="background-color: #f8f9fa; padding: 24px; text-align: center; border-top: 1px solid #e9ecef;">

                    <p style="margin: 0; color: #999; font-size: 12px;">

                      &copy; ${new Date().getFullYear()} Skillr Academy

                    </p>

                  </td>

                </tr>



              </table>

            </td>

          </tr>

        </table>

      </body>

      </html>

    `;

    const text = 'รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว';

    return this.sendEmail(to, subject, html, text);

  }



  async sendInvitationCanceledEmail(input: {

    to: string;

    firstName: string;

    lastName: string;

  }): Promise<boolean> {

    const subject = 'คำเชิญให้เป็นผู้ดูแลระบบถูกยกเลิก';

    const fullName = `${input.firstName} ${input.lastName}`.trim();



    const html = `

      <!DOCTYPE html>

      <html lang="th">

      <head>

        <meta charset="UTF-8">

        <meta name="viewport" content="width=device-width, initial-scale=1.0">

      </head>

      <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; padding: 40px 20px;">

          <tr>

            <td align="center">

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">

                <!-- Header -->

                <tr>

                  <td style="background-color: #dc3545; padding: 32px 24px; text-align: center;">

                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">

                      คำเชิญถูกยกเลิก

                    </h1>

                  </td>

                </tr>

                

                <!-- Content -->

                <tr>

                  <td style="padding: 32px 24px;">

                    <p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">

                      เรียน <strong>${fullName}</strong>

                    </p>

                    

                    <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">

                      คำเชิญให้คุณเป็นผู้ดูแลระบบของ Skllr Academy ได้ถูกยกเลิกไปแล้ว

                    </p>

                    

                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">

                      <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">

                        <strong>หมายเหตุ:</strong> หากคุณคิดว่านี่เป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ

                      </p>

                    </div>

                    

                    <p style="margin: 0 0 16px 0; color: #666666; font-size: 14px; line-height: 1.5;">

                      ขอบคุณที่สนใจร่วมงานกับเรา

                    </p>

                    

                    <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">

                      ด้วยความเคารพ,<br>

                      ทีมงาน Skllr Academy

                    </p>

                  </td>

                </tr>

                

                <!-- Footer -->

                <tr>

                  <td style="background-color: #f8f9fa; padding: 20px 24px; text-align: center; border-top: 1px solid #e9ecef;">

                    <p style="margin: 0; color: #666666; font-size: 12px; line-height: 1.4;">

                      &copy; 2026 Skllr Academy. All rights reserved.

                    </p>

                  </td>

                </tr>

              </table>

            </td>

          </tr>

        </table>

      </body>

      </html>

    `;



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

    const responsibilityLine = input.responsibility ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px; line-height: 1.5;">หน้าที่รับผิดชอบ: <strong>${input.responsibility}</strong></p>` : '';

    const tempPasswordBlock = input.temporaryPassword

      ? `

        <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 12px 16px; border-radius: 8px; margin: 0 0 16px 0;">

          <p style="margin: 0; color: #1a1a1a; font-size: 14px;">

            Temporary Password: <strong style="font-family: 'Courier New', monospace;">${input.temporaryPassword}</strong>

          </p>

        </div>

      `

      : '';



    const inviteUrl = input.inviteUrl || '';



    const html = `

      <!DOCTYPE html>

      <html lang="th">

      <head>

        <meta charset="UTF-8">

        <meta name="viewport" content="width=device-width, initial-scale=1.0">

      </head>

      <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; padding: 40px 20px;">

          <tr>

            <td align="center">

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

                <tr>

                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center;">

                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">

                      Skillr Academy

                    </h1>

                  </td>

                </tr>



                <tr>

                  <td style="padding: 40px 32px;">

                    <h2 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 20px; font-weight: 600;">

                      เชิญเป็นผู้ดูแลระบบ

                    </h2>

                    <p style="margin: 0 0 16px 0; color: #666; font-size: 14px; line-height: 1.5;">

                      คุณได้รับเชิญให้เป็นผู้ดูแลระบบของ Skillr Academy

                    </p>

                    ${responsibilityLine}

                    ${tempPasswordBlock}

                    <p style="margin: 0 0 24px 0; color: #666; font-size: 14px; line-height: 1.5;">

                      กรุณากดปุ่มด้านล่างเพื่อยืนยันตัวตนและตั้งรหัสผ่านใหม่

                    </p>



                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

                      <tr>

                        <td align="center" style="padding: 0 0 24px 0;">

                          <a href="${inviteUrl}" style="background: #667eea; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block; font-weight: 600;">

                            ยืนยันการเชิญ

                          </a>

                        </td>

                      </tr>

                    </table>



                    <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.5;">

                      หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์: ${inviteUrl}

                    </p>

                  </td>

                </tr>



                <tr>

                  <td style="background-color: #f8f9fa; padding: 24px; text-align: center; border-top: 1px solid #e9ecef;">

                    <p style="margin: 0; color: #999; font-size: 12px;">

                      &copy; ${new Date().getFullYear()} Skillr Academy

                    </p>

                  </td>

                </tr>

              </table>

            </td>

          </tr>

        </table>

      </body>

      </html>

    `;



    const text = `คุณได้รับเชิญให้เป็นผู้ดูแลระบบ\n\nลิงก์ยืนยัน: ${inviteUrl}`;

    return this.sendEmail(input.to, subject, html, text);

  }



  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {

    if (this.smtpConfigured && this.transporter) {

      try {

        const info = await this.transporter.sendMail({

          from: this.fromEmail,

          to,

          subject,

          text,

          html,

        });

        // this.logger.log(`SMTP email sent to ${to}, messageId=${info.messageId}`);

        return true;

      } catch (err) {

        this.logger.error(`SMTP send failed to ${to}: ${(err as Error).message}`);

      }

    }



    if (this.isResendConfigured && this.resend) {

      try {

        const result = await this.resend.emails.send({

          from: this.fromEmail,

          to,

          subject,

          html,

          text,

        });

        if (result.error) {

          this.logger.error(`Resend failed to ${to}: ${result.error.message}`);

          return false;

        }

        // this.logger.log(`Resend email sent to ${to}, id: ${result.data?.id}`);

        return true;

      } catch (err) {

        this.logger.error(`Resend send failed to ${to}: ${(err as Error).message}`);

      }

    }



    // this.logger.log(`Email to: ${to}`);

    // this.logger.log(`Subject: ${subject}`);

    // this.logger.log(`Text: ${text}`);

    // this.logger.log(`[Preview Mode] Email to: ${to}`);

    // this.logger.log(`[Preview Mode] Subject: ${subject}`);

    // this.logger.log(`[Preview Mode] Text: ${text}`);

    return true;

  }

}