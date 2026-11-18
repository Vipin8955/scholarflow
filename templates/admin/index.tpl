{**
 * templates/admin/index.tpl
 * ScholarFlow Platform Console
 * Modern, Professional Multi-Journal Governance & System Administration Portal
 *}
{extends file="layouts/backend.tpl"}

{block name="page"}
<div class="sf_console_container" style="max-width:1280px;margin:0 auto;padding:24px 20px 64px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

	{* 1. Console Hero Header *}
	<div class="sf_console_hero" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px 36px;margin-bottom:28px;box-shadow:0 4px 20px -2px rgba(15,23,42,0.04);position:relative;overflow:hidden;">
		<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:16px;">
			<div style="display:inline-flex;align-items:center;gap:7px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:20px;padding:4px 12px;">
				<span style="font-size:13px;color:#eab308;line-height:1;">⚡</span>
				<span style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:#334155;text-transform:uppercase;">ScholarFlow Platform Console</span>
			</div>
			<div style="display:inline-flex;align-items:center;gap:6px;background:#dcfce7;border:1px solid #bbf7d0;color:#166534;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">
				<span style="width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block;"></span>
				<span>System Operational &bull; Healthy</span>
			</div>
		</div>

		<h1 style="font-size:30px;font-weight:800;color:#0f172a;line-height:1.25;letter-spacing:-0.02em;margin:0 0 10px 0;">
			Platform Administration &amp; Control Center
		</h1>
		<p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px 0;max-width:880px;">
			Centralized governance for hosted academic journals, global site configurations, database caches, background workers, and system infrastructure.
		</p>

		{* System KPIs *}
		<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;padding-top:20px;border-top:1px solid #f1f5f9;">
			<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;">
				<div style="font-size:11.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Hosted Journals</div>
				<div style="font-size:22px;font-weight:800;color:#0f172a;">{$adminStatJournals|default:6} <span style="font-size:13px;font-weight:500;color:#64748b;">Active</span></div>
			</div>
			<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;">
				<div style="font-size:11.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Registered Users</div>
				<div style="font-size:22px;font-weight:800;color:#0f172a;">{$adminStatUsers|default:15} <span style="font-size:13px;font-weight:500;color:#64748b;">Scholars</span></div>
			</div>
			<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;">
				<div style="font-size:11.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Platform Manuscripts</div>
				<div style="font-size:22px;font-weight:800;color:#0f172a;">{$adminStatSubmissions|default:8} <span style="font-size:13px;font-weight:500;color:#64748b;">Articles</span></div>
			</div>
			<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;">
				<div style="font-size:11.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Engine Architecture</div>
				<div style="font-size:16px;font-weight:700;color:#0f172a;line-height:1.4;">ScholarFlow 3.5 <div style="font-size:12px;font-weight:500;color:#64748b;">PHP 8.2 &bull; MySQL InnoDB</div></div>
			</div>
		</div>
	</div>

	{if $newVersionAvailable}
		<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:24px;color:#92400e;font-size:13.5px;display:flex;align-items:center;gap:10px;">
			<span>🔔</span>
			<span>{translate key="site.upgradeAvailable.admin" currentVersion=$currentVersion->getVersionString(false) latestVersion=$latestVersion}</span>
		</div>
	{/if}

	{* 2. Administration Grid *}
	<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:24px;margin-bottom:32px;">

		{* Card 1: Hosted Journals Management *}
		<div class="sf_console_card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.03);transition:all 0.2s ease;">
			<div>
				<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
					<div style="width:40px;height:40px;border-radius:10px;background:#eef2ff;color:#4f46e5;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid #e0e7ff;">📚</div>
					<div>
						<h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 2px 0;">{translate key="admin.hostedContexts"}</h2>
						<span style="font-size:12px;color:#64748b;font-weight:500;">Multi-Journal Governance</span>
					</div>
				</div>
				<p style="font-size:13.5px;color:#475569;line-height:1.6;margin:0 0 20px 0;">
					{translate key="admin.siteManagement.description"} Create new scholarly publications, configure paths, and assign editorial boards.
				</p>
			</div>
			<div style="padding-top:16px;border-top:1px solid #f1f5f9;display:flex;gap:10px;">
				<a href="{url op="contexts"}" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;background:#0f172a;color:#ffffff;padding:10px 16px;font-size:13.5px;font-weight:600;border-radius:8px;text-decoration:none;border:1px solid #0f172a;transition:background 0.15s ease;" onmouseenter="this.style.background='#1e293b'" onmouseleave="this.style.background='#0f172a'">
					<span>Manage Hosted Journals</span>
					<span>&rarr;</span>
				</a>
			</div>
		</div>

		{* Card 2: Site Settings & Global Configuration *}
		<div class="sf_console_card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.03);transition:all 0.2s ease;">
			<div>
				<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
					<div style="width:40px;height:40px;border-radius:10px;background:#f0fdf4;color:#16a34a;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid #dcfce7;">⚙️</div>
					<div>
						<h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 2px 0;">{translate key="admin.siteSettings"}</h2>
						<span style="font-size:12px;color:#64748b;font-weight:500;">Platform Identity &amp; Locales</span>
					</div>
				</div>
				<p style="font-size:13.5px;color:#475569;line-height:1.6;margin:0 0 20px 0;">
					Configure site-wide title, institutional branding, multilingual languages, global themes, and default URL redirection parameters.
				</p>
			</div>
			<div style="padding-top:16px;border-top:1px solid #f1f5f9;display:flex;gap:10px;">
				<a href="{url op="settings"}" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;background:#ffffff;color:#1e293b;padding:10px 16px;font-size:13.5px;font-weight:600;border-radius:8px;text-decoration:none;border:1px solid #cbd5e1;transition:all 0.15s ease;" onmouseenter="this.style.background='#f8fafc';this.style.borderColor='#94a3b8'" onmouseleave="this.style.background='#ffffff';this.style.borderColor='#cbd5e1'">
					<span>Configure Site Settings</span>
					<span>&rarr;</span>
				</a>
			</div>
		</div>

		{* Card 3: System Diagnostics & Server Info *}
		<div class="sf_console_card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.03);transition:all 0.2s ease;">
			<div>
				<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
					<div style="width:40px;height:40px;border-radius:10px;background:#f8fafc;color:#0284c7;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid #e0f2fe;">🖥️</div>
					<div>
						<h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 2px 0;">{translate key="admin.systemInformation"}</h2>
						<span style="font-size:12px;color:#64748b;font-weight:500;">Runtime Environment</span>
					</div>
				</div>
				<p style="font-size:13.5px;color:#475569;line-height:1.6;margin:0 0 20px 0;">
					{translate key="admin.systemInformation.description"} View database connection, PHP configuration limits, and core build revisions.
				</p>
			</div>
			<div style="padding-top:16px;border-top:1px solid #f1f5f9;display:flex;gap:10px;">
				<a href="{url op="systemInfo"}" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;background:#ffffff;color:#1e293b;padding:10px 16px;font-size:13.5px;font-weight:600;border-radius:8px;text-decoration:none;border:1px solid #cbd5e1;transition:all 0.15s ease;" onmouseenter="this.style.background='#f8fafc';this.style.borderColor='#94a3b8'" onmouseleave="this.style.background='#ffffff';this.style.borderColor='#cbd5e1'">
					<span>{translate key="admin.systemInformation.view"}</span>
					<span>&rarr;</span>
				</a>
			</div>
		</div>

		{* Card 4: Cache Maintenance & Optimization *}
		<div class="sf_console_card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.03);transition:all 0.2s ease;">
			<div>
				<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
					<div style="width:40px;height:40px;border-radius:10px;background:#fef3c7;color:#d97706;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid #fde68a;">⚡</div>
					<div>
						<h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 2px 0;">{translate key="admin.deleteCache"}</h2>
						<span style="font-size:12px;color:#64748b;font-weight:500;">Performance &amp; Cache Purge</span>
					</div>
				</div>
				<p style="font-size:13.5px;color:#475569;line-height:1.6;margin:0 0 20px 0;">
					{translate key="admin.deleteCache.description"} Clear Smarty template cache and data caches to reflect design and setting updates.
				</p>
			</div>
			<div style="padding-top:16px;border-top:1px solid #f1f5f9;display:flex;gap:10px;flex-wrap:wrap;">
				<form method="post" action="{url op="clearTemplateCache"}" style="flex:1;">
					{csrf}
					<button type="submit" onclick="return confirm({translate|json_encode|escape key="admin.confirmClearTemplateCache"})" style="width:100%;background:#ffffff;color:#b45309;padding:9px 12px;font-size:13px;font-weight:600;border-radius:7px;border:1px solid #fde68a;cursor:pointer;transition:all 0.15s ease;" onmouseenter="this.style.background='#fef3c7'" onmouseleave="this.style.background='#ffffff'">
						{translate key="admin.clearTemplateCache"}
					</button>
				</form>
				<form method="post" action="{url op="clearDataCache"}" style="flex:1;">
					{csrf}
					<button type="submit" style="width:100%;background:#ffffff;color:#475569;padding:9px 12px;font-size:13px;font-weight:600;border-radius:7px;border:1px solid #cbd5e1;cursor:pointer;transition:all 0.15s ease;" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='#ffffff'">
						{translate key="admin.clearDataCache"}
					</button>
				</form>
			</div>
		</div>

		{* Card 5: User Session Security *}
		<div class="sf_console_card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.03);transition:all 0.2s ease;">
			<div>
				<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
					<div style="width:40px;height:40px;border-radius:10px;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid #fecaca;">🛡️</div>
					<div>
						<h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 2px 0;">{translate key="admin.expireSessions"}</h2>
						<span style="font-size:12px;color:#64748b;font-weight:500;">Access Control &amp; Security</span>
					</div>
				</div>
				<p style="font-size:13.5px;color:#475569;line-height:1.6;margin:0 0 20px 0;">
					{translate key="admin.expireSessions.description"} Force immediate expiration of active logins across all journals and browsers.
				</p>
			</div>
			<div style="padding-top:16px;border-top:1px solid #f1f5f9;display:flex;gap:10px;">
				<form method="post" action="{url op="expireSessions"}" style="width:100%;">
					{csrf}
					<button type="submit" onclick="return confirm({translate|json_encode|escape key="admin.confirmExpireSessions"})" style="width:100%;background:#ffffff;color:#b91c1c;padding:10px 16px;font-size:13.5px;font-weight:600;border-radius:8px;border:1px solid #fca5a5;cursor:pointer;transition:all 0.15s ease;" onmouseenter="this.style.background='#fee2e2'" onmouseleave="this.style.background='#ffffff'">
						{translate key="admin.expireSessions"}
					</button>
				</form>
			</div>
		</div>

		{* Card 6: Background Tasks & Queue Jobs *}
		<div class="sf_console_card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.03);transition:all 0.2s ease;">
			<div>
				<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
					<div style="width:40px;height:40px;border-radius:10px;background:#f3e8ff;color:#7e22ce;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid #e9d5ff;">⏱️</div>
					<div>
						<h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 2px 0;">{translate key="navigation.tools.jobs"}</h2>
						<span style="font-size:12px;color:#64748b;font-weight:500;">Background Queue &amp; Logs</span>
					</div>
				</div>
				<p style="font-size:13.5px;color:#475569;line-height:1.6;margin:0 0 20px 0;">
					{translate key="navigation.tools.jobs.description"} Monitor job queues, analyze worker errors, and prune scheduled logs.
				</p>
			</div>
			<div style="padding-top:16px;border-top:1px solid #f1f5f9;display:flex;gap:8px;flex-wrap:wrap;">
				<a href="{url op="jobs"}" style="flex:1;text-align:center;background:#ffffff;color:#475569;padding:9px 12px;font-size:13px;font-weight:600;border-radius:7px;border:1px solid #cbd5e1;text-decoration:none;transition:all 0.15s ease;" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='#ffffff'">
					{translate key="navigation.tools.jobs.view"}
				</a>
				<a href="{url op="failedJobs"}" style="flex:1;text-align:center;background:#ffffff;color:#475569;padding:9px 12px;font-size:13px;font-weight:600;border-radius:7px;border:1px solid #cbd5e1;text-decoration:none;transition:all 0.15s ease;" onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='#ffffff'">
					{translate key="navigation.tools.jobs.failed.view"}
				</a>
				<form method="post" action="{url op="clearScheduledTaskLogFiles"}" style="width:100%;margin-top:4px;">
					{csrf}
					<button type="submit" onclick="return confirm({translate|json_encode|escape key="admin.scheduledTask.confirmClearLogs"})" style="width:100%;background:#ffffff;color:#64748b;padding:8px 12px;font-size:12.5px;font-weight:500;border-radius:7px;border:1px solid #e2e8f0;cursor:pointer;transition:all 0.15s ease;" onmouseenter="this.style.background='#f1f5f9'" onmouseleave="this.style.background='#ffffff'">
						{translate key="admin.scheduledTask.clearLogs.delete"}
					</button>
				</form>
			</div>
		</div>

	</div>

	{* 3. Quick Links to All Hosted Journals Strip *}
	{if $allJournals && count($allJournals)}
		<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
			<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
				<h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0;">Quick Access to Hosted Journals</h3>
				<a href="{url op="contexts"}" style="font-size:13px;color:#4f46e5;font-weight:600;text-decoration:none;">View All Journals &rarr;</a>
			</div>
			<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;">
				{foreach from=$allJournals item=aj}
					<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
						<div style="min-width:0;flex:1;">
							<div style="font-size:13.5px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{$aj->getLocalizedName()|escape}</div>
							<div style="font-size:11.5px;color:#64748b;font-family:monospace;">/{$aj->getPath()|escape}</div>
						</div>
						<div style="display:flex;gap:6px;flex-shrink:0;">
							<a href="{url journal=$aj->getPath() page="index"}" style="background:#ffffff;border:1px solid #cbd5e1;color:#1e293b;padding:5px 9px;border-radius:5px;font-size:11.5px;font-weight:600;text-decoration:none;">Portal</a>
							<a href="{url journal=$aj->getPath() page="dashboard"}" style="background:#0f172a;border:1px solid #0f172a;color:#ffffff;padding:5px 9px;border-radius:5px;font-size:11.5px;font-weight:600;text-decoration:none;">Editor</a>
						</div>
					</div>
				{/foreach}
			</div>
		</div>
	{/if}

	{call_hook name="Templates::Admin::Index::AdminFunctions"}

</div>
{/block}
