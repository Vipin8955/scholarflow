<?php

/**
 * @file plugins/generic/scholarflow/ScholarFlowPlugin.php
 *
 * ScholarFlow AI Publishing Assistant for OJS 3.5
 * Injects AI manuscript pre-screening into the editorial workflow.
 */

namespace APP\plugins\generic\scholarflow;

use APP\core\Application;
use APP\facades\Repo;
use PKP\plugins\GenericPlugin;
use PKP\plugins\Hook;
use PKP\submission\PKPSubmission;

class ScholarFlowPlugin extends GenericPlugin
{
    public function register($category, $path, $mainContextId = null): bool
    {
        if (parent::register($category, $path, $mainContextId)) {
            // Always attach assets and routes so all roles (Editor, Reviewer, Manager) can access ScholarFlow
            Hook::add('TemplateManager::display', $this->registerAssets(...));
            Hook::add('LoadHandler', $this->handleRouting(...));
            Hook::add('Request::getProtocol', function (string $hookName, array $args): bool {
                if (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') {
                    $protocol = &$args[0];
                    $protocol = 'https';
                }
                return Hook::CONTINUE;
            });
            return true;
        }
        return false;
    }

    /**
     * Always enable ScholarFlow across all journals and site contexts.
     */
    public function getEnabled($contextId = null): bool
    {
        return true;
    }

