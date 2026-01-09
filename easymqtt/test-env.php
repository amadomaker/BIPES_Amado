<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

$publisherUrl = getenv('PUBLISHER_URL');
$currentHost = $_SERVER['HTTP_HOST'] ?? 'unknown';

echo json_encode([
    'PUBLISHER_URL' => $publisherUrl,
    'HOST' => $currentHost,
    'all_env' => [
        'PUBLISHER_URL' => $publisherUrl ?: 'NOT_SET'
    ]
]);