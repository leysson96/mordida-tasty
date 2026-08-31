import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
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

  constructor(private readonly configService: ConfigService<AppEnv, true>) {
    const host = this.configService.get('SMTP_HOST', { infer: true });
    const user = this.configService.get('SMTP_USER', { infer: true });
    const password = this.configService.get('SMTP_PASSWORD', { infer: true });

    this.frontendUrl = this.configService.get('FRONTEND_URL', { infer: true });
    this.from = this.configService.get('SMTP_FROM', { infer: true });
    this.production = this.configService.get('NODE_ENV', { infer: true }) === 'production';

    if (host) {
      this.transport = nodemailer.createTransport({
        host,
        port: this.configService.get('SMTP_PORT', { infer: true }),
        secure: this.configService.get('SMTP_SECURE', { infer: true }),
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
    if (!this.transport) {
      if (this.production) {
        throw new InternalServerErrorException('SMTP is not configured.');
      }

      this.logger.warn(`Mail disabled. ${message.subject}: ${message.text}`);
      return;
    }

    await this.transport.sendMail({
      from: this.from,
      ...message
    });
  }
}