    /**
     * Inject scholarflow.js and scholarflow.css into both backend and frontend templates.
     * Also simplifies the backend sidebar menu (removing DOIs, Tools) and reduces the
     * 14 sub-queues down to two clean views: Active Submissions & Archived Submissions.
     */
    public function registerAssets(string $hookName, array $args): bool
    {
        $templateManager = &$args[0];
        $request = Application::get()->getRequest();
        $baseUrl = $request->getBaseUrl();
        $pluginPath = $this->getPluginPath();

        $templateManager->addJavaScript(
            'scholarflowJS',
            $baseUrl . '/' . $pluginPath . '/js/scholarflow.js?v=' . time(),
            ['contexts' => ['backend', 'frontend']]
        );

        $templateManager->addStyleSheet(
            'scholarflowCSS',
            $baseUrl . '/' . $pluginPath . '/css/scholarflow.css?v=' . time(),
            ['contexts' => ['backend', 'frontend']]
        );

        try {
            $journalDao = \PKP\db\DAORegistry::getDAO('JournalDAO');
            if ($journalDao) {
                $templateManager->assign('allJournals', $journalDao->getAll(true)->toArray());
            }

            // Retrieve Top 3 Completed Journals dynamically based on actual project completion data
            $pdo = \Illuminate\Support\Facades\DB::connection()->getPdo();
            if ($pdo) {
                $sql = "
                    SELECT j.journal_id, j.path,
                           (SELECT setting_value FROM journal_settings WHERE journal_id = j.journal_id AND setting_name = 'name' LIMIT 1) AS journal_name,
                           (SELECT setting_value FROM journal_settings WHERE journal_id = j.journal_id AND setting_name = 'acronym' LIMIT 1) AS journal_acronym,
                           (SELECT setting_value FROM journal_settings WHERE journal_id = j.journal_id AND setting_name = 'abbreviation' LIMIT 1) AS journal_abbrev,
                           (SELECT setting_value FROM journal_settings WHERE journal_id = j.journal_id AND setting_name = 'description' LIMIT 1) AS journal_desc,
                           (SELECT COUNT(*) FROM submissions WHERE context_id = j.journal_id) AS total_submissions,
                           (SELECT COUNT(*) FROM review_assignments ra JOIN submissions s ON ra.submission_id = s.submission_id WHERE s.context_id = j.journal_id) AS total_reviews,
                           (SELECT COUNT(*) FROM edit_decisions ed JOIN submissions s ON ed.submission_id = s.submission_id WHERE s.context_id = j.journal_id) AS total_decisions,
                           (SELECT ps.setting_value FROM submissions s 
                            JOIN publications p ON s.current_publication_id = p.publication_id 
                            JOIN publication_settings ps ON p.publication_id = ps.publication_id AND ps.setting_name = 'title' 
                            WHERE s.context_id = j.journal_id 
                            ORDER BY s.submission_id DESC LIMIT 1) AS latest_article_title
                    FROM journals j
                    WHERE j.enabled = 1
                    ORDER BY total_submissions DESC, 
                             (CASE WHEN (SELECT setting_value FROM journal_settings WHERE journal_id = j.journal_id AND setting_name = 'description' LIMIT 1) IS NOT NULL 
                                        AND (SELECT setting_value FROM journal_settings WHERE journal_id = j.journal_id AND setting_name = 'description' LIMIT 1) != ''
                                        AND (SELECT setting_value FROM journal_settings WHERE journal_id = j.journal_id AND setting_name = 'description' LIMIT 1) NOT LIKE '%test journal%' 
                                   THEN 2 
                                   WHEN (SELECT setting_value FROM journal_settings WHERE journal_id = j.journal_id AND setting_name = 'description' LIMIT 1) IS NOT NULL 
                                        AND (SELECT setting_value FROM journal_settings WHERE journal_id = j.journal_id AND setting_name = 'description' LIMIT 1) != ''
                                   THEN 1 
                                   ELSE 0 END) DESC,
                             total_reviews DESC, 
                             j.journal_id ASC
                    LIMIT 6
                ";
                $stmt = $pdo->query($sql);
                $topJournalsRaw = $stmt ? $stmt->fetchAll(\PDO::FETCH_ASSOC) : [];
                $topCompletedJournals = [];
                $dispatcher = $request->getDispatcher();

                $categoryMap = [
                    'test' => 'Interdisciplinary Science & Technology',
                    'jcs'  => 'Computer Science & Cybersecurity',
                    'jms'  => 'Medical & Surgical Innovations',
                    'jeas' => 'Environmental & Agricultural Sciences',
                    'jbms' => 'Biomedical Engineering',
                    'jast' => 'Applied Science & Engineering'
                ];

                foreach ($topJournalsRaw as $row) {
                    $jPath = $row['path'];
                    $journalUrl = $dispatcher ? $dispatcher->url($request, Application::ROUTE_PAGE, $jPath, 'index') : ($baseUrl . '/index.php/' . $jPath);
                    $cleanDesc = trim(strip_tags($row['journal_desc'] ?? ''));
                    if (empty($cleanDesc) || $cleanDesc === 'None') {
                        $cleanDesc = 'A peer-reviewed academic journal published under ScholarFlow Open Access guidelines.';
                    }

                    $subsCount = (int) ($row['total_submissions'] ?? 0);
                    $reviewsCount = (int) ($row['total_reviews'] ?? 0);
                    $decisionsCount = (int) ($row['total_decisions'] ?? 0);

                    // Authentic, distinct completion status per journal
                    if ($subsCount > 1) {
                        $statusBadge = $subsCount . ' Manuscripts • Active Review';
                    } elseif ($decisionsCount > 0) {
                        $statusBadge = 'Editorial Decision Recorded';
                    } elseif ($reviewsCount > 0) {
                        $statusBadge = 'Peer Review Completed';
                    } elseif ($subsCount === 1) {
                        $statusBadge = 'Active Submission • Review Stage';
                    } else {
                        $statusBadge = 'Editorial Board Established';
                    }

                    $topCompletedJournals[] = [
                        'journal_id' => $row['journal_id'],
                        'path' => $jPath,
                        'name' => $row['journal_name'] ?? ucfirst($jPath),
                        'acronym' => $row['journal_acronym'] ?? strtoupper($jPath),
                        'abbreviation' => $row['journal_abbrev'] ?? '',
                        'description' => $cleanDesc,
                        'category' => $categoryMap[$jPath] ?? 'Scholarly Research',
                        'status_badge' => $statusBadge,
                        'total_submissions' => $subsCount,
                        'latest_article' => $row['latest_article_title'] ?? '',
                        'url' => $journalUrl
                    ];
                }
                $templateManager->assign('topCompletedJournals', $topCompletedJournals);
            }
        } catch (\Throwable $te) {
            $templateManager->assign('topCompletedJournals', []);
        }

        $router = $request->getRouter();
        $requestedPage = ($router && method_exists($router, 'getRequestedPage')) ? (string) $router->getRequestedPage($request) : '';
        $requestedOp = ($router && method_exists($router, 'getRequestedOp')) ? (string) $router->getRequestedOp($request) : '';

        // Assign platform stats and journals when accessing admin console
        if ($requestedPage === 'admin') {
            try {
                $pdo = \Illuminate\Support\Facades\DB::connection()->getPdo();
                $journalDao = \APP\core\Application::getContextDao();
                $allJournals = iterator_to_array($journalDao->getAll(true)->toIterator());
                $templateManager->assign([
                    'allJournals' => $allJournals,
                    'adminStatJournals' => count($allJournals),
                    'adminStatUsers' => $pdo ? (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() : 0,
                    'adminStatSubmissions' => $pdo ? (int) $pdo->query('SELECT COUNT(*) FROM submissions')->fetchColumn() : 0,
                ]);
            } catch (\Throwable $e) {}
        }

        // ── Preserve all OJS Navigation Features and Options in ScholarFlow Top Bar ──
        $menu = $templateManager->getState('menu');
        if (is_array($menu)) {
            // Only remove "Start A New Submission" from Editor Dashboard submenu so it does not clutter editor queues
            // For Authors (mySubmissions), newSubmission must remain available!
            if ($requestedOp === 'editorial' && isset($menu['dashboards']['submenu']['newSubmission'])) {
                unset($menu['dashboards']['submenu']['newSubmission']);
            }

            $templateManager->setState(['menu' => $menu]);
            $templateManager->assign('sfMenu', $menu);
        }

        return Hook::CONTINUE;
    }

    /**
     * Intercept requests to /scholarflow/* and hand off to ScholarFlowHandler.
     */
    public function handleRouting(string $hookName, array $args): bool
    {
        $page    = &$args[0];
        $op      = &$args[1];
        $handler = &$args[3];

        if ($page !== 'scholarflow') {
            return Hook::CONTINUE;
        }

        // Use the absolute path so it resolves regardless of CWD
        require_once BASE_SYS_DIR . '/' . $this->getPluginPath() . '/ScholarFlowHandler.php';
        $handler = new ScholarFlowHandler($this);
        return Hook::ABORT;
    }

    public function getDisplayName(): string
    {
        return 'ScholarFlow AI Publishing Assistant';
    }

    public function getDescription(): string
    {
        return 'Extends OJS with intelligent manuscript pre-screening and automated reviewer matchmaking.';
    }
}
