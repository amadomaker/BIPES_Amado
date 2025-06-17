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
    // Executa o script Python de publicação
    $cmd = escapeshellcmd("python3 server/publish.py {$session}/{$topic} {$value}");
    exec($cmd, $out, $ret);

    if ($ret === 0) {
        $return = [
            "success" => true,
            "result"  => "Value '{$value}' published to topic '{$topic}' successfully!"
        ];
    } else {
        $return = [
            "success" => false,
            "result"  => "Error publishing value '{$value}' to topic '{$topic}'. " . implode("\n", $out)
        ];
    }
}

echo json_encode($return);
