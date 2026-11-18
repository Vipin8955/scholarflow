{**
 * templates/frontend/pages/about.tpl
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @brief Display the page to view a journal's or press's description, contact
 *  details, policies and more.
 *
 * @uses $currentContext Journal|Press The current journal or press
 *}
{include file="frontend/components/header.tpl" pageTitle="about.aboutContext"}

<div class="page page_about sf_about_page_container">
	<div class="sf_about_breadcrumbs">
		{include file="frontend/components/breadcrumbs.tpl" currentTitleKey="about.aboutContext"}
	</div>

	{include file="frontend/components/editLink.tpl" page="management" op="settings" path="context" anchor="masthead" sectionTitleKey="about.aboutContext"}

	{* ── 1. Academic Journal Hero & Mission ── *}
	<section class="sf_about_hero">
		<div class="sf_hero_badge_wrap">
			<span class="sf_hero_badge">
				<span class="sf_badge_dot"></span>
				Peer-Reviewed Open Access Journal
			</span>
			<span class="sf_hero_badge sf_hero_badge_platform">
				⚡ Powered by ScholarFlow™
			</span>
		</div>
		<h1 class="sf_about_journal_title">
			{if $currentContext}
				{$currentContext->getLocalizedName()|escape}
			{else}
				About the Journal
			{/if}
		</h1>
		<div class="sf_about_journal_desc">
			{if $currentContext && $currentContext->getLocalizedData('description')}
				{$currentContext->getLocalizedData('description')}
			{else}
				<p>A premier peer-reviewed scholarly journal committed to rapid, rigorous research evaluation and international open-access dissemination across cutting-edge multidisciplinary domains.</p>
			{/if}
		</div>

		{* Quick Academic Indicators Bar *}
		<div class="sf_hero_highlights">
			<div class="sf_highlight_item">
				<div class="sf_highlight_icon">🏛️</div>
				<div class="sf_highlight_info">
					<div class="sf_highlight_label">Publishing Model</div>
					<div class="sf_highlight_val">Open Access</div>
				</div>
			</div>
			<div class="sf_highlight_item">
				<div class="sf_highlight_icon">🛡️</div>
				<div class="sf_highlight_info">
					<div class="sf_highlight_label">Review Standard</div>
					<div class="sf_highlight_val">Double-Blind Peer Review</div>
				</div>
			</div>
			<div class="sf_highlight_item">
				<div class="sf_highlight_icon">⚡</div>
				<div class="sf_highlight_info">
					<div class="sf_highlight_label">Editorial System</div>
					<div class="sf_highlight_val">ScholarFlow™ Platform</div>
				</div>
			</div>
			<div class="sf_highlight_item">
				<div class="sf_highlight_icon">🌐</div>
				<div class="sf_highlight_info">
					<div class="sf_highlight_label">Readership</div>
					<div class="sf_highlight_val">Global &amp; Unrestricted</div>
				</div>
			</div>
		</div>
	</section>

	{* ── 2. Journal Overview Cards ── *}
	<section class="sf_about_section">
		<div class="sf_about_section_header">
			<span class="sf_section_eyebrow">SCHOLARLY OVERVIEW</span>
			<h2 class="sf_section_title">Core Academic Commitments</h2>
			<p class="sf_section_lead">Providing an objective, high-integrity platform for foundational research, empirical inquiries, and interdisciplinary breakthroughs.</p>
		</div>

		<div class="sf_card_grid_3">
			<div class="sf_feature_card">
				<div class="sf_card_icon_wrap sf_icon_purple">
					<span>🎯</span>
				</div>
				<h3 class="sf_card_title">Scholarly Scope &amp; Focus</h3>
				<p class="sf_card_text">Welcoming original research articles, in-depth systematic reviews, methodological innovations, and critical scientific perspectives that bridge theoretical and applied inquiry.</p>
			</div>

			<div class="sf_feature_card">
				<div class="sf_card_icon_wrap sf_icon_indigo">
					<span>⚖️</span>
				</div>
				<h3 class="sf_card_title">Editorial &amp; Review Integrity</h3>
				<p class="sf_card_text">Upholding strict ethical and peer-review benchmarks. Every submission undergoes structured editorial pre-screening followed by independent double-blind evaluation by domain specialists.</p>
			</div>

			<div class="sf_feature_card">
				<div class="sf_card_icon_wrap sf_icon_teal">
					<span>🌐</span>
				</div>
				<h3 class="sf_card_title">Unrestricted Knowledge Exchange</h3>
				<p class="sf_card_text">Dedicated to removing financial and institutional barriers to science. Accepted research is published immediately online with full digital discoverability for international scholarship.</p>
			</div>
		</div>
	</section>

	{* ── 3. Aims & Scope Detailed Section ── *}
	<section class="sf_about_section sf_aims_scope_box">
		<div class="sf_about_section_header sf_text_left">
			<span class="sf_section_eyebrow">RESEARCH DOMAINS</span>
			<h2 class="sf_section_title">Aims and Scope</h2>
		</div>

		<div class="sf_aims_content">
			<p class="sf_aims_lead">
				<strong>{$currentContext->getLocalizedName()|escape}</strong> provides an international forum dedicated to the publication of high-quality, rigorously reviewed academic research. The journal seeks to foster cross-disciplinary discourse, encouraging contributions that integrate computational rigor, engineering frameworks, and empirical sciences.
			</p>

			<div class="sf_scope_columns">
				<div class="sf_scope_col">
					<h4 class="sf_scope_subtitle">Key Objectives</h4>
					<ul class="sf_academic_list">
						<li><strong>Originality &amp; Rigor:</strong> Prioritizing research demonstrating substantial theoretical advancement, methodological validity, and empirical depth.</li>
						<li><strong>Interdisciplinary Synergy:</strong> Promoting dialogue across computational systems, physical sciences, engineering, and data-centric academic investigations.</li>
						<li><strong>Reproducibility:</strong> Encouraging open research data, detailed protocol documentation, and transparent scientific methodologies.</li>
					</ul>
				</div>
				<div class="sf_scope_col">
					<h4 class="sf_scope_subtitle">Manuscript Types Accepted</h4>
					<ul class="sf_academic_list">
						<li><strong>Original Research Papers:</strong> Comprehensive reports of innovative scientific findings with full experimental or theoretical validation.</li>
						<li><strong>Review Articles:</strong> Critical, authoritative evaluations of recent developments, current challenges, and future trajectories in relevant fields.</li>
						<li><strong>Methodological &amp; Technical Notes:</strong> Brief contributions detailing new software algorithms, analytical apparatus, or novel experimental protocols.</li>
					</ul>
				</div>
			</div>
		</div>
	</section>

	{* ── 4. Open Access Orientation ── *}
	<section class="sf_about_section sf_oa_banner">
		<div class="sf_oa_left">
			<div class="sf_oa_icon_badge">🔓</div>
			<div>
				<span class="sf_section_eyebrow" style="color:#4f46e5;">OPEN ACCESS STATEMENT</span>
				<h3 class="sf_oa_title">Committed to Free &amp; Open Scholarship</h3>
				<div class="sf_oa_text">
					{if $currentContext && $currentContext->getLocalizedData('openAccessPolicy')}
						<p>{$currentContext->getLocalizedData('openAccessPolicy')|escape}</p>
					{else}
						<p>This journal provides immediate, permanent open access to all published content based on the principle that making research freely available to the public supports a greater global exchange of knowledge.</p>
					{/if}
				</div>
			</div>
		</div>
		<div class="sf_oa_pills">
			<div class="sf_oa_pill">✓ No Reader Subscription Fees</div>
			<div class="sf_oa_pill">✓ Immediate Global Indexing</div>
			<div class="sf_oa_pill">✓ Permanent Archival Access</div>
		</div>
	</section>

	{* ── 5. Publication and Peer Review Process ── *}
	<section class="sf_about_section">
		<div class="sf_about_section_header">
			<span class="sf_section_eyebrow">EDITORIAL WORKFLOW</span>
			<h2 class="sf_section_title">Peer-Review &amp; Publishing Process</h2>
			<p class="sf_section_lead">Every manuscript submitted follows an established, transparent, and rigorous multi-stage editorial pathway.</p>
		</div>

		<div class="sf_workflow_steps">
			<div class="sf_wf_step">
				<div class="sf_wf_num">1</div>
				<div class="sf_wf_content">
					<h4 class="sf_wf_title">Initial Pre-Screening</h4>
					<p class="sf_wf_desc">Submissions undergo preliminary editorial screening for scope alignment, formatting completeness, and research integrity.</p>
				</div>
			</div>
			<div class="sf_wf_arrow">→</div>
			<div class="sf_wf_step">
				<div class="sf_wf_num">2</div>
				<div class="sf_wf_content">
					<h4 class="sf_wf_title">Double-Blind Peer Review</h4>
					<p class="sf_wf_desc">Independent academic reviewers evaluate methodology, technical depth, and significance. Reviewer and author identities are strictly masked.</p>
				</div>
			</div>
			<div class="sf_wf_arrow">→</div>
			<div class="sf_wf_step">
				<div class="sf_wf_num">3</div>
				<div class="sf_wf_content">
					<h4 class="sf_wf_title">Editorial Decision</h4>
					<p class="sf_wf_desc">The editor synthesizes reviewer feedback to render a formal decision: Accept, Revisions Required, or Decline.</p>
				</div>
			</div>
			<div class="sf_wf_arrow">→</div>
			<div class="sf_wf_step">
				<div class="sf_wf_num">4</div>
				<div class="sf_wf_content">
					<h4 class="sf_wf_title">Production &amp; Release</h4>
					<p class="sf_wf_desc">Accepted papers undergo copyediting, layout proofing, DOI registration, and immediate publication in the open archives.</p>
				</div>
			</div>
		</div>
	</section>

	{* ── 6. Structured Journal Information & Metadata ── *}
	<section class="sf_about_section sf_info_section">
		<div class="sf_info_grid">
			{* Left: Journal Metadata Card *}
			<div class="sf_info_card">
				<h3 class="sf_info_card_title">🏛️ Journal Specifications</h3>
				<table class="sf_metadata_table">
					<tbody>
						<tr>
							<td class="sf_meta_key">Journal Title</td>
							<td class="sf_meta_val"><strong>{$currentContext->getLocalizedName()|escape}</strong></td>
						</tr>
						{if $currentContext && $currentContext->getLocalizedData('acronym')}
							<tr>
								<td class="sf_meta_key">Journal Acronym</td>
								<td class="sf_meta_val"><span class="sf_meta_badge">{$currentContext->getLocalizedData('acronym')|escape}</span></td>
							</tr>
						{/if}
						<tr>
							<td class="sf_meta_key">Publishing Platform</td>
							<td class="sf_meta_val">ScholarFlow™ Editorial Platform</td>
						</tr>
						<tr>
							<td class="sf_meta_key">Peer Review Method</td>
							<td class="sf_meta_val">Double-Blind Peer Review</td>
						</tr>
						<tr>
							<td class="sf_meta_key">Access Model</td>
							<td class="sf_meta_val"><span class="sf_meta_badge sf_badge_green">Open Access</span></td>
						</tr>
						{if $currentContext && $currentContext->getLocalizedData('contactName')}
							<tr>
								<td class="sf_meta_key">Editorial Contact</td>
								<td class="sf_meta_val">{$currentContext->getLocalizedData('contactName')|escape}</td>
							</tr>
						{/if}
						{if $currentContext && $currentContext->getLocalizedData('contactEmail')}
							<tr>
								<td class="sf_meta_key">Contact Inquiries</td>
								<td class="sf_meta_val"><a href="mailto:{$currentContext->getLocalizedData('contactEmail')|escape}" class="sf_contact_link">{$currentContext->getLocalizedData('contactEmail')|escape}</a></td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>

			{* Right: Action Callout Card *}
			<div class="sf_cta_card">
				<h3 class="sf_cta_title">✍️ Submissions &amp; Archival Access</h3>
				<p class="sf_cta_desc">Authors are invited to submit original, unpublished manuscripts through the ScholarFlow online submission portal. Submissions are tracked and evaluated in real-time.</p>

				<div class="sf_cta_buttons">
					<a href="{url page="submission" op="wizard"}" class="sf_btn_submit">
						<span>➕ Submit a Manuscript</span>
					</a>
					<a href="{url page="issue" op="archive"}" class="sf_btn_archives">
						<span>📚 Browse Published Issues</span>
					</a>
				</div>

				{if $currentContext && $currentContext->getLocalizedData('about')}
					<div class="sf_custom_about_content">
						<h4 style="font-size:14px;font-weight:700;color:#0f172a;margin:18px 0 8px 0;">Additional Journal Information</h4>
						<div style="font-size:13.5px;color:#475569;line-height:1.6;">
							{$currentContext->getLocalizedData('about')}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</section>

</div><!-- .page_about -->

{include file="frontend/components/footer.tpl"}
