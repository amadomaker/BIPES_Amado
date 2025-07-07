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
// $mongoUri = getenv('MONGO_URI');
// if (!$mongoUri) {
//     echo json_encode([
//         "success" => false,
//         "result"  => "Mongo URI is not set in environment"
//     ]);
//     exit;
// }

$mongoUri = "mongodb+srv://ti:HjrjfpzWT4cdDJqc@bipes-db.wlo1lu9.mongodb.net/?retryWrites=true&w=majority&appName=bipes-db"
$manager = new MongoDB\Driver\Manager($mongoUri);

// Comando para listar coleções (tópicos) no banco de dados da sessão
$cmdListCols = new MongoDB\Driver\Command(['listCollections' => 1]);
try {
    $cursor = $manager->executeCommand($session, $cmdListCols)->toArray();
} catch (MongoDB\Driver\Exception\Exception $e) {
    echo json_encode([
        "success" => false,
        "result"  => "Session '{$session}' not found or error listing collections."
    ]);
    exit;
}

// Extrai nomes de coleção
$topics = [];
foreach ($cursor as $colInfo) {
    $topics[] = $colInfo->name;
}

if (count($topics) > 0) {
    echo json_encode([
        "success" => true,
        "result"  => $topics
    ]);
} else {
    echo json_encode([
        "success" => false,
        "result"  => "Session '{$session}' is empty.<br /><span>As soon as something reaches the broker, it will be displayed here!</span>"
    ]);
}
