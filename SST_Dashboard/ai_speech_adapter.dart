import 'dart:math';

/// Simulador del Frontend (Plugin `speech_to_text`)
class SpeechRecognitionService {
  bool _isListening = false;
  
  bool get isListening => _isListening;

  Future<bool> initialize() async {
    // Simula petición de permisos de micrófono
    print('[SpeechService] Inicializando... Permisos de micrófono concedidos.');
    return true;
  }

  /// Inicia la escucha simulando la captura de audio en entorno minero
  /// Retorna un texto transcrito crudo, a menudo con un WER alto
  Future<String> listenWithSimulatedNoise() async {
    _isListening = true;
    print('[SpeechService] 🎤 Escuchando audio... (Ruido de fondo extremo detectado de 95dB)');
    
    await Future.delayed(Duration(seconds: 4)); // Simula tiempo en el que el minero dicta el problema
    
    _isListening = false;
    print('[SpeechService] ⏹️ Dictado finalizado.');
    
    // Devolvemos el string con un alto Word Error Rate (WER) por el ruido
    return "inspeccion del ventilador brrincipal recorta falla de rodamiento zierdo requiere repaso de alto";
  }
}

/// Servicio que simula la conexión con un LLM para formateo NLP
class AiParserService {
  
  /// Toma un STT "sucio" y extrae el JSON usando IA (Simulado)
  Future<Map<String, dynamic>> parseRawTextToStructuredData(String rawText, {double gpsLat = 0.0, double gpsLon = 0.0}) async {
    print('\n[AiParserService] Recibiendo texto ruidoso: "$rawText"');
    print('[AiParserService] Procesando modelo NLP para correción gramatical e inferencia industrial...');
    
    await Future.delayed(Duration(seconds: 2)); // Simula latencia LLM / procesamiento On-Device 
    
    // Aquí es donde en producción enviaríamos un prompt al LLM (ej. Gemini/Vertex)
    // para que infiera "brrincipal recorta" como "principal reporta" según el contexto minero.
    
    double confidenceScore = 0.85; 
    
    if (confidenceScore >= 0.8) {
      print('[AiParserService] ✅ Entidades inferidas con alta confianza ($confidenceScore).');
    }
    
    // Construcción del payload conforme a la tabla de reportes
    return {
      "raw_stt_transcription": rawText,
      "ai_status": "CRITICAL",
      "ai_component_failed": "Rodamiento izquierdo",
      "ai_action_required": "Reemplazo inmediato",
      "ai_confidence_score": confidenceScore,
      "gps_latitude": gpsLat,
      "gps_longitude": gpsLon,
      "digital_signature": "data:image/svg+xml;base64,PHN2ZyB4bWxucz..." // Simulando de signature_pad
    };
  }
}

// ==========================================
// Flujo completo QA: Audio -> AI -> Database
// ==========================================
void main() async {
  final speechEngine = SpeechRecognitionService();
  final aiEngine = AiParserService();
  
  await speechEngine.initialize();
  
  // 1. Minero pulsa el botón del micrófono y dicta (Offline)
  String sttResult = await speechEngine.listenWithSimulatedNoise();
  
  // 2. Transcripción errónea pasa por el filtro de Inteligencia Artificial para ser analizada (Offline model / Local LLM)
  print("\n--- INICIANDO FLUJO DE CORRECCIÓN AI ---");
  Map<String, dynamic> structuredData = await aiEngine.parseRawTextToStructuredData(
    sttResult, 
    gpsLat: -12.046374, 
    gpsLon: -77.042793
  );
  
  print('\n--- MAPA DE DATOS LISTO PARA GUARDAR EN ISAR/SQLITE ---');
  structuredData.forEach((key, value) {
    print('$key: $value');
  });
  
  // 3. Resultado final pasaría al SyncEngine de nuestro archivo anterior:
  // final engine = SyncEngine();
  // engine.saveReportOffline(structuredData);
}
