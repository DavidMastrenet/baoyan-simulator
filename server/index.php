<?php
declare(strict_types=1);
date_default_timezone_set('Asia/Shanghai');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
ini_set('display_errors', '0');
const API_EPOCH = 'source-no-collection-20261017';
function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit();
}
function bounded($n, float $min, float $max): bool
{
    return (is_int($n) || is_float($n)) && is_finite((float) $n) && $n >= $min && $n <= $max;
}
function validState($s): bool
{
    if (
        !is_array($s) ||
        ($s['version'] ?? null) !== 1 ||
        !is_int($s['turn'] ?? null) ||
        !bounded($s['turn'], 0, 47)
    ) {
        return false;
    }
    if (!in_array($s['stage'] ?? '', ['plan', 'event', 'feedback', 'review', 'ended'], true)) {
        return false;
    }
    foreach (
        [
            'profile',
            'stats',
            'flags',
            'visited',
            'log',
            'applications',
            'semesters',
            'pendingCourses',
        ]
        as $field
    ) {
        if (!is_array($s[$field] ?? null)) {
            return false;
        }
    }
    foreach (
        [
            'study',
            'research',
            'english',
            'craft',
            'practice',
            'expression',
            'network',
            'energy',
            'stress',
            'integrity',
            'materials',
            'backup',
        ]
        as $key
    ) {
        if (!bounded($s['stats'][$key] ?? null, 0, 100)) {
            return false;
        }
    }
    if (!bounded($s['stats']['money'] ?? null, 0, 999999)) {
        return false;
    }
    if (
        isset($s['profile']['nickname']) &&
        (!is_string($s['profile']['nickname']) ||
            !preg_match('/^[\p{L}\p{N}_· .-]{2,20}$/u', $s['profile']['nickname']) ||
            !preg_match('/[\p{L}\p{N}]/u', $s['profile']['nickname']))
    ) {
        return false;
    }
    return is_string($s['seed'] ?? null) && preg_match('/^[a-zA-Z0-9-]{3,40}$/', $s['seed']) === 1;
}

try {
    $path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (!preg_match('#(?:^|/)api(/.*)$#', $path, $match)) {
        respond(404, ['error' => '地址不存在']);
    }
    $route = $match[1];
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET' && $route === '/health') {
        respond(200, ['status' => 'ok', 'service' => 'share']);
    }
    $read = $method === 'GET' && preg_match('#^/share/([A-Za-z0-9_-]{24})$#', $route, $tokenMatch);
    $create = $method === 'POST' && $route === '/share';
    if (!$read && !$create) {
        respond(404, ['error' => '地址不存在']);
    }
    $root = getenv('BAOYAN_SHARE_DATA') ?: dirname(__DIR__) . '/.share-data';
    if (!is_dir($root) && !mkdir($root, 0700, true)) {
        throw new RuntimeException('storage');
    }
    $file = $root . '/shares.sqlite3';
    $db = new PDO('sqlite:' . $file, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    @chmod($file, 0600);
    $db->exec('PRAGMA busy_timeout=5000');
    $db->exec(
        'CREATE TABLE IF NOT EXISTS shares(token TEXT PRIMARY KEY,payload TEXT NOT NULL,expires INTEGER NOT NULL)',
    );
    $now = time();
    $q = $db->prepare('DELETE FROM shares WHERE expires<?');
    $q->execute([$now]);
    if ($read) {
        $q = $db->prepare('SELECT payload,expires FROM shares WHERE token=?');
        $q->execute([$tokenMatch[1]]);
        $row = $q->fetch(PDO::FETCH_ASSOC);
        if (!$row || (int) $row['expires'] <= $now) {
            respond(410, ['error' => '分享链接已过期，请重新生成']);
        }
        $payload = json_decode($row['payload'], false, 64, JSON_THROW_ON_ERROR);
        respond(200, [
            'kind' => $payload->kind,
            'state' => $payload->state,
            'expiresAt' => (int) $row['expires'] * 1000,
        ]);
    }
    $raw = (string) file_get_contents('php://input');
    try {
        $data = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        $shape = json_decode($raw, false, 64, JSON_THROW_ON_ERROR);
    } catch (Throwable $error) {
        respond(400, ['error' => '分享内容读取失败']);
    }
    if (!is_array($data) || ($data['epoch'] ?? null) !== API_EPOCH) {
        respond(409, ['error' => '请使用当前版本的游戏页面']);
    }
    $kind = $data['kind'] ?? null;
    $state = $data['state'] ?? null;
    if (
        !in_array($kind, ['progress', 'ending'], true) ||
        !validState($state) ||
        ($kind === 'ending') !== ($state['stage'] === 'ended')
    ) {
        respond(400, ['error' => '分享内容不完整']);
    }
    if ($kind === 'ending') {
        $catalog = json_decode(
            (string) file_get_contents(__DIR__ . '/ending-catalog.json'),
            true,
            64,
            JSON_THROW_ON_ERROR,
        );
        if (!isset($catalog[$state['endingId'] ?? ''])) {
            respond(400, ['error' => '结局信息不完整']);
        }
    }
    unset($shape->state->profile->nickname);
    $expires = $now + ($kind === 'progress' ? 1800 : 30 * 86400);
    $token = rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');
    $payload = json_encode(
        ['kind' => $kind, 'state' => $shape->state],
        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
    );
    $q = $db->prepare('INSERT INTO shares(token,payload,expires) VALUES(?,?,?)');
    $q->execute([$token, $payload, $expires]);
    respond(201, ['token' => $token, 'kind' => $kind, 'expiresAt' => $expires * 1000]);
} catch (Throwable $error) {
    respond(503, ['error' => '分享服务暂时不可用，请稍后重试']);
}
