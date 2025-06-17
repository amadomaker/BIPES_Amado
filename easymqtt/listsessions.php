<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

// 1) Conexão direta ao MongoDB via Driver nativo
$manager = new MongoDB\Driver\Manager("mongodb://mongo:27017");

// 2) Comando para listar bancos de dados
$cmdListDBs = new MongoDB\Driver\Command(['listDatabases' => 1]);
$dbList = $manager->executeCommand('admin', $cmdListDBs)
                  ->toArray()[0]
                  ->databases;

// 3) Itera sobre cada banco de dados, ignorando internos
$result = [];
foreach ($dbList as $dbInfo) {
    $dbName = $dbInfo->name;
    if (in_array($dbName, ['admin', 'local', 'config'])) {
        continue;
    }

    // Lista coleções (tópicos) desse banco
    $cmdListCols = new MongoDB\Driver\Command(['listCollections' => 1]);
    $colsInfo = $manager->executeCommand($dbName, $cmdListCols)
                        ->toArray();

    $totalTopics   = count($colsInfo);
    $totalMessages = 0;

    // Conta documentos em cada coleção
    foreach ($colsInfo as $col) {
        $collName = $col->name;
        $query    = new MongoDB\Driver\Query([]);
        $cursor   = $manager->executeQuery("$dbName.$collName", $query);
        // iterar para contar
        $count = 0;
        foreach ($cursor as $_) {
            $count++;
        }
        $totalMessages += $count;
    }

    $result[] = [
        "session"       => $dbName,
        "topicsCount"   => $totalTopics,
        "messagesCount" => $totalMessages
    ];
}

// 4) Retorna JSON
echo json_encode([
    "success" => true,
    "result"  => $result
]);
