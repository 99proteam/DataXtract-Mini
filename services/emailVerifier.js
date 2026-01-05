const dns = require('dns');
const net = require('net');
const { verificationOps } = require('../config/database');

const DISPOSABLE_DOMAINS = new Set([
    'yopmail.com', 'mailinator.com', 'guerrillamail.com', 'temp-mail.org',
    '10minutemail.com', 'throwawaymail.com', 'tempmail.com'
]);

class EmailVerifier {
    constructor() {
        this.cache = new Map();
    }

    async verify(email) {
        // 1. Check local DB/Cache
        const cached = verificationOps.get.get(email);
        if (cached && new Date(cached.last_verified) > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
            // Return cached if less than 24 hours old
            return {
                email,
                status: cached.status,
                score: cached.score,
                checks: JSON.parse(cached.checks),
                cached: true
            };
        }

        const result = {
            email,
            status: 'unknown',
            score: 0,
            checks: {
                syntax: false,
                domain: false,
                mx: false,
                smtp: false,
                disposable: false
            }
        };

        try {
            // 2. Syntax Check
            if (!this.checkSyntax(email)) {
                result.status = 'invalid';
                result.checks.syntax = false;
                this.saveResult(result);
                return result;
            }
            result.checks.syntax = true;
            result.score += 20;

            const [user, domain] = email.split('@');

            // 3. Disposable Check
            if (DISPOSABLE_DOMAINS.has(domain.toLowerCase())) {
                result.status = 'disposable';
                result.checks.disposable = true;
                result.score = 0;
                this.saveResult(result);
                return result;
            }

            // 4. DNS/MX Check
            const mxRecords = await this.resolveMx(domain);
            if (!mxRecords || mxRecords.length === 0) {
                result.status = 'invalid'; // No MX means no email
                result.checks.mx = false;
                this.saveResult(result);
                return result;
            }
            result.checks.mx = true;
            result.score += 30;

            // 5. SMTP Handshake
            // Note: This is risky and slow. We do a basic check.
            const smtpResult = await this.checkSmtp(mxRecords[0].exchange, user, domain);
            result.checks.smtp = smtpResult.valid;

            if (smtpResult.valid) {
                result.status = 'valid';
                result.score += 50;
            } else if (smtpResult.catchAll) {
                result.status = 'catch-all';
                result.score += 30;
            } else if (smtpResult.error) {
                // Network error or block, assume unknown but keep score from MX
                result.status = 'unknown';
                // Don't zero out score, MX is still good
            } else {
                // Hard bounce
                result.status = 'invalid';
                result.score = 0;
            }

        } catch (error) {
            console.error(`Verification error for ${email}:`, error);
        }

        this.saveResult(result);
        return result;
    }

    checkSyntax(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    resolveMx(domain) {
        return new Promise((resolve) => {
            dns.resolveMx(domain, (err, addresses) => {
                if (err) resolve(null);
                else resolve(addresses.sort((a, b) => a.priority - b.priority));
            });
        });
    }

    checkSmtp(host, user, domain) {
        return new Promise((resolve) => {
            const socket = net.createConnection(25, host);
            let step = 0; // 0=connect, 1=helo, 2=mail_from, 3=rcpt_to
            let result = { valid: false, catchAll: false, error: null };

            socket.setTimeout(4000); // Short timeout

            const send = (cmd) => socket.write(cmd + '\r\n');

            socket.on('connect', () => {
                // Wait for greeting
            });

            socket.on('data', (data) => {
                const response = data.toString();
                const code = parseInt(response.substring(0, 3));

                if (step === 0 && code === 220) {
                    send(`HELO ${domain}`); // Or local hostname
                    step = 1;
                } else if (step === 1 && code === 250) {
                    send(`MAIL FROM:<check@${domain}>`);
                    step = 2;
                } else if (step === 2 && code === 250) {
                    send(`RCPT TO:<${user}@${domain}>`);
                    step = 3;
                } else if (step === 3) {
                    if (code === 250) {
                        result.valid = true;
                    } else if (code === 550) {
                        result.valid = false;
                    } else {
                        result.valid = false; // Other error
                        result.error = response;
                    }
                    send('QUIT');
                    socket.end();
                    resolve(result);
                }
            });

            socket.on('error', (err) => {
                result.error = err.message;
                socket.destroy();
                resolve(result);
            });

            socket.on('timeout', () => {
                result.error = 'timeout';
                socket.destroy();
                resolve(result);
            });
        });
    }

    saveResult(result) {
        verificationOps.add.run(
            result.email,
            result.status,
            result.score,
            JSON.stringify(result.checks)
        );
    }
}

module.exports = new EmailVerifier();
