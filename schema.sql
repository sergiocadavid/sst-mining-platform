DROP TABLE IF EXISTS sst_reports;
DROP TABLE IF EXISTS maestro_activos;

CREATE TABLE sst_reports (
    id TEXT PRIMARY KEY, 
    equipment_name TEXT, 
    raw_stt_transcription TEXT, 
    ai_status TEXT, 
    ai_action_required TEXT, 
    ai_component_failed TEXT, 
    confidence REAL, 
    gps_lat REAL, 
    gps_lng REAL, 
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE maestro_activos (
    ID_unico TEXT PRIMARY KEY,
    Tipo_Activo TEXT NOT NULL,
    Ubicacion_Exacta TEXT NOT NULL,
    Ultima_Fecha_Inspeccion DATE NOT NULL,
    Estado_Actual TEXT DEFAULT 'OPERATIVO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO maestro_activos (ID_unico, Tipo_Activo, Ubicacion_Exacta, Ultima_Fecha_Inspeccion, Estado_Actual) VALUES
('EX-001', 'Extintor PQS 12Kg', 'Zona Norte - Bocamina', '2023-09-15', 'OPERATIVO'),
('EX-002', 'Extintor CO2 9Kg', 'Taller de Mantenimiento Mecánico', '2023-10-02', 'OPERATIVO'),
('EX-003', 'Extintor PQS 50Kg (Carretilla)', 'Refugio Minero Nivel 1', '2023-11-20', 'REVISION'),
('V-01', 'Ventilador Principal 500HP', 'Galería Principal', '2023-12-05', 'OPERATIVO'),
('V-02', 'Ventilador Secundario Axial', 'Nivel 3', '2023-11-15', 'OPERATIVO'),
('V-03', 'Extractor de Aire Viciado', 'Chimenea de Ventilación 4A', '2024-01-10', 'MANTENIMIENTO'),
('S-GAS-05', 'Sensor Electrónico Multigas (CH4/CO)', 'Frente de avance - Crucero Sur', '2024-02-14', 'OPERATIVO'),
('S-TEMP-01', 'Termohigrómetro Industrial', 'Cuarto de Tableros Eléctricos', '2024-02-01', 'OPERATIVO'),
('FAJA-A1', 'Faja Transportadora Estructural', 'Galería de Extracción hacia Chancadora', '2024-01-20', 'OPERATIVO'),
('SCOOP-07', 'Cargador Frontal LHD (Scooptram)', 'Nivel 2 - Subnivel C', '2024-02-10', 'FALLA_MENOR'),
('LOCO-04', 'Locomotora Trolley', 'Vía Férrea Principal', '2023-12-28', 'OPERATIVO');
