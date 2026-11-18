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
            $user = $request->getUser();
            if ($user) {
                $journalDao = \PKP\db\DAORegistry::getDAO('JournalDAO');
                if ($journalDao) {
                    $templateManager->assign('allJournals', $journalDao->getAll(true)->toArray());
                }
            } else {
                $templateManager->assign('allJournals', []);
            }
        } catch (\Throwable $te) {}

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
