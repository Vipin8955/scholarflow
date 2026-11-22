{**
 * templates/frontend/pages/indexSite.tpl
 * ScholarFlow Platform - Central Multi-Journal Portal
 *}
{include file="frontend/components/header.tpl"}

<style>
/* ── ScholarFlow Site Landing & 3D Book Animation Styles ── */
.sf_site_landing {
	max-width: 1200px;
	margin: 0 auto;
	padding: 48px 20px 80px 20px;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.sf_landing_center {
	max-width: 860px;
	margin: 0 auto;
	text-align: center;
}

/* 3D Book Wrapper & Lighting */
.sf_book_wrapper {
	position: relative;
	width: 320px;
	height: 220px;
	margin: 0 auto 36px auto;
}

.sf_book_ambient_glow {
	position: absolute;
	width: 380px;
	height: 200px;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -35%);
	background: radial-gradient(ellipse at center, rgba(99, 102, 241, 0.22) 0%, rgba(99, 102, 241, 0.05) 55%, transparent 75%);
	filter: blur(22px);
	pointer-events: none;
	z-index: 1;
}

.sf_book_shadow {
	position: absolute;
	bottom: -16px;
	left: 50%;
	transform: translateX(-50%);
	width: 290px;
	height: 28px;
	background: radial-gradient(ellipse at center, rgba(15, 23, 42, 0.28) 0%, rgba(15, 23, 42, 0.08) 60%, transparent 80%);
	filter: blur(8px);
	border-radius: 50%;
	z-index: 1;
	animation: sfShadowPulse 4.5s ease-in-out infinite;
}

@keyframes sfShadowPulse {
	0%, 100% { transform: translateX(-50%) scaleX(1); opacity: 0.85; }
	50% { transform: translateX(-50%) scaleX(1.06); opacity: 0.65; }
}

/* 3D Perspective Stage */
.sf_book_scene {
	position: relative;
	width: 100%;
	height: 100%;
	perspective: 1200px;
	perspective-origin: 50% 40%;
	z-index: 2;
}

.sf_book_3d {
	position: relative;
	width: 280px;
	height: 190px;
	margin: 15px auto 0 auto;
	transform-style: preserve-3d;
	transform: rotateX(26deg) rotateY(0deg) rotateZ(-3deg);
	transition: transform 0.4s ease;
}

.sf_book_3d:hover {
	transform: rotateX(20deg) rotateY(3deg) rotateZ(-1deg) scale(1.03);
}

/* Book Covers & Spine */
.sf_book_half {
	position: absolute;
	top: 0;
	width: 140px;
	height: 190px;
	background: #ffffff;
	border-radius: 3px 8px 8px 3px;
	box-shadow: 0 4px 18px rgba(15, 23, 42, 0.12), inset 0 0 10px rgba(0, 0, 0, 0.03);
	border: 1px solid #cbd5e1;
	overflow: hidden;
}

