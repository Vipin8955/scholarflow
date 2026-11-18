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

            // Retrieve Top 3 Completed/Published Journals dynamically from OJS Database
            $pdo = \Illuminate\Support\Facades\DB::connection()->getPdo();
            if ($pdo) {
                $sql = "
                    SELECT j.journal_id, j.path,
                           latest_i.issue_id, latest_i.volume, latest_i.number, latest_i.year, latest_i.date_published,
                           it.setting_value AS issue_title,
                           jn.setting_value AS journal_name,
                           jd.setting_value AS journal_desc,
                           ja.setting_value AS journal_acronym,
                           jab.setting_value AS journal_abbrev
                    FROM journals j
                    INNER JOIN (
                        SELECT journal_id, MAX(issue_id) AS max_issue_id
                        FROM issues
                        WHERE published = 1
                        GROUP BY journal_id
                    ) mi ON j.journal_id = mi.journal_id
                    INNER JOIN issues latest_i ON mi.max_issue_id = latest_i.issue_id
                    LEFT JOIN issue_settings it ON latest_i.issue_id = it.issue_id AND it.setting_name = 'title'
                    LEFT JOIN journal_settings jn ON j.journal_id = jn.journal_id AND jn.setting_name = 'name'
                    LEFT JOIN journal_settings jd ON j.journal_id = jd.journal_id AND jd.setting_name = 'description'
                    LEFT JOIN journal_settings ja ON j.journal_id = ja.journal_id AND ja.setting_name = 'acronym'
                    LEFT JOIN journal_settings jab ON j.journal_id = jab.journal_id AND jab.setting_name = 'abbreviation'
                    WHERE j.enabled = 1
                    ORDER BY latest_i.date_published DESC, j.journal_id ASC
                    LIMIT 3
                ";
                $stmt = $pdo->query($sql);
                $topJournalsRaw = $stmt ? $stmt->fetchAll(\PDO::FETCH_ASSOC) : [];
                $topCompletedJournals = [];
                $dispatcher = $request->getDispatcher();

                $categoryMap = [
                    'jcs' => 'Computer Science & Cybersecurity',
                    'jeas' => 'Environmental & Agricultural Sciences',
                    'jms' => 'Medical & Surgical Innovations',
                    'jast' => 'Applied Science & Engineering',
                    'jbms' => 'Biomedical Engineering',
                    'test' => 'Interdisciplinary Studies'
                ];

                foreach ($topJournalsRaw as $row) {
                    $jPath = $row['path'];
                    $journalUrl = $dispatcher ? $dispatcher->url($request, Application::ROUTE_PAGE, $jPath, 'index') : ($baseUrl . '/index.php/' . $jPath);
                    $cleanDesc = trim(strip_tags($row['journal_desc'] ?? ''));
                    if (empty($cleanDesc)) {
                        $cleanDesc = 'A peer-reviewed academic journal published under ScholarFlow Open Access guidelines.';
                    }

                    $volInfo = '';
                    if (!empty($row['volume'])) {
                        $volInfo = 'Vol. ' . $row['volume'];
                        if (!empty($row['number'])) {
                            $volInfo .= ' No. ' . $row['number'];
                        }
                        if (!empty($row['year'])) {
                            $volInfo .= ' (' . $row['year'] . ')';
                        }
                    } elseif (!empty($row['issue_title'])) {
                        $volInfo = $row['issue_title'];
                    }

                    $topCompletedJournals[] = [
                        'journal_id' => $row['journal_id'],
                        'path' => $jPath,
                        'name' => $row['journal_name'] ?? ucfirst($jPath),
                        'acronym' => $row['journal_acronym'] ?? strtoupper($jPath),
                        'abbreviation' => $row['journal_abbrev'] ?? '',
                        'description' => $cleanDesc,
                        'category' => $categoryMap[$jPath] ?? 'Scholarly Research',
                        'volume_info' => $volInfo,
                        'issue_title' => $row['issue_title'] ?? '',
                        'url' => $journalUrl,
                        'cover_url' => null
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
