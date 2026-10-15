/**
 * ScholarFlow Document Viewer, Markups & AI Assistant - scholarflow.js
 * Clean, Modern, Full-Space Editorial & Reviewer Workspace
 */

(function () {
    'use strict';

    // Expose helpers globally
    window.__sfOpen = sfOpen;
    window.__sfClose = sfClose;
    window.__sfToggleMode = toggleWindowMode;
    window.__sfToggleCommentsSidebar = toggleCommentsSidebar;
    window.__sfSwitchTab = switchTab;
    window.__sfSetAndAnalyze = setAndAnalyze;
    window.__sfSelectPaper = selectPaper;
    window.__sfOpenPaperPickerModal = openPaperPickerModal;
    window.__sfClosePaperPickerModal = closePaperPickerModal;
    window.__sfFilterPaperPicker = filterPaperPicker;
    window.__sfSaveAnnotation = saveAnnotation;
    window.__sfDeleteAnnotation = deleteAnnotation;
    window.__sfExportMarkups = exportMarkups;
    window.__sfScrollToAnnotation = scrollToAnnotation;
    window.__sfLoadAnnotations = loadAnnotations;
    window.__sfRenderAnnotationsList = renderAnnotationsList;
    window.__sfOnHighlightClick = onHighlightClick;
    window.__sfSetColor = setColor;
    window.__sfCancelPopover = cancelPopover;
    window.__sfReRunAnalysis = function() { openReRunConfirmModal(); };
    window.__sfReRunReviewers = function() {
        var sid = currentSubmissionId || '1';
        if (window.__sfMatchmakingCache) delete window.__sfMatchmakingCache[sid];
        lastEvaluatedSubmissions['reviewers'] = sid;
        runReviewerRecommendations(sid, true);
    };
    window.__sfRefreshNativeMatchmaking = function() {
        var sid = getActiveReviewerModalSubmissionId();
        if (window.__sfMatchmakingCache) delete window.__sfMatchmakingCache[sid];
        var banner = document.getElementById('sfNativeMatchBanner');
        if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
        injectNativeReviewerMatchmaking(true);
    };
    window.__sfSortNativeReviewers = function() {
        var ul = document.querySelector('ul.listPanel__itemsList, .listPanel__itemsList, ul');
        if (ul) sortReviewersByMatchScore(ul);
    };
    window.__sfAssignReviewerInOJS = function(reviewerName) {
        sfClose();
        setTimeout(function() {
            var panel = document.querySelector('.listPanel--selectReviewer, .listPanel, .pkpListPanel--selectReviewer, [class*="selectReviewer"]');
            if (panel) {
                var items = panel.querySelectorAll('li.listPanel__item, .listPanel__item--reviewer, li.pkpListPanelItem, .pkpListPanelItem--selectReviewer, li');
                for (var i = 0; i < items.length; i++) {
                    var title = items[i].querySelector('.listPanel__itemTitle, .pkpListPanelItem__title, [class*="itemTitle"], h4, h3');
                    if (title && title.textContent.toLowerCase().indexOf(reviewerName.toLowerCase()) !== -1) {
                        items[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        items[i].style.outline = '3px solid #4f46e5';
                        items[i].style.borderRadius = '8px';
                        var btn = items[i].querySelector('.listPanel__itemActions button, .pkpListPanelItem__actions button, button.pkpButton');
                        if (btn) btn.click();
                        break;
                    }
                }
            }
        }, 350);
    };

    var currentSubmissionId = '1';
    var currentUserInfo = null;
    var cachedAnnotations = [];
    var currentCommentFilter = 'editor';
    var currentReviewerSubFilter = '';
    var releasedReviewersMap = {};
    var currentSelectedRange = null;
    var selectedHighlightColor = 'yellow';
    var isFullscreen = true;
    var lastEvaluatedSubmissions = {};

    // ── Get submissionId from multiple sources ─────────────────────────────
    function getSubmissionId() {
        var href = window.location.href;

        var rm = href.match(/\/reviewer\/(?:submission|step)\/(\d+)/);
        if (rm) return rm[1];

        var m = href.match(/[?&]workflowSubmissionId=(\d+)/);
        if (m) return m[1];

        var sm = href.match(/[?&]submissionId=(\d+)/);
        if (sm) return sm[1];

        m = href.match(/\/workflow\/index\/(\d+)/);
        if (m) return m[1];

        var subInput = document.querySelector('input[name="submissionId"]');
        if (subInput && subInput.value) return subInput.value;

        var domAttr = document.querySelector('[data-submission-id]');
        if (domAttr && domAttr.getAttribute('data-submission-id')) {
            return domAttr.getAttribute('data-submission-id');
        }

        var revLink = document.querySelector('a[href*="/reviewer/submission/"], a[href*="/reviewer/step/"], a[href*="/workflow/index/"]');
        if (revLink) {
            var rm2 = revLink.href.match(/\/(?:reviewer\/(?:submission|step)|workflow\/index)\/(\d+)/);
            if (rm2) return rm2[1];
        }

        var fileLinks = document.querySelectorAll('a[href*="/files/"], a[href*="/download/"], a[href*="/downloadFile/"]');
        for (var f = 0; f < fileLinks.length; f++) {
            var fm = fileLinks[f].href.match(/\/(?:submissions|submission|downloadFile)\/(\d+)/);
            if (fm) return fm[1];
        }

        var headerNum = document.querySelector('.pkpHeader__submissionId, .pkp_badge, .submissionId');
        if (headerNum && headerNum.textContent.trim().match(/^\d+$/)) {
            return headerNum.textContent.trim();
        }

        return currentSubmissionId || null;
    }

    // ── Build OJS context base URL ─────────────────────────────────────────
    function getContextBase() {
        if (window.pkp && window.pkp.context && window.pkp.context.pageBaseUrl) {
            return window.pkp.context.pageBaseUrl.replace(/\/+$/, '');
        }

        var href = window.location.href;
        var m = href.match(/(https?:\/\/[^\/]+(?:\/[^\/]+)*\/index\.php\/[^\/\?\#]+)/i);
        if (m) return m[1];

        var idx = href.indexOf('index.php');
        if (idx !== -1) {
            var afterIdx = href.substring(idx + 9).replace(/^\/+/, '');
            var journal = afterIdx.split(/[\/\?\#]/)[0];
            if (journal) {
                return href.substring(0, idx + 9) + '/' + journal;
            }
        }

        var cut = href.search(/\/(dashboard|workflow|management|submission|reviewer|scholarflow)\//);
        if (cut > 0) return href.substring(0, cut);
        return href.split('?')[0].replace(/\/+$/, '');
    }

    // ── Init on page load ──────────────────────────────────────────────────
    function init() {
        ensureButton();
        fetchUserInfo();
        fetchSubmissionsList();
        injectNativeOJSButtons();
        injectNativeReviewerMatchmaking();
        setInterval(function () {
            ensureButton();
            injectNativeOJSButtons();
            injectNativeReviewerMatchmaking();
        }, 800);

        if (window.MutationObserver && !window.__sfObserverInitialized) {
            window.__sfObserverInitialized = true;
            try {
                var observer = new MutationObserver(function () {
                    injectNativeOJSButtons();
                    injectNativeReviewerMatchmaking();
                });
                observer.observe(document.body, { childList: true, subtree: true });
            } catch (_) {}
        }

        // Global click listener to capture active submission when Assign Reviewers is clicked
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('button, a');
            if (btn) {
                var txt = (btn.textContent || '').trim().toLowerCase();
                if (txt.indexOf('assign reviewer') !== -1 || txt.indexOf('add reviewer') !== -1) {
                    var row = btn.closest('tr, .pkpTable__row, .pkpListPanelItem');
                    if (row) {
                        var idCell = row.querySelector('.pkpTable__cell--id, [class*="cell--id"]');
                        var sid = idCell ? idCell.textContent.trim() : '';
                        if (!sid) {
                            var firstCell = row.querySelector('td, .pkpTable__cell');
                            if (firstCell && /^\d+$/.test(firstCell.textContent.trim())) {
                                sid = firstCell.textContent.trim();
                            }
                        }
                        if (sid && /^\d+$/.test(sid)) {
                            window.__sfActiveAssignSubmissionId = sid;
                            currentSubmissionId = sid;
                        }
                    }
                    setTimeout(function () {
                        injectNativeReviewerMatchmaking();
                    }, 400);
                    setTimeout(function () {
                        injectNativeReviewerMatchmaking();
                    }, 1000);
                }
            }
        }, true);
    }

    function injectNativeOJSButtons() {
        var sid = getSubmissionId();

        // 1. OJS Workflow Stage Action Bar (in Editorial Workflow /workflow/index/{id})
        var workflowContainers = [
            document.querySelector('.stage_actions'),
            document.querySelector('.pkp_workflow__header'),
            document.querySelector('.pkpHeader__actions'),
            document.querySelector('.pkp_header .actions')
        ];
        var targetContainer = null;
        for (var i = 0; i < workflowContainers.length; i++) {
            if (workflowContainers[i]) {
                targetContainer = workflowContainers[i];
                break;
            }
        }

        if (targetContainer && !document.getElementById('sfNativeWorkflowBtn')) {
            var nativeBtn = document.createElement('button');
            nativeBtn.id = 'sfNativeWorkflowBtn';
            nativeBtn.className = 'pkp_button pkp_button_primary scholarflow-native-btn';
            nativeBtn.type = 'button';
            nativeBtn.style.cssText = [
                'margin-left: 8px !important',
                'margin-right: 8px !important',
                'display: inline-flex !important',
                'align-items: center !important',
                'gap: 6px !important',
                'background: linear-gradient(135deg, #4f46e5, #4338ca) !important',
                'border: 1px solid #3730a3 !important',
                'color: #ffffff !important',
                'font-weight: 700 !important',
                'font-size: 12px !important',
                'padding: 7px 14px !important',
                'border-radius: 6px !important',
                'box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3) !important',
                'cursor: pointer !important',
                'vertical-align: middle !important',
                'transition: all 0.2s ease !important'
            ].join(';');
            nativeBtn.innerHTML = '<span style="font-size:14px">🤖</span> <span>ScholarFlow AI Assistant</span>';
            nativeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.__sfOpen(sid || currentSubmissionId || '1');
            };
            nativeBtn.onmouseenter = function() {
                nativeBtn.style.background = 'linear-gradient(135deg, #4338ca, #3730a3)';
                nativeBtn.style.transform = 'translateY(-1px)';
            };
            nativeBtn.onmouseleave = function() {
                nativeBtn.style.background = 'linear-gradient(135deg, #4f46e5, #4338ca)';
                nativeBtn.style.transform = 'translateY(0)';
            };
            targetContainer.appendChild(nativeBtn);
        }

        // 2. Primary Navigation Menu in OJS Backend Header
        var navMenu = document.querySelector('#navigationPrimary, .pkp_navigation_primary, .pkpNav__menu');
        if (navMenu && !document.getElementById('sfNativeNavLi')) {
            var li = document.createElement('li');
            li.id = 'sfNativeNavLi';
            li.className = 'pkpNav__item scholarflow-nav-item';
            li.style.cssText = 'display:inline-block;margin-left:8px;vertical-align:middle;';
            li.innerHTML = '<a href="#" class="pkpNav__link" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;color:#4f46e5 !important;padding:8px 12px;border-radius:6px;background:rgba(99,102,241,0.08);text-decoration:none;"><span style="font-size:13px">🤖</span> <span>ScholarFlow AI</span></a>';
            li.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.__sfOpen(sid || currentSubmissionId || '1');
            };
            navMenu.appendChild(li);
        }

        // 3. Editorial Dashboard List Panel Toolbar
        var dashTools = document.querySelector('.pkpListPanel__tools, .submissionsListPanel .pkpHeader, .pkpListPanel .pkpHeader__actions');
        if (dashTools && !document.getElementById('sfNativeDashboardBtn')) {
            var dashBtn = document.createElement('button');
            dashBtn.id = 'sfNativeDashboardBtn';
            dashBtn.className = 'pkp_button scholarflow-dashboard-btn';
            dashBtn.type = 'button';
            dashBtn.style.cssText = [
                'margin-left: 8px !important',
                'display: inline-flex !important',
                'align-items: center !important',
                'gap: 6px !important',
                'background: #eef2ff !important',
                'border: 1px solid #c7d2fe !important',
                'color: #4338ca !important',
                'font-weight: 700 !important',
                'font-size: 12px !important',
                'padding: 6px 12px !important',
                'border-radius: 6px !important',
                'cursor: pointer !important',
                'vertical-align: middle !important',
                'transition: all 0.2s ease !important'
            ].join(';');
            dashBtn.innerHTML = '<span style="font-size:13px">🤖</span> <span>ScholarFlow AI Hub</span>';
            dashBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.__sfOpen(sid || currentSubmissionId || '1');
            };
            dashTools.appendChild(dashBtn);
        }
    }

    // ── Native OJS Reviewer Matchmaking Integration ───────────────────────
    window.__sfMatchmakingCache = window.__sfMatchmakingCache || {};
    window.__sfMatchmakingLoading = window.__sfMatchmakingLoading || {};

    function getActiveReviewerModalSubmissionId() {
        if (window.__sfActiveAssignSubmissionId) {
            return String(window.__sfActiveAssignSubmissionId);
        }
        // Match author string in modal against cachedSubmissionsList
        var modalEl = document.querySelector('.pkpListPanel--selectReviewer, [class*="selectReviewer"], .pkp_modal');
        if (modalEl && cachedSubmissionsList && cachedSubmissionsList.length > 0) {
            var modalText = (modalEl.innerText || modalEl.textContent || '').toLowerCase();
            for (var i = 0; i < cachedSubmissionsList.length; i++) {
                var sub = cachedSubmissionsList[i];
                if (sub.authors && sub.authors !== 'Authors not listed') {
                    var authorTokens = sub.authors.toLowerCase().split(',');
                    for (var a = 0; a < authorTokens.length; a++) {
                        var token = authorTokens[a].trim();
                        if (token.length > 3 && modalText.indexOf(token) !== -1) {
                            return String(sub.id);
                        }
                    }
                }
                if (sub.title && sub.title.length > 8 && modalText.indexOf(sub.title.toLowerCase().substring(0, 20)) !== -1) {
                    return String(sub.id);
                }
            }
        }
        return getSubmissionId() || currentSubmissionId || '1';
    }

    function injectNativeReviewerMatchmaking(force) {
        var reviewerPanel = document.querySelector(
            '.listPanel--selectReviewer, .listPanel, .pkpListPanel--selectReviewer, [class*="selectReviewer"], .pkpSelectReviewerListPanel'
        );
        var itemsList = reviewerPanel ? reviewerPanel.querySelector(
            '.listPanel__itemsList, .listPanel__items, .pkpListPanel__items, ul'
        ) : null;

        if (!itemsList) {
            var anyItem = document.querySelector('.listPanel__item--reviewer, .listPanel__item, .pkpListPanelItem--selectReviewer');
            if (anyItem) {
                itemsList = anyItem.closest('ul, .listPanel__itemsList, .listPanel__items') || anyItem.parentElement;
                if (itemsList) reviewerPanel = itemsList.closest('.listPanel, .listPanel--selectReviewer') || itemsList.parentElement;
            }
        }

        if (!itemsList) return;

        var reviewerItems = itemsList.querySelectorAll('li.listPanel__item, li.pkpListPanelItem, li');
        if (!reviewerItems || reviewerItems.length === 0) return;

        var sid = getActiveReviewerModalSubmissionId();

        // 1. Inject Matchmaking Info Banner in panel header if not present
        if (!document.getElementById('sfNativeMatchBanner')) {
            var banner = document.createElement('div');
            banner.id = 'sfNativeMatchBanner';
            banner.className = 'sf-native-match-banner';
            banner.style.cssText = [
                'background: linear-gradient(135deg, #eff6ff, #f5f3ff)',
                'border: 1px solid #c7d2fe',
                'border-radius: 10px',
                'padding: 12px 18px',
                'margin: 12px 0 16px 0',
                'display: flex',
                'align-items: center',
                'justify-content: space-between',
                'gap: 12px',
                'box-shadow: 0 1px 3px rgba(79,70,229,0.06)'
            ].join(';');
            banner.innerHTML = [
                '<div style="display:flex;align-items:center;gap:12px">',
                '  <span style="font-size:22px">🤖</span>',
                '  <div>',
                '    <div style="font-size:13px;font-weight:800;color:#1e1b4b;display:flex;align-items:center;gap:8px">',
                '      <span>ScholarFlow AI Reviewer Matchmaking</span>',
                '      <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:#4f46e5;color:#fff">Submission #' + sid + '</span>',
                '    </div>',
                '    <div style="font-size:12px;color:#475569;margin-top:2px">',
                '      AI compatibility match percentages &amp; semantic justifications are displayed directly below. Click <strong>Select Reviewer</strong> to assign.',
                '    </div>',
                '  </div>',
                '</div>',
                '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">',
                '  <button id="sfSortReviewersBtn" type="button" class="pkp_button" style="background:#f0fdf4 !important;border:1px solid #86efac !important;color:#166534 !important;font-weight:700 !important;font-size:11px !important;padding:6px 12px !important;border-radius:6px !important;cursor:pointer !important;display:inline-flex !important;align-items:center !important;gap:4px !important">⚡ Sort Best Match First</button>',
                '  <button id="sfReanalyzeMatchBtn" type="button" class="pkp_button" style="background:#4f46e5 !important;border:none !important;color:#ffffff !important;font-weight:700 !important;font-size:11px !important;padding:6px 12px !important;border-radius:6px !important;cursor:pointer !important;display:inline-flex !important;align-items:center !important;gap:4px !important">🔄 Refresh AI</button>',
                '</div>'
            ].join('');

            var body = reviewerPanel ? reviewerPanel.querySelector('.listPanel__body, .pkpListPanel__body') : null;
            if (reviewerPanel && body && reviewerPanel.contains(body)) {
                reviewerPanel.insertBefore(banner, body);
            } else if (itemsList && itemsList.parentNode) {
                itemsList.parentNode.insertBefore(banner, itemsList);
            }

            var sortBtn = document.getElementById('sfSortReviewersBtn');
            if (sortBtn) {
                sortBtn.onclick = function(e) {
                    e.preventDefault();
                    sortReviewersByMatchScore(itemsList);
                    var prevText = sortBtn.innerHTML;
                    sortBtn.innerHTML = '✅ Sorted by Best Fit!';
                    sortBtn.style.setProperty('background', '#dcfce7', 'important');
                    setTimeout(function() {
                        sortBtn.innerHTML = prevText;
                        sortBtn.style.setProperty('background', '#f0fdf4', 'important');
                    }, 1400);
                };
            }
            var reanalyzeBtn = document.getElementById('sfReanalyzeMatchBtn');
            if (reanalyzeBtn) {
                reanalyzeBtn.onclick = function(e) {
                    e.preventDefault();
                    if (reanalyzeBtn.disabled) return;
                    reanalyzeBtn.disabled = true;
                    reanalyzeBtn.innerHTML = '⏳ Refreshing AI...';
                    delete window.__sfMatchmakingCache[sid];
                    injectNativeReviewerMatchmaking(true);
                };
            }
        }

        // 2. If recommendations are cached, apply immediately
        if (window.__sfMatchmakingCache[sid] && !force) {
            applyReviewerMatchesToDom(reviewerItems, window.__sfMatchmakingCache[sid]);
            return;
        }

        if (window.__sfMatchmakingLoading[sid]) return;
        window.__sfMatchmakingLoading[sid] = true;

        // Clear existing badges if force refresh
        if (force) {
            reviewerItems.forEach(function(li) {
                var oldBadge = li.querySelector('.sf-ojs-match-badge');
                if (oldBadge && oldBadge.parentNode) oldBadge.parentNode.removeChild(oldBadge);
                var oldCard = li.querySelector('.sf-ojs-match-card');
                if (oldCard && oldCard.parentNode) oldCard.parentNode.removeChild(oldCard);
            });
        }

        // Show loading tag on items
        reviewerItems.forEach(function(li) {
            var titleEl = li.querySelector('.listPanel__itemTitle, .pkpListPanelItem__title, [class*="itemTitle"], h4, h3');
            if (titleEl && !li.querySelector('.sf-ojs-match-badge')) {
                var loadTag = document.createElement('span');
                loadTag.className = 'sf-ojs-match-badge sf-ojs-loading-badge';
                loadTag.style.cssText = 'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle;display:inline-flex;align-items:center;gap:4px;';
                loadTag.innerHTML = '🤖 Matching...';
                titleEl.appendChild(loadTag);
            }
        });

        var url = getContextBase() + '/scholarflow/recommendReviewers?submissionId=' + sid + (force ? '&force_refresh=1' : '');
        fetch(url, { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                window.__sfMatchmakingLoading[sid] = false;
                var reanalyzeBtn = document.getElementById('sfReanalyzeMatchBtn');
                if (reanalyzeBtn) {
                    reanalyzeBtn.innerHTML = '🔄 Refresh AI';
                    reanalyzeBtn.disabled = false;
                }
                if (data && data.recommendations) {
                    window.__sfMatchmakingCache[sid] = data.recommendations;
                    applyReviewerMatchesToDom(reviewerItems, data.recommendations);
                    sortReviewersByMatchScore(itemsList);
                }
            })
            .catch(function(err) {
                window.__sfMatchmakingLoading[sid] = false;
                var reanalyzeBtn = document.getElementById('sfReanalyzeMatchBtn');
                if (reanalyzeBtn) {
                    reanalyzeBtn.innerHTML = '🔄 Refresh AI';
                    reanalyzeBtn.disabled = false;
                }
                console.error('ScholarFlow native reviewer matchmaking error:', err);
            });
    }

    function applyReviewerMatchesToDom(reviewerItems, recommendations) {
        if (!recommendations || recommendations.length === 0) return;

        var recByName = {};
        recommendations.forEach(function(r) {
            if (r.name) recByName[r.name.trim().toLowerCase()] = r;
        });

        reviewerItems.forEach(function(li) {
            var titleEl = li.querySelector('.listPanel__itemTitle, .pkpListPanelItem__title, [class*="itemTitle"], h4, h3') || li;

            // Remove loading badge if any
            var oldLoading = titleEl.querySelector('.sf-ojs-loading-badge');
            if (oldLoading && oldLoading.parentNode) oldLoading.parentNode.removeChild(oldLoading);

            var reviewerName = '';
            for (var c = 0; c < titleEl.childNodes.length; c++) {
                var node = titleEl.childNodes[c];
                if (node.nodeType === Node.TEXT_NODE) {
                    reviewerName += node.textContent;
                }
            }
            reviewerName = reviewerName.trim();
            if (!reviewerName) reviewerName = titleEl.textContent.trim();

            var rec = recByName[reviewerName.toLowerCase()];
            if (!rec) {
                for (var k in recByName) {
                    if (reviewerName.toLowerCase().indexOf(k) !== -1 || k.indexOf(reviewerName.toLowerCase()) !== -1) {
                        rec = recByName[k];
                        break;
                    }
                }
            }

            var score = rec ? (rec.score || 0) : 15;
            var reason = rec ? (rec.reason || '') : 'General reviewer profile without specific keyword matches.';

            // Store score on li for sorting
            li.setAttribute('data-sf-match-score', score);

            // 1. Add or update Match Badge
            var existingBadge = titleEl.querySelector('.sf-ojs-match-badge');
            if (!existingBadge) {
                var badge = document.createElement('span');
                badge.className = 'sf-ojs-match-badge';

                var badgeBg = '#ecfdf5';
                var badgeColor = '#047857';
                var badgeBorder = '#a7f3d0';
                var matchText = 'Top Match';

                if (score >= 90) {
                    badgeBg = '#dcfce7'; badgeColor = '#15803d'; badgeBorder = '#86efac'; matchText = score + '% Match • Top Recommendation';
                } else if (score >= 70) {
                    badgeBg = '#eff6ff'; badgeColor = '#1d4ed8'; badgeBorder = '#bfdbfe'; matchText = score + '% Match • High Fit';
                } else if (score >= 40) {
                    badgeBg = '#fffbeb'; badgeColor = '#b45309'; badgeBorder = '#fde68a'; matchText = score + '% Match • Moderate Fit';
                } else {
                    badgeBg = '#f1f5f9'; badgeColor = '#64748b'; badgeBorder = '#e2e8f0'; matchText = score + '% Match (Low Alignment)';
                }

                badge.style.cssText = [
                    'background:' + badgeBg,
                    'color:' + badgeColor,
                    'border:1px solid ' + badgeBorder,
                    'font-size:11px',
                    'font-weight:800',
                    'padding:3px 10px',
                    'border-radius:12px',
                    'margin-left:10px',
                    'display:inline-flex',
                    'align-items:center',
                    'gap:4px',
                    'vertical-align:middle',
                    'box-shadow:0 1px 2px rgba(0,0,0,0.05)'
                ].join(';');
                badge.innerHTML = '🤖 ' + matchText;
                titleEl.appendChild(badge);
            }

            // 2. Add Match Analysis Box inside identity container or summary
            var summaryEl = li.querySelector('.listPanel__itemIdentity, .listPanel__itemSummary, .pkpListPanelItem__summary, .pkpListPanelItem__item');
            if (!summaryEl) {
                summaryEl = li;
            }

            if (!li.querySelector('.sf-ojs-match-card')) {
                var matchCard = document.createElement('div');
                matchCard.className = 'sf-ojs-match-card';
                var accentBorder = (score >= 80) ? '#10b981' : ((score >= 50) ? '#3b82f6' : '#94a3b8');
                matchCard.style.cssText = [
                    'margin-top:8px',
                    'margin-bottom:6px',
                    'background:linear-gradient(135deg,#f8fafc,#ffffff)',
                    'border:1px solid #e2e8f0',
                    'border-left:4px solid ' + accentBorder,
                    'border-radius:8px',
                    'padding:10px 14px',
                    'font-size:12px',
                    'line-height:1.55',
                    'color:#334155',
                    'box-shadow:0 1px 2px rgba(0,0,0,0.02)'
                ].join(';');

                matchCard.innerHTML = [
                    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">',
                    '  <div style="display:flex;align-items:center;gap:6px;font-weight:800;color:#1e1b4b;font-size:12px">',
                    '    <span>🎯 ScholarFlow AI Match Analysis:</span>',
                    '    <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;background:#e0e7ff;color:#3730a3">AI Evaluated</span>',
                    '  </div>',
                    '  <span style="font-size:12px;font-weight:800;color:' + (score >= 80 ? '#15803d' : '#475569') + '">' + score + '% Compatibility</span>',
                    '</div>',
                    '<div style="color:#475569;font-size:12px">' + esc(reason) + '</div>'
                ].join('');

                var identityEl = li.querySelector('.listPanel__itemIdentity');
                if (identityEl) {
                    identityEl.appendChild(matchCard);
                    identityEl.style.minWidth = '200px';
                } else {
                    var actionsEl = li.querySelector('.listPanel__itemActions, .pkpListPanelItem__actions, [class*="actions"]');
                    if (actionsEl && actionsEl.parentNode === summaryEl) {
                        summaryEl.insertBefore(matchCard, actionsEl);
                    } else {
                        summaryEl.appendChild(matchCard);
                    }
                }
            }
        });
    }

    function sortReviewersByMatchScore(itemsList) {
        if (!itemsList) {
            itemsList = document.querySelector('ul.listPanel__itemsList, .listPanel__itemsList, ul');
        }
        if (itemsList && itemsList.tagName !== 'UL') {
            var actualUl = itemsList.querySelector('ul');
            if (actualUl) itemsList = actualUl;
        }
        if (!itemsList) return;

        var items = Array.prototype.slice.call(itemsList.children).filter(function(el) {
            return el.tagName === 'LI';
        });
        if (items.length <= 1) return;

        items.sort(function(a, b) {
            var scoreA = parseInt(a.getAttribute('data-sf-match-score') || '0', 10);
            var scoreB = parseInt(b.getAttribute('data-sf-match-score') || '0', 10);
            return scoreB - scoreA;
        });

        items.forEach(function(item) {
            itemsList.appendChild(item);
        });
    }

    function fetchUserInfo() {
        var url = getContextBase() + '/scholarflow/userInfo';
        fetch(url, { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && data.user) {
                    currentUserInfo = data.user;
                    applyUserRoleGating();
                    if (cachedAnnotations && cachedAnnotations.length > 0) {
                        renderAnnotationsList(cachedAnnotations);
                    }
                }
            })
            .catch(function () {});
    }

    function applyUserRoleGating() {
        if (!currentUserInfo) return;
        var isAuthorOnly = currentUserInfo.isAuthorOnly;
        var isEditor     = currentUserInfo.isEditor;
        var isReviewer   = currentUserInfo.isReviewer;

        var tabPre         = document.getElementById('sfTabPreScreen');
        var tabRec         = document.getElementById('sfTabRecReviewers');
        var badge          = document.getElementById('sfUserRoleBadge');

        if (badge) {
            badge.textContent = currentUserInfo.displayRole || 'User';
            if (isEditor) {
                badge.style.background = '#f3e8ff';
                badge.style.color = '#7e22ce';
                badge.style.borderColor = '#d8b4fe';
            } else if (isReviewer) {
                badge.style.background = '#eff6ff';
                badge.style.color = '#1d4ed8';
                badge.style.borderColor = '#bfdbfe';
            } else if (currentUserInfo.isAuthor) {
                badge.style.background = '#ecfdf5';
                badge.style.color = '#047857';
                badge.style.borderColor = '#a7f3d0';
            }
        }

        if (isEditor) {
            // Editors: full access to Pre-Screening and Reviewer Matchmaking
            if (tabPre) tabPre.style.display = 'flex';
            if (tabRec) tabRec.style.display = 'flex';
        } else if (isReviewer) {
            // Reviewers: only Document & Markups and AI Pre-Screening
            if (tabPre) tabPre.style.display = 'flex';
            if (tabRec) tabRec.style.display = 'none';

            var activeTab = document.querySelector('.sf-tab-btn.active');
            if (activeTab && activeTab.id === 'sfTabRecReviewers') {
                switchTab('viewer');
            }
        } else {
            // Authors and non-editorial: only Document & Markups
            if (tabPre) tabPre.style.display = 'none';
            if (tabRec) tabRec.style.display = 'none';

            var activeTab = document.querySelector('.sf-tab-btn.active');
            if (activeTab && activeTab.id !== 'sfTabViewer') {
                switchTab('viewer');
            }
        }
    }

    function ensureButton() {
        var btn = document.getElementById('sfTriggerBtn');
        var sid = getSubmissionId();
        if (sid && !currentSubmissionId && !window.__sfModalOpen) {
            currentSubmissionId = sid;
        }

        if (!btn) {
            createButton(sid || '1');
        } else {
            // Keep on top of any modal dialogs (such as PKP workflow modal)
            if (document.body && document.body.lastElementChild !== btn && btn.parentElement === document.body) {
                document.body.appendChild(btn);
            }
            btn.style.zIndex = '2147483647';
            if (sid) {
                var innerBtn = btn.querySelector('button[data-sid]') || btn;
                innerBtn.setAttribute('data-sid', sid);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
    } else {
        setTimeout(init, 300);
    }

    // ── Create the floating trigger button (universally draggable + persistent) ───
    function createButton(sid) {
        if (document.getElementById('sfTriggerBtn')) return;

        // Outer wrapper – fixed-positioned, draggable container
        var wrap = document.createElement('div');
        wrap.id = 'sfTriggerBtn';

        // Check if user previously saved a custom position in localStorage
        var savedPos = null;
        try {
            var raw = localStorage.getItem('sf_btn_pos');
            if (raw) savedPos = JSON.parse(raw);
        } catch (_) {}

        var initialStyle = [
            'position:fixed !important',
            'z-index:2147483647 !important',
            'display:flex !important', 'flex-direction:column !important', 'align-items:center !important', 'gap:4px !important',
            'user-select:none !important',
            'touch-action:none !important',
            'pointer-events:auto !important'
        ];

        if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
            var safeLeft = Math.max(10, Math.min(savedPos.left, window.innerWidth - 260));
            var safeTop  = Math.max(10, Math.min(savedPos.top,  window.innerHeight - 70));
            initialStyle.push('left:' + safeLeft + 'px', 'top:' + safeTop + 'px');
        } else {
            initialStyle.push('bottom:28px', 'right:28px');
        }

        wrap.style.cssText = initialStyle.join(';');

        // Drag-handle UI hint (subtle 6-dot grip pill)
        var handle = document.createElement('div');
        handle.style.cssText = [
            'display:flex', 'align-items:center', 'justify-content:center',
            'background:rgba(255,255,255,0.92)', 'border:1px solid rgba(99,102,241,0.3)',
            'border-radius:12px', 'padding:3px 14px',
            'cursor:grab', 'color:#6366f1',
            'box-shadow:0 2px 6px rgba(0,0,0,0.06)',
            'backdrop-filter:blur(6px)',
            'transition:background 0.15s ease, border-color 0.15s ease',
            'pointer-events:auto'
        ].join(';');
        handle.innerHTML = '<svg viewBox="0 0 16 8" style="width:16px;height:8px;fill:#6366f1;display:block;pointer-events:none">' +
            '<circle cx="2" cy="2" r="1.3"/><circle cx="8" cy="2" r="1.3"/><circle cx="14" cy="2" r="1.3"/>' +
            '<circle cx="2" cy="6" r="1.3"/><circle cx="8" cy="6" r="1.3"/><circle cx="14" cy="6" r="1.3"/>' +
            '</svg>';

        // Main action button
        var btn = document.createElement('button');
        btn.setAttribute('data-sid', sid || '1');
        btn.style.cssText = [
            'display:flex', 'align-items:center', 'gap:10px',
            'padding:13px 24px',
            'background:linear-gradient(135deg,#4f46e5,#3b82f6)',
            'color:#ffffff', 'border:none', 'border-radius:50px',
            'cursor:grab', 'pointer-events:auto',
            'font-family:Inter,Segoe UI,-apple-system,sans-serif',
            'font-size:14px', 'font-weight:600', 'letter-spacing:.3px',
            'white-space:nowrap',
            'box-shadow:0 10px 25px -3px rgba(79,70,229,.5),0 4px 6px -2px rgba(0,0,0,.05)',
            'transition:box-shadow .2s ease'
        ].join(';');
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:#ffffff;flex-shrink:0;pointer-events:none">' +
            '<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>' +
            '</svg>' +
            '<span style="pointer-events:none">ScholarFlow Document &amp; AI Assistant</span>';

        wrap.appendChild(handle);
        wrap.appendChild(btn);
        document.body.appendChild(wrap);

        // ── Drag & Click Management (works on entire wrap/button/handle) ───
        var isDragging = false;
        var hasMoved = false;
        var startX = 0, startY = 0;
        var startLeft = 0, startTop = 0;

        function onPointerDown(e) {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            e.stopPropagation();

            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;

            var rect = wrap.getBoundingClientRect();
            startLeft = rect.left;
            startTop  = rect.top;

            // Normalize positioning to top/left coordinates
            wrap.style.left   = startLeft + 'px';
            wrap.style.top    = startTop  + 'px';
            wrap.style.right  = 'auto';
            wrap.style.bottom = 'auto';
            wrap.style.zIndex = '2147483647';

            handle.style.cursor = 'grabbing';
            btn.style.cursor    = 'grabbing';
            document.body.style.userSelect = 'none';

            try {
                wrap.setPointerCapture(e.pointerId);
            } catch (_) {}
        }

        function onPointerMove(e) {
            if (!isDragging) return;
            e.stopPropagation();

            var dx = e.clientX - startX;
            var dy = e.clientY - startY;

            if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                hasMoved = true;
            }

            if (hasMoved) {
                var newLeft = startLeft + dx;
                var newTop  = startTop  + dy;

                var maxLeft = Math.max(10, window.innerWidth  - wrap.offsetWidth  - 10);
                var maxTop  = Math.max(10, window.innerHeight - wrap.offsetHeight - 10);

                newLeft = Math.max(10, Math.min(newLeft, maxLeft));
                newTop  = Math.max(10, Math.min(newTop,  maxTop));

                wrap.style.left = newLeft + 'px';
                wrap.style.top  = newTop  + 'px';
            }
        }

        function onPointerUp(e) {
            if (!isDragging) return;
            e.stopPropagation();
            isDragging = false;

            handle.style.cursor = 'grab';
            btn.style.cursor    = 'grab';
            document.body.style.userSelect = '';

            try {
                wrap.releasePointerCapture(e.pointerId);
            } catch (_) {}

            if (hasMoved) {
                // Dragged to a new location -> persist coordinates to localStorage
                try {
                    var rect = wrap.getBoundingClientRect();
                    localStorage.setItem('sf_btn_pos', JSON.stringify({
                        left: Math.round(rect.left),
                        top:  Math.round(rect.top)
                    }));
                } catch (_) {}
            } else {
                // Clicked without dragging -> Open ScholarFlow!
                window.__sfOpen(btn.getAttribute('data-sid'));
            }
        }

        wrap.addEventListener('pointerdown', onPointerDown);
        wrap.addEventListener('pointermove', onPointerMove);
        wrap.addEventListener('pointerup',   onPointerUp);
        wrap.addEventListener('pointercancel', function(e) {
            e.stopPropagation();
            isDragging = false;
            handle.style.cursor = 'grab';
            btn.style.cursor    = 'grab';
            document.body.style.userSelect = '';
        });
    }

    // ── Open modal ─────────────────────────────────────────────────────────
    function sfOpen(sid) {
        try {
            window.__sfModalOpen = true;
            var urlSid = getExplicitSubmissionIdFromUrl();
            var initialSid = sid || currentSubmissionId || urlSid || '1';
            currentSubmissionId = String(initialSid);

            if (!document.getElementById('sfOverlay')) {
                buildModal(initialSid);
            }

            var overlay = document.getElementById('sfOverlay');
            if (overlay) {
                // Always move overlay to the end of document.body so it sits above any opened PKP modals
                if (document.body && document.body.lastElementChild !== overlay) {
                    document.body.appendChild(overlay);
                }
                overlay.style.display = 'flex';
                overlay.style.zIndex = '2147483647';
                document.body.style.overflow = 'hidden';
            }

            // Hide the floating button while modal is open to avoid blocking document view
            var trigger = document.getElementById('sfTriggerBtn');
            if (trigger) trigger.style.display = 'none';

            fetchUserInfo();
            applyUserRoleGating();

            // Load document viewer immediately for active submission
            loadDocumentViewer(initialSid);

            fetchSubmissionsList(function(subs) {
                if (!subs || subs.length === 0) {
                    return;
                }

                // Check if requested sid exists in subs
                var targetId = sid || currentSubmissionId || initialSid;
                var found = null;
                if (targetId) {
                    for (var i = 0; i < subs.length; i++) {
                        if (String(subs[i].id) === String(targetId)) {
                            found = subs[i];
                            break;
                        }
                    }
                }

                var finalSid = found ? String(found.id) : String(subs[0].id);
                currentSubmissionId = finalSid;
                updateSubmissionSelect();
                if (finalSid !== initialSid) {
                    loadDocumentViewer(finalSid);
                }
            });
        } catch (err) {
            console.error('ScholarFlow sfOpen error:', err);
        }
    }

    function renderEmptyJournalState() {
        var docCanvas = document.getElementById('sfDocCanvas');
        var titleHeader = document.getElementById('sfDocTitleHeader');
        var prescreenContent = document.getElementById('sfPreScreenContent');
        var reviewersList = document.getElementById('sfReviewers');
        var assistContent = document.getElementById('sfAssistReport');

        if (titleHeader) titleHeader.textContent = 'No Submissions Found in this Journal';

        var emptyHtml = [
            '<div style="text-align:center;padding:50px 30px;max-width:540px;margin:40px auto;background:#ffffff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid #e2e8f0">',
            '  <div style="font-size:44px;margin-bottom:12px">📭</div>',
            '  <h3 style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:8px">No Submissions in this Journal Yet</h3>',
            '  <p style="font-size:13px;color:#64748b;line-height:1.6;margin-bottom:24px">',
            '    The database has been reset and is completely clean. To test the peer review and AI workflow, submit a new manuscript using the Author Submission Wizard.',
            '  </p>',
            '  <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap">',
            '    <a href="' + getContextBase() + '/submission/wizard" style="display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#4f46e5,#3b82f6);color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;box-shadow:0 2px 8px rgba(79,70,229,0.3)">',
            '      <span>➕</span> <span>Submit New Manuscript (Author Wizard)</span>',
            '    </a>',
            '  </div>',
            '</div>'
        ].join('\n');

        if (docCanvas) docCanvas.innerHTML = emptyHtml;
        if (prescreenContent) prescreenContent.innerHTML = emptyHtml;
        if (reviewersList) reviewersList.innerHTML = emptyHtml;
        if (assistContent) assistContent.innerHTML = emptyHtml;
    }

    // ── Close modal ────────────────────────────────────────────────────────
    function sfClose() {
        window.__sfModalOpen = false;
        var overlay = document.getElementById('sfOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        document.body.style.overflow = '';
        document.body.classList.remove('sf-resizing');
        var blocker = document.getElementById('sfResizeBlocker');
        if (blocker) blocker.remove();
        hideSelectionPopover();

        // Restore floating button
        var trigger = document.getElementById('sfTriggerBtn');
        if (trigger) trigger.style.display = 'flex';
    }

    // ── Toggle Fullscreen / Windowed Mode ──────────────────────────────────
    function toggleWindowMode() {
        var container = document.getElementById('sfModalContainer');
        var btn = document.getElementById('sfToggleSizeBtn');
        if (!container) return;

        isFullscreen = !isFullscreen;
        if (isFullscreen) {
            container.className = 'sf-modal-fullscreen';
            if (btn) btn.innerHTML = '🗗 Windowed';
        } else {
            container.className = 'sf-modal-windowed';
            if (btn) btn.innerHTML = '🗖 Fullscreen';
        }
    }

    var cachedSubmissionsList = [];

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getExplicitSubmissionIdFromUrl() {
        var href = window.location.href;
        var m = href.match(/\/reviewer\/(?:submission|step)\/(\d+)/) ||
                href.match(/[?&]workflowSubmissionId=(\d+)/) ||
                href.match(/[?&]submissionId=(\d+)/) ||
                href.match(/\/workflow\/index\/(\d+)/);
        return m ? m[1] : null;
    }

    function fetchSubmissionsList(callback) {
        var url = getContextBase() + '/scholarflow/submissionsList';
        fetch(url, { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data && data.success && data.submissions) {
                    cachedSubmissionsList = data.submissions;
                    updateSubmissionSelect();
                    renderPaperPickerCards(cachedSubmissionsList);
                    if (typeof callback === 'function') callback(cachedSubmissionsList);
                } else {
                    if (typeof callback === 'function') callback([]);
                }
            })
            .catch(function(err) {
                console.error('ScholarFlow submissionsList error:', err);
                if (typeof callback === 'function') callback([]);
            });
    }

    function updateSubmissionSelect() {
        var sel = document.getElementById('sfSubmissionSelect');
        if (!sel) return;
        sel.innerHTML = '';
        if (cachedSubmissionsList.length === 0) {
            var opt = document.createElement('option');
            opt.value = currentSubmissionId || '1';
            opt.textContent = 'Submission #' + (currentSubmissionId || '1');
            sel.appendChild(opt);
            return;
        }

        cachedSubmissionsList.forEach(function(sub) {
            var opt = document.createElement('option');
            opt.value = sub.id;
            var dispTitle = sub.title || 'Untitled Manuscript';
            if (dispTitle.length > 40) dispTitle = dispTitle.substring(0, 38) + '...';
            var jTag = sub.journalAcronym ? '[' + sub.journalAcronym + '] ' : '';
            opt.textContent = jTag + '#' + sub.id + ' — ' + dispTitle;
            if (String(sub.id) === String(currentSubmissionId)) {
                opt.selected = true;
            }
            sel.appendChild(opt);
        });
    }

    function renderPaperPickerCards(list) {
        var container = document.getElementById('sfPaperPickerList');
        if (!container) return;
        if (!list || list.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 10px;font-size:14px">No matching papers found.</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            var isCurrent = String(s.id) === String(currentSubmissionId);
            var statusBg = s.status === 'Published' ? '#dcfce7' : (s.status === 'Declined' ? '#fee2e2' : '#eff6ff');
            var statusCol = s.status === 'Published' ? '#15803d' : (s.status === 'Declined' ? '#b91c1c' : '#1d4ed8');
            var journalLabel = s.journalName || s.journalAcronym || '';

            html += '<div style="background:#ffffff;border:' + (isCurrent ? '2px solid #6366f1' : '1px solid #e2e8f0') + ';border-radius:12px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 2px 6px rgba(0,0,0,0.03);transition:all 0.15s' + (isCurrent ? ';background:#f5f3ff' : '') + '">';
            html += '  <div style="flex:1;min-width:0">';
            html += '    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">';
            if (journalLabel) {
                html += '    <span style="font-size:11px;font-weight:700;background:#f3e8ff;color:#7e22ce;padding:2px 8px;border-radius:6px;border:1px solid #d8b4fe">🏛️ ' + escapeHtml(journalLabel) + '</span>';
            }
            html += '      <span style="font-size:11px;font-weight:800;background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:6px">ID #' + s.id + '</span>';
            html += '      <span style="font-size:11px;font-weight:700;background:' + statusBg + ';color:' + statusCol + ';padding:2px 8px;border-radius:6px">' + s.status + '</span>';
            if (isCurrent) {
                html += '    <span style="font-size:11px;font-weight:800;background:#4f46e5;color:#fff;padding:2px 8px;border-radius:6px">Active Now</span>';
            }
            html += '    </div>';
            html += '    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(s.title) + '</div>';
            html += '    <div style="font-size:12px;color:#64748b;display:flex;gap:16px">';
            html += '      <span>👤 ' + escapeHtml(s.authors) + '</span>';
            if (s.dateSubmitted) {
                html += '  <span>📅 ' + s.dateSubmitted.substring(0, 10) + '</span>';
            }
            html += '    </div>';
            html += '  </div>';
            html += '  <button onclick="__sfSelectPaper(' + s.id + '); __sfClosePaperPickerModal();" style="background:' + (isCurrent ? '#4f46e5' : '#0f172a') + ';color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(0,0,0,0.1);transition:background 0.2s">';
            html += (isCurrent ? '✓ Currently Viewing' : 'Open Paper ➔');
            html += '  </button>';
            html += '</div>';
        }
        container.innerHTML = html;
    }

    function selectPaper(sid) {
        if (!sid) return;
        currentSubmissionId = String(sid);
        window.__sfActiveAssignSubmissionId = currentSubmissionId;
        updateSubmissionSelect();
        renderPaperPickerCards(cachedSubmissionsList);
        closePaperPickerModal();

        // Reset all panel reports so they are fresh for this submission
        var r = document.getElementById('sfReport');
        if (r) r.innerHTML = '';
        var rec = document.getElementById('sfReviewers');
        if (rec) rec.innerHTML = '';
        var reviewerBadge = document.getElementById('sfReviewerBadge');
        if (reviewerBadge) {
            reviewerBadge.textContent = 'AI MATCHING';
            reviewerBadge.style.background = '#eef2ff';
            reviewerBadge.style.color = '#4338ca';
            reviewerBadge.style.borderColor = '#c7d2fe';
        }
        var reviewerCacheTag = document.getElementById('sfReviewerCacheTag');
        if (reviewerCacheTag) reviewerCacheTag.style.display = 'none';
        if (window.__sfReviewerProgressTimer) {
            clearInterval(window.__sfReviewerProgressTimer);
            window.__sfReviewerProgressTimer = null;
        }

        // Reset tracking so switchTab re-evaluates for the newly selected paper
        lastEvaluatedSubmissions = {};
        window.__sfMatchmakingCache = {};

        // Immediate optimistic title update in header
        var titleHeader = document.getElementById('sfDocTitleHeader');
        if (titleHeader && cachedSubmissionsList) {
            var found = cachedSubmissionsList.find(function(s) { return String(s.id) === String(sid); });
            if (found && found.title) {
                var jTag = found.journalAcronym ? '[' + found.journalAcronym + '] ' : '';
                titleHeader.textContent = jTag + found.title;
            }
        }

        loadDocumentViewer(currentSubmissionId);

        var tabPre = document.getElementById('sfTabPreScreen');
        var tabRec = document.getElementById('sfTabRecReviewers');

        if (tabPre && tabPre.classList.contains('active')) {
            lastEvaluatedSubmissions['prescreen'] = currentSubmissionId;
            runAnalysis(currentSubmissionId, true);
        } else if (tabRec && tabRec.classList.contains('active')) {
            lastEvaluatedSubmissions['reviewers'] = currentSubmissionId;
            runReviewerRecommendations(currentSubmissionId, true);
        }
    }

    function openPaperPickerModal() {
        var modal = document.getElementById('sfPaperPickerModal');
        if (modal) {
            modal.style.display = 'flex';
            var searchInput = document.getElementById('sfPaperSearchInput');
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            renderPaperPickerCards(cachedSubmissionsList);
            fetchSubmissionsList(function(subs) {
                renderPaperPickerCards(subs);
            });
        }
    }

    function closePaperPickerModal() {
        var modal = document.getElementById('sfPaperPickerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function filterPaperPicker(query) {
        if (!query || !query.trim()) {
            renderPaperPickerCards(cachedSubmissionsList);
            return;
        }
        var q = query.toLowerCase().trim();
        var filtered = cachedSubmissionsList.filter(function(sub) {
            return (sub.title && sub.title.toLowerCase().indexOf(q) !== -1) ||
                   (sub.authors && sub.authors.toLowerCase().indexOf(q) !== -1) ||
                   (String(sub.id).indexOf(q) !== -1);
        });
        renderPaperPickerCards(filtered);
    }

    function setAndAnalyze() {
        var sel = document.getElementById('sfSubmissionSelect');
        if (sel && sel.value) {
            selectPaper(sel.value);
        }
    }

    // ── Toggle Comments Sidebar ──────────────────────────────────────────
    var sidebarVisible = true;
    var sidebarRatio = 32;
    try {
        var savedR = parseFloat(localStorage.getItem('sf_sidebar_ratio'));
        if (savedR >= 15 && savedR <= 70) sidebarRatio = savedR;
    } catch (e) {}

    function toggleCommentsSidebar() {
        var docCol = document.getElementById('sfDocCol');
        var commentsCol = document.getElementById('sfCommentsCol');
        var splitter = document.getElementById('sfSplitter');
        var btnText = document.getElementById('sfToggleSidebarBtnText');
        var btn = document.getElementById('sfToggleSidebarBtn');

        if (!docCol || !commentsCol) return;

        sidebarVisible = !sidebarVisible;

        if (!sidebarVisible) {
            commentsCol.style.display = 'none';
            if (splitter) splitter.style.display = 'none';
            docCol.style.flex = '1 1 100%';
            docCol.style.width = '100%';
            docCol.style.borderRight = 'none';
            if (btnText) btnText.textContent = 'Show Sidebar';
            if (btn) {
                btn.style.background = '#eef2ff';
                btn.style.borderColor = '#c7d2fe';
                btn.style.color = '#4f46e5';
            }
        } else {
            commentsCol.style.display = 'flex';
            if (splitter) splitter.style.display = 'flex';
            var leftP = 100 - sidebarRatio;
            docCol.style.flex = '0 0 ' + leftP + '%';
            docCol.style.width = leftP + '%';
            docCol.style.borderRight = '1px solid #e2e8f0';
            commentsCol.style.flex = '0 0 ' + sidebarRatio + '%';
            commentsCol.style.width = sidebarRatio + '%';
            if (btnText) btnText.textContent = 'Hide Sidebar';
            if (btn) {
                btn.style.background = '#f8fafc';
                btn.style.borderColor = '#cbd5e1';
                btn.style.color = '#334155';
            }
        }
    }

    // ── Splitter Resizer for Document & Comments Panes ─────────────────────
    function initSplitterResize() {
        var splitter = document.getElementById('sfSplitter');
        var panelViewer = document.getElementById('sfPanelViewer');
        var docCol = document.getElementById('sfDocCol');
        var commentsCol = document.getElementById('sfCommentsCol');

        if (!splitter || !panelViewer || !docCol || !commentsCol) return;

        // Apply initial ratio
        if (sidebarVisible) {
            var leftP = 100 - sidebarRatio;
            docCol.style.flex = '0 0 ' + leftP + '%';
            docCol.style.width = leftP + '%';
            commentsCol.style.flex = '0 0 ' + sidebarRatio + '%';
            commentsCol.style.width = sidebarRatio + '%';
        }

        var isDragging = false;
        var activePointerId = null;

        function updateResize(clientX) {
            var rect = panelViewer.getBoundingClientRect();
            var totalW = rect.width;
            if (totalW <= 0) return;

            var mouseX = clientX - rect.left;
            var minDoc = 280;
            var minComments = 220;
            var maxDoc = totalW - minComments;

            var clampedX = Math.max(minDoc, Math.min(mouseX, maxDoc));
            var leftPercent = (clampedX / totalW) * 100;
            var rightPercent = 100 - leftPercent;

            sidebarRatio = Math.round(rightPercent * 10) / 10;
            docCol.style.flex = '0 0 ' + leftPercent + '%';
            docCol.style.width = leftPercent + '%';
            commentsCol.style.flex = '0 0 ' + rightPercent + '%';
            commentsCol.style.width = rightPercent + '%';
        }

        function stopSplitterDrag(ev) {
            if (!isDragging) return;
            isDragging = false;
            splitter.classList.remove('sf-resizing-active');
            document.body.classList.remove('sf-resizing');

            var blocker = document.getElementById('sfResizeBlocker');
            if (blocker) {
                try {
                    blocker.removeEventListener('pointerup', stopSplitterDrag, true);
                    blocker.removeEventListener('mouseup', stopSplitterDrag, true);
                } catch (e) {}
                blocker.remove();
            }

            if (activePointerId !== null && splitter.releasePointerCapture) {
                try {
                    splitter.releasePointerCapture(activePointerId);
                } catch (e) {}
            }
            activePointerId = null;

            try {
                localStorage.setItem('sf_sidebar_ratio', sidebarRatio);
            } catch (err) {}

            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('pointerup', stopSplitterDrag, true);
            window.removeEventListener('pointercancel', stopSplitterDrag, true);
            window.removeEventListener('mousemove', onMouseMove, true);
            window.removeEventListener('mouseup', stopSplitterDrag, true);
            window.removeEventListener('blur', stopSplitterDrag, true);
            document.removeEventListener('mouseleave', stopSplitterDrag, true);
        }

        function onPointerMove(ev) {
            if (!isDragging) return;
            if (ev.buttons === 0) {
                // Failsafe: if no mouse buttons are pressed, immediately stop dragging
                stopSplitterDrag(ev);
                return;
            }
            if (ev.cancelable) ev.preventDefault();
            updateResize(ev.clientX);
        }

        function onMouseMove(ev) {
            if (!isDragging) return;
            if (ev.buttons === 0) {
                // Failsafe: if no mouse buttons are pressed, immediately stop dragging
                stopSplitterDrag(ev);
                return;
            }
            updateResize(ev.clientX);
        }

        function startSplitterDrag(ev) {
            // Only primary mouse button or touch/pen
            if (ev.button !== undefined && ev.button !== 0) return;
            if (isDragging) return;
            if (ev.cancelable) ev.preventDefault();

            isDragging = true;
            activePointerId = ev.pointerId !== undefined ? ev.pointerId : null;

            splitter.classList.add('sf-resizing-active');
            document.body.classList.add('sf-resizing');

            // Add full viewport transparent overlay so iframes/canvases cannot swallow pointer/mouse release
            var blocker = document.getElementById('sfResizeBlocker');
            if (!blocker) {
                blocker = document.createElement('div');
                blocker.id = 'sfResizeBlocker';
                blocker.style.cssText = 'position:fixed !important;inset:0 !important;z-index:2147483647 !important;cursor:col-resize !important;background:transparent !important;user-select:none !important;';
                blocker.addEventListener('pointerup', stopSplitterDrag, true);
                blocker.addEventListener('mouseup', stopSplitterDrag, true);
                document.body.appendChild(blocker);
            }

            if (activePointerId !== null && splitter.setPointerCapture) {
                try {
                    splitter.setPointerCapture(activePointerId);
                } catch (e) {}
            }

            window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
            window.addEventListener('pointerup', stopSplitterDrag, { capture: true });
            window.addEventListener('pointercancel', stopSplitterDrag, { capture: true });
            window.addEventListener('mousemove', onMouseMove, { capture: true });
            window.addEventListener('mouseup', stopSplitterDrag, { capture: true });
            window.addEventListener('blur', stopSplitterDrag, { capture: true });
            document.addEventListener('mouseleave', stopSplitterDrag, { capture: true });
        }

        if (window.PointerEvent) {
            splitter.addEventListener('pointerdown', startSplitterDrag);
            splitter.addEventListener('lostpointercapture', stopSplitterDrag);
        } else {
            splitter.addEventListener('mousedown', startSplitterDrag);
        }
        splitter.addEventListener('pointerup', stopSplitterDrag, { capture: true });
        splitter.addEventListener('mouseup', stopSplitterDrag, { capture: true });
    }

    // ── Build the modal DOM (Modern Light Aesthetic, Full Screen) ──────────
    function buildModal(sid) {
        var wrap = document.createElement('div');
        wrap.id = 'sfOverlay';
        wrap.style.cssText = [
            'display:none', 'position:fixed !important', 'inset:0 !important',
            'z-index:2147483647 !important',
            'background:rgba(15,23,42,.65) !important',
            'backdrop-filter:blur(8px) !important',
            '-webkit-backdrop-filter:blur(8px) !important',
            'align-items:center !important', 'justify-content:center !important',
            'box-sizing:border-box !important',
            'font-family:Inter,Segoe UI,-apple-system,sans-serif !important',
            'pointer-events:auto !important'
        ].join(';');

        wrap.innerHTML = [
            /* Modal container: Covers 100% full screen by default */
            '<div id="sfModalContainer" class="sf-modal-fullscreen" style="background:#f8fafc;',
            'display:flex;flex-direction:column;overflow:hidden;position:relative;',
            'box-shadow:0 25px 60px -15px rgba(0,0,0,.3);z-index:2147483647;pointer-events:auto">',

            /* ── Paper Picker Modal Overlay (Displays all papers with title, author, status) ── */
            '<div id="sfPaperPickerModal" style="display:none;position:absolute;inset:0;z-index:2147483645;background:rgba(15,23,42,0.7);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:24px;box-sizing:border-box">',
              '<div style="background:#ffffff;border-radius:16px;width:100%;max-width:760px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 25px 60px rgba(0,0,0,0.35);border:1px solid #e2e8f0;overflow:hidden">',
                '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid rgba(255,255,255,0.12);background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff">',
                  '<div>',
                    '<div style="font-size:17px;font-weight:800;display:flex;align-items:center;gap:8px">📚 Select Manuscript to Review</div>',
                    '<div style="font-size:12px;color:#c7d2fe;margin-top:2px">Browse all submissions in this journal and pick a paper to evaluate</div>',
                  '</div>',
                  '<button onclick="__sfClosePaperPickerModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;width:32px;height:32px;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s" onmouseenter="this.style.background=\'rgba(255,255,255,0.25)\'" onmouseleave="this.style.background=\'rgba(255,255,255,0.15)\'">&times;</button>',
                '</div>',
                '<div style="padding:14px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0">',
                  '<input type="text" id="sfPaperSearchInput" placeholder="🔍 Search by paper title, author name, or ID..." oninput="__sfFilterPaperPicker(this.value)" style="width:100%;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:9px 14px;font-size:13px;box-sizing:border-box;outline:none;font-family:inherit" />',
                '</div>',
                '<div id="sfPaperPickerList" style="flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:12px;background:#f8fafc">',
                  '<div style="text-align:center;color:#94a3b8;padding:40px 10px;font-size:14px">Loading journal submissions...</div>',
                '</div>',
              '</div>',
            '</div>',

            /* ── Re-Run Analysis Confirmation Modal ── */
            '<div id="sfReRunConfirmModal" style="display:none;position:absolute;inset:0;z-index:2147483645;background:rgba(15,23,42,0.75);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:24px;box-sizing:border-box">',
              '<div style="background:#ffffff;border-radius:16px;width:100%;max-width:540px;box-shadow:0 25px 60px rgba(0,0,0,0.35);border:1px solid #e2e8f0;overflow:hidden;display:flex;flex-direction:column">',
                '<div style="padding:18px 24px;background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;display:flex;align-items:center;justify-content:space-between">',
                  '<div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px">🔄 Re-Run AI Manuscript Analysis</div>',
                  '<button onclick="__sfCloseReRunModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:6px;width:28px;height:28px;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">&times;</button>',
                '</div>',
                '<div style="padding:22px 24px;background:#ffffff">',
                  '<div style="display:flex;gap:12px;margin-bottom:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px">',
                    '<div style="font-size:22px;line-height:1">⏳</div>',
                    '<div style="font-size:13px;color:#92400e;line-height:1.5">',
                      '<strong>Notice:</strong> Querying the local AI model (qwen2.5) to perform fresh deep pre-screening will take <strong>15 to 30 seconds</strong>. Would you like to proceed?',
                    '</div>',
                  '</div>',
                  '<div id="sfReRunScopeSection" style="margin-bottom:18px"></div>',
                  '<div style="display:flex;justify-content:flex-end;gap:10px">',
                    '<button onclick="__sfCloseReRunModal()" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer">Cancel</button>',
                    '<button onclick="__sfConfirmReRunAnalysis()" style="background:#4f46e5;border:none;color:#ffffff;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(79,70,229,0.3)">Proceed with Re-Run</button>',
                  '</div>',
                '</div>',
              '</div>',
            '</div>',

            /* ── Send Comments to Author Modal ── */
            '<div id="sfSendToAuthorModal" style="display:none;position:absolute;inset:0;z-index:2147483645;background:rgba(15,23,42,0.75);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:24px;box-sizing:border-box">',
              '<div style="background:#ffffff;border-radius:16px;width:100%;max-width:720px;max-height:85vh;box-shadow:0 25px 60px rgba(0,0,0,0.35);border:1px solid #e2e8f0;overflow:hidden;display:flex;flex-direction:column">',
                '<div style="padding:18px 24px;background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;display:flex;align-items:center;justify-content:space-between">',
                  '<div>',
                    '<div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px">✉️ Send Comments to Author Separately</div>',
                    '<div style="font-size:12px;color:#c7d2fe;margin-top:2px">Compile and send curated feedback for a specific reviewer or editor to the author</div>',
                  '</div>',
                  '<button onclick="__sfCloseSendToAuthorModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:6px;width:28px;height:28px;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">&times;</button>',
                '</div>',
                '<div style="padding:16px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">',
                  '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:240px">',
                    '<label style="font-size:12px;font-weight:700;color:#334155;white-space:nowrap">Select Source:</label>',
                    '<select id="sfSendAuthorSourceSelect" onchange="__sfUpdateSendAuthorLetter()" style="flex:1;font-size:12px;font-weight:600;padding:6px 10px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;color:#0f172a"></select>',
                  '</div>',
                  '<label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#475569;cursor:pointer">',
                    '<input type="checkbox" id="sfSendAuthorAnonymize" checked onchange="__sfUpdateSendAuthorLetter()" />',
                    '<span>Anonymize Reviewer (e.g. "Reviewer 1")</span>',
                  '</label>',
                '</div>',
                '<div style="flex:1;overflow-y:auto;padding:18px 24px;display:flex;flex-direction:column;gap:12px;background:#ffffff">',
                  '<div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Generated Decision &amp; Feedback Letter for Author:</div>',
                  '<textarea id="sfSendAuthorLetterText" style="width:100%;height:220px;border:1px solid #cbd5e1;border-radius:8px;padding:12px;font-family:monospace,Consolas,sans-serif;font-size:12px;line-height:1.6;color:#1e293b;background:#f8fafc;box-sizing:border-box;resize:vertical"></textarea>',
                  '<div id="sfSendAuthorFeedbackStatus" style="font-size:12px;color:#059669;font-weight:600;display:none">✅ Copied to clipboard! Ready to paste into OJS editorial email.</div>',
                '</div>',
                '<div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">',
                  '<button onclick="__sfDownloadAuthorLetter()" style="background:#ffffff;border:1px solid #cbd5e1;color:#334155;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px">📥 Download Letter (.txt)</button>',
                  '<div style="display:flex;gap:8px">',
                    '<button onclick="__sfCloseSendToAuthorModal()" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">Close</button>',
                    '<button onclick="__sfCopyAuthorLetter()" style="background:#4f46e5;border:none;color:#ffffff;border-radius:6px;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(79,70,229,0.3)">📋 Copy Letter to Clipboard</button>',
                  '</div>',
                '</div>',
              '</div>',
            '</div>',

            /* ── Release Reviewer / Quota Reached Modal ── */
            '<div id="sfReleaseReviewerModal" style="display:none;position:absolute;inset:0;z-index:2147483645;background:rgba(15,23,42,0.75);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:24px;box-sizing:border-box">',
              '<div style="background:#ffffff;border-radius:16px;width:100%;max-width:620px;box-shadow:0 25px 60px rgba(0,0,0,0.35);border:1px solid #e2e8f0;overflow:hidden;display:flex;flex-direction:column">',
                '<div style="padding:18px 24px;background:linear-gradient(135deg,#7f1d1d,#991b1b);color:#fff;display:flex;align-items:center;justify-content:space-between">',
                  '<div>',
                    '<div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px">⛔ Release Reviewer: Quota Reached</div>',
                    '<div id="sfReleaseReviewerSub" style="font-size:12px;color:#fecaca;margin-top:2px">Notify reviewer that review is no longer required</div>',
                  '</div>',
                  '<button onclick="__sfCloseReleaseReviewerModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:6px;width:28px;height:28px;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">&times;</button>',
                '</div>',
                '<div style="padding:20px 24px;background:#ffffff;display:flex;flex-direction:column;gap:14px">',
                  '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;color:#991b1b;font-size:12px;line-height:1.5">',
                    'Multiple reviewers were assigned, and the journal has obtained the required number of evaluations. Use this template to inform the reviewer courteously that their review is not needed.',
                  '</div>',
                  '<div style="font-size:12px;font-weight:700;color:#475569">Notification Message Template:</div>',
                  '<textarea id="sfReleaseReviewerLetter" style="width:100%;height:160px;border:1px solid #cbd5e1;border-radius:8px;padding:12px;font-size:12px;font-family:inherit;line-height:1.6;color:#1e293b;background:#f8fafc;box-sizing:border-box;resize:vertical"></textarea>',
                  '<div id="sfReleaseStatusMsg" style="font-size:12px;color:#059669;font-weight:700;display:none">✅ Notification copied and reviewer status marked as Released!</div>',
                  '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">',
                    '<button onclick="__sfCloseReleaseReviewerModal()" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">Cancel</button>',
                    '<div style="display:flex;gap:8px">',
                      '<button onclick="__sfCopyReleaseLetter()" style="background:#ffffff;border:1px solid #cbd5e1;color:#334155;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer">📋 Copy Email</button>',
                      '<button onclick="__sfConfirmReleaseReviewer()" style="background:#dc2626;border:none;color:#ffffff;border-radius:6px;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(220,38,38,0.3)">Mark Released &amp; Notify</button>',
                    '</div>',
                  '</div>',
                '</div>',
              '</div>',
            '</div>',

            /* ── Header Bar: Deep Modern Indigo Gradient ── */
            '<div style="display:flex;align-items:center;justify-content:space-between;',
            'padding:12px 24px;border-bottom:1px solid rgba(255,255,255,.12);',
            'background:linear-gradient(135deg,#1e1b4b,#312e81,#4338ca);color:#fff;flex-shrink:0">',
              '<div style="display:flex;align-items:center;gap:14px">',
                '<div style="width:38px;height:38px;border-radius:10px;',
                'background:linear-gradient(135deg,#6366f1,#3b82f6);',
                'display:flex;align-items:center;justify-content:center;',
                'font-size:16px;font-weight:800;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.25)">SF</div>',
                '<div>',
                  '<div style="font-size:16px;font-weight:700;color:#fff;display:flex;align-items:center;gap:10px">',
                    '<span>ScholarFlow Platform</span>',
                    '<span id="sfUserRoleBadge" style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe">User</span>',
                  '</div>',
                  '<div id="sfDocTitleHeader" style="font-size:12px;color:#cbd5e1;max-width:700px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">In-Platform Manuscript Reader & Inline Peer Review</div>',
                '</div>',
              '</div>',
              '<div style="display:flex;align-items:center;gap:10px">',
                '<div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.14);padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.25)">',
                  '<span style="font-size:12px;color:#e0e7ff;font-weight:600;display:flex;align-items:center;gap:4px">📄 Paper:</span>',
                  '<select id="sfSubmissionSelect" onchange="__sfSelectPaper(this.value)" style="background:#ffffff;border:1px solid #cbd5e1;color:#0f172a;border-radius:6px;padding:4px 8px;font-size:12px;font-weight:600;max-width:280px;cursor:pointer;outline:none;text-overflow:ellipsis">',
                    '<option value="' + (sid || '1') + '">Loading papers...</option>',
                  '</select>',
                  '<button onclick="__sfOpenPaperPickerModal()" title="Browse all papers in journal" style="background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;box-shadow:0 1px 3px rgba(0,0,0,0.2);transition:background 0.2s">📚 Browse</button>',
                '</div>',
                '<button id="sfToggleSizeBtn" onclick="__sfToggleMode()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:6px 12px;cursor:pointer;color:#ffffff;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px">🗗 Windowed</button>',
                '<button onclick="__sfClose()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);',
                'border-radius:8px;width:34px;height:34px;cursor:pointer;color:#ffffff;',
                'font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center;transition:background 0.2s">',
                '&times;</button>',
              '</div>',
            '</div>',

            /* ── Tabs Navigation Bar (Modern Light Clean Aesthetic) ── */
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid #e2e8f0;background:#ffffff;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.03)">',
              '<div class="sf-tabs-container" style="display:flex;gap:4px;padding:4px 0 0 0;">',
                '<button id="sfTabViewer" class="sf-tab-btn active" onclick="event.stopPropagation(); __sfSwitchTab(\'viewer\');" style="background:none;border:none;border-bottom:3px solid #4f46e5;color:#4f46e5;font-weight:700;padding:12px 18px;cursor:pointer;font-size:14px;font-family:inherit;transition:all 0.2s;display:flex;align-items:center;gap:6px">📖 Document &amp; Markups</button>',
                '<button id="sfTabPreScreen" class="sf-tab-btn" onclick="event.stopPropagation(); __sfSwitchTab(\'prescreen\');" style="background:none;border:none;border-bottom:3px solid transparent;color:#64748b;font-weight:600;padding:12px 18px;cursor:pointer;font-size:14px;font-family:inherit;transition:all 0.2s;display:flex;align-items:center;gap:6px">🤖 AI Pre-Screening</button>',
                '<button id="sfTabRecReviewers" class="sf-tab-btn" onclick="event.stopPropagation(); __sfSwitchTab(\'reviewers\');" style="background:none;border:none;border-bottom:3px solid transparent;color:#64748b;font-weight:600;padding:12px 18px;cursor:pointer;font-size:14px;font-family:inherit;transition:all 0.2s;display:none;align-items:center;gap:6px">👥 Reviewer Matchmaking</button>',
              '</div>',
              '<div>',
                '<button onclick="__sfExportMarkups()" style="display:flex;align-items:center;gap:6px;background:#f5f3ff;border:1px solid #ddd6fe;color:#6d28d9;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.04);transition:all 0.2s">📥 Download Markup Report</button>',
              '</div>',
            '</div>',

            /* ── Main Body Workspace ── */
            '<div style="display:flex;flex:1;overflow:hidden;position:relative;background:#f1f5f9">',

              /* PANEL 1: Document Viewer + Inline Markups */
              '<div id="sfPanelViewer" style="display:flex;flex:1;overflow:hidden;width:100%;position:relative">',
                /* Left Canvas: Academic Paper Document Reader */
                '<div id="sfDocCol" style="flex:0 0 68%;width:68%;display:flex;flex-direction:column;padding:20px 24px;overflow:hidden;border-right:1px solid #e2e8f0;box-sizing:border-box;min-width:320px">',
                  '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;background:#ffffff;padding:8px 16px;border-radius:8px;border:1px solid #e2e8f0;flex-shrink:0">',
                    '<div style="font-size:12px;color:#475569;font-weight:600;display:flex;align-items:center;gap:6px">',
                      '<span style="color:#eab308">💡</span> Select any sentence to leave a review markup &bull; Click sidebar comments to auto-scroll and highlight',
                    '</div>',
                    '<div style="display:flex;align-items:center;gap:8px">',
                      '<div id="sfDocInfoTag" style="font-size:11px;font-weight:700;color:#4f46e5;background:#eef2ff;padding:3px 10px;border-radius:6px;border:1px solid #c7d2fe">DOCX / HTML View</div>',
                      '<button id="sfToggleSidebarBtn" onclick="__sfToggleCommentsSidebar()" title="Show or hide the comments sidebar" style="display:flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #cbd5e1;color:#334155;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s">',
                        '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>',
                        '<span id="sfToggleSidebarBtnText">Hide Sidebar</span>',
                      '</button>',
                    '</div>',
                  '</div>',
                  '<div id="sfDocCanvas" class="sf-doc-reader" style="flex:1"></div>',
                '</div>',

                /* Resizer Splitter between Left & Right */
                '<div id="sfSplitter" class="sf-splitter" title="Drag to adjust width of document reader and comments sidebar">',
                  '<div class="sf-splitter-bar"></div>',
                '</div>',

                /* Right Column: Markups & Comments Sidebar */
                '<div id="sfCommentsCol" style="flex:0 0 32%;width:32%;display:flex;flex-direction:column;background:#ffffff;overflow:hidden;padding:16px 18px;border-left:1px solid #e2e8f0;box-sizing:border-box;min-width:260px">',
                  '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;flex-shrink:0">',
                    '<div style="font-size:15px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:8px">',
                      '<span>Inline Markups</span>',
                      '<span id="sfCommentsCountBadge" style="font-size:11px;font-weight:800;background:#4f46e5;color:#ffffff;padding:2px 8px;border-radius:12px">0</span>',
                    '</div>',
                    '<div style="display:flex;align-items:center;gap:6px">',
                      '<button id="sfSendToAuthorBtn" onclick="__sfOpenSendToAuthorModal()" title="Send reviewer comments separately to author" style="display:none;align-items:center;gap:4px;background:#eef2ff;border:1px solid #c7d2fe;color:#4338ca;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.15s">✉️ Send to Author</button>',
                      '<button onclick="__sfToggleCommentsSidebar()" title="Hide comments sidebar" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;font-size:13px;font-weight:700;transition:all 0.15s" onmouseenter="this.style.background=\'#e2e8f0\';this.style.color=\'#0f172a\'" onmouseleave="this.style.background=\'#f1f5f9\';this.style.color=\'#64748b\'">✕</button>',
                    '</div>',
                  '</div>',

                  /* Segmented Filter Control: Editor Comments / Reviewer to Editor (Read Only) / Reviewer Comments */
                  '<div id="sfCommentTabsWrap" style="display:flex;align-items:center;gap:3px;background:#f1f5f9;padding:3px;border-radius:8px;margin-bottom:8px;flex-shrink:0">',
                    '<button id="sfCommentTab-editor" onclick="__sfFilterCommentsTab(\'editor\')" class="sf-comment-filter-btn" style="flex:1;background:#ffffff;border:none;border-radius:6px;padding:5px 3px;font-size:11px;font-weight:700;color:#4f46e5;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.06);transition:all 0.15s" title="Comments made by the Editor">🟣 Editor (<span id="sfCountEditor">0</span>)</button>',
                    '<button id="sfCommentTab-reviewer_to_editor" onclick="__sfFilterCommentsTab(\'reviewer_to_editor\')" class="sf-comment-filter-btn" style="flex:1.2;background:none;border:none;border-radius:6px;padding:5px 3px;font-size:11px;font-weight:600;color:#64748b;cursor:pointer;transition:all 0.15s" title="Confidential comments made by reviewers to the editor in read-only mode"><span id="sfRevToEdLabel">🔒 To Editor</span> (<span id="sfCountReviewerToEditor">0</span>)</button>',
                    '<button id="sfCommentTab-reviewer" onclick="__sfFilterCommentsTab(\'reviewer\')" class="sf-comment-filter-btn" style="flex:1;background:none;border:none;border-radius:6px;padding:5px 3px;font-size:11px;font-weight:600;color:#64748b;cursor:pointer;transition:all 0.15s" title="Standard comments made by Reviewers">🔵 Reviewers (<span id="sfCountReviewer">0</span>)</button>',
                  '</div>',

                  /* Sub-filter dropdown for individual reviewers */
                  '<div id="sfReviewerSubFilterWrap" style="display:none;margin-bottom:8px;flex-shrink:0">',
                    '<select id="sfReviewerSubFilter" onchange="__sfOnReviewerSubFilterChange()" style="width:100%;font-size:11px;padding:5px 8px;border-radius:6px;border:1px solid #cbd5e1;background:#ffffff;color:#334155;font-weight:600">',
                      '<option value="">All Reviewers</option>',
                    '</select>',
                  '</div>',

                  '<div id="sfCommentsList" style="flex:1;overflow-y:auto;padding-right:4px">',
                    '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:40px 10px">No inline comments yet.<br>Highlight text on the left to add markups.</div>',
                  '</div>',
                '</div>',
              '</div>',

              /* PANEL 2: AI Pre-Screening Analysis */
              '<div id="sfPanelPreScreen" style="display:none;flex:1;overflow-y:auto;padding:28px 36px;background:#f8fafc">',
                '<div style="max-width:960px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:32px 36px;box-shadow:0 4px 20px rgba(0,0,0,.04)">',
                  '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;background:#f8fafc;padding:16px 20px;border-radius:12px;border:1px solid #e2e8f0">',
                    '<div>',
                      '<div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.5px">Editorial Recommendation</div>',
                      '<span id="sfBadge" style="display:inline-block;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:800;background:#f1f5f9;color:#475569;margin-top:4px">PENDING</span>',
                      '<span id="sfCacheTag" style="display:none;font-size:11px;margin-left:8px;color:#059669;font-weight:600;background:#dcfce7;padding:3px 8px;border-radius:6px">⚡ Cached (Instant)</span>',
                    '</div>',
                    '<button onclick="__sfReRunAnalysis()" style="background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(79,70,229,.3);transition:background .2s">🔄 Re-Run Full Analysis</button>',
                  '</div>',
                  '<div id="sfReport" style="color:#334155;font-size:15px;line-height:1.85"></div>',
                '</div>',
              '</div>',

              /* PANEL 3: Reviewer Matchmaking */
              '<div id="sfPanelReviewers" style="display:none;flex:1;overflow-y:auto;padding:28px 36px;background:#f8fafc">',
                '<div style="max-width:960px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:32px 36px;box-shadow:0 4px 20px rgba(0,0,0,.04)">',
                  '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;gap:12px">',
                    '<div style="display:flex;align-items:center;gap:12px">',
                      '<h2 style="margin:0;font-size:20px;font-weight:800;color:#0f172a">AI-Ranked Reviewer Matchmaking</h2>',
                      '<span id="sfReviewerBadge" style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:0.5px;padding:4px 10px;border-radius:20px;border:1px solid #c7d2fe;background:#eef2ff;color:#4338ca">AI MATCHING</span>',
                      '<span id="sfReviewerCacheTag" style="display:none;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px"></span>',
                    '</div>',
                    '<button onclick="window.__sfReRunReviewers()" style="background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(79,70,229,.3);transition:background .2s">🔄 Re-Match Reviewers</button>',
                  '</div>',
                  '<div id="sfReviewers" style="color:#334155;font-size:14px;line-height:1.8"></div>',
                '</div>',
              '</div>',



            '</div></div>',

            /* Selection Popover for Highlighting */
            '<div id="sfSelectionPopover">',
              '<div style="font-size:12px;font-weight:700;color:#0f172a;display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">',
                '<span>Highlight &amp; Add Review Comment</span>',
                '<div style="display:flex;gap:6px">',
                  '<span id="sfColorDot-yellow" onclick="window.__sfSetColor(\'yellow\')" style="width:16px;height:16px;border-radius:50%;background:#eab308;cursor:pointer;display:inline-block;border:2px solid #1e1b4b;transition:all 0.15s" title="Yellow"></span>',
                  '<span id="sfColorDot-green" onclick="window.__sfSetColor(\'green\')" style="width:16px;height:16px;border-radius:50%;background:#22c55e;cursor:pointer;display:inline-block;border:2px solid transparent;transition:all 0.15s" title="Green"></span>',
                  '<span id="sfColorDot-blue" onclick="window.__sfSetColor(\'blue\')" style="width:16px;height:16px;border-radius:50%;background:#3b82f6;cursor:pointer;display:inline-block;border:2px solid transparent;transition:all 0.15s" title="Blue"></span>',
                  '<span id="sfColorDot-pink" onclick="window.__sfSetColor(\'pink\')" style="width:16px;height:16px;border-radius:50%;background:#ec4899;cursor:pointer;display:inline-block;border:2px solid transparent;transition:all 0.15s" title="Pink"></span>',
                '</div>',
              '</div>',
              /* Selected text preview strip */
              '<div id="sfSelectionPreview" style="background:#f1f5f9;border-left:3px solid #4f46e5;border-radius:4px;padding:5px 8px;margin-bottom:7px;font-size:11px;color:#475569;font-style:italic;max-height:40px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"></div>',
              '<textarea id="sfCommentInput" placeholder="Write feedback, question, or revision note..." style="width:100%;height:65px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;color:#0f172a;padding:8px;font-size:12px;box-sizing:border-box;resize:none;font-family:inherit"></textarea>',
              '<div id="sfConfidentialOptionWrap" style="margin-top:6px;margin-bottom:6px;display:flex;align-items:center;gap:6px;background:#fef3c7;border:1px solid #fde68a;padding:6px 9px;border-radius:6px">',
                '<input type="checkbox" id="sfConfidentialCheckbox" style="cursor:pointer;accent-color:#d97706;width:15px;height:15px;margin:0">',
                '<label for="sfConfidentialCheckbox" style="font-size:11px;font-weight:700;color:#92400e;cursor:pointer;user-select:none;display:flex;align-items:center;gap:4px">',
                  '<span>🔒 Note for Editor only</span>',
                  '<span style="font-weight:400;font-size:10px;color:#b45309">(Confidential: strictly hidden from author &amp; other reviewers)</span>',
                '</label>',
              '</div>',
              '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">',
                '<button onclick="window.__sfCancelPopover()" style="background:none;border:none;color:#64748b;font-size:12px;font-weight:600;cursor:pointer;padding:4px 8px">Cancel</button>',
                '<button onclick="__sfSaveAnnotation()" style="background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">Save Markup</button>',
              '</div>',
            '</div>',

            /* Embedded Core CSS to guarantee styles apply instantly */
            '<style>',
            '@keyframes sfSpin{to{transform:rotate(360deg)}}',
            '.sf-highlight{padding:2px 4px!important;border-radius:4px!important;cursor:pointer!important;position:relative!important;transition:all 0.2s ease!important;box-decoration-break:clone!important;-webkit-box-decoration-break:clone!important;font-weight:600!important;display:inline!important}',
            '.sf-hl-yellow{background:#fef08a!important;border-bottom:2px solid #eab308!important;color:#713f12!important}',
            '.sf-hl-green{background:#bbf7d0!important;border-bottom:2px solid #22c55e!important;color:#14532d!important}',
            '.sf-hl-blue{background:#bfdbfe!important;border-bottom:2px solid #3b82f6!important;color:#1e3a5f!important}',
            '.sf-hl-pink{background:#fbcfe8!important;border-bottom:2px solid #ec4899!important;color:#831843!important}',
            '.sf-highlight:hover{filter:brightness(0.95)!important;box-shadow:0 0 10px rgba(99,102,241,0.4)!important}',
            '@keyframes sfGlowPulseLight{0%{background-color:#facc15!important;color:#000000!important;box-shadow:0 0 0 4px rgba(250,204,21,0.85),0 0 24px rgba(250,204,21,0.9)!important;outline:2px solid #ca8a04!important}50%{background-color:#fde047!important;color:#000000!important;box-shadow:0 0 0 6px rgba(253,224,71,0.9),0 0 32px rgba(253,224,71,1)!important;outline:2px solid #eab308!important}100%{background-color:#facc15!important;color:#000000!important;box-shadow:0 0 0 4px rgba(250,204,21,0.85),0 0 24px rgba(250,204,21,0.9)!important;outline:2px solid #ca8a04!important}}',
            '.sf-active-comment-mark{animation:sfGlowPulseLight 1.2s ease-in-out infinite alternate!important;background-color:#facc15!important;color:#000000!important;border-radius:4px!important;font-weight:700!important;z-index:100!important;position:relative!important;display:inline!important;box-shadow:0 0 0 4px rgba(250,204,21,0.85),0 0 24px rgba(250,204,21,0.9)!important}',
            '.sf-paragraph-active{display:block!important;border-left:5px solid #eab308!important;background:rgba(254,240,138,0.3)!important;padding-left:16px!important;border-radius:6px!important;transition:all 0.3s ease!important}',
            '.sf-focus-callout{position:absolute!important;z-index:2147483640!important;background:linear-gradient(135deg,#1e1b4b,#312e81)!important;color:#ffffff!important;border:1px solid #818cf8!important;border-radius:8px!important;padding:7px 14px!important;font-size:12px!important;font-weight:600!important;box-shadow:0 10px 28px rgba(15,23,42,0.4),0 0 16px rgba(129,140,248,0.5)!important;pointer-events:none!important;display:flex!important;align-items:center!important;gap:8px!important;animation:sfPopIn 0.25s cubic-bezier(0.175,0.885,0.32,1.275)!important;transform-origin:bottom left!important}',
            '.sf-focus-callout::after{content:\'\'!important;position:absolute!important;bottom:-6px!important;left:16px!important;border-width:6px 6px 0 6px!important;border-style:solid!important;border-color:#818cf8 transparent transparent transparent!important}',
            '@keyframes sfPopIn{0%{opacity:0;transform:translateY(6px) scale(0.9)}100%{opacity:1;transform:translateY(0) scale(1)}}',
            '.sf-comment-card{background:#ffffff!important;border:1px solid #e2e8f0!important;border-radius:10px!important;padding:14px 16px!important;margin-bottom:12px!important;display:flex!important;flex-direction:column!important;gap:8px!important;cursor:pointer!important;box-shadow:0 2px 6px rgba(0,0,0,0.03)!important;transition:transform 0.15s ease,border-color 0.15s ease,background 0.15s ease,box-shadow 0.15s ease!important}',
            '.sf-comment-card:hover{background:#f8fafc!important;border-color:#cbd5e1!important;transform:translateX(2px)!important;box-shadow:0 4px 12px rgba(0,0,0,0.06)!important}',
            '.sf-comment-card.sf-selected-card{border-color:#6366f1!important;background:#eef2ff!important;box-shadow:0 0 0 2px #6366f1,0 6px 20px rgba(99,102,241,0.15)!important;transform:translateX(4px)!important}',
            '.sf-splitter{width:10px!important;margin:0 -5px!important;cursor:col-resize!important;z-index:25!important;display:flex!important;align-items:center!important;justify-content:center!important;user-select:none!important;-webkit-user-select:none!important;flex-shrink:0!important;position:relative!important;transition:background 0.15s ease!important}',
            '.sf-splitter:hover,.sf-splitter.sf-resizing-active{background:rgba(99,102,241,0.12)!important}',
            '.sf-splitter-bar{width:3px!important;height:48px!important;border-radius:4px!important;background:#cbd5e1!important;transition:all 0.2s ease!important}',
            '.sf-splitter:hover .sf-splitter-bar,.sf-splitter.sf-resizing-active .sf-splitter-bar{width:4px!important;height:64px!important;background:#4f46e5!important;box-shadow:0 0 10px rgba(79,70,229,0.6)!important}',
            'body.sf-resizing,body.sf-resizing *{cursor:col-resize!important;user-select:none!important;-webkit-user-select:none!important}',
            '</style>'
        ].join('');

        wrap.addEventListener('click', function (e) {
            if (e.target === wrap) {
                e.stopPropagation();
                sfClose();
            }
        });

        document.body.appendChild(wrap);
        initSplitterResize();
        fetchSubmissionsList();

        // Setup Document Selection Listener
        // Track mousedown position to distinguish genuine drag-selections from single clicks
        var docCanvas = document.getElementById('sfDocCanvas');
        if (docCanvas) {
            var _mdX = 0, _mdY = 0;
            docCanvas.addEventListener('mousedown', function(e) {
                _mdX = e.clientX;
                _mdY = e.clientY;
            });
            docCanvas.addEventListener('mouseup', function(e) {
                var dx = Math.abs(e.clientX - _mdX);
                var dy = Math.abs(e.clientY - _mdY);
                // Only process if user actually dragged (not a plain click)
                if (dx > 5 || dy > 5) {
                    handleTextSelection(e);
                } else {
                    // Single click — dismiss any open popover
                    var pop = document.getElementById('sfSelectionPopover');
                    if (pop && pop.style.display === 'flex') {
                        hideSelectionPopover();
                    }
                }
            });
        }
    }

    // ── Stored Range for pending annotation ───────────────────────────────
    var pendingRange = null; // Stores the cloned Range for use at save time

    // ── Set Color in Popover ───────────────────────────────────────────────
    function setColor(color) {
        selectedHighlightColor = color;
        var dots = ['yellow', 'green', 'blue', 'pink'];
        dots.forEach(function(d) {
            var dotEl = document.getElementById('sfColorDot-' + d);
            if (dotEl) {
                dotEl.style.border = (d === color) ? '2px solid #1e1b4b' : '2px solid transparent';
                dotEl.style.transform = (d === color) ? 'scale(1.15)' : 'scale(1)';
            }
        });
    }

    function cancelPopover() {
        hideSelectionPopover();
    }

    // ── Handle Mouseup Text Selection ──────────────────────────────────────
    function handleTextSelection(e) {
        var pop = document.getElementById('sfSelectionPopover');
        if (pop && pop.contains(e.target)) return;

        var selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            if (pop && pop.style.display === 'flex') hideSelectionPopover();
            return;
        }

        var text = selection.toString().trim();
        if (text.length < 2) {
            hideSelectionPopover();
            return;
        }

        // Store the range NOW (while selection is still live)
        pendingRange = (selection.rangeCount > 0) ? selection.getRangeAt(0).cloneRange() : null;

        var pid = getSelectedParagraphId(selection);
        currentSelectedRange = { text: text, paragraphId: pid };

        // DON'T clear the native browser selection — keep blue highlight visible while popover is open
        // The popover shows a text preview so the user knows what they selected
        showSelectionPopover(e.clientX, e.clientY, text);
    }

    function getSelectedParagraphId(selection) {
        var node = selection.anchorNode;
        while (node && node !== document.body) {
            if (node.getAttribute && (node.getAttribute('data-pid') || node.id)) {
                return node.getAttribute('data-pid') || node.id;
            }
            node = node.parentNode;
        }
        return '';
    }

    function showSelectionPopover(x, y, previewText) {
        var pop = document.getElementById('sfSelectionPopover');
        if (!pop) return;

        // Show selected text preview
        var preview = document.getElementById('sfSelectionPreview');
        if (preview && previewText) {
            var trimmed = previewText.length > 120 ? previewText.substring(0, 117) + '...' : previewText;
            preview.textContent = '\u201c' + trimmed + '\u201d';
        }

        pop.style.display = 'flex';
        // Position near the mouse but keep within viewport
        var popW = 300, popH = 180;
        var left = Math.min(x, window.innerWidth - popW - 12);
        var top  = y + 12;
        if (top + popH > window.innerHeight) top = y - popH - 8;
        pop.style.left = Math.max(8, left) + 'px';
        pop.style.top  = Math.max(8, top)  + 'px';

        var txt = document.getElementById('sfCommentInput');
        if (txt) txt.value = '';
        var confWrap = document.getElementById('sfConfidentialOptionWrap');
        if (confWrap) {
            // Only reviewers submit confidential notes to the editor; editors write editorial comments
            confWrap.style.display = (currentUserInfo && currentUserInfo.isEditor) ? 'none' : 'flex';
        }
        // Don't auto-focus textarea — it would clear the browser selection
        setColor(selectedHighlightColor || 'yellow');
    }

    function hideSelectionPopover() {
        var pop = document.getElementById('sfSelectionPopover');
        if (pop) pop.style.display = 'none';
        // Clear any native browser selection left over
        var sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        pendingRange = null;
        currentSelectedRange = null;
    }

    // ── Inject permanent <mark> using the saved Range ─────────────────────
    function injectMarkFromRange(savedRange, color) {
        if (!savedRange) return false;
        var clr = color || 'yellow';
        try {
            var mark = document.createElement('mark');
            mark.className = 'sf-highlight sf-hl-' + clr;
            savedRange.surroundContents(mark);
            return mark;
        } catch (err) {
            // Cross-element selection: extract + rewrap
            try {
                var frag = savedRange.extractContents();
                var mark2 = document.createElement('mark');
                mark2.className = 'sf-highlight sf-hl-' + clr;
                mark2.appendChild(frag);
                savedRange.insertNode(mark2);
                return mark2;
            } catch (e2) { return false; }
        }
    }

    // ── Save Annotation ────────────────────────────────────────────────────
    function saveAnnotation() {
        if (!currentSelectedRange || !currentSelectedRange.text) {
            hideSelectionPopover();
            return;
        }

        var commentInput = document.getElementById('sfCommentInput');
        var comment = commentInput ? commentInput.value.trim() : '';
        if (!comment) {
            alert('Please enter a comment for this markup.');
            return;
        }

        // Capture state before clearing
        var savedRange = pendingRange;
        var savedColor = selectedHighlightColor || 'yellow';
        var savedText  = currentSelectedRange.text;
        var savedPid   = currentSelectedRange.paragraphId || '';
        var sid = currentSubmissionId || '1';
        var url = getContextBase() + '/scholarflow/saveAnnotation';

        var isConfidential = false;
        var confBox = document.getElementById('sfConfidentialCheckbox');
        if (confBox && confBox.checked) {
            isConfidential = true;
            confBox.checked = false;
        }

        var payload = {
            submission_id: parseInt(sid, 10),
            selected_text: savedText,
            comment: comment,
            color: savedColor,
            paragraph_id: savedPid,
            confidential_to_editor: isConfidential
        };

        // Dismiss popover and clear native browser selection immediately
        var pop = document.getElementById('sfSelectionPopover');
        if (pop) pop.style.display = 'none';
        var sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        pendingRange = null;
        currentSelectedRange = null;

        // Inject permanent mark right away using the saved Range (instant visual feedback)
        var injectedMark = injectMarkFromRange(savedRange, savedColor);

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data && data.annotation) {
                cachedAnnotations.push(data.annotation);
                if (data.annotation.user_role === 'Editor') {
                    __sfFilterCommentsTab('editor');
                } else if (data.annotation.confidential_to_editor) {
                    __sfFilterCommentsTab('reviewer_to_editor');
                } else {
                    __sfFilterCommentsTab('reviewer');
                }
                if (injectedMark && injectedMark.parentNode) {
                    // Tag the already-injected mark with its server-assigned ID
                    injectedMark.setAttribute('data-aid', data.annotation.id);
                    injectedMark.id = 'sf-mark-' + data.annotation.id;
                    injectedMark.setAttribute('onclick', 'window.__sfOnHighlightClick(' + data.annotation.id + ',event)');
                    injectedMark.style.cursor = 'pointer';
                } else {
                    // Fallback: full re-render from saved text positions
                    applyHighlightsToDocument();
                }
                setTimeout(function () {
                    scrollToAnnotation(data.annotation.id, data.annotation.paragraph_id);
                }, 100);
            } else if (data && data.error) {
                // Undo the immediate mark injection on server error
                if (injectedMark && injectedMark.parentNode) {
                    var p = injectedMark.parentNode;
                    while (injectedMark.firstChild) p.insertBefore(injectedMark.firstChild, injectedMark);
                    p.removeChild(injectedMark);
                    p.normalize();
                }
                alert('Could not save comment: ' + data.error);
            }
        })
        .catch(function (err) {
            if (injectedMark && injectedMark.parentNode) {
                var p = injectedMark.parentNode;
                while (injectedMark.firstChild) p.insertBefore(injectedMark.firstChild, injectedMark);
                p.removeChild(injectedMark);
                p.normalize();
            }
            alert('Network error saving comment: ' + err.message);
        });
    }


    // ── Delete Annotation ──────────────────────────────────────────────────
    function deleteAnnotation(aid, e) {
        if (e) e.stopPropagation();

        var sid = currentSubmissionId || '1';
        var url = getContextBase() + '/scholarflow/deleteAnnotation?id=' + aid + '&submissionId=' + sid;
        fetch(url, { method: 'POST', credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && (data.success || data.deleted_id)) {
                    cachedAnnotations = cachedAnnotations.filter(function (a) { return a.id !== aid; });
                    renderAnnotationsList(cachedAnnotations);
                    var docCanvas = document.getElementById('sfDocCanvas');
                    if (docCanvas) {
                        var marks = docCanvas.querySelectorAll('[data-aid="' + aid + '"]');
                        marks.forEach(function (m) {
                            var textNode = document.createTextNode(m.textContent);
                            if (m.parentNode) {
                                m.parentNode.replaceChild(textNode, m);
                            }
                        });
                    }
                    var badge = document.getElementById('sfFocusCallout');
                    if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
                } else if (data && data.error) {
                    alert('Could not remove comment: ' + data.error);
                }
            })
            .catch(function (err) {
                console.error('Delete annotation error:', err);
                alert('Network error while removing comment. Please try again.');
            });
    }

    // ── Export Markups Report ──────────────────────────────────────────────
    function exportMarkups() {
        var sid = currentSubmissionId || '1';
        var url = getContextBase() + '/scholarflow/exportAnnotations?submissionId=' + sid;
        var win = window.open(url, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = url;
        }
    }

    // ── Load Document Viewer ───────────────────────────────────────────────
    function loadDocumentViewer(sid) {
        var activeSid = sid || currentSubmissionId || '1';
        var docCanvas = document.getElementById('sfDocCanvas');
        var titleHeader = document.getElementById('sfDocTitleHeader');

        if (docCanvas) {
            docCanvas.innerHTML = [
                '<div style="text-align:center;padding:90px 24px;color:#64748b">',
                '  <div style="position:relative;width:52px;height:52px;margin:0 auto 16px">',
                '    <div style="position:absolute;inset:0;border-radius:50%;border:4px solid #e2e8f0;border-top:4px solid #4f46e5;animation:sfSpin 1s linear infinite"></div>',
                '    <div style="position:absolute;inset:7px;border-radius:50%;border:3px solid transparent;border-right:3px solid #3b82f6;animation:sfSpin 1.4s linear infinite reverse"></div>',
                '    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#4f46e5">SF</div>',
                '  </div>',
                '  <div style="font-size:16px;font-weight:700;color:#1e293b">Rendering in-platform manuscript&hellip;</div>',
                '  <div style="font-size:12px;color:#64748b;margin-top:6px">Loading formatted text and paragraph structures for Submission #' + esc(activeSid) + '</div>',
                '</div>'
            ].join('\n');
        }

        var url = getContextBase() + '/scholarflow/document?submissionId=' + activeSid;

        fetch(url, { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (String(activeSid) !== String(currentSubmissionId)) return;
                if (data && data.success && data.html) {
                    if (docCanvas) docCanvas.innerHTML = data.html;
                    if (titleHeader && data.title) titleHeader.textContent = data.title + ' (' + (data.filename || '') + ')';
                    if (data.user) {
                        currentUserInfo = data.user;
                        applyUserRoleGating();
                    }
                    loadAnnotations(activeSid);
                } else if (data && data.error) {
                    if (docCanvas) {
                        docCanvas.innerHTML = [
                            '<div style="background:#fef2f2;border:1px solid #fecaca;padding:24px;border-radius:12px;color:#991b1b;max-width:540px;margin:30px auto;text-align:center">',
                            '  <div style="font-size:32px;margin-bottom:8px">📄</div>',
                            '  <div style="font-weight:800;font-size:15px;margin-bottom:6px">Document Unavailable for Submission #' + esc(activeSid) + '</div>',
                            '  <div style="font-size:13px;color:#b91c1c;margin-bottom:16px;line-height:1.5">' + esc(data.error) + '</div>',
                            '  <button onclick="__sfOpenPaperPickerModal()" style="background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(79,70,229,0.3)">📚 Browse Available Papers</button>',
                            '</div>'
                        ].join('\n');
                    }
                }
            })
            .catch(function (err) {
                if (String(activeSid) !== String(currentSubmissionId)) return;
                if (docCanvas) {
                    docCanvas.innerHTML = '<div style="color:#b91c1c;padding:20px;text-align:center">Network error loading document: ' + esc(err.message) + '</div>';
                }
            });
    }

    // ── Load Annotations ───────────────────────────────────────────────────
    function loadAnnotations(sid) {
        var url = getContextBase() + '/scholarflow/annotations?submissionId=' + sid;
        fetch(url, { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && data.annotations) {
                    cachedAnnotations = data.annotations;
                    renderAnnotationsList(cachedAnnotations);
                    applyHighlightsToDocument();
                }
            })
            .catch(function () {});
    }

    // ── Render Annotations Sidebar (Modern Light Cards) ───────────────────
    function renderAnnotationsList(annotations) {
        var container = document.getElementById('sfCommentsList');
        var countBadge = document.getElementById('sfCommentsCountBadge');
        if (!container) return;

        var allList = annotations || [];
        var editorComments = [];
        var reviewerToEditorComments = [];
        var reviewerComments = [];
        var reviewerNamesMap = {};

        allList.forEach(function (a) {
            if (a.confidential_to_editor) {
                // ALL comments made for the editor in read-only mode go to reviewerToEditorComments!
                reviewerToEditorComments.push(a);
                if (a.user_name) {
                    reviewerNamesMap[a.user_name] = true;
                }
            } else if (a.user_role === 'Editor') {
                // Standard comments made by the editor
                editorComments.push(a);
            } else {
                // Standard comments made by reviewers
                reviewerComments.push(a);
                if (a.user_name) {
                    reviewerNamesMap[a.user_name] = true;
                }
            }
        });

        var isEditor = currentUserInfo && currentUserInfo.isEditor;
        var isAuthor = currentUserInfo && currentUserInfo.isAuthorOnly;

        if (countBadge) countBadge.textContent = allList.length;

        var elCountEditor = document.getElementById('sfCountEditor');
        var elCountRevToEd = document.getElementById('sfCountReviewerToEditor');
        var elCountRev = document.getElementById('sfCountReviewer');
        if (elCountEditor) elCountEditor.textContent = editorComments.length;
        if (elCountRevToEd) elCountRevToEd.textContent = reviewerToEditorComments.length;
        if (elCountRev) elCountRev.textContent = reviewerComments.length;

        // Tailor the reviewer-to-editor tab for current role
        var revToEdTab = document.getElementById('sfCommentTab-reviewer_to_editor');
        var revToEdLabel = document.getElementById('sfRevToEdLabel');
        if (revToEdTab) {
            if (isAuthor) {
                revToEdTab.style.display = 'none';
            } else {
                revToEdTab.style.display = 'flex';
                if (revToEdLabel) {
                    revToEdLabel.textContent = isEditor ? '🔒 To Editor (Read Only)' : '🔒 My Notes to Editor';
                }
            }
        }

        // Show "Send to Author" button for Editors if any comments exist
        var sendAuthorBtn = document.getElementById('sfSendToAuthorBtn');
        if (sendAuthorBtn) {
            sendAuthorBtn.style.display = (isEditor && (editorComments.length > 0 || reviewerComments.length > 0)) ? 'flex' : 'none';
        }

        // Update Reviewer Sub-Filter dropdown
        var subSel = document.getElementById('sfReviewerSubFilter');
        if (subSel) {
            var currVal = subSel.value;
            subSel.innerHTML = '<option value="">All Reviewers (' + reviewerComments.length + ')</option>';
            Object.keys(reviewerNamesMap).sort().forEach(function (rName) {
                var opt = document.createElement('option');
                opt.value = rName;
                var cnt = reviewerComments.filter(function (x) { return x.user_name === rName; }).length;
                opt.textContent = rName + ' (' + cnt + ')';
                if (rName === currVal) opt.selected = true;
                subSel.appendChild(opt);
            });
        }

        // Apply active filter
        var displayList = [];
        if (currentCommentFilter === 'editor') {
            displayList = editorComments;
        } else if (currentCommentFilter === 'reviewer_to_editor') {
            displayList = reviewerToEditorComments;
        } else if (currentCommentFilter === 'reviewer') {
            displayList = reviewerComments;
            if (currentReviewerSubFilter) {
                displayList = displayList.filter(function (a) { return a.user_name === currentReviewerSubFilter; });
            }
        } else {
            currentCommentFilter = 'editor';
            displayList = editorComments;
        }

        if (displayList.length === 0) {
            var emptyMsg = 'No comments made by an editor recorded yet.<br>As an editor, highlight text on the left to add editorial comments.';
            if (currentCommentFilter === 'reviewer_to_editor') {
                emptyMsg = isEditor
                    ? '🔒 No confidential comments from reviewers to the editor yet.<br>When reviewers submit private notes for the editor, they appear here in read-only mode.'
                    : '🔒 You have not submitted any private notes for the editor yet.<br>Check "Note for Editor only" when highlighting text to send a confidential note.';
            } else if (currentCommentFilter === 'reviewer') {
                emptyMsg = 'No standard reviewer comments recorded for this selection.';
            }
            container.innerHTML = '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:36px 10px">' + emptyMsg + '</div>';
            return;
        }

        var html = '';
        if (currentCommentFilter === 'reviewer_to_editor') {
            html += '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:9px 12px;margin-bottom:12px;font-size:11px;color:#92400e;line-height:1.5;display:flex;align-items:flex-start;gap:8px">' +
                '<span style="font-size:15px;line-height:1">🔒</span>' +
                '<div><strong style="color:#78350f">Read-Only Mode:</strong> Confidential feedback submitted by peer reviewers exclusively for the Editor. Editors can read only; these comments cannot be modified, deleted, or shared with author or other reviewers.</div>' +
            '</div>';
        }

        for (var i = 0; i < displayList.length; i++) {
            var a = displayList[i];
            var roleBg = a.user_role === 'Editor' ? '#f3e8ff' : (a.user_role === 'Reviewer' ? '#eff6ff' : '#ecfdf5');
            var roleColor = a.user_role === 'Editor' ? '#7e22ce' : (a.user_role === 'Reviewer' ? '#1d4ed8' : '#047857');
            var avatarBg = a.user_role === 'Editor' ? '#9333ea' : (a.user_role === 'Reviewer' ? '#2563eb' : '#059669');
            var markColor = a.color === 'pink' ? '#ec4899' : (a.color === 'green' ? '#22c55e' : (a.color === 'blue' ? '#3b82f6' : '#eab308'));

            var isConfidential = !!a.confidential_to_editor;

            // Check deletion permissions:
            // 1. Editors can moderate/delete regular comments and their own editor comments
            // 2. CRITICAL READ-ONLY RULE: Reviewer-to-editor confidential comments are strictly READ-ONLY for the Editor.
            //    Only the authoring reviewer can delete their own note.
            // 3. Authors cannot delete any comments
            var canDelete = false;
            if (currentUserInfo && !currentUserInfo.isAuthorOnly) {
                if (isConfidential) {
                    // Strictly read-only for Editor! Only the authoring reviewer can delete their own note
                    if (currentUserInfo.id && a.user_id && String(currentUserInfo.id) === String(a.user_id)) {
                        canDelete = true;
                    } else if (currentUserInfo.name && a.user_name && currentUserInfo.name.trim().toLowerCase() === a.user_name.trim().toLowerCase()) {
                        canDelete = true;
                    }
                } else if (isEditor) {
                    canDelete = true;
                } else if (currentUserInfo.id && a.user_id && String(currentUserInfo.id) === String(a.user_id)) {
                    canDelete = true;
                } else if (currentUserInfo.name && a.user_name && currentUserInfo.name.trim().toLowerCase() === a.user_name.trim().toLowerCase()) {
                    canDelete = true;
                }
            }

            var delActionHtml = '';
            if (canDelete) {
                delActionHtml = [
                    '<div class="sf-del-action-wrap" style="display:flex;align-items:center;position:relative" onclick="event.stopPropagation()">',
                      '<button type="button" class="sf-del-trigger" data-aid="' + a.id + '" title="Remove comment" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#94a3b8;width:22px;height:22px;border-radius:5px;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:all 0.15s ease">&times;</button>',
                      '<div class="sf-del-confirm" data-confirm-aid="' + a.id + '" style="display:none;align-items:center;gap:4px;background:#fee2e2;border:1px solid #fecaca;padding:2px 6px;border-radius:6px">',
                        '<span style="font-size:11px;font-weight:700;color:#991b1b">Delete?</span>',
                        '<button type="button" class="sf-confirm-yes" data-aid="' + a.id + '" style="background:#dc2626;color:#fff;border:none;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700;cursor:pointer">Yes</button>',
                        '<button type="button" class="sf-confirm-no" data-aid="' + a.id + '" style="background:#fff;color:#475569;border:1px solid #cbd5e1;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700;cursor:pointer">No</button>',
                      '</div>',
                    '</div>'
                ].join('');
            }

            // Editor quick action to send this reviewer's comments to the author
            var sendCardAction = '';
            if (isConfidential) {
                sendCardAction = '<span style="font-size:10px;font-weight:700;color:#92400e;background:#fef3c7;border:1px solid #fde68a;padding:2px 7px;border-radius:6px;display:inline-flex;align-items:center;gap:3px" title="Confidential comment: strictly read-only for Editor. Cannot be shared with author or reviewers.">🔒 Read-Only (Cannot Share)</span>';
            } else if (isEditor && a.user_role !== 'Editor') {
                sendCardAction = '<button type="button" onclick="event.stopPropagation(); window.__sfOpenSendToAuthorModal(\'' + esc(a.user_name).replace(/'/g, "\\'") + '\')" title="Send this reviewer\'s feedback to author" style="background:none;border:none;color:#4f46e5;font-size:11px;font-weight:700;cursor:pointer;padding:0;text-decoration:underline">✉️ Send to Author</button>';
            }

            var confidentialBadge = '';
            if (isConfidential) {
                confidentialBadge = '<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:12px;background:#fef3c7;color:#92400e;border:1px solid #fde68a;display:inline-flex;align-items:center;gap:3px">🔒 Reviewer to Editor (Read Only)</span>';
            }

            var cardExtraStyle = isConfidential ? 'border-left:4px solid #f59e0b !important;background:#fffdfa !important;' : '';

            html += [
                '<div class="sf-comment-card" data-aid="' + a.id + '" style="' + cardExtraStyle + '" onclick="__sfScrollToAnnotation(' + a.id + ', \'' + (a.paragraph_id || '') + '\')">',
                  '<div style="display:flex;align-items:center;justify-content:space-between">',
                    '<div style="display:flex;align-items:center;gap:8px">',
                      '<div style="width:26px;height:26px;border-radius:50%;background:' + avatarBg + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">',
                        esc(a.user_name.charAt(0).toUpperCase()),
                      '</div>',
                      '<span style="font-size:13px;font-weight:700;color:#0f172a">' + esc(a.user_name) + '</span>',
                      '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;background:' + roleBg + ';color:' + roleColor + '">' + esc(a.user_role) + '</span>',
                      confidentialBadge,
                    '</div>',
                    delActionHtml,
                  '</div>',
                  '<div style="display:flex;align-items:center;justify-content:space-between">',
                    '<div style="font-size:11px;color:#64748b">' + esc(a.created_at) + '</div>',
                    sendCardAction,
                  '</div>',
                  '<div style="font-size:13px;color:#475569;background:#f8fafc;border-left:3px solid ' + markColor + ';padding:6px 10px;border-radius:0 6px 6px 0;margin:4px 0;font-style:italic">',
                    '"' + esc(a.selected_text.length > 95 ? a.selected_text.substring(0, 95) + '...' : a.selected_text) + '"',
                  '</div>',
                  '<div style="font-size:13px;color:#0f172a;line-height:1.5;margin-top:2px;font-weight:500">' + esc(a.comment) + '</div>',
                '</div>'
            ].join('');
        }

        container.innerHTML = html;

        // Attach event listeners for delete actions
        container.querySelectorAll('.sf-del-trigger').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var aid = btn.getAttribute('data-aid');
                btn.style.display = 'none';
                var conf = container.querySelector('.sf-del-confirm[data-confirm-aid="' + aid + '"]');
                if (conf) conf.style.display = 'flex';
            });
        });

        container.querySelectorAll('.sf-confirm-no').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var aid = btn.getAttribute('data-aid');
                var conf = container.querySelector('.sf-del-confirm[data-confirm-aid="' + aid + '"]');
                if (conf) conf.style.display = 'none';
                var trigger = container.querySelector('.sf-del-trigger[data-aid="' + aid + '"]');
                if (trigger) trigger.style.display = 'flex';
            });
        });

        container.querySelectorAll('.sf-confirm-yes').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var aid = parseInt(btn.getAttribute('data-aid'), 10);
                btn.textContent = '...';
                deleteAnnotation(aid);
            });
        });
    }

    // ── Apply Highlights to Document Reader ────────────────────────────────
    function applyHighlightsToDocument() {
        var docCanvas = document.getElementById('sfDocCanvas');
        if (!docCanvas || !cachedAnnotations || cachedAnnotations.length === 0) return;

        for (var i = 0; i < cachedAnnotations.length; i++) {
            var a = cachedAnnotations[i];
            var snippet = a.selected_text ? a.selected_text.trim() : '';
            if (!snippet || snippet.length < 2) continue;

            // Skip if already injected into the document reader
            if (docCanvas.querySelector('mark[data-aid="' + a.id + '"]') || document.getElementById('sf-mark-' + a.id)) continue;

            var colorClass = 'sf-hl-' + (a.color || 'yellow');
            var searchIn = (a.paragraph_id ? document.getElementById(a.paragraph_id) : null) || docCanvas;

            injectHighlightByText(searchIn, snippet, a.id, colorClass, a.user_name, a.user_role, a.comment);
        }
    }

    // ── Safe text-node highlight injection via TreeWalker ─────────────────
    // Finds the first occurrence of `text` inside `root` by walking text nodes,
    // then uses Range API to wrap it in a <mark> — never touches innerHTML.
    function injectHighlightByText(root, text, aid, colorClass, userName, userRole, comment) {
        if (!root || !text) return;
        var cleanText = text.trim();
        if (!cleanText) return;

        var docCanvas = document.getElementById('sfDocCanvas');
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        var node;
        while ((node = walker.nextNode())) {
            var nodeVal = node.nodeValue;
            var idx = nodeVal.indexOf(cleanText);

            // Normalized whitespace/case-insensitive fallback if direct match fails
            if (idx === -1) {
                var normNode = nodeVal.replace(/\s+/g, ' ');
                var normText = cleanText.replace(/\s+/g, ' ');
                idx = normNode.toLowerCase().indexOf(normText.toLowerCase());
                if (idx === -1) continue;
            }

            try {
                var range = document.createRange();
                range.setStart(node, idx);
                range.setEnd(node, Math.min(node.nodeValue.length, idx + cleanText.length));

                var mark = document.createElement('mark');
                mark.className = 'sf-highlight ' + colorClass;
                mark.setAttribute('data-aid', aid);
                mark.id = 'sf-mark-' + aid;
                mark.title = 'Comment by ' + (userName || '') + ' (' + (userRole || '') + '): ' + (comment || '');
                mark.setAttribute('onclick', 'event.stopPropagation(); window.__sfOnHighlightClick(' + aid + ')');
                mark.style.cursor = 'pointer';

                range.surroundContents(mark);
                return;
            } catch (e) {
                // Cross-element selection fallback: extract + re-insert
                try {
                    var range2 = document.createRange();
                    range2.setStart(node, idx);
                    range2.setEnd(node, Math.min(node.nodeValue.length, idx + cleanText.length));
                    var frag = range2.extractContents();
                    var mark2 = document.createElement('mark');
                    mark2.className = 'sf-highlight ' + colorClass;
                    mark2.setAttribute('data-aid', aid);
                    mark2.id = 'sf-mark-' + aid;
                    mark2.title = 'Comment by ' + (userName || '') + ' (' + (userRole || '') + '): ' + (comment || '');
                    mark2.setAttribute('onclick', 'event.stopPropagation(); window.__sfOnHighlightClick(' + aid + ')');
                    mark2.style.cursor = 'pointer';
                    mark2.appendChild(frag);
                    range2.insertNode(mark2);
                    return;
                } catch (e2) { /* continue walker */ }
            }
        }

        // If not found in specific paragraph element (e.g. pid shifted), fallback to searching the entire document canvas
        if (root !== docCanvas && docCanvas) {
            injectHighlightByText(docCanvas, text, aid, colorClass, userName, userRole, comment);
        }
    }


    // ── Click directly on a Highlight Mark inside Document Reader ───────────
    function onHighlightClick(aid) {
        scrollToAnnotation(aid);
    }

    // ── Scroll to & Vividly Highlight Annotation ───────────────────────────
    function scrollToAnnotation(aid, pid) {
        var docCanvas = document.getElementById('sfDocCanvas');
        if (!docCanvas) return;

        // 1. Highlight clicked card in the sidebar
        var allCards = document.querySelectorAll('.sf-comment-card');
        allCards.forEach(function (c) {
            c.classList.remove('sf-selected-card');
        });

        var targetCard = document.querySelector('.sf-comment-card[data-aid="' + aid + '"]');
        if (targetCard) {
            targetCard.classList.add('sf-selected-card');
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // 2. Clear previous active marks & paragraph highlights
        var allMarks = docCanvas.querySelectorAll('mark, [data-aid]');
        allMarks.forEach(function (m) {
            m.classList.remove('sf-active-comment-mark');
            m.style.backgroundColor = '';
            m.style.color = '';
            m.style.boxShadow = '';
            m.style.fontWeight = '';
        });

        var allParas = docCanvas.querySelectorAll('p, h1, h2, h3, div');
        allParas.forEach(function (p) {
            p.classList.remove('sf-paragraph-active');
            p.classList.remove('sf-active-comment-mark');
            p.style.backgroundColor = '';
            p.style.color = '';
            p.style.boxShadow = '';
            p.style.fontWeight = '';
        });

        var oldCallout = document.getElementById('sfFocusCallout');
        if (oldCallout && oldCallout.parentNode) {
            oldCallout.parentNode.removeChild(oldCallout);
        }

        // 3. Find the target element (prefer inline <mark>)
        var targetEl = document.getElementById('sf-mark-' + aid) ||
                       docCanvas.querySelector('mark[data-aid="' + aid + '"]');

        // If mark is not yet in the DOM, try on-demand injection using cached annotations
        if (!targetEl && cachedAnnotations) {
            var annot = cachedAnnotations.find(function (x) { return x.id === aid; });
            if (annot && annot.selected_text) {
                var colorClass = 'sf-hl-' + (annot.color || 'yellow');
                var searchIn = (annot.paragraph_id ? document.getElementById(annot.paragraph_id) : null) || docCanvas;
                injectHighlightByText(searchIn, annot.selected_text.trim(), annot.id, colorClass, annot.user_name, annot.user_role, annot.comment);
                targetEl = document.getElementById('sf-mark-' + aid) ||
                           docCanvas.querySelector('mark[data-aid="' + aid + '"]');
            }
        }

        // Fallback to paragraph if mark still could not be located
        if (!targetEl && pid) {
            targetEl = document.getElementById(pid);
        }

        if (targetEl) {
            // Scroll direct container
            var targetOffsetTop = targetEl.offsetTop - docCanvas.offsetTop;
            docCanvas.scrollTo({
                top: Math.max(0, targetOffsetTop - 50),
                behavior: 'smooth'
            });

            var isMark = (targetEl.tagName === 'MARK' || targetEl.classList.contains('sf-highlight'));

            if (isMark) {
                // Apply distinct golden-yellow pulsing highlight ONLY to the inline mark!
                targetEl.classList.add('sf-active-comment-mark');
                targetEl.style.backgroundColor = '#facc15';
                targetEl.style.color = '#000000';
                targetEl.style.boxShadow = '0 0 0 4px rgba(250,204,21,0.85), 0 0 24px rgba(250,204,21,0.9)';
                targetEl.style.fontWeight = '700';

                // Highlight parent paragraph with subtle active border
                var parentP = targetEl.closest('p, h1, h2, h3, div');
                if (parentP && parentP !== docCanvas) {
                    parentP.classList.add('sf-paragraph-active');
                }
            } else {
                // Target is a paragraph or heading block: NEVER apply sf-active-comment-mark or mark styles to whole block!
                targetEl.classList.add('sf-paragraph-active');
            }

            // Create floating callout badge
            var annotData = cachedAnnotations ? cachedAnnotations.find(function (x) { return x.id === aid; }) : null;
            if (annotData) {
                var callout = document.createElement('div');
                callout.id = 'sfFocusCallout';
                callout.className = 'sf-focus-callout';
                callout.innerHTML = '<span>💬 <strong>' + esc(annotData.user_name) + ' (' + esc(annotData.user_role) + '):</strong> ' + esc(annotData.comment.length > 50 ? annotData.comment.substring(0, 50) + '...' : annotData.comment) + '</span>';

                var targetRect = targetEl.getBoundingClientRect();
                var canvasRect = docCanvas.getBoundingClientRect();

                callout.style.left = Math.max(10, (targetRect.left - canvasRect.left + docCanvas.scrollLeft)) + 'px';
                callout.style.top = Math.max(10, (targetRect.top - canvasRect.top + docCanvas.scrollTop - 42)) + 'px';

                docCanvas.appendChild(callout);
            }

            // Smooth fadeout of pulsing halo after 5.5s
            setTimeout(function () {
                if (targetEl) {
                    targetEl.classList.remove('sf-active-comment-mark');
                    targetEl.style.boxShadow = '';
                    if (isMark) {
                        targetEl.style.backgroundColor = '';
                        targetEl.style.color = '';
                        targetEl.style.fontWeight = '';
                    }
                }
                var parentPara = targetEl.closest('p, h1, h2, h3, div');
                if (parentPara) {
                    parentPara.classList.remove('sf-paragraph-active');
                }
                var calloutEl = document.getElementById('sfFocusCallout');
                if (calloutEl && calloutEl.parentNode) {
                    calloutEl.parentNode.removeChild(calloutEl);
                }
            }, 5500);
        }
    }

    // ── Switch Tabs ────────────────────────────────────────────────────────
    function switchTab(tabName) {
        var sid = currentSubmissionId || '1';

        // Role gating safety: reviewers and non-editors cannot access reviewer matchmaking
        if (!currentUserInfo || !currentUserInfo.isEditor) {
            if (tabName === 'reviewers') {
                tabName = 'viewer';
            }
        }

        var btnViewer   = document.getElementById('sfTabViewer');
        var btnPre      = document.getElementById('sfTabPreScreen');
        var btnRec      = document.getElementById('sfTabRecReviewers');

        var panelViewer   = document.getElementById('sfPanelViewer');
        var panelPre      = document.getElementById('sfPanelPreScreen');
        var panelRec      = document.getElementById('sfPanelReviewers');

        var allBtns   = [btnViewer, btnPre, btnRec];
        var allPanels = [panelViewer, panelPre, panelRec];

        allBtns.forEach(function (b) {
            if (b) {
                b.classList.remove('active');
                b.style.borderBottomColor = 'transparent';
                b.style.color = '#64748b';
                b.style.fontWeight = '600';
            }
        });

        allPanels.forEach(function (p) {
            if (p) p.style.display = 'none';
        });

        if (tabName === 'viewer') {
            if (btnViewer) { btnViewer.classList.add('active'); btnViewer.style.borderBottomColor = '#4f46e5'; btnViewer.style.color = '#4f46e5'; btnViewer.style.fontWeight = '700'; }
            if (panelViewer) panelViewer.style.display = 'flex';
        } else if (tabName === 'prescreen') {
            if (btnPre) { btnPre.classList.add('active'); btnPre.style.borderBottomColor = '#4f46e5'; btnPre.style.color = '#4f46e5'; btnPre.style.fontWeight = '700'; }
            if (panelPre) panelPre.style.display = 'block';
            var r = document.getElementById('sfReport');
            if (!r || r.innerHTML.trim() === '' || lastEvaluatedSubmissions['prescreen'] !== sid) {
                lastEvaluatedSubmissions['prescreen'] = sid;
                runAnalysis(sid, true);
            }
        } else if (tabName === 'reviewers') {
            if (btnRec) { btnRec.classList.add('active'); btnRec.style.borderBottomColor = '#4f46e5'; btnRec.style.color = '#4f46e5'; btnRec.style.fontWeight = '700'; }
            if (panelRec) panelRec.style.display = 'block';
            var rec = document.getElementById('sfReviewers');
            if (!rec || rec.innerHTML.trim() === '' || lastEvaluatedSubmissions['reviewers'] !== sid) {
                lastEvaluatedSubmissions['reviewers'] = sid;
                runReviewerRecommendations(sid, true);
            }
        }
    }

    // ── Fetch AI Report with Cache, Accelerated Execution & Live Percentage Loader ──
    function runAnalysis(sid, forceRefresh, scope) {
        var activeSid = sid || currentSubmissionId || '1';
        var report = document.getElementById('sfReport');
        var cacheTag = document.getElementById('sfCacheTag');

        if (cacheTag) cacheTag.style.display = 'none';
        setBadge('INITIALIZING...', '#f1f5f9', '#475569', '#cbd5e1');

        if (window.__sfPrescreenProgressTimer) {
            clearInterval(window.__sfPrescreenProgressTimer);
            window.__sfPrescreenProgressTimer = null;
        }

        if (report) {
            report.innerHTML = [
                '<div style="text-align:center;padding:52px 24px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;margin-top:12px;box-shadow:0 4px 20px rgba(0,0,0,0.03)">',
                '  <div style="position:relative;width:96px;height:96px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center">',
                '    <svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg)">',
                '      <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" stroke-width="7"></circle>',
                '      <circle id="sfProgressCircle" cx="50" cy="50" r="42" fill="none" stroke="url(#sfGrad)" stroke-width="7" stroke-linecap="round" stroke-dasharray="264" stroke-dashoffset="264" style="transition:stroke-dashoffset 0.4s ease"></circle>',
                '      <defs>',
                '        <linearGradient id="sfGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
                '          <stop offset="0%" stop-color="#4f46e5"></stop>',
                '          <stop offset="100%" stop-color="#06b6d4"></stop>',
                '        </linearGradient>',
                '      </defs>',
                '    </svg>',
                '    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">',
                '      <span id="sfProgressPercent" style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px">0%</span>',
                '    </div>',
                '  </div>',
                '  <div style="font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">' + (forceRefresh ? 'Evaluating manuscript from scratch with AI model...' : 'AI Pre-Screening Analysis in progress...') + '</div>',
                '  <div id="sfProgressStep" style="font-size:13px;font-weight:600;color:#4f46e5;margin-top:8px;transition:all 0.3s">Initializing deep manuscript audit...</div>',
                '  <div style="width:100%;max-width:440px;height:8px;background:#f1f5f9;border-radius:999px;margin:20px auto 14px;overflow:hidden;border:1px solid #e2e8f0;position:relative">',
                '    <div id="sfProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,#4f46e5,#06b6d4);border-radius:999px;transition:width 0.4s ease;box-shadow:0 0 10px rgba(79,70,229,0.3)"></div>',
                '  </div>',
                '  <div style="font-size:12px;color:#64748b;max-width:480px;margin:0 auto">Auditing structure, methodology rigor, and research novelty for Submission #' + esc(activeSid) + '</div>',
                '</div>'
            ].join('\n');
        }

        var currentProgress = 0;
        var updateProgress = function(pct, stepText) {
            currentProgress = Math.max(currentProgress, pct);
            var pctEl = document.getElementById('sfProgressPercent');
            var barEl = document.getElementById('sfProgressBar');
            var circleEl = document.getElementById('sfProgressCircle');
            var stepEl = document.getElementById('sfProgressStep');
            var badgeEl = document.getElementById('sfBadge');

            if (pctEl) pctEl.textContent = Math.round(currentProgress) + '%';
            if (barEl) barEl.style.width = Math.min(100, currentProgress) + '%';
            if (circleEl) {
                var circumference = 264;
                var offset = circumference - (currentProgress / 100) * circumference;
                circleEl.style.strokeDashoffset = Math.max(0, offset);
            }
            if (stepText && stepEl) stepEl.textContent = stepText;
            if (badgeEl && currentProgress < 100) {
                badgeEl.textContent = 'ANALYZING (' + Math.round(currentProgress) + '%)';
                badgeEl.style.background = '#eef2ff';
                badgeEl.style.color = '#4338ca';
                badgeEl.style.borderColor = '#c7d2fe';
            }
        };

        var elapsedSeconds = 0;
        window.__sfPrescreenProgressTimer = setInterval(function() {
            elapsedSeconds += 0.5;
            var targetPct;
            var stepMsg;
            if (elapsedSeconds <= 3) {
                targetPct = 5 + (elapsedSeconds / 3) * 15;
                stepMsg = 'Extracting manuscript text & section hierarchy...';
            } else if (elapsedSeconds <= 12) {
                targetPct = 20 + ((elapsedSeconds - 3) / 9) * 25;
                stepMsg = 'Auditing research scope & high-impact journal fit...';
            } else if (elapsedSeconds <= 26) {
                targetPct = 45 + ((elapsedSeconds - 12) / 14) * 25;
                stepMsg = 'Evaluating technical soundness & methodology rigor...';
            } else if (elapsedSeconds <= 42) {
                targetPct = 70 + ((elapsedSeconds - 26) / 16) * 18;
                stepMsg = 'Analyzing academic novelty, contribution & potential flaws...';
            } else if (elapsedSeconds <= 65) {
                targetPct = 88 + ((elapsedSeconds - 42) / 23) * 8;
                stepMsg = 'Synthesizing editorial recommendation & final report...';
            } else {
                targetPct = Math.min(98, 96 + (elapsedSeconds - 65) * 0.1);
                stepMsg = 'Finalizing editorial evaluation...';
            }
            updateProgress(targetPct, stepMsg);
        }, 500);

        var scopeParam = scope ? ('&scope=' + encodeURIComponent(scope)) : '';
        var url = getContextBase() + '/scholarflow/analyze?submissionId=' + activeSid + (forceRefresh ? '&refresh=1' : '') + scopeParam;

        fetch(url, { credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) {
                    return r.text().then(function (t) {
                        var snippet = t ? t.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 200) : '';
                        throw new Error('Server error (' + r.status + '): ' + (snippet || 'Failed to complete analysis.'));
                    });
                }
                return r.json();
            })
            .then(function (data) {
                if (window.__sfPrescreenProgressTimer) {
                    clearInterval(window.__sfPrescreenProgressTimer);
                    window.__sfPrescreenProgressTimer = null;
                }
                if (String(activeSid) !== String(currentSubmissionId)) {
                    return;
                }
                if (data && data.report) {
                    updateProgress(100, 'Analysis complete! Rendering editorial report...');
                    setTimeout(function() {
                        if (cacheTag) {
                            if (data.is_private) {
                                cacheTag.textContent = '🔒 Private Session Draft';
                                cacheTag.style.background = '#f3e8ff';
                                cacheTag.style.color = '#7e22ce';
                                cacheTag.style.display = 'inline-block';
                            } else if (data.cached) {
                                cacheTag.textContent = '⚡ Cached (Instant)';
                                cacheTag.style.background = '#dcfce7';
                                cacheTag.style.color = '#059669';
                                cacheTag.style.display = 'inline-block';
                            } else {
                                cacheTag.textContent = '🤖 Fresh AI Evaluation Generated';
                                cacheTag.style.background = '#eef2ff';
                                cacheTag.style.color = '#4338ca';
                                cacheTag.style.display = 'inline-block';
                            }
                        }
                        showReport(data.report);
                    }, 350);
                } else if (data && data.error) {
                    showError(data.error);
                }
            })
            .catch(function (err) {
                if (window.__sfPrescreenProgressTimer) {
                    clearInterval(window.__sfPrescreenProgressTimer);
                    window.__sfPrescreenProgressTimer = null;
                }
                if (String(activeSid) !== String(currentSubmissionId)) return;
                showError('Error: ' + err.message);
            });
    }

    function runReviewerRecommendations(sid, forceRefresh) {
        var activeSid = sid || currentSubmissionId || '1';
        var container = document.getElementById('sfReviewers');
        var badgeEl = document.getElementById('sfReviewerBadge');
        var cacheTag = document.getElementById('sfReviewerCacheTag');

        if (cacheTag) cacheTag.style.display = 'none';
        if (badgeEl) {
            badgeEl.textContent = 'INITIALIZING...';
            badgeEl.style.background = '#f1f5f9';
            badgeEl.style.color = '#475569';
            badgeEl.style.borderColor = '#cbd5e1';
            badgeEl.style.display = 'inline-block';
        }

        if (window.__sfReviewerProgressTimer) {
            clearInterval(window.__sfReviewerProgressTimer);
            window.__sfReviewerProgressTimer = null;
        }

        if (container) {
            container.innerHTML = [
                '<div style="text-align:center;padding:52px 24px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;margin-top:12px;box-shadow:0 4px 20px rgba(0,0,0,0.03)">',
                '  <div style="position:relative;width:96px;height:96px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center">',
                '    <svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg)">',
                '      <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" stroke-width="7"></circle>',
                '      <circle id="sfReviewerProgressCircle" cx="50" cy="50" r="42" fill="none" stroke="url(#sfGradReviewer)" stroke-width="7" stroke-linecap="round" stroke-dasharray="264" stroke-dashoffset="264" style="transition:stroke-dashoffset 0.4s ease"></circle>',
                '      <defs>',
                '        <linearGradient id="sfGradReviewer" x1="0%" y1="0%" x2="100%" y2="100%">',
                '          <stop offset="0%" stop-color="#4f46e5"></stop>',
                '          <stop offset="100%" stop-color="#06b6d4"></stop>',
                '        </linearGradient>',
                '      </defs>',
                '    </svg>',
                '    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">',
                '      <span id="sfReviewerProgressPercent" style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px">0%</span>',
                '    </div>',
                '  </div>',
                '  <div style="font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-0.3px">' + (forceRefresh ? 'Evaluating Reviewer Matchmaking from scratch with AI model...' : 'Matching Reviewers with AI for Submission #' + esc(activeSid) + '...') + '</div>',
                '  <div id="sfReviewerProgressStep" style="font-size:13px;font-weight:600;color:#4f46e5;margin-top:8px;transition:all 0.3s">Initializing reviewer expertise &amp; manuscript audit...</div>',
                '  <div style="width:100%;max-width:440px;height:8px;background:#f1f5f9;border-radius:999px;margin:20px auto 14px;overflow:hidden;border:1px solid #e2e8f0;position:relative">',
                '    <div id="sfReviewerProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,#4f46e5,#06b6d4);border-radius:999px;transition:width 0.4s ease;box-shadow:0 0 10px rgba(79,70,229,0.3)"></div>',
                '  </div>',
                '  <div style="font-size:12px;color:#64748b;max-width:480px;margin:0 auto">Evaluating subject expertise, publication history, and reviewer quota for Submission #' + esc(activeSid) + '</div>',
                '</div>'
            ].join('\n');
        }

        var currentProgress = 0;
        var updateReviewerProgress = function(pct, stepText) {
            currentProgress = Math.max(currentProgress, pct);
            var pctEl = document.getElementById('sfReviewerProgressPercent');
            var barEl = document.getElementById('sfReviewerProgressBar');
            var circleEl = document.getElementById('sfReviewerProgressCircle');
            var stepEl = document.getElementById('sfReviewerProgressStep');
            var badge = document.getElementById('sfReviewerBadge');

            if (pctEl) pctEl.textContent = Math.round(currentProgress) + '%';
            if (barEl) barEl.style.width = Math.min(100, currentProgress) + '%';
            if (circleEl) {
                var circumference = 264;
                var offset = circumference - (currentProgress / 100) * circumference;
                circleEl.style.strokeDashoffset = Math.max(0, offset);
            }
            if (stepText && stepEl) stepEl.textContent = stepText;
            if (badge && currentProgress < 100) {
                badge.textContent = 'MATCHING (' + Math.round(currentProgress) + '%)';
                badge.style.background = '#eef2ff';
                badge.style.color = '#4338ca';
                badge.style.borderColor = '#c7d2fe';
            }
        };

        var elapsedSeconds = 0;
        window.__sfReviewerProgressTimer = setInterval(function() {
            elapsedSeconds += 0.4;
            var targetPct;
            var stepMsg;
            if (elapsedSeconds <= 2) {
                targetPct = 5 + (elapsedSeconds / 2) * 15;
                stepMsg = 'Extracting manuscript domain keywords & key methodologies...';
            } else if (elapsedSeconds <= 6) {
                targetPct = 20 + ((elapsedSeconds - 2) / 4) * 28;
                stepMsg = 'Querying editorial reviewer pool & subject expertise profiles...';
            } else if (elapsedSeconds <= 14) {
                targetPct = 48 + ((elapsedSeconds - 6) / 8) * 27;
                stepMsg = 'Computing semantic compatibility & publication history alignment...';
            } else if (elapsedSeconds <= 22) {
                targetPct = 75 + ((elapsedSeconds - 14) / 8) * 15;
                stepMsg = 'Checking active reviewer quotas & conflict of interest...';
            } else if (elapsedSeconds <= 32) {
                targetPct = 90 + ((elapsedSeconds - 22) / 10) * 6;
                stepMsg = 'Ranking candidates & generating editorial justifications...';
            } else {
                targetPct = Math.min(98, 96 + (elapsedSeconds - 32) * 0.1);
                stepMsg = 'Finalizing ranked reviewer recommendations...';
            }
            updateReviewerProgress(targetPct, stepMsg);
        }, 400);

        var url = getContextBase() + '/scholarflow/recommendReviewers?submissionId=' + activeSid + (forceRefresh ? '&force_refresh=1' : '');

        fetch(url, { credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) {
                    return r.text().then(function (t) {
                        var snippet = t ? t.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 200) : '';
                        throw new Error('Server error (' + r.status + '): ' + (snippet || 'Failed to match reviewers.'));
                    });
                }
                return r.json();
            })
            .then(function (data) {
                if (window.__sfReviewerProgressTimer) {
                    clearInterval(window.__sfReviewerProgressTimer);
                    window.__sfReviewerProgressTimer = null;
                }
                if (String(activeSid) !== String(currentSubmissionId)) return;

                if (data && data.recommendations) {
                    updateReviewerProgress(100, 'Reviewer matching complete! Rendering ranked candidates...');
                    setTimeout(function() {
                        var badge = document.getElementById('sfReviewerBadge');
                        var cacheTag = document.getElementById('sfReviewerCacheTag');
                        if (badge) {
                            badge.textContent = 'MATCHED (' + (data.recommendations.length || 0) + ' CANDIDATES)';
                            badge.style.background = '#dcfce7';
                            badge.style.color = '#15803d';
                            badge.style.borderColor = '#86efac';
                        }
                        if (cacheTag) {
                            if (data.cached) {
                                cacheTag.textContent = '⚡ Cached (Instant)';
                                cacheTag.style.background = '#dcfce7';
                                cacheTag.style.color = '#059669';
                                cacheTag.style.display = 'inline-block';
                            } else {
                                cacheTag.textContent = '🤖 Fresh AI Evaluation Generated';
                                cacheTag.style.background = '#eef2ff';
                                cacheTag.style.color = '#4338ca';
                                cacheTag.style.display = 'inline-block';
                            }
                        }
                        showReviewers(data.recommendations);
                    }, 350);
                } else if (data && data.error) {
                    showReviewerError(data.error);
                }
            })
            .catch(function (err) {
                if (window.__sfReviewerProgressTimer) {
                    clearInterval(window.__sfReviewerProgressTimer);
                    window.__sfReviewerProgressTimer = null;
                }
                if (String(activeSid) !== String(currentSubmissionId)) return;
                showReviewerError('Error: ' + err.message);
            });
    }

    function showReviewers(recs) {
        var container = document.getElementById('sfReviewers');
        if (!container) return;

        if (recs.length === 0) {
            container.innerHTML = '<div style="color:#64748b;text-align:center;padding:30px;">No reviewers matched.</div>';
            return;
        }

        var html = '<div style="font-size:13px;color:#64748b;margin:0 0 16px;font-weight:600">Candidates ranked by semantic topical compatibility &amp; declared interests:</div>';

        for (var i = 0; i < recs.length; i++) {
            var rec = recs[i];
            var score = rec.score || 0;
            var badgeBg = score >= 80 ? '#ecfdf5' : (score >= 50 ? '#fffbeb' : '#fef2f2');
            var badgeColor = score >= 80 ? '#047857' : (score >= 50 ? '#b45309' : '#b91c1c');
            var badgeBorder = score >= 80 ? '#a7f3d0' : (score >= 50 ? '#fde68a' : '#fecaca');

            var isReleased = releasedReviewersMap[rec.id];
            var actionBtn = '';
            if (isReleased) {
                actionBtn = '<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1">⛔ Released</span>';
            } else if (currentUserInfo && currentUserInfo.isEditor) {
                var safeName = esc(rec.name).replace(/'/g, "\\'");
                actionBtn = '<button type="button" onclick="window.__sfOpenReleaseReviewerModal(\'' + safeName + '\', ' + rec.id + ')" style="background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px">⛔ Release</button>';
            }

            var safeNameAssign = esc(rec.name).replace(/'/g, "\\'");
            var assignBtn = '<button type="button" onclick="window.__sfAssignReviewerInOJS(\'' + safeNameAssign + '\')" title="Assign this reviewer directly in OJS" style="background:#4f46e5;border:none;color:#ffffff;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;box-shadow:0 1px 3px rgba(79,70,229,0.3)">Assign in OJS &rarr;</button>';

            html += [
                '<div style="background:#ffffff;border:1px solid #e2e8f0;',
                'border-radius:12px;padding:18px;margin-bottom:14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 2px 6px rgba(0,0,0,.03)">',
                  '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">',
                    '<div style="display:flex;align-items:center;gap:12px">',
                      '<div style="width:32px;height:32px;border-radius:50%;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">',
                        rec.name.charAt(0).toUpperCase(),
                      '</div>',
                      '<span style="font-weight:700;font-size:15px;color:#0f172a">' + esc(rec.name) + '</span>',
                    '</div>',
                    '<div style="display:flex;align-items:center;gap:8px">',
                      '<span style="font-size:12px;font-weight:800;padding:4px 12px;border-radius:20px;border:1px solid ' + badgeBorder + ';background:' + badgeBg + ';color:' + badgeColor + '">' + score + '% Match</span>',
                      assignBtn,
                      actionBtn,
                    '</div>',
                  '</div>',
                  '<div style="font-size:13px;color:#475569"><strong style="color:#4f46e5">Declared Expertise:</strong> ' + esc(rec.interests || 'None declared') + '</div>',
                  '<div style="font-size:13px;color:#334155;line-height:1.6;background:#f8fafc;padding:10px 14px;border-radius:8px;border-left:3px solid #4f46e5">' + esc(rec.reason) + '</div>',
                '</div>'
            ].join('');
        }

        container.innerHTML = html;
    }

    function showReviewerError(msg) {
        var badge = document.getElementById('sfReviewerBadge');
        if (badge) {
            badge.textContent = 'ERROR';
            badge.style.background = '#fee2e2';
            badge.style.color = '#b91c1c';
            badge.style.borderColor = '#fca5a5';
        }
        var container = document.getElementById('sfReviewers');
        if (container) {
            container.innerHTML = [
                '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:24px;color:#991b1b;max-width:540px;margin:30px auto;text-align:center">',
                '  <div style="font-size:32px;margin-bottom:8px">👥</div>',
                '  <div style="font-weight:800;font-size:15px;margin-bottom:6px">Reviewer Matchmaking Notice</div>',
                '  <div style="font-size:13px;color:#b91c1c;margin-bottom:16px;line-height:1.5">' + esc(msg) + '</div>',
                '  <button onclick="__sfOpenPaperPickerModal()" style="background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(79,70,229,0.3)">📚 Select an Active Paper</button>',
                '</div>'
            ].join('\n');
        }
    }



    function showReport(md) {
        var up = md.toUpperCase();
        if (up.indexOf('PROCEED TO PEER REVIEW') !== -1 || up.indexOf('ACCEPT FOR PEER REVIEW') !== -1) {
            setBadge('PROCEED TO PEER REVIEW', '#dcfce7', '#15803d', '#86efac');
        } else if (up.indexOf('DESK REJECT') !== -1) {
            setBadge('DESK REJECT', '#fee2e2', '#b91c1c', '#fca5a5');
        } else {
            setBadge('REVISIONS REQUIRED', '#fef3c7', '#b45309', '#fde68a');
        }
        var report = document.getElementById('sfReport');
        if (report) report.innerHTML = mdToHtml(md);
    }

    function showError(msg) {
        setBadge('ERROR', '#fee2e2', '#b91c1c', '#fca5a5');
        var report = document.getElementById('sfReport');
        if (report) {
            report.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;color:#b91c1c"><strong>Analysis Failed:</strong> ' + esc(msg) + '</div>';
        }
    }

    // ── Comment Tabs Filtering ─────────────────────────────────────────────
    window.__sfFilterCommentsTab = function (tab) {
        currentCommentFilter = tab;
        var tabs = ['editor', 'reviewer_to_editor', 'reviewer'];
        tabs.forEach(function (t) {
            var b = document.getElementById('sfCommentTab-' + t);
            if (b) {
                if (t === tab) {
                    b.style.background = '#ffffff';
                    b.style.color = '#4f46e5';
                    b.style.fontWeight = '700';
                    b.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
                } else {
                    b.style.background = 'none';
                    b.style.color = '#64748b';
                    b.style.fontWeight = '600';
                    b.style.boxShadow = 'none';
                }
            }
        });

        var subWrap = document.getElementById('sfReviewerSubFilterWrap');
        if (subWrap) {
            subWrap.style.display = (tab === 'reviewer') ? 'block' : 'none';
        }

        renderAnnotationsList(cachedAnnotations);
    };

    window.__sfOnReviewerSubFilterChange = function () {
        var sel = document.getElementById('sfReviewerSubFilter');
        currentReviewerSubFilter = sel ? sel.value : '';
        renderAnnotationsList(cachedAnnotations);
    };

    // ── Send Comments to Author Separately ─────────────────────────────────
    window.__sfOpenSendToAuthorModal = function (preselectReviewer) {
        var modal = document.getElementById('sfSendToAuthorModal');
        if (!modal) return;
        modal.style.display = 'flex';

        var sourceSel = document.getElementById('sfSendAuthorSourceSelect');
        if (sourceSel) {
            sourceSel.innerHTML = '';
            var reviewerMap = {};
            var hasEditorComments = false;
            cachedAnnotations.forEach(function (a) {
                // Strictly exclude confidential editor-only notes from author transmission
                if (a.confidential_to_editor) return;

                if (a.user_role === 'Editor') {
                    hasEditorComments = true;
                } else if (a.user_name) {
                    reviewerMap[a.user_name] = true;
                }
            });

            var revList = Object.keys(reviewerMap).sort();
            revList.forEach(function (rName, idx) {
                var opt = document.createElement('option');
                opt.value = rName;
                opt.textContent = 'Reviewer ' + (idx + 1) + ' (' + rName + ')';
                if (preselectReviewer && preselectReviewer === rName) {
                    opt.selected = true;
                }
                sourceSel.appendChild(opt);
            });

            if (hasEditorComments) {
                var edOpt = document.createElement('option');
                edOpt.value = '__editor__';
                edOpt.textContent = 'Journal Editorial Comments';
                sourceSel.appendChild(edOpt);
            }

            if (revList.length === 0 && !hasEditorComments) {
                var emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = 'No comments available to send';
                sourceSel.appendChild(emptyOpt);
            }
        }

        __sfUpdateSendAuthorLetter();
    };

    window.__sfCloseSendToAuthorModal = function () {
        var modal = document.getElementById('sfSendToAuthorModal');
        if (modal) modal.style.display = 'none';
        var status = document.getElementById('sfSendAuthorFeedbackStatus');
        if (status) status.style.display = 'none';
    };

    window.__sfUpdateSendAuthorLetter = function () {
        var sourceSel = document.getElementById('sfSendAuthorSourceSelect');
        var anonCheckbox = document.getElementById('sfSendAuthorAnonymize');
        var letterText = document.getElementById('sfSendAuthorLetterText');
        if (!sourceSel || !letterText) return;

        var selectedVal = sourceSel.value;
        var anonymize = anonCheckbox ? anonCheckbox.checked : true;

        if (!selectedVal) {
            letterText.value = 'No reviewer or editor comments available to compile.';
            return;
        }

        var targetComments = [];
        var sourceLabel = '';

        if (selectedVal === '__editor__') {
            sourceLabel = 'JOURNAL EDITORIAL OFFICE';
            targetComments = cachedAnnotations.filter(function (a) { return a.user_role === 'Editor' && !a.confidential_to_editor; });
        } else {
            var reviewerMap = {};
            cachedAnnotations.forEach(function (a) {
                if (a.user_role !== 'Editor' && a.user_name && !a.confidential_to_editor) reviewerMap[a.user_name] = true;
            });
            var revList = Object.keys(reviewerMap).sort();
            var revIdx = revList.indexOf(selectedVal) + 1;
            sourceLabel = anonymize ? ('REVIEWER ' + (revIdx > 0 ? revIdx : 1)) : selectedVal.toUpperCase();
            targetComments = cachedAnnotations.filter(function (a) { return a.user_name === selectedVal && !a.confidential_to_editor; });
        }

        var paperTitle = 'Current Manuscript';
        var selPaper = cachedSubmissionsList.find(function (p) { return String(p.id) === String(currentSubmissionId); });
        if (selPaper && selPaper.title) {
            paperTitle = selPaper.title;
        }

        var lines = [];
        lines.push('Dear Author(s),');
        lines.push('');
        lines.push('Please review the detailed feedback and inline markups below regarding your submission:');
        lines.push('Title: "' + paperTitle + '" (Submission #' + currentSubmissionId + ')');
        lines.push('');
        lines.push('======================================================================');
        lines.push('  FEEDBACK FROM: ' + sourceLabel);
        lines.push('======================================================================');
        lines.push('');

        if (targetComments.length === 0) {
            lines.push('No markups recorded for this reviewer.');
        } else {
            targetComments.forEach(function (c, idx) {
                lines.push((idx + 1) + '. Manuscript Excerpt:');
                lines.push('   "' + (c.selected_text || '(General comment)') + '"');
                lines.push('   Reviewer Note:');
                lines.push('   ' + c.comment);
                lines.push('');
            });
        }

        lines.push('----------------------------------------------------------------------');
        lines.push('Instructions for Revision:');
        lines.push('Please provide a point-by-point response letter detailing how each of');
        lines.push('the remarks above was addressed in your revised manuscript draft.');
        lines.push('');
        lines.push('Sincerely,');
        lines.push((currentUserInfo && currentUserInfo.name) ? currentUserInfo.name : 'Journal Editorial Office');
        lines.push('Editorial Board');

        letterText.value = lines.join('\n');
    };

    window.__sfCopyAuthorLetter = function () {
        var letterText = document.getElementById('sfSendAuthorLetterText');
        var status = document.getElementById('sfSendAuthorFeedbackStatus');
        if (!letterText) return;
        navigator.clipboard.writeText(letterText.value).then(function () {
            if (status) {
                status.style.display = 'block';
                setTimeout(function () { status.style.display = 'none'; }, 4000);
            }
        });
    };

    window.__sfDownloadAuthorLetter = function () {
        var letterText = document.getElementById('sfSendAuthorLetterText');
        if (!letterText) return;
        var blob = new Blob([letterText.value], { type: 'text/plain;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Author_Feedback_Submission_' + (currentSubmissionId || '1') + '.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // ── Re-Run Confirmation Modal ──────────────────────────────────────────
    function openReRunConfirmModal() {
        var modal = document.getElementById('sfReRunConfirmModal');
        if (!modal) return;
        modal.style.display = 'flex';

        var scopeSec = document.getElementById('sfReRunScopeSection');
        if (!scopeSec) return;

        var isEditor = currentUserInfo && currentUserInfo.isEditor;
        if (isEditor) {
            scopeSec.innerHTML = [
                '<div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:8px">Select Analysis Scope:</div>',
                '<label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#334155;cursor:pointer;margin-bottom:8px;background:#f8fafc;padding:10px 12px;border-radius:8px;border:1px solid #e2e8f0">',
                  '<input type="radio" name="sfReRunScope" value="global" checked style="margin-top:2px" />',
                  '<div>',
                    '<strong>🌐 Update for all reviewers &amp; journal baseline (Recommended)</strong>',
                    '<div style="font-size:11px;color:#64748b;margin-top:2px">Refreshes the shared official report visible to editors and assigned reviewers.</div>',
                  '</div>',
                '</label>',
                '<label style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#334155;cursor:pointer;background:#f8fafc;padding:10px 12px;border-radius:8px;border:1px solid #e2e8f0">',
                  '<input type="radio" name="sfReRunScope" value="editor_private" style="margin-top:2px" />',
                  '<div>',
                    '<strong>🔒 Keep changes to myself only (Private Editor Draft)</strong>',
                    '<div style="font-size:11px;color:#64748b;margin-top:2px">Saves a private evaluation view for your account without altering the baseline reviewers see.</div>',
                  '</div>',
                '</label>'
            ].join('');
        } else {
            scopeSec.innerHTML = [
                '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px;color:#1e40af;font-size:12px;line-height:1.5">',
                  '<strong>👤 Private Reviewer Evaluation:</strong> As a reviewer, this re-run will update <strong>only your personal view</strong>. It will not alter the editor\'s report or other reviewers\' analysis.',
                '</div>'
            ].join('');
        }
    }

    window.__sfCloseReRunModal = function () {
        var modal = document.getElementById('sfReRunConfirmModal');
        if (modal) modal.style.display = 'none';
    };

    window.__sfConfirmReRunAnalysis = function () {
        var modal = document.getElementById('sfReRunConfirmModal');
        if (modal) modal.style.display = 'none';

        var scope = 'global';
        var isEditor = currentUserInfo && currentUserInfo.isEditor;
        if (isEditor) {
            var checked = document.querySelector('input[name="sfReRunScope"]:checked');
            if (checked) scope = checked.value;
        } else {
            scope = 'reviewer_private';
        }

        runAnalysis(currentSubmissionId || '1', true, scope);
    };

    // ── Release Reviewer / Quota Reached Modal ─────────────────────────────
    var currentReleaseReviewer = null;

    window.__sfOpenReleaseReviewerModal = function (reviewerName, reviewerId) {
        currentReleaseReviewer = { name: reviewerName, id: reviewerId };
        var modal = document.getElementById('sfReleaseReviewerModal');
        if (!modal) return;
        modal.style.display = 'flex';

        var subEl = document.getElementById('sfReleaseReviewerSub');
        if (subEl) subEl.textContent = 'Notify ' + reviewerName + ' that peer review is no longer needed';

        var statusMsg = document.getElementById('sfReleaseStatusMsg');
        if (statusMsg) statusMsg.style.display = 'none';

        var paperTitle = 'Current Manuscript';
        var selPaper = cachedSubmissionsList.find(function (p) { return String(p.id) === String(currentSubmissionId); });
        if (selPaper && selPaper.title) {
            paperTitle = selPaper.title;
        }

        var letter = document.getElementById('sfReleaseReviewerLetter');
        if (letter) {
            letter.value = [
                'Dear Dr. ' + reviewerName + ',',
                '',
                'Thank you very much for kindly accepting our peer review invitation for the manuscript entitled "' + paperTitle + '" (Submission #' + currentSubmissionId + ').',
                '',
                'We are writing to let you know that we have already obtained the required quota of peer reviews for this submission stage, and the editorial decision is now being formulated. Therefore, you do not need to proceed with your review of this paper.',
                '',
                'We deeply appreciate your willingness to support the journal and look forward to collaborating with you on upcoming submissions in your field of expertise.',
                '',
                'Warm regards,',
                (currentUserInfo && currentUserInfo.name ? currentUserInfo.name : 'Journal Editorial Office'),
                'Editorial Board'
            ].join('\n');
        }
    };

    window.__sfCloseReleaseReviewerModal = function () {
        var modal = document.getElementById('sfReleaseReviewerModal');
        if (modal) modal.style.display = 'none';
        currentReleaseReviewer = null;
    };

    window.__sfCopyReleaseLetter = function () {
        var letter = document.getElementById('sfReleaseReviewerLetter');
        var statusMsg = document.getElementById('sfReleaseStatusMsg');
        if (!letter) return;
        navigator.clipboard.writeText(letter.value).then(function () {
            if (statusMsg) {
                statusMsg.textContent = '✅ Email draft copied to clipboard!';
                statusMsg.style.display = 'block';
                setTimeout(function () { statusMsg.style.display = 'none'; }, 4000);
            }
        });
    };

    window.__sfConfirmReleaseReviewer = function () {
        if (!currentReleaseReviewer) return;
        releasedReviewersMap[currentReleaseReviewer.id] = true;

        var statusMsg = document.getElementById('sfReleaseStatusMsg');
        if (statusMsg) {
            statusMsg.textContent = '✅ Notification copied & ' + currentReleaseReviewer.name + ' marked as Released (Quota Reached)!';
            statusMsg.style.display = 'block';
        }

        var letter = document.getElementById('sfReleaseReviewerLetter');
        if (letter) {
            navigator.clipboard.writeText(letter.value);
        }

        // Re-render reviewers list to show released badge
        var sid = currentSubmissionId || '1';
        runReviewerRecommendations(sid);

        setTimeout(function () {
            __sfCloseReleaseReviewerModal();
        }, 1500);
    };

    function setBadge(text, bg, color, border) {
        var badge = document.getElementById('sfBadge');
        if (!badge) return;
        badge.textContent = text;
        badge.style.cssText = [
            'display:inline-block', 'padding:6px 14px', 'border-radius:8px',
            'font-size:12px', 'font-weight:800',
            'background:' + (bg || '#f1f5f9'),
            'color:' + (color || '#475569'),
            'border:1px solid ' + (border || '#cbd5e1')
        ].join(';');
    }

    function mdToHtml(md) {
        return '<p>' + md
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/^### (.+)$/gm, '<h3 style="color:#0f172a;font-size:16px;font-weight:800;margin:1.4em 0 .5em;border-bottom:2px solid #f1f5f9;padding-bottom:6px">$1</h3>')
            .replace(/^## (.+)$/gm, '<h2 style="color:#0f172a;font-size:18px;font-weight:800;margin:1.6em 0 .6em;border-bottom:2px solid #e2e8f0;padding-bottom:8px">$1</h2>')
            .replace(/^# (.+)$/gm, '<h1 style="color:#0f172a;font-size:22px;font-weight:800;margin:1.6em 0 .8em">$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f172a;font-weight:700">$1</strong>')
            .replace(/\*(.+?)\*/g, '<em style="color:#475569;font-style:italic">$1</em>')
            .replace(/^> (.+)$/gm, '<blockquote style="border-left:4px solid #4f46e5;padding:10px 18px;margin:12px 0;background:#f5f3ff;border-radius:0 8px 8px 0;color:#334155;font-style:italic">$1</blockquote>')
            .replace(/^[-*] (.+)$/gm, '<li style="margin:6px 0;color:#334155;font-size:14px">$1</li>')
            .replace(/(<li[\s\S]*?<\/li>)/g, '<ul style="padding-left:24px;margin:.6em 0">$1</ul>')
            .replace(/\n{2,}/g, '</p><p style="margin:.8em 0;color:#334155">')
            .replace(/\n/g, '<br>')
            + '</p>';
    }

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escapeHtml(s) {
        return esc(s);
    }

})();
