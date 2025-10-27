console.log('🔍 Iniciando test simple...');

const axios = require('axios');

async function testSimple() {
    try {
        console.log('📡 Probando API de Kick...');

        const response = await axios.get('https://kick.com/api/v2/channels/luisardito', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        console.log('✅ Respuesta recibida:');
        console.log('ID del canal:', response.data.id);
        console.log('Slug:', response.data.slug);
        console.log('User ID:', response.data.user_id);
        console.log('¿En vivo?:', response.data.livestream?.is_live || false);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testSimple();
