const puppeteer = require('puppeteer');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../../config');
const { Usuario } = require('../models');

const { chromium } = require('playwright');

class KickWebAuth {
    constructor() {
        this.browser = null;
    }

    async loginWithCredentials(username, password) {
        try {
            // Playwright es MÁS SIMPLE
            this.browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });

            const page = await context.newPage();

            // Ir a login
            await page.goto('https://kick.com/login', { waitUntil: 'networkidle' });

            // Llenar formulario
            await page.fill('input[name="email"]', username);
            await page.fill('input[name="password"]', password);

            // Submit
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle' });

            // Verificar login
            const isLoggedIn = await page.locator('[data-testid="user-menu"]').count() > 0;

            if (!isLoggedIn) {
                throw new Error('Login fallido');
            }

            // Obtener cookies (IGUAL que Puppeteer)
            const cookies = await context.cookies();
            const userData = await this.getUserDataWithCookie(cookies);

            await this.browser.close();

            return {
                cookies: cookies,
                sessionToken: cookies.find(c => c.name.includes('session'))?.value || 'multiple_cookies',
                userData: userData
            };

        } catch (error) {
            if (this.browser) await this.browser.close();
            throw error;
        }
    }
}

module.exports = KickWebAuth;
