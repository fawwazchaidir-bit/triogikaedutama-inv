<?php
/**
 * Klien contoh API integrasi Financial Management System (skema FMS1-HMAC-SHA256) — untuk website Laravel/PHP.
 * Tanpa dependensi selain ekstensi curl & hash bawaan PHP. Spesifikasi: docs/INTEGRATION.md.
 *
 * Pakai:
 *   $c = new FmsClient('https://keuangan.example.id', 'fmsk_...', 'fmss_...');
 *   $res = $c->request('GET', '/api/integration/v1/ping');
 *   $res = $c->request('POST', '/api/integration/v1/…', ['a' => 1], 'kunci-idempotensi-unik-per-kejadian');
 */

/** Query kanonik: kodekan RFC 3986, urutkan menurut nama lalu nilai, gabung "&". */
function fms_canonical_query(array $query): string
{
    $pairs = [];
    foreach ($query as $k => $v) {
        foreach ((array) $v as $one) {
            $pairs[] = [rawurlencode((string) $k), rawurlencode((string) $one)];
        }
    }
    usort($pairs, fn ($a, $b) => [$a[0], $a[1]] <=> [$b[0], $b[1]]);
    return implode('&', array_map(fn ($p) => $p[0] . '=' . $p[1], $pairs));
}

/** Tanda tangan hex: HMAC-SHA256(secret, string kanonik). $body = BADAN MENTAH persis yang dikirim. */
function fms_sign(string $secret, string $method, string $path, array $query, string $timestamp, string $nonce, string $body = ''): string
{
    $canonical = implode("\n", [
        'FMS1-HMAC-SHA256', strtoupper($method), $path, fms_canonical_query($query), $timestamp, $nonce, hash('sha256', $body),
    ]);
    return hash_hmac('sha256', $canonical, $secret);
}

final class FmsClient
{
    public function __construct(private string $baseUrl, private string $keyId, private string $secret, private int $timeout = 15) {}

    /** @return array{status:int, body:mixed, headers:array} */
    public function request(string $method, string $path, ?array $json = null, ?string $idempotencyKey = null, array $query = []): array
    {
        $method = strtoupper($method);
        $body = $json === null ? '' : json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $timestamp = (string) time();
        $nonce = bin2hex(random_bytes(16));
        $headers = [
            'X-FMS-Key: ' . $this->keyId,
            'X-FMS-Timestamp: ' . $timestamp,
            'X-FMS-Nonce: ' . $nonce,
            'X-FMS-Signature: ' . fms_sign($this->secret, $method, $path, $query, $timestamp, $nonce, $body),
            'Accept: application/json',
        ];
        if ($method !== 'GET') {
            if ($idempotencyKey === null) {
                throw new InvalidArgumentException('Idempotency-Key wajib untuk permintaan selain GET.');
            }
            $headers[] = 'Idempotency-Key: ' . $idempotencyKey;
            $headers[] = 'Content-Type: application/json';
        }
        $qs = fms_canonical_query($query); // kirim query dalam bentuk kanonik agar sama persis dengan yang ditandatangani
        $ch = curl_init(rtrim($this->baseUrl, '/') . $path . ($qs !== '' ? '?' . $qs : ''));
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout, CURLOPT_HEADER => true, CURLOPT_FOLLOWLOCATION => false,
        ]);
        if ($method !== 'GET') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        $raw = curl_exec($ch);
        if ($raw === false) {
            throw new RuntimeException('Koneksi ke sistem keuangan gagal: ' . curl_error($ch));
        }
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        $respHeaders = [];
        foreach (explode("\r\n", substr($raw, 0, $headerSize)) as $line) {
            if (str_contains($line, ':')) {
                [$k, $v] = explode(':', $line, 2);
                $respHeaders[strtolower(trim($k))] = trim($v);
            }
        }
        return ['status' => $status, 'body' => json_decode(substr($raw, $headerSize), true), 'headers' => $respHeaders];
    }
}
