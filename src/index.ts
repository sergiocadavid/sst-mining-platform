import JSZip from 'jszip';
import { generateConsolidatedPdf, generateRawAuditPdf } from './pdf';

export interface Env {
  AI: any;
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://sst-dashboard.pages.dev",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key",
};

function handleOptions(request: Request) {
  if (
    request.headers.get("Origin") !== null &&
    request.headers.get("Access-Control-Request-Method") !== null &&
    request.headers.get("Access-Control-Request-Headers") !== null
  ) {
    return new Response(null, {
      headers: corsHeaders,
    });
  } else {
    return new Response(null, {
      headers: {
        Allow: "GET, HEAD, POST, OPTIONS",
      },
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    try {
      if (request.method === "GET" && url.pathname === "/ping-ia") {
        return new Response(JSON.stringify({ status: "ONLINE" }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (request.method === "GET" && url.pathname === "/activos") {
        const { results } = await env.DB.prepare("SELECT * FROM maestro_activos").all();
        return new Response(JSON.stringify({ data: results }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (request.method === "GET" && url.pathname === "/reports") {
        const { results } = await env.DB.prepare("SELECT * FROM sst_reports ORDER BY timestamp DESC LIMIT 15").all();
        return new Response(JSON.stringify({ data: results }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (request.method === "POST" && url.pathname === "/process-audio") {
        const formData = await request.formData();
        const audioFile = formData.get("audio");
        const assetId = formData.get("asset_id") as string | null;

        if (!audioFile || !(audioFile instanceof File)) {
          return new Response(JSON.stringify({ status: "VOID", message: "No audio file provided" }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 1. Whisper Transcription
        const audioBuffer = await audioFile.arrayBuffer();
        let transcriptResponse;
        try {
          transcriptResponse = await env.AI.run('@cf/openai/whisper', {
            audio: [...new Uint8Array(audioBuffer)],
          });
        } catch (aiError: any) {
          console.error("Cloudflare AI Whisper Error:", aiError);
          return new Response(JSON.stringify({ status: "ERROR", message: "Falla en motor AI Whisper de Cloudflare: " + aiError.message }), {
            status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const transcript = transcriptResponse.text.trim();

        if (!transcript || transcript.length < 3) {
          return new Response(JSON.stringify({ status: "VOID", message: "No se detectó voz clara" }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 2. Llama 3 Inference
        const systemPrompt = `
Eres un Analista Inspector de Seguridad Ocupacional Minera (SST). 
Te entregan esta transcripción cruda de un mensaje por radio: "${transcript}"

Contexto adicional de tarjeta UI seleccionada: ${assetId ? assetId : 'Ninguno / Contexto Libre'}

INSTRUCCIÓN:
Eres un transcriptor de JSON puro. NO agregues ni una sola palabra de texto o explicación al inicio ni al final.
Lee la transcripción y extrae los activos mencionados estructurándolos en el JSON exacto.

REGLAS DE RECONOCIMIENTO Y TRADUCCIÓN (Entidades Independientes):
PROHIBIDO fusionar equipos o agruparlos en la misma celda. 'Sensor Electrónico Multigas' y 'Extractor de Aire Viciado' son ENTIDADES INDEPENDIENTES. 
Si el dictamen de un equipo es incompleto, devuelve 'estado': 'OK' y 'accion': 'Sin datos audibles', pero NO lo omitas de la tabla.
- Si detecta 'Estrintor PQE' o 'estrintor' o 'pecuese', DEBE mapearlo a 'EXT-PQS Extintor PQS 12Kg'.
- Si detecta 'visión funcionando' o 'extractor', DEBE mapearlo a 'Extractor de Aire Viciado'.
- Si detecta 'Ventilador Principal' o 'Ventilador Secundario', debe extraerlos como equipos diferentes.
- Si detecta 'Sensor Electrónico' o 'Sensor', mapearlo a 'Sensor Electrónico Multigas'.

REGLAS DE ESTADO:
- Si el equipo está 'con fallas', su estado DEBE ser estrictamente 'CRITICAL'.
- Si el equipo está 'funcionando correctamente' o no reporta avería, su estado DEBE ser 'OK'.
- El estado sólo puede ser: CRITICAL, ALERTA, MANTENIMIENTO, OK.

DEVUELVE OBLIGATORIAMENTE UN OBJETO JSON con la raíz "hallazgos" conteniendo un array. Ejemplo exacto:
{
  "hallazgos": [
    { "activo": "EXT-PQS Extintor PQS 12Kg", "estado": "OK", "componente": "N/A", "accion": "Sin datos audibles" }
  ]
}
`;

        const llamaResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: "system", content: systemPrompt }
          ]
        });

        let aiText = llamaResponse.response;
        // Clean markdown blocks if any
        if (aiText.includes("\`\`\`json")) {
            aiText = aiText.split("\`\`\`json")[1].split("\`\`\`")[0].trim();
        } else if (aiText.includes("\`\`\`")) {
            aiText = aiText.split("\`\`\`")[1].split("\`\`\`")[0].trim();
        }

        try {
          const parsed = JSON.parse(aiText);
          let arrItems = parsed.hallazgos || [parsed];
          if (!Array.isArray(arrItems)) arrItems = [arrItems];

          let items = [];
          for (let p of arrItems) {
            let status = (p.estado || p.status || "OK").toUpperCase();
            if (!["CRITICAL", "ALERTA", "MANTENIMIENTO", "OK"].includes(status)) status = "ALERTA";

            items.push({
              equipment: p.activo || p.equipment || assetId || "Pendiente de Mapeo",
              status: status,
              component_failed: p.componente || p.component_failed || "Componente Indefinido",
              action_required: p.accion || p.action_required || "Curado Automático",
              raw_stt_transcription: transcript,
              confidence_score: 0.99
            });
          }

          return new Response(JSON.stringify({
            status: "SUCCESS",
            items,
            raw_stt_transcription: transcript
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });

        } catch (e) {
          console.error("Failed to parse Llama 3 JSON:", aiText);
          return new Response(JSON.stringify({
            status: "OFFLINE",
            items: [{
                equipment: assetId || "Reporte en Bruto",
                status: "PENDIENTE",
                component_failed: "Dictado Original",
                action_required: transcript,
                raw_stt_transcription: transcript,
                confidence_score: 0.50
            }]
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }

      if (request.method === "POST" && url.pathname === "/sync-reports") {
        const idempotencyKey = request.headers.get("x-idempotency-key");
        if (!idempotencyKey) {
            return new Response("Missing X-Idempotency-Key", { status: 400, headers: corsHeaders });
        }

        const payload = await request.json() as { items: any[] };
        const shiftId = `TURN-${Date.now()}`;
        
        // Save to DB
        let savedCount = 0;
        const stmt = env.DB.prepare(
            `INSERT INTO sst_reports (id, equipment_name, raw_stt_transcription, ai_status, ai_action_required, ai_component_failed, confidence, gps_lat, gps_lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        const batch = [];
        for (let rep of payload.items) {
            const repId = `INS-${shiftId}-${savedCount}`;
            batch.push(stmt.bind(
                repId, rep.equipment, rep.raw_stt_transcription, rep.status, rep.action_required, rep.component_failed, rep.confidence_score || 0.0, rep.gps_latitude || 0.0, rep.gps_longitude || 0.0
            ));
            savedCount++;
        }
        
        try {
            await env.DB.batch(batch);
        } catch(e) {
            console.error("Error inserting batch", e);
            // Ignoramos integridad y continuamos
        }

        // Generate PDFs
        const execPdfBuffer = await generateConsolidatedPdf(shiftId, payload.items);
        const rawPdfBuffer = await generateRawAuditPdf(shiftId, payload.items);

        // ZIP them
        const zip = new JSZip();
        zip.file(`Informe_Ejecutivo_${shiftId}.pdf`, execPdfBuffer);
        zip.file(`Anexo_Transcripcion_Literal_${shiftId}.pdf`, rawPdfBuffer);
        const zipData = await zip.generateAsync({ type: 'uint8array' });

        return new Response(zipData, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="Auditoria_Minera_${shiftId}.zip"`,
                "X-Idempotency-Key": idempotencyKey,
                ...corsHeaders
            }
        });
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });

    } catch (err: any) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
  },
};
