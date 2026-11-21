{**
 * templates/frontend/pages/indexJournal.tpl
 * ScholarFlow Modern Academic Journal Homepage
 * Strictly renders real OJS journal data, active manuscripts in this journal, and network exploration
 *}
{include file="frontend/components/header.tpl" pageTitleTranslated=$currentJournal->getLocalizedName()}

<div class="page_index_journal sf_journal_home">

	{* 1. Hero Section *}
	<header class="sf_hero_masthead">
		<div class="sf_hero_grid">
			{* Left Side: Journal Information *}
			<div class="sf_hero_content">
				<div class="sf_hero_badge">
					<span class="sf_hero_badge_icon">⚡</span>
					<span class="sf_hero_badge_text">ScholarFlow PLATFORM</span>
				</div>

				<h1 class="sf_hero_title">
					{$currentJournal->getLocalizedName()|escape}
				</h1>

				{if $currentJournal->getLocalizedDescription()}
					<div class="sf_hero_desc">
						{$currentJournal->getLocalizedDescription()}
					</div>
				{else}
					<div class="sf_hero_desc">
						A peer-reviewed academic journal published under ScholarFlow Open Access guidelines, advancing rigorous research, interdisciplinary collaboration, and global scholarly communication.
					</div>
				{/if}

				<div class="sf_hero_actions">
					<a href="{url page="submission" op="wizard"}" class="sf_btn_hero_primary">
						<span>Submit a Manuscript</span>
						<span class="sf_btn_arrow">&rarr;</span>
					</a>
					<a href="{url page="about" op="submissions"}" class="sf_btn_hero_secondary">
						Author Guidelines
					</a>
					<a href="{url page="about" op="editorialMasthead"}" class="sf_btn_hero_secondary">
						Editorial Board
					</a>
					{if $currentUser}
						<a href="{url page="dashboard"}" class="sf_btn_hero_dashboard">
							<span>Editorial Dashboard</span>
							<span>&rarr;</span>
						</a>
					{/if}
				</div>
			</div>


		</div>
	</header>

	{* 2. PRIMARY CONTENT: Research Publications & Manuscripts in THIS Journal *}
	<section class="sf_journal_section sf_submissions_section" style="margin-top:20px;padding-top:10px;border-top:none;">
		<div class="sf_section_header" style="margin-bottom:18px;">
			<div>
				<div style="display:inline-flex;align-items:center;gap:6px;background:#e0e7ff;color:#4338ca;font-size:11px;font-weight:700;letter-spacing:0.05em;padding:3px 9px;border-radius:5px;margin-bottom:8px;">
					<span>PEER-REVIEWED RESEARCH</span>
				</div>
				<h2 class="sf_section_title" style="display:flex;align-items:center;gap:12px;font-size:22px;font-weight:800;color:#0f172a;">
					<span>Research Publications &amp; Manuscripts</span>
					{if $journalSubmissions && count($journalSubmissions)}
						<span style="font-size:12px;font-weight:700;background:#f1f5f9;color:#334155;padding:3px 10px;border-radius:12px;border:1px solid #cbd5e1;">{count($journalSubmissions)}</span>
					{/if}
				</h2>
			</div>
			{if $currentUser && $hasEditorialRole}
				<a href="{url page="dashboard"}" class="sf_archive_link" style="white-space:nowrap;font-weight:600;">
					Editorial Dashboard &rarr;
				</a>
			{/if}
		</div>

		{if $journalSubmissions && count($journalSubmissions)}
			<div class="sf_manuscripts_list" style="display:flex;flex-direction:column;gap:14px;">
				{foreach from=$journalSubmissions item=sub}
					{assign var=pub value=$sub->getCurrentPublication()}
					{if $pub}
						<div class="sf_manuscript_row" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:22px 26px;display:flex;align-items:center;justify-content:space-between;gap:24px;box-shadow:0 1px 3px rgba(0,0,0,0.02);transition:all 0.15s ease;" onmouseenter="this.style.borderColor='#cbd5e1';this.style.boxShadow='0 4px 14px rgba(0,0,0,0.05)'" onmouseleave="this.style.borderColor='#e2e8f0';this.style.boxShadow='0 1px 3px rgba(0,0,0,0.02)'">
							<div style="flex:1;min-width:0;">
								<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
									<span style="font-family:monospace;font-size:12px;font-weight:700;color:#475569;background:#f1f5f9;padding:2px 8px;border-radius:6px;border:1px solid #e2e8f0;">#{$sub->getId()}</span>
									{if $sub->getData('status') == 3}
										<span style="font-size:11.5px;font-weight:700;background:#dcfce7;color:#166534;padding:2px 9px;border-radius:6px;">Published</span>
									{elseif $sub->getData('status') == 4}
										<span style="font-size:11.5px;font-weight:700;background:#fee2e2;color:#991b1b;padding:2px 9px;border-radius:6px;">Declined</span>
									{else}
										<span style="font-size:11.5px;font-weight:600;background:#fef3c7;color:#92400e;padding:2px 9px;border-radius:6px;">Active &bull; Peer Review Stage</span>
									{/if}
									{if $sub->getData('dateSubmitted')}
										<span style="font-size:12px;color:#94a3b8;">
											Submitted {$sub->getData('dateSubmitted')|date_format:$dateFormatShort}
										</span>
									{/if}
									<span style="font-size:11px;font-weight:700;background:#eef2ff;color:#4338ca;padding:2px 8px;border-radius:5px;">Open Access</span>
								</div>

								<h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 8px 0;line-height:1.4;">
									{$pub->getLocalizedTitle()|escape}
								</h3>

								<div style="font-size:13.5px;color:#64748b;display:flex;align-items:center;gap:6px;">
									<span>👤</span>
									<span style="font-weight:600;color:#334155;">
										{if $authorUserGroups && $pub->getAuthorString($authorUserGroups)}
											{$pub->getAuthorString($authorUserGroups)|escape}
										{elseif $pub->getData('authors')}
											{foreach from=$pub->getData('authors') item=author name=authorLoop}{$author->getFullName()|escape}{if !$smarty.foreach.authorLoop.last}, {/if}{/foreach}
										{else}
											Contributing Researcher
										{/if}
									</span>
								</div>
							</div>

							<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap;">
								<button type="button" onclick="window.__sfOpenInScreenReader('{$sub->getId()}', 'viewer')" style="background:#0f172a;color:#ffffff;border:1px solid #0f172a;border-radius:7px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease;" onmouseenter="this.style.background='#1e293b'" onmouseleave="this.style.background='#0f172a'">
									<span>📖</span> <span>Document &amp; Markups</span>
								</button>
								{if $currentUser && $hasEditorialRole}
									<button type="button" onclick="window.__sfOpenInScreenReader('{$sub->getId()}', 'prescreen')" title="AI Manuscript Pre-Screening Evaluation" style="background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;border-radius:7px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease;" onmouseenter="this.style.background='#f8fafc';this.style.borderColor='#94a3b8'" onmouseleave="this.style.background='#ffffff';this.style.borderColor='#cbd5e1'">
										<span>📋</span> <span>Pre-Screen</span>
									</button>
									<button type="button" onclick="window.__sfOpenInScreenReader('{$sub->getId()}', 'reviewers')" title="AI Reviewer Matchmaking" style="background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;border-radius:7px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease;" onmouseenter="this.style.background='#f8fafc';this.style.borderColor='#94a3b8'" onmouseleave="this.style.background='#ffffff';this.style.borderColor='#cbd5e1'">
										<span>👥</span> <span>Match Reviewers</span>
									</button>
								{/if}
							</div>
						</div>
					{/if}
				{/foreach}
			</div>
		{else}
			<div style="background:#ffffff;border:1px dashed #cbd5e1;border-radius:12px;padding:36px 28px;text-align:center;">
				<div style="font-size:32px;margin-bottom:10px;">📄</div>
				<h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 6px 0;">Accepting Submissions</h3>
				<p style="font-size:14px;color:#64748b;margin:0 0 16px 0;max-width:540px;margin-left:auto;margin-right:auto;line-height:1.5;">
					{$currentJournal->getLocalizedName()|escape} is actively accepting new scholarly manuscripts. Authors may submit their research to begin the double-blind peer review process.
				</p>
				<a href="{url page="submission" op="wizard"}" class="sf_btn_primary" style="display:inline-flex;">
					Submit a Manuscript to this Journal &rarr;
				</a>
			</div>
		{/if}
	</section>

	{* 3. Optional Homepage Image *}
	{if $homepageImage}
		<div class="sf_homepage_image" style="margin-top:24px;">
			<img src="{$publicFilesDir}/{$homepageImage.uploadName|escape:"url"}" alt="{$homepageImageAltText|escape}">
		</div>
	{/if}

	{* 4. Real Published Issues (Only renders if an issue exists in OJS) *}
	{if $issue}
		<section class="sf_journal_section sf_current_issue" style="margin-top:32px;">
			<div class="sf_section_header">
				<h2 class="sf_section_title">
					{translate key="journal.currentIssue"}: {$issue->getIssueIdentification()|escape}
				</h2>
				<a href="{url router=PKP\core\PKPApplication::ROUTE_PAGE page="issue" op="archive"}" class="sf_archive_link">
					{translate key="journal.viewAllIssues"} &rarr;
				</a>
			</div>
			<div class="sf_toc_container">
				{include file="frontend/objects/issue_toc.tpl" heading="h3"}
			</div>
		</section>
	{/if}

	{* 5. Real Announcements (Only renders if configured and present) *}
	{if $numAnnouncementsHomepage && count($announcements)}
		<section class="sf_journal_section sf_announcements" style="margin-top:32px;">
			<h2 class="sf_section_title">
				{translate key="announcement.announcements"}
			</h2>
			{include file="frontend/objects/announcements_list.tpl" numAnnouncements=$numAnnouncementsHomepage}
		</section>
	{/if}

	{* 6. Real Additional Homepage Content (Configured in OJS settings) *}
	{if $additionalHomeContent}
		<section class="sf_journal_section sf_additional_content" style="margin-top:32px;">
			{$additionalHomeContent}
		</section>
	{/if}

	{* 7. NETWORK EXPLORATION: Explore Other Journals on ScholarFlow *}
	<section class="sf_explore_journals_section" style="margin-top:48px;padding-top:32px;border-top:1px solid #e2e8f0;">
		<div class="sf_explore_header">
			<div class="sf_explore_badge">
				<span class="sf_explore_badge_dot"></span>
				<span class="sf_explore_badge_text">SCHOLARFLOW NETWORK</span>
			</div>
			<h2 class="sf_explore_title">Explore Other Journals on ScholarFlow</h2>
			<p class="sf_explore_subtitle">
				Discover other peer-reviewed academic journals hosted across the ScholarFlow publishing platform.
			</p>
		</div>

		{if $topCompletedJournals && count($topCompletedJournals) > 0}
			{assign var=shownCount value=0}
			<div class="sf_journals_grid">
				{foreach from=$topCompletedJournals item=j}
					{if $j.path != $currentJournal->getPath() && $shownCount < 3}
						{assign var=shownCount value=$shownCount+1}
						<article class="sf_journal_card">
							<div class="sf_card_body">
								<div class="sf_card_meta_strip">
									<span class="sf_card_category">{$j.category|escape}</span>
									{if $j.status_badge}
										<span class="sf_card_status_badge">{$j.status_badge|escape}</span>
									{/if}
								</div>

								<h3 class="sf_card_title">
									<a href="{$j.url|escape}" class="sf_card_title_link">
										{$j.name|escape}
									</a>
								</h3>

								<div class="sf_card_meta_sub">
									<span class="sf_card_acronym_pill">{$j.acronym|escape}</span>
									<span class="sf_card_dot">&bull;</span>
									<span class="sf_card_access_pill">Open Access</span>
									{if $j.total_submissions > 0}
										<span class="sf_card_dot">&bull;</span>
										<span class="sf_card_subs_count">{$j.total_submissions} {if $j.total_submissions == 1}Manuscript{else}Manuscripts{/if}</span>
									{/if}
								</div>

								<p class="sf_card_desc">
									{$j.description|escape}
								</p>

								{if $j.latest_article}
									<div class="sf_card_article_preview">
										<div class="sf_article_label">Recent Research Manuscript:</div>
										<div class="sf_article_title">&ldquo;{$j.latest_article|escape}&rdquo;</div>
									</div>
								{/if}

								<div class="sf_card_actions">
									<a href="{$j.url|escape}" class="sf_btn_view_journal">
										<span>View Journal</span>
										<span class="sf_btn_arrow">&rarr;</span>
									</a>
								</div>
							</div>
						</article>
					{/if}
				{/foreach}
			</div>
		{/if}
	</section>

</div><!-- .page_index_journal -->

{include file="frontend/components/footer.tpl"}
