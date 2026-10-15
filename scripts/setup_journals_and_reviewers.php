<?php
/**
 * setup_journals_and_reviewers.php
 * Sets up multiple active journals and diverse reviewers in OJS
 */

$pdo = new PDO('mysql:host=localhost;dbname=ojs;charset=utf8mb4', 'ojsuser', 'Ojs@12345', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

echo "--- 1. ENABLING JOURNAL 2 (JAST) ---\n";
$pdo->exec("UPDATE journals SET enabled = 1 WHERE journal_id = 2");
echo "Journal 2 (jast) is now enabled.\n";

echo "\n--- 2. CREATING JOURNAL 3 (JBMS) IF NOT EXISTS ---\n";
// Clean up any incomplete journal with path 'jbms'
$stmt = $pdo->query("SELECT journal_id FROM journals WHERE path = 'jbms'");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $oldId = (int)$row['journal_id'];
    $pdo->exec("DELETE FROM journal_settings WHERE journal_id = $oldId");
    $pdo->exec("DELETE FROM section_settings WHERE section_id IN (SELECT section_id FROM sections WHERE journal_id = $oldId)");
    $pdo->exec("DELETE FROM sections WHERE journal_id = $oldId");
    $pdo->exec("DELETE FROM genre_settings WHERE genre_id IN (SELECT genre_id FROM genres WHERE context_id = $oldId)");
    $pdo->exec("DELETE FROM genres WHERE context_id = $oldId");
    $pdo->exec("DELETE FROM user_group_stage WHERE context_id = $oldId");
    $pdo->exec("DELETE FROM user_group_settings WHERE user_group_id IN (SELECT user_group_id FROM user_groups WHERE context_id = $oldId)");
    $pdo->exec("DELETE FROM user_user_groups WHERE user_group_id IN (SELECT user_group_id FROM user_groups WHERE context_id = $oldId)");
    $pdo->exec("DELETE FROM user_groups WHERE context_id = $oldId");
    $pdo->exec("DELETE FROM journals WHERE journal_id = $oldId");
    echo "Cleaned up incomplete Journal ID $oldId\n";
}
$j3 = false;

