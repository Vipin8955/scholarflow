<?php

/**
 * @file pages/index/IndexHandler.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class IndexHandler
 *
 * @ingroup pages_index
 *
 * @brief Handle site index requests.
 */

namespace APP\pages\index;

use APP\core\Application;
use APP\facades\Repo;
use APP\journal\JournalDAO;
use APP\observers\events\UsageEvent;
use APP\pages\issue\IssueHandler;
use APP\template\TemplateManager;
use PKP\config\Config;
use PKP\db\DAORegistry;
use PKP\pages\index\PKPIndexHandler;
use PKP\security\Role;
use PKP\security\Validation;
use PKP\userGroup\UserGroup;

class IndexHandler extends PKPIndexHandler
{
    //
    // Public handler operations
    //
    /**
     * If no journal is selected, display list of journals.
     * Otherwise, display the index page for the selected journal.
     *
     * @param array $args
     * @param \APP\core\Request $request
     */
    public function index($args, $request)
    {
        $this->validate(null, $request);
        $journal = $request->getJournal();

        if (!$journal) {
            $hasNoContexts = null; // Avoid scrutinizer warnings
            $journal = $this->getTargetContext($request, $hasNoContexts);
            if ($journal) {
                // There's a target context but no journal in the current request. Redirect.
                $request->redirect($journal->getPath());
            }
            if ($hasNoContexts && Validation::isSiteAdmin()) {
                // No contexts created, and this is the admin.
                $request->redirect(null, 'admin', 'contexts');
            }
        }

        $this->setupTemplate($request);
        $router = $request->getRouter();
        $templateMgr = TemplateManager::getManager($request);
        $templateMgr->assign([
            'highlights' => $this->getHighlights($journal),
        ]);

        $this->_setupAnnouncements($journal ?? $request->getSite(), $templateMgr);
        $journalDao = DAORegistry::getDAO('JournalDAO');
        $allJournals = $journalDao->getAll(true)->toArray();
        $templateMgr->assign('allJournals', $allJournals);

        if ($journal) {
            // Assign header and content for home page
            $templateMgr->assign([
                'additionalHomeContent' => $journal->getLocalizedData('additionalHomeContent'),
                'homepageImage' => $journal->getLocalizedData('homepageImage'),
                'homepageImageAltText' => $journal->getLocalizedData('homepageImageAltText'),
                'journalDescription' => $journal->getLocalizedData('description'),
            ]);

            $user = $request->getUser();
            $hasEditorialRole = false;
            if ($user) {
                $roleDao = DAORegistry::getDAO('RoleDAO');
                $roles = $roleDao->getByUserId($user->getId(), $journal->getId());
                foreach ($roles as $role) {
                    if (in_array($role->getRoleId(), [Role::ROLE_ID_MANAGER, Role::ROLE_ID_SITE_ADMIN, Role::ROLE_ID_SUB_EDITOR, Role::ROLE_ID_ASSISTANT])) {
                        $hasEditorialRole = true;
                        break;
                    }
                }
            }
            $templateMgr->assign('hasEditorialRole', $hasEditorialRole);

            // Retrieve all published/active submissions for this specific journal so readers can view its publications
            $journalSubmissions = [];
            try {
                $submissions = Repo::submission()->getCollector()
                    ->filterByContextIds([$journal->getId()])
                    ->getMany();
                $journalSubmissions = iterator_to_array($submissions);
            } catch (\Throwable $se) {}
            $templateMgr->assign('journalSubmissions', $journalSubmissions);

            try {
                $authorUserGroups = UserGroup::withRoleIds([Role::ROLE_ID_AUTHOR])
                    ->withContextIds([$journal->getId()])
                    ->get();
                $templateMgr->assign('authorUserGroups', $authorUserGroups);
            } catch (\Throwable $e) {}

            $issue = Repo::issue()->getCurrent($journal->getId(), true);
            if (isset($issue) && $journal->getData('publishingMode') != \APP\journal\Journal::PUBLISHING_MODE_NONE) {
                // The current issue TOC/cover page should be displayed below the custom home page.
                IssueHandler::_setupIssueTemplate($request, $issue);
            }

            $templateMgr->display('frontend/pages/indexJournal.tpl');
            event(new UsageEvent(Application::ASSOC_TYPE_JOURNAL, $journal));
            return;
        } else {
            $journalDao = DAORegistry::getDAO('JournalDAO'); /** @var JournalDAO $journalDao */
            $site = $request->getSite();

            if ($site->getRedirect() && ($journal = $journalDao->getById($site->getRedirect())) != null) {
                $request->redirect($journal->getPath());
            }

            $templateMgr->assign([
                'pageTitleTranslated' => $site->getLocalizedTitle(),
                'about' => $site->getLocalizedAbout(),
                'journalFilesPath' => $request->getBaseUrl() . '/' . Config::getVar('files', 'public_files_dir') . '/journals/',
                'journals' => $journalDao->getAll(true)->toArray(),
                'site' => $site,
            ]);
            $templateMgr->setCacheability(TemplateManager::CACHEABILITY_PUBLIC);
            $templateMgr->display('frontend/pages/indexSite.tpl');
        }
    }
}
