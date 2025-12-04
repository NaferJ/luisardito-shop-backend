/**
 * Script de Backfill: Actualizar precio_al_canje en canjes históricos
 * 
 * Propósito: Rellenar el campo precio_al_canje con el precio actual del producto
 * para todos los canjes que no tienen este valor (canjes anteriores a la migración).
 * 
 * Estrategia:
 * - Procesa en lotes (batches) para evitar sobrecarga de memoria
 * - Usa transacciones para garantizar atomicidad
 * - Idempotente: se puede ejecutar múltiples veces sin problema
 * - Maneja errores por canje eliminado o sin producto
 * 
 * Uso:
 *   node backfill-precios-canjes.js
 *   docker-compose exec backend node backfill-precios-canjes.js
 */

const { Canje, Producto } = require('./src/models');
const { sequelize } = require('./src/models/database');

const BATCH_SIZE = 100; // Procesar 100 canjes por lote

async function backfillPreciosCanjes() {
    console.log('🔄 Iniciando backfill de precios en canjes históricos...\n');

    try {
        // 1. Contar canjes sin precio_al_canje
        const canjesSinPrecio = await Canje.count({
            where: {
                precio_al_canje: null
            }
        });

        if (canjesSinPrecio === 0) {
            console.log('✅ No hay canjes pendientes de actualizar. Todos tienen precio_al_canje.');
            return;
        }

        console.log(`📊 Total de canjes a actualizar: ${canjesSinPrecio}`);
        console.log(`📦 Procesando en lotes de ${BATCH_SIZE}...\n`);

        let offset = 0;
        let totalActualizados = 0;
        let totalErrores = 0;

        // 2. Procesar en lotes
        while (offset < canjesSinPrecio) {
            const transaction = await sequelize.transaction();
            
            try {
                // Obtener lote de canjes sin precio
                const canjesLote = await Canje.findAll({
                    where: { precio_al_canje: null },
                    include: [{ model: Producto, attributes: ['id', 'nombre', 'precio'] }],
                    limit: BATCH_SIZE,
                    offset,
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });

                if (canjesLote.length === 0) {
                    await transaction.rollback();
                    break;
                }

                console.log(`⚙️  Procesando lote ${Math.floor(offset / BATCH_SIZE) + 1} (${canjesLote.length} canjes)...`);

                // Actualizar cada canje del lote
                for (const canje of canjesLote) {
                    try {
                        if (!canje.Producto) {
                            console.warn(`   ⚠️  Canje #${canje.id}: Producto no encontrado (producto_id: ${canje.producto_id})`);
                            // Asignar 0 para canjes con productos eliminados
                            await canje.update({ precio_al_canje: 0 }, { transaction });
                            totalErrores++;
                            continue;
                        }

                        const precioActual = canje.Producto.precio;
                        await canje.update({ precio_al_canje: precioActual }, { transaction });
                        totalActualizados++;

                    } catch (error) {
                        console.error(`   ❌ Error procesando canje #${canje.id}:`, error.message);
                        totalErrores++;
                    }
                }

                await transaction.commit();
                console.log(`   ✅ Lote completado: ${canjesLote.length} canjes procesados\n`);

                offset += BATCH_SIZE;

            } catch (error) {
                await transaction.rollback();
                console.error(`❌ Error en lote (offset ${offset}):`, error.message);
                console.log('   Reintentando...\n');
                // Continuar con el siguiente lote
                offset += BATCH_SIZE;
            }
        }

        // 3. Resumen final
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN DEL BACKFILL');
        console.log('='.repeat(60));
        console.log(`✅ Canjes actualizados exitosamente: ${totalActualizados}`);
        console.log(`⚠️  Canjes con advertencias/errores:   ${totalErrores}`);
        console.log(`📈 Total procesados:                  ${totalActualizados + totalErrores}`);
        console.log('='.repeat(60));

        // 4. Verificación final
        const canjesRestantes = await Canje.count({
            where: { precio_al_canje: null }
        });

        if (canjesRestantes > 0) {
            console.log(`\n⚠️  Aún quedan ${canjesRestantes} canjes sin precio_al_canje.`);
            console.log('   Puedes volver a ejecutar este script para completar el backfill.');
        } else {
            console.log('\n🎉 ¡Backfill completado exitosamente! Todos los canjes tienen precio_al_canje.');
        }

    } catch (error) {
        console.error('\n❌ Error crítico durante el backfill:', error);
        throw error;
    } finally {
        // Cerrar conexión a la base de datos
        await sequelize.close();
    }
}

// Ejecutar script
if (require.main === module) {
    backfillPreciosCanjes()
        .then(() => {
            console.log('\n✅ Script finalizado correctamente');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script finalizado con errores:', error);
            process.exit(1);
        });
}

module.exports = { backfillPreciosCanjes };
