<?php

/**
 * @file plugins/generic/scholarflow/ScholarFlowHandler.php
 *
 * ScholarFlow AI, Document Viewer & Markups Handler.
 * Endpoints:
 * - /scholarflow/document?submissionId=X
 * - /scholarflow/annotations?submissionId=X
 * - /scholarflow/saveAnnotation
 * - /scholarflow/deleteAnnotation?id=X
 * - /scholarflow/exportAnnotations?submissionId=X
 * - /scholarflow/analyze?submissionId=X
 * - /scholarflow/recommendReviewers?submissionId=X
 * - /scholarflow/userInfo
 */

namespace APP\plugins\generic\scholarflow;

use APP\core\Application;
use APP\facades\Repo;
use PKP\config\Config;
use PKP\security\Role;
use PKP\userGroup\UserGroup;

class ScholarFlowHandler extends \APP\handler\Handler
{
    protected ScholarFlowPlugin $plugin;

    public function __construct(ScholarFlowPlugin $plugin)
    {
        parent::__construct();
        $this->plugin = $plugin;
    }

    /**
     * Mark role assignments checked.
     */
    public function authorize($request, &$args, $roleAssignments): bool
    {
        $this->markRoleAssignmentsChecked();
        return true;
    }

    /**
     * Helper to get user roles and check permissions.
     */
    protected function getUserRoleInfo($request): array
    {
        $user = $request->getUser();
        if (!$user) {
            return ['isLoggedIn' => false, 'roles' => [], 'isAuthorOnly' => false, 'name' => '', 'id' => 0];
        }

        $roles = [];
        try {
            $userGroups = UserGroup::query()
                ->whereHas('userUserGroups', function ($query) use ($user) {
                    $query->where('user_id', $user->getId());
                })
                ->get();
            foreach ($userGroups as $group) {
                $roles[] = (int) $group->roleId;
            }
        } catch (\Exception $e) {
            $roles = [];
        }

        $isEditor = in_array(Role::ROLE_ID_MANAGER, $roles) || in_array(Role::ROLE_ID_SITE_ADMIN, $roles) || in_array(Role::ROLE_ID_SUB_EDITOR, $roles);
        $isReviewer = in_array(Role::ROLE_ID_REVIEWER, $roles);
        $isAuthor = in_array(Role::ROLE_ID_AUTHOR, $roles);
        $isAuthorOnly = $isAuthor && !$isEditor && !$isReviewer;

        $displayRole = 'User';
        if ($isEditor) $displayRole = 'Editor';
        elseif ($isReviewer) $displayRole = 'Reviewer';
        elseif ($isAuthor) $displayRole = 'Author';

        return [
            'isLoggedIn' => true,
            'id' => (int) $user->getId(),
            'name' => (string) $user->getFullName(),
            'roles' => array_values(array_unique($roles)),
            'displayRole' => $displayRole,
            'isEditor' => $isEditor,
            'isReviewer' => $isReviewer,
            'isAuthor' => $isAuthor,
            'isAuthorOnly' => $isAuthorOnly,
        ];
    }

