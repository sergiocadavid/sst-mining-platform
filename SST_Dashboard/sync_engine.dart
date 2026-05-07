import 'dart:convert';
// import 'package:http/http.dart' as http;
// import 'package:uuid/uuid.dart';

/// Simulación del Modelo Local de Inspección
class InspectionReport {
  final String id;
  final Map<String, dynamic> aiStructuredData;
  String syncStatus; // 'PENDING', 'SYNCED', 'FAILED'
  
  // Nuevos campos para Geoposicionamiento y Firma Digital
  final double? gpsLatitude;
  final double? gpsLongitude;
  final String? digitalSignatureBase64;
  
  InspectionReport({
    required this.id, 
    required this.aiStructuredData, 
    this.syncStatus = 'PENDING',
    this.gpsLatitude,
    this.gpsLongitude,
    this.digitalSignatureBase64,
  });
}

/// SyncEngine maneja la transición Offline -> Online y viceversa
class SyncEngine {
  // Simulando Isar/SQLite storage
  List<InspectionReport> _localDatabase = [];
  
  /// Captura GPS auto y agrega el reporte como pendiente (Offline)
  Future<void> saveReportOffline(Map<String, dynamic> data) async {
    String reportId = 'mock-uuid-${DateTime.now().millisecondsSinceEpoch}';

    print('[GPS Module] Obteniendo coords satelitales del dispositivo (flutter_geolocator)...');
    await Future.delayed(Duration(milliseconds: 500)); // Simulando latencia del sensor GPS hardware
    double lat = -12.043180;
    double lon = -77.028240;

    final report = InspectionReport(
      id: reportId,
      aiStructuredData: data,
      syncStatus: 'PENDING',
      gpsLatitude: lat,
      gpsLongitude: lon,
      digitalSignatureBase64: 'base64_blank_firm_placeholder',
    );
    
    _localDatabase.add(report);
    print('[SyncEngine] Guarda reporte #$reportId localmente. Estado: PENDING');
  }
  
  /// Invocado por Event Tracker cuando ConnectivityResult cambia a Online
  Future<void> triggerSyncQueue() async {
    print('[SyncEngine] Conexión detectada. Iniciando Sync Queue...');
    
    final pendingReports = _localDatabase.where((r) => r.syncStatus == 'PENDING').toList();
    if (pendingReports.isEmpty) {
      print('[SyncEngine] Cola limpia. Nada que sincronizar.');
      return;
    }
    
    // Bloqueo Optimista: Marcar como 'SYNCING' localmente
    for (var report in pendingReports) {
      report.syncStatus = 'SYNCING';
    }

    try {
      // Agrupar en Batch
      final batchPayload = pendingReports.map((r) => r.aiStructuredData).toList();
      
      // Simulación de envío HTTP
      print('[SyncEngine] Enviando batch de ${pendingReports.length} reportes al servidor...');
      // final idempotencyKey = Uuid().v4();
      final idempotencyKey = "batch-sync-key-12345";
      
      // Simular delay y éxito de la red
      await Future.delayed(Duration(seconds: 2));
      bool success = _simulateServerResponse(batchPayload, idempotencyKey);
      
      if (success) {
        for (var report in pendingReports) {
          report.syncStatus = 'SYNCED';
        }
        print('[SyncEngine] ✅ Sincronización exitosa. Registros actualizados a SYNCED.');
      } else {
        throw Exception("Server Error 500");
      }
      
    } catch (e) {
      print('[SyncEngine] ❌ Error en subida. Restaurando estados a PENDING para reintento. ($e)');
      for (var report in pendingReports) {
        report.syncStatus = 'PENDING';
      }
    }
  }

  bool _simulateServerResponse(List<dynamic> payload, String idempotencyKey) {
    // Validando idempotencia
    print('[ServerMock] Recibido batch con Idempotency-Key: $idempotencyKey');
    return true; // Simula HTTP 201 Created
  }
  
  // Getter for inspection testing
  List<InspectionReport> get checkDb => _localDatabase;
}

// Ejemplo de uso
void main() async {
  final engine = SyncEngine();
  
  // 1. Minero bajo tierra trabajando
  engine.saveReportOffline({
    "equipment": "Ventilador Principal",
    "status": "CRITICAL"
  });
  
  engine.saveReportOffline({
    "equipment": "Faja Transportadora B",
    "status": "OK"
  });
  
  // 2. Minero sale a superficie
  await engine.triggerSyncQueue();
}
