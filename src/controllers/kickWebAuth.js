const puppeteer = require('puppeteer-core'); // Cambiar a puppeteer-core
const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../../config');
const { Usuario } = require('../models');

class KickWebAuth {
    constructor() {
        this.browser = null;
    }

    async loginWithCredentials(username, password) {
        try {
            console.log('🚀 Iniciando navegador Chromium...');

            this.browser = await puppeteer.launch({
                headless: true,
                executablePath: '/usr/bin/chromium-browser', // Chrome de Alpine
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--no-first-run',
                    '--no-default-browser-check'
                ]
            });

            const page = await this.browser.newPage();

            // User agent y viewport
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1920, height: 1080 });

            console.log('📄 Navegando a Kick login...');
            await page.goto('https://kick.com/login', {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Esperar y llenar formulario
            console.log('⏳ Esperando campos de login...');
            await page.waitForSelector('input[name="email"]', { timeout: 15000 });

            console.log('✏️ Llenando credenciales...');
            await page.type('input[name="email"]', username, { delay: 50 });
            await page.type('input[name="password"]', password, { delay: 50 });

            console.log('🔑 Enviando formulario...');
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
            ]);

            // Verificar login exitoso
            console.log('✅ Verificando login...');
            const isLoggedIn = await page.evaluate(() => {
                return document.querySelector('[data-testid="user-menu"]') !== null ||
                    document.querySelector('.user-dropdown') !== null ||
                    document.querySelector('.profile-menu') !== null ||
                    window.location.pathname.includes('/dashboard') ||
                    window.location.pathname.includes('/profile');
            });

            if (!isLoggedIn) {
                console.error('❌ Login fallido');
                throw new Error('Login fallido - verificar credenciales');
            }

            console.log('🍪 Capturando cookies...');
            const cookies = await page.cookies();

            console.log('👤 Obteniendo datos del usuario...');
            const userData = await this.getUserDataWithCookie(cookies, page);

            await this.browser.close();
            console.log('✅ Login completado exitosamente');

            return {
                cookies: cookies,
                sessionToken: cookies.find(c =>
                    c.name.includes('session') ||
                    c.name.includes('auth') ||
                    c.name === 'laravel_session'
                )?.value || 'multiple_cookies',
                userData: userData
            };

        } catch (error) {
            console.error('❌ Error en login:', error.message);
            if (this.browser) await this.browser.close();
            throw error;
        }
    }

    async getUserDataWithCookie(cookies, page = null) {
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        try {
            // Intentar obtener datos del DOM primero
            if (page) {
                try {
                    const userData = await page.evaluate(() => {
                        if (window.Laravel && window.Laravel.user) {
                            return window.Laravel.user;
                        }

                        const userElement = document.querySelector('[data-user]');
                        if (userElement) {
                            return JSON.parse(userElement.dataset.user);
                        }

                        return null;
                    });

                    if (userData && userData.id) {
                        console.log('✅ Datos obtenidos del DOM');
                        return userData;
                    }
                } catch (e) {
                    console.log('⚠️ No se pudieron obtener datos del DOM');
                }
            }

            // Usar endpoints de API
            const endpoints = [
                'https://kick.com/api/v2/user',
                'https://kick.com/api/v1/user'
            ];

            for (const endpoint of endpoints) {
                try {
                    const response = await axios.get(endpoint, {
                        headers: {
                            'Cookie': cookieString,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'application/json',
                            'Referer': 'https://kick.com'
                        },
                        timeout: 10000
                    });

                    if (response.data && response.data.id) {
                        console.log(`✅ Datos obtenidos de ${endpoint}`);
                        return response.data;
                    }
                } catch (error) {
                    console.log(`⚠️ Fallo ${endpoint}: ${error.response?.status || error.message}`);
                    continue;
                }
            }

            // Fallback: datos básicos
            console.log('⚠️ Usando datos básicos');
            return {
                id: Date.now(),
                username: 'kick_user',
                email: null,
                avatar_url: null
            };

        } catch (error) {
            throw new Error(`Error obteniendo datos: ${error.message}`);
        }
    }

    async validateSession(cookies) {
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        try {
            const response = await axios.get('https://kick.com/api/v2/user', {
                headers: { 'Cookie': cookieString },
                timeout: 5000
            });
            return response.status === 200;
        } catch {
            return false;
        }
    }
}

module.exports = KickWebAuth;
