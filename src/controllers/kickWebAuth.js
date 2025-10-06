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
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await this.browser.newPage();

            // Ir a la página de login
            await page.goto('https://kick.com/login', { waitUntil: 'networkidle0' });

            // Llenar formulario de login
            await page.type('input[name="email"]', username);
            await page.type('input[name="password"]', password);

            // Enviar formulario y esperar navegación
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle0' })
            ]);

            // Verificar login exitoso (buscar elementos que indican sesión activa)
            const isLoggedIn = await page.$('.user-menu') !== null;

            if (!isLoggedIn) {
                throw new Error('Login fallido - credenciales inválidas');
            }

            // Capturar todas las cookies
            const cookies = await page.cookies();
            const sessionCookie = cookies.find(c => c.name.includes('session') || c.name.includes('auth'));

            if (!sessionCookie) {
                throw new Error('No se encontró cookie de sesión');
            }

            // Obtener datos del usuario usando endpoints internos
            const userData = await this.getUserDataWithCookie(cookies);

            await this.browser.close();

            return {
                cookies: cookies,
                sessionToken: sessionCookie.value,
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
