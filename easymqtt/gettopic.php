<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

// Validação dos parâmetros obrigatórios
if (
    !isset($_GET['session']) || empty($_GET['session']) ||
    !isset($_GET['topic'])   || empty($_GET['topic'])
) {
    echo json_encode([
        "success" => false,
        "result"  => "Invalid Parameters"
    ]);
    exit;
}

// Sanitização
$session = htmlspecialchars($_GET["session"]);
$topic   = htmlspecialchars($_GET["topic"]);

// Pega as variáveis de ambiente
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

// Montagem do filtro "since", se fornecido
$filter = [];
if (isset($_GET["since"]) && $_GET["since"] !== "") {
    $since = intval($_GET["since"]);
    $filter['timestamp'] = ['$gte' => $since];
}

// Executa a query
$query   = new MongoDB\Driver\Query($filter, ['sort' => ['timestamp' => 1]]);
$cursor  = $manager->executeQuery("{$session}.{$topic}", $query);

// Formata o resultado
$values = [];
foreach ($cursor as $item) {
    $values[] = [
        "timestamp" => $item->timestamp,
        "data"      => $item->data
    ];
}

// Retorna JSON
echo json_encode([
    "success" => true,
    "result"  => $values
]);
