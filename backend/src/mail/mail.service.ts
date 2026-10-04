import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * E-posta gönderimi. SMTP_HOST tanımlıysa nodemailer ile gönderir; değilse
 * (geliştirme/LAN) e-posta gönderilmez, içeriği (bağlantılar dahil) sunucu
 * log'una yazılır ve `outbox`'ta tutulur (testler okur). Böylece SMTP olmadan
 * da davet/sıfırlama bağlantıları panelden/log'dan alınabilir.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport?: Transporter;
  private readonly from: string;

  /** SMTP yokken son gönderimler (en fazla 50). */
  readonly outbox: Mail[] = [];

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('SMTP_FROM') || 'Signage <no-reply@localhost>';
    if (host) {
      this.transport = createTransport({
        host,
        port: Number(config.get('SMTP_PORT') ?? 587),
        secure: config.get('SMTP_SECURE') === 'true',
        auth: config.get('SMTP_USER')
          ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') }
          : undefined,
      });
    }
  }

  get enabled(): boolean {
    return !!this.transport;
  }

  async send(mail: Mail): Promise<void> {
    if (!this.transport) {
      this.outbox.push(mail);
      if (this.outbox.length > 50) this.outbox.shift();
      this.logger.warn(`No SMTP configured — email not sent.\n→ ${mail.to}: ${mail.subject}\n${mail.text}`);
      return;
    }
    try {
      await this.transport.sendMail({ from: this.from, ...mail });
    } catch (e) {
      // Gönderim hatası isteği düşürmesin (bağlantı panelden de alınabilir).
      this.logger.error(`Could not send email (${mail.to}): ${(e as Error).message}`);
    }
  }
}