    /**
     * Handle GET /scholarflow/userInfo
     */
    public function userInfo(array $args, $request): void
    {
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'user' => $this->getUserRoleInfo($request)]);
        exit;
    }

    /**
     * Handle GET /scholarflow/submissionsList
     * Returns a list of all submissions for the paper selector.
     */
    public function submissionsList(array $args, $request): void
    {
        header('Content-Type: application/json');
        try {
            $userInfo = $this->getUserRoleInfo($request);
            $context = $request->getRouter() ? $request->getContext() : null;
            
            // If editor or admin, retrieve submissions across all hosted journals
            if (!empty($userInfo['isEditor'])) {
                $submissions = Repo::submission()
                    ->getCollector()
                    ->filterByContextIds([\APP\core\Application::SITE_CONTEXT_ID_ALL])
                    ->getMany();
            } else {
                $contextId = $context ? $context->getId() : \APP\core\Application::SITE_CONTEXT_ID_ALL;
                $submissions = Repo::submission()
                    ->getCollector()
                    ->filterByContextIds([$contextId])
                    ->getMany();
            }

            $contextDao = Application::getContextDAO();
            $list = [];
            foreach ($submissions as $s) {
                $cId = (int) $s->getData('contextId');
                $journalObj = $contextDao->getById($cId);
                $journalName = $journalObj ? ($journalObj->getName('en') ?: $journalObj->getPath()) : 'Journal';
                $journalAcronym = $journalObj ? ($journalObj->getData('acronym', 'en') ?: $journalObj->getPath()) : 'Journal';

                $pub = $s->getCurrentPublication();
                $title = 'Untitled Manuscript';
                $authors = [];
                if ($pub) {
                    $titles = $pub->getData('title');
                    if (is_array($titles)) {
                        $title = reset($titles);
                    } elseif (is_string($titles) && !empty($titles)) {
                        $title = $titles;
                    }
                    foreach ($pub->getData('authors') ?? [] as $a) {
                        $given = is_array($a->getData('givenName')) ? reset($a->getData('givenName')) : $a->getData('givenName');
                        $family = is_array($a->getData('familyName')) ? reset($a->getData('familyName')) : $a->getData('familyName');
                        $authorName = trim($given . ' ' . $family);
                        if (!empty($authorName)) {
                            $authors[] = $authorName;
                        }
                    }
                }

                $statusNum = (int) $s->getData('status');
                $statusText = 'In Review';
                if ($statusNum === 1) $statusText = 'Queued';
                elseif ($statusNum === 3) $statusText = 'Published';
                elseif ($statusNum === 4) $statusText = 'Declined';

                $list[] = [
                    'id' => (int) $s->getId(),
                    'contextId' => $cId,
                    'journalName' => $journalName,
                    'journalAcronym' => strtoupper($journalAcronym),
                    'title' => $title,
                    'authors' => !empty($authors) ? implode(', ', $authors) : 'Authors not listed',
                    'status' => $statusText,
                    'dateSubmitted' => (string) $s->getData('dateSubmitted'),
                ];
            }

            echo json_encode(['success' => true, 'submissions' => $list]);
        } catch (\Throwable $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage(), 'submissions' => []]);
        }
        exit;
    }

    /**
     * Helper to resolve local file path for a submission.
     */
    protected function resolveManuscriptFilePath(int $submissionId): ?string
    {
        $submissionFiles = Repo::submissionFile()
            ->getCollector()
            ->filterBySubmissionIds([$submissionId])
            ->getMany();

        $targetFile = null;
        $bestPriority = -1;
        foreach ($submissionFiles as $file) {
            $path     = strtolower((string) $file->getData('path'));
            $mime     = (string) $file->getData('mimetype');
            $isPdf    = str_ends_with($path, '.pdf')  || $mime === 'application/pdf';
            $isDocx   = str_ends_with($path, '.docx') || $mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            if ($isPdf || $isDocx) {
                $stage = (int) $file->getData('fileStage');
                $priority = ($stage === 2 || $stage === 4 || $stage === 15) ? 1000 : 100;
                $priority += (int) $file->getId();
                if ($priority > $bestPriority) {
                    $bestPriority = $priority;
                    $targetFile = $file;
                }
            }
        }

        $filesDir = rtrim(Config::getVar('files', 'files_dir'), '/\\');

        if ($targetFile) {
            $relPath  = ltrim((string) $targetFile->getData('path'), '/\\');
            $filePath = $filesDir . DIRECTORY_SEPARATOR . $relPath;
            if (file_exists($filePath)) {
                return $filePath;
            }
        }

        // Database direct fallback across all journal contexts
        try {
            $host = Config::getVar('database', 'host', 'localhost');
            $username = Config::getVar('database', 'username', 'ojsuser');
            $password = Config::getVar('database', 'password', 'Ojs@12345');
            $dbname = Config::getVar('database', 'name', 'ojs');
            $conn = @new \mysqli($host, $username, $password, $dbname);
            if ($conn && !$conn->connect_error) {
                $q = "SELECT f.path FROM submission_files sf JOIN files f ON sf.file_id = f.file_id WHERE sf.submission_id = " . (int)$submissionId . " AND (f.path LIKE '%.docx' OR f.path LIKE '%.pdf') ORDER BY (sf.file_stage IN (2,4,15)) DESC, sf.submission_file_id DESC LIMIT 1";
                $res = $conn->query($q);
                if ($res && ($row = $res->fetch_assoc())) {
                    $relPath = ltrim((string) $row['path'], '/\\');
                    $fp = $filesDir . DIRECTORY_SEPARATOR . $relPath;
                    $conn->close();
                    if (file_exists($fp)) {
                        return $fp;
                    }
                }
                $conn->close();
            }
        } catch (\Throwable $e) {}

        // Folder scan fallback for newly uploaded files directly in submission directories
        try {
            $subObj = Repo::submission()->get($submissionId);
            $cId = $subObj ? (int)$subObj->getData('contextId') : null;
            $searchDirs = [];
            if ($cId) {
                $searchDirs[] = $filesDir . DIRECTORY_SEPARATOR . 'journals' . DIRECTORY_SEPARATOR . $cId . DIRECTORY_SEPARATOR . 'articles' . DIRECTORY_SEPARATOR . $submissionId;
            }
            $journalsDir = $filesDir . DIRECTORY_SEPARATOR . 'journals';
            if (is_dir($journalsDir)) {
                $dirs = glob($journalsDir . DIRECTORY_SEPARATOR . '*' . DIRECTORY_SEPARATOR . 'articles' . DIRECTORY_SEPARATOR . $submissionId);
                if ($dirs) {
                    foreach ($dirs as $d) {
                        $searchDirs[] = $d;
                    }
                }
            }
            foreach (array_unique($searchDirs) as $sDir) {
                if (is_dir($sDir)) {
                    $candidates = array_merge(
                        glob($sDir . DIRECTORY_SEPARATOR . '*.docx') ?: [],
                        glob($sDir . DIRECTORY_SEPARATOR . '*.pdf') ?: [],
                        glob($sDir . DIRECTORY_SEPARATOR . 'submission' . DIRECTORY_SEPARATOR . '*.docx') ?: [],
                        glob($sDir . DIRECTORY_SEPARATOR . 'submission' . DIRECTORY_SEPARATOR . '*.pdf') ?: []
                    );
                    if (!empty($candidates)) {
                        usort($candidates, function($a, $b) { return filemtime($b) - filemtime($a); });
                        return $candidates[0];
                    }
                }
            }
        } catch (\Throwable $e) {}

        return null;
    }

    /**
     * Handle GET /scholarflow/document?submissionId=X
     * In-Platform Document Viewer Endpoint.
     */
    public function document(array $args, $request): void
    {
        header('Content-Type: application/json');

        $user = $request->getUser();
        if (!$user) {
            echo json_encode(['error' => 'You must be logged in to view manuscripts.']);
            exit;
        }

        $userInfo = $this->getUserRoleInfo($request);
        if (!$userInfo['isEditor'] && !$userInfo['isReviewer'] && !$userInfo['isAuthor']) {
            echo json_encode(['error' => 'You do not have permission to view manuscripts.']);
            exit;
        }

        $submissionId = (int) $request->getUserVar('submissionId');
        if (!$submissionId) {
            echo json_encode(['error' => 'Missing submissionId parameter.']);
            exit;
        }

        $submission = Repo::submission()->get($submissionId);
        if (!$submission) {
            echo json_encode(['error' => 'Submission #' . $submissionId . ' not found.']);
            exit;
        }

        $filePath = $this->resolveManuscriptFilePath($submissionId);
        if (!$filePath) {
            echo json_encode(['error' => 'No manuscript document (.docx or .pdf) was found on disk for Submission #' . $submissionId]);
            exit;
        }

        $publication = $submission->getCurrentPublication();
        $title = $publication ? $publication->getLocalizedTitle() : ('Submission #' . $submissionId);

        try {
            $client = new \GuzzleHttp\Client(['timeout' => 60]);
            $response = $client->post('http://127.0.0.1:8000/api/render_document', [
                'json' => ['file_path' => $filePath],
            ]);
            $body = json_decode($response->getBody()->getContents(), true);
            $body['title'] = $title;
            $body['user'] = $this->getUserRoleInfo($request);
            echo json_encode($body);
        } catch (\Exception $e) {
            echo json_encode([
                'error' => 'Could not render document via ScholarFlow backend: ' . $e->getMessage(),
            ]);
        }
        exit;
    }

    /**
     * Handle GET /scholarflow/annotations?submissionId=X
     */
    public function annotations(array $args, $request): void
    {
        header('Content-Type: application/json');

        $submissionId = (int) $request->getUserVar('submissionId');
        if (!$submissionId) {
            echo json_encode(['error' => 'Missing submissionId parameter.']);
            exit;
        }

        $userInfo = $this->getUserRoleInfo($request);

        try {
            $client = new \GuzzleHttp\Client(['timeout' => 30]);
            $response = $client->get('http://127.0.0.1:8000/api/annotations', [
                'query' => ['submission_id' => $submissionId],
            ]);
            $data = json_decode($response->getBody()->getContents(), true);

            // Privacy Filtering:
            // 1. If AuthorOnly: Never see any confidential_to_editor comments.
            // 2. If Reviewer (and not Editor):
            //    - Can only see editor comments and own comments.
            //    - If a comment is confidential_to_editor: ONLY see it if it is their OWN comment ($isOwn).
            // 3. If Editor:
            //    - Can see all comments (including confidential_to_editor notes).
            if (!empty($data['annotations'])) {
                $isAuthorOnly = !empty($userInfo['isAuthorOnly']);
                $isReviewer = !empty($userInfo['isReviewer']);
                $isEditor = !empty($userInfo['isEditor']);
                $myUserId = (int) ($userInfo['id'] ?? 0);
                $myUserName = strtolower(trim((string) ($userInfo['name'] ?? '')));

                $filtered = [];
                foreach ($data['annotations'] as $ann) {
                    $isConfidential = !empty($ann['confidential_to_editor']);
                    $annRole = strtolower(trim((string) ($ann['user_role'] ?? '')));
                    $isAnnEditor = ($annRole === 'editor');
                    $isOwn = ($myUserId && (int) ($ann['user_id'] ?? 0) === $myUserId) ||
                             ($myUserName && strtolower(trim((string) ($ann['user_name'] ?? ''))) === $myUserName);

                    // Authors strictly cannot see confidential editor-only notes
                    if ($isAuthorOnly && $isConfidential) {
                        continue;
                    }

                    // Reviewers (who are not Editors)
                    if ($isReviewer && !$isEditor) {
                        // Cannot see another reviewer's confidential comments
                        if ($isConfidential && !$isOwn) {
                            continue;
                        }
                        // Can only see own comments and editor comments
                        if (!$isAnnEditor && !$isOwn) {
                            continue;
                        }
                    }

                    $filtered[] = $ann;
                }
                $data['annotations'] = array_values($filtered);
            }

            $data['user'] = $userInfo;
            echo json_encode($data);
        } catch (\Exception $e) {
            echo json_encode([
                'error' => 'Could not load annotations: ' . $e->getMessage(),
            ]);
        }
        exit;
    }

    /**
     * Handle POST /scholarflow/saveAnnotation
     */
    public function saveAnnotation(array $args, $request): void
    {
        header('Content-Type: application/json');

        $user = $request->getUser();
        if (!$user) {
            echo json_encode(['error' => 'You must be logged in to add comments.']);
            exit;
        }

        $userInfo = $this->getUserRoleInfo($request);
        $input = json_decode(file_get_contents('php://input'), true);

        $submissionId = (int) ($input['submission_id'] ?? $request->getUserVar('submissionId'));
        $selectedText = trim((string) ($input['selected_text'] ?? ''));
        $comment = trim((string) ($input['comment'] ?? ''));
        $color = trim((string) ($input['color'] ?? 'yellow'));
        $paragraphId = trim((string) ($input['paragraph_id'] ?? ''));
        $confidentialToEditor = !empty($input['confidential_to_editor']);

        if (!$submissionId || !$comment) {
            echo json_encode(['error' => 'Submission ID and comment text are required.']);
            exit;
        }

        try {
            $client = new \GuzzleHttp\Client(['timeout' => 30]);
            $response = $client->post('http://127.0.0.1:8000/api/annotations', [
                'json' => [
                    'submission_id' => $submissionId,
                    'user_id' => (int) $userInfo['id'],
                    'user_name' => (string) $userInfo['name'],
                    'user_role' => (string) $userInfo['displayRole'],
                    'selected_text' => $selectedText,
                    'comment' => $comment,
                    'color' => $color,
                    'paragraph_id' => $paragraphId,
                    'confidential_to_editor' => (bool) $confidentialToEditor,
                ],
            ]);
            echo $response->getBody()->getContents();
        } catch (\Exception $e) {
            echo json_encode([
                'error' => 'Could not save annotation: ' . $e->getMessage(),
            ]);
        }
        exit;
    }

    /**
     * Handle DELETE /scholarflow/deleteAnnotation?id=X
     * Permissions:
     * - Editors can delete any comment (editorial moderation)
     * - Reviewers can delete their own comments
     * - Authors cannot delete any comments
     */
    public function deleteAnnotation(array $args, $request): void
    {
        header('Content-Type: application/json');

        $user = $request->getUser();
        if (!$user) {
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }

        $annotationId = (int) $request->getUserVar('id');
        if (!$annotationId) {
            echo json_encode(['error' => 'Missing annotation ID.']);
            exit;
        }

        $userInfo = $this->getUserRoleInfo($request);
        if ($userInfo['isAuthorOnly']) {
            echo json_encode(['error' => 'Authors are not permitted to delete review comments.']);
            exit;
        }

        // Editorial authority: Editors can moderate/delete any comment.
        // Reviewers are only allowed to delete their own comments.
        if (!$userInfo['isEditor']) {
            $submissionId = (int) $request->getUserVar('submissionId', 1);
            try {
                $checkClient = new \GuzzleHttp\Client(['timeout' => 10]);
                $annResp = $checkClient->get('http://127.0.0.1:8000/api/annotations?submission_id=' . $submissionId);
                $annData = json_decode($annResp->getBody()->getContents(), true);
                if (!empty($annData['annotations'])) {
                    foreach ($annData['annotations'] as $ann) {
                        if ((int)$ann['id'] === $annotationId) {
                            if ((int)$ann['user_id'] !== (int)$user->getId()) {
                                echo json_encode(['error' => 'Reviewers can only delete their own comments.']);
                                exit;
                            }
                            break;
                        }
                    }
                }
            } catch (\Exception $e) {
                // If verification lookup times out, proceed to delete
            }
        }

        try {
            $client = new \GuzzleHttp\Client(['timeout' => 30]);
            $response = $client->delete('http://127.0.0.1:8000/api/annotations/' . $annotationId);
            echo $response->getBody()->getContents();
        } catch (\Exception $e) {
            echo json_encode([
                'error' => 'Could not delete annotation: ' . $e->getMessage(),
            ]);
        }
        exit;
    }

    /**
     * Handle GET /scholarflow/exportAnnotations?submissionId=X
     * Displays and downloads the compiled markups report.
     */
    public function exportAnnotations(array $args, $request): void
    {
        $submissionId = (int) $request->getUserVar('submissionId');
        if (!$submissionId) {
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Missing submissionId parameter.']);
            exit;
        }

        $submission = Repo::submission()->get($submissionId);
        $publication = $submission ? $submission->getCurrentPublication() : null;
        $title = $publication ? $publication->getLocalizedTitle() : ('Submission #' . $submissionId);

        try {
            $client = new \GuzzleHttp\Client(['timeout' => 30]);
            $response = $client->post('http://127.0.0.1:8000/api/export_annotations', [
                'json' => [
                    'submission_id' => $submissionId,
                    'title' => $title,
                ],
            ]);
            $body = json_decode($response->getBody()->getContents(), true);
            $markdown = $body['markdown'] ?? '# No comments recorded.';

            $format = $request->getUserVar('format');
            if ($format === 'md') {
                header('Content-Type: text/markdown; charset=utf-8');
                header('Content-Disposition: attachment; filename="ScholarFlow_Markups_Submission_' . $submissionId . '.md"');
                echo $markdown;
                exit;
            }

            // Return full, standalone, beautiful HTML report that opens directly in any browser
            header('Content-Type: text/html; charset=utf-8');
            echo $this->renderMarkupReportHtml($title, $submissionId, $markdown);
        } catch (\Exception $e) {
            header('Content-Type: text/html; charset=utf-8');
            echo "<h1>Export Error</h1><p>" . htmlspecialchars($e->getMessage()) . "</p>";
        }
        exit;
    }

    /**
     * Convert markdown report to rich standalone printable HTML.
     */
    protected function renderMarkupReportHtml(string $title, int $submissionId, string $markdown): string
    {
        $safeTitle = htmlspecialchars($title);
        $body = htmlspecialchars($markdown);
        $body = preg_replace('/^### (.*)$/m', '<h3 class="markup-heading">$1</h3>', $body);
        $body = preg_replace('/^## (.*)$/m', '<h2>$1</h2>', $body);
        $body = preg_replace('/^# (.*)$/m', '<h1>$1</h1>', $body);
        $body = preg_replace('/\*\*(.*?)\*\*/s', '<strong>$1</strong>', $body);
        $body = preg_replace('/^&gt; (.*)$/m', '<blockquote>$1</blockquote>', $body);
        $body = preg_replace('/^- (.*)$/m', '<li>$1</li>', $body);
        $body = preg_replace('/(<li>.*<\/li>)/s', '<ul>$1</ul>', $body);
        $body = nl2br($body);

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ScholarFlow Markups Report - {$safeTitle}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #f8fafc;
    color: #1e293b;
    margin: 0;
    padding: 30px 20px;
    line-height: 1.7;
  }
  .report-wrapper {
    max-width: 880px;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    overflow: hidden;
  }
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1e1b4b;
    color: #ffffff;
    padding: 14px 28px;
  }
  .toolbar-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
    font-size: 15px;
  }
  .toolbar-brand span {
    background: #4f46e5;
    color: #fff;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    letter-spacing: 0.5px;
  }
  .toolbar-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .btn {
    background: #4f46e5;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background 0.2s;
  }
  .btn:hover { background: #4338ca; }
  .btn-outline {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25);
  }
  .btn-outline:hover { background: rgba(255,255,255,0.2); }
  .content-body {
    padding: 36px 44px;
  }
  h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 0; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9; }
  h2 { font-size: 18px; font-weight: 700; color: #1e293b; margin-top: 24px; }
  .markup-heading {
    font-size: 15px;
    font-weight: 800;
    color: #1e293b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #4f46e5;
    padding: 10px 16px;
    border-radius: 8px;
    margin-top: 22px;
  }
  blockquote {
    border-left: 4px solid #eab308;
    background: #fefce8;
    color: #854d0e;
    padding: 12px 18px;
    margin: 12px 0;
    border-radius: 0 8px 8px 0;
    font-style: italic;
  }
  ul { padding-left: 24px; margin: 10px 0; }
  li { margin-bottom: 6px; color: #334155; }
  strong { color: #0f172a; }
  @media print {
    body { background: #fff; padding: 0; }
    .report-wrapper { border: none; box-shadow: none; max-width: 100%; }
    .toolbar { display: none !important; }
    .content-body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="report-wrapper">
    <div class="toolbar">
      <div class="toolbar-brand">
        <span>SCHOLARFLOW</span>
        Peer Review &amp; Markups Report
      </div>
      <div class="toolbar-actions">
        <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <a class="btn btn-outline" href="?submissionId={$submissionId}&format=md" download="ScholarFlow_Markups_Submission_{$submissionId}.md">📥 Download .md</a>
      </div>
    </div>
    <div class="content-body">
      {$body}
    </div>
  </div>
</body>
</html>
HTML;
    }

    /**
     * Handle GET /scholarflow/analyze?submissionId=X
     * (Role-Gated: Authors cannot trigger AI Pre-Screening)
     */
    public function analyze(array $args, $request): void
    {
        @set_time_limit(300);
        header('Content-Type: application/json');

        $user = $request->getUser();
        if (!$user) {
            echo json_encode(['error' => 'You must be logged in to use ScholarFlow AI.']);
            exit;
        }

        $userInfo = $this->getUserRoleInfo($request);
        if ($userInfo['isAuthorOnly']) {
            echo json_encode(['error' => 'AI Pre-Screening is reserved for Journal Editors and Peer Reviewers.']);
            exit;
        }

        $submissionId = (int) $request->getUserVar('submissionId');
        if (!$submissionId) {
            echo json_encode(['error' => 'Missing submissionId parameter.']);
            exit;
        }

        $submission = Repo::submission()->get($submissionId);
        if (!$submission) {
            echo json_encode(['error' => 'Submission #' . $submissionId . ' not found.']);
            exit;
        }

        $filePath = $this->resolveManuscriptFilePath($submissionId);
        if (!$filePath) {
            echo json_encode(['error' => 'No PDF or DOCX file found for this submission.']);
            exit;
        }

        $forceRefresh = (bool) $request->getUserVar('refresh');
        $requestedScope = trim((string) $request->getUserVar('scope'));
        
        // Scope logic:
        // - Reviewers can only re-run for their own private session
        // - Editors can choose 'editor_private' (keep to themselves) or 'global' (apply to all reviewers)
        if ($userInfo['isReviewer'] && !$userInfo['isEditor']) {
            $scope = 'reviewer_private';
        } elseif ($userInfo['isEditor']) {
            $scope = ($requestedScope === 'editor_private') ? 'editor_private' : 'global';
        } else {
            $scope = 'global';
        }

        try {
            $client   = new \GuzzleHttp\Client(['timeout' => 240]);
            $response = $client->post('http://127.0.0.1:8000/api/analyze', [
                'json' => [
                    'file_path' => $filePath,
                    'force_refresh' => $forceRefresh,
                    'user_id' => (int) ($userInfo['id'] ?? 0),
                    'scope' => $scope,
                ],
            ]);
            $body = json_decode($response->getBody()->getContents(), true);
            $body['user'] = $userInfo;
            $body['scope'] = $scope;
            echo json_encode($body);
        } catch (\Exception $e) {
            echo json_encode([
                'error' => 'Could not reach the ScholarFlow Python backend: ' . $e->getMessage(),
            ]);
        }
        exit;
    }

    /**
     * Handle GET /scholarflow/recommendReviewers?submissionId=X
     * (Role-Gated: Only Editors/Managers)
     */
    public function recommendReviewers(array $args, $request): void
    {
        @set_time_limit(300);
        header('Content-Type: application/json');

        $user = $request->getUser();
        if (!$user) {
            echo json_encode(['error' => 'You must be logged in to use ScholarFlow AI.']);
            exit;
        }

        $userInfo = $this->getUserRoleInfo($request);
        if (!$userInfo['isEditor']) {
            echo json_encode(['error' => 'Reviewer recommendations are reserved for Journal Editors.']);
            exit;
        }

        $submissionId = (int) $request->getUserVar('submissionId');
        if (!$submissionId) {
            echo json_encode(['error' => 'Missing submissionId parameter.']);
            exit;
        }

        $submission = Repo::submission()->get($submissionId);
        $context    = $request->getRouter() ? $request->getContext() : null;

        if (!$submission) {
            echo json_encode(['error' => 'Submission #' . $submissionId . ' not found.']);
            exit;
        }

        $publication = $submission->getCurrentPublication();
        if (!$publication) {
            echo json_encode(['error' => 'No publication details found for this submission.']);
            exit;
        }

        $title = $publication->getLocalizedTitle();
        $abstract = strip_tags((string) $publication->getLocalizedData('abstract'));

        if (!$title && !$abstract) {
            echo json_encode(['error' => 'Submission has no title or abstract.']);
            exit;
        }

        $contextId = (int) ($submission->getData('contextId') ?: ($context ? $context->getId() : 1));

        $reviewerUsers = Repo::user()->getCollector()
            ->filterByRoleIds([Role::ROLE_ID_REVIEWER])
            ->filterByContextIds([$contextId])
            ->getMany();

        $candidates = [];
        foreach ($reviewerUsers as $reviewer) {
            // Only exclude self if user is a reviewer (editors can see all)
            if ($userInfo['isReviewer'] && !$userInfo['isEditor'] && $reviewer->getId() === $user->getId()) {
                continue;
            }
            $interests = $reviewer->getInterestString();
            // Fall back to querying controlled vocab directly if getInterestString() returns empty
            if (!$interests) {
                $host = Config::getVar('database', 'host', 'localhost');
                $username = Config::getVar('database', 'username', 'ojsuser');
                $password = Config::getVar('database', 'password', 'Ojs@12345');
                $dbname = Config::getVar('database', 'name', 'ojs');
                try {
                    $interestConn = @new \mysqli($host, $username, $password, $dbname);
                    if ($interestConn && !$interestConn->connect_error) {
                        $uid = (int)$reviewer->getId();
                        $res = $interestConn->query("
                            SELECT GROUP_CONCAT(cves.setting_value ORDER BY cves.setting_value SEPARATOR ', ') as interests
                            FROM user_interests ui
                            JOIN controlled_vocab_entries cve ON cve.controlled_vocab_entry_id = ui.controlled_vocab_entry_id
                            JOIN controlled_vocab_entry_settings cves ON cves.controlled_vocab_entry_id = cve.controlled_vocab_entry_id
                            WHERE ui.user_id = $uid AND cves.setting_name = 'interest'
                            GROUP BY ui.user_id
                        ");
                        if ($res) {
                            $row = $res->fetch_assoc();
                            $interests = $row ? ($row['interests'] ?? '') : '';
                        }
                        $interestConn->close();
                    }
                } catch (\Throwable $te) {
                    // Ignore DB fallback errors
                }
            }
            if (!$interests) {
                $interests = 'General Scholarly Review, Peer Evaluation, Subject Matter Expertise';
            }

            $candidates[] = [
                'id' => (int) $reviewer->getId(),
                'name' => (string) $reviewer->getFullName(),
                'interests' => (string) $interests,
            ];
        }

        if (empty($candidates)) {
            echo json_encode(['error' => 'No active reviewers found in this journal.']);
            exit;
        }

        if (count($candidates) > 35) {
            $candidates = array_slice($candidates, 0, 35);
        }

        $forceRefresh = !empty($request->getUserVar('force_refresh'));

        try {
            $client   = new \GuzzleHttp\Client(['timeout' => 240]);
            $response = $client->post('http://127.0.0.1:8000/api/recommend_reviewers', [
                'json' => [
                    'title' => $title,
                    'abstract' => $abstract,
                    'reviewers' => $candidates,
                    'force_refresh' => $forceRefresh,
                ],
            ]);
            $body = json_decode($response->getBody()->getContents(), true);
            if (!empty($body['recommendations'])) {
                $interestMap = [];
                foreach ($candidates as $c) {
                    $interestMap[$c['id']] = $c['interests'];
                }
                foreach ($body['recommendations'] as &$rec) {
                    if (isset($interestMap[$rec['id']])) {
                        $rec['interests'] = $interestMap[$rec['id']];
                    }
                }
            }
            $body['user'] = $userInfo;
            echo json_encode($body);
        } catch (\Exception $e) {
            echo json_encode([
                'error' => 'Could not reach the ScholarFlow Python backend: ' . $e->getMessage(),
            ]);
        }
    }
}

