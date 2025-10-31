const { Producto } = require('../src/models');
const { sequelize } = require('../src/models/database');

// Función para generar slug
function generateSlug(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

async function updateSlugs() {
    try {
        console.log('Iniciando actualización de slugs para productos existentes...');

        const productos = await Producto.findAll();
        console.log(`Encontrados ${productos.length} productos.`);

        for (const producto of productos) {
            const slug = generateSlug(producto.nombre);
            await producto.update({ slug });
            console.log(`Actualizado producto ${producto.id}: ${producto.nombre} -> ${slug}`);
        }

        console.log('Actualización completada.');
    } catch (error) {
        console.error('Error actualizando slugs:', error);
    } finally {
        await sequelize.close();
    }
}

updateSlugs();
