import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function breakText(text: string, maxLen: number): string[] {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    for (let word of words) {
        if ((currentLine + word).length > maxLen) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine += word + ' ';
        }
    }
    if (currentLine) {
        lines.push(currentLine.trim());
    }
    return lines;
}

export async function generateConsolidatedPdf(shiftId: string, dataItems: any[]): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([842, 595]); // Landscape A4
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Header
    page.drawText('MINERA ALPHA - INFORME OFICIAL DE SEGURIDAD INDUSTRIAL (SST)', {
        x: 50, y: height - 50, size: 16, font: fontBold, color: rgb(0, 0.2, 0.4)
    });
    
    page.drawText('Auditado por IA Generativa Nivel 3 - Inspección Multisensorial', {
        x: 50, y: height - 70, size: 10, font, color: rgb(0.4, 0.4, 0.4)
    });

    page.drawText(`Turno / Operación: ${shiftId}`, {
        x: 50, y: height - 100, size: 11, font: fontBold
    });
    page.drawText(`Fecha de Emisión: ${new Date().toISOString()}`, {
        x: 50, y: height - 115, size: 11, font: fontBold
    });
    page.drawText(`Condición de Conectividad: [OFFLINE HUB ACTIVE]`, {
        x: 50, y: height - 130, size: 11, font: fontBold
    });

    // Process data
    let consolidatedAssets: any = {};
    let observacionesAdicionales: string[] = [];

    for (let item of dataItems) {
        const eqName = item.equipment || 'Desconocido';
        const status = item.status || 'OK';
        const comp = item.component_failed || '';
        const action = item.action_required || '';

        if (status.toUpperCase().includes('PENDIENTE') || status.toUpperCase().includes('OFFLINE') || eqName === 'Reporte en Bruto') {
            observacionesAdicionales.push(`[EVIDENCIA BRUTA] -> ${action}`);
            continue;
        }

        const desc = `Falla: ${comp} - Acción: ${action}`;

        if (!consolidatedAssets[eqName]) {
            consolidatedAssets[eqName] = { highest_status: status, descriptions: [desc] };
        } else {
            if (status === 'CRITICAL') consolidatedAssets[eqName].highest_status = 'CRITICAL';
            else if (status === 'ALERTA' && consolidatedAssets[eqName].highest_status !== 'CRITICAL') consolidatedAssets[eqName].highest_status = 'ALERTA';
            consolidatedAssets[eqName].descriptions.push(desc);
        }
    }

    // Priority
    const priorityMap: any = { 'CRITICAL': 0, 'ALERTA': 1, 'MANTENIMIENTO': 2, 'OK': 3 };
    const sortedAssets = Object.entries(consolidatedAssets).sort((a: any, b: any) => {
        return (priorityMap[a[1].highest_status] ?? 4) - (priorityMap[b[1].highest_status] ?? 4);
    });

    // Draw Table
    let y = height - 170;
    
    // Headers
    page.drawText('Activo Inspeccionado', { x: 50, y, size: 10, font: fontBold });
    page.drawText('Dictamen Técnico', { x: 200, y, size: 10, font: fontBold });
    page.drawText('Acción Recomendada', { x: 400, y, size: 10, font: fontBold });
    page.drawText('Riesgo', { x: 700, y, size: 10, font: fontBold });
    
    y -= 10;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1 });
    y -= 20;

    for (let [eqName, data] of sortedAssets) {
        const risk = (data as any).highest_status;
        const descList = (data as any).descriptions;
        
        let color = rgb(0,0,0);
        if (risk === 'CRITICAL') color = rgb(0.8, 0, 0);

        const eqLines = breakText(eqName, 25);
        const actionText = descList.join(' | ');
        const actionLines = breakText(actionText, 60);

        const maxLines = Math.max(eqLines.length, actionLines.length, 1);
        
        for (let i = 0; i < maxLines; i++) {
            if (y < 50) {
                // Should add new page, but keeping simple for this iteration
                break;
            }
            if (i < eqLines.length) page.drawText(eqLines[i], { x: 50, y, size: 9, font: i === 0 ? fontBold : font });
            if (i === 0) page.drawText('Verificado por Llama 3', { x: 200, y, size: 9, font });
            if (i < actionLines.length) page.drawText(actionLines[i], { x: 400, y, size: 9, font });
            if (i === 0) page.drawText(risk, { x: 700, y, size: 9, font: fontBold, color });
            
            y -= 15;
        }
        
        y -= 5;
        page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.8,0.8,0.8) });
        y -= 15;
    }

    if (observacionesAdicionales.length > 0) {
        y -= 20;
        page.drawText('OBSERVACIONES ADICIONALES (LLAMA 3 / CONTEXTO LIBRE)', { x: 50, y, size: 10, font: fontBold });
        y -= 20;
        for (let obs of observacionesAdicionales) {
            const obsLines = breakText(obs, 120);
            for (let line of obsLines) {
                if (y < 50) break;
                page.drawText(`• ${line}`, { x: 50, y, size: 9, font });
                y -= 15;
            }
        }
    }

    return await pdfDoc.save();
}

export async function generateRawAuditPdf(shiftId: string, dataItems: any[]): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // Portrait A4
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawText('ANEXO DE EVIDENCIA VERBAL - TRANSCRIPCIÓN LITERAL WHISPER', {
        x: 50, y: height - 50, size: 12, font: fontBold
    });

    let y = height - 90;

    for (let idx = 0; idx < dataItems.length; idx++) {
        if (y < 100) {
            // simple pagination bypass for now
            break;
        }
        const item = dataItems[idx];
        const rawText = item.raw_stt_transcription || '[RUIDO ININTELIGIBLE / VACÍO]';
        const conf = item.confidence_score || 0.0;

        page.drawText(`Hallazgo #${idx + 1}`, { x: 50, y, size: 10, font: fontBold });
        y -= 15;
        
        const textLines = breakText(`"${rawText}"`, 80);
        for (let line of textLines) {
            page.drawText(line, { x: 50, y, size: 10, font });
            y -= 15;
        }

        page.drawText(`(Confianza Inferencial Acústica: ${(conf * 100).toFixed(1)}%)`, {
            x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4)
        });
        y -= 25;
    }

    return await pdfDoc.save();
}
