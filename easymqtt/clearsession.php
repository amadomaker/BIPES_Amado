<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

// Validação do parâmetro obrigatório
if (!isset($_GET['session']) || empty($_GET['session'])) {
    echo json_encode([
        "success" => false,
        "result"  => "Invalid Parameters"
    ]);
    exit;
}

$session = htmlspecialchars($_GET["session"]);

// Pega a URI do Mongo a partir da variável de ambiente
$mongoUri = getenv('MONGO_URI');
if (!$mongoUri) {
    echo json_encode([
        "success" => false,
        "result"  => "Mongo URI is not set in environment"
    ]);
    exit;
}

$manager = new MongoDB\Driver\Manager($mongoUri);

// Comando para remover (dropar) todo o banco de dados da sessão
$cmd = new MongoDB\Driver\Command(['dropDatabase' => 1]);

try {
    $manager->executeCommand($session, $cmd);
    echo json_encode([
        "success" => true,
        "result"  => "Session '{$session}' cleaned"
    ]);
} catch (MongoDB\Driver\Exception\Exception $e) {
    echo json_encode([
        "success" => false,
        "result"  => "Error dropping session '{$session}': " . $e->getMessage()
    ]);
}
