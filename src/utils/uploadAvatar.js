const cloudinary = require('../config/cloudinary');
const axios = require('axios');

/**
 * Descarga el avatar de Kick y lo sube a Cloudinary
 * @param {string} kickAvatarUrl - URL del avatar de Kick
 * @param {string} userId - ID del usuario para el nombre del archivo
 * @returns {Promise<string>} - URL del avatar en Cloudinary
 */
async function uploadKickAvatarToCloudinary(kickAvatarUrl, userId) {
    try {
        // Verificar si Cloudinary está disponible
        if (!cloudinary) {
            console.warn(`[Upload Avatar] Cloudinary no disponible, usando URL original de Kick`);
            return kickAvatarUrl; // Fallback a URL original
        }

        // Verificar si es una imagen por defecto de Kick (no se pueden descargar)
        if (kickAvatarUrl.includes('/img/default-profile-pictures/')) {
            console.log(`[Upload Avatar] Avatar por defecto de Kick detectado, usando URL original`);
            return kickAvatarUrl; // Usar URL original para avatares por defecto
        }

        console.log(`[Upload Avatar] Descargando avatar de Kick para usuario ${userId}:`, kickAvatarUrl);

        // 1. Descargar la imagen de Kick con headers mejorados
        const response = await axios.get(kickAvatarUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site'
            },
            timeout: 10000,
            maxRedirects: 5
        });

        // 2. Convertir a base64
        const base64Image = Buffer.from(response.data).toString('base64');
        const dataUri = `data:image/jpeg;base64,${base64Image}`;

        console.log(`[Upload Avatar] Subiendo a Cloudinary para usuario ${userId}...`);
        console.log(`[Upload Avatar] Cloudinary config - Cloud Name: ${cloudinary.config().cloud_name}`);
        console.log(`[Upload Avatar] Cloudinary config - API Key: ${cloudinary.config().api_key}`);

        // 3. Subir a Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'user-avatars',
            public_id: `avatar-user-${userId}`,
            overwrite: true,
            transformation: [
                { width: 300, height: 300, crop: 'fill' },
                { quality: 'auto' },
                { format: 'webp' }
            ]
        });

        console.log(`[Upload Avatar] ✅ Avatar subido exitosamente:`, result.secure_url);
        return result.secure_url;

    } catch (error) {
        console.error('[Upload Avatar] Error procesando avatar:', error.message);

        // Si es un error 403 específicamente de Kick, es probable que sea una imagen protegida
        if (error.response && error.response.status === 403 && error.config?.url?.includes('kick.com')) {
            console.warn('[Upload Avatar] Kick.com bloqueó la descarga (imagen protegida), usando URL original');
            return kickAvatarUrl; // Usar URL original cuando Kick bloquea la descarga
        }

        // Para otros errores, también usar fallback
        console.error('[Upload Avatar] Error completo:', error);
        if (error.http_code) {
            console.error('[Upload Avatar] HTTP Code:', error.http_code);
        }
        if (error.error && error.error.message) {
            console.error('[Upload Avatar] Cloudinary Error:', error.error.message);
        }
        console.warn('[Upload Avatar] Usando URL original de Kick como fallback');
        return kickAvatarUrl; // Fallback a URL original en caso de error
    }
}

module.exports = { uploadKickAvatarToCloudinary };
