{**
 * templates/frontend/pages/indexJournal.tpl
 * ScholarFlow Modern Academic Journal Homepage
 * Strictly renders real OJS journal data, dynamic top completed journals, and brand visual
 *}
{include file="frontend/components/header.tpl" pageTitleTranslated=$currentJournal->getLocalizedName()}

<div class="page_index_journal sf_journal_home">

	{* 1. Redesigned Two-Column Hero Section *}
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

				<div class="sf_hero_features_strip">
					<div class="sf_hero_feat_item">
						<span class="sf_feat_check">✓</span>
						<span>Double-Blind Peer Review</span>
					</div>
					<div class="sf_hero_feat_item">
						<span class="sf_feat_check">✓</span>
						<span>Immediate Open Access</span>
					</div>
					<div class="sf_hero_feat_item">
						<span class="sf_feat_check">✓</span>
						<span>Digital DOIs &amp; Archiving</span>
					</div>
				</div>
			</div>

			{* Right Side: Animated ScholarFlow Brand Visual *}
			<div class="sf_hero_visual_col" aria-hidden="true">
				<div class="sf_visual_card">
					<div class="sf_visual_glow_ambient"></div>
					<svg class="sf_brand_visual_svg" viewBox="0 0 500 420" fill="none" xmlns="http://www.w3.org/2000/svg">
						<defs>
							<!-- Gradients -->
							<linearGradient id="sfBoltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stop-color="#fef08a" />
								<stop offset="50%" stop-color="#facc15" />
								<stop offset="100%" stop-color="#f59e0b" />
							</linearGradient>

							<linearGradient id="sfHubGrad" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stop-color="#0f172a" />
								<stop offset="100%" stop-color="#1e1b4b" />
							</linearGradient>

							<linearGradient id="sfLineGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stop-color="#6366f1" stop-opacity="0.6" />
								<stop offset="100%" stop-color="#93c5fd" stop-opacity="0.2" />
							</linearGradient>

							<linearGradient id="sfCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stop-color="#ffffff" />
								<stop offset="100%" stop-color="#f8fafc" />
							</linearGradient>

							<radialGradient id="sfCenterGlow" cx="50%" cy="50%" r="50%">
								<stop offset="0%" stop-color="#6366f1" stop-opacity="0.35" />
								<stop offset="70%" stop-color="#4f46e5" stop-opacity="0.1" />
								<stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
							</radialGradient>

							<!-- Filter for Shadow -->
							<filter id="sfSoftShadow" x="-10%" y="-10%" width="130%" height="130%">
								<feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.08" />
							</filter>
							<filter id="sfHubShadow" x="-30%" y="-30%" width="160%" height="160%">
								<feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#4f46e5" flood-opacity="0.35" />
							</filter>
						</defs>

						<!-- Ambient Background Circles -->
						<circle cx="250" cy="210" r="170" fill="url(#sfCenterGlow)" />

						<!-- Orbital Guides -->
						<ellipse cx="250" cy="210" rx="200" ry="145" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="4 6" opacity="0.6" class="sf_orbit_track" />
						<circle cx="250" cy="210" r="115" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="3 5" opacity="0.7" />

						<!-- Interconnection Network Lines -->
						<line x1="250" y1="210" x2="380" y2="90" stroke="url(#sfLineGrad1)" stroke-width="1.8" stroke-dasharray="4 4" />
						<line x1="250" y1="210" x2="110" y2="320" stroke="url(#sfLineGrad1)" stroke-width="1.8" stroke-dasharray="4 4" />
						<line x1="250" y1="210" x2="110" y2="110" stroke="url(#sfLineGrad1)" stroke-width="1.5" stroke-dasharray="3 3" />
						<line x1="250" y1="210" x2="390" y2="330" stroke="url(#sfLineGrad1)" stroke-width="1.5" stroke-dasharray="3 3" />

						<!-- Pulsing Network Nodes -->
						<circle cx="380" cy="90" r="4" fill="#6366f1" class="sf_node_dot" />
						<circle cx="110" cy="320" r="4" fill="#6366f1" class="sf_node_dot" />
						<circle cx="110" cy="110" r="3.5" fill="#3b82f6" class="sf_node_dot" />
						<circle cx="390" cy="330" r="3.5" fill="#8b5cf6" class="sf_node_dot" />

						<!-- Floating Card 1: Top-Right (Research Manuscript) -->
						<g class="sf_float_card_1" filter="url(#sfSoftShadow)">
							<rect x="290" y="45" width="170" height="92" rx="10" fill="url(#sfCardGrad)" stroke="#e2e8f0" stroke-width="1.2" />
							<!-- Card Header -->
							<rect x="306" y="58" width="55" height="14" rx="4" fill="#e0e7ff" />
							<text x="310" y="68" font-size="8.5" font-weight="700" fill="#4338ca" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">MANUSCRIPT</text>
							<!-- Peer Reviewed Badge -->
							<rect x="375" y="58" width="70" height="14" rx="4" fill="#dcfce7" />
							<text x="380" y="68" font-size="8.5" font-weight="700" fill="#15803d" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">✓ PEER REVIEWED</text>
							<!-- Lines representing scholarly text -->
							<rect x="306" y="80" width="138" height="5" rx="2.5" fill="#334155" opacity="0.85" />
							<rect x="306" y="92" width="115" height="4" rx="2" fill="#94a3b8" />
							<rect x="306" y="103" width="95" height="4" rx="2" fill="#cbd5e1" />
							<!-- Author citation mark -->
							<text x="306" y="123" font-size="8" font-weight="600" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">ScholarFlow Research Series • 2026</text>
						</g>

						<!-- Floating Card 2: Bottom-Left (DOI & Open Access) -->
						<g class="sf_float_card_2" filter="url(#sfSoftShadow)">
							<rect x="40" y="275" width="165" height="85" rx="10" fill="url(#sfCardGrad)" stroke="#e2e8f0" stroke-width="1.2" />
							<!-- DOI Pill -->
							<rect x="54" y="289" width="75" height="14" rx="4" fill="#f1f5f9" />
							<text x="58" y="299" font-size="8.5" font-weight="700" fill="#475569" font-family="monospace">DOI: 10.1000/sf</text>
							<!-- Open Access Badge -->
							<rect x="135" y="289" width="56" height="14" rx="4" fill="#fef3c7" />
							<text x="139" y="299" font-size="8.5" font-weight="700" fill="#b45309" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">OPEN ACCESS</text>
							<!-- Title Lines -->
							<rect x="54" y="312" width="137" height="5" rx="2.5" fill="#334155" opacity="0.85" />
							<rect x="54" y="324" width="105" height="4" rx="2" fill="#94a3b8" />
							<text x="54" y="346" font-size="8" font-weight="600" fill="#6366f1" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Indexed &amp; Archived Globally</text>
						</g>

						<!-- Floating Badge 3: Top-Left (Knowledge Exchange Pill) -->
						<g class="sf_float_card_3" filter="url(#sfSoftShadow)">
							<rect x="50" y="90" width="135" height="34" rx="17" fill="#ffffff" stroke="#e0e7ff" stroke-width="1.2" />
							<circle cx="68" cy="107" r="9" fill="#e0e7ff" />
							<text x="64" y="111" font-size="11">⚡</text>
							<text x="83" y="111" font-size="9.5" font-weight="700" fill="#312e81" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Knowledge Flow</text>
						</g>

						<!-- Floating Badge 4: Bottom-Right (Volume & Issue Node) -->
						<g class="sf_float_card_4" filter="url(#sfSoftShadow)">
							<rect x="320" y="310" width="135" height="34" rx="17" fill="#ffffff" stroke="#e0e7ff" stroke-width="1.2" />
							<circle cx="338" cy="327" r="9" fill="#dbeafe" />
							<text x="333" y="331" font-size="10">📖</text>
							<text x="353" y="331" font-size="9.5" font-weight="700" fill="#1e40af" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Vol. 1 • 2026 Issue</text>
						</g>

						<!-- Central Hub: ScholarFlow Core Badge -->
						<g class="sf_central_hub">
							<!-- Pulsing Aura Circle -->
							<circle cx="250" cy="210" r="54" fill="#6366f1" fill-opacity="0.15" class="sf_hub_aura" />
							<circle cx="250" cy="210" r="46" fill="url(#sfHubGrad)" stroke="#6366f1" stroke-width="2" filter="url(#sfHubShadow)" />
							
							<!-- Central Lightning Bolt Icon -->
							<path d="M253 182 L236 210 L249 210 L245 238 L266 206 L253 206 Z" fill="url(#sfBoltGrad)" stroke="#fef08a" stroke-width="0.8" />
							
							<!-- Micro Badge Text -->
							<text x="250" y="247" text-anchor="middle" font-size="7.5" font-weight="800" letter-spacing="1" fill="#c7d2fe" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">SCHOLARFLOW</text>
						</g>
					</svg>
				</div>
			</div>
		</div>
	</header>

	{* 2. Top 3 Completed Journals Section *}
	<section class="sf_explore_journals_section">
		<div class="sf_explore_header">
			<div class="sf_explore_badge">
				<span class="sf_explore_badge_dot"></span>
				<span class="sf_explore_badge_text">SCHOLARLY PUBLICATIONS</span>
			</div>
			<h2 class="sf_explore_title">Explore Our Journals</h2>
			<p class="sf_explore_subtitle">
				Discover scholarly publications hosted on the ScholarFlow platform.
			</p>
		</div>

		{if $topCompletedJournals && count($topCompletedJournals) > 0}
			<div class="sf_journals_grid">
				{foreach from=$topCompletedJournals item=j}
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
				{/foreach}
			</div>
		{else}
			{* Professional Academic Empty State *}
			<div class="sf_journals_empty_card">
				<div class="sf_empty_icon_box">🏛️</div>
				<h3 class="sf_empty_title">Journals in Editorial Preparation</h3>
				<p class="sf_empty_desc">
					Scholarly publications on ScholarFlow are currently finalizing their inaugural volumes. Complete issues will appear here upon final editorial review and digital publication.
				</p>
			</div>
		{/if}
	</section>

	{* 3. Optional Homepage Image *}
	{if $homepageImage}
		<div class="sf_homepage_image">
			<img src="{$publicFilesDir}/{$homepageImage.uploadName|escape:"url"}" alt="{$homepageImageAltText|escape}">
		</div>
	{/if}

	{* 4. Real Manuscripts & Publications in this Journal (Restricted to authenticated editorial users) *}
	{if $currentUser && $journalSubmissions && count($journalSubmissions)}
	<section class="sf_journal_section sf_submissions_section">
		<div class="sf_section_header" style="margin-bottom:16px;">
			<div>
				<h2 class="sf_section_title" style="display:flex;align-items:center;gap:10px;">
					<span>Manuscripts &amp; Publications</span>
					<span style="font-size:12px;font-weight:700;background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:12px;border:1px solid #cbd5e1;">{count($journalSubmissions)}</span>
				</h2>
			</div>
			<a href="{url page="dashboard"}" class="sf_archive_link" style="white-space:nowrap;">
				Editorial Dashboard &rarr;
			</a>
		</div>

		<div class="sf_manuscripts_list" style="display:flex;flex-direction:column;gap:12px;">
			{foreach from=$journalSubmissions item=sub}
				{assign var=pub value=$sub->getCurrentPublication()}
				{if $pub}
					<div class="sf_manuscript_row" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:24px;box-shadow:0 1px 3px rgba(0,0,0,0.02);transition:all 0.15s ease;" onmouseenter="this.style.borderColor='#cbd5e1';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'" onmouseleave="this.style.borderColor='#e2e8f0';this.style.boxShadow='0 1px 3px rgba(0,0,0,0.02)'">
						<div style="flex:1;min-width:0;">
							<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
								<span style="font-family:monospace;font-size:12px;font-weight:700;color:#475569;background:#f1f5f9;padding:2px 8px;border-radius:6px;border:1px solid #e2e8f0;">#{$sub->getId()}</span>
								{if $sub->getData('status') == 3}
									<span style="font-size:11.5px;font-weight:700;background:#dcfce7;color:#166534;padding:2px 9px;border-radius:6px;">Published</span>
								{elseif $sub->getData('status') == 4}
									<span style="font-size:11.5px;font-weight:700;background:#fee2e2;color:#991b1b;padding:2px 9px;border-radius:6px;">Declined</span>
								{else}
									<span style="font-size:11.5px;font-weight:600;background:#fef3c7;color:#92400e;padding:2px 9px;border-radius:6px;">Active &bull; In Review</span>
								{/if}
								{if $sub->getData('dateSubmitted')}
									<span style="font-size:12px;color:#94a3b8;">
										Submitted {$sub->getData('dateSubmitted')|date_format:$dateFormatShort}
									</span>
								{/if}
							</div>

							<h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 6px 0;line-height:1.4;">
								{$pub->getLocalizedTitle()|escape}
							</h3>

							<div style="font-size:13px;color:#64748b;display:flex;align-items:center;gap:6px;">
								<span>👤</span>
								<span style="font-weight:500;">
									{if $authorUserGroups && $pub->getAuthorString($authorUserGroups)}
										{$pub->getAuthorString($authorUserGroups)|escape}
									{elseif $pub->getData('authors')}
										{foreach from=$pub->getData('authors') item=author name=authorLoop}{$author->getFullName()|escape}{if !$smarty.foreach.authorLoop.last}, {/if}{/foreach}
									{/if}
								</span>
							</div>
						</div>

						<div style="display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap;">
							<button type="button" onclick="window.__sfOpenInScreenReader('{$sub->getId()}', 'viewer')" style="background:#0f172a;color:#ffffff;border:1px solid #0f172a;border-radius:7px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease;" onmouseenter="this.style.background='#1e293b'" onmouseleave="this.style.background='#0f172a'">
								<span>📖</span> <span>Document &amp; Markups</span>
							</button>
							<button type="button" onclick="window.__sfOpenInScreenReader('{$sub->getId()}', 'prescreen')" title="AI Manuscript Pre-Screening Evaluation" style="background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;border-radius:7px;padding:9px 15px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease;" onmouseenter="this.style.background='#f8fafc';this.style.borderColor='#94a3b8'" onmouseleave="this.style.background='#ffffff';this.style.borderColor='#cbd5e1'">
								<span>📋</span> <span>Pre-Screen</span>
							</button>
							<button type="button" onclick="window.__sfOpenInScreenReader('{$sub->getId()}', 'reviewers')" title="AI Reviewer Matchmaking" style="background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;border-radius:7px;padding:9px 15px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease;" onmouseenter="this.style.background='#f8fafc';this.style.borderColor='#94a3b8'" onmouseleave="this.style.background='#ffffff';this.style.borderColor='#cbd5e1'">
								<span>👥</span> <span>Reviewer Matchmaking</span>
							</button>
						</div>
					</div>
				{/if}
			{/foreach}
		</div>
	</section>
	{/if}

	{* 5. Real Published Issues (Only renders if an issue exists in OJS) *}
	{if $issue}
		<section class="sf_journal_section sf_current_issue">
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

	{* 6. Real Announcements (Only renders if configured and present) *}
	{if $numAnnouncementsHomepage && count($announcements)}
		<section class="sf_journal_section sf_announcements">
			<h2 class="sf_section_title">
				{translate key="announcement.announcements"}
			</h2>
			{include file="frontend/objects/announcements_list.tpl" numAnnouncements=$numAnnouncementsHomepage}
		</section>
	{/if}

	{* 7. Real Additional Homepage Content (Configured in OJS settings) *}
	{if $additionalHomeContent}
		<section class="sf_journal_section sf_additional_content">
			{$additionalHomeContent}
		</section>
	{/if}

</div><!-- .page_index_journal -->

{include file="frontend/components/footer.tpl"}
