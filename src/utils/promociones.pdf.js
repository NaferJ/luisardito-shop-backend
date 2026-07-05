const PDFDocument = require('pdfkit');
const logger = require('./logger');

/**
 * Generate PDF with promotions report
 * @param {Array} promociones - Array of promotions with aggregated data
 * @returns {Promise<Buffer>} - Buffer of the generated PDF
 */
async function generarPDFPromociones(promociones) {
    return new Promise((resolve, reject) => {
        try {
            logger.info(`[PDF Generator] Generating PDF with ${promociones.length} promotions`);
            
            const doc = new PDFDocument({ 
                size: 'A4', 
                margin: 50,
                bufferPages: false  // Disabled to avoid pagination issues
            });
            
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            doc.on('error', reject);

            // ========================================
            // HEADER
            // ========================================
            doc.fontSize(24)
               .font('Helvetica-Bold')
               .text('Promotions Report', { align: 'center' });
            
            doc.moveDown(0.5);
            doc.fontSize(10)
               .font('Helvetica')
               .text(`Generated on: ${new Date().toLocaleString('es-MX')}`, { align: 'center' });
            
            doc.moveDown(1);
            
            // Separator line
            doc.moveTo(50, doc.y)
               .lineTo(550, doc.y)
               .stroke();
            
            doc.moveDown(1);

            // ========================================
            // GENERAL SUMMARY
            // ========================================
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('General Summary', { underline: true });
            
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
               .text(`Total promotions: ${totalPromociones}`, { continued: false })
               .text(`Total promotions: ${totalPromociones}`, { continued: false })
               .text(`  - Active: ${promocionesActivas}`, { indent: 20 })
               .text(`  - Scheduled: ${promocionesProgramadas}`, { indent: 20 })
               .text(`  - Expired: ${promocionesExpiradas}`, { indent: 20 })
               .text(`Total uses: ${totalUsos.toLocaleString('es-MX')}`)
               .text(`Points deducted: ${totalPuntosDescontados.toLocaleString('es-MX')} pts`);

            doc.moveDown(1.5);

            // ========================================
            // PROMOTIONS TABLE
            // ========================================
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('Promotions Detail', { underline: true });
            
            doc.moveDown(0.5);

            logger.info(`[PDF Generator] Promotions to process: ${promociones.length}`);
            
            if (promociones.length === 0) {
            logger.info('[PDF Generator] No promotions - showing message');
                doc.fontSize(10)
                   .font('Helvetica-Oblique')
                   .text('No promotions to display.', { align: 'center' });
            } else {
            logger.info('[PDF Generator] Rendering promotions table');
                // Table headers
                const tableTop = doc.y;
                const col1 = 50;
                const col2 = 200;
                const col3 = 320;
                const col4 = 400;
                const col5 = 480;
                const rowHeight = 20;

                doc.fontSize(9)
                   .font('Helvetica-Bold')
                   .text('Promotion', col1, tableTop)
                   .text('Estado', col2, tableTop)
                   .text('Discount', col3, tableTop)
                   .text('Usos', col4, tableTop)
                   .text('Pts Deducted', col5, tableTop);

            // Separator line
                doc.moveTo(col1, tableTop + 12)
                   .lineTo(550, tableTop + 12)
                   .stroke();

                let currentY = tableTop + 18;

                // Table content
            logger.debug(`[PDF Generator] Iterating over ${promociones.length} promotions`);
                promociones.forEach((promo, index) => {
                    logger.debug(`[PDF Generator] Processing promotion ${index + 1}: ${promo.titulo || promo.nombre}`);
                    // Check if we need a new page
                    if (currentY > 720) {
                        doc.addPage();
                        currentY = 50;
                        
                        // Redraw headers
                        doc.fontSize(9)
                           .font('Helvetica-Bold')
                   .text('Promotion', col1, tableTop)
                           .text('Estado', col2, currentY)
                           .text('Discount', col3, currentY)
                           .text('Usos', col4, currentY)
                           .text('Pts Deducted', col5, currentY);
                        
                        doc.moveTo(col1, currentY + 12)
                           .lineTo(550, currentY + 12)
                           .stroke();
                        
                        currentY += 18;
                    }

                    const nombre = promo.titulo || promo.nombre || 'Untitled';
                    const estado = promo.estado || 'N/A';
                    const tipoDesc = promo.tipo_descuento || 'N/A';
                    const valorDesc = promo.valor_descuento || 0;
                    const usos = parseInt(promo.total_usos) || 0;
                    const puntosDesc = parseInt(promo.puntos_descontados) || 0;

                    // Determine color based on status
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

            // Separator line
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

            // Separator line
                doc.moveTo(col1, currentY)
                   .lineTo(550, currentY)
                   .stroke();
            }

            // ========================================
            // FOOTER - Use moveTo to position without creating a page
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

            logger.info('[PDF Generator] PDF completed successfully');
            // End document
            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = generarPDFPromociones;
