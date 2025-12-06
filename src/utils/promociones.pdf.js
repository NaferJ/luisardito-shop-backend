const PDFDocument = require('pdfkit');

/**
 * Generar PDF con reporte de promociones
 * @param {Array} promociones - Array de promociones con datos agregados
 * @returns {Promise<Buffer>} - Buffer del PDF generado
 */
async function generarPDFPromociones(promociones) {
    return new Promise((resolve, reject) => {
        try {
            console.log(`[PDF Generator] Generando PDF con ${promociones.length} promociones`);
            
            const doc = new PDFDocument({ 
                size: 'A4', 
                margin: 50,
                bufferPages: false  // Desactivado para evitar problemas de paginación
            });
            
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            doc.on('error', reject);

            // ========================================
            // ENCABEZADO
            // ========================================
            doc.fontSize(24)
               .font('Helvetica-Bold')
               .text('Reporte de Promociones', { align: 'center' });
            
            doc.moveDown(0.5);
            doc.fontSize(10)
               .font('Helvetica')
               .text(`Generado el: ${new Date().toLocaleString('es-MX')}`, { align: 'center' });
            
            doc.moveDown(1);
            
            // Línea separadora
            doc.moveTo(50, doc.y)
               .lineTo(550, doc.y)
               .stroke();
            
            doc.moveDown(1);

            // ========================================
            // RESUMEN GENERAL
            // ========================================
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('Resumen General', { underline: true });
            
            doc.moveDown(0.5);

            const totalPromociones = promociones.length;
            const promocionesActivas = promociones.filter(p => p.estado === 'activo').length;
            const promocionesProgramadas = promociones.filter(p => p.estado === 'programado').length;
            const promocionesExpiradas = promociones.filter(p => p.estado === 'expirado').length;

            let totalUsos = 0;
            let totalPuntosDescontados = 0;

            promociones.forEach(promo => {
                const usos = parseInt(promo.total_usos) || 0;
                const puntos = parseInt(promo.puntos_descontados) || 0;
                totalUsos += usos;
                totalPuntosDescontados += puntos;
            });

            doc.fontSize(10)
               .font('Helvetica')
               .text(`Total de promociones: ${totalPromociones}`, { continued: false })
               .text(`  • Activas: ${promocionesActivas}`, { indent: 20 })
               .text(`  • Programadas: ${promocionesProgramadas}`, { indent: 20 })
               .text(`  • Expiradas: ${promocionesExpiradas}`, { indent: 20 })
               .moveDown(0.5)
               .text(`Usos totales: ${totalUsos.toLocaleString('es-MX')}`)
               .text(`Puntos descontados: ${totalPuntosDescontados.toLocaleString('es-MX')} pts`);

            doc.moveDown(1.5);

            // ========================================
            // TABLA DE PROMOCIONES
            // ========================================
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('Detalle de Promociones', { underline: true });
            
            doc.moveDown(0.5);

            console.log(`[PDF Generator] Promociones a procesar: ${promociones.length}`);
            
            if (promociones.length === 0) {
                console.log('[PDF Generator] No hay promociones - mostrando mensaje');
                doc.fontSize(10)
                   .font('Helvetica-Oblique')
                   .text('No hay promociones para mostrar.', { align: 'center' });
            } else {
                console.log('[PDF Generator] Renderizando tabla de promociones');
                // Encabezados de la tabla
                const tableTop = doc.y;
                const col1 = 50;
                const col2 = 200;
                const col3 = 320;
                const col4 = 400;
                const col5 = 480;
                const rowHeight = 20;

                doc.fontSize(9)
                   .font('Helvetica-Bold')
                   .text('Promoción', col1, tableTop)
                   .text('Estado', col2, tableTop)
                   .text('Descuento', col3, tableTop)
                   .text('Usos', col4, tableTop)
                   .text('Pts Desc.', col5, tableTop);

                // Línea debajo de encabezados
                doc.moveTo(col1, tableTop + 12)
                   .lineTo(550, tableTop + 12)
                   .stroke();

                let currentY = tableTop + 18;

                // Contenido de la tabla
                console.log(`[PDF Generator] Iterando sobre ${promociones.length} promociones`);
                promociones.forEach((promo, index) => {
                    console.log(`[PDF Generator] Procesando promoción ${index + 1}: ${promo.titulo || promo.nombre}`);
                    // Verificar si necesitamos una nueva página
                    if (currentY > 720) {
                        doc.addPage();
                        currentY = 50;
                        
                        // Re-dibujar encabezados
                        doc.fontSize(9)
                           .font('Helvetica-Bold')
                           .text('Promoción', col1, currentY)
                           .text('Estado', col2, currentY)
                           .text('Descuento', col3, currentY)
                           .text('Usos', col4, currentY)
                           .text('Pts Desc.', col5, currentY);
                        
                        doc.moveTo(col1, currentY + 12)
                           .lineTo(550, currentY + 12)
                           .stroke();
                        
                        currentY += 18;
                    }

                    const nombre = promo.titulo || promo.nombre || 'Sin título';
                    const estado = promo.estado || 'N/A';
                    const tipoDesc = promo.tipo_descuento || 'N/A';
                    const valorDesc = promo.valor_descuento || 0;
                    const usos = parseInt(promo.total_usos) || 0;
                    const puntosDesc = parseInt(promo.puntos_descontados) || 0;

                    // Determinar color según estado
                    let estadoColor = '#000000';
                    if (estado === 'activo') estadoColor = '#27ae60';
                    else if (estado === 'programado') estadoColor = '#f39c12';
                    else if (estado === 'expirado') estadoColor = '#e74c3c';

                    doc.fontSize(8)
                       .font('Helvetica')
                       .fillColor('#000000')
                       .text(nombre.substring(0, 25), col1, currentY, { width: 140, ellipsis: true });

                    doc.fillColor(estadoColor)
                       .text(estado, col2, currentY);

                    doc.fillColor('#000000');
                    const descuentoTexto = tipoDesc === 'porcentaje' 
                        ? `${valorDesc}%` 
                        : tipoDesc === 'fijo' 
                        ? `${valorDesc} pts` 
                        : tipoDesc;
                    doc.text(descuentoTexto, col3, currentY);

                    doc.text(usos.toString(), col4, currentY);
                    doc.text(puntosDesc.toLocaleString('es-MX'), col5, currentY);

                    currentY += rowHeight;

                    // Línea divisoria entre filas
                    if (index < promociones.length - 1) {
                        doc.moveTo(col1, currentY - 2)
                           .lineTo(550, currentY - 2)
                           .strokeColor('#CCCCCC')
                           .lineWidth(0.5)
                           .stroke()
                           .strokeColor('#000000')
                           .lineWidth(1);
                    }
                });

                // Línea final de la tabla
                doc.moveTo(col1, currentY)
                   .lineTo(550, currentY)
                   .stroke();
            }

            // ========================================
            // PIE DE PÁGINA - Usar moveTo para posicionar sin crear página
            // ========================================
            const footerY = doc.page.height - 50;
            
            doc.fontSize(8)
               .font('Helvetica-Oblique')
               .fillColor('#999999');
            
            doc.text(
                'Luisardito Shop - Sistema de Promociones',
                50,
                footerY,
                { 
                    align: 'center',
                    width: 495,
                    continued: false
                }
            );

            console.log('[PDF Generator] PDF finalizado correctamente');
            // Finalizar documento
            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = generarPDFPromociones;
