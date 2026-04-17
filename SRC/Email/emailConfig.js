// services/emailConfig.js

/**
 * ════════════════════════════════════════════════════════════════
 *                    📧 EMAIL CONFIGURATION
 *   AWS SES SMTP (Production Ready)
 * ════════════════════════════════════════════════════════════════
 */

export const emailConfig = {
    // ❌ Turn off Mailtrap HTTP API
    useHttpApi: false,
    
    // ✅ AWS SES SMTP Configuration
    host: process.env.AWS_SES_HOST || 'email-smtp.us-east-1.amazonaws.com',
    port: parseInt(process.env.AWS_SES_PORT) || 587,
    auth: {
        user: process.env.AWS_SES_USER,
        pass: process.env.AWS_SES_PASS,
    },
    options: {
        secure: false, // Use TLS (not implicit SSL)
        tls: {
            rejectUnauthorized: true, // Recommended for AWS SES
        },
    },
    
    // Sender details (Using your new Nixvo domain)
    from: {
        email: process.env.FROM_EMAIL || 'noreply@nixvo.in',
        name: process.env.FROM_NAME || 'Nixvo',
    },
};

/**
 * ════════════════════════════════════════════════════════════════
 *                    🌐 APPLICATION CONFIGURATION
 * ════════════════════════════════════════════════════════════════
 */

export const appConfig = {
    appName: 'Nixvo',
    appUrl: 'nixvo://',
    supportEmail: 'support@nixvo.in',
    logoUrl: 'https://www.nixvo.in/logo.png',
};