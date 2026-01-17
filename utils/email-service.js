import nodemailer from 'nodemailer';
import configuracionLoader from '../config/configuracionLoader.js';

/**
 * Service to handle clinical email communications
 */
class EmailService {
    constructor() {
        this.transporter = null;
    }

    /**
     * Initializes the transporter with current configurations
     * Uses SMTP settings from the database via configuracionLoader
     */
    async init() {
        const host = configuracionLoader.getConfigOrDefault('smtp.host', '');
        const port = configuracionLoader.getConfigOrDefault('smtp.port', 587);
        const user = configuracionLoader.getConfigOrDefault('smtp.user', '');
        const pass = configuracionLoader.getConfigOrDefault('smtp.pass', '');
        const from = configuracionLoader.getConfigOrDefault('smtp.from', 'Inventario MV <no-reply@mv-inventario.com>');

        if (!host || !user || !pass) {
            console.warn('⚠️ SMTP Configuration incomplete. Email service may fail.');
        }

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465, // true for 465, false for other ports
            auth: {
                user,
                pass
            },
            tls: {
                // Do not fail on invalid certs
                rejectUnauthorized: false
            }
        });

        this.from = from;
    }

    /**
     * Sends a password reset email to the user
     * @param {string} email - Destination email
     * @param {string} token - Password reset token
     * @param {string} nombre - User name
     */
    async sendPasswordReset(email, token, nombre) {
        if (!this.transporter) await this.init();

        const appUrl = configuracionLoader.getConfigOrDefault('app.url', 'http://localhost:3000');
        const resetLink = `${appUrl}/pages/reset-password.html?token=${token}`;

        const mailOptions = {
            from: this.from,
            to: email,
            subject: 'Recuperación de Contraseña - MV Inventario',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #d97706; margin: 0;">MV Inventario</h1>
                        <p style="color: #666; font-size: 14px;">Gestión de Inventario Profesional</p>
                    </div>
                    
                    <div style="padding: 20px; background-color: #ffffff;">
                        <h2 style="color: #333;">Hola, ${nombre}</h2>
                        <p style="color: #555; line-height: 1.6;"> Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>MV Inventario</strong>.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">RESTABLECER CONTRASEÑA</a>
                        </div>
                        
                        <p style="color: #555; line-height: 1.6;">Este enlace expirará en 1 hora por razones de seguridad.</p>
                        <p style="color: #555; line-height: 1.6;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
                    </div>
                    
                    <div style="margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #999;">
                        <p>© ${new Date().getFullYear()} MV Inventario. Todos los derechos reservados.</p>
                        <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
                    </div>
                </div>
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email de recuperación enviado:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Error enviando email:', error);
            throw error;
        }
    }
}

export default new EmailService();
