<?php
/**
 * seed_submissions_all_journals.php
 * Creates an active manuscript submission with a .docx file and assigns editors in all 5 other journals:
 * JAST (#2), JBMS (#5), JEAS (#6), JCS (#7), JMS (#8)
 */

$pdo = new PDO('mysql:host=localhost;dbname=ojs;charset=utf8mb4', 'ojsuser', 'Ojs@12345', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

$baseDocx = 'C:/xampp/ojs-files/journals/1/articles/1/6a901d6445346.docx';
if (!file_exists($baseDocx)) {
    die("Base docx file not found at $baseDocx\n");
}

$submissionsToSeed = [
    [
        'context_id' => 2,
        'title' => 'Deep Learning Architectures for Earth Observation & High-Resolution Satellite Imaging',
        'author_given' => 'Marcus',
        'author_family' => 'Vance',
        'author_email' => 'marcus.vance@scholarflow.org',
        'author_affiliation' => 'Space & Geospatial Intelligence Laboratory'
    ],
    [
        'context_id' => 5,
        'title' => 'CRISPR-Cas9 Therapeutic Targets & Biomarkers in Early-Stage Oncology Pathways',
        'author_given' => 'Clara',
        'author_family' => 'Chen',
        'author_email' => 'clara.chen@scholarflow.org',
        'author_affiliation' => 'Institute for Cellular Oncology & Molecular Genetics'
    ],
    [
        'context_id' => 6,
        'title' => 'Agroecological Soil Health & Regenerative Farming Systems in Climate Change Mitigation',
        'author_given' => 'Kwame',
        'author_family' => 'Asante',
        'author_email' => 'kwame.asante@scholarflow.org',
        'author_affiliation' => 'Center for Sustainable Agriculture & Ecosystem Resilience'
    ],
    [
        'context_id' => 7,
        'title' => 'Post-Quantum Cryptographic Protocols & Lattice-Based Encryption for Zero-Trust Cloud Architectures',
        'author_given' => 'Elena',
        'author_family' => 'Rostova',
        'author_email' => 'elena.rostova@scholarflow.org',
        'author_affiliation' => 'Institute for Advanced Cybersecurity & Quantum Computing'
    ],
    [
        'context_id' => 8,
        'title' => 'Minimally Invasive Robotic Surgery Outcomes & Patient Recovery in Complex Coronary Revascularization',
        'author_given' => 'Sarah',
        'author_family' => 'Jenkins',
        'author_email' => 'sarah.jenkins@scholarflow.org',
        'author_affiliation' => 'Department of Cardiovascular & Thoracic Robotic Surgery'
    ]
];

$editorUserIds = [1, 3, 15, 16]; // admin, editor, sophia_editor, david_editor

foreach ($submissionsToSeed as $seed) {
    $cId = (int)$seed['context_id'];

    // Check if context already has a submission
    $existing = (int)$pdo->query("SELECT submission_id FROM submissions WHERE context_id = $cId LIMIT 1")->fetchColumn();
    if ($existing > 0) {
        echo "Context #$cId already has Submission #$existing. Skipping insert.\n";
        $subId = $existing;
    } else {
        // 1. Insert Submission
        $pdo->prepare("
            INSERT INTO submissions (context_id, date_submitted, date_last_activity, last_modified, stage_id, locale, status, submission_progress, work_type)
            VALUES (?, NOW(), NOW(), NOW(), 3, 'en', 1, '', 0)
        ")->execute([$cId]);
        $subId = (int)$pdo->lastInsertId();

        // 2. Get Section ID for this context
        $secId = (int)$pdo->query("SELECT section_id FROM sections WHERE journal_id = $cId LIMIT 1")->fetchColumn();
        if (!$secId) $secId = 1;

        // 3. Insert Publication
        $pdo->prepare("
            INSERT INTO publications (submission_id, status, version, seq, section_id, access_status)
            VALUES (?, 1, 1, 1, ?, 0)
        ")->execute([$subId, $secId]);
        $pubId = (int)$pdo->lastInsertId();

        // Update submission with current_publication_id
        $pdo->exec("UPDATE submissions SET current_publication_id = $pubId WHERE submission_id = $subId");

        // 4. Publication Settings (Title)
        $pdo->prepare("
            INSERT INTO publication_settings (publication_id, locale, setting_name, setting_value)
            VALUES (?, 'en', 'title', ?)
        ")->execute([$pubId, $seed['title']]);

        // 5. Author User Group for this context
        $authorUg = (int)$pdo->query("SELECT user_group_id FROM user_groups WHERE context_id = $cId AND role_id = 65536 LIMIT 1")->fetchColumn();

        // Insert Author
        $pdo->prepare("
            INSERT INTO authors (publication_id, seq, user_group_id, include_in_browse, email)
            VALUES (?, 1, ?, 1, ?)
        ")->execute([$pubId, $authorUg, $seed['author_email']]);
        $authorId = (int)$pdo->lastInsertId();

        $pdo->prepare("INSERT INTO author_settings (author_id, locale, setting_name, setting_value) VALUES (?, 'en', 'givenName', ?)")->execute([$authorId, $seed['author_given']]);
        $pdo->prepare("INSERT INTO author_settings (author_id, locale, setting_name, setting_value) VALUES (?, 'en', 'familyName', ?)")->execute([$authorId, $seed['author_family']]);
        $pdo->prepare("INSERT INTO author_settings (author_id, locale, setting_name, setting_value) VALUES (?, 'en', 'affiliation', ?)")->execute([$authorId, $seed['author_affiliation']]);

        // 6. Copy .docx manuscript file
        $targetDir = "C:/xampp/ojs-files/journals/$cId/articles/$subId";
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0777, true);
        }
        $targetFile = "$targetDir/manuscript.docx";
        copy($baseDocx, $targetFile);
        $relPath = "journals/$cId/articles/$subId/manuscript.docx";

        // Insert file record
        $pdo->prepare("
            INSERT INTO files (path, mimetype)
            VALUES (?, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        ")->execute([$relPath]);
        $fileId = (int)$pdo->lastInsertId();

        // Genre for Article
        $genreId = (int)$pdo->query("SELECT genre_id FROM genres WHERE context_id = $cId LIMIT 1")->fetchColumn() ?: 1;

        // Insert submission_files record
        $pdo->prepare("
            INSERT INTO submission_files (submission_id, file_id, genre_id, file_stage, created_at, updated_at, uploader_user_id)
            VALUES (?, ?, ?, 2, NOW(), NOW(), 2)
        ")->execute([$subId, $fileId, $genreId]);

        echo "Created Submission #$subId in Journal Context #$cId: '{$seed['title']}'\n";
    }

    // 7. Assign all 4 Editors to this submission in stage_assignments
    $edUg = (int)$pdo->query("SELECT user_group_id FROM user_groups WHERE context_id = $cId AND (role_id = 16 OR role_id = 17) ORDER BY role_id DESC LIMIT 1")->fetchColumn();
    if ($edUg > 0) {
        foreach ($editorUserIds as $eId) {
            $chk = $pdo->prepare("SELECT 1 FROM stage_assignments WHERE submission_id = ? AND user_group_id = ? AND user_id = ?");
            $chk->execute([$subId, $edUg, $eId]);
            if (!$chk->fetchColumn()) {
                $pdo->prepare("INSERT INTO stage_assignments (submission_id, user_group_id, user_id, date_assigned) VALUES (?, ?, ?, NOW())")->execute([$subId, $edUg, $eId]);
            }
        }
    }
}

// Also ensure editor (3) is assigned to Submission 2 in Journal 1
$ug1 = (int)$pdo->query("SELECT user_group_id FROM user_groups WHERE context_id = 1 AND (role_id = 16 OR role_id = 17) ORDER BY role_id DESC LIMIT 1")->fetchColumn();
foreach ($editorUserIds as $eId) {
    $chk = $pdo->prepare("SELECT 1 FROM stage_assignments WHERE submission_id = 2 AND user_group_id = ? AND user_id = ?");
    $chk->execute([$ug1, $eId]);
    if (!$chk->fetchColumn()) {
        $pdo->prepare("INSERT INTO stage_assignments (submission_id, user_group_id, user_id, date_assigned) VALUES (2, ?, ?, NOW())")->execute([$ug1, $eId]);
    }
}

echo "\n=== ALL ACTIVE SUBMISSIONS & THEIR JOURNALS ===\n";
$stmt = $pdo->query("
    SELECT s.submission_id, s.context_id, j.path, js.setting_value as journal_name, ps.setting_value as title
    FROM submissions s
    JOIN journals j ON s.context_id = j.journal_id
    LEFT JOIN journal_settings js ON (j.journal_id = js.journal_id AND js.setting_name = 'name' AND js.locale = 'en')
    LEFT JOIN publications p ON s.current_publication_id = p.publication_id
    LEFT JOIN publication_settings ps ON (p.publication_id = ps.publication_id AND ps.setting_name = 'title' AND ps.locale = 'en')
    ORDER BY s.context_id, s.submission_id
");
while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "Sub #{$r['submission_id']} | [{$r['path']}] {$r['journal_name']}\n";
    echo "  Title: {$r['title']}\n";
}
echo "\nDONE SEEDING ALL JOURNALS!\n";
