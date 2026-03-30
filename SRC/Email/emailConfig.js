// services/emailConfig.js

/**
 * ════════════════════════════════════════════════════════════════
 *                    📧 EMAIL CONFIGURATION
 *   Mailtrap HTTP API (Works on all networks - Port 443)
 * ════════════════════════════════════════════════════════════════
 */

export const emailConfig = {
    // ✅ Use HTTP API instead of SMTP
    useHttpApi: true,
    
    // Mailtrap HTTP API endpoint
    apiUrl: 'https://send.api.mailtrap.io/api/send',
    apiToken: process.env.MAILTRAP_API_TOKEN,
    
    // Legacy SMTP config (not used when useHttpApi = true)
    host: process.env.MAIL_HOST || 'send.api.mailtrap.io',
    port: parseInt(process.env.MAIL_PORT) || 2525,
    auth: {
        user: process.env.MAIL_USER || 'api',
        pass: process.env.MAIL_PASS,
    },
    options: {
        secure: false,
        tls: {
            rejectUnauthorized: false,
        },
    },
    
    // Sender details
    from: {
        email: process.env.MAIL_FROM || 'hello@nixvo.in',
        name: process.env.MAIL_FROM_NAME || 'Nixvo Team',
    },
};

/**
 * ════════════════════════════════════════════════════════════════
 *                    🌐 APPLICATION CONFIGURATION
 * ════════════════════════════════════════════════════════════════
 */

export const appConfig = {
    appName: 'Nixvo',
    appUrl: 'https://www.nixvo.in',
    supportEmail: 'support@nixvo.in',
    logoUrl: 'https://www.nixvo.in/logo.png',
};