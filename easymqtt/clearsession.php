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

// Conexão direta ao MongoDB via driver nativo
$manager = new MongoDB\Driver\Manager("mongodb://mongo:27017");

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
