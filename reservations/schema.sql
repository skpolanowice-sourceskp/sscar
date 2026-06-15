-- SSCAR – rezerwacje: tabela rezerwacji.
-- Import w phpMyAdmin (panel vh.pl) na wybranej bazie MySQL.
--
-- Jeden pracownik = jeden grafik. UNIQUE(start_dt) chroni przed dwiema
-- rezerwacjami na tę samą godzinę; nakładanie różnych długości sprawdza
-- book.php transakcyjnie (indeks na start_dt jest do tego potrzebny).

CREATE TABLE IF NOT EXISTS rez_bookings (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    resource        VARCHAR(32)  NOT NULL,
    start_dt        DATETIME     NOT NULL,
    end_dt          DATETIME     NOT NULL,
    service         VARCHAR(32)  NOT NULL,
    subtype         VARCHAR(32)  NOT NULL,
    cust_name       VARCHAR(120) NOT NULL,
    cust_phone      VARCHAR(40)  NOT NULL,
    cust_plate      VARCHAR(20)  NOT NULL,
    cust_email      VARCHAR(160) DEFAULT NULL,
    notes           TEXT         DEFAULT NULL,
    google_event_id VARCHAR(255) DEFAULT NULL,
    ref             VARCHAR(32)  DEFAULT NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_start (start_dt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
