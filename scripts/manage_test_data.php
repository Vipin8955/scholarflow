<?php
$pdo = new PDO('mysql:host=localhost;dbname=ojs;charset=utf8mb4', 'ojsuser', 'Ojs@12345');

echo "=== ALL USERS ===" . PHP_EOL;
$stmtU = $pdo->query('SELECT user_id, username, email FROM users ORDER BY user_id');
while ($r = $stmtU->fetch(PDO::FETCH_ASSOC)) {
    echo "UID: {$r['user_id']} | User: {$r['username']} | Email: {$r['email']}" . PHP_EOL;
}
echo "=== JOURNALS ===" . PHP_EOL;
$stmt = $pdo->query('SELECT j.journal_id, j.path, js.setting_value AS name FROM journals j LEFT JOIN journal_settings js ON (j.journal_id = js.journal_id AND js.setting_name = "name" AND js.locale = "en")');
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "ID: {$row['journal_id']} | Path: {$row['path']} | Name: {$row['name']}" . PHP_EOL;
}

echo PHP_EOL . "=== SUBMISSIONS ===" . PHP_EOL;
$stmt = $pdo->query('SELECT s.submission_id, s.context_id, p.publication_id, ps.setting_value AS title FROM submissions s LEFT JOIN publications p ON (s.current_publication_id = p.publication_id) LEFT JOIN publication_settings ps ON (p.publication_id = ps.publication_id AND ps.setting_name = "title" AND ps.locale = "en")');
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "SubID: {$row['submission_id']} | ContextID: {$row['context_id']} | PubID: {$row['publication_id']} | Title: {$row['title']}" . PHP_EOL;
}

echo PHP_EOL . "=== USERS & ROLES ===" . PHP_EOL;
$stmt = $pdo->query('SELECT u.user_id, u.username, u.email, ug.role_id, ugs.setting_value AS role_name, ug.context_id 
FROM users u 
JOIN user_user_groups uug ON (u.user_id = uug.user_id) 
JOIN user_groups ug ON (uug.user_group_id = ug.user_group_id) 
LEFT JOIN user_group_settings ugs ON (ug.user_group_id = ugs.user_group_id AND ugs.setting_name = "name" AND ugs.locale = "en") 
ORDER BY u.user_id, ug.context_id');
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "UserID: {$row['user_id']} | User: {$row['username']} | RoleID: {$row['role_id']} ({$row['role_name']}) | ContextID: {$row['context_id']}" . PHP_EOL;
}
