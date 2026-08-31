import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppEnv } from '../config/env';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport?: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;
  private readonly production: boolean;
  private readonly timeoutMs: number;
  private readonly brevoApiKey?: string;
  private readonly brevoApiUrl: string;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    const host = this.configService.get('SMTP_HOST', { infer: true });
    const user = this.configService.get('SMTP_USER', { infer: true });
    const password = this.configService.get('SMTP_PASSWORD', { infer: true });

    this.frontendUrl = this.configService.get('FRONTEND_URL', { infer: true });
    this.from = this.configService.get('SMTP_FROM', { infer: true });
    this.production = this.configService.get('NODE_ENV', { infer: true }) === 'production';
    this.timeoutMs = this.configService.get('SMTP_TIMEOUT_MS', { infer: true });
    this.brevoApiKey = this.configService.get('BREVO_API_KEY', {
      infer: true,
    });
    this.brevoApiUrl = this.configService.get('BREVO_API_URL', {
      infer: true,
    });

    if (!this.brevoApiKey && host) {
      this.transport = nodemailer.createTransport({
        host,
        port: this.configService.get('SMTP_PORT', { infer: true }),
        secure: this.configService.get('SMTP_SECURE', { infer: true }),
        connectionTimeout: this.timeoutMs,
        greetingTimeout: this.timeoutMs,
        socketTimeout: this.timeoutMs,
        ...(user && password ? { auth: { user, pass: password } } : {})
      });
    }
  }

  async sendVerificationEmail(email: string, token: string) {
    const url = `${this.frontendUrl}/auth/verificar?token=${encodeURIComponent(token)}`;
    await this.send({
      to: email,
      subject: 'Verifica tu cuenta de Mordida Tasty',
      text: `Verifica tu cuenta aqui: ${url}`
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const url = `${this.frontendUrl}/auth/reset?token=${encodeURIComponent(token)}`;
    await this.send({
      to: email,
      subject: 'Recupera tu cuenta de Mordida Tasty',
      text: `Cambia tu contrasena aqui: ${url}`
    });
  }

  private async send(message: { to: string; subject: string; text: string }) {
    if (this.brevoApiKey) {
      await this.sendWithBrevoApi(message);
      return;
    }

    if (!this.transport) {
      if (this.production) {
        throw new ServiceUnavailableException(
          'El servicio de correo no esta configurado.',
        );
      }

      this.logger.warn(`Mail disabled. ${message.subject}: ${message.text}`);
      return;
    }

    try {
      await this.transport.sendMail({
        from: this.from,
        ...message
      });
    } catch (error) {
      this.logger.error(
        `Email delivery failed for ${message.to}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'No pudimos enviar el email. Revisa la configuracion SMTP.',
      );
    }
  }

  private async sendWithBrevoApi(message: {
    to: string;
    subject: string;
    text: string;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.brevoApiUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': this.brevoApiKey!,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: parseSender(this.from),
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Brevo API failed with status ${response.status}: ${body.slice(0, 500)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Email delivery failed for ${message.to}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'No pudimos enviar el email. Revisa la configuracion de Brevo.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseSender(from: string) {
  const match = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (!match) {
    return { email: from.trim() };
  }

  const name = match[1].trim().replace(/^"|"$/g, '');
  return {
    ...(name ? { name } : {}),
    email: match[2].trim(),
  };
}
