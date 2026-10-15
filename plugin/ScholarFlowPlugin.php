<?php

/**
 * @file plugins/generic/scholarflow/ScholarFlowPlugin.php
 *
 * ScholarFlow AI Publishing Assistant for OJS 3.5
 * Injects AI manuscript pre-screening into the editorial workflow.
 */

namespace APP\plugins\generic\scholarflow;

use APP\core\Application;
use PKP\plugins\GenericPlugin;
use PKP\plugins\Hook;

class ScholarFlowPlugin extends GenericPlugin
{
    public function register($category, $path, $mainContextId = null): bool
    {
        if (parent::register($category, $path, $mainContextId)) {
            // Always attach assets and routes so all roles (Editor, Reviewer, Manager) can access ScholarFlow
            Hook::add('TemplateManager::display', $this->registerAssets(...));
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
