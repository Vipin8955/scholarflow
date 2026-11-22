{**
 * lib/pkp/templates/frontend/components/header.tpl
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @brief Common frontend site header.
 *
 * @uses $isFullWidth bool Should this page be displayed without sidebars? This
 *       represents a page-level override, and doesn't indicate whether or not
 *       sidebars have been configured for thesite.
 *}
{strip}
	{* Determine whether a logo or title string is being displayed *}
	{assign var="showingLogo" value=true}
	{if !$displayPageHeaderLogo}
		{assign var="showingLogo" value=false}
	{/if}
{/strip}
<!DOCTYPE html>
<html lang="{$currentLocale|replace:"_":"-"}" xml:lang="{$currentLocale|replace:"_":"-"}">
{if !$pageTitleTranslated}{capture assign="pageTitleTranslated"}{translate key=$pageTitle}{/capture}{/if}
{include file="frontend/components/headerHead.tpl"}
<body class="pkp_page_{$requestedPage|escape|default:"index"} pkp_op_{$requestedOp|escape|default:"index"}{if $showingLogo} has_site_logo{/if}" dir="{$currentLocaleLangDir|escape|default:"ltr"}">

	<div class="pkp_structure_page">

		{* ⚡ ScholarFlow Modern Unified Header ⚡ *}
		<header class="pkp_structure_head sf_main_header" id="headerNavigationContainer" role="banner" style="background:#0f172a !important; border-bottom:1px solid rgba(255,255,255,0.1) !important; box-shadow:0 4px 20px rgba(0,0,0,0.3) !important; padding:0 24px !important; min-height:64px !important; display:flex !important; align-items:center !important; justify-content:space-between !important; z-index:1000 !important; width:100% !important; box-sizing:border-box !important;">

			{capture assign="homeUrl"}{url context="index" page="index" router=PKP\core\PKPApplication::ROUTE_PAGE}{/capture}

			{* Left: Modern Logo & Context *}
			<div class="sf_header_left" style="display:flex;align-items:center;gap:14px;">
				<a href="{$homeUrl}" style="text-decoration:none;display:inline-flex;align-items:center;gap:10px;">
					<div style="width:34px;height:34px;border-radius:9px;background:#1e293b;border:1px solid #334155;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:16px;flex-shrink:0;">⚡</div>
					<div style="display:flex;align-items:baseline;gap:6px;">
						<span style="font-weight:900;font-size:18px;letter-spacing:-0.4px;color:#ffffff;font-family:'Inter',sans-serif;">ScholarFlow</span>
						<span style="background:rgba(255,255,255,0.08);color:#cbd5e1;border:1px solid rgba(255,255,255,0.15);font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;letter-spacing:0.5px;">PLATFORM</span>
					</div>
				</a>
				{if $currentContext}
					<span style="color:#475569;font-size:16px;">/</span>
					{if $currentUser && $allJournals && count($allJournals) > 1}
						<div class="sf_journal_picker_wrap" style="position:relative;display:inline-block;">
							<button type="button" id="sfJournalPickerBtn" onclick="var m=document.getElementById('sfJournalPickerMenu'); if(m) m.style.display=(m.style.display==='none'||!m.style.display)?'block':'none'; event.stopPropagation();" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:6px 12px;color:#f8fafc;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all 0.15s ease;" onmouseenter="this.style.background='rgba(255,255,255,0.16)'" onmouseleave="this.style.background='rgba(255,255,255,0.08)'">
								<span>{$currentContext->getLocalizedData('name')|escape}</span>
								<span style="font-size:10px;color:#94a3b8;">▼</span>
							</button>
							<div id="sfJournalPickerMenu" style="display:none;position:absolute;top:calc(100% + 6px);left:0;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,0.2);min-width:320px;z-index:9999999;padding:6px 0;max-height:400px;overflow-y:auto;">
								<div style="padding:6px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f1f5f9;">
									Select Journal
								</div>
								{foreach from=$allJournals item=j}
									<a href="{url journal=$j->getPath() page="index"}" style="display:block;padding:9px 14px;font-size:13px;color:{if $j->getId() == $currentContext->getId()}#0f172a;font-weight:700;background:#f8fafc{else}#1e293b;font-weight:500{/if};text-decoration:none;transition:background 0.15s ease;" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='{if $j->getId() == $currentContext->getId()}#f8fafc{else}transparent{/if}'">
										{$j->getLocalizedName()|escape}
									</a>
								{/foreach}
							</div>
						</div>
					{else}
						<span style="color:#f8fafc;font-size:13px;font-weight:600;padding:6px 10px;">{$currentContext->getLocalizedData('name')|escape}</span>
					{/if}
				{elseif $currentUser && $allJournals && count($allJournals)}
					<span style="color:#475569;font-size:16px;">/</span>
					<div class="sf_journal_picker_wrap" style="position:relative;display:inline-block;">
						<button type="button" id="sfJournalPickerBtn" onclick="var m=document.getElementById('sfJournalPickerMenu'); if(m) m.style.display=(m.style.display==='none'||!m.style.display)?'block':'none'; event.stopPropagation();" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:6px 12px;color:#f8fafc;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all 0.15s ease;" onmouseenter="this.style.background='rgba(255,255,255,0.16)'" onmouseleave="this.style.background='rgba(255,255,255,0.08)'">
							<span>Select Journal</span>
							<span style="font-size:10px;color:#94a3b8;">▼</span>
						</button>
						<div id="sfJournalPickerMenu" style="display:none;position:absolute;top:calc(100% + 6px);left:0;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,0.2);min-width:320px;z-index:9999999;padding:6px 0;max-height:400px;overflow-y:auto;">
							<div style="padding:6px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f1f5f9;">
								Select Journal
							</div>
							{foreach from=$allJournals item=j}
								<a href="{url journal=$j->getPath() page="index"}" style="display:block;padding:9px 14px;font-size:13px;color:#1e293b;font-weight:500;text-decoration:none;transition:background 0.15s ease;" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='transparent'">
									{$j->getLocalizedName()|escape}
								</a>
							{/foreach}
						</div>
					</div>
				{/if}
			</div>

			{* Center: Clean Nav Links *}
			<div class="sf_header_center" style="display:flex;align-items:center;gap:10px;">
				<a href="{$homeUrl}" style="color:#cbd5e1;text-decoration:none;font-size:13px;font-weight:600;padding:7px 12px;border-radius:6px;transition:all 0.15s ease;">Home</a>
				{if $currentContext}
					<a href="{url page="about"}" style="color:#cbd5e1;text-decoration:none;font-size:13px;font-weight:600;padding:7px 12px;border-radius:6px;transition:all 0.15s ease;">About</a>
					<a href="{url page="issue" op="archive"}" style="color:#cbd5e1;text-decoration:none;font-size:13px;font-weight:600;padding:7px 12px;border-radius:6px;transition:all 0.15s ease;">Archives</a>
				{/if}
			</div>

			{* Right: Clearly Visible User Actions (Login, Register, Dashboard, Profile, Logout) *}
			<div class="sf_header_right" style="display:flex;align-items:center;gap:10px;">
				{if $currentUser}
					<a href="{url page="dashboard"}" style="display:inline-flex;align-items:center;gap:6px;background:#1e293b;border:1px solid #334155;color:#f8fafc;padding:7px 15px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;transition:all 0.15s ease;">
						<span>📊</span> <span>Dashboard</span>
					</a>
					<a href="{url page="user" op="profile"}" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);color:#cbd5e1;padding:7px 12px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;transition:all 0.15s ease;">
						<span>👤</span> <span>{$currentUser->getUsername()|escape}</span>
					</a>
					<a href="{url page="login" op="signOut"}" style="display:inline-flex;align-items:center;gap:5px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:7px 12px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;transition:all 0.15s ease;">
						<span>🚪</span> <span>Logout</span>
					</a>
				{else}
					<a href="{url page="login"}" style="color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:8px 18px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.05);transition:all 0.15s ease;">
						Log In
					</a>
					<a href="{url page="user" op="register"}" style="background:linear-gradient(135deg,#4f46e5,#4338ca);color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:8px 18px;border-radius:8px;box-shadow:0 2px 8px rgba(79,70,229,0.35);transition:all 0.15s ease;">
						Register
					</a>
				{/if}
			</div>

		</header><!-- .pkp_structure_head -->

		{* Wrapper for page content and sidebars *}
		{if $isFullWidth}
			{assign var=hasSidebar value=0}
		{/if}
		<div class="pkp_structure_content{if $hasSidebar} has_sidebar{/if}">
			<div class="pkp_structure_main" role="main">
				<a id="pkp_content_main"></a>
