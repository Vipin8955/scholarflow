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
            Hook::add('Dashboard::views', $this->simplifyDashboardViews(...));
            Hook::add('LoadHandler', $this->handleRouting(...));
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

        // ── Simplify OJS Navigation and Dashboard Views ──
        $menu = $templateManager->getState('menu');
        if (is_array($menu)) {
            // 1. Remove DOIs and Tools from sidebar
            unset($menu['dois']);
            unset($menu['tools']);

            // 2. Simplify Editor Dashboard sub-queues into two clean views: Active & Archived
            if (isset($menu['dashboards']) && is_array($menu['dashboards'])) {
                $context = $request->getContext();
                $router = $request->getRouter();
                $requestedViewId = $request->getUserVar('currentViewId') ?? 'active';

                $activeCount = 0;
                $archivedCount = 0;
                if ($context) {
                    try {
                        $activeCount = Repo::submission()->getCollector()
                            ->filterByContextIds([$context->getId()])
                            ->filterByStatus([PKPSubmission::STATUS_QUEUED])
                            ->getCount();

                        $archivedCount = Repo::submission()->getCollector()
                            ->filterByContextIds([$context->getId()])
                            ->filterByStatus([PKPSubmission::STATUS_PUBLISHED, PKPSubmission::STATUS_DECLINED])
                            ->getCount();
                    } catch (\Throwable $e) {}
                }

                $newSubmenu = [
                    'active' => [
                        'id' => 'active',
                        'name' => 'Active Submissions',
                        'url' => $router->url($request, null, 'dashboard', 'editorial', null, ['currentViewId' => 'active']),
                        'isCurrent' => ($requestedViewId !== 'archived'),
                        'badge' => ['slot' => (string) $activeCount]
                    ],
                    'archived' => [
                        'id' => 'archived',
                        'name' => 'Archived Submissions',
                        'url' => $router->url($request, null, 'dashboard', 'editorial', null, ['currentViewId' => 'archived']),
                        'isCurrent' => ($requestedViewId === 'archived'),
                        'badge' => ['slot' => (string) $archivedCount]
                    ]
                ];

                // Preserve "Start A New Submission" if present
                if (isset($menu['dashboards']['submenu']['newSubmission'])) {
                    $newSubmenu['newSubmission'] = $menu['dashboards']['submenu']['newSubmission'];
                }

                $menu['dashboards']['submenu'] = $newSubmenu;
            }

            $templateManager->setState(['menu' => $menu]);
        }

        // Also simplify pageInitConfig views for DashboardPage
        $pageInitConfig = $templateManager->getState('pageInitConfig');
        if (is_array($pageInitConfig) && isset($pageInitConfig['views'])) {
            $context = $request->getContext();
            $activeCount = 0;
            $archivedCount = 0;
            if ($context) {
                try {
                    $activeCount = Repo::submission()->getCollector()
                        ->filterByContextIds([$context->getId()])
                        ->filterByStatus([PKPSubmission::STATUS_QUEUED])
                        ->getCount();

                    $archivedCount = Repo::submission()->getCollector()
                        ->filterByContextIds([$context->getId()])
                        ->filterByStatus([PKPSubmission::STATUS_PUBLISHED, PKPSubmission::STATUS_DECLINED])
                        ->getCount();
                } catch (\Throwable $e) {}
            }

            $pageInitConfig['views'] = [
                [
                    'id' => 'active',
                    'name' => 'Active Submissions',
                    'count' => $activeCount,
                    'queryParams' => [
                        'status' => [PKPSubmission::STATUS_QUEUED]
                    ]
                ],
                [
                    'id' => 'archived',
                    'name' => 'Archived Submissions',
                    'count' => $archivedCount,
                    'queryParams' => [
                        'status' => [PKPSubmission::STATUS_PUBLISHED, PKPSubmission::STATUS_DECLINED]
                    ]
                ]
            ];
            $templateManager->setState(['pageInitConfig' => $pageInitConfig]);
        }

        return Hook::CONTINUE;
    }

    /**
     * Filter Dashboard views hook so that any handler querying Dashboard views
     * receives only the two clean views: Active Submissions & Archived Submissions.
     */
    public function simplifyDashboardViews(string $hookName, array $args): bool
    {
        $viewsData = &$args[0];
        $request = Application::get()->getRequest();
        $context = $request ? $request->getContext() : null;
        if (!$context) {
            return Hook::CONTINUE;
        }

        $activeCount = 0;
        $archivedCount = 0;
        try {
            $activeCount = Repo::submission()->getCollector()
                ->filterByContextIds([$context->getId()])
                ->filterByStatus([PKPSubmission::STATUS_QUEUED])
                ->getCount();

            $archivedCount = Repo::submission()->getCollector()
                ->filterByContextIds([$context->getId()])
                ->filterByStatus([PKPSubmission::STATUS_PUBLISHED, PKPSubmission::STATUS_DECLINED])
                ->getCount();
        } catch (\Throwable $e) {}

        $viewsData = [
            [
                'id' => 'active',
                'name' => 'Active Submissions',
                'count' => $activeCount,
                'queryParams' => [
                    'status' => [PKPSubmission::STATUS_QUEUED]
                ]
            ],
            [
                'id' => 'archived',
                'name' => 'Archived Submissions',
                'count' => $archivedCount,
                'queryParams' => [
                    'status' => [PKPSubmission::STATUS_PUBLISHED, PKPSubmission::STATUS_DECLINED]
                ]
            ]
        ];

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