.sf_book_left {
	left: 0;
	border-radius: 8px 3px 3px 8px;
	box-shadow: -6px 8px 18px rgba(15, 23, 42, 0.16), inset -4px 0 10px rgba(0,0,0,0.06);
	background: linear-gradient(90deg, #f1f5f9 0%, #ffffff 20%, #ffffff 95%, #e2e8f0 100%);
	border-left: 5px solid #0f172a;
}

.sf_book_right {
	right: 0;
	border-radius: 3px 8px 8px 3px;
	box-shadow: 6px 8px 18px rgba(15, 23, 42, 0.16), inset 4px 0 10px rgba(0,0,0,0.06);
	background: linear-gradient(90deg, #e2e8f0 0%, #ffffff 5%, #ffffff 80%, #f1f5f9 100%);
	border-right: 5px solid #0f172a;
}

.sf_book_spine {
	position: absolute;
	left: 137px;
	top: -2px;
	width: 6px;
	height: 194px;
	background: #0f172a;
	box-shadow: 0 0 8px rgba(0,0,0,0.3);
	border-radius: 3px;
	z-index: 10;
}

.sf_book_ribbon {
	position: absolute;
	left: 138px;
	top: -6px;
	width: 4px;
	height: 215px;
	background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 80%, #d97706 100%);
	box-shadow: 1px 2px 5px rgba(0,0,0,0.25);
	border-radius: 0 0 2px 2px;
	z-index: 12;
	transform: rotate(4deg);
	transform-origin: top center;
}

/* Page Content Simulation */
.sf_page_content {
	padding: 16px 14px;
	display: flex;
	flex-direction: column;
	gap: 7px;
	height: 100%;
}

.sf_text_line {
	height: 3.5px;
	background: #cbd5e1;
	border-radius: 2px;
	opacity: 0.8;
}

.sf_w90 { width: 90%; }
.sf_w85 { width: 85%; }
.sf_w80 { width: 80%; }
.sf_w75 { width: 75%; }
.sf_w70 { width: 70%; }
.sf_w65 { width: 65%; }
.sf_w60 { width: 60%; }

.sf_text_seal {
	margin-top: auto;
	font-size: 11px;
	font-weight: 700;
	color: #4f46e5;
	opacity: 0.85;
	text-align: left;
	letter-spacing: 0.04em;
}

.sf_page_number {
	margin-top: auto;
	font-size: 9px;
	font-weight: 700;
	color: #94a3b8;
	text-align: right;
	font-family: monospace;
}

/* 3D Flipping Pages */
.sf_flip_page {
	position: absolute;
	top: 0;
	right: 0;
	width: 140px;
	height: 190px;
	transform-origin: left center;
	transform-style: preserve-3d;
	z-index: 5;
	pointer-events: none;
}

.sf_page_face {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: #ffffff;
	border: 1px solid #e2e8f0;
	padding: 16px 14px;
	display: flex;
	flex-direction: column;
	gap: 7px;
	backface-visibility: hidden;
}

.sf_page_front {
	border-radius: 3px 8px 8px 3px;
	background: linear-gradient(90deg, #e2e8f0 0%, #ffffff 8%, #ffffff 100%);
	box-shadow: 2px 4px 10px rgba(0,0,0,0.04);
}

.sf_page_back {
	border-radius: 8px 3px 3px 8px;
	background: linear-gradient(-90deg, #e2e8f0 0%, #ffffff 8%, #ffffff 100%);
	transform: rotateY(180deg);
	box-shadow: -2px 4px 10px rgba(0,0,0,0.04);
}

@keyframes sfFlipSequence {
	0% {
		transform: rotateY(0deg);
		box-shadow: 2px 4px 12px rgba(0,0,0,0.05);
	}
	18% {
		transform: rotateY(-35deg) skewY(-2deg);
		box-shadow: 4px 8px 16px rgba(0,0,0,0.12);
	}
	45% {
		transform: rotateY(-180deg) skewY(0deg);
		box-shadow: -4px 8px 16px rgba(0,0,0,0.12);
	}
	85%, 100% {
		transform: rotateY(-180deg);
		box-shadow: -2px 4px 10px rgba(0,0,0,0.04);
	}
}

.sf_flip_1 {
	animation: sfFlipSequence 4.5s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
	animation-delay: 0s;
}

.sf_flip_2 {
	animation: sfFlipSequence 4.5s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
	animation-delay: 1.5s;
}

.sf_flip_3 {
	animation: sfFlipSequence 4.5s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
	animation-delay: 3s;
}

/* Content Elements */
.sf_badge_pill {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	background: #ffffff;
	border: 1px solid #cbd5e1;
	border-radius: 20px;
	padding: 5px 14px;
	font-size: 11.5px;
	font-weight: 700;
	letter-spacing: 0.06em;
	color: #334155;
	text-transform: uppercase;
	box-shadow: 0 1px 3px rgba(0,0,0,0.04);
	margin-bottom: 16px;
}

.sf_landing_title {
	font-size: 34px;
	font-weight: 800;
	color: #0f172a;
	line-height: 1.25;
	letter-spacing: -0.025em;
	margin-bottom: 12px;
}

.sf_landing_subtitle {
	font-size: 16px;
	color: #475569;
	line-height: 1.6;
	max-width: 640px;
	margin: 0 auto 32px auto;
}

/* Authentication Required Gate Card */
.sf_auth_gate_card {
	background: #ffffff;
	border: 1px solid #e2e8f0;
	border-radius: 16px;
	padding: 32px 36px;
	max-width: 540px;
	margin: 0 auto;
	box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.02);
}

.sf_gate_icon {
	width: 48px;
	height: 48px;
	border-radius: 12px;
	background: #eef2ff;
	color: #4f46e5;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 22px;
	margin-bottom: 14px;
	border: 1px solid #e0e7ff;
}

.sf_gate_heading {
	font-size: 18px;
	font-weight: 700;
	color: #0f172a;
	margin-bottom: 6px;
}

.sf_gate_text {
	font-size: 13.5px;
	color: #64748b;
	line-height: 1.55;
	margin-bottom: 24px;
}

.sf_gate_actions {
	display: flex;
	gap: 12px;
	justify-content: center;
	flex-wrap: wrap;
}

.sf_btn_primary {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	background: #0f172a;
	color: #ffffff !important;
	font-size: 14px;
	font-weight: 700;
	padding: 12px 24px;
	border-radius: 10px;
	text-decoration: none !important;
	box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
	transition: all 0.15s ease;
}

.sf_btn_primary:hover {
	background: #1e293b;
	transform: translateY(-1px);
	box-shadow: 0 6px 16px rgba(15, 23, 42, 0.2);
}

.sf_btn_secondary {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	background: #ffffff;
	color: #1e293b !important;
	font-size: 14px;
	font-weight: 600;
	padding: 12px 22px;
	border-radius: 10px;
	text-decoration: none !important;
	border: 1px solid #cbd5e1;
	transition: all 0.15s ease;
}

.sf_btn_secondary:hover {
	background: #f8fafc;
	border-color: #94a3b8;
}

@media (max-width: 640px) {
	.sf_landing_title { font-size: 26px; }
	.sf_landing_subtitle { font-size: 14.5px; }
	.sf_auth_gate_card { padding: 24px 20px; }
}
</style>

<div class="sf_site_landing">

	{if !$currentUser}
		{* ── PUBLIC / UNAUTHENTICATED: CENTERED BOOK ANIMATION + LOGIN GATE ── *}
		{* STRICT: NO journals or manuscripts are displayed without logging in *}
		<div class="sf_landing_center">

			{* Centered 3D Animated Book *}
			<div class="sf_book_wrapper">
				<div class="sf_book_ambient_glow"></div>
				<div class="sf_book_shadow"></div>
				<div class="sf_book_scene">
					<div class="sf_book_3d">
						<!-- Static Left Page -->
						<div class="sf_book_half sf_book_left">
							<div class="sf_page_content">
								<div class="sf_text_line sf_w80"></div>
								<div class="sf_text_line sf_w90"></div>
								<div class="sf_text_line sf_w65"></div>
								<div class="sf_text_line sf_w75"></div>
								<div class="sf_text_line sf_w85"></div>
								<div class="sf_text_line sf_w70"></div>
								<div class="sf_text_seal">⚡ ScholarFlow</div>
							</div>
						</div>

						<!-- Center Spine & Golden Ribbon Bookmark -->
						<div class="sf_book_spine"></div>
						<div class="sf_book_ribbon"></div>

						<!-- Flipping Page 1 -->
						<div class="sf_flip_page sf_flip_1">
							<div class="sf_page_face sf_page_front">
								<div class="sf_text_line sf_w70"></div>
								<div class="sf_text_line sf_w85"></div>
								<div class="sf_text_line sf_w60"></div>
								<div class="sf_text_line sf_w75"></div>
							</div>
							<div class="sf_page_face sf_page_back">
								<div class="sf_text_line sf_w80"></div>
								<div class="sf_text_line sf_w90"></div>
								<div class="sf_text_line sf_w75"></div>
							</div>
						</div>

						<!-- Flipping Page 2 -->
						<div class="sf_flip_page sf_flip_2">
							<div class="sf_page_face sf_page_front">
								<div class="sf_text_line sf_w85"></div>
								<div class="sf_text_line sf_w60"></div>
								<div class="sf_text_line sf_w75"></div>
							</div>
							<div class="sf_page_face sf_page_back">
								<div class="sf_text_line sf_w90"></div>
								<div class="sf_text_line sf_w70"></div>
								<div class="sf_text_line sf_w80"></div>
							</div>
						</div>

						<!-- Flipping Page 3 -->
						<div class="sf_flip_page sf_flip_3">
							<div class="sf_page_face sf_page_front">
								<div class="sf_text_line sf_w65"></div>
								<div class="sf_text_line sf_w80"></div>
								<div class="sf_text_line sf_w70"></div>
							</div>
							<div class="sf_page_face sf_page_back">
								<div class="sf_text_line sf_w85"></div>
								<div class="sf_text_line sf_w60"></div>
								<div class="sf_text_line sf_w75"></div>
							</div>
						</div>

						<!-- Static Right Page -->
						<div class="sf_book_half sf_book_right">
							<div class="sf_page_content">
								<div class="sf_text_line sf_w75"></div>
								<div class="sf_text_line sf_w85"></div>
								<div class="sf_text_line sf_w90"></div>
								<div class="sf_text_line sf_w65"></div>
								<div class="sf_text_line sf_w80"></div>
								<div class="sf_text_line sf_w70"></div>
								<div class="sf_page_number">2026 &bull; SF</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Heading & Mission -->
			<div class="sf_badge_pill">
				<span style="color:#eab308;font-size:12px;">⚡</span>
				<span>ScholarFlow Platform</span>
			</div>
			<h1 class="sf_landing_title">Scholarly Publishing &amp; Peer Review Portal</h1>
			<p class="sf_landing_subtitle">
				An integrated multi-journal publishing environment for academic research, double-blind peer review, and manuscript lifecycle management.
			</p>

			<!-- Authentication Access Gate -->
			<div class="sf_auth_gate_card">
				<div class="sf_gate_icon">🔒</div>
				<h2 class="sf_gate_heading">Scholar Authentication Required</h2>
				<p class="sf_gate_text">
					Access to hosted journals, research manuscripts, editorial submissions, and reviewer dashboards is restricted to registered members. Please sign in or register to continue.
				</p>
				<div class="sf_gate_actions">
					<a href="{url page="login"}" class="sf_btn_primary">
						<span>Sign In</span>
						<span>&rarr;</span>
					</a>
					<a href="{url page="user" op="register"}" class="sf_btn_secondary">
						<span>Create Account</span>
					</a>
				</div>
			</div>

		</div>

	{else}
		{* ── AUTHENTICATED: LOGGED-IN SCHOLAR DASHBOARD & HOSTED JOURNALS ── *}
		<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px 36px;margin-bottom:32px;box-shadow:0 4px 20px -2px rgba(15,23,42,0.04);">
			<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:12px;">
				<div style="display:inline-flex;align-items:center;gap:7px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:20px;padding:4px 12px;">
					<span style="font-size:13px;color:#eab308;">⚡</span>
					<span style="font-size:11px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.05em;">ScholarFlow Platform</span>
				</div>
				<div style="display:inline-flex;align-items:center;gap:6px;background:#dcfce7;border:1px solid #bbf7d0;color:#166534;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">
					<span style="width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block;"></span>
					<span>Authenticated Scholar</span>
				</div>
			</div>

			<h1 style="font-size:28px;font-weight:800;color:#0f172a;margin:0 0 8px 0;line-height:1.25;">
				Welcome, {$currentUser->getUsername()|escape}
			</h1>
			<p style="font-size:14.5px;color:#475569;margin:0 0 20px 0;max-width:700px;line-height:1.6;">
				Select a hosted journal below to access editorial workflows, manage active manuscript submissions, or participate in double-blind peer review.
			</p>

			{assign var=siteJournals value=$allJournals|default:$journals}
			{assign var=firstJournalPath value="test"}
			{if $siteJournals && count($siteJournals)}
				{assign var=firstJournalPath value=$siteJournals[0]->getPath()}
			{/if}

			<div style="display:flex;gap:10px;flex-wrap:wrap;">
				{if $isSiteAdmin}
					<a href="{if $currentContext}{url page="dashboard"}{else}{url journal=$firstJournalPath page="dashboard"}{/if}" class="sf_btn_primary" style="padding:10px 18px;font-size:13px;">
						<span>Go to Editorial Dashboard &rarr;</span>
					</a>
					<a href="{url context="index" page="admin"}" class="sf_btn_secondary" style="padding:10px 18px;font-size:13px;">
						<span>ScholarFlow Platform Console &rarr;</span>
					</a>
				{else}
					<a href="{url journal=$firstJournalPath page="dashboard" op="mySubmissions"}" class="sf_btn_primary" style="padding:10px 18px;font-size:13px;">
						<span>Go to My Submissions &rarr;</span>
					</a>
					<a href="{url journal=$firstJournalPath page="submission"}" class="sf_btn_secondary" style="padding:10px 18px;font-size:13px;">
						<span>➕ Start New Submission</span>
					</a>
				{/if}
			</div>
		</div>

		{* Hosted Journals Grid for Authenticated Users *}
		{if $siteJournals && count($siteJournals)}
			<div style="margin-bottom:24px;">
				<h2 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 6px 0;">Hosted Scholarly Journals</h2>
				<p style="font-size:13.5px;color:#64748b;margin:0 0 20px 0;">Academic journals hosted on your ScholarFlow platform.</p>

				<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;">
					{foreach from=$siteJournals item=j}
						<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.02);transition:all 0.15s ease;" onmouseenter="this.style.borderColor='#cbd5e1';this.style.transform='translateY(-2px)'" onmouseleave="this.style.borderColor='#e2e8f0';this.style.transform='none'">
							<div>
								<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
									<span style="font-size:11px;font-weight:700;color:#4338ca;background:#e0e7ff;padding:3px 8px;border-radius:5px;letter-spacing:0.04em;">
										{if $j->getLocalizedData('acronym')}{$j->getLocalizedData('acronym')|escape}{else}JOURNAL{/if}
									</span>
									<span style="font-size:11.5px;font-family:monospace;color:#64748b;">/{$j->getPath()|escape}</span>
								</div>
								<h3 style="font-size:17px;font-weight:700;color:#0f172a;margin:0 0 8px 0;line-height:1.4;">
									{$j->getLocalizedName()|escape}
								</h3>
								{if $j->getLocalizedDescription()}
									<p style="font-size:13px;color:#475569;line-height:1.55;margin:0 0 16px 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
										{$j->getLocalizedDescription()|strip_tags|truncate:180}
									</p>
								{/if}
							</div>
							<div style="padding-top:16px;border-top:1px solid #f1f5f9;display:flex;gap:8px;">
								<a href="{url journal=$j->getPath() page="index"}" style="flex:1;text-align:center;background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;padding:8px 12px;font-size:12.5px;font-weight:600;border-radius:7px;text-decoration:none;">
									View Journal
								</a>
								{if $isSiteAdmin}
									<a href="{url journal=$j->getPath() page="dashboard"}" style="flex:1;text-align:center;background:#0f172a;color:#ffffff;border:1px solid #0f172a;padding:8px 12px;font-size:12.5px;font-weight:600;border-radius:7px;text-decoration:none;">
										Dashboard
									</a>
								{else}
									<a href="{url journal=$j->getPath() page="submission"}" style="flex:1;text-align:center;background:#0f172a;color:#ffffff;border:1px solid #0f172a;padding:8px 12px;font-size:12.5px;font-weight:600;border-radius:7px;text-decoration:none;">
										Submit Paper
									</a>
								{/if}
							</div>
						</div>
					{/foreach}
				</div>
			</div>
		{/if}

	{/if}

</div>

{include file="frontend/components/footer.tpl"}
