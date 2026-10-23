<?php
// Helpers for the preview container, using the MYSQL* variables Railway's MySQL service provides.
//   php import-db.php wait          wait (up to ~3 min) until MySQL accepts connections
//   php import-db.php import FILE   run a mysqldump file against the database
mysqli_report(MYSQLI_REPORT_OFF);

function lfar_connect() {
    return @mysqli_connect(
        getenv('MYSQLHOST'),
        getenv('MYSQLUSER'),
        getenv('MYSQLPASSWORD'),
        getenv('MYSQLDATABASE'),
        (int) (getenv('MYSQLPORT') ?: 3306)
    );
}

$cmd = $argv[1] ?? '';

if ($cmd === 'wait') {
    for ($i = 0; $i < 90; $i++) {
        if ($db = lfar_connect()) { mysqli_close($db); exit(0); }
        sleep(2);
    }
    fwrite(STDERR, "[lfar] MySQL not reachable: " . mysqli_connect_error() . "\n");
    exit(1);
}

if ($cmd === 'import') {
    $sql = file_get_contents($argv[2]);
    if ($sql === false || $sql === '') { fwrite(STDERR, "[lfar] Empty dump\n"); exit(1); }
    $db = lfar_connect();
    if (!$db) { fwrite(STDERR, "[lfar] Connect failed: " . mysqli_connect_error() . "\n"); exit(1); }
    mysqli_set_charset($db, 'utf8mb4');
    if (!mysqli_multi_query($db, $sql)) {
        fwrite(STDERR, "[lfar] Import failed: " . mysqli_error($db) . "\n"); exit(1);
    }
    $n = 0;
    do {
        if ($r = mysqli_store_result($db)) { mysqli_free_result($r); }
        $n++;
    } while (mysqli_more_results($db) && mysqli_next_result($db));
    if (mysqli_errno($db)) {
        fwrite(STDERR, "[lfar] Import stopped after statement $n: " . mysqli_error($db) . "\n"); exit(1);
    }
    echo "[lfar] Imported $n statements\n";
    exit(0);
}

fwrite(STDERR, "usage: import-db.php wait | import FILE\n");
exit(2);
