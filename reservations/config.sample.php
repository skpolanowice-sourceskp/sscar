<?php
/**
 * SSCAR – rezerwacje: konfiguracja (SZABLON).
 *
 * 1. Skopiuj ten plik jako  config.php  (config.php NIE trafia do repo).
 * 2. Uzupełnij wartości poniżej.
 * 3. Plik klucza service-account trzymaj POZA katalogiem WWW (public_html),
 *    np. /home/USER/sscar-secrets/service-account.json
 *
 * Patrz: README-rezerwacja-setup.md
 */

return [

    // --- Baza MySQL (z panelu vh.pl) ---
    'db' => [
        'host'    => 'localhost',
        'name'    => 'NAZWA_BAZY',
        'user'    => 'UZYTKOWNIK',
        'pass'    => 'HASLO',
        'charset' => 'utf8mb4',
    ],

    // --- Klucz konta usługowego Google (ścieżka ABSOLUTNA, poza webrootem) ---
    'service_account_key' => '/home/USER/sscar-secrets/service-account.json',

    // --- ID wspólnego kalendarza Google (jeden pracownik = jeden grafik) ---
    // (Ustawienia kalendarza → "Integracja kalendarza" → Identyfikator kalendarza)
    'calendar_id' => 'xxxxxxxx@group.calendar.google.com',

    'timezone' => 'Europe/Warsaw',

    // --- Powiadomienia e-mail (opcjonalnie; puste = wyłączone) ---
    'notify_email' => 'stacja@sscar.pl',     // dokąd przychodzi info o nowej rezerwacji
    'from_email'   => 'no-reply@sscar.pl',   // nadawca (najlepiej adres w domenie sscar.pl)
    'send_customer_confirmation' => true,    // wyślij potwierdzenie klientowi (jeśli podał e-mail)

    // --- Bezpieczeństwo ---
    'allowed_origin' => 'https://www.sscar.pl', // dozwolone źródło zapytań
];
