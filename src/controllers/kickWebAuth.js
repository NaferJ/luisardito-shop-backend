const puppeteer = require('puppeteer');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../../config');
const { Usuario } = require('../models');

class KickWebAuth {
    constructor() {
        this.browser = null;
        this.sessionCookies = new Map(); // Cache de cookies por usuario
    }

    // Iniciar sesión web y capturar cookies
    async loginWithCredentials(username, password) {
        try {
            // Configuración para usar Chrome del sistema
            const browserConfig = {
                headless: true,
                executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            };

            this.browser = await puppeteer.launch(browserConfig);
            const page = await this.browser.newPage();

            // User agent real
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Ir a la página de login
            await page.goto('https://kick.com/login', { waitUntil: 'networkidle0', timeout: 30000 });

            // Esperar y llenar formulario
            await page.waitForSelector('input[name="email"]', { timeout: 10000 });
            await page.type('input[name="email"]', username, { delay: 100 });
            await page.type('input[name="password"]', password, { delay: 100 });

            // Enviar formulario
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
            ]);

            // Verificar login exitoso
            const isLoggedIn = await page.evaluate(() => {
                return document.querySelector('[data-testid="user-menu"]') !== null ||
                    document.querySelector('.user-dropdown') !== null ||
                    window.location.pathname.includes('/dashboard');
            });

            if (!isLoggedIn) {
                throw new Error('Login fallido - verificar credenciales');
            }

            // Capturar cookies
            const cookies = await page.cookies();
            const sessionCookie = cookies.find(c =>
                c.name.includes('session') ||
                c.name.includes('auth') ||
                c.name === 'laravel_session'
            );

            // Obtener datos del usuario
            const userData = await this.getUserDataWithCookie(cookies, page);

            await this.browser.close();

            return {
                cookies: cookies,
                sessionToken: sessionCookie?.value || 'multiple_cookies',
                userData: userData
            };

        } catch (error) {
            if (this.browser) await this.browser.close();
            throw error;
        }
    }

    // Obtener datos del usuario usando cookies en lugar de OAuth
    async getUserDataWithCookie(cookies) {
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        try {
            // Usar endpoint interno en lugar del público
            const response = await axios.get('https://kick.com/api/v2/user', {
                headers: {
                    'Cookie': cookieString,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            return response.data;
        } catch (error) {
            throw new Error('No se pudieron obtener datos del usuario');
        }
    }

    // Validar si las cookies siguen siendo válidas
    async validateSession(cookies) {
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        try {
            const response = await axios.get('https://kick.com/api/v2/user', {
                headers: { 'Cookie': cookieString }
            });
            return response.status === 200;
        } catch {
            return false;
        }
    }
}

module.exports = KickWebAuth;
