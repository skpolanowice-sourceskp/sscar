-- SSCAR – rezerwacje: rozszerzenie panelu (baza klientów).
-- Import w phpMyAdmin (vh.pl) na tej samej bazie co rez_bookings.
-- Bezpieczne do wielokrotnego uruchomienia (IF NOT EXISTS / IGNORE).

-- Profil klienta (klucz = znormalizowany telefon: ostatnie 9 cyfr).
CREATE TABLE IF NOT EXISTS rez_clients (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    phone_norm     VARCHAR(20)  NOT NULL,
    phone_display  VARCHAR(40)  NOT NULL,
    name           VARCHAR(120) DEFAULT NULL,
    email          VARCHAR(160) DEFAULT NULL,
    notes          TEXT         DEFAULT NULL,
    blocked        TINYINT(1)   NOT NULL DEFAULT 0,
    blocked_reason VARCHAR(255) DEFAULT NULL,
    blocked_at     DATETIME     DEFAULT NULL,
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_phone (phone_norm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pojazdy klienta (auta pod danym numerem).
CREATE TABLE IF NOT EXISTS rez_client_vehicles (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    client_id  INT NOT NULL,
    plate      VARCHAR(20) NOT NULL,
    vehicle    VARCHAR(80) DEFAULT NULL,
    last_seen  DATETIME    DEFAULT NULL,
    UNIQUE KEY uniq_client_plate (client_id, plate),
    KEY idx_plate (plate),
    CONSTRAINT fk_vehicle_client FOREIGN KEY (client_id) REFERENCES rez_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Powiązanie rezerwacji z profilem klienta.
-- (Uruchom, jeśli kolumna jeszcze nie istnieje – MySQL zgłosi błąd przy powtórce,
--  można go zignorować.)
ALTER TABLE rez_bookings ADD COLUMN client_id INT DEFAULT NULL;
ALTER TABLE rez_bookings ADD KEY idx_client (client_id);