if (!$j3) {
    // Insert journal
    $pdo->exec("INSERT INTO journals (path, seq, primary_locale, enabled) VALUES ('jbms', 3, 'en', 1)");
    $j3Id = (int)$pdo->lastInsertId();
    echo "Created Journal 3 with ID: $j3Id (path: jbms)\n";

    // Clone settings from Journal 1
    $stmt = $pdo->query("SELECT setting_name, setting_value, locale FROM journal_settings WHERE journal_id = 1");
    $insertSetting = $pdo->prepare("INSERT INTO journal_settings (journal_id, locale, setting_name, setting_value) VALUES (?, ?, ?, ?)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $val = $row['setting_value'];
        if ($row['setting_name'] === 'name') $val = 'Journal of Biomedical Science and Engineering';
        if ($row['setting_name'] === 'acronym') $val = 'JBMS';
        if ($row['setting_name'] === 'abbreviation') $val = 'J. Biomed. Sci. Eng.';
        try {
            $insertSetting->execute([$j3Id, $row['locale'], $row['setting_name'], $val]);
        } catch (Exception $e) {}
    }

    // Clone Sections from Journal 1
    $pdo->exec("INSERT INTO sections (journal_id, review_form_id, seq, editor_restricted, meta_indexed, meta_reviewed, abstracts_not_required, hide_title, hide_author, is_inactive, abstract_word_count) VALUES ($j3Id, NULL, 1, 0, 1, 1, 0, 0, 0, 0, 0)");
    $secId = $pdo->lastInsertId();
    $pdo->exec("INSERT INTO section_settings (section_id, locale, setting_name, setting_value) VALUES ($secId, 'en', 'title', 'Articles')");

    // Clone Genres
    $genres = $pdo->query("SELECT entry_key, seq, enabled, category, dependent, supplementary, required FROM genres WHERE context_id = 1");
    $insertGenre = $pdo->prepare("INSERT INTO genres (context_id, seq, enabled, category, dependent, supplementary, required, entry_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $insertGenreSetting = $pdo->prepare("INSERT INTO genre_settings (genre_id, locale, setting_name, setting_value, setting_type) VALUES (?, 'en', 'name', ?, 'string')");
    while ($g = $genres->fetch(PDO::FETCH_ASSOC)) {
        $insertGenre->execute([$j3Id, $g['seq'], $g['enabled'], $g['category'], $g['dependent'], $g['supplementary'], $g['required'], $g['entry_key']]);
        $newGid = $pdo->lastInsertId();
        $gName = ucfirst(str_replace('_', ' ', $g['entry_key'] ?: 'Article Component'));
        $insertGenreSetting->execute([$newGid, $gName]);
    }

    // Clone User Groups
    $groups = $pdo->query("SELECT user_group_id, role_id, is_default, show_title, permit_self_registration, permit_metadata_edit, permit_settings, masthead FROM user_groups WHERE context_id = 1");
    $insertUg = $pdo->prepare("INSERT INTO user_groups (context_id, role_id, is_default, show_title, permit_self_registration, permit_metadata_edit, permit_settings, masthead) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $insertUgs = $pdo->prepare("INSERT INTO user_group_settings (user_group_id, locale, setting_name, setting_value) VALUES (?, ?, ?, ?)");
    $insertUgsStage = $pdo->prepare("INSERT INTO user_group_stage (context_id, user_group_id, stage_id) VALUES (?, ?, ?)");

    while ($ug = $groups->fetch(PDO::FETCH_ASSOC)) {
        $insertUg->execute([$j3Id, $ug['role_id'], $ug['is_default'], $ug['show_title'], $ug['permit_self_registration'], $ug['permit_metadata_edit'], $ug['permit_settings'], $ug['masthead']]);
        $newUgid = $pdo->lastInsertId();

        // Copy settings
        $sStmt = $pdo->prepare("SELECT setting_name, setting_value, locale FROM user_group_settings WHERE user_group_id = ?");
        $sStmt->execute([$ug['user_group_id']]);
        while ($s = $sStmt->fetch(PDO::FETCH_ASSOC)) {
            $insertUgs->execute([$newUgid, $s['locale'], $s['setting_name'], $s['setting_value']]);
        }

        // Copy stages
        $stgStmt = $pdo->prepare("SELECT stage_id FROM user_group_stage WHERE user_group_id = ?");
        $stgStmt->execute([$ug['user_group_id']]);
        while ($stg = $stgStmt->fetch(PDO::FETCH_ASSOC)) {
            try {
                $insertUgsStage->execute([$j3Id, $newUgid, $stg['stage_id']]);
            } catch (Exception $e) {}
        }
    }

    echo "Journal 3 (jbms) initialized successfully with settings, sections, genres, and user groups.\n";
} else {
    $j3Id = (int)$j3['journal_id'];
    echo "Journal 3 (jbms) already exists with ID: $j3Id\n";
}

echo "\n--- 3. CREATING MULTIPLE REVIEWERS WITH DIVERSE INTERESTS ---\n";

$pwdHash = $pdo->query("SELECT password FROM users WHERE user_id = 4")->fetchColumn();
if (!$pwdHash) {
    $pwdHash = '$2y$10$wN9r8p2iS2xO8E0xK2Xq9.WpTfTqgU9t8F8t.WpTfTqgU9t8F8t.W';
}

$reviewersData = [
    [
        'username' => 'marcus_reviewer',
        'email' => 'marcus.vance@scholarflow.org',
        'first_name' => 'Dr. Marcus',
        'last_name' => 'Vance',
        'interests' => ['Smart Grid Stability', 'High-Voltage Microgrids', 'Electrical Distribution', 'Power Inverters', 'Grid Infrastructure']
    ],
    [
        'username' => 'priya_reviewer',
        'email' => 'priya.sharma@scholarflow.org',
        'first_name' => 'Dr. Priya',
        'last_name' => 'Sharma',
        'interests' => ['Solar Cell Efficiency', 'Renewable Energy Policy', 'Photovoltaic Integration', 'Battery Energy Storage', 'Clean Energy Transitions']
    ],
    [
        'username' => 'clara_reviewer',
        'email' => 'clara.chen@scholarflow.org',
        'first_name' => 'Dr. Clara',
        'last_name' => 'Chen',
        'interests' => ['Molecular Genetics', 'CRISPR Gene Editing', 'Bioinformatics', 'Cellular Biology', 'Oncology Pathways']
    ],
    [
        'username' => 'arthur_reviewer',
        'email' => 'arthur.pendelton@scholarflow.org',
        'first_name' => 'Dr. Arthur',
        'last_name' => 'Pendelton',
        'interests' => ['Medieval Literature', 'Historical Linguistics', 'Renaissance Manuscripts', 'Classical Hermeneutics']
    ]
];

function getReviewerGroupId($pdo, $contextId) {
    $stmt = $pdo->prepare("SELECT user_group_id FROM user_groups WHERE context_id = ? AND role_id = 4096 LIMIT 1");
    $stmt->execute([$contextId]);
    return (int)$stmt->fetchColumn();
}

$reviewerUg1 = getReviewerGroupId($pdo, 1);
$reviewerUg2 = getReviewerGroupId($pdo, 2);
$reviewerUg3 = getReviewerGroupId($pdo, $j3Id);

echo "Reviewer UserGroup IDs: Context 1 = $reviewerUg1, Context 2 = $reviewerUg2, Context 3 = $reviewerUg3\n";

foreach ($reviewersData as $r) {
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE username = ?");
    $stmt->execute([$r['username']]);
    $userId = (int)$stmt->fetchColumn();

    if (!$userId) {
        $insertUser = $pdo->prepare("INSERT INTO users (username, password, email, date_registered, date_last_login, inline_help) VALUES (?, ?, ?, NOW(), NOW(), 1)");
        $insertUser->execute([$r['username'], $pwdHash, $r['email']]);
        $userId = (int)$pdo->lastInsertId();
        echo "Created User: {$r['username']} (ID: $userId)\n";
    } else {
        echo "User {$r['username']} exists (ID: $userId)\n";
    }

    // Set Name in user_settings
    $pdo->prepare("DELETE FROM user_settings WHERE user_id = ? AND setting_name IN ('givenName', 'familyName')")->execute([$userId]);
    $insName = $pdo->prepare("INSERT INTO user_settings (user_id, locale, setting_name, setting_value) VALUES (?, 'en', ?, ?)");
    $insName->execute([$userId, 'givenName', $r['first_name']]);
    $insName->execute([$userId, 'familyName', $r['last_name']]);

    // Enroll in Reviewer UserGroup for contexts 1, 2, 3
    foreach ([$reviewerUg1, $reviewerUg2, $reviewerUg3] as $ugId) {
        if ($ugId > 0) {
            $chk = $pdo->prepare("SELECT 1 FROM user_user_groups WHERE user_id = ? AND user_group_id = ?");
            $chk->execute([$userId, $ugId]);
            if (!$chk->fetchColumn()) {
                $pdo->prepare("INSERT INTO user_user_groups (user_id, user_group_id) VALUES (?, ?)")->execute([$userId, $ugId]);
            }
        }
    }

    // Set Controlled Vocab for Interests
    $cvStmt = $pdo->prepare("SELECT controlled_vocab_id FROM controlled_vocabs WHERE symbolic = 'interest' AND assoc_type = 256 AND assoc_id = ?");
    $cvStmt->execute([$userId]);
    $cvId = (int)$cvStmt->fetchColumn();
    if (!$cvId) {
        $pdo->prepare("INSERT INTO controlled_vocabs (symbolic, assoc_type, assoc_id) VALUES ('interest', 256, ?)")->execute([$userId]);
        $cvId = (int)$pdo->lastInsertId();
    }

    // Clear existing interests for this user
    $oldEntries = $pdo->query("SELECT controlled_vocab_entry_id FROM controlled_vocab_entries WHERE controlled_vocab_id = $cvId")->fetchAll(PDO::FETCH_COLUMN);
    if (!empty($oldEntries)) {
        $inList = implode(',', array_map('intval', $oldEntries));
        $pdo->exec("DELETE FROM controlled_vocab_entry_settings WHERE controlled_vocab_entry_id IN ($inList)");
        $pdo->exec("DELETE FROM user_interests WHERE controlled_vocab_entry_id IN ($inList)");
        $pdo->exec("DELETE FROM controlled_vocab_entries WHERE controlled_vocab_id = $cvId");
    }

    // Insert new interests
    $insCve = $pdo->prepare("INSERT INTO controlled_vocab_entries (controlled_vocab_id, seq) VALUES (?, 1)");
    $insCves = $pdo->prepare("INSERT INTO controlled_vocab_entry_settings (controlled_vocab_entry_id, locale, setting_name, setting_value) VALUES (?, '', 'interest', ?)");
    $insUi = $pdo->prepare("INSERT INTO user_interests (user_id, controlled_vocab_entry_id) VALUES (?, ?)");

    foreach ($r['interests'] as $interest) {
        $insCve->execute([$cvId]);
        $entryId = (int)$pdo->lastInsertId();
        $insCves->execute([$entryId, $interest]);
        $insUi->execute([$userId, $entryId]);
    }
    echo "  -> Assigned interests: " . implode(', ', $r['interests']) . "\n";
}

// Enroll admin and editor in Journal 3 as well
function getManagerGroupId($pdo, $contextId) {
    $stmt = $pdo->prepare("SELECT user_group_id FROM user_groups WHERE context_id = ? AND role_id = 16 LIMIT 1");
    $stmt->execute([$contextId]);
    return (int)$stmt->fetchColumn();
}
function getEditorGroupId($pdo, $contextId) {
    $stmt = $pdo->prepare("SELECT user_group_id FROM user_groups WHERE context_id = ? AND role_id = 17 LIMIT 1");
    $stmt->execute([$contextId]);
    return (int)$stmt->fetchColumn();
}

$mgrUg3 = getManagerGroupId($pdo, $j3Id);
$edUg3 = getEditorGroupId($pdo, $j3Id);
foreach ([1 => $mgrUg3, 3 => $edUg3] as $uid => $ugId) {
    if ($ugId > 0) {
        $chk = $pdo->prepare("SELECT 1 FROM user_user_groups WHERE user_id = ? AND user_group_id = ?");
        $chk->execute([$uid, $ugId]);
        if (!$chk->fetchColumn()) {
            $pdo->prepare("INSERT INTO user_user_groups (user_id, user_group_id) VALUES (?, ?)")->execute([$uid, $ugId]);
        }
    }
}

echo "\n--- SUMMARY OF ALL JOURNALS ---\n";
foreach ($pdo->query("SELECT j.journal_id, j.path, j.enabled, js.setting_value as name FROM journals j LEFT JOIN journal_settings js ON (j.journal_id = js.journal_id AND js.setting_name = 'name' AND js.locale = 'en')") as $r) {
    echo "Journal #{$r['journal_id']}: {$r['path']} (Enabled: {$r['enabled']}) -> {$r['name']}\n";
}

echo "\n--- SUMMARY OF ALL REVIEWERS IN CONTEXT 1 ---\n";
$stmt = $pdo->query("
    SELECT u.user_id, u.username, u.email,
           (SELECT GROUP_CONCAT(cves.setting_value SEPARATOR ', ')
            FROM user_interests ui
            JOIN controlled_vocab_entries cve ON cve.controlled_vocab_entry_id = ui.controlled_vocab_entry_id
            JOIN controlled_vocab_entry_settings cves ON cves.controlled_vocab_entry_id = cve.controlled_vocab_entry_id
            WHERE ui.user_id = u.user_id AND cves.setting_name = 'interest') as interests
    FROM users u
    JOIN user_user_groups uug ON u.user_id = uug.user_id
    WHERE uug.user_group_id = $reviewerUg1
");
while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "ID {$r['user_id']}: {$r['username']} ({$r['email']}) -> Interests: {$r['interests']}\n";
}
echo "\nDONE!\n";
