<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

// Validação dos parâmetros
if (
    !isset($_GET['session']) || empty($_GET['session']) ||
    !isset($_GET['topic'])   || empty($_GET['topic'])   ||
    !isset($_GET['value'])
) {
    echo json_encode([
        "success" => false,
        "result"  => "Invalid Parameters"
    ]);
    exit;
}

// Sanitização dos parâmetros
$session = htmlspecialchars($_GET["session"]);
$topic   = htmlspecialchars($_GET["topic"]);
$value   = htmlspecialchars($_GET["value"]);

if (!is_numeric($value)) {
    $return = [
        "success" => false,
        "result"  => "Error publishing value '{$value}' to topic '{$topic}'. Non-numeric input value!"
    ];
} else {
    // Encaminha para a Cloud Function HTTP de publicação
    $publisherUrl = getenv('PUBLISHER_URL');
    if (!$publisherUrl) {
    $currentHost = $_SERVER['HTTP_HOST'] ?? '';
        if (strpos($currentHost, 'staging') !== false) {
            // Obter com: terraform output -raw publisher_url (projeto dblocks-499511)
            $publisherUrl = 'https://CONFIGURE_PUBLISHER_URL_VIA_ENV_VAR';
        } else {
            $publisherUrl = 'https://mqtt-publisher-tgtka7akja-uc.a.run.app';
        }
    }

    $url = $publisherUrl . '?session=' . urlencode($session) . '&topic=' . urlencode($topic) . '&value=' . urlencode($value);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $curlErr  = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false) {
        $return = [
            'success' => false,
            'result'  => "Error publishing value '{$value}' to topic '{$topic}'. CURL error: {$curlErr}"
        ];
    } else {
        $decoded = json_decode($response, true);
        if (is_array($decoded) && isset($decoded['success'])) {
            $return = $decoded;
        } else if ($httpCode >= 200 && $httpCode < 300) {
            $return = [
                'success' => true,
                'result'  => "Value '{$value}' published to topic '{$topic}' successfully!"
            ];
        } else {
            $return = [
                'success' => false,
                'result'  => "Error publishing value '{$value}' to topic '{$topic}'. HTTP {$httpCode}: {$response}"
            ];
        }
    }
}

echo json_encode($return);
