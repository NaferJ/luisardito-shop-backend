let cloudinary;

try {
    cloudinary = require('cloudinary').v2;

    console.log('[Cloudinary Debug] Variables de entorno:');
    console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? `"${process.env.CLOUDINARY_CLOUD_NAME}"` : 'NO DEFINIDA');
    console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? `"${process.env.CLOUDINARY_API_KEY}"` : 'NO DEFINIDA');
    console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? `"${process.env.CLOUDINARY_API_SECRET.substring(0, 10)}..."` : 'NO DEFINIDA');

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    console.log('[Cloudinary] ✅ Configurado correctamente');
    console.log('[Cloudinary] Cloud Name configurado:', cloudinary.config().cloud_name);
    console.log('[Cloudinary] API Key configurado:', cloudinary.config().api_key);

} catch (error) {
    console.warn('[Cloudinary] ⚠️ No disponible:', error.message);
    cloudinary = null;
}

module.exports = cloudinary;
