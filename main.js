document.addEventListener('DOMContentLoaded', () => {
    const runtimeFlags = window.SKCT_FLAGS || {};
    const isAdminPreviewMode = runtimeFlags.adminPreview === true;
    const urlSearchParams = new URLSearchParams(window.location.search);
    const isPopupMode = window.name === 'skct_popup_mode' || urlSearchParams.get('popup') === 'advanced';
    const isPopupEditorMode = isPopupMode && isAdminPreviewMode && runtimeFlags.popupEditor === true;
    const analyticsState = {
        practiceStarted: false
    };
    const ADVANCED_LICENSE_STORAGE_KEY = 'skct_advanced_license_bundle';
    const ADVANCED_PASSWORD_FAIL_STORAGE_KEY = 'skct_advanced_password_failures';
    const ADVANCED_FAIL_WINDOW_MS = 1000 * 60 * 10;
    const ADVANCED_MAX_FAIL_COUNT = 5;
    const ADVANCED_FAIL_COOLDOWN_MS = 1000 * 30;
    const ADVANCED_RAIL_COLLAPSED_STORAGE_KEY = 'skct_advanced_rail_collapsed';
    const ADVANCED_ARCHIVE_LAUNCH_STORAGE_KEY = 'skct_archive_launch';
    const ADVANCED_EXPORT_IDENTITY_STORAGE_KEY = 'skct_export_identity_included';
    const advancedModeRequested = runtimeFlags.advancedRequested === true;
    let verifiedAdvancedLicenseBundle = null;
    let pendingAdvancedActivationBundle = null;
    const readJsonStorage = (storage, key) => {
        try {
            return JSON.parse(storage.getItem(key) || 'null');
        } catch (error) {
            return null;
        }
    };
    const TOOL_UI_STORAGE_KEY = 'skct_practice_tool_ui';
    const LEGACY_TOOL_UI_STORAGE_KEYS = ['skct_tool_ui'];
    const readToolUiConfigFromStorage = () => {
        try {
            let raw = localStorage.getItem(TOOL_UI_STORAGE_KEY);
            if (!raw) {
                for (const legacyKey of LEGACY_TOOL_UI_STORAGE_KEYS) {
                    raw = localStorage.getItem(legacyKey);
                    if (raw) {
                        localStorage.setItem(TOOL_UI_STORAGE_KEY, raw);
                        break;
                    }
                }
            }
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    };
    const writeJsonStorage = (storage, key, value) => {
        storage.setItem(key, JSON.stringify(value));
    };
    const readStoredAdvancedLicenseBundle = () => {
        try {
            return JSON.parse(localStorage.getItem(ADVANCED_LICENSE_STORAGE_KEY) || 'null');
        } catch (error) {
            return null;
        }
    };
    const trackAnalyticsEvent = (eventName, params = {}) => {
        if (!eventName || typeof window.gtag !== 'function') return;
        try {
            window.gtag('event', eventName, {
                page_path: window.location.pathname,
                ...params
            });
        } catch (error) {
            // Analytics 오류는 사용자 기능을 막지 않는다.
        }
    };
    const writeStoredAdvancedLicenseBundle = (bundle) => {
        if (!bundle) {
            localStorage.removeItem(ADVANCED_LICENSE_STORAGE_KEY);
            return;
        }
        localStorage.setItem(ADVANCED_LICENSE_STORAGE_KEY, JSON.stringify(bundle));
    };
    const clearStoredAdvancedLicenseBundle = () => {
        verifiedAdvancedLicenseBundle = null;
        pendingAdvancedActivationBundle = null;
        localStorage.removeItem(ADVANCED_LICENSE_STORAGE_KEY);
    };
    const readAdvancedFailState = () => {
        return readJsonStorage(sessionStorage, ADVANCED_PASSWORD_FAIL_STORAGE_KEY);
    };
    const writeAdvancedFailState = (state) => {
        writeJsonStorage(sessionStorage, ADVANCED_PASSWORD_FAIL_STORAGE_KEY, state);
    };
    const resetAdvancedFailState = () => {
        sessionStorage.removeItem(ADVANCED_PASSWORD_FAIL_STORAGE_KEY);
    };
    const getAdvancedCooldownRemainingMs = () => {
        const state = readAdvancedFailState();
        if (!state || !Number.isFinite(state.lockedUntil)) return 0;
        return Math.max(0, state.lockedUntil - Date.now());
    };
    const registerAdvancedPasswordFailure = () => {
        const now = Date.now();
        const current = readAdvancedFailState();
        const attempts = Array.isArray(current?.attempts)
            ? current.attempts.filter((value) => Number.isFinite(value) && now - value <= ADVANCED_FAIL_WINDOW_MS)
            : [];
        attempts.push(now);
        const nextState = { attempts };
        if (attempts.length >= ADVANCED_MAX_FAIL_COUNT) {
            nextState.lockedUntil = now + ADVANCED_FAIL_COOLDOWN_MS;
        }
        writeAdvancedFailState(nextState);
        return nextState;
    };
    const removeAdvancedQueryParam = () => {
        const url = new URL(window.location.href);
        if (!url.searchParams.has('advanced')) return;
        url.searchParams.delete('advanced');
        window.history.replaceState({}, '', url.toString());
    };
    let isAdvancedMode = false;
    const DEFAULT_LAYOUT_RATIOS = { timer: 8.6, utils: 45.0, calc: 46.4 };
    const DEFAULT_POPUP_LAYOUT = {
        window: { widthRatio: 0.305, heightRatio: 0.98, leftRatio: 0.695, topRatio: 0 },
        omrWidthRatio: 0.21
    };
    const DEFAULT_TOOL_UI_CONFIG = { bottomPaddingRatio: 0.11, sideButtonColumnRatio: 0.09, noteFontSize: 12, canvasLineWidth: 2 };
    const BUILD_INFO = window.SKCTBuildInfo || {
        updatedAt: '2026-04-11 22:08:00 +09:00',
        version: 'v2026.04.11.2208',
        assetVersion: '202604112208'
    };
    const ADVANCED_SUBSCRIPTION_PLAN_OPTIONS = ['3일 이용권', '7일 이용권', '14일 이용권', '1달 이용권', '1년 이용권', '영구이용권'];
    const DEFAULT_ADVANCED_PLAN_TYPE = '1달 이용권';
    const PERMANENT_ADVANCED_PLAN_TYPE = '영구이용권';
    const MANUAL_SUBSCRIPTION_REQUEST_STORAGE_KEY = 'skct_manual_subscription_recent_request';
    const MANUAL_DONATION_DRAFT_STORAGE_KEY = 'skct_manual_donation_flow_draft';
    const ADVANCED_STUDY_SESSION_QUEUE_KEY = 'skct_advanced_study_session_queue';
    const MANUAL_DONATION_DRAFT_RESTORE_MS = 1000 * 60 * 60 * 2;
    const DEFAULT_ADVANCED_FEATURE_CONFIG = {
        subscriptions: []
    };
    const DEFAULT_MANUAL_SUBSCRIPTION_CONFIG = {
        enabled: true,
        donationUrl: 'https://toon.at/donate/foreveryonehappy',
        supportEmail: 'zhdlsqpdj@gmail.com',
        secureApiBaseUrl: 'https://us-central1-skct-tool.cloudfunctions.net/skctSecureApi',
        approvalApiBaseUrl: '',
        adminPublicKeyPem: '',
        licensePublicKeyPem: '',
        plans: [
            { code: 'manual-3d', label: '3일 이용권', days: 3, price: 3000, enabled: true, highlight: '시험 직전 3일 압축 대비용' },
            { code: 'manual-7d', label: '7일 이용권', days: 7, price: 6000, enabled: true, highlight: '일주일 집중 대비용' },
            { code: 'manual-14d', label: '14일 이용권', days: 14, price: 9900, enabled: true, highlight: '7일권 2회보다 2,100원 절약' },
            { code: 'manual-30d', label: '30일 이용권', days: 30, price: 17900, enabled: true, highlight: '14일권 2회보다 1,900원 절약' }
        ]
    };
    const POPUP_EDITOR_MESSAGE_TYPES = {
        preview: 'skct-popup-layout-preview',
        saveRequest: 'skct-popup-layout-save-request',
        saveResult: 'skct-popup-layout-save-result'
    };
    const appContainerEl = document.querySelector('.app-container');
    const mainContentEl = document.querySelector('.main-content');
    const topBarEl = document.querySelector('.top-bar');
    const siteOverviewEl = document.getElementById('siteOverview');
    const siteOverviewTitle = document.getElementById('siteOverviewTitle');
    const practiceWorkspaceTitle = document.getElementById('practiceWorkspaceTitle');
    const enterPracticeBtn = document.getElementById('enterPracticeBtn');
    const returnToIntroBtn = document.getElementById('returnToIntroBtn');
    const utilityToggle = document.getElementById('utilityToggle');
    const utilityModal = document.getElementById('utilityModal');
    const utilityModalDescription = document.getElementById('utilityModalDescription');
    const studyArchiveOpenBtn = document.getElementById('studyArchiveOpenBtn');
    const extensionInfoLink = document.getElementById('extensionInfoLink');
    const archiveFrameModal = document.getElementById('archiveFrameModal');
    const archiveFrame = document.getElementById('archiveFrame');
    const archiveFramePopoutBtn = document.getElementById('archiveFramePopoutBtn');
    const extensionFrameModal = document.getElementById('extensionFrameModal');
    const extensionFrame = document.getElementById('extensionFrame');
    const extensionFramePopoutBtn = document.getElementById('extensionFramePopoutBtn');
    let latestArchiveFrameUrl = '';
    let latestExtensionFrameUrl = '';
    const advancedStatusToggle = document.getElementById('advancedStatusToggle');
    const utilityArchiveDescription = document.getElementById('utilityArchiveDescription');
    const utilitySectionEl = document.querySelector('.utility-section');
    const calculatorSectionEl = document.querySelector('.calculator-section');
    const topBarResizerEl = document.getElementById('topBarResizer');
    const toolsSectionResizerEl = document.getElementById('toolsSectionResizer');
    const popupEditorPanelEl = document.getElementById('popupEditorPanel');
    const popupEditorMetricsEl = document.getElementById('popupEditorMetrics');
    const popupEditorStatusEl = document.getElementById('popupEditorStatus');
    const popupEditorToggleBtn = document.getElementById('popupEditorToggleBtn');
    const popupEditorReloadBtn = document.getElementById('popupEditorReloadBtn');
    const popupEditorSaveBtn = document.getElementById('popupEditorSaveBtn');
    const popupBottomPaddingRange = document.getElementById('popupBottomPaddingRange');
    const popupBottomPaddingValue = document.getElementById('popupBottomPaddingValue');
    const popupSideColumnRange = document.getElementById('popupSideColumnRange');
    const popupSideColumnValue = document.getElementById('popupSideColumnValue');
    const ratioTimer = document.getElementById('ratioTimer');
    const ratioUtils = document.getElementById('ratioUtils');
    const ratioCalc = document.getElementById('ratioCalc');
    const noteFontSizeRange = document.getElementById('noteFontSizeRange');
    const noteFontSizeValue = document.getElementById('noteFontSizeValue');
    const canvasLineWidthRange = document.getElementById('canvasLineWidthRange');
    const canvasLineWidthValue = document.getElementById('canvasLineWidthValue');
    const advancedGuideToggle = document.getElementById('advancedGuideToggle');
    const advancedGuideModal = document.getElementById('advancedGuideModal');
    const advancedAccessSummary = document.getElementById('advancedGuideLoginBody');
    const advancedAccessIdInput = document.getElementById('advancedAccessIdInput');
    const advancedAccessPasswordInput = document.getElementById('advancedAccessPasswordInput');
    const advancedAccessSubmitBtn = document.getElementById('advancedAccessSubmitBtn');
    const advancedAccessStatus = document.getElementById('advancedAccessStatus');
    const manualSubscriptionDonateLink = document.getElementById('manualSubscriptionDonateLink');
    const manualSubscriptionPlanCards = document.getElementById('manualSubscriptionPlanCards');
    const manualSubscriptionPlanSelect = document.getElementById('manualSubscriptionPlanSelect');
    const manualSubscriptionEmailInput = document.getElementById('manualSubscriptionEmailInput');
    const manualSubscriptionStartDateInput = document.getElementById('manualSubscriptionStartDateInput');
    const manualSubscriptionPasswordInput = document.getElementById('manualSubscriptionPasswordInput');
    const manualSubscriptionPasswordConfirmInput = document.getElementById('manualSubscriptionPasswordConfirmInput');
    const manualDonationFlowPanel = document.getElementById('manualDonationFlowPanel');
    const manualDonationFlowBadge = document.getElementById('manualDonationFlowBadge');
    const manualDonationMemoText = document.getElementById('manualDonationMemoText');
    const manualDonationMemoCopyBtn = document.getElementById('manualDonationMemoCopyBtn');
    const manualDonationStepStatus = document.getElementById('manualDonationStepStatus');
    const manualSubscriptionSubmitBtn = document.getElementById('manualSubscriptionSubmitBtn');
    const manualSubscriptionSubmitStatus = document.getElementById('manualSubscriptionSubmitStatus');
    const manualSubscriptionLookupIdInput = document.getElementById('manualSubscriptionLookupIdInput');
    const manualSubscriptionLookupPasswordInput = document.getElementById('manualSubscriptionLookupPasswordInput');
    const manualSubscriptionLookupBtn = document.getElementById('manualSubscriptionLookupBtn');
    const manualSubscriptionLookupResult = document.getElementById('manualSubscriptionLookupResult');
    const advancedToggle = document.getElementById('advancedToggle');
    const advancedFeatureModal = document.getElementById('advancedFeatureModal');
    const advancedRecordControls = document.getElementById('advancedRecordControls');
    const advancedRecordDateTimeInput = document.getElementById('advancedRecordDateTime');
    const advancedRecordMaterialSelect = document.getElementById('advancedRecordMaterial');
    const advancedRecordRoundSelect = document.getElementById('advancedRecordRound');
    const advancedStatsDownloadBtn = document.getElementById('advancedStatsDownloadBtn');
    const advancedStatsCsvBtn = document.getElementById('advancedStatsCsvBtn');
    const advancedStatsCsvImportBtn = document.getElementById('advancedStatsCsvImportBtn');
    const advancedStatsServerBtn = document.getElementById('advancedStatsServerBtn');
    const advancedStatsCsvServerBtn = document.getElementById('advancedStatsCsvServerBtn');
    const advancedStatsCsvImportServerBtn = document.getElementById('advancedStatsCsvImportServerBtn');
    const advancedStatsCsvFileInput = document.getElementById('advancedStatsCsvFileInput');
    const advancedArchiveOpenBtn = document.getElementById('advancedArchiveOpenBtn');
    const advancedSaveSummary = document.getElementById('advancedSaveSummary');
    const advancedSaveSessionBtn = document.getElementById('advancedSaveSessionBtn');
    const advancedSaveSessionStatus = document.getElementById('advancedSaveSessionStatus');
    const advancedToolsStatus = document.getElementById('advancedToolsStatus');
    const advancedFeatureManualFlowBtn = document.getElementById('advancedFeatureManualFlowBtn');
    const advancedFeatureDonateLink = document.getElementById('advancedFeatureDonateLink');
    const advancedRailCollapseBtn = document.getElementById('advancedRailCollapseBtn');
    const advancedRailRestoreBtn = document.getElementById('advancedRailRestoreBtn');
    const settingsUpdatedAt = document.getElementById('settingsUpdatedAt');
    const settingsVersionRow = document.getElementById('settingsVersionRow');
    const advancedModeStatusTitle = document.getElementById('advancedModeStatusTitle');
    const advancedModeStatusLead = document.getElementById('advancedModeStatusLead');
    const advancedModeLabelState = document.getElementById('advancedModeLabelState');
    const advancedModeValueState = document.getElementById('advancedModeValueState');
    const advancedModeLabelLogin = document.getElementById('advancedModeLabelLogin');
    const advancedModeValueLogin = document.getElementById('advancedModeValueLogin');
    const advancedModeLabelExpiry = document.getElementById('advancedModeLabelExpiry');
    const advancedModeValueExpiry = document.getElementById('advancedModeValueExpiry');
    const advancedModeLabelArchive = document.getElementById('advancedModeLabelArchive');
    const advancedModeValueArchive = document.getElementById('advancedModeValueArchive');
    const advancedModeLabelRail = document.getElementById('advancedModeLabelRail');
    const advancedModeValueRail = document.getElementById('advancedModeValueRail');
    const advancedModeStatusFootnote = document.getElementById('advancedModeStatusFootnote');
    const advancedModeGuideBtn = document.getElementById('advancedModeGuideBtn');
    const advancedModeArchiveBtn = document.getElementById('advancedModeArchiveBtn');
    const detailStatsPopoutBtn = document.getElementById('detailStatsPopoutBtn');
    const advancedCoachTitle = document.getElementById('advancedCoachTitle');
    const advancedCoachLead = document.getElementById('advancedCoachLead');
    const advancedCoachStep1 = document.getElementById('advancedCoachStep1');
    const advancedCoachStep2 = document.getElementById('advancedCoachStep2');
    const advancedCoachStep3 = document.getElementById('advancedCoachStep3');
    const advancedCoachHint = document.getElementById('advancedCoachHint');
    const advancedCoachGuideBtn = document.getElementById('advancedCoachGuideBtn');
    const quickInfoModal = document.getElementById('quickInfoModal');
    const quickInfoModalTitle = document.getElementById('quickInfoModalTitle');
    const quickInfoModalBody = document.getElementById('quickInfoModalBody');
    const helpAdvancedLinkBtn = document.getElementById('helpAdvancedLinkBtn');
    let popupLayoutSyncTimeout = null;
    let popupMoveWatcher = null;
    let lastPopupEditorSignature = '';
    let lastPopupWindowOnlySignature = '';
    let isAdvancedConfigReady = false;
    let remoteManualSubscriptionConfig = DEFAULT_MANUAL_SUBSCRIPTION_CONFIG;
    let manualSubscriptionSubmitInFlight = false;
    let manualApprovalPollingTimer = null;
    let manualDonationDraft = {
        requestId: '',
        signature: '',
        memo: '',
        copied: false,
        donateOpened: false,
        backendOrderCreated: false,
        secureRequestStored: false,
        polling: false,
        completed: false
    };

    document.body.classList.toggle('popup-mode', isPopupMode);
    document.body.classList.toggle('popup-editor-mode', isPopupEditorMode);
    const SITE_VIEW_STORAGE_KEY = 'skct_site_last_view_v1';

    function readStoredSiteView() {
        try {
            const value = localStorage.getItem(SITE_VIEW_STORAGE_KEY);
            return value === 'practice' || value === 'intro' ? value : '';
        } catch (error) {
            return '';
        }
    }

    function writeStoredSiteView(view) {
        try {
            localStorage.setItem(SITE_VIEW_STORAGE_KEY, view);
        } catch (error) {
            // Storage may be unavailable in private modes.
        }
    }

    function getRequestedSiteView() {
        if (isPopupMode || advancedModeRequested) return 'practice';
        const requested = urlSearchParams.get('view');
        if (requested === 'intro' || requested === 'practice') return requested;
        if (urlSearchParams.get('intro') === '0' || window.location.hash === '#practice-tool') return 'practice';
        return readStoredSiteView() || 'intro';
    }

    function buildSiteViewUrl(view) {
        const url = new URL(window.location.href);
        url.searchParams.delete('intro');
        url.searchParams.set('view', view);
        url.hash = '';
        return url;
    }

    function setSiteView(view, { historyMode = 'none', persist = false, focus = false, source = 'initial' } = {}) {
        const nextView = view === 'practice' ? 'practice' : 'intro';
        document.body.dataset.siteView = nextView;
        siteOverviewEl?.setAttribute('aria-hidden', String(nextView !== 'intro'));
        appContainerEl?.setAttribute('aria-hidden', String(nextView !== 'practice'));
        if (persist) writeStoredSiteView(nextView);
        if (historyMode === 'push') window.history.pushState({ siteView: nextView }, '', buildSiteViewUrl(nextView));
        if (historyMode === 'replace') window.history.replaceState({ siteView: nextView }, '', buildSiteViewUrl(nextView));
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        if (nextView === 'practice') {
            requestAnimationFrame(() => {
                window.dispatchEvent(new Event('resize'));
                if (focus) practiceWorkspaceTitle?.focus({ preventScroll: true });
            });
        } else if (focus) {
            requestAnimationFrame(() => siteOverviewTitle?.focus({ preventScroll: true }));
        }
        if (source !== 'initial' && source !== 'history') {
            trackAnalyticsEvent('site_view_change', { site_view: nextView, source });
        }
    }

    enterPracticeBtn?.addEventListener('click', () => {
        setSiteView('practice', { historyMode: 'push', persist: true, focus: true, source: 'landing_cta' });
    });
    returnToIntroBtn?.addEventListener('click', () => {
        setSiteView('intro', { historyMode: 'push', persist: true, focus: true, source: 'practice_intro_button' });
    });
    window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view') === 'practice' ? 'practice' : (params.get('view') === 'intro' ? 'intro' : getRequestedSiteView());
        setSiteView(view, { historyMode: 'none', persist: false, focus: true, source: 'history' });
    });
    setSiteView(getRequestedSiteView(), { historyMode: 'none', persist: false, focus: false, source: 'initial' });

    function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function roundRatio(value) {
        return Math.round(value * 1000) / 1000;
    }

    function getScreenMetrics() {
        const availWidth = screen.availWidth || screen.width || window.outerWidth || 1440;
        const availHeight = screen.availHeight || screen.height || window.outerHeight || 900;
        const availLeft = Number.isFinite(screen.availLeft) ? screen.availLeft : 0;
        const availTop = Number.isFinite(screen.availTop) ? screen.availTop : 0;
        return { availWidth, availHeight, availLeft, availTop };
    }

    function createLegacyPopupWindowDefaults() {
        return {
            widthRatio: DEFAULT_POPUP_LAYOUT.window.widthRatio,
            heightRatio: DEFAULT_POPUP_LAYOUT.window.heightRatio,
            leftRatio: DEFAULT_POPUP_LAYOUT.window.leftRatio,
            topRatio: DEFAULT_POPUP_LAYOUT.window.topRatio
        };
    }

    function normalizePopupLayout(raw) {
        const fallbackWindow = createLegacyPopupWindowDefaults();
        const sourceWindow = raw?.window || {};
        const widthRatio = parseFloat(sourceWindow.widthRatio);
        const heightRatio = parseFloat(sourceWindow.heightRatio);
        const safeWidthRatio = Number.isFinite(widthRatio) ? clampNumber(widthRatio, 0.18, 0.8) : fallbackWindow.widthRatio;
        const safeHeightRatio = Number.isFinite(heightRatio) ? clampNumber(heightRatio, 0.45, 0.98) : fallbackWindow.heightRatio;
        const leftRatioValue = parseFloat(sourceWindow.leftRatio);
        const topRatioValue = parseFloat(sourceWindow.topRatio);
        const omrWidthRatio = parseFloat(raw?.omrWidthRatio);

        return {
            window: {
                widthRatio: roundRatio(safeWidthRatio),
                heightRatio: roundRatio(safeHeightRatio),
                leftRatio: roundRatio(clampNumber(Number.isFinite(leftRatioValue) ? leftRatioValue : fallbackWindow.leftRatio, 0, Math.max(0, 1 - safeWidthRatio))),
                topRatio: roundRatio(clampNumber(Number.isFinite(topRatioValue) ? topRatioValue : fallbackWindow.topRatio, 0, Math.max(0, 1 - safeHeightRatio)))
            },
            omrWidthRatio: roundRatio(Number.isFinite(omrWidthRatio) ? clampNumber(omrWidthRatio, 0.12, 0.7) : DEFAULT_POPUP_LAYOUT.omrWidthRatio)
        };
    }

    function normalizeToolUiConfig(raw) {
        return {
            bottomPaddingRatio: roundRatio(clampNumber(parseFloat(raw?.bottomPaddingRatio) || DEFAULT_TOOL_UI_CONFIG.bottomPaddingRatio, 0, 0.9)),
            sideButtonColumnRatio: roundRatio(clampNumber(parseFloat(raw?.sideButtonColumnRatio) || DEFAULT_TOOL_UI_CONFIG.sideButtonColumnRatio, 0.03, 0.24)),
            noteFontSize: clampNumber(parseInt(raw?.noteFontSize, 10) || DEFAULT_TOOL_UI_CONFIG.noteFontSize, 12, 22),
            canvasLineWidth: clampNumber(parseInt(raw?.canvasLineWidth, 10) || DEFAULT_TOOL_UI_CONFIG.canvasLineWidth, 2, 12)
        };
    }

    function normalizeAdvancedPlanType(value) {
        const trimmed = String(value || '').trim();
        if (trimmed === '2주 이용권') return '14일 이용권';
        return ADVANCED_SUBSCRIPTION_PLAN_OPTIONS.includes(trimmed) ? trimmed : DEFAULT_ADVANCED_PLAN_TYPE;
    }

    function normalizeAdvancedLoginId(value) {
        return String(value || '').trim();
    }

    function encodeAdvancedLoginIdKey(value) {
        const normalized = normalizeAdvancedLoginId(value).toLowerCase();
        if (!normalized) return '';
        if (/^[a-z0-9_-]+$/.test(normalized)) {
            return normalized;
        }
        return `e~${Array.from(normalized).map((char) => (
            /[a-z0-9_-]/.test(char)
                ? char
                : `_${char.codePointAt(0).toString(16)}_`
        )).join('')}`;
    }

    function getAdvancedLoginIdKey(value) {
        return encodeAdvancedLoginIdKey(value);
    }

    function normalizeAdvancedExpiresAt(value) {
        return String(value || '').trim();
    }

    function isPermanentAdvancedSubscription(planType, expiresAt) {
        return normalizeAdvancedPlanType(planType) === PERMANENT_ADVANCED_PLAN_TYPE || !normalizeAdvancedExpiresAt(expiresAt);
    }

    function normalizeAdvancedPersistenceFields(planType, expiresAt) {
        if (isPermanentAdvancedSubscription(planType, expiresAt)) {
            return {
                planType: PERMANENT_ADVANCED_PLAN_TYPE,
                expiresAt: ''
            };
        }
        return {
            planType: normalizeAdvancedPlanType(planType),
            expiresAt: normalizeAdvancedExpiresAt(expiresAt)
        };
    }

    function normalizeAdvancedSubscription(raw, index = 0) {
        const fallback = DEFAULT_ADVANCED_FEATURE_CONFIG.subscriptions[0];
        const status = ['active', 'paused', 'expired'].includes(raw?.status) ? raw.status : 'active';
        const persistence = normalizeAdvancedPersistenceFields(raw?.planType || raw?.planName || fallback.planType, raw?.expiresAt);
        return {
            id: String(raw?.id || `subscription-${index + 1}`),
            planType: persistence.planType,
            userIdentity: String(raw?.userIdentity || raw?.memberLabel || '').trim(),
            loginId: normalizeAdvancedLoginId(raw?.loginId || raw?.externalId || ''),
            status,
            passwordSalt: String(raw?.passwordSalt || '').trim(),
            passwordHash: String(raw?.passwordHash || '').trim().toLowerCase(),
            expiresAt: persistence.expiresAt,
            note: String(raw?.note || '').trim()
        };
    }

    function normalizeAdvancedFeatureConfig(raw) {
        const subscriptions = Array.isArray(raw?.subscriptions)
            ? raw.subscriptions.map((item, index) => normalizeAdvancedSubscription(item, index)).filter((item) => item.passwordSalt && item.passwordHash)
            : [];
        const legacySource = (Array.isArray(raw?.passwords)
            ? raw.passwords
            : String(raw?.passwords || '').split(/\r?\n|,/))
            .map((item) => String(item || '').trim())
            .filter(Boolean);
        const legacyPasswords = [];
        legacySource.forEach((item) => {
            if (!item || legacyPasswords.includes(item)) return;
            legacyPasswords.push(item);
        });
        if (Array.isArray(raw?.subscriptions) || subscriptions.length || legacyPasswords.length) {
            return {
                subscriptions,
                legacyPasswords
            };
        }
        return {
            subscriptions: DEFAULT_ADVANCED_FEATURE_CONFIG.subscriptions.map((item, index) => normalizeAdvancedSubscription(item, index)),
            legacyPasswords: []
        };
    }

    function normalizeManualSubscriptionConfig(raw) {
        const sourcePlans = Array.isArray(raw?.plans) ? raw.plans : [];
        const planByCode = new Map(sourcePlans
            .map((plan) => [String(plan?.code || '').trim(), plan])
            .filter(([code]) => Boolean(code)));
        const mergedPlans = DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.plans.map((fallback) => ({
            ...fallback,
            ...(planByCode.get(fallback.code) || {})
        }));
        sourcePlans.forEach((plan) => {
            const code = String(plan?.code || '').trim();
            if (code && !DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.plans.some((fallback) => fallback.code === code)) {
                mergedPlans.push(plan);
            }
        });
        const plans = mergedPlans
            .map((plan, index) => {
                const fallback = DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.plans[index] || DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.plans[0];
                const code = String(plan?.code || fallback.code || '').trim();
                const label = String(plan?.label || fallback.label || '').trim();
                const rawPrice = parseInt(plan?.price, 10);
                const legacyDefaultPrices = {
                    'manual-3d': [2000, 2900],
                    'manual-7d': [3900, 4000, 4900],
                    'manual-14d': [5900, 6900, 7900],
                    'manual-30d': [9900]
                };
                const rawHighlight = String(plan?.highlight || '').trim();
                const legacyDefaultHighlights = {
                    'manual-14d': ['가장 추천하는 주력 이용권'],
                    'manual-30d': ['한 달 준비용 최저 단가']
                };
                const priceSource = legacyDefaultPrices[code]?.includes(rawPrice) ? fallback.price : rawPrice;
                const highlightSource = legacyDefaultHighlights[code]?.includes(rawHighlight) ? fallback.highlight : rawHighlight;
                const days = Math.max(1, parseInt(plan?.days, 10) || fallback.days || 7);
                const price = Math.max(1000, priceSource || fallback.price || 3900);
                return {
                    code,
                    label,
                    days,
                    price,
                    enabled: plan?.enabled !== false,
                    highlight: String(highlightSource || fallback.highlight || '').trim()
                };
            })
            .filter((plan) => plan.code && plan.label);
        return {
            enabled: raw?.enabled !== false,
            donationUrl: String(raw?.donationUrl || DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.donationUrl).trim(),
            supportEmail: String(raw?.supportEmail || DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.supportEmail).trim(),
            secureApiBaseUrl: String(raw?.secureApiBaseUrl || DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.secureApiBaseUrl || '').trim().replace(/\/+$/, ''),
            approvalApiBaseUrl: String(raw?.approvalApiBaseUrl || '').trim().replace(/\/+$/, ''),
            adminPublicKeyPem: String(raw?.adminPublicKeyPem || '').trim(),
            licensePublicKeyPem: String(raw?.licensePublicKeyPem || '').trim(),
            plans: plans.length ? plans : DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.plans.map((plan) => ({ ...plan }))
        };
    }

    function formatCurrency(value) {
        return `${Number(value || 0).toLocaleString('ko-KR')}원`;
    }

    function formatKstDateTime(timestamp) {
        if (!Number.isFinite(timestamp)) return '-';
        return new Date(timestamp).toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getKstDateParts(date = new Date()) {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(date).reduce((acc, part) => {
            if (part.type !== 'literal') acc[part.type] = part.value;
            return acc;
        }, {});
    }

    function formatKstFileStamp(date = new Date()) {
        const parts = getKstDateParts(date);
        return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}`;
    }

    function getAdvancedExportIdentity() {
        const payload = verifiedAdvancedLicenseBundle?.payload || {};
        return String(
            payload.email
            || payload.loginId
            || payload.desiredLoginId
            || payload.siteNickname
            || payload.userIdentity
            || ''
        ).trim();
    }

    function buildExportMetaLines(title, extra = {}) {
        const createdAt = formatKstDateTime(Date.now());
        const lines = [
            '===== SKCT 연습 기록 메타 =====',
            `자료: ${title}`,
            `생성시각: ${createdAt}`,
            `모드: ${isAdvancedMode ? '고급 모드' : '일반 모드'}`
        ];
        if (configExportIdentityIncluded) {
            const identity = getAdvancedExportIdentity();
            if (identity) lines.push(`계정: ${identity}`);
        }
        Object.entries(extra).forEach(([key, value]) => {
            if (value != null && value !== '') lines.push(`${key}: ${value}`);
        });
        lines.push('==============================');
        return lines;
    }

    function getTodayKstDateInputValue() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const kst = new Date(utc + (9 * 60 * 60000));
        return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    }

    function getCurrentKstDateTimeLocalValue() {
        const parts = getKstDateParts(new Date());
        return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    }

    function ensureManualSubscriptionStartDate() {
        if (manualSubscriptionStartDateInput && !manualSubscriptionStartDateInput.value) {
            manualSubscriptionStartDateInput.value = getTodayKstDateInputValue();
        }
    }

    function maskEmail(value) {
        const trimmed = String(value || '').trim();
        if (!trimmed.includes('@')) return trimmed ? `${trimmed.slice(0, 2)}***` : '-';
        const [local, domain] = trimmed.split('@');
        return `${local.slice(0, 2)}***@${domain}`;
    }

    function normalizeLookupEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isLikelyEmailAddress(value) {
        const normalized = normalizeLookupEmail(value);
        if (!normalized || !normalized.includes('@')) return false;
        const segments = normalized.split('@');
        return segments.length === 2 && segments[0].length > 0 && segments[1].length > 0;
    }

    async function sha256Hex(value) {
        const encoder = new TextEncoder();
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value || '')));
        return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    async function buildSubscriptionLookupKey(email, password) {
        const normalizedEmail = normalizeLookupEmail(email);
        const normalizedPassword = String(password || '');
        if (!normalizedEmail || !normalizedPassword) return '';
        return sha256Hex(`${normalizedEmail}::${normalizedPassword}`);
    }

    function getSecureApiBaseUrl() {
        return String(remoteManualSubscriptionConfig?.secureApiBaseUrl || '').trim().replace(/\/+$/, '');
    }

    function getApprovalApiBaseUrl() {
        return String(
            remoteManualSubscriptionConfig?.approvalApiBaseUrl
            || remoteManualSubscriptionConfig?.secureApiBaseUrl
            || DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.secureApiBaseUrl
            || ''
        ).trim().replace(/\/+$/, '');
    }

    function isApprovalBackendEnabled() {
        return Boolean(getApprovalApiBaseUrl());
    }

    async function requestApprovalApi(path, options = {}) {
        const baseUrl = getApprovalApiBaseUrl();
        if (!baseUrl) throw new Error('자동승인 API 주소가 설정되지 않았습니다.');
        const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
        let response;
        try {
            response = await fetch(`${baseUrl}${normalizedPath}`, {
                method: options.method || 'GET',
                headers: { 'Content-Type': 'application/json' },
                body: options.body ? JSON.stringify(options.body) : undefined
            });
        } catch (error) {
            throw new Error('자동승인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(String(payload?.detail || payload?.errorMessage || payload?.message || '자동승인 서버 요청에 실패했습니다.'));
        }
        return payload;
    }

    function buildSecureApiUrl(path) {
        const baseUrl = getSecureApiBaseUrl();
        if (!baseUrl) return '';
        const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
        return `${baseUrl}${normalizedPath}`;
    }

    async function postToSecureApi(path, payload, fallbackMessage) {
        const url = buildSecureApiUrl(path);
        if (!url) throw new Error(fallbackMessage || '보안 API 설정이 아직 준비되지 않았습니다.');
        let response = null;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload || {})
            });
        } catch (error) {
            throw new Error(fallbackMessage);
        }
        let responsePayload = null;
        try {
            responsePayload = await response.json();
        } catch (error) {
            responsePayload = null;
        }
        if (!response.ok) {
            throw new Error(
                String(responsePayload?.errorMessage || responsePayload?.message || fallbackMessage || '보안 API 호출 중 오류가 발생했습니다.')
            );
        }
        return responsePayload && typeof responsePayload === 'object' ? responsePayload : {};
    }

    function maskText(value) {
        const trimmed = String(value || '').trim();
        if (!trimmed) return '-';
        if (trimmed.length <= 2) return `${trimmed[0]}*`;
        return `${trimmed.slice(0, 2)}***`;
    }

    function getManualSubscriptionPlanByCode(code) {
        return remoteManualSubscriptionConfig.plans.find((plan) => plan.code === code) || remoteManualSubscriptionConfig.plans[0] || DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.plans[0];
    }

    function normalizeRecentRequestInfo(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const lookupIdentifier = normalizeLookupEmail(raw.lookupIdentifier || '');
        if (!isLikelyEmailAddress(lookupIdentifier)) return null;
        const createdAt = Number(raw.createdAt);
        return {
            lookupIdentifier,
            createdAt: Number.isFinite(createdAt) ? createdAt : Date.now()
        };
    }

    function clearRecentRequestInfo() {
        sessionStorage.removeItem(MANUAL_SUBSCRIPTION_REQUEST_STORAGE_KEY);
        localStorage.removeItem(MANUAL_SUBSCRIPTION_REQUEST_STORAGE_KEY);
    }

    function saveRecentRequestInfo(info) {
        const normalized = normalizeRecentRequestInfo(info);
        if (!normalized) {
            clearRecentRequestInfo();
            return;
        }
        writeJsonStorage(sessionStorage, MANUAL_SUBSCRIPTION_REQUEST_STORAGE_KEY, normalized);
        localStorage.removeItem(MANUAL_SUBSCRIPTION_REQUEST_STORAGE_KEY);
    }

    function readRecentRequestInfo() {
        const current = normalizeRecentRequestInfo(readJsonStorage(sessionStorage, MANUAL_SUBSCRIPTION_REQUEST_STORAGE_KEY));
        if (current) {
            return current;
        }
        sessionStorage.removeItem(MANUAL_SUBSCRIPTION_REQUEST_STORAGE_KEY);

        const legacy = normalizeRecentRequestInfo(readJsonStorage(localStorage, MANUAL_SUBSCRIPTION_REQUEST_STORAGE_KEY));
        localStorage.removeItem(MANUAL_SUBSCRIPTION_REQUEST_STORAGE_KEY);
        if (!legacy) {
            return null;
        }
        writeJsonStorage(sessionStorage, MANUAL_SUBSCRIPTION_REQUEST_STORAGE_KEY, legacy);
        return legacy;
    }

    function buildManualSubscriptionSubmitFingerprint(fields = {}) {
        return JSON.stringify({
            planCode: String(fields.planCode || '').trim(),
            siteNickname: String(fields.siteNickname || '').trim().toLowerCase(),
            email: String(fields.email || '').trim().toLowerCase(),
            desiredLoginId: getAdvancedLoginIdKey(fields.desiredLoginId || ''),
            requestedStartDate: String(fields.requestedStartDate || '').trim()
        });
    }

    function readManualSubscriptionFormFields() {
        const plan = getManualSubscriptionPlanByCode(manualSubscriptionPlanSelect?.value);
        const email = manualSubscriptionEmailInput?.value.trim() || '';
        return {
            plan,
            siteNickname: email,
            email,
            desiredLoginId: email,
            requestedStartDate: manualSubscriptionStartDateInput?.value || '',
            requestPassword: manualSubscriptionPasswordInput?.value || '',
            requestPasswordConfirm: manualSubscriptionPasswordConfirmInput?.value || ''
        };
    }

    function validateManualSubscriptionFormFields(fields) {
        if (!fields.plan?.code) {
            return readSiteText('messages.manualNoPlan', '신청 가능한 이용권이 아직 열리지 않았습니다.');
        }
        if (!fields.email || !fields.requestedStartDate || !fields.requestPassword || !fields.requestPasswordConfirm) {
            return readSiteText('messages.manualRequiredFields', '이메일, 이용 시작일, 비밀번호를 모두 입력해주세요.');
        }
        if (!fields.email.includes('@')) {
            return readSiteText('messages.manualInvalidEmail', '이메일 형식이 올바르지 않습니다.');
        }
        if (fields.requestPassword.length < 6) {
            return readSiteText('messages.manualPasswordShort', '비밀번호는 최소 6자 이상으로 설정해주세요.');
        }
        if (fields.requestPassword !== fields.requestPasswordConfirm) {
            return '비밀번호 확인이 일치하지 않습니다.';
        }
        return '';
    }

    function buildManualDonationSignature(fields) {
        return buildManualSubscriptionSubmitFingerprint({
            planCode: fields.plan?.code,
            siteNickname: fields.siteNickname,
            email: fields.email,
            desiredLoginId: fields.desiredLoginId,
            requestedStartDate: fields.requestedStartDate
        });
    }

    function getManualDonationDraft(fields) {
        const signature = buildManualDonationSignature(fields);
        if (!manualDonationDraft.requestId || manualDonationDraft.signature !== signature) {
            manualDonationDraft = {
                requestId: '',
                signature,
                memo: '',
                copied: false,
                donateOpened: false,
                backendOrderCreated: false,
                secureRequestStored: false,
                polling: false,
                completed: false
            };
        }
        return manualDonationDraft;
    }

    function saveManualDonationDraftForReturn(fields, draft) {
        if (!fields || !draft?.signature) return;
        writeJsonStorage(sessionStorage, MANUAL_DONATION_DRAFT_STORAGE_KEY, {
            updatedAt: Date.now(),
            fields: {
                planCode: fields.plan?.code || '',
                email: fields.email || '',
                requestedStartDate: fields.requestedStartDate || '',
                requestPassword: fields.requestPassword || '',
                requestPasswordConfirm: fields.requestPasswordConfirm || ''
            },
            draft: {
                requestId: draft.requestId || '',
                signature: draft.signature || '',
                memo: draft.memo || '',
                copied: draft.copied === true,
                donateOpened: draft.donateOpened === true,
                backendOrderCreated: draft.backendOrderCreated === true,
                secureRequestStored: draft.secureRequestStored === true,
                polling: draft.polling === true,
                completed: draft.completed === true
            }
        });
    }

    function clearManualDonationDraftForReturn() {
        sessionStorage.removeItem(MANUAL_DONATION_DRAFT_STORAGE_KEY);
    }

    function restoreManualDonationDraftForReturn() {
        const saved = readJsonStorage(sessionStorage, MANUAL_DONATION_DRAFT_STORAGE_KEY);
        if (!saved || !Number.isFinite(saved.updatedAt) || Date.now() - saved.updatedAt > MANUAL_DONATION_DRAFT_RESTORE_MS) {
            clearManualDonationDraftForReturn();
            return;
        }
        const fields = saved.fields || {};
        if (manualSubscriptionPlanSelect && fields.planCode) manualSubscriptionPlanSelect.value = fields.planCode;
        if (manualSubscriptionEmailInput && fields.email) manualSubscriptionEmailInput.value = fields.email;
        if (manualSubscriptionStartDateInput && fields.requestedStartDate) manualSubscriptionStartDateInput.value = fields.requestedStartDate;
        if (manualSubscriptionPasswordInput && fields.requestPassword) manualSubscriptionPasswordInput.value = fields.requestPassword;
        if (manualSubscriptionPasswordConfirmInput && fields.requestPasswordConfirm) manualSubscriptionPasswordConfirmInput.value = fields.requestPasswordConfirm;
        const currentFields = readManualSubscriptionFormFields();
        const signature = buildManualDonationSignature(currentFields);
        if (saved.draft?.signature !== signature) {
            clearManualDonationDraftForReturn();
            return;
        }
        manualDonationDraft = {
            requestId: saved.draft.requestId || '',
            signature,
            memo: saved.draft.memo || '',
            copied: saved.draft.copied === true,
            donateOpened: saved.draft.donateOpened === true,
            backendOrderCreated: saved.draft.backendOrderCreated === true,
            secureRequestStored: saved.draft.secureRequestStored === true,
            polling: false,
            completed: saved.draft.completed === true
        };
    }

    function buildManualDonationMemo(fields, requestId) {
        return [
            'SKCT 고급 복기팩 신청',
            `신청번호: ${requestId}`,
            `이용권: ${fields.plan?.label || '-'}`,
            `이메일: ${fields.email || '-'}`,
            '신청서 작성 완료 후 후원했습니다.'
        ].join('\n');
    }

    function getManualDonationPrimaryButtonLabel() {
        if (manualDonationDraft.completed) return '신청 완료';
        if (manualDonationDraft.polling) return '자동 확인 중...';
        if (isApprovalBackendEnabled()) return '후원완료';
        return '신청하기';
    }

    const MANUAL_DONATION_READY_MESSAGE = '후원을 완료한 뒤 아래의 3번 후원완료 버튼을 눌러주세요.';
    const MANUAL_DONATION_COMPLETE_MESSAGE = '구독 신청이 완료되었습니다.';
    const MANUAL_DONATION_RECEIPT_MESSAGE = '신청이 접수되었습니다. 보통 10분 이내로 처리되지만, 서버에 문제가 있을 시 지연될 수 있습니다.\n\n10분을 초과한 지연 시간은 2배로 계산하여 추가 사용 시간을 제공해드립니다. 후원 내용에 오류가 있을 시 메일이 발송됩니다. 이용권이 정상 승인되면 신청하신 메일로 안내해드리겠습니다.\n\n후원에 감사드리며, 서버 유지보수와 사용 경험 개선에 활용하겠습니다.';

    function setManualDonationActionLabel(element, step, label) {
        if (!element) return;
        element.innerHTML = `<span class="manual-donation-step-number">${step}</span> ${label}`;
    }

    function showManualDonationReceipt(message = MANUAL_DONATION_RECEIPT_MESSAGE) {
        if (!manualSubscriptionSubmitStatus) return;
        manualSubscriptionSubmitStatus.classList.add('is-visible');
        manualSubscriptionSubmitStatus.style.color = '';
        manualSubscriptionSubmitStatus.textContent = message;
    }

    function updateManualDonationFlowState(message = '') {
        const formDescription = document.getElementById('advancedGuideFormDescription');
        if (formDescription) {
            formDescription.textContent = isApprovalBackendEnabled()
                ? '신청 정보를 입력한 뒤 1. 후원 내용 복사, 2. 후원하기, 3. 후원완료 순서로 진행해주세요.'
                : '현재 자동승인 서버 설정을 확인하지 못했습니다. 신청을 진행하지 말고 잠시 후 다시 시도해 주세요.';
        }
        const flow = document.getElementById('advancedGuideFlow');
        if (flow) {
            flow.textContent = isApprovalBackendEnabled()
                ? '이용권 선택 -> 1. 후원 내용 복사 -> 2. 후원하기 -> 3. 후원완료 -> 승인 안내'
                : '자동승인 서버 연결 확인 필요';
        }
        if (manualDonationFlowPanel) {
            manualDonationFlowPanel.classList.toggle('is-ready', manualDonationDraft.copied && manualDonationDraft.donateOpened);
        }
        if (manualDonationFlowBadge) {
            manualDonationFlowBadge.textContent = manualDonationDraft.completed
                ? '신청 완료'
                : manualDonationDraft.copied
                ? (manualDonationDraft.donateOpened ? '3번 후원완료' : '2번 후원하기')
                : '';
        }
        if (manualDonationMemoText) {
            manualDonationMemoText.value = manualDonationDraft.memo || '';
        }
        if (manualDonationMemoCopyBtn) {
            manualDonationMemoCopyBtn.classList.toggle('is-copied', manualDonationDraft.copied);
            setManualDonationActionLabel(manualDonationMemoCopyBtn, 1, manualDonationDraft.copied ? '후원 내용 다시 복사' : '후원 내용 복사');
        }
        if (manualSubscriptionDonateLink) {
            manualSubscriptionDonateLink.classList.toggle('is-disabled', !manualDonationDraft.copied);
            manualSubscriptionDonateLink.setAttribute('aria-disabled', manualDonationDraft.copied ? 'false' : 'true');
        }
        if (manualDonationStepStatus) {
            manualDonationStepStatus.textContent = message || (
                manualDonationDraft.completed
                    ? MANUAL_DONATION_COMPLETE_MESSAGE
                    : manualDonationDraft.copied
                    ? MANUAL_DONATION_READY_MESSAGE
                    : '후원 내용 복사 버튼을 눌러주세요.'
            );
        }
        if (manualSubscriptionSubmitBtn && !manualSubscriptionSubmitInFlight) {
            const canSubmit = manualDonationDraft.copied && manualDonationDraft.donateOpened && !manualDonationDraft.completed && !manualDonationDraft.polling;
            setManualDonationActionLabel(manualSubscriptionSubmitBtn, 3, getManualDonationPrimaryButtonLabel());
            manualSubscriptionSubmitBtn.disabled = !canSubmit;
            manualSubscriptionSubmitBtn.classList.toggle('is-hidden', !manualDonationDraft.copied);
        }
    }
    window.enforceEmailOnlySubscriptionCopy = () => updateManualDonationFlowState();

    function resetManualDonationDraftIfFormChanged() {
        const fields = readManualSubscriptionFormFields();
        const signature = buildManualDonationSignature(fields);
        if (!manualDonationDraft.signature || manualDonationDraft.signature === signature) return;
        manualDonationDraft = {
            requestId: '',
            signature: '',
            memo: '',
            copied: false,
            donateOpened: false,
            backendOrderCreated: false,
            secureRequestStored: false,
            polling: false,
            completed: false
        };
        clearManualDonationDraftForReturn();
        updateManualDonationFlowState('신청 정보가 바뀌었습니다. 후원 내용을 다시 복사해 주세요.');
    }

    async function prepareApprovalBackendOrder(fields, draft, { storeSecureRequest = false } = {}) {
        if (!remoteManualSubscriptionConfig.adminPublicKeyPem) {
            throw new Error(readSiteText('messages.manualConfigNotReady', '신청 암호화 설정이 준비되지 않았습니다. 관리자에게 문의해 주세요.'));
        }
        if (!draft.backendOrderCreated) {
            const order = await requestApprovalApi('/auto-approval/order', {
                method: 'POST',
                body: {
                    email: normalizeLookupEmail(fields.email),
                    plan_name: fields.plan.label
                }
            });
            draft.requestId = String(order.request_id || '').trim();
            draft.memo = String(order.instruction_message || '').trim();
            draft.monitoringStatus = String(order.monitoring_status || 'not_started');
            draft.monitoringMessage = String(order.monitoring_message || '후원완료를 누르면 자동 확인이 시작됩니다.');
            if (!draft.requestId || !draft.memo) {
                throw new Error('자동승인 서버가 신청번호를 발급하지 못했습니다.');
            }
            draft.backendOrderCreated = true;
        }
        if (storeSecureRequest && !draft.secureRequestStored) {
            const lookupKey = await buildSubscriptionLookupKey(fields.email, fields.requestPassword);
            const requestCreatedAt = Date.now();
            const encrypted = await window.SKCTSubscriptionCrypto.encryptRequestPayload({
                donationName: draft.requestId,
                donationCode: draft.requestId,
                donationMemo: draft.memo,
                donationFlowConfirmed: true,
                requestedStartDate: fields.requestedStartDate,
                siteNickname: fields.siteNickname,
                email: fields.email,
                desiredLoginId: fields.desiredLoginId,
                requestPassword: fields.requestPassword,
                memo: '',
                createdAt: requestCreatedAt,
                adminResponse: null
            }, fields.requestPassword, remoteManualSubscriptionConfig.adminPublicKeyPem);
            const record = {
                requestId: draft.requestId,
                desiredLoginIdKey: getAdvancedLoginIdKey(fields.desiredLoginId),
                status: 'pending',
                planCode: fields.plan.code,
                planLabel: fields.plan.label,
                createdAt: requestCreatedAt,
                updatedAt: requestCreatedAt,
                requesterMask: maskText(fields.siteNickname),
                emailMask: maskEmail(fields.email),
                donationMask: draft.requestId,
                lookupEmailPasswordKey: lookupKey,
                ...encrypted
            };
            try {
                const secureResult = await postToSecureApi('/subscription/request', {
                    requestId: draft.requestId,
                    lookupKey,
                    record,
                    lookupRecord: {
                        requestId: draft.requestId,
                        createdAt: requestCreatedAt,
                        emailMask: maskEmail(fields.email)
                    }
                }, readSiteText('messages.manualSubmitError', '암호화 신청을 저장하지 못했습니다.'));
                if (!secureResult?.ok) throw new Error('암호화 신청을 저장하지 못했습니다.');
            } catch (error) {
                if (!String(error?.message || '').includes('이미 처리된 신청')) throw error;
            }
            draft.secureRequestStored = true;
            saveRecentRequestInfo({ lookupIdentifier: normalizeLookupEmail(fields.email), createdAt: requestCreatedAt });
            if (manualSubscriptionLookupIdInput) manualSubscriptionLookupIdInput.value = normalizeLookupEmail(fields.email);
            if (manualSubscriptionLookupPasswordInput) manualSubscriptionLookupPasswordInput.value = fields.requestPassword;
            if (advancedAccessIdInput) advancedAccessIdInput.value = normalizeLookupEmail(fields.email);
        }
        saveManualDonationDraftForReturn(fields, draft);
        return draft;
    }

    function stopApprovalPolling() {
        if (manualApprovalPollingTimer) {
            window.clearTimeout(manualApprovalPollingTimer);
            manualApprovalPollingTimer = null;
        }
        manualDonationDraft.polling = false;
    }

    async function pollApprovalOrderStatus() {
        if (!manualDonationDraft.requestId || !manualDonationDraft.polling) return;
        try {
            const statusPayload = await requestApprovalApi('/auto-approval/status', {
                method: 'POST',
                body: { requestId: manualDonationDraft.requestId }
            });
            const status = String(statusPayload.status || 'pending');
            if (status === 'pending') {
                showManualDonationReceipt();
                manualApprovalPollingTimer = window.setTimeout(pollApprovalOrderStatus, 15000);
                return;
            }
            stopApprovalPolling();
            const messages = {
                approved: '고급 복기팩 이용이 승인되었습니다. 신청 이메일과 비밀번호로 고급 모드에 로그인해 주세요.',
                expired: '신청 유효시간이 지났고 후원 내역은 확인되지 않았습니다. 이미 후원했다면 신청번호와 함께 문의해 주세요.',
                manual_review: '후원은 확인됐지만 신청 정보가 일치하지 않아 자동승인되지 않았습니다. 운영자가 확인 중입니다.',
                rejected: '승인되지 않았습니다. 신청번호와 함께 문의해 주세요.'
            };
            showManualDonationReceipt(status === 'approved'
                ? '이용권이 승인되었습니다. 신청하신 이메일로 승인 안내를 보내드렸습니다.'
                : MANUAL_DONATION_RECEIPT_MESSAGE);
            if (status === 'approved') {
                manualDonationDraft.completed = true;
                saveManualDonationDraftForReturn(readManualSubscriptionFormFields(), manualDonationDraft);
            }
            updateManualDonationFlowState(messages[status] || `현재 신청 상태: ${status}`);
        } catch (error) {
            showManualDonationReceipt();
            manualApprovalPollingTimer = window.setTimeout(pollApprovalOrderStatus, 15000);
        }
    }

    function startApprovalPolling() {
        stopApprovalPolling();
        manualDonationDraft.polling = true;
        showManualDonationReceipt();
        updateManualDonationFlowState('신청이 접수되었습니다. 승인 결과는 이메일로 안내해드리겠습니다.');
        void pollApprovalOrderStatus();
    }

    async function copyManualDonationMemo() {
        if (!manualDonationStepStatus) return;
        if (manualSubscriptionSubmitInFlight) {
            manualDonationStepStatus.textContent = '신청번호를 준비하고 있습니다. 잠시만 기다려 주세요.';
            return;
        }
        const fields = readManualSubscriptionFormFields();
        const validationError = validateManualSubscriptionFormFields(fields);
        if (validationError) {
            manualDonationStepStatus.textContent = validationError;
            return;
        }
        const draft = getManualDonationDraft(fields);
        manualSubscriptionSubmitInFlight = true;
        if (manualDonationMemoCopyBtn) manualDonationMemoCopyBtn.disabled = true;
        try {
            if (!isApprovalBackendEnabled()) throw new Error('자동승인 서버 설정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
            manualDonationStepStatus.textContent = '안전한 신청번호를 생성하고 있습니다...';
            // 주문과 암호화 신청서를 함께 확정하되, 후원 감시는 3단계 전에는 시작하지 않는다.
            await prepareApprovalBackendOrder(fields, draft, { storeSecureRequest: true });
        } catch (error) {
            manualDonationStepStatus.textContent = error.message || '신청번호를 준비하지 못했습니다.';
            return;
        } finally {
            manualSubscriptionSubmitInFlight = false;
            if (manualDonationMemoCopyBtn) manualDonationMemoCopyBtn.disabled = false;
        }
        const copied = await copyTextToClipboard(draft.memo);
        draft.copied = copied;
        if (copied) saveManualDonationDraftForReturn(fields, draft);
        updateManualDonationFlowState(copied
            ? MANUAL_DONATION_READY_MESSAGE
            : '복사에 실패했습니다. 아래 내용을 직접 선택해서 복사해 주세요.');
    }

    async function handleManualSubscriptionPrimaryAction() {
        if (!manualSubscriptionSubmitStatus) return;
        if (manualSubscriptionSubmitInFlight) {
            manualSubscriptionSubmitStatus.style.color = '#b45309';
            manualSubscriptionSubmitStatus.textContent = '현재 신청서를 저장하는 중입니다. 잠시만 기다려주세요.';
            return;
        }
        const fields = readManualSubscriptionFormFields();
        const validationError = validateManualSubscriptionFormFields(fields);
        if (validationError) {
            manualSubscriptionSubmitStatus.style.color = '#b91c1c';
            manualSubscriptionSubmitStatus.textContent = validationError;
            updateManualDonationFlowState(validationError);
            return;
        }
        const draft = getManualDonationDraft(fields);
        const signature = buildManualDonationSignature(fields);
        if (!draft.copied || draft.signature !== signature) {
            manualSubscriptionSubmitStatus.style.color = '#b45309';
            manualSubscriptionSubmitStatus.textContent = '후원 내용 복사 버튼을 먼저 눌러주세요.';
            updateManualDonationFlowState('후원 내용 복사 버튼을 눌러주세요.');
            return;
        }
        if (!draft.donateOpened) {
            manualSubscriptionSubmitStatus.style.color = '#b45309';
            manualSubscriptionSubmitStatus.textContent = '2번 후원하기로 후원한 뒤 3번 후원완료를 눌러주세요.';
            updateManualDonationFlowState();
            return;
        }
        if (!isApprovalBackendEnabled()) {
            manualSubscriptionSubmitStatus.style.color = '#b91c1c';
            manualSubscriptionSubmitStatus.textContent = '자동승인 서버 설정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
            return;
        }
        manualSubscriptionSubmitInFlight = true;
        manualSubscriptionSubmitBtn.disabled = true;
        setManualDonationActionLabel(manualSubscriptionSubmitBtn, 3, '접수 중...');
        showManualDonationReceipt();
        let monitoringStarted = false;
        try {
            await prepareApprovalBackendOrder(fields, draft, { storeSecureRequest: true });
            const result = await requestApprovalApi('/auto-approval/start-monitoring', {
                method: 'POST',
                body: { requestId: draft.requestId }
            });
            draft.monitoringStatus = String(result.monitoring_status || 'backend_unavailable');
            draft.monitoringMessage = String(result.monitoring_message || '자동 확인을 시작했습니다.');
            saveManualDonationDraftForReturn(fields, draft);
            monitoringStarted = true;
        } catch (error) {
            showManualDonationReceipt();
            draft.monitoringRetryCount = Number(draft.monitoringRetryCount || 0) + 1;
            updateManualDonationFlowState('신청이 접수되었습니다. 자동 확인 연결을 다시 시도하고 있습니다.');
            if (draft.monitoringRetryCount <= 40) {
                window.setTimeout(() => {
                    if (!manualDonationDraft.completed && !manualDonationDraft.polling) {
                        void handleManualSubscriptionPrimaryAction();
                    }
                }, 15000);
            }
        } finally {
            manualSubscriptionSubmitInFlight = false;
        }
        if (monitoringStarted) startApprovalPolling();
        else updateManualDonationFlowState();
    }

    let remotePopupLayout = normalizePopupLayout();
    let currentPopupLayout = normalizePopupLayout();
    let remoteToolUiConfig = normalizeToolUiConfig();
    let currentToolUiConfig = normalizeToolUiConfig(
        isAdminPreviewMode ? DEFAULT_TOOL_UI_CONFIG : (readToolUiConfigFromStorage() || DEFAULT_TOOL_UI_CONFIG)
    );

    function buildPopupWindowMetrics(windowConfig = currentPopupLayout.window) {
        const normalized = normalizePopupLayout({ window: windowConfig });
        const { availWidth, availHeight, availLeft, availTop } = getScreenMetrics();
        const width = clampNumber(Math.round(availWidth * normalized.window.widthRatio), 520, availWidth);
        const height = clampNumber(Math.round(availHeight * normalized.window.heightRatio), 520, availHeight);
        const maxLeft = Math.max(0, availWidth - width);
        const maxTop = Math.max(0, availHeight - height);
        const left = Math.round(availLeft + clampNumber(availWidth * normalized.window.leftRatio, 0, maxLeft));
        const top = Math.round(availTop + clampNumber(availHeight * normalized.window.topRatio, 0, maxTop));
        return { width, height, left, top };
    }

    function syncToolsBottomPadding() {
        const { availHeight } = getScreenMetrics();
        const basisHeight = availHeight || window.screen?.availHeight || window.outerHeight || window.innerHeight || 900;
        const paddingPx = Math.max(0, Math.round(basisHeight * currentToolUiConfig.bottomPaddingRatio));
        document.documentElement.style.setProperty('--tools-bottom-padding', `${paddingPx}px`);
        if (popupBottomPaddingRange) popupBottomPaddingRange.value = String(currentToolUiConfig.bottomPaddingRatio);
        if (popupBottomPaddingValue) popupBottomPaddingValue.textContent = `${(currentToolUiConfig.bottomPaddingRatio * 100).toFixed(1)}%`;
    }

    function syncToolsRightRail() {
        if (!isAdvancedMode) {
            document.documentElement.style.setProperty('--tools-right-rail-button-size', '0px');
            document.documentElement.style.setProperty('--tools-right-rail-reserve', '0px');
            if (popupSideColumnRange) popupSideColumnRange.value = String(currentToolUiConfig.sideButtonColumnRatio);
            if (popupSideColumnValue) popupSideColumnValue.textContent = `${(currentToolUiConfig.sideButtonColumnRatio * 100).toFixed(1)}%`;
            return;
        }
        const baseWidth = document.querySelector('.tools-layout')?.clientWidth || mainContentEl?.clientWidth || window.innerWidth || 360;
        const buttonPx = clampNumber(Math.round(baseWidth * currentToolUiConfig.sideButtonColumnRatio), 22, 78);
        document.documentElement.style.setProperty('--tools-right-rail-button-size', `${buttonPx}px`);
        document.documentElement.style.setProperty('--tools-right-rail-reserve', `${buttonPx + 14}px`);
        if (popupSideColumnRange) popupSideColumnRange.value = String(currentToolUiConfig.sideButtonColumnRatio);
        if (popupSideColumnValue) popupSideColumnValue.textContent = `${(currentToolUiConfig.sideButtonColumnRatio * 100).toFixed(1)}%`;
    }

    function capturePopupWindowRatios() {
        const { availWidth, availHeight, availLeft, availTop } = getScreenMetrics();
        const widthRatio = clampNumber(window.outerWidth / availWidth, 0.18, 0.8);
        const heightRatio = clampNumber(window.outerHeight / availHeight, 0.45, 0.98);
        const maxLeft = Math.max(0, availWidth - window.outerWidth);
        const maxTop = Math.max(0, availHeight - window.outerHeight);
        const leftPx = clampNumber(window.screenX - availLeft, 0, maxLeft);
        const topPx = clampNumber(window.screenY - availTop, 0, maxTop);
        return {
            widthRatio: roundRatio(widthRatio),
            heightRatio: roundRatio(heightRatio),
            leftRatio: roundRatio(clampNumber(leftPx / availWidth, 0, Math.max(0, 1 - widthRatio))),
            topRatio: roundRatio(clampNumber(topPx / availHeight, 0, Math.max(0, 1 - heightRatio)))
        };
    }

    function setPopupEditorStatus(message, type = '') {
        if (!popupEditorStatusEl) return;
        popupEditorStatusEl.textContent = message;
        popupEditorStatusEl.className = `popup-editor-status${type ? ` ${type}` : ''}`;
    }

    function setPopupEditorCollapsed(collapsed) {
        if (!popupEditorPanelEl) return;
        popupEditorPanelEl.classList.toggle('collapsed', collapsed);
        if (popupEditorToggleBtn) {
            popupEditorToggleBtn.textContent = collapsed ? '펼치기' : '접기';
            popupEditorToggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        }
    }

    function applyPopupOmrWidthRatio(widthRatio) {
        const safeRatio = roundRatio(clampNumber(parseFloat(widthRatio), 0.12, 0.7));
        currentPopupLayout.omrWidthRatio = Number.isFinite(safeRatio) ? safeRatio : 0.30;
        if (!appContainerEl) return;
        const maxWidth = Math.round(appContainerEl.clientWidth * 0.8);
        const minWidth = isPopupMode ? 150 : 120;
        const nextWidth = clampNumber(Math.round(appContainerEl.clientWidth * currentPopupLayout.omrWidthRatio), minWidth, maxWidth);
        document.documentElement.style.setProperty('--omr-width', `${nextWidth}px`);
    }

    function readCurrentLayoutRatios() {
        const styles = getComputedStyle(document.documentElement);
        const timer = parseFloat(styles.getPropertyValue('--timer-ratio')) || DEFAULT_LAYOUT_RATIOS.timer;
        const utils = parseFloat(styles.getPropertyValue('--utils-ratio')) || DEFAULT_LAYOUT_RATIOS.utils;
        const calc = parseFloat(styles.getPropertyValue('--calc-ratio')) || DEFAULT_LAYOUT_RATIOS.calc;
        return {
            timer: roundRatio(timer),
            utils: roundRatio(utils),
            calc: roundRatio(calc)
        };
    }

    function setLayoutRatios(timer, utils, calc, options = {}) {
        const {
            persist = !isAdminPreviewMode && !isPopupMode,
            syncInputs = true,
            notifyPopupEditor = isPopupEditorMode
        } = options;
        const tR = roundRatio(clampNumber(parseFloat(timer) || DEFAULT_LAYOUT_RATIOS.timer, 0.05, 98));
        const uR = roundRatio(clampNumber(parseFloat(utils) || DEFAULT_LAYOUT_RATIOS.utils, 0.05, 98));
        const cR = roundRatio(clampNumber(parseFloat(calc) || DEFAULT_LAYOUT_RATIOS.calc, 0.05, 98));

        document.documentElement.style.setProperty('--timer-ratio', tR);
        document.documentElement.style.setProperty('--utils-ratio', uR);
        document.documentElement.style.setProperty('--calc-ratio', cR);

        if (syncInputs) {
            if (ratioTimer) ratioTimer.value = tR;
            if (ratioUtils) ratioUtils.value = uR;
            if (ratioCalc) ratioCalc.value = cR;
        }

        if (persist) {
            localStorage.setItem('skct_layout_ratios', JSON.stringify({ timer: tR, utils: uR, calc: cR }));
        }

        if (typeof resizeCanvas === 'function') {
            requestAnimationFrame(resizeCanvas);
        }

        if (notifyPopupEditor) {
            schedulePopupEditorSync();
        }
    }

    function applyRatiosFromHeights(timerHeight, utilityHeight, calcHeight) {
        const totalHeight = Math.max(timerHeight + utilityHeight + calcHeight, 1);
        setLayoutRatios(
            (timerHeight / totalHeight) * 100,
            (utilityHeight / totalHeight) * 100,
            (calcHeight / totalHeight) * 100,
            { persist: false, notifyPopupEditor: true }
        );
    }

    function applyToolUiConfig(rawConfig, options = {}) {
        const {
            persist = !isAdminPreviewMode && !isPopupMode,
            notifyPopupEditor = isPopupEditorMode
        } = options;

        currentToolUiConfig = normalizeToolUiConfig({ ...currentToolUiConfig, ...(rawConfig || {}) });
        const notepadEl = document.getElementById('notepad');
        document.documentElement.style.setProperty('--notepad-font-size', `${currentToolUiConfig.noteFontSize}px`);
        if (notepadEl) {
            notepadEl.style.fontSize = `${currentToolUiConfig.noteFontSize}px`;
        }
        if (noteFontSizeRange) noteFontSizeRange.value = String(currentToolUiConfig.noteFontSize);
        if (noteFontSizeValue) noteFontSizeValue.textContent = String(currentToolUiConfig.noteFontSize);
        if (canvasLineWidthRange) canvasLineWidthRange.value = String(currentToolUiConfig.canvasLineWidth);
        if (canvasLineWidthValue) canvasLineWidthValue.textContent = String(currentToolUiConfig.canvasLineWidth);
        syncToolsBottomPadding();
        syncToolsRightRail();

        if (persist) {
            localStorage.setItem(TOOL_UI_STORAGE_KEY, JSON.stringify(currentToolUiConfig));
        }

        if (notifyPopupEditor) {
            schedulePopupEditorSync();
        }
    }

    function capturePopupEditorPayload() {
        return {
            popupLayout: {
                window: capturePopupWindowRatios(),
                omrWidthRatio: currentPopupLayout.omrWidthRatio
            },
            layoutRatios: readCurrentLayoutRatios(),
            toolUiConfig: currentToolUiConfig
        };
    }

    function renderPopupEditorMetrics() {
        if (!popupEditorMetricsEl) return;
        const payload = capturePopupEditorPayload();
        const { popupLayout, layoutRatios } = payload;
        popupEditorMetricsEl.innerHTML = `
            <div>창 크기: ${(popupLayout.window.widthRatio * 100).toFixed(1)}% x ${(popupLayout.window.heightRatio * 100).toFixed(1)}%</div>
            <div>창 위치: 왼쪽 ${(popupLayout.window.leftRatio * 100).toFixed(1)}% / 위 ${(popupLayout.window.topRatio * 100).toFixed(1)}%</div>
            <div>답안 패널 폭: ${(popupLayout.omrWidthRatio * 100).toFixed(1)}%</div>
            <div>세로 비율: 타이머 ${layoutRatios.timer.toFixed(1)} / 메모 ${layoutRatios.utils.toFixed(1)} / 계산기 ${layoutRatios.calc.toFixed(1)}</div>
            <div>도구 기본값: 하단 여백 ${(payload.toolUiConfig.bottomPaddingRatio * 100).toFixed(1)}%, 우측 버튼 열 ${(payload.toolUiConfig.sideButtonColumnRatio * 100).toFixed(1)}%, 메모 ${payload.toolUiConfig.noteFontSize}px, 그림판 ${payload.toolUiConfig.canvasLineWidth}px</div>
        `;
    }

    function postPopupEditorMessage(type, payload) {
        if (!isPopupEditorMode || !window.opener || window.opener.closed) {
            return false;
        }
        window.opener.postMessage({ type, payload }, window.location.origin);
        return true;
    }

    function syncPopupEditorSnapshot(force = false) {
        if (!isPopupEditorMode) return;
        renderPopupEditorMetrics();
        const payload = capturePopupEditorPayload();
        const signature = JSON.stringify(payload);
        if (!force && signature === lastPopupEditorSignature) {
            return;
        }
        lastPopupEditorSignature = signature;
        lastPopupWindowOnlySignature = JSON.stringify(payload.popupLayout.window);
        postPopupEditorMessage(POPUP_EDITOR_MESSAGE_TYPES.preview, payload);
    }

    function schedulePopupEditorSync(delay = 120) {
        if (!isPopupEditorMode) return;
        clearTimeout(popupLayoutSyncTimeout);
        popupLayoutSyncTimeout = setTimeout(() => syncPopupEditorSnapshot(), delay);
    }

    function applyPopupWindowToCurrentWindow(windowConfig) {
        if (!isPopupMode) return;
        const { width, height, left, top } = buildPopupWindowMetrics(windowConfig);
        try {
            window.resizeTo(width, height);
            window.moveTo(left, top);
        } catch (error) {
            console.warn('popup window resize/move failed', error);
        }
    }

    /* --- State Restoration from LocalStorage --- */
    function getMinimumOmrPanelWidth() {
        const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
        if (viewportWidth <= 720) return Math.max(180, Math.floor(viewportWidth * 0.52));
        return 240;
    }

    function getMaximumOmrPanelWidth() {
        const baseWidth = Math.max(0, document.body?.clientWidth || window.innerWidth || 0);
        return Math.max(getMinimumOmrPanelWidth(), Math.floor(baseWidth * 0.8));
    }

    function normalizeOmrPanelWidth(value) {
        const parsed = parseFloat(value);
        const fallback = isPopupMode ? 220 : 260;
        return clampNumber(Number.isFinite(parsed) ? parsed : fallback, getMinimumOmrPanelWidth(), getMaximumOmrPanelWidth());
    }

    function applyOmrPanelWidth(value) {
        const nextWidth = normalizeOmrPanelWidth(value);
        document.documentElement.style.setProperty('--omr-width', `${nextWidth}px`);
        return nextWidth;
    }

    function calculateOmrWidthFromPointer(clientX) {
        if (!isPopupMode || !appContainerEl) {
            return clientX;
        }
        const rect = appContainerEl.getBoundingClientRect();
        return clientX - rect.left;
    }

    const savedOmrWidth = !isPopupMode ? localStorage.getItem('skct_omr_width') : null;
    if (savedOmrWidth) {
        const restoredOmrWidth = applyOmrPanelWidth(savedOmrWidth);
        if (String(savedOmrWidth) !== String(restoredOmrWidth)) {
            localStorage.setItem('skct_omr_width', String(restoredOmrWidth));
        }
    }

    // Layout Ratios Settings
    const savedRatios = (!isAdminPreviewMode && !isPopupMode)
        ? (readJsonStorage(localStorage, 'skct_layout_ratios') || DEFAULT_LAYOUT_RATIOS)
        : DEFAULT_LAYOUT_RATIOS;
    const savedToolUiConfig = (!isAdminPreviewMode && !isPopupMode)
        ? (readToolUiConfigFromStorage() || DEFAULT_TOOL_UI_CONFIG)
        : DEFAULT_TOOL_UI_CONFIG;
    setLayoutRatios(savedRatios.timer, savedRatios.utils, savedRatios.calc, {
        persist: false,
        syncInputs: true,
        notifyPopupEditor: false
    });
    applyToolUiConfig(savedToolUiConfig, {
        persist: false,
        notifyPopupEditor: false
    });

    if (isPopupMode) {
        applyPopupOmrWidthRatio(currentPopupLayout.omrWidthRatio);
    }

    const applyRatios = () => {
        if (!ratioTimer) return;
        setLayoutRatios(ratioTimer.value, ratioUtils.value, ratioCalc.value);
    };

    if (ratioTimer) {
        ratioTimer.addEventListener('input', applyRatios);
        ratioUtils.addEventListener('input', applyRatios);
        ratioCalc.addEventListener('input', applyRatios);
    }

    if (popupBottomPaddingRange) {
        popupBottomPaddingRange.addEventListener('input', () => {
            applyToolUiConfig({ bottomPaddingRatio: popupBottomPaddingRange.value }, { persist: false, notifyPopupEditor: true });
        });
    }

    if (popupSideColumnRange) {
        popupSideColumnRange.addEventListener('input', () => {
            applyToolUiConfig({ sideButtonColumnRatio: popupSideColumnRange.value }, { persist: false, notifyPopupEditor: true });
        });
    }

    if (isPopupEditorMode) {
        popupEditorPanelEl?.classList.remove('hidden');
        topBarResizerEl?.classList.remove('hidden');
        toolsSectionResizerEl?.classList.remove('hidden');
        setPopupEditorCollapsed(true);
        setPopupEditorStatus('창 위치, 크기, 세로 비율, 하단 여백을 조절한 뒤 저장하세요.');

        popupEditorToggleBtn?.addEventListener('click', () => {
            setPopupEditorCollapsed(!popupEditorPanelEl.classList.contains('collapsed'));
        });

        popupEditorReloadBtn?.addEventListener('click', () => {
            currentPopupLayout = normalizePopupLayout(remotePopupLayout);
            applyPopupWindowToCurrentWindow(currentPopupLayout.window);
            applyPopupOmrWidthRatio(currentPopupLayout.omrWidthRatio);
            applyToolUiConfig(remoteToolUiConfig, { persist: false, notifyPopupEditor: false });
            syncPopupEditorSnapshot(true);
            setPopupEditorStatus('서버에 저장된 기본값을 다시 적용했습니다.');
        });

        popupEditorSaveBtn?.addEventListener('click', () => {
            const payload = capturePopupEditorPayload();
            const posted = postPopupEditorMessage(POPUP_EDITOR_MESSAGE_TYPES.saveRequest, payload);
            setPopupEditorStatus(
                posted ? '관리자 페이지에 저장 요청을 보냈습니다...' : '관리자 페이지와 연결되지 않아 저장할 수 없습니다.',
                posted ? '' : 'error'
            );
        });

        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) return;
            const message = event.data || {};
            if (message.type !== POPUP_EDITOR_MESSAGE_TYPES.saveResult) return;
            if (message.success) {
                remotePopupLayout = normalizePopupLayout(message.payload?.popupLayout);
                currentPopupLayout = normalizePopupLayout(remotePopupLayout);
                setLayoutRatios(
                    message.payload?.layoutRatios?.timer,
                    message.payload?.layoutRatios?.utils,
                    message.payload?.layoutRatios?.calc,
                    { persist: false, notifyPopupEditor: false }
                );
                remoteToolUiConfig = normalizeToolUiConfig(message.payload?.toolUiConfig);
                applyToolUiConfig(remoteToolUiConfig, { persist: false, notifyPopupEditor: false });
                applyPopupOmrWidthRatio(currentPopupLayout.omrWidthRatio);
                renderPopupEditorMetrics();
                setPopupEditorStatus('서버 기본값 저장이 완료되었습니다.', 'success');
            } else {
                setPopupEditorStatus(message.error || '저장 중 오류가 발생했습니다.', 'error');
            }
        });
    }

    let winResizeTimeout = null;
    window.addEventListener('resize', () => {
        syncToolsBottomPadding();
        if (isPopupMode) {
            clearTimeout(winResizeTimeout);
            winResizeTimeout = setTimeout(() => {
                applyPopupOmrWidthRatio(currentPopupLayout.omrWidthRatio);
                schedulePopupEditorSync();
            }, 500);
        }
    });

    if (isPopupEditorMode) {
        popupMoveWatcher = window.setInterval(() => {
            const signature = JSON.stringify(capturePopupWindowRatios());
            if (signature !== lastPopupWindowOnlySignature) {
                lastPopupEditorSignature = '';
                schedulePopupEditorSync(0);
            }
        }, 400);
        syncPopupEditorSnapshot(true);
    }

    /* --- OMR & Scoring Logic --- */
    const subjects = [
        { id: 'lang_und', name: '언어이해', count: 20 },
        { id: 'data_ana', name: '자료해석', count: 20 },
        { id: 'crea_math', name: '창의수리', count: 20 },
        { id: 'lang_rea', name: '언어추리', count: 20 },
        { id: 'seq_rea', name: '수열추리', count: 20 }
    ];

    const sanitizeMinutes = (value, fallback) => {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };

    const escapeHtml = (value) => {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    };

    const copyTextToClipboard = async (text) => {
        const value = String(text ?? '');
        if (!value) return false;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch (err) { /* 보안 컨텍스트가 아니거나 권한 거부 -> 폴백 */ }
        try {
            const temp = document.createElement('textarea');
            temp.value = value;
            temp.setAttribute('readonly', '');
            temp.style.position = 'fixed';
            temp.style.opacity = '0';
            document.body.appendChild(temp);
            temp.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(temp);
            return ok;
        } catch (err) {
            return false;
        }
    };

    const sanitizeConfiguredHtml = (value, options = {}) => {
        if (window.SKCTSiteTextConfig?.sanitizeHtml) {
            return window.SKCTSiteTextConfig.sanitizeHtml(value || '', options);
        }
        const safe = escapeHtml(value || '');
        return options.multiline ? safe.replace(/\n/g, '<br>') : safe;
    };
    const formatMultilineHtml = (value) => sanitizeConfiguredHtml(value, { multiline: true });
    const formatInlineHtml = (value) => sanitizeConfiguredHtml(value, { multiline: false });
    const renderSettingsBuildInfo = () => {
        if (settingsUpdatedAt) {
            settingsUpdatedAt.textContent = BUILD_INFO.updatedAt || '-';
        }
        if (settingsVersionRow) {
            const versionLabel = `${BUILD_INFO.version || '-'}${isAdvancedMode ? ' (고급버전)' : ''}`;
            settingsVersionRow.innerHTML = `<strong style="color:#334155;">현재 버전</strong>: ${versionLabel}`;
        }
    };
    const readSiteText = (path, fallback, tokens) => {
        if (window.SKCTSiteTextConfig?.getTextValue) {
            return window.SKCTSiteTextConfig.getTextValue(path, fallback, tokens);
        }
        return String(fallback ?? '');
    };
    const buildQuickInfoCard = (title, bodyHtml) => `
        <div class="quick-info-card">
            <strong>${escapeHtml(title)}</strong>
            <div>${bodyHtml}</div>
        </div>
    `;
    const buildQuickInfoStep = (bodyHtml) => `<div class="quick-info-step">${bodyHtml}</div>`;
    const getContextHelpContent = (topic) => {
        switch (String(topic || '').trim()) {
            case 'settings':
                return {
                    title: '⚙ 설정 빠른 도움말',
                    body: [
                        buildQuickInfoCard('이 창의 역할', '시간, 채점 기준, 화면 비율, 도구 기본값을 현재 브라우저에 적용합니다. 적용하면 지금 화면에 바로 반영됩니다.'),
                        buildQuickInfoCard(
                            readSiteText('settingsModal.practiceModeTitle', '🎯 모드 설정'),
                            formatMultilineHtml(readSiteText('settingsModal.practiceModeHint', 'OFF = 실전: 과목 시간이 끝나면 자동으로 잠깁니다.\nON = 자유 풀이: 시간 제한 없이 응답합니다.'))
                        ),
                        buildQuickInfoCard(
                            readSiteText('settingsModal.scoringTitle', '📊 채점 기준'),
                            formatMultilineHtml(readSiteText('settingsModal.scoringHint', 'OFF = 건너뜀으로 별도 집계\nON = 상세 통계와 오답 복기에서 건너뜀도 오답으로 함께 봄'))
                        ),
                        buildQuickInfoCard(readSiteText('settingsModal.timerTitle', '🕒 타이머 설정'), '전체 시간, 과목 시간, 쉬는 시간을 바꿉니다. 타이머가 돌고 있으면 적용 시 멈추고 새 기준으로 다시 맞춥니다.'),
                        buildQuickInfoCard(readSiteText('settingsModal.layoutTitle', '📐 높이 비율 설정 (우측 영역)'), '타이머, 메모/그림판, 계산기 높이를 숫자로 조정합니다.')
                    ].concat(isAdvancedMode ? [
                        buildQuickInfoCard(readSiteText('settingsModal.guideTitle', '⏱️ 문항별 시간 가이드'), '고급 모드에서 문항당 목표 시간을 상단에 표시합니다. 풀이 속도가 흔들리는 구간을 바로 확인하는 용도입니다.'),
                        buildQuickInfoCard(readSiteText('settingsModal.toolTitle', '🧰 도구 설정'), '고급 모드에서 메모장 글씨 크기와 그림판 선 굵기를 조정합니다. 긴 풀이보다 실전형 메모에 맞춘 보조 설정입니다.')
                    ] : []).join('')
                };
            case 'utility':
                return {
                    title: '⋯ 보조 기능 도움말',
                    body: [
                        buildQuickInfoCard('이 창의 역할', isAdvancedMode
                            ? '연습 밖 기능과 고급 보관함을 한곳에서 엽니다.'
                            : '연습 밖 기능만 한곳에서 엽니다.'),
                        buildQuickInfoCard(readSiteText('utilityModal.statsTitle', '활성 세션 보기'), escapeHtml(readSiteText('utilityModal.statsDescription', '현재 열려 있는 세션과 최근 방문 기록을 확인합니다.'))),
                        buildQuickInfoCard(readSiteText('utilityModal.communityTitle', '커뮤니티'), escapeHtml(readSiteText('utilityModal.communityDescription', '공지, 질문, 후기, 개선요청을 한곳에서 확인합니다.'))),
                        isAdvancedMode
                            ? buildQuickInfoCard(readSiteText('utilityModal.archiveTitle', '기록 보관함'), escapeHtml(readSiteText('utilityModal.archiveDescription', '고급 모드 전용 기능입니다. 회차 기록, 성장 그래프, 오답노트, 복기 메모를 저장하고 노션/엑셀용으로 내보냅니다.')))
                            : '',
                        isAdvancedMode
                            ? buildQuickInfoCard(readSiteText('utilityModal.extensionTitle', '확장 안내'), escapeHtml(readSiteText('utilityModal.extensionDescription', '고급 모드 전용 보조 연동 안내입니다. CBT 결과 표를 더 쉽게 옮기는 흐름을 설명합니다.')))
                            : ''
                    ].filter(Boolean).join('')
                };
            case 'advanced-entry':
                return {
                    title: '🔒 고급 신청 · 진입 도움말',
                    body: [
                        buildQuickInfoCard('바로 열기', '승인 뒤에는 이메일과 비밀번호만 입력하면 됩니다.'),
                        buildQuickInfoCard('신청 순서', '<strong>신청서 작성</strong> -> <strong>1. 후원 내용 복사</strong> -> <strong>2. 후원하기</strong> -> <strong>3. 후원완료</strong>'),
                        buildQuickInfoCard('입력 기준', '신청과 로그인 모두 <strong>이메일</strong> 하나로 진행합니다.')
                    ].join('')
                };
            case 'advanced-tools':
                return {
                    title: '✨ 고급 활용 도움말',
                    body: [
                        buildQuickInfoCard('추천 흐름', '<strong>답안 체크</strong> -> <strong>정답 입력</strong> -> <strong>채점</strong> -> <strong>통계·TXT·CSV·정오표</strong>'),
                        buildQuickInfoCard('버튼 위치', '<strong>상단 상태</strong>에서 권한과 이용권을 확인하고, 채점 결과는 <strong>과목별 통계</strong>와 <strong>기록 보관함</strong>으로 이어집니다.'),
                        `<div class="quick-info-flow">
                            ${buildQuickInfoStep(readSiteText('advancedFeature.feature1Html', '<strong>1. 결과부터 확인</strong><br>맞은 수, 정답률, 건너뜀, 못 푼 문제를 먼저 봅니다.'))}
                            ${buildQuickInfoStep(readSiteText('advancedFeature.feature2Html', '<strong>2. 과목별 약점 확인</strong><br>과목별 상세 통계로 흔들린 영역을 바로 봅니다.'))}
                            ${buildQuickInfoStep(readSiteText('advancedFeature.feature3Html', '<strong>3. TXT로 기록 남기기</strong><br>문항별 상세 통계를 파일로 저장합니다.'))}
                            ${buildQuickInfoStep(readSiteText('advancedFeature.feature4Html', '<strong>4. 반복 연습 준비</strong><br>정오표, 이전 과목, 처음부터, 문항 가이드로 다시 풉니다.'))}
                        </div>`
                    ].join('')
                };
            case 'advanced-omr':
                return {
                    title: '❓ 고급 복기 도움말',
                    body: [
                        buildQuickInfoCard('기본 흐름', '답안 체크가 끝나면 정답 입력 -> 채점 -> 통계/TXT/CSV/정오표 순서로 보면 됩니다.'),
                        `<div class="quick-info-flow">
                            ${buildQuickInfoStep(readSiteText('advancedMode.coachStep1Html', '<strong>정답 입력</strong><br>실제 정답만 넣습니다.'))}
                            ${buildQuickInfoStep(readSiteText('advancedMode.coachStep2Html', '<strong>채점</strong><br>점수와 건너뜀을 먼저 봅니다.'))}
                            ${buildQuickInfoStep(readSiteText('advancedMode.coachStep3Html', '<strong>복기 버튼</strong><br>상세 통계, TXT, 정오표로 이어갑니다.'))}
                        </div>`,
                        buildQuickInfoCard('기록 저장', '<strong>문항별 통계</strong>와 <strong>성장 기록</strong>은 파일로 내려받거나 기록 보관함에 저장합니다. CSV를 불러온 뒤에도 바로 보관함에 반영할 수 있습니다.')
                    ].join('')
                };
            case 'omr-flow':
                return {
                    title: '채점과 기록 순서',
                    body: `
                        <div class="omr-flow-help">
                            <p class="omr-flow-lead">답안 기록은 실제 시험 기능이 아니라, 연습이 끝난 뒤 개인 자료를 채점하고 복기할 때 쓰는 도구입니다.</p>
                            <div class="omr-flow-steps">
                                <div class="omr-flow-step">
                                    <span class="omr-flow-number">1</span>
                                    <div class="omr-flow-content">
                                        <span class="omr-flow-chip answer">1 2 3 4 5</span>
                                        <strong>답안 체크</strong>
                                        <p>문제를 풀면서 선택지를 누릅니다. 누르면 다음 문항으로 바로 이동합니다.</p>
                                    </div>
                                </div>
                                <div class="omr-flow-step">
                                    <span class="omr-flow-number">2</span>
                                    <div class="omr-flow-content">
                                        <span class="omr-flow-chip skip">건너뛰기</span>
                                        <strong>모르는 문항 표시</strong>
                                        <p>지금 풀지 않을 문항은 건너뛰기로 남겨둡니다.</p>
                                    </div>
                                </div>
                                <div class="omr-flow-step">
                                    <span class="omr-flow-number">3</span>
                                    <div class="omr-flow-content">
                                        <span class="omr-flow-chip correct">정답 입력</span>
                                        <strong>정답 입력 모드</strong>
                                        <p>풀이가 끝난 뒤 누릅니다. 이때부터는 내가 고른 답이 아니라 실제 정답을 입력합니다.</p>
                                    </div>
                                </div>
                                <div class="omr-flow-step">
                                    <span class="omr-flow-number">4</span>
                                    <div class="omr-flow-content">
                                        <span class="omr-flow-chip import">CBT 정오표</span>
                                        <strong>고급: 정답표 붙여넣기</strong>
                                        <p>CBT 답지를 복사해 붙여넣으면 정답과 정답률을 한 번에 적용합니다.</p>
                                    </div>
                                </div>
                                <div class="omr-flow-step">
                                    <span class="omr-flow-number">5</span>
                                    <div class="omr-flow-content">
                                        <span class="omr-flow-chip grade">채점</span>
                                        <strong>결과 확인</strong>
                                        <p>맞은 수, 응답 수, 미응답, 정답률을 확인합니다.</p>
                                    </div>
                                </div>
                                <div class="omr-flow-step">
                                    <span class="omr-flow-number">6</span>
                                    <div class="omr-flow-content">
                                        <span class="omr-flow-chip review">통계 · 저장</span>
                                        <strong>고급: 복기 자료 정리</strong>
                                        <p>과목별 통계, TXT/CSV 다운로드, 기록 보관함 저장으로 이어갑니다.</p>
                                    </div>
                                </div>
                            </div>
                            <div class="omr-flow-note">처음에는 <strong>답안 체크 -> 정답 입력 -> 채점</strong>만 기억하면 됩니다. 고급 기능은 채점 뒤에 필요한 것만 이어서 사용하면 됩니다.</div>
                        </div>
                    `
                };
            case 'stats':
                return {
                    title: '🔥 활성 세션 읽는 법',
                    body: [
                        buildQuickInfoCard('현재 활성 세션', '최근 하트비트를 보낸 브라우저 탭 기준으로 집계합니다. 같은 사람이 여러 탭을 열면 여러 세션으로 보일 수 있습니다.'),
                        buildQuickInfoCard('최근 7일 방문 기록', '날짜별 흐름을 보는 용도입니다. 접속 추세를 보는 참고용으로 이해하면 됩니다.'),
                        buildQuickInfoCard('누적 방문 기록', '브라우저 기준 누적 방문 수입니다. 로그인 사용자 수가 아니라 전체 사용 흐름을 보기 위한 값입니다.')
                    ].join('')
                };
            case 'detail-stats':
                return {
                    title: '📋 과목별 상세 통계 읽는 법',
                    body: [
                        buildQuickInfoCard('먼저 볼 것', '<strong>응답 수, 미응답 수, 정답 수, 정답률</strong>을 과목별로 확인합니다.'),
                        buildQuickInfoCard('문항별 표', '기본은 문항번호 순서입니다. 표 위의 버튼으로 <strong>문항번호</strong> 또는 <strong>소요시간</strong> 기준 정렬을 바꿀 수 있습니다.'),
                        buildQuickInfoCard('오래 걸린 문항', '과목별 Top 문항을 보면 어느 문제에서 시간이 많이 쓰였는지 바로 확인할 수 있습니다.'),
                        buildQuickInfoCard('현재 채점 기준', configTreatSkippedAsWrong
                            ? '현재는 <strong>건너뜀도 오답에 포함</strong>합니다.'
                            : '현재는 <strong>건너뜀을 오답과 분리</strong>합니다.')
                    ].join('')
                };
            case 'bulk-import':
                return {
                    title: '링커리어 CBT 정오표 일괄입력',
                    body: [
                        buildQuickInfoCard('복사할 위치', '링커리어 CBT 답지 부분에서 <strong>NO.</strong>부터 표 전체를 긁어서 복사합니다.'),
                        buildQuickInfoCard('붙여넣는 방법', '답지가 여러 페이지라면 <strong>1~20, 21~40</strong>처럼 범위별 칸에 계속 붙여넣으면 됩니다.'),
                        buildQuickInfoCard('반영 흐름', '<strong>붙여넣기 분석</strong>으로 문항 번호와 정답 열을 확인한 뒤 <strong>정답 적용 및 채점</strong>을 누릅니다. 정답이 채점용 답안 기록에 반영되고 바로 채점됩니다.'),
                        buildQuickInfoCard('다른 형식 요청', '원하는 답 입력 방식이 있으면 답변 페이지를 스크롤해 복사한 텍스트와 캡처 이미지를 <strong>zhdlsqpdj@gmail.com</strong>으로 보내주세요.'),
                        '<figure class="bulk-import-help-figure"><img src="images/linkareer-cbt-answer-example.png" alt="링커리어 CBT 답지 표 복사 예시"><figcaption>예시처럼 NO., 정답, 입력답, 정오, 정답률이 보이는 표를 복사하면 됩니다.</figcaption></figure>'
                    ].join('')
                };
            default:
                return null;
        }
    };
    const openContextHelp = (topic) => {
        const content = getContextHelpContent(topic);
        if (!content || !quickInfoModal || !quickInfoModalTitle || !quickInfoModalBody) return;
        quickInfoModalTitle.textContent = content.title || '빠른 도움말';
        quickInfoModalBody.innerHTML = content.body || '';
        quickInfoModal.classList.remove('hidden');
    };
    renderSettingsBuildInfo();

    const DEFAULT_SUPPORT_CONFIG = {
        modalTitle: "",
        modalLead: "이용해주셔서 감사합니다.",
        modalBody: "서버, 도메인, 유지보수 비용은 취준생 개발자가 감당하고 있으며, 최대한 불편한 광고와 결제 없이 필수기능들을 사용할 수 있게 제공하고 있습니다.",
        modalPromise: "",
        modalHighlight: "문의사항",
        breakFooter: "쉬는 시간입니다. 일반 모드에는 추후 중간 광고가 들어갈 수 있고, 고급 모드에서는 광고 없이 연습 흐름을 유지할 예정입니다.",
        contactText: "zhdlsqpdj@gmail.com",
        contactUrl: "zhdlsqpdj@gmail.com",
        buttonLabel: "☕ 개발자 지원하기",
        buttonUrl: "https://toon.at/donate/foreveryonehappy",
        sponsorTickerSeconds: 4
    };
    const LEGACY_SUPPORT_PATTERNS = {
        modalTitle: [/광고\s*(없는|없이)/, /공동\s*툴/],
        modalLead: [/광고\s*(없는|없이)/, /배너\s*광고/, /결제\s*압박/, /결제\s*유도/],
        modalBody: [/무료\s*서버/, /100%\s*무료/, /상업적\s*배너/, /결제\s*유도/, /서버\s*비용/, /도메인\s*비용/, /광고\s*없고\s*결제/, /광고\s*없는\s*결제/],
        modalPromise: [/광고\s*(없는|없이)/, /무료\s*개방/, /합격/, /후기/],
        modalHighlight: [/십시일반/, /커피\s*한\s*잔/, /투네이션.*동참/, /합격\s*준비/, /개인적인.*준비/, /무료로\s*기능/, /다음\s*달/],
        breakFooter: [/운영\s*응원/],
        buttonLabel: [/후원하기/, /후원\s*페이지/, /쿨하게/, /커피\s*한\s*잔/, /운영\s*응원/]
    };

    function migrateLegacySupportConfig(config) {
        const nextConfig = { ...config };
        Object.entries(LEGACY_SUPPORT_PATTERNS).forEach(([key, patterns]) => {
            const current = String(nextConfig[key] || '');
            if (patterns.some((pattern) => pattern.test(current))) {
                nextConfig[key] = DEFAULT_SUPPORT_CONFIG[key];
            }
        });
        return nextConfig;
    }

    function applySupportConfig(config) {
        const support = { ...DEFAULT_SUPPORT_CONFIG, ...(config || {}) };
        const titleEl = document.getElementById('donateModalTitle');
        const leadEl = document.getElementById('donateModalLead');
        const bodyEl = document.getElementById('donateModalBody');
        const promiseEl = document.getElementById('donateModalPromise');
        const highlightEl = document.getElementById('donateModalHighlight');
        const contactEl = document.getElementById('donateModalContact');
        const buttonEl = document.getElementById('donateConfirmBtn');
        const breakHintEl = document.getElementById('breakSupportHint');

        if (titleEl) {
            const title = String(support.modalTitle || '').trim();
            titleEl.innerHTML = title ? formatInlineHtml(title) : '';
            titleEl.style.display = title ? '' : 'none';
        }
        if (leadEl) leadEl.innerHTML = formatMultilineHtml(support.modalLead);
        if (bodyEl) bodyEl.innerHTML = formatMultilineHtml(support.modalBody);
        if (promiseEl) promiseEl.innerHTML = formatMultilineHtml(support.modalPromise);
        if (highlightEl) highlightEl.innerHTML = formatMultilineHtml(support.modalHighlight);
        if (breakHintEl) breakHintEl.innerHTML = formatMultilineHtml(support.breakFooter);

        if (buttonEl) {
            buttonEl.textContent = support.buttonLabel || DEFAULT_SUPPORT_CONFIG.buttonLabel;
            buttonEl.dataset.href = support.buttonUrl || DEFAULT_SUPPORT_CONFIG.buttonUrl;
        }

        if (contactEl) {
            const contactText = (support.contactText || '').trim();
            const contactUrl = (support.contactUrl || '').trim();
            if (contactText && contactUrl) {
                const resolvedUrl = contactUrl.includes('@') && !/^https?:/i.test(contactUrl) && !/^mailto:/i.test(contactUrl)
                    ? `mailto:${contactUrl}`
                    : contactUrl;
                contactEl.innerHTML = `<a href="${escapeHtml(resolvedUrl)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; text-decoration:none; font-weight:600;">${escapeHtml(contactText)}</a>`;
                contactEl.style.display = 'block';
            } else if (contactText) {
                contactEl.textContent = contactText;
                contactEl.style.display = 'block';
            } else {
                contactEl.textContent = '';
                contactEl.style.display = 'none';
            }
        }
    }
    window.applySupportConfig = applySupportConfig;

    function formatPlanDailyCost(plan) {
        const days = Math.max(1, Number(plan?.days) || 1);
        const price = Math.max(0, Number(plan?.price) || 0);
        if (!price) return '';
        return `1일 약 ${Math.round(price / days).toLocaleString('ko-KR')}원`;
    }

    function renderManualSubscriptionPlans() {
        if (manualSubscriptionPlanCards) {
            manualSubscriptionPlanCards.innerHTML = remoteManualSubscriptionConfig.plans
                .filter((plan) => plan.enabled)
                .map((plan) => `
                    <div class="advanced-guide-plan-card">
                        <div style="font-size:12px; color:#9a3412; font-weight:700;">${escapeHtml(plan.label)}</div>
                        <div style="font-size:20px; font-weight:800; color:#7c2d12; margin-top:4px;">${formatCurrency(plan.price)} <span class="plan-daily-cost">${escapeHtml(formatPlanDailyCost(plan))}</span></div>
                        <div style="font-size:11px; color:#9a3412; line-height:1.6; margin-top:6px;">${escapeHtml(plan.highlight || `${plan.days}일 사용`)}</div>
                    </div>
                `)
                .join('');
        }
        if (manualSubscriptionPlanSelect) {
            const currentValue = manualSubscriptionPlanSelect.value;
            manualSubscriptionPlanSelect.innerHTML = remoteManualSubscriptionConfig.plans
                .filter((plan) => plan.enabled)
                .map((plan) => `<option value="${escapeHtml(plan.code)}">${escapeHtml(plan.label)} · ${formatCurrency(plan.price)}</option>`)
                .join('');
            if (currentValue && Array.from(manualSubscriptionPlanSelect.options).some((option) => option.value === currentValue)) {
                manualSubscriptionPlanSelect.value = currentValue;
            }
        }
        if (manualSubscriptionDonateLink) {
            manualSubscriptionDonateLink.href = remoteManualSubscriptionConfig.donationUrl || DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.donationUrl;
        }
        if (advancedFeatureDonateLink) {
            advancedFeatureDonateLink.href = remoteManualSubscriptionConfig.donationUrl || DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.donationUrl;
        }
    }

    function applyManualSubscriptionConfig(config, options = {}) {
        const { source = 'remote' } = options;
        remoteManualSubscriptionConfig = normalizeManualSubscriptionConfig(config);
        isAdvancedConfigReady = source === 'remote';
        renderManualSubscriptionPlans();
        ensureManualSubscriptionStartDate();
        if (isAdvancedConfigReady) {
            void syncStoredAdvancedLicenseState();
        }
    }
    window.applyManualSubscriptionConfig = applyManualSubscriptionConfig;
    applyManualSubscriptionConfig(undefined, { source: 'bootstrap' });

    function applyPublicConfigForMain(config) {
        if (!config || typeof config !== 'object') return;
        if (Object.prototype.hasOwnProperty.call(config, 'manualSubscriptionConfig')) {
            applyManualSubscriptionConfig(config.manualSubscriptionConfig, { source: 'remote' });
        }
    }

    window.addEventListener('skct:public-config', (event) => {
        applyPublicConfigForMain(event.detail);
    });
    applyPublicConfigForMain(window.__SKCT_PUBLIC_CONFIG);

    function getAdvancedLicenseExpiryTime(bundle) {
        const raw = bundle?.payload?.expiresAt;
        if (!raw) return Number.POSITIVE_INFINITY;
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
        const parsed = Date.parse(String(raw));
        return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
    }

    function formatAdvancedLicenseExpiry(bundle) {
        const expiryTime = getAdvancedLicenseExpiryTime(bundle);
        if (!Number.isFinite(expiryTime)) return '영구';
        return formatKstDateTime(expiryTime);
    }

    function hasPermanentAdvancedLicense(bundle) {
        return !Number.isFinite(getAdvancedLicenseExpiryTime(bundle));
    }

    async function verifyAdvancedLicenseBundle(bundle) {
        if (!bundle || !remoteManualSubscriptionConfig.licensePublicKeyPem) return null;
        try {
            const verified = await window.SKCTSubscriptionCrypto.verifyLicenseBundle(bundle, remoteManualSubscriptionConfig.licensePublicKeyPem);
            if (!verified) return null;
            const payloadStatus = String(bundle?.payload?.status || '').trim().toLowerCase();
            if (payloadStatus && payloadStatus !== 'active') return null;
            const expiryTime = getAdvancedLicenseExpiryTime(bundle);
            if (expiryTime < Date.now()) return null;
            return bundle;
        } catch (error) {
            return null;
        }
    }

    let advancedUserMessageShown = false;
    function showAdvancedUserMessageModal(text, options = {}) {
        const overlay = document.createElement('div');
        overlay.className = 'advanced-message-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
        const box = document.createElement('div');
        box.className = 'advanced-message-box';
        box.style.cssText = `max-width:${options.maxWidth || '420px'};width:100%;background:#fff;border-radius:14px;padding:22px 20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);`;
        const title = document.createElement('div');
        title.textContent = options.title || '📩 안내 메시지';
        title.style.cssText = 'font-weight:800;font-size:16px;color:#0f172a;margin-bottom:10px;';
        const body = document.createElement('div');
        if (options.html) body.innerHTML = String(options.html);
        else body.textContent = text;
        body.className = options.bodyClass || '';
        body.style.cssText = 'white-space:pre-wrap;line-height:1.6;color:#334155;font-size:14px;';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '확인';
        btn.style.cssText = 'margin-top:16px;width:100%;padding:10px;border:none;border-radius:8px;background:#0f766e;color:#fff;font-weight:700;cursor:pointer;';
        let closed = false;
        const close = () => {
            if (closed) return;
            closed = true;
            overlay.remove();
            if (typeof options.onClose === 'function') options.onClose();
        };
        btn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        box.appendChild(title); box.appendChild(body); box.appendChild(btn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // 고급 로그인 사용자에게 운영자가 보낸 개별 안내 메시지를 1회 표시(보조 기능, 실패해도 무시)
    function getAdvancedWelcomeName(bundle) {
        const payload = bundle?.payload || {};
        return String(
            payload.userIdentity
            || payload.siteNickname
            || payload.nickname
            || payload.displayName
            || payload.loginId
            || payload.email
            || '사용자'
        ).trim() || '사용자';
    }

    function maybeShowAdvancedWelcomeMessage() {
        if (!isAdvancedMode || !verifiedAdvancedLicenseBundle) return false;
        try {
            const payload = verifiedAdvancedLicenseBundle.payload || {};
            const key = getAdvancedLoginIdKey(payload.loginId || payload.email || payload.licenseId || getAdvancedWelcomeName(verifiedAdvancedLicenseBundle));
            const seenKey = `skct_adv_welcome_seen_${key || 'session'}`;
            const name = getAdvancedWelcomeName(verifiedAdvancedLicenseBundle);
            const message = readSiteText(
                'messages.advancedWelcomeBody',
                '고급 모드가 열렸습니다.\n\n사용할 수 있는 기능\n- 회차별 결과와 문항 시간 저장\n- CBT 정오표 일괄입력과 과목별 통계\n- 성장 그래프와 오답 원인 분석\n- 오답노트, 복기 메모, CSV·노션용 표\n- 팝업 비율과 반복 연습 제어\n\n{닉네임}님, 이용해주셔서 감사합니다.\n문의: zhdlsqpdj@gmail.com',
                { name, '닉네임': name }
            );
            if (advancedAccessStatus) {
                advancedAccessStatus.textContent = message.replace(/\s*\n\s*/g, ' ');
                advancedAccessStatus.style.color = '#0f766e';
            }
            if (sessionStorage.getItem(seenKey) === '1') return false;
            sessionStorage.setItem(seenKey, '1');
            setTimeout(() => maybeShowAdvancedUserMessage(), 80);
            return true;
        } catch (e) {
            return false;
        }
    }

    async function maybeShowAdvancedUserMessage() {
        if (advancedUserMessageShown) return;
        try {
            const loginId = verifiedAdvancedLicenseBundle?.payload?.loginId || '';
            const key = getAdvancedLoginIdKey(loginId);
            if (!key) return;
            const payload = await postToSecureApi('/advanced/message', { loginIdKey: key }, '');
            const data = payload?.record || null;
            if (!data || !data.text) return;
            const stamp = Number(data.updatedAt || data.createdAt || 0);
            const seenKey = `skct_adv_msg_seen_${key}`;
            const seen = Number(localStorage.getItem(seenKey) || 0);
            if (stamp && stamp <= seen) return; // 이미 본 메시지
            advancedUserMessageShown = true;
            showAdvancedUserMessageModal(String(data.text));
            try { localStorage.setItem(seenKey, String(stamp || Date.now())); } catch (e) { /* noop */ }
        } catch (e) { /* 보조 기능 */ }
    }

    let archiveTokenCache = { key: '', result: null, promise: null, fetchedAt: 0 };

    function getAdvancedArchiveTokenCacheKey(bundle) {
        const payload = bundle?.payload || {};
        return [
            payload.licenseId || '',
            payload.loginId || payload.email || payload.userIdentity || '',
            payload.expiresAt || '',
            payload.status || 'active'
        ].join('|');
    }

    async function ensureAdvancedArchiveToken(options = {}) {
        const { force = false } = options;
        if (!verifiedAdvancedLicenseBundle) return null;
        const cacheKey = getAdvancedArchiveTokenCacheKey(verifiedAdvancedLicenseBundle);
        const fresh = archiveTokenCache.key === cacheKey
            && archiveTokenCache.result
            && Date.now() - archiveTokenCache.fetchedAt < 45 * 60 * 1000;
        if (!force && fresh) return archiveTokenCache.result;
        if (!force && archiveTokenCache.key === cacheKey && archiveTokenCache.promise) {
            return archiveTokenCache.promise;
        }
        archiveTokenCache.key = cacheKey;
        archiveTokenCache.promise = postToSecureApi('/advanced/archive-token', {
            licenseBundle: verifiedAdvancedLicenseBundle
        }, '기록 보관함 자동 로그인을 준비하지 못했습니다.').then((result) => {
            archiveTokenCache = {
                key: cacheKey,
                result,
                promise: null,
                fetchedAt: Date.now()
            };
            return result;
        }).catch((error) => {
            archiveTokenCache.promise = null;
            throw error;
        });
        return archiveTokenCache.promise;
    }

    function createArchiveLaunchUrl({ popup = true, tokenResult = null } = {}) {
        const nonceBytes = new Uint32Array(2);
        crypto.getRandomValues(nonceBytes);
        const nonce = `${Date.now().toString(36)}-${Array.from(nonceBytes).map((value) => value.toString(36)).join('-')}`;
        try {
            sessionStorage.setItem(ADVANCED_ARCHIVE_LAUNCH_STORAGE_KEY, JSON.stringify({
                nonce,
                createdAt: Date.now(),
                customToken: tokenResult?.customToken || '',
                identity: tokenResult?.identity || '',
                readonly: tokenResult?.readonly === true,
                uid: tokenResult?.uid || ''
            }));
        } catch (error) {
            // sessionStorage가 막힌 브라우저에서는 보관함 쪽에서 재로그인 안내로 떨어진다.
        }
        const archiveUrl = new URL('study-archive.html', window.location.href);
        archiveUrl.searchParams.set('archiveLaunch', nonce);
        if (popup) archiveUrl.searchParams.set('popup', '1');
        return archiveUrl.toString();
    }

    async function prepareArchiveLaunchUrl(options = {}) {
        const tokenResult = await ensureAdvancedArchiveToken(options).catch(() => null);
        return createArchiveLaunchUrl({ popup: options.popup !== false, tokenResult });
    }

    function notifyArchiveFrameImport() {
        try {
            archiveFrame?.contentWindow?.postMessage({ type: 'skct:archive-import-queue' }, window.location.origin);
        } catch (error) {
            // 보관함 iframe이 아직 준비 전이면 열릴 때 자체 큐를 다시 확인한다.
        }
    }

    async function prewarmStudyArchiveFrame(options = {}) {
        if (!isAdvancedMode || !archiveFrame) return '';
        const url = await prepareArchiveLaunchUrl({ popup: true, ...options });
        latestArchiveFrameUrl = url;
        if (archiveFrame.getAttribute('src') !== url) {
            archiveFrame.setAttribute('src', url);
        }
        return url;
    }

    function setAdvancedModeState(nextValue) {
        isAdvancedMode = nextValue === true;
        runtimeFlags.advanced = isAdvancedMode;
        const practiceModeInput = document.getElementById('cfgPracticeMode');
        if (!isAdvancedMode) {
            isPracticeMode = false;
        }
        if (practiceModeInput) {
            practiceModeInput.checked = isPracticeMode;
            practiceModeInput.disabled = !isAdvancedMode;
            practiceModeInput.closest('label')?.classList.toggle('is-disabled', !isAdvancedMode);
        }
        document.body.classList.toggle('advanced-mode', isAdvancedMode);
        document.body.classList.toggle('advanced-popup-mode', isAdvancedMode && isPopupMode);
        if (isAdvancedMode) {
            document.getElementById('donateToggle')?.classList.remove('attention-active');
            const welcomeShown = maybeShowAdvancedWelcomeMessage();
            if (!welcomeShown) {
                maybeShowAdvancedUserMessage();
            }
            void prewarmStudyArchiveFrame();
            setAdvancedRailCollapsed(readAdvancedRailCollapsedPreference(), { persist: false });
        } else {
            archiveTokenCache = { key: '', result: null, promise: null, fetchedAt: 0 };
            setAdvancedRailCollapsed(false, { persist: false });
        }
        document.title = isAdvancedMode
            ? `${document.title.replace(' | 고급버전', '')} | 고급버전`
            : document.title.replace(' | 고급버전', '');
        renderSettingsBuildInfo();
        if (typeof updateModeUI === 'function') updateModeUI();
        if (typeof renderOMR === 'function') renderOMR();
        updateUtilityArchiveCardState();
        updateAdvancedModeStatusBar();
        syncToolsRightRail();
        requestAnimationFrame(() => {
            syncToolsRightRail();
        });
        window.setTimeout(() => {
            try {
                updateTimerActionButtons();
            } catch (error) {
                // 타이머 버튼은 뒤에서 초기화되므로, 아직 준비 전이면 다음 UI 갱신에서 다시 맞춘다.
            }
        }, 0);
    }

    async function syncStoredAdvancedLicenseState(options = {}) {
        const { silent = false } = options;
        const storedBundle = readStoredAdvancedLicenseBundle();
        const canVerifyStoredBundle = Boolean(
            remoteManualSubscriptionConfig.licensePublicKeyPem
            && window.SKCTSubscriptionCrypto?.verifyLicenseBundle
        );
        if (storedBundle && !canVerifyStoredBundle) {
            verifiedAdvancedLicenseBundle = null;
            if (advancedModeRequested && isAdvancedConfigReady) {
                setAdvancedModeState(false);
                removeAdvancedQueryParam();
                if (!silent && advancedAccessStatus) {
                    advancedAccessStatus.textContent = readSiteText('messages.advancedConfigMissing', '아직 라이선스 검증 공개키가 설정되지 않았습니다. 관리자 설정 저장 후 다시 시도해주세요.');
                    advancedAccessStatus.style.color = '#b91c1c';
                }
            }
            updateAdvancedAccessPanel();
            return null;
        }
        const verifiedBundle = await verifyAdvancedLicenseBundle(storedBundle);
        verifiedAdvancedLicenseBundle = verifiedBundle;
        if (!verifiedBundle && storedBundle) {
            clearStoredAdvancedLicenseBundle();
        }
        if (!verifiedBundle) {
            if (advancedModeRequested) {
                setAdvancedModeState(false);
                removeAdvancedQueryParam();
                if (!silent && advancedAccessStatus) {
                    advancedAccessStatus.textContent = readSiteText('messages.advancedNeedRelogin', '이 브라우저의 라이선스가 없거나 만료되었습니다. 로그인 ID 또는 신청 이메일과 비밀번호로 다시 확인해주세요.');
                    advancedAccessStatus.style.color = '#b91c1c';
                }
            }
            updateAdvancedAccessPanel();
            return null;
        }
        if (advancedModeRequested) {
            setAdvancedModeState(true);
        }
        updateAdvancedAccessPanel();
        return verifiedBundle;
    }

    function renderManualRequestLookup(record, payload) {
        if (!manualSubscriptionLookupResult) return;
        const statusMap = {
            pending: '승인 대기',
            approved: '승인 완료',
            rejected: '반려',
            fulfilled: '발급 완료'
        };
        const response = payload?.adminResponse || {};
        manualSubscriptionLookupResult.innerHTML = `
            <div style="padding:12px; border-radius:8px; background:#ffffff; border:1px solid #bfdbfe;">
                <div style="font-weight:800; color:#1d4ed8; margin-bottom:8px;">${escapeHtml(statusMap[record.status] || record.status || '대기')}</div>
                <div style="font-size:12px; color:#334155; line-height:1.75;">
                    <div><strong>신청 플랜</strong>: ${escapeHtml(record.planLabel || '-')}</div>
                    <div><strong>신청 시각</strong>: ${escapeHtml(formatKstDateTime(record.createdAt))}</div>
                    <div><strong>후원 메모</strong>: ${escapeHtml(payload?.donationMemo || payload?.donationName || '-')}</div>
                    <div><strong>이용 시작일</strong>: ${escapeHtml(payload?.requestedStartDate || '-')}</div>
                    <div><strong>이메일</strong>: ${escapeHtml(payload?.email || '-')}</div>
                    ${payload?.memo ? `<div><strong>신청 메모</strong>: ${escapeHtml(payload.memo)}</div>` : ''}
                    ${response.statusMessage ? `<div><strong>처리 메모</strong>: ${escapeHtml(response.statusMessage)}</div>` : ''}
                    ${response.licenseBundle ? `<div style="margin-top:8px; padding:10px; border-radius:8px; background:#eff6ff; border:1px solid #bfdbfe;"><strong>고급 라이선스</strong>: 발급 완료<br><strong>사용 종료일</strong>: ${escapeHtml(response.expiresAt || '영구')}<br><button id="manualLicenseApplyBtn" type="button" style="margin-top:8px; padding:8px 10px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-weight:700; cursor:pointer;">이 브라우저에 적용하고 고급 모드 열기</button></div>` : ''}
                </div>
            </div>
        `;
        const applyBtn = document.getElementById('manualLicenseApplyBtn');
        if (applyBtn && response.licenseBundle) {
            applyBtn.addEventListener('click', async () => {
                const verifiedBundle = await verifyAdvancedLicenseBundle(response.licenseBundle);
                if (!verifiedBundle) {
                    manualSubscriptionLookupResult.innerHTML += '<div style="margin-top:8px; font-size:12px; color:#b91c1c;">라이선스가 유효하지 않거나 이미 만료되었습니다. 관리자에게 다시 문의해주세요.</div>';
                    return;
                }
                writeStoredAdvancedLicenseBundle(verifiedBundle);
                verifiedAdvancedLicenseBundle = verifiedBundle;
                openAdvancedModeWindow();
            });
        }
    }

    const isLegacyDefaultTimerConfig = (cfg) => {
        if (!cfg || typeof cfg !== 'object') return false;
        const total = sanitizeMinutes(cfg.total, -1);
        const subj = sanitizeMinutes(cfg.subj, -1);
        const brk = sanitizeMinutes(cfg.brk, -1);
        return total === 79 && subj === 15 && brk === 1 && cfg.source !== 'user';
    };

    const ADVANCED_TRIGGER_TAP_COUNT = 7;
    const ADVANCED_TRIGGER_TIMEOUT_MS = 1800;
    const ADVANCED_POPUP_PATH = 'advanced-tools.html';

    const buildAdvancedLaunchUrl = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('advanced', '1');
        url.searchParams.set('popup', 'advanced');
        url.searchParams.set('intro', '0');
        url.searchParams.delete('popupEditor');
        return url.toString();
    };

    function buildAdvancedPopupWindowConfig() {
        const base = normalizePopupLayout(remotePopupLayout).window;
        const widthRatio = roundRatio(clampNumber(Math.max(base.widthRatio, 0.345), 0.25, 0.42));
        return {
            ...base,
            widthRatio,
            heightRatio: roundRatio(clampNumber(Math.max(base.heightRatio, 0.98), 0.75, 0.98)),
            leftRatio: roundRatio(clampNumber(1 - widthRatio, 0, Math.max(0, 1 - widthRatio))),
            topRatio: 0
        };
    }

    function readAdvancedRailCollapsedPreference() {
        try {
            return localStorage.getItem(ADVANCED_RAIL_COLLAPSED_STORAGE_KEY) === '1';
        } catch (error) {
            return false;
        }
    }

    function setAdvancedRailCollapsed(nextValue, options = {}) {
        const { persist = true } = options;
        const shouldCollapse = isAdvancedMode && nextValue === true;
        document.body.classList.toggle('advanced-sidebar-collapsed', shouldCollapse);
        if (advancedRailCollapseBtn) {
            advancedRailCollapseBtn.setAttribute('aria-pressed', shouldCollapse ? 'true' : 'false');
        }
        if (advancedRailRestoreBtn) {
            advancedRailRestoreBtn.hidden = !shouldCollapse;
        }
        if (persist) {
            try {
                localStorage.setItem(ADVANCED_RAIL_COLLAPSED_STORAGE_KEY, shouldCollapse ? '1' : '0');
            } catch (error) {
                // Storage may be unavailable in private modes.
            }
        }
        requestAnimationFrame(() => {
            if (typeof resizeCanvas === 'function') resizeCanvas();
        });
    }

    const updateAdvancedAccessPanel = () => {
        if (!advancedAccessSummary) return;
        const cooldownRemainingMs = getAdvancedCooldownRemainingMs();
        if (!isAdvancedConfigReady) {
            advancedAccessSummary.textContent = readSiteText('messages.advancedLoading', '고급 라이선스 정보를 불러오는 중입니다.');
            if (advancedAccessSubmitBtn) advancedAccessSubmitBtn.disabled = true;
            updateAdvancedModeStatusBar();
            return;
        }
        if (!remoteManualSubscriptionConfig.licensePublicKeyPem) {
            advancedAccessSummary.textContent = readSiteText('messages.advancedConfigMissing', '아직 라이선스 검증 공개키가 설정되지 않았습니다. 관리자 설정 저장 후 다시 시도해주세요.');
            if (advancedAccessSubmitBtn) advancedAccessSubmitBtn.disabled = true;
            updateAdvancedModeStatusBar();
            return;
        }
        if (cooldownRemainingMs > 0) {
            advancedAccessSummary.textContent = readSiteText('messages.advancedCooldown', '이메일과 비밀번호를 여러 번 틀려 {seconds}초 동안 다시 시도할 수 없습니다.', {
                seconds: Math.ceil(cooldownRemainingMs / 1000)
            });
        } else if (verifiedAdvancedLicenseBundle) {
            if (hasPermanentAdvancedLicense(verifiedAdvancedLicenseBundle)) {
                advancedAccessSummary.textContent = readSiteText('messages.advancedUnlockedPermanent', '신청하신 이메일과 비밀번호로 로그인이 가능합니다.');
            } else {
                advancedAccessSummary.textContent = readSiteText('messages.advancedUnlocked', '신청하신 이메일과 비밀번호로 로그인이 가능합니다. (만료: {expiry})', {
                    expiry: formatAdvancedLicenseExpiry(verifiedAdvancedLicenseBundle)
                });
            }
        } else {
            advancedAccessSummary.textContent = readSiteText('messages.advancedAvailable', '신청 이메일 또는 기존 로그인 ID와 비밀번호를 입력해 주세요.');
        }
        if (advancedAccessSubmitBtn) advancedAccessSubmitBtn.disabled = cooldownRemainingMs > 0;
        updateAdvancedModeStatusBar();
    };

    const updateUtilityArchiveCardState = () => {
        if (studyArchiveOpenBtn) {
            studyArchiveOpenBtn.classList.toggle('hidden', !isAdvancedMode);
        }
        if (advancedStatusToggle) {
            advancedStatusToggle.classList.toggle('hidden', !isAdvancedMode);
        }
        if (utilityModalDescription) {
            utilityModalDescription.innerHTML = isAdvancedMode
                ? readSiteText('utilityModal.descriptionAdvancedHtml', '연습 밖 기능과 고급 보관함을 모아 둔 공간입니다. 자세한 기준은 ?에서 확인하세요.')
                : readSiteText('utilityModal.descriptionHtml', '연습 밖 기능만 모아 둔 공간입니다. 자세한 기준은 ?에서 확인하세요.');
        }
        if (utilityArchiveDescription) {
            utilityArchiveDescription.textContent = readSiteText('utilityModal.archiveDescription', '고급 모드 전용입니다. 자료를 저장하려면 보관함 로그인으로 다시 확인합니다.');
        }
    };

    function readAdvancedIdentityLabel(bundle) {
        const payload = bundle?.payload || {};
        return String(
            payload.userIdentity
            || payload.siteNickname
            || payload.nickname
            || payload.displayName
            || payload.loginId
            || payload.email
            || payload.requestEmail
            || ''
        ).trim();
    }

    function updateAdvancedModeStatusBar() {
        if (advancedModeStatusTitle) advancedModeStatusTitle.textContent = readSiteText('advancedMode.statusTitle', '고급 모드 상태');
        if (advancedModeStatusLead) advancedModeStatusLead.innerHTML = readSiteText('advancedMode.statusLeadHtml', '이 브라우저에 열려 있는 고급 상태를 바로 확인합니다.');
        if (advancedModeLabelState) advancedModeLabelState.textContent = readSiteText('advancedMode.labelState', '상태');
        if (advancedModeLabelLogin) advancedModeLabelLogin.textContent = readSiteText('advancedMode.labelLogin', '로그인');
        if (advancedModeLabelExpiry) {
            advancedModeLabelExpiry.textContent = verifiedAdvancedLicenseBundle && hasPermanentAdvancedLicense(verifiedAdvancedLicenseBundle)
                ? readSiteText('advancedMode.labelPlan', '이용권')
                : readSiteText('advancedMode.labelExpiry', '만료');
        }
        if (advancedModeLabelArchive) advancedModeLabelArchive.textContent = readSiteText('advancedMode.labelArchive', '기록 보관함');
        if (advancedModeLabelRail) advancedModeLabelRail.textContent = readSiteText('advancedMode.labelRail', '실제환경 여백');
        if (advancedModeStatusFootnote) advancedModeStatusFootnote.innerHTML = readSiteText('advancedMode.footnoteHtml', '채점한 기록은 보관함 저장으로 바로 연결할 수 있고, 고급 모드에서 열린 창이면 계정도 자동으로 확인합니다.');
        if (advancedModeGuideBtn) advancedModeGuideBtn.textContent = readSiteText('advancedMode.guideButton', '고급 활용 보기');
        if (advancedModeArchiveBtn) advancedModeArchiveBtn.textContent = readSiteText('advancedMode.archiveButton', '기록 보관함');
        if (advancedCoachTitle) advancedCoachTitle.textContent = readSiteText('advancedMode.coachTitle', '복기 버튼 순서');
        if (advancedCoachLead) advancedCoachLead.innerHTML = readSiteText('advancedMode.coachLeadHtml', '풀이 후에는 아래 순서대로 누르면 됩니다.');
        if (advancedCoachStep1) advancedCoachStep1.innerHTML = readSiteText('advancedMode.coachStep1Html', '<strong>1. 정답 입력</strong><br>답안 체크가 끝나면 실제 정답을 넣습니다.');
        if (advancedCoachStep2) advancedCoachStep2.innerHTML = readSiteText('advancedMode.coachStep2Html', '<strong>2. 채점</strong><br>맞은 수, 정답률, 건너뜀, 미응답을 먼저 확인합니다.');
        if (advancedCoachStep3) advancedCoachStep3.innerHTML = readSiteText('advancedMode.coachStep3Html', '<strong>3. 복기 저장</strong><br>과목별 통계, TXT, CSV, 정오표로 이어갑니다.');
        if (advancedCoachHint) advancedCoachHint.innerHTML = readSiteText('advancedMode.coachHintHtml', '<strong>이전 과목</strong>은 현재 과목 답안을 지우고 이전 과목으로 돌아가며, <strong>처음부터</strong>는 전체 답안을 지우고 다시 시작합니다.');
        if (advancedCoachGuideBtn) advancedCoachGuideBtn.textContent = readSiteText('advancedMode.coachGuideButton', '전체 흐름 보기');
        if (helpAdvancedLinkBtn) helpAdvancedLinkBtn.textContent = readSiteText('helpModal.advancedLinkButton', '고급 기능 보기');

        if (advancedModeValueState) {
            advancedModeValueState.textContent = isAdvancedMode
                ? readSiteText('advancedMode.valueStateActive', '활성')
                : readSiteText('advancedMode.valueStateInactive', '비활성');
        }
        if (advancedModeValueLogin) {
            advancedModeValueLogin.textContent = readAdvancedIdentityLabel(verifiedAdvancedLicenseBundle)
                || readSiteText('advancedMode.valueLoginFallback', '확인 전');
        }
        if (advancedModeValueExpiry) {
            advancedModeValueExpiry.textContent = verifiedAdvancedLicenseBundle
                ? (hasPermanentAdvancedLicense(verifiedAdvancedLicenseBundle)
                    ? readSiteText('advancedMode.valuePermanentPlan', '영구 이용권')
                    : formatAdvancedLicenseExpiry(verifiedAdvancedLicenseBundle))
                : readSiteText('advancedMode.valueExpiryFallback', '확인 전');
        }
        if (advancedModeValueArchive) {
            advancedModeValueArchive.textContent = isAdvancedMode
                ? readSiteText('advancedMode.valueArchiveReady', '사용 가능')
                : readSiteText('advancedMode.valueArchiveBlocked', '잠김');
        }
        if (advancedModeValueRail) {
            advancedModeValueRail.textContent = isAdvancedMode
                ? readSiteText('advancedMode.valueRailReady', '복원됨')
                : readSiteText('advancedMode.valueRailBlocked', '숨김');
        }
        if (advancedModeArchiveBtn) {
            advancedModeArchiveBtn.disabled = !isAdvancedMode;
        }
    }

    async function fetchSubscriptionRequestRecord(requestId) {
        const trimmedRequestId = String(requestId || '').trim();
        if (!trimmedRequestId) return null;
        const secureApiPayload = await postToSecureApi(
            '/subscription/request-record',
            { requestId: trimmedRequestId },
            readSiteText('messages.manualLookupError', '신청 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        );
        if (secureApiPayload) {
            const record = secureApiPayload?.record && typeof secureApiPayload.record === 'object'
                ? secureApiPayload.record
                : null;
            return record ? { ...record, requestId: String(secureApiPayload.requestId || trimmedRequestId).trim() || trimmedRequestId } : null;
        }
        return null;
    }

    async function resolveSubscriptionRequestId(identifier, requestPassword) {
        const normalizedEmail = normalizeLookupEmail(identifier);
        if (!isLikelyEmailAddress(normalizedEmail)) return '';
        const lookupKey = await buildSubscriptionLookupKey(normalizedEmail, requestPassword);
        if (!lookupKey) return '';
        const secureApiPayload = await postToSecureApi(
            '/subscription/lookup',
            { lookupKey },
            readSiteText('messages.manualLookupError', '신청 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        );
        if (secureApiPayload) {
            return String(secureApiPayload?.requestId || '').trim();
        }
        return '';
    }

    async function fetchAdvancedAccountLicenseRecord(loginId) {
        const loginIdKey = getAdvancedLoginIdKey(loginId);
        if (!loginIdKey) return null;
        const secureApiPayload = await postToSecureApi(
            '/advanced/license',
            { loginIdKey },
            readSiteText('messages.advancedLookupError', '고급 계정 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        );
        if (secureApiPayload) {
            const record = secureApiPayload?.record;
            return record && typeof record === 'object' ? record : null;
        }
        return null;
    }

    async function hydrateAdvancedLicenseFromRequest(requestId, requestPassword, options = {}) {
        const { persist = true } = options;
        const resolvedRequestId = await resolveSubscriptionRequestId(requestId, requestPassword);
        if (!resolvedRequestId) {
            return { ok: false, reason: 'not_found' };
        }
        const record = await fetchSubscriptionRequestRecord(resolvedRequestId);
        if (!record) {
            return { ok: false, reason: 'not_found' };
        }
        let payload = null;
        try {
            payload = await window.SKCTSubscriptionCrypto.decryptRequestPayloadForUser(record, requestPassword);
        } catch (error) {
            return { ok: false, reason: 'invalid_password' };
        }
        const response = payload?.adminResponse || {};
        if (!response.licenseBundle) {
            return { ok: false, reason: record.status === 'rejected' ? 'rejected' : 'pending', record, payload };
        }
        const verifiedBundle = await verifyAdvancedLicenseBundle(response.licenseBundle);
        if (!verifiedBundle) {
            return { ok: false, reason: 'invalid_license', record, payload };
        }
        if (persist) {
            writeStoredAdvancedLicenseBundle(verifiedBundle);
            verifiedAdvancedLicenseBundle = verifiedBundle;
            pendingAdvancedActivationBundle = null;
        } else {
            pendingAdvancedActivationBundle = verifiedBundle;
        }
        return { ok: true, record, payload, bundle: verifiedBundle };
    }

    async function hydrateAdvancedLicenseFromAdvancedAccount(loginId, password, options = {}) {
        const { persist = true } = options;
        const normalizedLoginId = normalizeAdvancedLoginId(loginId);
        if (!normalizedLoginId) {
            return { ok: false, reason: 'empty' };
        }
        if (!password) {
            return { ok: false, reason: 'empty_password' };
        }
        const record = await fetchAdvancedAccountLicenseRecord(normalizedLoginId);
        if (!record) {
            return { ok: false, reason: 'not_found' };
        }
        if (String(record.status || '').trim() && String(record.status).trim().toLowerCase() !== 'active') {
            return { ok: false, reason: 'expired', record };
        }
        let bundle = null;
        try {
            bundle = await window.SKCTSubscriptionCrypto.decryptJsonWithPassword({
                cipher: record.bundleCipher,
                iv: record.bundleIv,
                salt: record.bundleSalt
            }, password);
        } catch (error) {
            return { ok: false, reason: 'invalid_password', record };
        }
        if (getAdvancedLoginIdKey(bundle?.payload?.loginId || '') !== getAdvancedLoginIdKey(normalizedLoginId)) {
            return { ok: false, reason: 'invalid_license', record };
        }
        const verifiedBundle = await verifyAdvancedLicenseBundle(bundle);
        if (!verifiedBundle) {
            return { ok: false, reason: 'invalid_license', record };
        }
        if (persist) {
            writeStoredAdvancedLicenseBundle(verifiedBundle);
            verifiedAdvancedLicenseBundle = verifiedBundle;
            pendingAdvancedActivationBundle = null;
        } else {
            pendingAdvancedActivationBundle = verifiedBundle;
        }
        return { ok: true, record, bundle: verifiedBundle };
    }

    async function hydrateAdvancedLicenseFromCredentials(identifier, password, options = {}) {
        const trimmedIdentifier = String(identifier || '').trim();
        if (isLikelyEmailAddress(trimmedIdentifier)) {
            const requestResult = await hydrateAdvancedLicenseFromRequest(trimmedIdentifier, password, options);
            if (requestResult.ok || requestResult.reason !== 'not_found') {
                return { ...requestResult, mode: 'request' };
            }
            const accountResult = await hydrateAdvancedLicenseFromAdvancedAccount(trimmedIdentifier, password, options);
            return { ...accountResult, mode: 'account' };
        }
        const accountResult = await hydrateAdvancedLicenseFromAdvancedAccount(trimmedIdentifier, password, options);
        return { ...accountResult, mode: 'account' };
    }

    async function validateAdvancedCredentialsDetailed(identifier, password) {
        if (!String(identifier || '').trim() && !String(password || '').trim()) {
            return { ok: false, reason: 'empty' };
        }
        if (!String(identifier || '').trim()) {
            return { ok: false, reason: 'empty' };
        }
        if (!String(password || '')) {
            return { ok: false, reason: 'empty_password' };
        }
        return hydrateAdvancedLicenseFromCredentials(identifier, password, { persist: false });
    }

    const lookupManualSubscriptionRequest = async () => {
        if (!manualSubscriptionLookupResult) return;
        const lookupEmail = manualSubscriptionLookupIdInput?.value.trim() || '';
        const requestPassword = manualSubscriptionLookupPasswordInput?.value || '';
        if (!lookupEmail || !requestPassword) {
            manualSubscriptionLookupResult.textContent = readSiteText('messages.manualLookupRequired', '신청 이메일과 조회 비밀번호를 모두 입력해주세요.');
            return;
        }
        if (!isLikelyEmailAddress(lookupEmail)) {
            manualSubscriptionLookupResult.textContent = readSiteText('messages.manualLookupEmailOnly', '신청 조회는 신청 이메일과 조회 비밀번호로만 할 수 있습니다.');
            return;
        }
        try {
            const resolvedRequestId = await resolveSubscriptionRequestId(lookupEmail, requestPassword);
            if (!resolvedRequestId) {
                manualSubscriptionLookupResult.textContent = readSiteText('messages.manualLookupNotFound', '해당 이메일로 조회되는 신청을 찾지 못했습니다. 신청 이메일 또는 조회 비밀번호를 다시 확인해주세요.');
                return;
            }
            const record = await fetchSubscriptionRequestRecord(resolvedRequestId);
            if (!record) {
                manualSubscriptionLookupResult.textContent = readSiteText('messages.manualLookupNotFound', '해당 이메일로 조회되는 신청을 찾지 못했습니다. 신청 이메일 또는 조회 비밀번호를 다시 확인해주세요.');
                return;
            }
            const payload = await window.SKCTSubscriptionCrypto.decryptRequestPayloadForUser(record, requestPassword);
            renderManualRequestLookup(record, payload);
        } catch (error) {
            manualSubscriptionLookupResult.textContent = error?.message || readSiteText('messages.manualLookupDecryptError', '조회 비밀번호가 일치하지 않거나 요청을 복호화하지 못했습니다.');
        }
    };

    const openAdvancedModeWindow = async () => {
        const validBundle = await syncStoredAdvancedLicenseState({ silent: true });
        if (!validBundle) {
            if (advancedAccessStatus) {
                    advancedAccessStatus.textContent = readSiteText('messages.advancedNeedRelogin', '이 브라우저의 라이선스가 없거나 만료되었습니다. 로그인 ID 또는 신청 이메일과 비밀번호로 다시 확인해주세요.');
                advancedAccessStatus.style.color = '#b91c1c';
            }
            return false;
        }
        const activateCurrentWindow = () => {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('advanced', '1');
            nextUrl.searchParams.set('intro', '0');
            nextUrl.searchParams.delete('popupEditor');
            window.history.replaceState({}, '', nextUrl.toString());
            setAdvancedModeState(true);
            updateAdvancedAccessPanel();
        };
        activateCurrentWindow();
        return true;
    };

    window.addEventListener('message', async (event) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data && typeof event.data === 'object' ? event.data : null;
        if (data?.type !== 'skct-advanced-activate') return;
        const verifiedBundle = await verifyAdvancedLicenseBundle(data.bundle);
        if (!verifiedBundle) return;
        writeStoredAdvancedLicenseBundle(verifiedBundle);
        verifiedAdvancedLicenseBundle = verifiedBundle;
        pendingAdvancedActivationBundle = null;
        setAdvancedModeState(true);
        updateAdvancedAccessPanel();
    });

    const omrState = {
        myAnswers: {},
        correctAnswers: {},
        mode: 'answer', // 'answer' | 'score'
        currentGlobalIndex: 0
    };
    let correctAnswerMeta = {};

    /* --- Multi-Phase Timer State --- */
    let timerInterval = null;
    let totalSeconds = 75 * 60;
    let configTotalMins = 75;
    let configSubjectMins = 15;
    let configBreakMins = 1;
    let phases = [];
    let currentPhaseIdx = 0;
    let currentPhaseSeconds = 0;
    let timerIsRunning = false;

    // 실전/연습 모드 (기본: 실전 모드)
    let isPracticeMode = isAdvancedMode && localStorage.getItem('skct_practice_mode') === 'true';
    // 실전 모드에서 시간 종료된 과목 인덱스를 추적
    const lockedSubjectIndices = new Set();

    const omrSidebar = document.getElementById('omrSidebar');
    const omrToggleBtn = document.getElementById('omrToggleBtn');
    const omrContent = document.getElementById('omrContent');
    const omrBody = document.getElementById('omrBody');

    // Toggle OMR Sidebar
    omrToggleBtn.addEventListener('click', () => {
        const currentWidth = getComputedStyle(document.documentElement).getPropertyValue('--omr-width').replace('px', '').trim();
        applyOmrPanelWidth(currentWidth);
        omrSidebar.classList.remove('collapsed');
        omrContent.classList.remove('hidden');
        // 리사이저 힌트 애니메이션 표시
        const resizer = document.getElementById('omrResizer');
        if (resizer) {
            resizer.classList.add('hint-active');
            // 플로팅 힌트 배지 생성
            const badge = document.createElement('div');
            badge.className = 'resizer-hint-badge';
            badge.innerHTML = '<span class="arrows">◀▶</span> 드래그하여 폭 조절';
            document.body.appendChild(badge);
            // 리사이저 위치에 배지 배치
            requestAnimationFrame(() => {
                const rect = resizer.getBoundingClientRect();
                badge.style.top = (rect.top + rect.height / 2 - 15) + 'px';
                badge.style.left = (rect.right + 8) + 'px';
            });
            // 3초 후 정리
            setTimeout(() => {
                resizer.classList.remove('hint-active');
                if (badge.parentNode) badge.parentNode.removeChild(badge);
            }, 3000);
        }
    });

    document.getElementById('omrCollapseBtn').addEventListener('click', () => {
        omrSidebar.classList.add('collapsed');
        omrContent.classList.add('hidden');
    });

    // OMR Drag Resizer
    const omrResizer = document.getElementById('omrResizer');
    let isResizingOmr = false;

    function beginOmrResize(e) {
        isResizingOmr = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        omrResizer.setPointerCapture?.(e.pointerId);
        e.preventDefault();
    }

    function updateOmrResize(clientX) {
        if (!isResizingOmr) return;
        const newWidth = normalizeOmrPanelWidth(calculateOmrWidthFromPointer(clientX));
        document.documentElement.style.setProperty('--omr-width', `${newWidth}px`);
        if (isPopupMode && appContainerEl) {
            currentPopupLayout.omrWidthRatio = roundRatio(clampNumber(newWidth / appContainerEl.clientWidth, 0.12, 0.7));
            schedulePopupEditorSync();
        }
    }

    function finishOmrResize() {
        if (!isResizingOmr) return;
        isResizingOmr = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        const currentWidth = getComputedStyle(document.documentElement).getPropertyValue('--omr-width').replace('px', '').trim();
        const normalizedWidth = applyOmrPanelWidth(currentWidth);
        if (!isPopupMode) {
            localStorage.setItem('skct_omr_width', String(normalizedWidth));
        } else if (appContainerEl) {
            currentPopupLayout.omrWidthRatio = roundRatio(clampNumber(normalizedWidth / appContainerEl.clientWidth, 0.12, 0.7));
            schedulePopupEditorSync();
        }
        resizeCanvas();
    }

    omrResizer.addEventListener('pointerdown', beginOmrResize);

    document.addEventListener('mousemove', (e) => {
        updateOmrResize(e.clientX);
    });

    document.addEventListener('pointermove', (e) => {
        updateOmrResize(e.clientX);
    });

    document.addEventListener('mouseup', () => {
        finishOmrResize();
    });

    document.addEventListener('pointerup', () => {
        finishOmrResize();
    });

    document.addEventListener('pointercancel', () => {
        finishOmrResize();
    });

    if (isPopupEditorMode && topBarResizerEl && toolsSectionResizerEl && topBarEl && utilitySectionEl && calculatorSectionEl) {
        const MIN_TIMER_HEIGHT = 0;
        const MIN_UTILITY_HEIGHT = 0;
        const MIN_CALC_HEIGHT = 0;

        function readSectionHeights() {
            return {
                timerHeight: topBarEl.getBoundingClientRect().height,
                utilityHeight: utilitySectionEl.getBoundingClientRect().height,
                calcHeight: calculatorSectionEl.getBoundingClientRect().height
            };
        }

        function finishHorizontalResize() {
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
            topBarResizerEl.classList.remove('active');
            toolsSectionResizerEl.classList.remove('active');
            schedulePopupEditorSync();
        }

        let topBarResizeSession = null;
        topBarResizerEl.addEventListener('mousedown', (event) => {
            event.preventDefault();
            topBarResizeSession = {
                startY: event.clientY,
                heights: readSectionHeights()
            };
            topBarResizerEl.classList.add('active');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        });

        let toolsResizeSession = null;
        toolsSectionResizerEl.addEventListener('mousedown', (event) => {
            event.preventDefault();
            toolsResizeSession = {
                startY: event.clientY,
                heights: readSectionHeights()
            };
            toolsSectionResizerEl.classList.add('active');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (event) => {
            if (topBarResizeSession) {
                const { timerHeight, utilityHeight, calcHeight } = topBarResizeSession.heights;
                const totalHeight = timerHeight + utilityHeight + calcHeight;
                const desiredTimerHeight = clampNumber(
                    timerHeight + (event.clientY - topBarResizeSession.startY),
                    MIN_TIMER_HEIGHT,
                    totalHeight - (MIN_UTILITY_HEIGHT + MIN_CALC_HEIGHT)
                );
                const remainingHeight = totalHeight - desiredTimerHeight;
                const toolsTotal = Math.max(utilityHeight + calcHeight, 1);
                const utilityShare = utilityHeight / toolsTotal;
                const nextUtilityHeight = remainingHeight * utilityShare;
                const nextCalcHeight = remainingHeight - nextUtilityHeight;
                applyRatiosFromHeights(desiredTimerHeight, nextUtilityHeight, nextCalcHeight);
            }

            if (toolsResizeSession) {
                const { timerHeight, utilityHeight, calcHeight } = toolsResizeSession.heights;
                const toolsTotal = utilityHeight + calcHeight;
                const desiredUtilityHeight = clampNumber(
                    utilityHeight + (event.clientY - toolsResizeSession.startY),
                    MIN_UTILITY_HEIGHT,
                    toolsTotal - MIN_CALC_HEIGHT
                );
                const nextCalcHeight = toolsTotal - desiredUtilityHeight;
                applyRatiosFromHeights(timerHeight, desiredUtilityHeight, nextCalcHeight);
            }
        });

        document.addEventListener('mouseup', () => {
            if (topBarResizeSession || toolsResizeSession) {
                topBarResizeSession = null;
                toolsResizeSession = null;
                finishHorizontalResize();
            }
        });
    }

    // Question Timing
    let questionTimings = {}; // { "math_1": { spent: 45, state: 'answered' | 'skipped' | 'visited' } }
    let questionSpentSec = 0;
    let questionEnteredAt = Date.now();

    // Helper to get current Question Key
    const getCurrentQKey = () => {
        let globalIndex = 0;
        for (let subj of subjects) {
            for (let i = 1; i <= subj.count; i++) {
                if (globalIndex === omrState.currentGlobalIndex) return `${subj.id}_${i}`;
                globalIndex++;
            }
        }
        return null;
    };

    const isQuestionTimingActive = () => {
        const currentPhase = currentPhaseIdx < phases.length ? phases[currentPhaseIdx] : null;
        return Boolean(timerIsRunning && currentPhase?.type === 'subject' && getCurrentQKey());
    };

    const resetCurrentQuestionTimer = () => {
        questionSpentSec = 0;
        questionEnteredAt = Date.now();
    };

    const getCurrentQuestionDisplayNumber = () => {
        const qKey = getCurrentQKey();
        if (!qKey) return null;
        let globalNo = 1;
        for (const subj of subjects) {
            for (let i = 1; i <= subj.count; i += 1) {
                if (`${subj.id}_${i}` === qKey) return globalNo;
                globalNo += 1;
            }
        }
        return null;
    };

    const clearQuestionTools = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        notepad.value = '';
        resetCalculator();
    };

    const syncCurrentQuestionElapsed = (state = 'visited') => {
        const qKey = getCurrentQKey();
        if (!qKey) {
            resetCurrentQuestionTimer();
            return;
        }
        if (!questionTimings[qKey]) {
            questionTimings[qKey] = { spent: 0, state };
        }
        const now = Date.now();
        const elapsedSec = isQuestionTimingActive()
            ? Math.max(0, Math.floor((now - questionEnteredAt) / 1000))
            : 0;
        if (elapsedSec > 0) {
            questionTimings[qKey].spent += elapsedSec;
        }
        resetCurrentQuestionTimer();
        if (state && state !== 'visited') questionTimings[qKey].state = state;
    };

    const recordCurrentQuestionTiming = (isSkip = false) => {
        syncCurrentQuestionElapsed(isSkip ? 'skipped' : 'answered');
    };

    const getLiveQuestionSpentSec = () => {
        const qKey = getCurrentQKey();
        const stored = qKey ? Number(questionTimings[qKey]?.spent) || 0 : 0;
        if (!isQuestionTimingActive()) {
            return stored;
        }
        return stored + Math.max(0, Math.floor((Date.now() - questionEnteredAt) / 1000));
    };

    const advanceQuestion = (isSkip = false) => {
        recordCurrentQuestionTiming(isSkip);
        clearQuestionTools();
        if (omrState.mode === 'answer') {
            const maxQ = subjects.reduce((sum, s) => sum + s.count, 0);
            if (omrState.currentGlobalIndex < maxQ - 1) {
                omrState.currentGlobalIndex++;
            }
            resetCurrentQuestionTimer();
            updateQuestionGuideUI();
            renderOMR();
        }
    };

    // 현재 globalIndex가 어떤 과목(subjectIndex)에 속하는지 반환
    const getSubjectIndexForGlobal = (globalIdx) => {
        let cumulative = 0;
        for (let i = 0; i < subjects.length; i++) {
            cumulative += subjects[i].count;
            if (globalIdx < cumulative) return i;
        }
        return subjects.length - 1;
    };

    // 과목 인덱스별 시작 globalIndex 반환
    const getSubjectStartIndex = (subjIdx) => {
        let start = 0;
        for (let k = 0; k < subjIdx; k++) {
            start += subjects[k].count;
        }
        return start;
    };

    const isAnswerEditableIndex = (questionIndex, subjectLocked) => {
        if (subjectLocked) return false;
        if (isPracticeMode) return true;
        return questionIndex === omrState.currentGlobalIndex;
    };

    // Render OMR
    function renderOMR() {
        let globalIndex = 0;
        omrBody.innerHTML = '';
        subjects.forEach((subj, subjIdx) => {
            const group = document.createElement('div');
            group.className = 'subject-group';
            const isSubjLocked = lockedSubjectIndices.has(subjIdx) && !isPracticeMode;
            if (isSubjLocked) group.classList.add('subject-locked');
            group.innerHTML = `<div class="subject-title">${subj.name}${isSubjLocked ? ' <span class="lock-badge">🔒 시간종료</span>' : ''}</div>`;

            for (let i = 1; i <= subj.count; i++) {
                const qRow = document.createElement('div');
                qRow.className = 'q-row';
                const currentIdx = globalIndex;
                const isCurrent = (currentIdx === omrState.currentGlobalIndex);
                const isPast = (currentIdx < omrState.currentGlobalIndex);

                if (omrState.mode === 'answer') {
                    if (isSubjLocked) {
                        qRow.classList.add('locked-q');
                    } else if (isCurrent) {
                        qRow.classList.add('current-q');
                    } else if (isPast) {
                        qRow.classList.add('past-q');
                    }
                } else if (omrState.mode === 'score') {
                    const qKey = `${subj.id}_${i}`;
                    const myAns = omrState.myAnswers[qKey];
                    const corAns = omrState.correctAnswers[qKey];
                    if (!myAns) qRow.classList.add('status-missed');
                    else if (myAns === corAns) qRow.classList.add('status-correct');
                    else qRow.classList.add('status-wrong');
                }

                let optionsHtml = '';
                for (let opt = 1; opt <= 5; opt++) {
                    const qKey = `${subj.id}_${i}`;
                    const isMyAnswer = omrState.myAnswers[qKey] === opt;
                    const isCorrectAnswer = omrState.correctAnswers[qKey] === opt;

                    let extraClass = '';
                    if (omrState.mode === 'answer' && isMyAnswer) {
                        extraClass = 'selected';
                    } else if (omrState.mode === 'score') {
                        if (isCorrectAnswer) {
                            extraClass = 'selected correct';
                        } else if (isMyAnswer) {
                            extraClass = 'selected wrong';
                        }
                    }

                    let disabledAttr = '';
                    if (omrState.mode === 'answer' && !isAnswerEditableIndex(currentIdx, isSubjLocked)) {
                        disabledAttr = 'disabled';
                    }

                    optionsHtml += `<button class="q-opt ${extraClass}" data-key="${qKey}" data-opt="${opt}" data-gidx="${currentIdx}" ${disabledAttr}>${opt}</button>`;
                }

                qRow.innerHTML = `
                    <div class="q-num">${i}.</div>
                    <div class="q-options">
                        ${optionsHtml}
                    </div>
                `;
                group.appendChild(qRow);
                globalIndex++;
            }
            omrBody.appendChild(group);
        });

        // Let's add scroll auto-focus right after render
        requestAnimationFrame(() => {
            const currentEl = document.querySelector('.q-row.current-q');
            if (currentEl) {
                currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        // Attach events
        document.querySelectorAll('.q-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const key = e.target.dataset.key;
                const opt = parseInt(e.target.dataset.opt);
                const gIdx = parseInt(e.target.dataset.gidx);

                if (omrState.mode === 'answer') {
                    if (!e.target.disabled) {
                        omrState.myAnswers[key] = (omrState.myAnswers[key] === opt) ? null : opt;
                        if (isPracticeMode) {
                            // 연습 모드: 클릭한 문항 위치로 currentGlobalIndex 이동 후 advance
                            syncCurrentQuestionElapsed('visited');
                            omrState.currentGlobalIndex = gIdx;
                            resetCurrentQuestionTimer();
                            updateQuestionGuideUI();
                            advanceQuestion(false);
                        } else if (gIdx === omrState.currentGlobalIndex) {
                            advanceQuestion(false);
                        } else {
                            updateQuestionGuideUI();
                            renderOMR();
                        }
                    }
                } else {
                    omrState.correctAnswers[key] = (omrState.correctAnswers[key] === opt) ? null : opt;
                    delete correctAnswerMeta[key];
                    updateQuestionGuideUI();
                    renderOMR();
                }
            });
        });
    }

    renderOMR();

    // Mode Toggle (단일 토글 버튼)
    const modeToggleBtn = document.getElementById('modeToggleBtn');
    const omrModeLabel = document.getElementById('omrModeLabel');
    const omrModeHint = document.getElementById('omrModeHint');
    const bulkCorrectImportBtn = document.getElementById('bulkCorrectImportBtn');
    let advancedScoringActionsUnlocked = false;
    let currentStatRoundId = null;
    let lastImportedStatRounds = [];

    const updateModeUI = () => {
        const showAdvancedScoringActions = Boolean(
            isAdvancedMode
            && omrState.mode === 'score'
            && advancedScoringActionsUnlocked
        );
        const showAdvancedAnswerImport = Boolean(
            isAdvancedMode
            && omrState.mode === 'score'
        );
        if (omrState.mode === 'answer') {
            modeToggleBtn.textContent = window.siteText ? window.siteText('tools.modeToggleButton') : '📝 정답 입력';
            modeToggleBtn.classList.remove('active-score');
            if (advancedSaveSummary) advancedSaveSummary.classList.add('hidden');
            if (omrModeLabel) {
                omrModeLabel.textContent = window.siteText ? window.siteText('tools.omrModeLabel') : '답안 기록 · 채점용';
                omrModeLabel.style.color = '';
            }
            if (omrModeHint) {
                omrModeHint.classList.add('hidden');
                omrModeHint.textContent = '';
            }
        } else {
            modeToggleBtn.textContent = '✏️ 내 답 기록으로 돌아가기';
            modeToggleBtn.classList.add('active-score');
            if (omrModeLabel) omrModeLabel.textContent = '✅ 정답 입력 중';
            if (omrModeLabel) omrModeLabel.style.color = '#4ade80';
            if (omrModeHint) {
                omrModeHint.textContent = '미응답 문항도 번호를 클릭해 정답을 입력할 수 있습니다.';
                omrModeHint.classList.remove('hidden');
            }
        }
        if (detailScoreBtn) {
            detailScoreBtn.classList.toggle('hidden', !showAdvancedScoringActions);
        }
        if (advancedRecordControls) {
            advancedRecordControls.classList.toggle('hidden', !showAdvancedScoringActions);
        }
        if (bulkCorrectImportBtn) {
            bulkCorrectImportBtn.classList.toggle('hidden', !showAdvancedAnswerImport);
        }
        if (advancedArchiveOpenBtn) {
            advancedArchiveOpenBtn.classList.toggle('hidden', !isAdvancedMode);
        }
        if (advancedToolsStatus) {
            if (!showAdvancedAnswerImport) {
                advancedToolsStatus.textContent = '';
                advancedToolsStatus.classList.add('hidden');
            } else {
                advancedToolsStatus.classList.toggle('hidden', !advancedToolsStatus.textContent.trim());
            }
        }
        if (!showAdvancedAnswerImport && bulkCorrectImportModal) {
            bulkCorrectImportModal.classList.add('hidden');
        }
    };

    const stopTimer = () => {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        timerIsRunning = false;
        syncTimerPlayButtonLabel(false);
        updateTimerUI();
        applyPhaseToOMR();
    };

    const enterScoreMode = () => {
        omrState.mode = 'score';
        stopTimer();
        updateModeUI();
        renderOMR();
    };

    if (modeToggleBtn) {
        modeToggleBtn.addEventListener('click', () => {
            if (omrState.mode === 'answer') {
                enterScoreMode();
            } else {
                omrState.mode = 'answer';
                advancedScoringActionsUnlocked = false;
                currentStatRoundId = null;
                updateModeUI();
                renderOMR();
            }
        });
    }

    const detailScoreBtn = document.getElementById('detailScoreBtn');
    const bulkCorrectImportModal = document.getElementById('bulkCorrectImportModal');
    const bulkCorrectImportInput = document.getElementById('bulkCorrectImportInput');
    const bulkCorrectImportInputs = Array.from(document.querySelectorAll('.bulk-correct-page-input'));
    const bulkCorrectImportParseBtn = document.getElementById('bulkCorrectImportParseBtn');
    const bulkCorrectQuestionCol = document.getElementById('bulkCorrectQuestionCol');
    const bulkCorrectAnswerCol = document.getElementById('bulkCorrectAnswerCol');
    const bulkCorrectRateCol = document.getElementById('bulkCorrectRateCol');
    const bulkCorrectImportSummary = document.getElementById('bulkCorrectImportSummary');
    const bulkCorrectImportPreview = document.getElementById('bulkCorrectImportPreview');
    const bulkCorrectImportStatus = document.getElementById('bulkCorrectImportStatus');
    const bulkCorrectImportApplyBtn = document.getElementById('bulkCorrectImportApplyBtn');
    let bulkCorrectImportState = { parsed: null, preview: null };
    const formatRateText = (value) => `${(Math.round((Number(value) || 0) * 10) / 10).toFixed(1).replace(/\.0$/, '')}%`;

    const getTotalQuestionCount = () => subjects.reduce((sum, subj) => sum + subj.count, 0);

    const getBulkCorrectImportText = () => {
        const inputs = bulkCorrectImportInputs.length ? bulkCorrectImportInputs : [bulkCorrectImportInput].filter(Boolean);
        return inputs
            .map((input) => String(input?.value || '').trim())
            .filter(Boolean)
            .join('\n');
    };

    const tokenizeBulkImportLine = (line) => {
        const cleaned = String(line || '')
            .replace(/[{}]/g, ' ')
            .replace(/[“”"]/g, '')
            .trim();
        if (!cleaned) return [];
        let parts = [];
        if (cleaned.includes('\t')) {
            parts = cleaned.split(/\t+/);
        } else if (cleaned.includes('|')) {
            parts = cleaned.split(/\s*\|\s*/);
        } else if (cleaned.includes(',')) {
            parts = cleaned.split(/\s*,\s*/);
        } else if (cleaned.includes('/')) {
            parts = cleaned.split(/\s*\/\s*/);
        } else if (/\s{2,}/.test(cleaned)) {
            parts = cleaned.split(/\s{2,}/);
        } else {
            parts = cleaned.split(/\s+/);
        }
        return parts.map((part) => part.trim()).filter(Boolean);
    };

    const normalizeBulkHeaderToken = (value) => String(value || '').replace(/[.\-_:]/g, '').trim().toLowerCase();

    const isLikelyBulkHeaderRow = (cells) => {
        const joined = cells.map(normalizeBulkHeaderToken).join(' ');
        if (!joined) return false;
        return /(no|번호|문항|정답|입력답|정오|정답률|correct|answer|result|rate|user)/i.test(joined);
    };

    const deriveBulkColumnLabels = (headerRows, maxCols) => {
        const labels = [];
        for (let col = 0; col < maxCols; col++) {
            const counts = new Map();
            headerRows.forEach((row) => {
                const value = String(row[col] || '').trim();
                if (!value) return;
                counts.set(value, (counts.get(value) || 0) + 1);
            });
            const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
            labels.push(top ? top[0] : `열 ${col + 1}`);
        }
        return labels;
    };

    const parseBulkQuestionNumber = (value) => {
        const match = String(value || '').match(/\d+/);
        if (!match) return null;
        const num = parseInt(match[0], 10);
        return Number.isInteger(num) ? num : null;
    };

    const parseBulkChoice = (value) => {
        const trimmed = String(value || '').trim();
        if (!trimmed) return null;
        const circledMap = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 };
        if (circledMap[trimmed]) return circledMap[trimmed];
        const match = trimmed.match(/[1-5]/);
        if (!match) return null;
        const num = parseInt(match[0], 10);
        return num >= 1 && num <= 5 ? num : null;
    };

    const parseBulkRate = (value) => {
        const trimmed = String(value || '').trim();
        if (!trimmed || trimmed === '-') return null;
        const match = trimmed.match(/(\d+(?:\.\d+)?)\s*%?/);
        if (!match) return null;
        const rate = Number(match[1]);
        return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null;
    };

    const formatBulkRate = (value) => {
        const rate = Number(value);
        return Number.isFinite(rate) ? `${(Math.round(rate * 10) / 10).toFixed(1).replace(/\.0$/, '')}%` : '-';
    };

    const parseBulkCorrectImportText = (text) => {
        const lines = String(text || '').split(/\r?\n/);
        const rows = [];
        const headerRows = [];
        let currentHeader = [];
        lines.forEach((line, lineIndex) => {
            const cells = tokenizeBulkImportLine(line);
            if (!cells.length) return;
            if (isLikelyBulkHeaderRow(cells)) {
                currentHeader = cells.slice();
                headerRows.push(cells.slice());
                return;
            }
            if (!cells.some((cell) => /\d|①|②|③|④|⑤/.test(cell))) return;
            rows.push({
                lineNumber: lineIndex + 1,
                cells,
                header: currentHeader.slice()
            });
        });
        const maxCols = Math.max(
            rows.reduce((max, row) => Math.max(max, row.cells.length), 0),
            headerRows.reduce((max, row) => Math.max(max, row.length), 0)
        );
        return {
            rows,
            headerRows,
            columnLabels: deriveBulkColumnLabels(headerRows, maxCols),
            maxCols
        };
    };

    const detectBulkQuestionColumn = (parsed) => {
        let bestIndex = 0;
        let bestScore = Number.NEGATIVE_INFINITY;
        const totalQuestions = getTotalQuestionCount();
        for (let col = 0; col < parsed.maxCols; col++) {
            const label = normalizeBulkHeaderToken(parsed.columnLabels[col]);
            let score = 0;
            if (/(^no$|^no\.?$|번호|문항|num|number)/i.test(label)) score += 50;
            let lastNum = null;
            parsed.rows.forEach((row) => {
                const num = parseBulkQuestionNumber(row.cells[col]);
                if (num == null) return;
                if (num >= 1 && num <= totalQuestions) score += 3;
                if (lastNum != null && num === lastNum + 1) score += 1;
                lastNum = num;
            });
            if (score > bestScore) {
                bestScore = score;
                bestIndex = col;
            }
        }
        return bestIndex;
    };

    const detectBulkAnswerColumn = (parsed, questionCol) => {
        let bestIndex = Math.min(1, Math.max(0, parsed.maxCols - 1));
        let bestScore = Number.NEGATIVE_INFINITY;
        for (let col = 0; col < parsed.maxCols; col++) {
            if (col === questionCol) continue;
            const label = normalizeBulkHeaderToken(parsed.columnLabels[col]);
            let score = 0;
            if (/정답|correct/.test(label)) score += 80;
            if (/입력답|user|my|응답/.test(label)) score -= 50;
            parsed.rows.forEach((row) => {
                if (parseBulkChoice(row.cells[col]) != null) score += 2;
            });
            if (score > bestScore) {
                bestScore = score;
                bestIndex = col;
            }
        }
        return bestIndex;
    };

    const detectBulkRateColumn = (parsed, questionCol, answerCol) => {
        let bestIndex = -1;
        let bestScore = 0;
        for (let col = 0; col < parsed.maxCols; col++) {
            if (col === questionCol || col === answerCol) continue;
            const label = normalizeBulkHeaderToken(parsed.columnLabels[col]);
            let score = 0;
            if (/정답률|rate|percent|accuracy/.test(label)) score += 80;
            parsed.rows.forEach((row) => {
                const raw = String(row.cells[col] || '').trim();
                if (/%/.test(raw) && parseBulkRate(raw) != null) score += 3;
                else if (parseBulkRate(raw) != null && Number(raw) > 5) score += 1;
            });
            if (score > bestScore) {
                bestScore = score;
                bestIndex = col;
            }
        }
        return bestScore > 0 ? bestIndex : -1;
    };

    const renderBulkColumnOptions = (parsed, selectedQuestionCol, selectedAnswerCol) => {
        if (!bulkCorrectQuestionCol || !bulkCorrectAnswerCol) return;
        const optionsHtml = Array.from({ length: parsed.maxCols }, (_, index) => {
            const label = escapeHtml(parsed.columnLabels[index] || `열 ${index + 1}`);
            return `<option value="${index}">${label} (${index + 1})</option>`;
        }).join('');
        bulkCorrectQuestionCol.innerHTML = optionsHtml;
        bulkCorrectAnswerCol.innerHTML = optionsHtml;
        bulkCorrectQuestionCol.value = String(selectedQuestionCol);
        bulkCorrectAnswerCol.value = String(selectedAnswerCol);
        if (bulkCorrectRateCol) {
            bulkCorrectRateCol.innerHTML = `<option value="-1">없음</option>${optionsHtml}`;
            bulkCorrectRateCol.value = String(Number.isInteger(selectedAnswerCol) ? detectBulkRateColumn(parsed, selectedQuestionCol, selectedAnswerCol) : -1);
        }
    };

    const buildBulkCorrectPreview = (parsed, questionCol, answerCol, rateCol = -1) => {
        const mapped = new Map();
        let invalidRowCount = 0;
        let duplicateCount = 0;
        let rateCount = 0;
        parsed.rows.forEach((row) => {
            const questionNo = parseBulkQuestionNumber(row.cells[questionCol]);
            const answer = parseBulkChoice(row.cells[answerCol]);
            const answerRate = rateCol >= 0 ? parseBulkRate(row.cells[rateCol]) : null;
            if (questionNo == null || answer == null) {
                invalidRowCount++;
                return;
            }
            if (answerRate != null) rateCount++;
            if (mapped.has(questionNo)) duplicateCount++;
            mapped.set(questionNo, {
                questionNo,
                answer,
                answerRate,
                rawQuestion: row.cells[questionCol] || '',
                rawAnswer: row.cells[answerCol] || '',
                rawRate: rateCol >= 0 ? (row.cells[rateCol] || '') : ''
            });
        });
        return {
            mappedRows: [...mapped.values()].sort((a, b) => a.questionNo - b.questionNo),
            invalidRowCount,
            duplicateCount,
            rateCount
        };
    };

    const renderBulkCorrectPreview = () => {
        const parsed = bulkCorrectImportState.parsed;
        if (!parsed || !parsed.rows.length || parsed.maxCols === 0) {
            bulkCorrectImportState.preview = null;
            if (bulkCorrectImportSummary) bulkCorrectImportSummary.textContent = '붙여넣은 데이터에서 표 형태를 찾지 못했습니다.';
            if (bulkCorrectImportPreview) bulkCorrectImportPreview.textContent = 'NO./정답 같은 헤더가 있거나, 문항 번호와 정답이 포함된 줄 단위 데이터여야 합니다.';
            if (bulkCorrectImportApplyBtn) bulkCorrectImportApplyBtn.disabled = true;
            return;
        }
        const questionCol = Number(bulkCorrectQuestionCol?.value ?? 0);
        const answerCol = Number(bulkCorrectAnswerCol?.value ?? 1);
        const rateCol = Number(bulkCorrectRateCol?.value ?? -1);
        const preview = buildBulkCorrectPreview(parsed, questionCol, answerCol, rateCol);
        bulkCorrectImportState.preview = preview;
        if (bulkCorrectImportSummary) {
            bulkCorrectImportSummary.textContent = `데이터 줄 ${parsed.rows.length}개 중 ${preview.mappedRows.length}문항을 정답으로 읽었습니다. 정답률 ${preview.rateCount}개 포함.`;
        }
        if (bulkCorrectImportStatus) {
            const notes = [];
            if (preview.invalidRowCount > 0) notes.push(`무시된 줄 ${preview.invalidRowCount}개`);
            if (preview.duplicateCount > 0) notes.push(`중복 문항 ${preview.duplicateCount}개(마지막 값 사용)`);
            bulkCorrectImportStatus.textContent = notes.length ? notes.join(' · ') : '이 설정으로 바로 반영할 수 있습니다.';
        }
        if (bulkCorrectImportApplyBtn) {
            bulkCorrectImportApplyBtn.disabled = preview.mappedRows.length === 0;
            bulkCorrectImportApplyBtn.textContent = '정답 적용 및 채점';
        }
        if (bulkCorrectImportPreview) {
            if (!preview.mappedRows.length) {
                bulkCorrectImportPreview.textContent = '현재 선택한 열 조합으로는 반영할 정답을 찾지 못했습니다.';
            } else {
                const rowsHtml = preview.mappedRows.slice(0, 12).map((item) => `
                    <tr>
                        <td>${item.questionNo}</td>
                        <td>${item.answer}</td>
                        <td>${formatBulkRate(item.answerRate)}</td>
                        <td>${escapeHtml(item.rawQuestion)}</td>
                        <td>${escapeHtml(item.rawAnswer)}</td>
                    </tr>
                `).join('');
                const moreHtml = preview.mappedRows.length > 12
                    ? `<div style="margin-top:8px; color:#64748b;">그 외 ${preview.mappedRows.length - 12}문항도 함께 반영됩니다.</div>`
                    : '';
                bulkCorrectImportPreview.innerHTML = `
                    <div><strong>미리보기</strong> · 문항 번호와 정답이 이렇게 들어갑니다.</div>
                    <table>
                        <thead>
                            <tr>
                                <th>문항</th>
                                <th>정답</th>
                                <th>CBT 정답률</th>
                                <th>문항 원본</th>
                                <th>정답 원본</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    ${moreHtml}
                `;
            }
        }
    };

    const openBulkCorrectImportModal = () => {
        if (!bulkCorrectImportModal) return;
        if (!isAdvancedMode) {
            setAdvancedToolsStatus('링커리어 CBT 정오표 일괄입력은 고급 모드에서 사용할 수 있습니다.');
            return;
        }
        if (omrState.mode !== 'score') {
            setAdvancedToolsStatus('정답 입력 상태에서 사용할 수 있습니다. 먼저 정답 입력 버튼을 눌러주세요.');
            return;
        }
        bulkCorrectImportModal.classList.remove('hidden');
        if (getBulkCorrectImportText()) {
            bulkCorrectImportParseBtn?.click();
        } else if (bulkCorrectImportStatus) {
            bulkCorrectImportStatus.textContent = '링커리어 CBT 답지 표를 범위별 칸에 붙여넣고 분석 버튼을 눌러주세요.';
        }
    };

    const parseBulkCorrectImport = () => {
        const parsed = parseBulkCorrectImportText(getBulkCorrectImportText());
        bulkCorrectImportState.parsed = parsed;
        if (!parsed.rows.length || parsed.maxCols === 0) {
            renderBulkCorrectPreview();
            return;
        }
        const questionCol = detectBulkQuestionColumn(parsed);
        const answerCol = detectBulkAnswerColumn(parsed, questionCol);
        renderBulkColumnOptions(parsed, questionCol, answerCol);
        renderBulkCorrectPreview();
    };

    const getQuestionKeyByNumber = (questionNo) => {
        if (!Number.isInteger(questionNo) || questionNo < 1) return null;
        let base = 0;
        for (const subj of subjects) {
            const start = base + 1;
            const end = base + subj.count;
            if (questionNo >= start && questionNo <= end) {
                return `${subj.id}_${questionNo - base}`;
            }
            base = end;
        }
        return null;
    };

    const getGlobalQuestionNumber = (subjId, num) => {
        let offset = 0;
        for (const subj of subjects) {
            if (subj.id === subjId) return offset + num;
            offset += subj.count;
        }
        return num;
    };

    async function recordAdvancedTimeSavedForBulkImport(preview) {
        if (!isAdvancedMode || !verifiedAdvancedLicenseBundle || !preview?.mappedRows?.length) return;
        try {
            const mappedRows = preview.mappedRows
                .map((item) => `${item.questionNo}:${item.answer}`)
                .join('|');
            const roundKey = currentStatRoundId || getTodayKstDateInputValue();
            const eventId = await sha256Hex(`bulk-correct-import::${roundKey}::${mappedRows}`);
            const localKey = `skct_time_saved_${eventId}`;
            if (sessionStorage.getItem(localKey) === '1') return;
            sessionStorage.setItem(localKey, '1');
            const seconds = Math.max(30, Math.min(270, Math.round(preview.mappedRows.length * 2.7)));
            const payload = await postToSecureApi('/advanced/time-saved/record', {
                licenseBundle: verifiedAdvancedLicenseBundle,
                eventId,
                action: 'bulkCorrectImport',
                seconds,
                title: 'CBT 정답 붙여넣기',
                detail: `${preview.mappedRows.length}문항 정답을 한 번에 반영`
            }, '아낀 시간 기록을 저장하지 못했습니다.');
            if (payload?.ok && !payload.duplicate && typeof setAdvancedToolsStatus === 'function') {
                setAdvancedToolsStatus(`${preview.mappedRows.length}문항의 정답을 반영하고 채점했습니다. 아낀 시간 ${formatSavedDuration(seconds)}도 계정 상태에 저장되었습니다.`);
            }
        } catch (error) {
            try { console.warn('[advanced time saved]', error); } catch (e) { /* noop */ }
        }
    }

    const applyBulkCorrectImport = () => {
        const preview = bulkCorrectImportState.preview;
        if (!preview || !preview.mappedRows.length) {
            if (bulkCorrectImportStatus) bulkCorrectImportStatus.textContent = '반영할 정답이 없습니다.';
            return;
        }
        preview.mappedRows.forEach((item) => {
            const key = getQuestionKeyByNumber(item.questionNo);
            if (key) {
                omrState.correctAnswers[key] = item.answer;
                if (item.answerRate != null) {
                    correctAnswerMeta[key] = {
                        source: 'CBT',
                        answerRate: item.answerRate
                    };
                } else {
                    delete correctAnswerMeta[key];
                }
            }
        });
        if (bulkCorrectImportStatus) {
            bulkCorrectImportStatus.textContent = `${preview.mappedRows.length}문항의 정답을 반영하고 채점했습니다.`;
        }
        advancedScoringActionsUnlocked = true;
        const model = updateScoreSummaryPanel();
        recordCurrentStatRound(model);
        if (isAdvancedMode) saveCurrentStudySessionToQueue(model);
        if (typeof setAdvancedToolsStatus === 'function') {
            setAdvancedToolsStatus(`${preview.mappedRows.length}문항의 정답을 반영하고 채점했습니다.`);
        }
        recordAdvancedTimeSavedForBulkImport(preview);
        renderOMR();
    };

    const buildQuestionStatItem = (subj, num) => {
        const key = `${subj.id}_${num}`;
        const myAnswer = omrState.myAnswers[key] ?? null;
        const correctAnswer = omrState.correctAnswers[key] ?? null;
        const answerMeta = correctAnswerMeta[key] || {};
        const timing = questionTimings[key] || null;
        const spent = timing?.spent ?? 0;
        const timingState = timing?.state || null;
        const answered = myAnswer != null;
        const skipped = !answered && timingState === 'skipped';
        const unanswered = !answered && !skipped;
        const correctKnown = correctAnswer != null;
        const correct = correctKnown && answered && myAnswer === correctAnswer;
        const wrongByAnswer = correctKnown && answered && myAnswer !== correctAnswer;
        const skippedAsWrong = skipped && correctKnown && configTreatSkippedAsWrong;

        let resultKey = 'unanswered';
        let resultLabel = '못 풂';
        if (correct) {
            resultKey = 'correct';
            resultLabel = '정답';
        } else if (wrongByAnswer) {
            resultKey = 'wrong';
            resultLabel = '오답';
        } else if (skippedAsWrong) {
            resultKey = 'skipped_wrong';
            resultLabel = '건너뜀(오답)';
        } else if (skipped) {
            resultKey = 'skipped';
            resultLabel = '건너뜀';
        } else if (answered && !correctKnown) {
            resultKey = 'pending';
            resultLabel = '정답 미입력';
        }

        return {
            key,
            no: getGlobalQuestionNumber(subj.id, num),
            subjId: subj.id,
            subjName: subj.name,
            num,
            myAnswer,
            correctAnswer,
            cbtAnswerRate: answerMeta.answerRate ?? null,
            answerSource: answerMeta.source || '',
            spent,
            timingState,
            answered,
            skipped,
            unanswered,
            correct,
            wrongByAnswer,
            skippedAsWrong,
            resultKey,
            resultLabel
        };
    };

    const summarizeQuestionItems = (items) => {
        const total = items.length;
        const attempted = items.filter((item) => item.answered).length;
        const correct = items.filter((item) => item.correct).length;
        const skipped = items.filter((item) => item.skipped).length;
        const unanswered = items.filter((item) => item.unanswered).length;
        const wrong = items.filter((item) => item.wrongByAnswer || item.skippedAsWrong).length;
        const attemptedRate = attempted > 0 ? (correct / attempted) * 100 : 0;
        const overallRate = total > 0 ? (correct / total) * 100 : 0;
        return {
            total,
            attempted,
            correct,
            skipped,
            unanswered,
            wrong,
            attemptedRate,
            overallRate
        };
    };

    const collectDetailedStatsModel = () => {
        syncCurrentQuestionElapsed('visited');
        const questionItems = subjects.flatMap((subj) => {
            const items = [];
            for (let i = 1; i <= subj.count; i++) {
                items.push(buildQuestionStatItem(subj, i));
            }
            return items;
        });

        const subjectRows = subjects.map((subj) => {
            const items = questionItems
                .filter((item) => item.subjId === subj.id)
                .sort((a, b) => a.num - b.num);
            return {
                id: subj.id,
                name: subj.name,
                count: subj.count,
                summary: summarizeQuestionItems(items),
                items,
                topTimes: [...items]
                    .filter((item) => item.spent > 0)
                    .sort((a, b) => b.spent - a.spent)
                    .slice(0, 3)
            };
        });

        const topTimes = [...questionItems]
            .filter((item) => item.spent > 0)
            .sort((a, b) => b.spent - a.spent)
            .slice(0, 3);

        return {
            overall: summarizeQuestionItems(questionItems),
            questionItems,
            subjectRows,
            topTimes,
            treatSkippedAsWrong: configTreatSkippedAsWrong
        };
    };

    const updateScoreSummaryPanel = () => {
        const model = collectDetailedStatsModel();
        const summaryEl = document.getElementById('statSummary');
        const attemptedRateEl = document.getElementById('statRateAttempted');
        const overallRateEl = document.getElementById('statRateOverall');
        const skippedEl = document.getElementById('statSkipped');
        const unansweredEl = document.getElementById('statUnanswered');

        if (summaryEl) summaryEl.innerText = `${model.overall.correct} / ${model.overall.attempted} / ${model.overall.total}`;
        if (attemptedRateEl) attemptedRateEl.innerText = formatRateText(model.overall.attemptedRate);
        if (overallRateEl) overallRateEl.innerText = formatRateText(model.overall.overallRate);
        if (skippedEl) skippedEl.innerText = `${model.overall.skipped}`;
        if (unansweredEl) unansweredEl.innerText = `${model.overall.unanswered}`;

        const resEl = document.getElementById('scoreResult');
        if (resEl) resEl.classList.remove('hidden');
        if (advancedSaveSummary) {
            advancedSaveSummary.classList.toggle('hidden', !isAdvancedMode);
        }
        if (advancedSaveSessionStatus && isAdvancedMode) {
            advancedSaveSessionStatus.textContent = '아래 기록 컨트롤에서 다운로드하거나 기록 보관함에 저장할 수 있습니다.';
        }
        updateModeUI();
        return model;
    };

    document.getElementById('scoreBtn').addEventListener('click', () => {
        advancedScoringActionsUnlocked = true;
        const hasCorrectAnswers = Object.values(omrState.correctAnswers).some((v) => v != null);
        if (!hasCorrectAnswers) {
            enterScoreMode();
            return;
        }

        const model = updateScoreSummaryPanel();
        recordCurrentStatRound(model);
        if (isAdvancedMode) {
            saveCurrentStudySessionToQueue(model);
        }
        trackAnalyticsEvent('result_view', {
            practice_mode: isPracticeMode ? 'practice' : 'exam',
            advanced_mode: isAdvancedMode ? 'yes' : 'no',
            correct_count: model.overall.correct,
            attempted_count: model.overall.attempted,
            total_questions: model.overall.total
        });
        if (!isAdvancedMode) {
            document.getElementById('donateToggle')?.classList.add('attention-active');
        }
        renderOMR();
    });

    const buildDetailedStatsText = () => {
        const model = collectDetailedStatsModel();
        const lines = buildExportMetaLines('문항별 통계 TXT', {
            '풀이 방식': isPracticeMode ? '연습 모드' : '실전 모드',
            '회차 ID': currentStatRoundId || '-',
            '풀이 일시': readAdvancedRecordMeta().practicedAt,
            '교재/자료': readAdvancedRecordMeta().material,
            '회차': readAdvancedRecordMeta().roundLabel,
            '설정 시간': `전체 ${configTotalMins}분 / 과목 ${configSubjectMins}분 / 쉬는시간 ${configBreakMins}분`,
            '건너뜀 오답 처리': model.treatSkippedAsWrong ? 'ON' : 'OFF'
        });
        lines.push(
            '',
            '[전체 요약]',
            `맞은 / 푼 / 전체: ${model.overall.correct} / ${model.overall.attempted} / ${model.overall.total}`,
            `정답률(푼 문제 대비): ${formatRateText(model.overall.attemptedRate)}`,
            `정답률(전체 문제 대비): ${formatRateText(model.overall.overallRate)}`,
            `건너뜀: ${model.overall.skipped}`,
            `못 풂: ${model.overall.unanswered}`,
            ''
        );

        model.subjectRows.forEach((row) => {
            lines.push(`[${row.name}]`);
            lines.push(`맞은 / 푼 / 전체: ${row.summary.correct} / ${row.summary.attempted} / ${row.summary.total}`);
            lines.push(`정답률(푼 문제 대비): ${formatRateText(row.summary.attemptedRate)}`);
            lines.push(`정답률(전체 문제 대비): ${formatRateText(row.summary.overallRate)}`);
            lines.push(`건너뜀: ${row.summary.skipped}`);
            lines.push(`못 풂: ${row.summary.unanswered}`);
            if (row.topTimes?.length) {
                lines.push('오래 걸린 문항 Top:');
                row.topTimes.forEach((item, index) => {
                    lines.push(`  ${index + 1}. ${item.num}번 - ${item.spent}초 (${item.resultLabel})`);
                });
            }
            lines.push('문항별 상세:');
            row.items.forEach((item) => {
                lines.push(`- ${item.num}번 | 입력 ${item.myAnswer ?? '-'} | 정답 ${item.correctAnswer ?? '-'} | CBT 정답률 ${formatBulkRate(item.cbtAnswerRate)} | 결과 ${item.resultLabel} | ${item.spent > 0 ? `${item.spent}초` : '시간 기록 없음'}`);
            });
            lines.push('');
        });

        if (!model.subjectRows.length) {
            lines.push('표시할 통계가 없습니다.');
        }
        return lines.join('\n');
    };

    const downloadDetailedStatsText = () => {
        const text = buildDetailedStatsText();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const stamp = formatKstFileStamp();
        anchor.href = url;
        anchor.download = `SKCT_문항별통계_${stamp}.txt`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        return { ok: true, message: '문항별 통계 TXT 파일을 저장했습니다.' };
    };

    // ===== 성장 기록 CSV 내보내기/불러오기 =====
    const STAT_ROUNDS_STORAGE_KEY = 'skct_stat_rounds';
    const STAT_ROUNDS_MAX = 200;
    const ADVANCED_RECORD_META_STORAGE_KEY = 'skct_advanced_record_meta';
    const ADVANCED_RECORD_MATERIAL_OPTIONS_STORAGE_KEY = 'skct_advanced_record_material_options';
    const ADVANCED_RECORD_ROUND_OPTIONS_STORAGE_KEY = 'skct_advanced_record_round_options';
    const DEFAULT_RECORD_MATERIAL_OPTIONS = ['링커리어 CBT', '에듀윌', '해커스', '시대에듀', '렛유인'];
    const DEFAULT_RECORD_ROUND_OPTIONS = Array.from({ length: 20 }, (_, index) => `${index + 1}회차`);
    let publicAdvancedRecordOptionConfig = { materials: [], rounds: [] };
    const CSV_DETAIL_HEADER = ['회차ID', '채점시각', '모드', '영역', '문항번호', '입력답', '정답', 'CBT정답률(%)', '결과', '소요시간(초)', '정답여부', '풀이일시', '교재/자료', '회차'];

    const readStatRounds = () => {
        const stored = readJsonStorage(localStorage, STAT_ROUNDS_STORAGE_KEY);
        return Array.isArray(stored) ? stored : [];
    };
    const writeStatRounds = (rounds) => {
        try {
            const trimmed = rounds.slice(-STAT_ROUNDS_MAX);
            writeJsonStorage(localStorage, STAT_ROUNDS_STORAGE_KEY, trimmed);
        } catch (error) {
            /* 저장 용량 초과 등은 조용히 무시 (통계는 보조 기능) */
        }
    };

    const normalizeOptionText = (value) => String(value || '').trim().slice(0, 40);
    const normalizeOptionList = (values) => Array.from(new Set((Array.isArray(values) ? values : [])
        .map(normalizeOptionText)
        .filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));
    const getRecordBaseOptions = (kind) => {
        const isRound = kind === 'round';
        const defaults = isRound ? DEFAULT_RECORD_ROUND_OPTIONS : DEFAULT_RECORD_MATERIAL_OPTIONS;
        const publicOptions = isRound
            ? publicAdvancedRecordOptionConfig.rounds
            : publicAdvancedRecordOptionConfig.materials;
        return normalizeOptionList([...defaults, ...normalizeOptionList(publicOptions)]);
    };
    const readStoredOptions = (key, defaults) => {
        const stored = readJsonStorage(localStorage, key);
        const merged = [...defaults, ...(Array.isArray(stored) ? stored : [])]
            .map(normalizeOptionText)
            .filter(Boolean);
        return Array.from(new Set(merged)).sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));
    };
    const writeStoredOptions = (key, defaults, options) => {
        const personal = Array.from(new Set((Array.isArray(options) ? options : [])
            .map(normalizeOptionText)
            .filter(Boolean)
            .filter((value) => !defaults.includes(value))));
        writeJsonStorage(localStorage, key, personal);
    };
    const populateAdvancedRecordSelect = (select, options, selectedValue) => {
        if (!select) return;
        const selected = normalizeOptionText(selectedValue) || options[0] || '';
        select.innerHTML = '<option value="__add__">옵션 추가하기</option>' + options
            .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
            .join('');
        select.value = options.includes(selected) ? selected : options[0] || '';
    };
    const syncAdvancedRecordOptionConfig = (config = {}) => {
        publicAdvancedRecordOptionConfig = {
            materials: normalizeOptionList(config.materials || config.materialOptions || []),
            rounds: normalizeOptionList(config.rounds || config.roundOptions || [])
        };
        const stored = readJsonStorage(localStorage, ADVANCED_RECORD_META_STORAGE_KEY) || {};
        populateAdvancedRecordSelect(
            advancedRecordMaterialSelect,
            readStoredOptions(ADVANCED_RECORD_MATERIAL_OPTIONS_STORAGE_KEY, getRecordBaseOptions('material')),
            advancedRecordMaterialSelect?.value || stored.material || '링커리어 CBT'
        );
        populateAdvancedRecordSelect(
            advancedRecordRoundSelect,
            readStoredOptions(ADVANCED_RECORD_ROUND_OPTIONS_STORAGE_KEY, getRecordBaseOptions('round')),
            advancedRecordRoundSelect?.value || stored.roundLabel || '1회차'
        );
    };
    const suggestAdvancedRecordOption = async (kind, value) => {
        if (!isAdvancedMode || !verifiedAdvancedLicenseBundle || !value) return;
        try {
            await postToSecureApi('/advanced/record-option/suggest', {
                licenseBundle: verifiedAdvancedLicenseBundle,
                kind,
                value
            }, '옵션 제안을 서버에 저장하지 못했습니다.');
        } catch (error) {
            try { console.warn('[advanced record option suggestion]', error?.message || error); } catch (e) { /* noop */ }
        }
    };
    const readAdvancedRecordMeta = () => {
        const stored = readJsonStorage(localStorage, ADVANCED_RECORD_META_STORAGE_KEY) || {};
        return {
            practicedAt: String(advancedRecordDateTimeInput?.value || stored.practicedAt || getCurrentKstDateTimeLocalValue()),
            material: normalizeOptionText(advancedRecordMaterialSelect?.value || stored.material || '링커리어 CBT') || '링커리어 CBT',
            roundLabel: normalizeOptionText(advancedRecordRoundSelect?.value || stored.roundLabel || '1회차') || '1회차'
        };
    };
    const persistAdvancedRecordMeta = () => {
        writeJsonStorage(localStorage, ADVANCED_RECORD_META_STORAGE_KEY, readAdvancedRecordMeta());
    };
    const initAdvancedRecordMetaControls = () => {
        const stored = readJsonStorage(localStorage, ADVANCED_RECORD_META_STORAGE_KEY) || {};
        if (advancedRecordDateTimeInput && !advancedRecordDateTimeInput.value) {
            advancedRecordDateTimeInput.value = stored.practicedAt || getCurrentKstDateTimeLocalValue();
        }
        populateAdvancedRecordSelect(advancedRecordMaterialSelect, readStoredOptions(ADVANCED_RECORD_MATERIAL_OPTIONS_STORAGE_KEY, getRecordBaseOptions('material')), stored.material || '링커리어 CBT');
        populateAdvancedRecordSelect(advancedRecordRoundSelect, readStoredOptions(ADVANCED_RECORD_ROUND_OPTIONS_STORAGE_KEY, getRecordBaseOptions('round')), stored.roundLabel || '1회차');
    };
    const handleAdvancedRecordOptionAdd = (select, key, defaults, label, kind) => {
        if (!select || select.value !== '__add__') return;
        const value = normalizeOptionText(prompt(`${label} 옵션명을 입력하세요.`));
        const options = readStoredOptions(key, defaults);
        if (value) {
            options.push(value);
            writeStoredOptions(key, defaults, options);
            populateAdvancedRecordSelect(select, readStoredOptions(key, defaults), value);
            suggestAdvancedRecordOption(kind, value);
        } else {
            populateAdvancedRecordSelect(select, options, options[0]);
        }
    };
    window.addEventListener('skct:public-config', (event) => {
        syncAdvancedRecordOptionConfig(event.detail?.recordOptionConfig || {});
    });
    initAdvancedRecordMetaControls();
    [advancedRecordDateTimeInput, advancedRecordMaterialSelect, advancedRecordRoundSelect].filter(Boolean).forEach((element) => {
        element.addEventListener('change', () => {
            handleAdvancedRecordOptionAdd(advancedRecordMaterialSelect, ADVANCED_RECORD_MATERIAL_OPTIONS_STORAGE_KEY, getRecordBaseOptions('material'), '교재/자료', 'material');
            handleAdvancedRecordOptionAdd(advancedRecordRoundSelect, ADVANCED_RECORD_ROUND_OPTIONS_STORAGE_KEY, getRecordBaseOptions('round'), '회차', 'round');
            persistAdvancedRecordMeta();
        });
    });
    if (window.__SKCT_PUBLIC_CONFIG?.recordOptionConfig) {
        syncAdvancedRecordOptionConfig(window.__SKCT_PUBLIC_CONFIG.recordOptionConfig);
    }

    const buildStatRoundRecord = (model) => {
        const id = currentStatRoundId || `R-${Date.now().toString(36).toUpperCase()}`;
        currentStatRoundId = id;
        return {
            id,
            ts: new Date().toISOString(),
            mode: isPracticeMode ? 'practice' : 'exam',
            meta: readAdvancedRecordMeta(),
            treatSkippedAsWrong: model.treatSkippedAsWrong,
            overall: { ...model.overall },
            subjects: model.subjectRows.map((row) => ({
                id: row.id,
                name: row.name,
                ...row.summary
            })),
            items: model.questionItems.map((item) => ({
                no: item.no,
                subjId: item.subjId,
                subjName: item.subjName,
                num: item.num,
                myAnswer: item.myAnswer,
                correctAnswer: item.correctAnswer,
                cbtAnswerRate: item.cbtAnswerRate,
                answerSource: item.answerSource,
                resultKey: item.resultKey,
                resultLabel: item.resultLabel,
                spent: item.spent,
                elapsedMs: Math.max(0, Math.round((Number(item.spent) || 0) * 1000)),
                skipped: item.skipped,
                unanswered: item.unanswered,
                correct: item.correct
            }))
        };
    };

    const buildServerStudySessionRecord = (model) => {
        const record = buildStatRoundRecord(model || collectDetailedStatsModel());
        const createdAt = Date.now();
        const wrongItems = (record.items || []).filter((item) => (
            item.resultKey === 'wrong' || item.resultKey === 'skipped_wrong'
        ));
        return {
            schemaVersion: 1,
            clientId: record.id,
            createdAt,
            title: `SKCT ${record.meta?.material || '연습'} ${record.meta?.roundLabel || new Date(createdAt).toLocaleDateString('ko-KR')}`,
            meta: record.meta || readAdvancedRecordMeta(),
            mode: record.mode,
            total: {
                correct: record.overall.correct,
                attempted: record.overall.attempted,
                skipped: record.overall.skipped,
                unanswered: record.overall.unanswered,
                accuracyAttempted: Math.round((record.overall.attemptedRate || 0) * 10) / 10,
                accuracyOverall: Math.round((record.overall.overallRate || 0) * 10) / 10
            },
            sections: (record.subjects || []).map((section) => ({
                id: section.id,
                name: section.name,
                correct: section.correct,
                attempted: section.attempted,
                skipped: section.skipped,
                unanswered: section.unanswered,
                accuracyAttempted: Math.round((section.attemptedRate || 0) * 10) / 10,
                accuracyOverall: Math.round((section.overallRate || 0) * 10) / 10
            })),
            items: (record.items || []).map((item) => ({
                no: item.no,
                section: item.subjName,
                sectionId: item.subjId,
                sectionNo: item.num,
                userAnswer: item.myAnswer == null ? '' : String(item.myAnswer),
                correctAnswer: item.correctAnswer == null ? '' : String(item.correctAnswer),
                cbtAnswerRate: item.cbtAnswerRate == null ? null : Number(item.cbtAnswerRate),
                answerSource: item.answerSource || '',
                isCorrect: item.correct === true,
                skipped: item.skipped === true,
                unanswered: item.unanswered === true,
                elapsedMs: item.elapsedMs,
                tags: [],
                memo: ''
            })),
            wrongNotes: wrongItems.map((item) => ({
                sessionId: record.id,
                no: item.no,
                section: item.subjName,
                sectionId: item.subjId,
                userAnswer: item.myAnswer == null ? '' : String(item.myAnswer),
                correctAnswer: item.correctAnswer == null ? '' : String(item.correctAnswer),
                cbtAnswerRate: item.cbtAnswerRate == null ? null : Number(item.cbtAnswerRate),
                answerSource: item.answerSource || '',
                elapsedMs: item.elapsedMs,
                reasonTag: item.resultKey === 'skipped_wrong' ? '시간부족' : '다시풀기필요',
                memo: '',
                status: 'open',
                createdAt
            }))
        };
    };

    const readQueuedStudySessions = () => {
        const queue = readJsonStorage(localStorage, ADVANCED_STUDY_SESSION_QUEUE_KEY);
        return Array.isArray(queue) ? queue : [];
    };

    const queueServerStudySessionRecord = (record) => {
        const queue = readQueuedStudySessions().filter((item) => item && item.clientId !== record.clientId);
        queue.push(record);
        writeJsonStorage(localStorage, ADVANCED_STUDY_SESSION_QUEUE_KEY, queue.slice(-STAT_ROUNDS_MAX));
    };

    const buildServerStudySessionRecordFromStatRound = (record) => {
        const createdAt = Number.isFinite(Date.parse(record?.ts)) ? Date.parse(record.ts) : Date.now();
        const items = Array.isArray(record?.items) ? record.items : [];
        const wrongItems = items.filter((item) => {
            if (item?.resultKey === 'wrong' || item?.resultKey === 'skipped_wrong') return true;
            if (item?.unanswered || item?.skipped) return false;
            return item?.correct === false && item?.myAnswer != null && item?.myAnswer !== '';
        });
        return {
            schemaVersion: 1,
            clientId: record?.id || `R-${createdAt.toString(36).toUpperCase()}`,
            createdAt,
            title: `SKCT ${record?.meta?.material || '연습'} ${record?.meta?.roundLabel || new Date(createdAt).toLocaleDateString('ko-KR')}`,
            meta: record?.meta || readAdvancedRecordMeta(),
            mode: record?.mode === 'exam' ? 'exam' : 'practice',
            total: {
                correct: Number(record?.overall?.correct) || 0,
                attempted: Number(record?.overall?.attempted) || 0,
                skipped: Number(record?.overall?.skipped) || 0,
                unanswered: Number(record?.overall?.unanswered) || 0,
                accuracyAttempted: Math.round((Number(record?.overall?.attemptedRate) || 0) * 10) / 10,
                accuracyOverall: Math.round((Number(record?.overall?.overallRate) || 0) * 10) / 10
            },
            sections: (Array.isArray(record?.subjects) ? record.subjects : []).map((section) => ({
                id: section.id || section.name,
                name: section.name || section.id || '-',
                correct: Number(section.correct) || 0,
                attempted: Number(section.attempted) || 0,
                skipped: Number(section.skipped) || 0,
                unanswered: Number(section.unanswered) || 0,
                accuracyAttempted: Math.round((Number(section.attemptedRate) || 0) * 10) / 10,
                accuracyOverall: Math.round((Number(section.overallRate) || 0) * 10) / 10
            })),
            items: items.map((item) => ({
                no: Number(item.no) || Number(item.num) || 0,
                section: item.subjName || item.section || '',
                sectionId: item.subjId || item.sectionId || item.subjName || '',
                sectionNo: Number(item.num) || 0,
                userAnswer: item.myAnswer == null ? '' : String(item.myAnswer),
                correctAnswer: item.correctAnswer == null ? '' : String(item.correctAnswer),
                cbtAnswerRate: item.cbtAnswerRate == null ? null : Number(item.cbtAnswerRate),
                answerSource: item.answerSource || '',
                isCorrect: item.correct === true,
                skipped: item.skipped === true,
                unanswered: item.unanswered === true,
                elapsedMs: Math.max(0, Math.round((Number(item.elapsedMs) || Number(item.spent) * 1000 || 0))),
                tags: [],
                memo: ''
            })),
            wrongNotes: wrongItems.map((item) => ({
                sessionId: record?.id || '',
                no: Number(item.no) || Number(item.num) || 0,
                section: item.subjName || item.section || '',
                sectionId: item.subjId || item.sectionId || item.subjName || '',
                userAnswer: item.myAnswer == null ? '' : String(item.myAnswer),
                correctAnswer: item.correctAnswer == null ? '' : String(item.correctAnswer),
                elapsedMs: Math.max(0, Math.round((Number(item.elapsedMs) || Number(item.spent) * 1000 || 0))),
                reasonTag: item.resultKey === 'skipped_wrong' ? '시간부족' : '다시풀기필요',
                memo: '',
                status: 'open',
                createdAt
            }))
        };
    };

    const queueStatRoundsToServer = (rounds) => {
        if (!isAdvancedMode) {
            return { ok: false, queued: 0, message: '고급 모드에서만 기록 보관함에 저장할 수 있습니다.' };
        }
        const validRounds = (Array.isArray(rounds) ? rounds : [])
            .filter((round) => round && round.id && round.overall && Number(round.overall.attempted) > 0);
        if (!validRounds.length) {
            return { ok: false, queued: 0, message: '서버에 반영할 회차 기록이 없습니다. 먼저 채점하거나 CSV를 불러와 주세요.' };
        }
        validRounds.forEach((round) => queueServerStudySessionRecord(buildServerStudySessionRecordFromStatRound(round)));
        return {
            ok: true,
            queued: validRounds.length,
            message: `${validRounds.length}개 회차를 기록 보관함 저장 대기열에 담았습니다. 보관함이 열리면 자동 반영됩니다.`
        };
    };

    const saveCurrentStudySessionToQueue = (model) => {
        if (!isAdvancedMode) {
            if (advancedSaveSessionStatus) advancedSaveSessionStatus.textContent = '고급 모드에서 채점한 기록만 보관함에 저장할 수 있습니다.';
            return { ok: false, queued: 0, message: '고급 모드에서 채점한 기록만 보관함에 저장할 수 있습니다.' };
        }
        const usableModel = model || collectDetailedStatsModel();
        if (!usableModel.overall || usableModel.overall.attempted <= 0) {
            if (advancedSaveSessionStatus) advancedSaveSessionStatus.textContent = '먼저 답안을 체크하고 채점해주세요.';
            return { ok: false, queued: 0, message: '먼저 답안을 체크하고 채점해주세요.' };
        }
        const record = buildServerStudySessionRecord(usableModel);
        queueServerStudySessionRecord(record);
        if (advancedSaveSessionStatus) {
            advancedSaveSessionStatus.textContent = '저장 준비가 끝났습니다. 기록 보관함을 열면 고급 계정에 자동 반영됩니다.';
        }
        return { ok: true, queued: 1, message: '현재 채점 기록을 기록 보관함 저장 대기열에 담았습니다. 보관함이 열리면 자동 반영됩니다.' };
    };

    // 채점할 때마다 현재 세션의 회차 기록을 저장/갱신한다.
    // 같은 미채점 세션 안에서 재채점하면 같은 회차ID로 덮어쓰고,
    // 답안 마킹으로 돌아가면(currentStatRoundId 초기화) 다음 채점은 새 회차가 된다.
    const recordCurrentStatRound = (model) => {
        const usableModel = model || collectDetailedStatsModel();
        if (!usableModel.overall || usableModel.overall.attempted <= 0) return;
        const record = buildStatRoundRecord(usableModel);
        const rounds = readStatRounds();
        const existingIdx = rounds.findIndex((r) => r && r.id === record.id);
        if (existingIdx >= 0) {
            rounds[existingIdx] = record;
        } else {
            rounds.push(record);
        }
        writeStatRounds(rounds);
    };

    const csvEscape = (value) => {
        const text = value == null ? '' : String(value);
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csvRow = (cells) => cells.map(csvEscape).join(',');

    const buildStatRoundsCsv = (rounds) => {
        const lines = [];
        // 사람이 읽는 영역별 누적 요약 (파서는 #로 시작하는 행을 건너뜀)
        buildExportMetaLines('성장 기록 CSV', {
            '총 회차': `${rounds.length}회차`,
            '현재 선택 자료': readAdvancedRecordMeta().material,
            '현재 선택 회차': readAdvancedRecordMeta().roundLabel
        }).forEach((line) => lines.push(`# ${line}`));
        lines.push('# SKCT 연습 통계 누적 (영역별 정답률 요약)');
        const subjAgg = {};
        rounds.forEach((round) => {
            (round.subjects || []).forEach((subj) => {
                if (!subjAgg[subj.id]) {
                    subjAgg[subj.id] = { name: subj.name, correct: 0, attempted: 0, total: 0 };
                }
                subjAgg[subj.id].correct += Number(subj.correct) || 0;
                subjAgg[subj.id].attempted += Number(subj.attempted) || 0;
                subjAgg[subj.id].total += Number(subj.total) || 0;
            });
        });
        lines.push('# 영역,누적정답,누적응답,누적전체,정답률(응답대비%),정답률(전체대비%)');
        Object.values(subjAgg).forEach((agg) => {
            const aRate = agg.attempted > 0 ? ((agg.correct / agg.attempted) * 100).toFixed(1) : '0';
            const oRate = agg.total > 0 ? ((agg.correct / agg.total) * 100).toFixed(1) : '0';
            lines.push(`# ${agg.name},${agg.correct},${agg.attempted},${agg.total},${aRate},${oRate}`);
        });
        lines.push('#');
        // 기계 판독용 문항 단위 상세 (재업로드 시 이 테이블만 파싱)
        lines.push(csvRow(CSV_DETAIL_HEADER));
        rounds.forEach((round) => {
            (round.items || []).forEach((item) => {
                lines.push(csvRow([
                    round.id,
                    round.ts,
                    round.mode === 'practice' ? '연습' : '실전',
                    item.subjName,
                    item.num,
                    item.myAnswer == null ? '' : item.myAnswer,
                    item.correctAnswer == null ? '' : item.correctAnswer,
                    item.cbtAnswerRate == null ? '' : formatBulkRate(item.cbtAnswerRate).replace('%', ''),
                    item.resultLabel,
                    item.spent > 0 ? item.spent : '',
                    item.correct ? 1 : 0,
                    round.meta?.practicedAt || '',
                    round.meta?.material || '',
                    round.meta?.roundLabel || ''
                ]));
            });
        });
        return lines.join('\r\n');
    };

    const downloadStatRoundsCsv = () => {
        recordCurrentStatRound();
        const rounds = readStatRounds();
        if (!rounds.length) {
            return { ok: false, message: '아직 저장된 회차가 없습니다. 먼저 채점을 진행해주세요.' };
        }
        const csv = buildStatRoundsCsv(rounds);
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const stamp = formatKstFileStamp();
        anchor.href = url;
        anchor.download = `SKCT_성장기록_${stamp}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        return { ok: true, message: `성장 기록 ${rounds.length}회차를 CSV로 저장했습니다.` };
    };

    // CSV 한 줄을 셀 배열로 분해 (따옴표 이스케이프 처리)
    const parseCsvLine = (line) => {
        const cells = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
                } else {
                    cur += ch;
                }
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                cells.push(cur); cur = '';
            } else {
                cur += ch;
            }
        }
        cells.push(cur);
        return cells;
    };

    const subjectNameToId = (name) => {
        const match = subjects.find((s) => s.name === String(name).trim());
        return match ? match.id : null;
    };

    // 내보낸 CSV를 다시 읽어 회차 기록으로 복원 (재업로드 누적용)
    const parseStatRoundsCsv = (text) => {
        const clean = String(text || '').replace(/^\uFEFF/, '');
        const rawLines = clean.split(/\r\n|\n|\r/);
        const dataLines = rawLines.filter((l) => l.trim() && !l.startsWith('#'));
        if (!dataLines.length) return [];
        const header = parseCsvLine(dataLines[0]).map((c) => c.trim());
        if (header[0] !== CSV_DETAIL_HEADER[0]) return [];
        const findIdx = (...names) => {
            const normalizedNames = names.map((name) => String(name).replace(/\s+/g, '').toLowerCase());
            return header.findIndex((cell) => normalizedNames.includes(String(cell).replace(/\s+/g, '').toLowerCase()));
        };
        const idx = {
            id: findIdx('회차ID'),
            ts: findIdx('채점시각'),
            mode: findIdx('모드'),
            subj: findIdx('영역'),
            num: findIdx('문항번호'),
            my: findIdx('입력답'),
            correct: findIdx('정답'),
            rate: findIdx('CBT정답률(%)', 'CBT정답률', '정답률'),
            result: findIdx('결과'),
            spent: findIdx('소요시간(초)'),
            isCorrect: findIdx('정답여부'),
            practicedAt: findIdx('풀이일시'),
            material: findIdx('교재/자료', '자료', '교재'),
            roundLabel: findIdx('회차')
        };
        if ([idx.id, idx.ts, idx.mode, idx.subj, idx.num, idx.my, idx.correct, idx.result, idx.spent, idx.isCorrect].some((value) => value < 0)) return [];
        const roundsMap = new Map();
        for (let i = 1; i < dataLines.length; i++) {
            const cells = parseCsvLine(dataLines[i]);
            if (cells.length <= Math.max(idx.id, idx.ts, idx.mode, idx.subj, idx.num, idx.my, idx.correct, idx.result, idx.spent, idx.isCorrect)) continue;
            const id = cells[idx.id].trim();
            if (!id) continue;
            if (!roundsMap.has(id)) {
                const fallbackMeta = readAdvancedRecordMeta();
                roundsMap.set(id, {
                    id,
                    ts: cells[idx.ts].trim() || new Date().toISOString(),
                    mode: cells[idx.mode].trim() === '실전' ? 'exam' : 'practice',
                    meta: {
                        practicedAt: idx.practicedAt >= 0 ? (cells[idx.practicedAt] || fallbackMeta.practicedAt) : fallbackMeta.practicedAt,
                        material: idx.material >= 0 ? (cells[idx.material] || fallbackMeta.material) : fallbackMeta.material,
                        roundLabel: idx.roundLabel >= 0 ? (cells[idx.roundLabel] || fallbackMeta.roundLabel) : fallbackMeta.roundLabel
                    },
                    treatSkippedAsWrong: false,
                    items: []
                });
            }
            const round = roundsMap.get(id);
            const subjName = cells[idx.subj].trim();
            round.items.push({
                subjId: subjectNameToId(subjName),
                subjName,
                num: Number(cells[idx.num]) || 0,
                myAnswer: cells[idx.my].trim() || null,
                correctAnswer: cells[idx.correct].trim() || null,
                cbtAnswerRate: idx.rate >= 0 ? parseBulkRate(cells[idx.rate]) : null,
                answerSource: idx.rate >= 0 && parseBulkRate(cells[idx.rate]) != null ? 'CBT' : '',
                resultKey: '',
                resultLabel: cells[idx.result].trim(),
                spent: Number(cells[idx.spent]) || 0,
                correct: cells[idx.isCorrect].trim() === '1'
            });
        }
        // 영역별/전체 요약을 항목에서 재계산
        return Array.from(roundsMap.values()).map((round) => {
            const subjMap = {};
            let oc = 0, oa = 0, ot = 0;
            round.items.forEach((it) => {
                const sid = it.subjId || it.subjName;
                if (!subjMap[sid]) subjMap[sid] = { id: it.subjId, name: it.subjName, correct: 0, attempted: 0, total: 0 };
                subjMap[sid].total += 1; ot += 1;
                if (it.myAnswer != null && it.myAnswer !== '') { subjMap[sid].attempted += 1; oa += 1; }
                if (it.correct) { subjMap[sid].correct += 1; oc += 1; }
            });
            const subjectsArr = Object.values(subjMap).map((s) => ({
                ...s,
                attemptedRate: s.attempted > 0 ? (s.correct / s.attempted) * 100 : 0,
                overallRate: s.total > 0 ? (s.correct / s.total) * 100 : 0
            }));
            return {
                ...round,
                subjects: subjectsArr,
                overall: {
                    total: ot, attempted: oa, correct: oc,
                    skipped: 0, unanswered: 0, wrong: oa - oc,
                    attemptedRate: oa > 0 ? (oc / oa) * 100 : 0,
                    overallRate: ot > 0 ? (oc / ot) * 100 : 0
                }
            };
        });
    };

    // 재업로드한 회차를 기존 기록에 병합 (같은 회차ID는 덮어쓰지 않고 보존)
    const importStatRoundsCsv = (text) => {
        const incoming = parseStatRoundsCsv(text);
        if (!incoming.length) {
            return { ok: false, added: 0, message: 'CSV에서 회차 데이터를 찾지 못했습니다. 이 도구가 내보낸 CSV인지 확인해주세요.' };
        }
        const existing = readStatRounds();
        const existingIds = new Set(existing.map((r) => r && r.id));
        let added = 0;
        incoming.forEach((round) => {
            if (!existingIds.has(round.id)) {
                existing.push(round);
                existingIds.add(round.id);
                added += 1;
            }
        });
        existing.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
        writeStatRounds(existing);
        return {
            ok: true,
            added,
            total: existing.length,
            imported: incoming,
            message: added > 0
                ? `${added}개 회차를 누적했습니다. (총 ${existing.length}회차)`
                : `새로 추가된 회차가 없습니다. (이미 누적됨, 총 ${existing.length}회차)`
        };
    };

    const openDetailedStatsModal = () => {
        const tbody = document.getElementById('statTableBody');
        const detailWrapper = document.getElementById('statDetailWrapper');
        if (!tbody) return;

        const model = collectDetailedStatsModel();
        const trHtml = model.subjectRows.map((row) => `
            <tr style="border-bottom: 1px solid #e2e8f0; height: 30px;">
                <td style="font-weight: bold; color: #1e293b;">${row.name}</td>
                <td style="color: #0f172a; font-weight: 700;">${row.summary.correct} / ${row.summary.attempted} / ${row.summary.total}</td>
                <td style="color: #64748b;">${row.summary.skipped}</td>
                <td style="color: #94a3b8;">${row.summary.unanswered}</td>
                <td style="color: #f59e0b; font-weight: bold;">${formatRateText(row.summary.attemptedRate)} / ${formatRateText(row.summary.overallRate)}</td>
            </tr>
        `).join('');
        tbody.innerHTML = trHtml;

        const overallHtml = `
            <div style="padding: 10px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 8px; margin-bottom: 10px;">
                <div style="font-size: 11px; color: #334155; font-weight: 700; margin-bottom: 6px;">전체 요약</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    <span style="background:#eff6ff; color:#1d4ed8; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">맞은/푼/전체 ${model.overall.correct}/${model.overall.attempted}/${model.overall.total}</span>
                    <span style="background:#f8fafc; color:#475569; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">건너뜀 ${model.overall.skipped}</span>
                    <span style="background:#f8fafc; color:#64748b; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">못 풂 ${model.overall.unanswered}</span>
                    <span style="background:#ecfeff; color:#0f766e; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">푼 문제 대비 ${formatRateText(model.overall.attemptedRate)}</span>
                    <span style="background:#fffbeb; color:#b45309; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">전체 대비 ${formatRateText(model.overall.overallRate)}</span>
                    <span style="background:${model.treatSkippedAsWrong ? '#fee2e2' : '#f1f5f9'}; color:${model.treatSkippedAsWrong ? '#b91c1c' : '#475569'}; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">건너뜀 오답 처리 ${model.treatSkippedAsWrong ? 'ON' : 'OFF'}</span>
                </div>
            </div>
        `;

        const detailHtml = model.subjectRows.map((row) => {
            const itemRows = row.items.map((item) => {
                const tone = item.resultKey === 'correct'
                    ? { bg: '#ecfdf5', border: '#bbf7d0', color: '#166534' }
                    : item.resultKey === 'wrong' || item.resultKey === 'skipped_wrong'
                        ? { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' }
                        : item.resultKey === 'skipped'
                            ? { bg: '#f8fafc', border: '#cbd5e1', color: '#475569' }
                            : item.resultKey === 'pending'
                                ? { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' }
                                : { bg: '#f8fafc', border: '#e2e8f0', color: '#64748b' };
                return `
                    <tr class="stat-question-row" data-q="${item.num}" data-spent="${item.spent}" style="background:${tone.bg};">
                        <td style="padding:6px 8px; border:1px solid ${tone.border}; font-weight:700; color:#1e293b;">${item.num}번</td>
                        <td style="padding:6px 8px; border:1px solid ${tone.border}; color:#334155;">${item.myAnswer ?? '-'}</td>
                        <td style="padding:6px 8px; border:1px solid ${tone.border}; color:#334155;">${item.correctAnswer ?? '-'}</td>
                        <td style="padding:6px 8px; border:1px solid ${tone.border}; color:#475569;">${formatBulkRate(item.cbtAnswerRate)}</td>
                        <td style="padding:6px 8px; border:1px solid ${tone.border}; color:${tone.color}; font-weight:700;">${escapeHtml(item.resultLabel)}</td>
                        <td style="padding:6px 8px; border:1px solid ${tone.border}; color:#475569;">${item.spent > 0 ? `${item.spent}초` : '-'}</td>
                    </tr>
                `;
            }).join('');
            const subjectTopHtml = row.topTimes?.length
                ? `<div class="stat-subject-top-times">
                    <strong>오래 걸린 문항 Top</strong>
                    ${row.topTimes.map((item, idx) => `<span>${idx + 1}. ${item.num}번 ${item.spent}초</span>`).join('')}
                </div>`
                : `<div class="stat-subject-top-times muted">시간 기록이 쌓이면 오래 걸린 문항이 표시됩니다.</div>`;
            return `
                <details style="border:1px solid #dbeafe; border-radius:10px; background:#f8fbff; padding:0 12px;" data-stat-subject="${row.id}">
                    <summary style="cursor:pointer; list-style:none; padding:12px 0; display:flex; align-items:center; justify-content:space-between; gap:12px; font-weight:700; color:#1d4ed8;">
                        <span>${row.name}</span>
                        <span style="font-size:11px; color:#475569; font-weight:600;">${row.summary.correct}/${row.summary.attempted}/${row.summary.total} · 건너뜀 ${row.summary.skipped} · 못 풂 ${row.summary.unanswered}</span>
                    </summary>
                    <div style="padding:0 0 12px; border-top:1px dashed #bfdbfe;">
                        <div style="padding-top:10px;">
                            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
                                <span style="background:#ecfdf5; color:#166534; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">정답 ${row.summary.correct}</span>
                                <span style="background:#fef2f2; color:#b91c1c; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">오답 ${row.summary.wrong}</span>
                                <span style="background:#f8fafc; color:#475569; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">건너뜀 ${row.summary.skipped}</span>
                                <span style="background:#f8fafc; color:#64748b; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">못 풂 ${row.summary.unanswered}</span>
                                <span style="background:#ecfeff; color:#0f766e; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">푼 문제 대비 ${formatRateText(row.summary.attemptedRate)}</span>
                                <span style="background:#fffbeb; color:#b45309; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:700;">전체 대비 ${formatRateText(row.summary.overallRate)}</span>
                            </div>
                            ${subjectTopHtml}
                            <div class="stat-sort-controls">
                                <button type="button" class="stat-sort-btn active" data-stat-sort="num">문항번호순</button>
                                <button type="button" class="stat-sort-btn" data-stat-sort="spent">소요시간순</button>
                            </div>
                            <div style="overflow-x:auto;">
                                <table style="width:100%; min-width:500px; border-collapse:collapse; font-size:11px; text-align:center;">
                                    <thead>
                                        <tr style="background:#e0ecff;">
                                            <th style="padding:6px 8px; border:1px solid #bfdbfe;">문항</th>
                                            <th style="padding:6px 8px; border:1px solid #bfdbfe;">입력답</th>
                                            <th style="padding:6px 8px; border:1px solid #bfdbfe;">정답</th>
                                            <th style="padding:6px 8px; border:1px solid #bfdbfe;">CBT 정답률</th>
                                            <th style="padding:6px 8px; border:1px solid #bfdbfe;">결과</th>
                                            <th style="padding:6px 8px; border:1px solid #bfdbfe;">소요시간</th>
                                        </tr>
                                    </thead>
                                    <tbody class="stat-question-tbody">${itemRows}</tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </details>
            `;
        }).join('');

        if (detailWrapper) {
            detailWrapper.innerHTML = overallHtml + (detailHtml === '' ? '<div style="text-align:center; color:#10b981; font-weight:bold; margin-top:10px;">표시할 과목별 상세 통계가 없습니다.</div>' : detailHtml);
        }
        document.getElementById('statModal').classList.remove('hidden');
    };

    const openDetailedStatsPopout = () => {
        openDetailedStatsModal();
        const modal = document.getElementById('statModal');
        const body = modal?.querySelector('.modal-body');
        const popup = window.open('about:blank', 'skct_detail_stats', buildCenteredPopupFeatures(0.8, 0.8));
        if (!popup || !body) return;
        popup.document.open();
        popup.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SKCT 과목별 상세 통계</title>
<style>
body{margin:0;padding:24px;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{max-width:1200px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;box-shadow:0 20px 50px rgba(15,23,42,.12)}
h1{font-size:22px;margin:0 0 16px}
table{width:100%;border-collapse:collapse}
details{margin-bottom:10px}
button{display:none}
</style>
</head>
<body><div class="wrap"><h1>과목별 상세 통계</h1>${body.innerHTML}</div></body>
</html>`);
        popup.document.close();
        popup.focus();
    };

    const bindClickById = (id, handler) => {
        const wrappedHandler = (event) => {
            let trigger = null;
            if (event.currentTarget && event.currentTarget.id === id) {
                trigger = event.currentTarget;
            } else if (event.target instanceof Element) {
                trigger = event.target.closest(`#${id}`);
            }
            if (!trigger) return;
            if (!event.__skctHandledClickIds) {
                event.__skctHandledClickIds = new Set();
            }
            if (event.__skctHandledClickIds.has(id)) return;
            event.__skctHandledClickIds.add(id);
            handler(event);
        };
        document.addEventListener('click', wrappedHandler, true);
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', wrappedHandler);
        }
    };

    if (detailScoreBtn) {
        detailScoreBtn.addEventListener('click', openDetailedStatsModal);
    }
    if (detailStatsPopoutBtn) {
        detailStatsPopoutBtn.addEventListener('click', openDetailedStatsPopout);
    }
    document.addEventListener('click', (event) => {
        const sortButton = event.target instanceof Element ? event.target.closest('.stat-sort-btn') : null;
        if (!sortButton) return;
        const detail = sortButton.closest('[data-stat-subject]');
        const tbody = detail?.querySelector('.stat-question-tbody');
        if (!tbody) return;
        detail.querySelectorAll('.stat-sort-btn').forEach((button) => {
            button.classList.toggle('active', button === sortButton);
        });
        const sortMode = sortButton.dataset.statSort || 'num';
        const rows = Array.from(tbody.querySelectorAll('.stat-question-row'));
        rows.sort((a, b) => {
            const aNum = Number(a.dataset.q) || 0;
            const bNum = Number(b.dataset.q) || 0;
            if (sortMode === 'spent') {
                const spentDiff = (Number(b.dataset.spent) || 0) - (Number(a.dataset.spent) || 0);
                return spentDiff || (aNum - bNum);
            }
            return aNum - bNum;
        });
        rows.forEach((row) => tbody.appendChild(row));
    });
    bindClickById('bulkCorrectImportBtn', openBulkCorrectImportModal);
    bindClickById('bulkCorrectImportParseBtn', parseBulkCorrectImport);
    if (bulkCorrectQuestionCol) {
        bulkCorrectQuestionCol.addEventListener('change', renderBulkCorrectPreview);
    }
    if (bulkCorrectAnswerCol) {
        bulkCorrectAnswerCol.addEventListener('change', renderBulkCorrectPreview);
    }
    if (bulkCorrectRateCol) {
        bulkCorrectRateCol.addEventListener('change', renderBulkCorrectPreview);
    }
    bindClickById('bulkCorrectImportApplyBtn', applyBulkCorrectImport);


    /* --- Notepad / Canvas Toggle --- */
    const tabNotepad = document.getElementById('tabNotepad');
    const tabCanvas = document.getElementById('tabCanvas');
    const notepadWrapper = document.getElementById('notepadWrapper');
    const canvasWrapper = document.getElementById('canvasWrapper');
    const notepad = document.getElementById('notepad');
    const canvasCursorIndicator = document.getElementById('canvasCursorIndicator');
    let suppressCalculatorFocusUntil = 0;

    function setCanvasCursorVisibility(visible) {
        if (!canvasCursorIndicator) return;
        if (visible) {
            canvasCursorIndicator.classList.remove('hidden');
            requestAnimationFrame(() => canvasCursorIndicator.classList.add('visible'));
            return;
        }
        canvasCursorIndicator.classList.remove('visible');
        window.setTimeout(() => {
            if (!canvasCursorIndicator.classList.contains('visible')) {
                canvasCursorIndicator.classList.add('hidden');
            }
        }, 120);
    }

    tabNotepad.addEventListener('click', () => {
        tabNotepad.classList.add('active');
        tabCanvas.classList.remove('active');
        notepadWrapper.classList.remove('hidden');
        canvasWrapper.classList.add('hidden');
        setCanvasCursorVisibility(false);
    });

    tabCanvas.addEventListener('click', () => {
        tabCanvas.classList.add('active');
        tabNotepad.classList.remove('active');
        canvasWrapper.classList.remove('hidden');
        notepadWrapper.classList.add('hidden');
        resizeCanvas(); // Ensure canvas fits when revealed
    });

    if (notepad) {
        const markRecentNotepadInteraction = () => {
            suppressCalculatorFocusUntil = Date.now() + 180;
        };
        notepad.addEventListener('pointerdown', markRecentNotepadInteraction);
        notepad.addEventListener('pointerup', markRecentNotepadInteraction);
        notepad.addEventListener('mouseup', markRecentNotepadInteraction);
        notepad.addEventListener('touchend', markRecentNotepadInteraction, { passive: true });
    }

    /* --- Drawing Board (Canvas) Logic --- */
    const canvas = document.getElementById('drawingBoard');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Resize canvas safely
    function resizeCanvas() {
        if (canvasWrapper.classList.contains('hidden')) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);

        canvas.width = canvasWrapper.clientWidth;
        canvas.height = canvasWrapper.clientHeight;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // 흐물흐물한 크레용 느낌 모방 (투명도 + 굵기)
        ctx.lineWidth = currentToolUiConfig.canvasLineWidth;
        ctx.strokeStyle = 'rgba(40, 40, 60, 0.9)';

        ctx.drawImage(tempCanvas, 0, 0);
    }

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 50);
    });

    // Initial size
    setTimeout(() => { if (!canvasWrapper.classList.contains('hidden')) resizeCanvas(); }, 100);

    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function updateCanvasCursorPosition(e) {
        if (!canvasCursorIndicator) return;
        const rect = canvas.getBoundingClientRect();
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
        canvasCursorIndicator.style.transform = `translate(${clientX - rect.left}px, ${clientY - rect.top}px)`;
    }

    function startDrawing(e) {
        if(e.type === 'mousedown' && e.button !== 0) return; // Only left click
        isDrawing = true;
        const pos = getMousePos(e);
        lastX = pos.x;
        lastY = pos.y;
        updateCanvasCursorPosition(e);
        setCanvasCursorVisibility(!e.touches);
        e.preventDefault(); // prevent touch scroll
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        updateCanvasCursorPosition(e);

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        lastX = pos.x;
        lastY = pos.y;
        e.preventDefault();
    }

    function stopDrawing() {
        isDrawing = false;
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', (event) => {
        updateCanvasCursorPosition(event);
        setCanvasCursorVisibility(true);
        draw(event);
    });
    canvas.addEventListener('mouseenter', (event) => {
        updateCanvasCursorPosition(event);
        setCanvasCursorVisibility(true);
    });
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', () => {
        stopDrawing();
        setCanvasCursorVisibility(false);
    });

    canvas.addEventListener('touchstart', (event) => {
        setCanvasCursorVisibility(false);
        startDrawing(event);
    });
    canvas.addEventListener('touchmove', (event) => {
        setCanvasCursorVisibility(false);
        draw(event);
    });
    canvas.addEventListener('touchend', () => {
        stopDrawing();
        setCanvasCursorVisibility(false);
    });

    noteFontSizeRange?.addEventListener('input', () => {
        applyToolUiConfig({ noteFontSize: noteFontSizeRange.value });
    });

    canvasLineWidthRange?.addEventListener('input', () => {
        applyToolUiConfig({ canvasLineWidth: canvasLineWidthRange.value });
        ctx.lineWidth = currentToolUiConfig.canvasLineWidth;
    });

    /* --- global Utilities --- */
    document.getElementById('clearCurrentToolBtn').addEventListener('click', () => {
        if (!canvasWrapper.classList.contains('hidden')) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            notepad.value = '';
        }
    });

    document.getElementById('globalClearBtn').addEventListener('click', (event) => {
        event.preventDefault();
        advanceQuestion(true);
    });

    const omrResetBtn = document.getElementById('omrResetBtn');
    if (omrResetBtn) {
        omrResetBtn.addEventListener('click', () => {
            if (confirm("모든 답안과 정답을 초기화하시겠습니까?")) {
                omrState.myAnswers = {};
                omrState.correctAnswers = {};
                correctAnswerMeta = {};
                omrState.currentGlobalIndex = 0;
                omrState.mode = 'answer';
                advancedScoringActionsUnlocked = false;
                questionTimings = {};
                currentStatRoundId = null;
                resetCurrentQuestionTimer();
                lockedSubjectIndices.clear(); // 잠금 해제
                updateModeUI();

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                notepad.value = '';
                calcState.current = '0';
                calcState.expressionTokens = [];
                calcState.waitingNew = false;
                calcState.justEvaluated = false;
                calcState.history = [];
                updateCalcDisplay();

                document.getElementById('scoreResult').classList.add('hidden');
                renderOMR();

                requestAnimationFrame(() => {
                    omrBody.scrollTop = 0;
                });
            }
        });
    }

    /* --- Calculator Logic --- */
    const calcHistory = document.getElementById('calcHistory');
    const CALC_MAX_INPUT_LENGTH = 32;
    const calcState = {
        current: '0',
        expressionTokens: [],
        waitingNew: false,
        justEvaluated: false,
        history: [],
        lastEvaluatedLine: '',
        lastAnswerArchived: true
    };

    function getOperatorSymbol(operator) {
        if (operator === '*') return '×';
        if (operator === '/') return '÷';
        return operator || '';
    }

    function limitCalcInput(value) {
        return value.length <= CALC_MAX_INPUT_LENGTH ? value : value.slice(0, CALC_MAX_INPUT_LENGTH);
    }

    function escapeCalcLine(line) {
        return String(line)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
    }

    function getCalcLineSizeClass(line, isCurrent = false) {
        const length = String(line).length;
        if (length > (isCurrent ? 26 : 24)) return 'calc-line-tight';
        if (length > (isCurrent ? 18 : 16)) return 'calc-line-compact';
        return '';
    }

    function pushCalcHistory(line) {
        calcState.history.push(line);
        calcState.history = calcState.history.slice(-3);
    }

    function archiveCurrentAnswerLine() {
        if (!calcState.justEvaluated || calcState.lastAnswerArchived) return;
        const ansLine = `Ans = ${calcState.current}`;
        if (calcState.history.length && calcState.history[calcState.history.length - 1] === calcState.lastEvaluatedLine) {
            calcState.history[calcState.history.length - 1] = ansLine;
        } else {
            pushCalcHistory(ansLine);
        }
        calcState.lastAnswerArchived = true;
    }

    function isOperatorToken(token) {
        return ['+', '-', '*', '/'].includes(token);
    }

    function formatExpression(tokens) {
        return tokens.map((token) => isOperatorToken(token) ? getOperatorSymbol(token) : token).join(' ');
    }

    function getPendingCalcLine() {
        if (!calcState.expressionTokens.length) return null;
        if (calcState.waitingNew) {
            return formatExpression(calcState.expressionTokens);
        }
        return formatExpression([...calcState.expressionTokens, calcState.current]);
    }

    function evaluateExpression(tokens) {
        if (!tokens.length) return '0';
        const values = [parseFloat(tokens[0])];
        const operators = [];

        for (let i = 1; i < tokens.length; i += 2) {
            operators.push(tokens[i]);
            values.push(parseFloat(tokens[i + 1]));
        }

        if (values.some((value) => !Number.isFinite(value))) {
            return 'Error';
        }

        const collapsedValues = [values[0]];
        const collapsedOperators = [];

        for (let i = 0; i < operators.length; i++) {
            const operator = operators[i];
            const nextValue = values[i + 1];
            if (operator === '*' || operator === '/') {
                const leftValue = collapsedValues.pop();
                if (operator === '/' && nextValue === 0) {
                    return 'Error';
                }
                collapsedValues.push(operator === '*' ? leftValue * nextValue : leftValue / nextValue);
            } else {
                collapsedOperators.push(operator);
                collapsedValues.push(nextValue);
            }
        }

        let result = collapsedValues[0];
        for (let i = 0; i < collapsedOperators.length; i++) {
            const operator = collapsedOperators[i];
            const nextValue = collapsedValues[i + 1];
            result = operator === '+' ? result + nextValue : result - nextValue;
        }

        return Number.isFinite(result)
            ? String(Math.round(result * 100000000) / 100000000)
            : 'Error';
    }

    function updateCalcDisplay() {
        if (!calcHistory) return;
        const upperLines = [...calcState.history];
        const pendingLine = getPendingCalcLine();
        if (pendingLine) {
            upperLines.push(pendingLine);
        }

        const lines = upperLines.slice(-3).map((line) => {
            const sizeClass = getCalcLineSizeClass(line, false);
            return `<div class="calc-line history-line ${sizeClass}">${escapeCalcLine(line)}</div>`;
        });
        const currentSizeClass = getCalcLineSizeClass(calcState.current, true);
        lines.push(`<div class="calc-line current-line ${currentSizeClass}">${escapeCalcLine(calcState.current)}</div>`);
        calcHistory.innerHTML = lines.join('');
        calcHistory.scrollTop = calcHistory.scrollHeight;
    }

    function resetCalculator() {
        calcState.current = '0';
        calcState.expressionTokens = [];
        calcState.waitingNew = false;
        calcState.justEvaluated = false;
        calcState.history = [];
        calcState.lastEvaluatedLine = '';
        calcState.lastAnswerArchived = true;
        updateCalcDisplay();
    }

    function calculateResult() {
        if (!calcState.expressionTokens.length) return;

        const expressionTokens = [...calcState.expressionTokens];
        if (isOperatorToken(expressionTokens[expressionTokens.length - 1])) {
            expressionTokens.push(calcState.current);
        }

        const resultText = evaluateExpression(expressionTokens);
        const expressionLine = `${formatExpression(expressionTokens)} = ${resultText}`;
        pushCalcHistory(expressionLine);
        calcState.current = resultText;
        calcState.expressionTokens = [];
        calcState.waitingNew = true;
        calcState.justEvaluated = true;
        calcState.lastEvaluatedLine = expressionLine;
        calcState.lastAnswerArchived = false;
        updateCalcDisplay();
    }

    function handleNumber(numStr) {
        if (calcState.waitingNew) {
            if (calcState.justEvaluated && !calcState.expressionTokens.length) {
                archiveCurrentAnswerLine();
            }
            calcState.current = numStr === '.' ? '0.' : numStr;
            calcState.waitingNew = false;
            calcState.justEvaluated = false;
            calcState.lastAnswerArchived = true;
        } else if (numStr === '.') {
            if (!calcState.current.includes('.')) {
                calcState.current += '.';
            }
        } else if (numStr === '00') {
            calcState.current = calcState.current === '0' ? '0' : `${calcState.current}00`;
        } else if (calcState.current === '0') {
            calcState.current = numStr;
        } else {
            calcState.current += numStr;
        }
        calcState.current = limitCalcInput(calcState.current);
        updateCalcDisplay();
    }

    function handleOperator(op) {
        if (calcState.justEvaluated && !calcState.expressionTokens.length) {
            archiveCurrentAnswerLine();
        }
        if (!calcState.expressionTokens.length) {
            calcState.expressionTokens = [calcState.current, op];
        } else if (calcState.waitingNew) {
            if (isOperatorToken(calcState.expressionTokens[calcState.expressionTokens.length - 1])) {
                calcState.expressionTokens[calcState.expressionTokens.length - 1] = op;
            } else {
                calcState.expressionTokens.push(op);
            }
        } else {
            calcState.expressionTokens.push(calcState.current, op);
        }
        calcState.waitingNew = true;
        calcState.justEvaluated = false;
        calcState.lastAnswerArchived = true;
        updateCalcDisplay();
    }

    function handleFn(fnStr) {
        if (fnStr === 'C') {
            resetCalculator();
            return;
        } else if (fnStr === 'BACK') {
            if (calcState.waitingNew && calcState.expressionTokens.length && isOperatorToken(calcState.expressionTokens[calcState.expressionTokens.length - 1])) {
                calcState.expressionTokens.pop();
                calcState.waitingNew = false;
                calcState.justEvaluated = false;
            } else if (!calcState.waitingNew && calcState.current !== '0' && calcState.current !== 'Error') {
                calcState.current = calcState.current.slice(0, -1);
                if (calcState.current === '' || calcState.current === '-') calcState.current = '0';
            }
        } else if (fnStr === 'SQRT') {
            const currentValue = parseFloat(calcState.current);
            const result = Number.isFinite(currentValue) && currentValue >= 0
                ? String(Math.round(Math.sqrt(currentValue) * 100000000) / 100000000)
                : 'Error';
            calcState.current = result;
            calcState.waitingNew = false;
            calcState.justEvaluated = false;
            calcState.lastAnswerArchived = true;
        } else if (fnStr === '=') {
            calculateResult();
        }
        updateCalcDisplay();
    }

    updateCalcDisplay();

    // UI Buttons
    document.querySelectorAll('.calc-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.target.dataset.val;
            if (e.target.classList.contains('num-btn')) {
                handleNumber(val);
            } else if (e.target.classList.contains('op-btn')) {
                handleOperator(val);
            } else if (e.target.classList.contains('fn-btn')) {
                // If it's pure C/Equal
                handleFn(val);
            }
        });
    });

    // Keyboard Support
    window.addEventListener('keydown', (e) => {
        // Prevent if user is typing in notepad or any input/textarea/select/editable
        const ae = document.activeElement;
        if (ae === notepad || ae?.tagName === 'INPUT' || ae?.tagName === 'TEXTAREA' || ae?.tagName === 'SELECT' || ae?.isContentEditable) {
            return;
        }

        const key = e.key;

        // Numbers
        if (/[0-9]/.test(key)) {
            handleNumber(key);
            e.preventDefault();
        }
        else if (key === '.') {
            handleNumber('.');
            e.preventDefault();
        }
        // Operators
        else if (['+', '-', '*', '/'].includes(key)) {
            handleOperator(key);
            e.preventDefault();
        }
        else if (key === 'Enter' || key === '=') {
            calculateResult();
            e.preventDefault();
        }
        else if (key === 'Backspace') {
            handleFn('BACK');
            e.preventDefault();
        }
        else if (key.toLowerCase() === 'c') {
            handleFn('C');
            e.preventDefault();
        }
        // Explicitly block Delete, Escape from clearing the calc as requested
        else if (key === 'Delete' || key === 'Escape') {
            // Do nothing intentionally
            e.preventDefault();
        }
    });


    const getConfiguredPhaseTotalSeconds = () => {
        const subjectTotal = subjects.length * configSubjectMins * 60;
        const breakTotal = Math.max(subjects.length - 1, 0) * configBreakMins * 60;
        return subjectTotal + breakTotal;
    };

    const getEffectiveConfiguredTotalSeconds = () => {
        return configTotalMins * 60;
    };

    const buildPhases = () => {
        phases = [];
        subjects.forEach((subj, idx) => {
            phases.push({ type: 'subject', name: `${idx+1}과목 ${subj.name}`, mins: configSubjectMins });
            if (idx < subjects.length - 1) {
                phases.push({ type: 'break', name: '쉬는 시간', mins: configBreakMins });
            }
        });
        currentPhaseIdx = 0;
        if (phases.length > 0) {
            currentPhaseSeconds = phases[0].mins * 60;
        }
    };

    let savedTimerCfg = null;
    if (!isAdminPreviewMode) {
        savedTimerCfg = readJsonStorage(localStorage, 'skct_timer_cfg');
        if (isLegacyDefaultTimerConfig(savedTimerCfg)) {
            localStorage.removeItem('skct_timer_cfg');
            savedTimerCfg = null;
        }
    }
    if (savedTimerCfg) {
        configTotalMins = sanitizeMinutes(savedTimerCfg.total, 75);
        configSubjectMins = sanitizeMinutes(savedTimerCfg.subj, 15);
        configBreakMins = sanitizeMinutes(savedTimerCfg.brk, 1);
    }

    let configGuideEnabled = true;
    let configGuideSec = 45;
    const savedGuideCfg = isAdminPreviewMode ? null : JSON.parse(localStorage.getItem('skct_guide_cfg'));
    if (savedGuideCfg) {
        configGuideEnabled = savedGuideCfg.enabled;
        configGuideSec = savedGuideCfg.sec;
    }
    let configTreatSkippedAsWrong = false;
    const savedScoreCfg = isAdminPreviewMode ? null : JSON.parse(localStorage.getItem('skct_score_cfg'));
    if (savedScoreCfg && typeof savedScoreCfg.treatSkippedAsWrong === 'boolean') {
        configTreatSkippedAsWrong = savedScoreCfg.treatSkippedAsWrong;
    }
    let configExportIdentityIncluded = true;
    const savedExportIdentity = isAdminPreviewMode ? null : localStorage.getItem(ADVANCED_EXPORT_IDENTITY_STORAGE_KEY);
    if (savedExportIdentity === '0') {
        configExportIdentityIncluded = false;
    }
    const totalTimeInput = document.getElementById('cfgTotal');
    const subjectTimeInput = document.getElementById('cfgSubj');
    const breakTimeInput = document.getElementById('cfgBreak');
    const guideEnabledInput = document.getElementById('cfgGuideEnabled');
    const guideSecInput = document.getElementById('cfgGuideSec');
    const skippedAsWrongInput = document.getElementById('cfgSkippedAsWrong');
    const exportIdentityInput = document.getElementById('cfgExportIdentity');

    if(totalTimeInput) totalTimeInput.value = configTotalMins;
    if(subjectTimeInput) subjectTimeInput.value = configSubjectMins;
    if(breakTimeInput) breakTimeInput.value = configBreakMins;
    if(guideEnabledInput) guideEnabledInput.checked = configGuideEnabled;
    if(guideSecInput) guideSecInput.value = configGuideSec;
    if(skippedAsWrongInput) skippedAsWrongInput.checked = configTreatSkippedAsWrong;
    if(exportIdentityInput) exportIdentityInput.checked = configExportIdentityIncluded;

    totalSeconds = getEffectiveConfiguredTotalSeconds();
    buildPhases();

    const displayTotal = document.getElementById('displayTotalTime');
    const displayPName = document.getElementById('displayPhaseName');
    const displayPTime = document.getElementById('displayPhaseTime');
    const timerPlayBtn = document.getElementById('timerPlayBtn');

    const formatTime = (totalSecs) => {
        if (totalSecs < 0) totalSecs = 0;
        const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
        const s = (totalSecs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const syncTimerPlayButtonLabel = (isRunning) => {
        if (!timerPlayBtn) return;
        timerPlayBtn.textContent = isRunning ? '■' : '▶';
        timerPlayBtn.setAttribute('aria-label', isRunning ? '타이머 중지' : '타이머 시작');
        timerPlayBtn.title = isRunning ? '타이머 중지' : '타이머 시작';
    };

    const getCurrentPhase = () => currentPhaseIdx < phases.length ? phases[currentPhaseIdx] : null;

    const canSkipToNextSubject = () => {
        if (!isAdvancedMode || isPracticeMode) return false;
        if (currentPhaseIdx >= phases.length) return false;
        const currentPhase = getCurrentPhase();
        if (currentPhase?.type !== 'subject') return false;
        return currentPhaseIdx + 2 < phases.length;
    };

    const getCurrentTimerSubjectIndex = () => {
        if (currentPhaseIdx >= phases.length) return subjects.length - 1;
        return Math.max(0, Math.min(subjects.length - 1, Math.floor(currentPhaseIdx / 2)));
    };

    const canGoPreviousSubject = () => {
        if (!isAdvancedMode) return false;
        return getCurrentTimerSubjectIndex() > 0;
    };

    const canResetFullTimer = () => isAdvancedMode && phases.length > 0;

    const updateSubjectResetButton = () => {
        const subjectResetBtn = document.getElementById('subjectResetBtn');
        if (!subjectResetBtn) return;
        const enabled = canGoPreviousSubject();
        subjectResetBtn.disabled = !enabled;
        subjectResetBtn.textContent = '이전 과목';
        if (!isAdvancedMode) {
            subjectResetBtn.title = '고급 모드에서 이전 과목으로 돌아갈 수 있습니다.';
        } else if (currentPhaseIdx >= phases.length) {
            subjectResetBtn.title = '이미 모든 과목이 종료되었습니다.';
        } else if (!enabled) {
            subjectResetBtn.title = '첫 과목에서는 이전 과목이 없습니다.';
        } else {
            subjectResetBtn.title = '현재 과목 답안을 지우고 이전 과목으로 돌아가기';
        }
    };

    const updateSubjectSkipButton = () => {
        const subjectSkipBtn = document.getElementById('subjectSkipBtn');
        if (!subjectSkipBtn) return;
        const enabled = canSkipToNextSubject();
        subjectSkipBtn.disabled = !enabled;
        if (!isAdvancedMode) {
            subjectSkipBtn.title = '고급 모드에서 다음 과목으로 바로 이동할 수 있습니다.';
        } else if (isPracticeMode) {
            subjectSkipBtn.title = '응시 모드에서만 사용할 수 있습니다.';
        } else if (currentPhaseIdx >= phases.length) {
            subjectSkipBtn.title = '이미 모든 과목이 종료되었습니다.';
        } else if (getCurrentPhase()?.type === 'break') {
            subjectSkipBtn.title = '쉬는 시간에는 사용할 수 없습니다.';
        } else if (currentPhaseIdx + 2 >= phases.length) {
            subjectSkipBtn.title = '다음 과목이 남아 있을 때만 사용할 수 있습니다.';
        } else {
            subjectSkipBtn.title = '현재 과목을 끝내고 다음 과목으로 이동';
        }
    };

    const updateFullResetButton = () => {
        const fullResetBtn = document.getElementById('fullResetBtn');
        if (!fullResetBtn) return;
        const enabled = canResetFullTimer();
        fullResetBtn.disabled = !enabled;
        fullResetBtn.textContent = '처음부터';
        fullResetBtn.title = enabled
            ? '전체 답안을 지우고 처음부터 다시 시작'
            : '고급 모드에서 전체 세트를 다시 시작할 수 있습니다.';
    };

    const updateTimerActionButtons = () => {
        updateSubjectSkipButton();
        updateSubjectResetButton();
        updateFullResetButton();
    };

    const updateQuestionGuideUI = () => {
        const guideWrapper = document.getElementById('guideTimerWrapper');
        const displayGuide = document.getElementById('displayGuideTime');
        const qKey = getCurrentQKey();
        if (guideWrapper && displayGuide && isAdvancedMode && configGuideEnabled && !isPracticeMode && timerIsRunning && qKey && currentPhaseIdx < phases.length && phases[currentPhaseIdx].type !== 'break') {
            guideWrapper.style.display = 'block';
            const remaining = configGuideSec - getLiveQuestionSpentSec();
            const questionNo = getCurrentQuestionDisplayNumber();
            const prefix = questionNo ? `${questionNo}번 · 기준 ${configGuideSec}초 · ` : `기준 ${configGuideSec}초 · `;
            if (remaining >= 0) {
                displayGuide.style.color = '#38bdf8';
                displayGuide.innerText = `${prefix}${remaining}초 남음`;
            } else {
                displayGuide.style.color = '#ef4444';
                displayGuide.innerText = `${prefix}+${Math.abs(remaining)}초 초과`;
            }
        } else if (guideWrapper) {
            guideWrapper.style.display = 'none';
        }
    };

    const updateTimerUI = () => {
        if(!displayTotal) return;
        displayTotal.innerText = `${formatTime(totalSeconds)}`;
        if (currentPhaseIdx < phases.length) {
            const p = phases[currentPhaseIdx];
            displayPName.innerText = `${p.name}`;
            displayPTime.innerText = formatTime(currentPhaseSeconds);
            if (p.type === 'break') {
                displayPName.style.color = '#fb923c';
                displayPTime.style.color = '#fb923c';
            } else {
                displayPName.style.color = '#60a5fa';
                displayPTime.style.color = '#4ade80';
            }
        } else {
            displayPName.innerText = '모든 시험 종료';
            displayPTime.innerText = '00:00';
            displayPName.style.color = '#ef4444';
            displayPTime.style.color = '#ef4444';
        }

        updateQuestionGuideUI();

        updateTimerActionButtons();
    };

    window.applyRemoteTimerDefaults = (total, subj, brk) => {
        if (timerIsRunning) return; // ignore if running
        configSubjectMins = sanitizeMinutes(subj, 15);
        configBreakMins = sanitizeMinutes(brk, 1);
        configTotalMins = sanitizeMinutes(total, 75);

        if (totalTimeInput) totalTimeInput.value = configTotalMins;
        if (subjectTimeInput) subjectTimeInput.value = configSubjectMins;
        if (breakTimeInput) breakTimeInput.value = configBreakMins;

        totalSeconds = getEffectiveConfiguredTotalSeconds();
        buildPhases();
        updateTimerUI();
    };

    window.applyRemoteGuideDefaults = (enabled, sec) => {
        configGuideEnabled = enabled;
        configGuideSec = sec || 45;
        if (guideEnabledInput) guideEnabledInput.checked = enabled;
        if (guideSecInput) guideSecInput.value = sec;
        updateTimerUI();
    };

    window.applyRemoteLayoutRatios = (timer, utils, calc) => {
        setLayoutRatios(timer, utils, calc, {
            persist: false,
            notifyPopupEditor: false
        });
    };

    window.applyRemoteToolUiConfig = (toolUiConfig) => {
        remoteToolUiConfig = normalizeToolUiConfig(toolUiConfig);
        applyToolUiConfig(remoteToolUiConfig, {
            persist: false,
            notifyPopupEditor: false
        });
    };

    window.applyRemotePopupLayout = (popupLayout) => {
        remotePopupLayout = normalizePopupLayout(popupLayout);
        if (!isPopupMode) {
            return;
        }
        currentPopupLayout = normalizePopupLayout(remotePopupLayout);
        applyPopupOmrWidthRatio(currentPopupLayout.omrWidthRatio);
        schedulePopupEditorSync();
    };

    // 부드러운 알람 비프음 (Web Audio API)
    let audioCtx = null;
    const initAudio = () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    };

    const playBeep = (freq = 600, durationMs = 300, count = 1) => {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const playSingle = (startTime) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            osc.type = 'triangle'; // 부드러운 소리
            osc.frequency.setValueAtTime(freq, startTime);

            // Envelope: 부드럽게 커지고 서서히 작아짐 (팝 노이즈 방지)
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + durationMs / 1000);

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.start(startTime);
            osc.stop(startTime + durationMs / 1000);
        };

        const now = audioCtx.currentTime;
        for (let i = 0; i < count; i++) {
            playSingle(now + i * (durationMs / 1000 + 0.2)); // 간격 추가
        }
    };

    updateTimerUI();

    const timerTick = () => {
        const currentPhase = currentPhaseIdx < phases.length ? phases[currentPhaseIdx] : null;
        if (currentPhase?.type !== 'break') {
            if (totalSeconds > 0) {
                totalSeconds--;
            } else {
                clearInterval(timerInterval);
                timerIsRunning = false;
                syncTimerPlayButtonLabel(false);
                currentPhaseIdx = phases.length;
                updateTimerUI();
                playBeep(440, 300, 3); // 전체 시간 종료
                return;
            }
        }

        if (currentPhaseIdx < phases.length) {
            if (currentPhaseSeconds > 0) {
                currentPhaseSeconds--;
            } else {
                advancePhaseBoundary();
            }
        }
        updateTimerUI();
    };

    const applyPhaseToOMR = () => {
        const breakOverlay = document.getElementById('omrBreakOverlay');
        if (currentPhaseIdx >= phases.length) {
            if (breakOverlay) breakOverlay.classList.add('hidden');
            renderOMR();
            return;
        }
        const currentPhase = phases[currentPhaseIdx];
        if (currentPhase.type === 'break') {
            if (!isPracticeMode && timerIsRunning) {
                if (breakOverlay) breakOverlay.classList.remove('hidden');
            } else {
                // 연습 모드이거나 타이머 중지 상태: break overlay 표시하지 않음
                if (breakOverlay) breakOverlay.classList.add('hidden');
            }
        } else {
            if (breakOverlay) breakOverlay.classList.add('hidden');

            const subjIdx = Math.floor(currentPhaseIdx / 2);
            const targetIndex = getSubjectStartIndex(subjIdx);
            if (!isPracticeMode) {
                // 실전 모드: 강제로 다음 과목 첫 문항으로 이동
                if (omrState.currentGlobalIndex < targetIndex) {
                    syncCurrentQuestionElapsed('visited');
                    omrState.currentGlobalIndex = targetIndex;
                    resetCurrentQuestionTimer();
                }
            }
            renderOMR();
        }
    };

    const advancePhaseBoundary = ({ skipRemainingPhaseSeconds = false } = {}) => {
        if (currentPhaseIdx >= phases.length) return;
        const endedPhase = phases[currentPhaseIdx];
        const endedPhaseIdx = currentPhaseIdx;

        if (endedPhase?.type === 'subject') {
            syncCurrentQuestionElapsed('visited');
        }
        currentPhaseIdx++;

        if (typeof ctx !== 'undefined' && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (typeof notepad !== 'undefined') notepad.value = '';
        if (typeof calcState !== 'undefined') {
            resetCalculator();
        }

        if (currentPhaseIdx < phases.length) {
            currentPhaseSeconds = phases[currentPhaseIdx].mins * 60;
            if (endedPhase.type === 'subject') {
                playBeep(659, 400, 2);
                if (!isPracticeMode) {
                    const subjIdx = Math.floor(endedPhaseIdx / 2);
                    lockedSubjectIndices.add(subjIdx);
                }
            } else if (!skipRemainingPhaseSeconds) {
                playBeep(523, 400, 1);
            }
            applyPhaseToOMR();
        } else {
            clearInterval(timerInterval);
            timerIsRunning = false;
            syncTimerPlayButtonLabel(false);
            playBeep(440, 500, 3);
            if (!isPracticeMode) {
                const subjIdx = Math.floor((currentPhaseIdx - 1) / 2);
                lockedSubjectIndices.add(subjIdx);
            }
            applyPhaseToOMR();
        }
    };

    const skipCurrentBreak = () => {
        if (!timerIsRunning || currentPhaseIdx >= phases.length) return;
        const currentPhase = phases[currentPhaseIdx];
        if (currentPhase?.type !== 'break') return;
        advancePhaseBoundary({ skipRemainingPhaseSeconds: true });
        updateTimerUI();
    };

    const clearQuestionTimingsForSubjectRange = (startSubjectIdx, endSubjectIdx = startSubjectIdx) => {
        for (let subjectIdx = startSubjectIdx; subjectIdx <= endSubjectIdx; subjectIdx++) {
            const subject = subjects[subjectIdx];
            if (!subject) continue;
            const prefix = `${subject.id}_`;
            Object.keys(questionTimings).forEach((key) => {
                if (key.startsWith(prefix)) {
                    delete questionTimings[key];
                }
            });
        }
    };

    const clearMyAnswersForSubjectRange = (startSubjectIdx, endSubjectIdx = startSubjectIdx) => {
        for (let subjectIdx = startSubjectIdx; subjectIdx <= endSubjectIdx; subjectIdx++) {
            const subject = subjects[subjectIdx];
            if (!subject) continue;
            const prefix = `${subject.id}_`;
            Object.keys(omrState.myAnswers).forEach((key) => {
                if (key.startsWith(prefix)) {
                    delete omrState.myAnswers[key];
                }
            });
        }
    };

    const clearLockedSubjectsFrom = (startSubjectIdx) => {
        [...lockedSubjectIndices].forEach((subjectIdx) => {
            if (subjectIdx >= startSubjectIdx) {
                lockedSubjectIndices.delete(subjectIdx);
            }
        });
    };

    const computeRemainingTotalSecondsFromSubject = (subjectIdx, currentSubjectSeconds) => {
        let remaining = Math.max(0, currentSubjectSeconds);
        for (let idx = subjectIdx + 1; idx < subjects.length; idx++) {
            remaining += configSubjectMins * 60;
        }
        return remaining;
    };

    const goToPreviousSubject = () => {
        if (!canGoPreviousSubject()) return;
        const currentSubjectIdx = getCurrentTimerSubjectIndex();
        const targetSubjectIdx = Math.max(0, currentSubjectIdx - 1);
        const currentSubjectName = subjects[currentSubjectIdx]?.name || '현재 과목';
        if (!confirm(`${currentSubjectName}의 입력 답안이 초기화됩니다. 이전 과목으로 돌아갈까요?`)) return;
        stopTimer();
        currentPhaseIdx = targetSubjectIdx * 2;
        currentPhaseSeconds = phases[currentPhaseIdx].mins * 60;
        totalSeconds = computeRemainingTotalSecondsFromSubject(targetSubjectIdx, currentPhaseSeconds);
        resetCurrentQuestionTimer();
        clearMyAnswersForSubjectRange(currentSubjectIdx);
        clearQuestionTimingsForSubjectRange(currentSubjectIdx);
        clearLockedSubjectsFrom(targetSubjectIdx);
        omrState.currentGlobalIndex = getSubjectStartIndex(targetSubjectIdx);
        if (omrState.mode !== 'answer') {
            omrState.mode = 'answer';
            updateModeUI();
        }
        applyPhaseToOMR();
        updateTimerUI();
    };

    const resetAllTimerProgress = () => {
        if (!canResetFullTimer()) return;
        if (!confirm('전체 과목의 입력 답안이 초기화됩니다. 처음부터 다시 시작할까요?')) return;
        stopTimer();
        totalSeconds = getEffectiveConfiguredTotalSeconds();
        buildPhases();
        resetCurrentQuestionTimer();
        questionTimings = {};
        lockedSubjectIndices.clear();
        omrState.myAnswers = {};
        omrState.currentGlobalIndex = 0;
        if (omrState.mode !== 'answer') {
            omrState.mode = 'answer';
            updateModeUI();
        }
        applyPhaseToOMR();
        updateTimerUI();
    };

    const skipCurrentSubjectToNext = () => {
        if (!canSkipToNextSubject()) return;
        syncCurrentQuestionElapsed('skipped');
        totalSeconds = Math.max(0, totalSeconds - Math.max(0, currentPhaseSeconds));
        resetCurrentQuestionTimer();
        advancePhaseBoundary({ skipRemainingPhaseSeconds: true });
        if (currentPhaseIdx < phases.length && phases[currentPhaseIdx]?.type === 'break') {
            advancePhaseBoundary({ skipRemainingPhaseSeconds: true });
        }
        updateTimerUI();
    };

    // --- 초기 렌더링 갱신 ---
    updateTimerUI();
    applyPhaseToOMR();
    syncTimerPlayButtonLabel(timerIsRunning);

    if(timerPlayBtn) {
        timerPlayBtn.addEventListener('click', () => {
            initAudio(); // 사용자 인터랙션 시 AudioContext 활성화
            if (currentPhaseIdx >= phases.length && totalSeconds <= 0) return;
            if (timerIsRunning) {
                clearInterval(timerInterval);
                timerIsRunning = false;
                syncTimerPlayButtonLabel(false);
                applyPhaseToOMR();
            } else {
                timerInterval = setInterval(timerTick, 1000);
                timerIsRunning = true;
                resetCurrentQuestionTimer();
                if (!analyticsState.practiceStarted) {
                    analyticsState.practiceStarted = true;
                    trackAnalyticsEvent('practice_start', {
                        practice_mode: isPracticeMode ? 'practice' : 'exam',
                        total_minutes: configTotalMins,
                        subject_minutes: configSubjectMins,
                        break_minutes: configBreakMins
                    });
                }
                syncTimerPlayButtonLabel(true);
                applyPhaseToOMR();
            }
        });
    }

    const breakSkipBtn = document.getElementById('breakSkipBtn');
    if (breakSkipBtn) {
        breakSkipBtn.addEventListener('click', () => {
            skipCurrentBreak();
        });
    }

    const subjectSkipBtn = document.getElementById('subjectSkipBtn');
    if (subjectSkipBtn) {
        subjectSkipBtn.addEventListener('click', () => {
            skipCurrentSubjectToNext();
        });
    }

    const subjectResetBtn = document.getElementById('subjectResetBtn');
    if (subjectResetBtn) {
        subjectResetBtn.addEventListener('click', () => {
            goToPreviousSubject();
        });
    }

    const fullResetBtn = document.getElementById('fullResetBtn');
    if (fullResetBtn) {
        fullResetBtn.addEventListener('click', () => {
            resetAllTimerProgress();
        });
    }

    const settingsToggle = document.getElementById('settingsToggle');
    const settingsModal = document.getElementById('settingsModal');
    if(settingsToggle && settingsModal) {
        settingsToggle.addEventListener('click', () => {
            // 모달 열릴 때 현재 모드 상태 동기화
            const practiceModeInput = document.getElementById('cfgPracticeMode');
            if (practiceModeInput) {
                if (!isAdvancedMode) isPracticeMode = false;
                practiceModeInput.checked = isPracticeMode;
                practiceModeInput.disabled = !isAdvancedMode;
                practiceModeInput.closest('label')?.classList.toggle('is-disabled', !isAdvancedMode);
            }
            if (exportIdentityInput) {
                exportIdentityInput.checked = configExportIdentityIncluded;
            }
            settingsModal.classList.remove('hidden');
        });
    }

    const settingsApplyBtn = document.getElementById('settingsApplyBtn');
    if (settingsApplyBtn) {
        settingsApplyBtn.addEventListener('click', () => {
            configSubjectMins = sanitizeMinutes(document.getElementById('cfgSubj').value, 15);
            configBreakMins = sanitizeMinutes(document.getElementById('cfgBreak').value, 1);
            configTotalMins = sanitizeMinutes(document.getElementById('cfgTotal').value, 75);
            document.getElementById('cfgTotal').value = configTotalMins;
            if (!isAdminPreviewMode) {
                localStorage.setItem('skct_timer_cfg', JSON.stringify({total: configTotalMins, subj: configSubjectMins, brk: configBreakMins, source: 'user'}));
            }

            configGuideEnabled = document.getElementById('cfgGuideEnabled').checked;
            configGuideSec = parseInt(document.getElementById('cfgGuideSec').value) || 45;
            if (!isAdminPreviewMode) {
                localStorage.setItem('skct_guide_cfg', JSON.stringify({enabled: configGuideEnabled, sec: configGuideSec}));
            }
            configTreatSkippedAsWrong = document.getElementById('cfgSkippedAsWrong').checked;
            if (!isAdminPreviewMode) {
                localStorage.setItem('skct_score_cfg', JSON.stringify({ treatSkippedAsWrong: configTreatSkippedAsWrong }));
            }
            if (exportIdentityInput) {
                configExportIdentityIncluded = exportIdentityInput.checked;
                if (!isAdminPreviewMode) {
                    localStorage.setItem(ADVANCED_EXPORT_IDENTITY_STORAGE_KEY, configExportIdentityIncluded ? '1' : '0');
                }
            }

            // 모드 설정 적용
            const practiceModeInput = document.getElementById('cfgPracticeMode');
            if (practiceModeInput) {
                isPracticeMode = isAdvancedMode && practiceModeInput.checked;
                practiceModeInput.checked = isPracticeMode;
                practiceModeInput.disabled = !isAdvancedMode;
                localStorage.setItem('skct_practice_mode', isPracticeMode);
            }

            if (timerIsRunning) {
                stopTimer();
            }
            totalSeconds = getEffectiveConfiguredTotalSeconds();
            lockedSubjectIndices.clear(); // 모드 변경 시 잠금 초기화
            buildPhases();
            updateTimerUI();
            applyRatios();
            renderOMR();
            const scoreResultEl = document.getElementById('scoreResult');
            const statModalEl = document.getElementById('statModal');
            if (scoreResultEl && !scoreResultEl.classList.contains('hidden')) {
                updateScoreSummaryPanel();
            }
            if (statModalEl && !statModalEl.classList.contains('hidden')) {
                openDetailedStatsModal();
            }
            settingsModal.classList.add('hidden');
        });
    }

    const openAdvancedEntryModal = () => {
        if (isAdvancedMode) return;
        if (advancedAccessStatus) advancedAccessStatus.textContent = '';
        if (advancedAccessPasswordInput) advancedAccessPasswordInput.value = '';
        ensureManualSubscriptionStartDate();
        const recentRequest = readRecentRequestInfo();
        if (recentRequest?.lookupIdentifier) {
            const recentLookupValue = String(recentRequest.lookupIdentifier || '').trim();
            if (manualSubscriptionLookupIdInput && !manualSubscriptionLookupIdInput.value) {
                manualSubscriptionLookupIdInput.value = recentLookupValue;
            }
            if (advancedAccessIdInput && !advancedAccessIdInput.value) {
                advancedAccessIdInput.value = recentLookupValue;
            }
        }
        updateAdvancedAccessPanel();
        advancedGuideModal?.classList.remove('hidden');
    };
    if (advancedGuideToggle && advancedGuideModal) {
        advancedGuideToggle.addEventListener('click', () => {
            openAdvancedEntryModal();
        });
    }
    try {
        const initialParams = new URLSearchParams(window.location.search || '');
        if (initialParams.get('open') === 'advanced') {
            window.setTimeout(() => {
                openAdvancedEntryModal();
                initialParams.delete('open');
                const nextQuery = initialParams.toString();
                const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
                window.history.replaceState({}, document.title, nextUrl);
            }, 0);
        }
    } catch (error) {
        // Query parsing should never block the core practice tool.
    }
    if (advancedToggle && advancedFeatureModal) {
        advancedToggle.addEventListener('click', () => {
            if (!isAdvancedMode) return;
            if (advancedToolsStatus) {
                advancedToolsStatus.textContent = '';
                advancedToolsStatus.classList.add('hidden');
            }
            advancedFeatureModal.classList.remove('hidden');
        });
    }
    if (advancedFeatureManualFlowBtn && advancedGuideModal && advancedFeatureModal) {
        advancedFeatureManualFlowBtn.addEventListener('click', () => {
            advancedFeatureModal.classList.add('hidden');
            advancedGuideModal.classList.remove('hidden');
        });
    }
    if (advancedStatsDownloadBtn) {
        advancedStatsDownloadBtn.addEventListener('click', () => {
            const result = downloadDetailedStatsText();
            setAdvancedToolsStatus(result?.message || '문항별 통계 TXT 파일을 저장했습니다.');
        });
    }
    const setAdvancedToolsStatus = (message) => {
        if (!advancedToolsStatus) return;
        advancedToolsStatus.textContent = message;
        advancedToolsStatus.classList.toggle('hidden', !message);
    };
    const openArchiveAfterQueue = (result) => {
        setAdvancedToolsStatus(result?.message || '기록 보관함에 반영할 기록을 준비했습니다.');
        if (result?.ok) {
            notifyArchiveFrameImport();
            void prewarmStudyArchiveFrame({ force: false });
            window.setTimeout(() => openStudyArchivePage(), 80);
        }
    };
    if (advancedStatsServerBtn) {
        advancedStatsServerBtn.addEventListener('click', () => {
            const model = collectDetailedStatsModel();
            recordCurrentStatRound(model);
            openArchiveAfterQueue(saveCurrentStudySessionToQueue(model));
        });
    }
    if (advancedStatsCsvBtn) {
        advancedStatsCsvBtn.addEventListener('click', () => {
            const result = downloadStatRoundsCsv();
            setAdvancedToolsStatus(result.message);
        });
    }
    if (advancedStatsCsvServerBtn) {
        advancedStatsCsvServerBtn.addEventListener('click', () => {
            recordCurrentStatRound();
            openArchiveAfterQueue(queueStatRoundsToServer(readStatRounds()));
        });
    }
    if (advancedStatsCsvImportBtn && advancedStatsCsvFileInput) {
        advancedStatsCsvImportBtn.addEventListener('click', () => {
            advancedStatsCsvFileInput.value = '';
            advancedStatsCsvFileInput.click();
        });
        advancedStatsCsvFileInput.addEventListener('change', () => {
            const file = advancedStatsCsvFileInput.files && advancedStatsCsvFileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const result = importStatRoundsCsv(String(reader.result || ''));
                    lastImportedStatRounds = Array.isArray(result.imported) ? result.imported : [];
                    setAdvancedToolsStatus(result.message);
                } catch (error) {
                    lastImportedStatRounds = [];
                    setAdvancedToolsStatus('CSV를 읽는 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
                }
            };
            reader.onerror = () => setAdvancedToolsStatus('파일을 읽지 못했습니다. 다시 시도해주세요.');
            reader.readAsText(file, 'utf-8');
        });
    }
    if (advancedStatsCsvImportServerBtn) {
        advancedStatsCsvImportServerBtn.addEventListener('click', () => {
            if (!lastImportedStatRounds.length) {
                setAdvancedToolsStatus('먼저 CSV 불러오기를 눌러 성장 기록 파일을 가져와 주세요.');
                return;
            }
            openArchiveAfterQueue(queueStatRoundsToServer(lastImportedStatRounds));
        });
    }
    if (manualSubscriptionSubmitBtn) {
        manualSubscriptionSubmitBtn.addEventListener('click', handleManualSubscriptionPrimaryAction);
    }

    function formatAdvancedRemainingTime(bundle) {
        if (!bundle) return '고급모드 정보를 아직 확인하지 못했습니다.';
        const expiryTime = getAdvancedLicenseExpiryTime(bundle);
        if (!Number.isFinite(expiryTime)) return '영구 이용권입니다.';
        const remainingMs = expiryTime - Date.now();
        if (remainingMs <= 0) return '고급모드 이용권이 만료되었습니다.';
        const totalMinutes = Math.max(1, Math.floor(remainingMs / 60000));
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;
        if (days > 0) return `${days}일 ${hours}시간 남았습니다.`;
        if (hours > 0) return `${hours}시간 ${minutes}분 남았습니다.`;
        return `${minutes}분 남았습니다.`;
    }

    function formatSavedDuration(totalSeconds) {
        const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainSeconds = seconds % 60;
        if (hours > 0) return `${hours}시간 ${minutes}분`;
        if (minutes > 0) return `${minutes}분 ${remainSeconds}초`;
        return `${remainSeconds}초`;
    }

    function getAdvancedLicenseIdentity(bundle) {
        const payload = bundle?.payload || {};
        return String(
            payload.email
            || payload.loginId
            || payload.desiredLoginId
            || payload.userIdentity
            || payload.licenseId
            || ''
        ).trim();
    }

    async function fetchAdvancedTimeSavedSummary() {
        if (!verifiedAdvancedLicenseBundle) return null;
        try {
            return await postToSecureApi('/advanced/time-saved/summary', {
                licenseBundle: verifiedAdvancedLicenseBundle
            }, '아낀 시간 집계를 불러오지 못했습니다.');
        } catch (error) {
            return { ok: false, errorMessage: error.message };
        }
    }

    function buildAdvancedTimeSavedHtml(summaryPayload) {
        const summary = summaryPayload?.summary || {};
        const events = Array.isArray(summaryPayload?.events) ? summaryPayload.events : [];
        const totalSeconds = Number(summary.totalSeconds || 0);
        const eventRows = events.slice(0, 8).map((event) => `
            <tr>
                <td>${escapeHtml(formatKstDateTime(event.createdAt || Date.now()))}</td>
                <td>${escapeHtml(event.title || '시간 절약')}</td>
                <td>${escapeHtml(formatSavedDuration(event.seconds || 0))}</td>
            </tr>
        `).join('');
        const emptyRow = '<tr><td colspan="3" class="advanced-account-empty">아직 집계된 내역이 없습니다.</td></tr>';
        const identity = getAdvancedLicenseIdentity(verifiedAdvancedLicenseBundle) || getAdvancedWelcomeName(verifiedAdvancedLicenseBundle);
        const expiryText = verifiedAdvancedLicenseBundle && !hasPermanentAdvancedLicense(verifiedAdvancedLicenseBundle)
            ? formatAdvancedLicenseExpiry(verifiedAdvancedLicenseBundle)
            : '영구';
        const fetchNote = summaryPayload?.ok === false
            ? `<div class="advanced-account-note">${escapeHtml(summaryPayload.errorMessage || '아낀 시간 집계를 불러오지 못했습니다.')}</div>`
            : '';
        return `
            <div class="advanced-account-status">
                <div class="advanced-account-grid">
                    <div><span>계정</span><strong>${escapeHtml(identity || '-')}</strong></div>
                    <div><span>사용 만료일</span><strong>${escapeHtml(expiryText)}</strong></div>
                    <div><span>남은 시간</span><strong>${escapeHtml(formatAdvancedRemainingTime(verifiedAdvancedLicenseBundle))}</strong></div>
                    <div><span>누적 아낀 시간</span><strong>${escapeHtml(formatSavedDuration(totalSeconds))}</strong></div>
                </div>
                ${fetchNote}
                <div class="advanced-account-table-title">최근 집계 내역</div>
                <table class="advanced-account-table">
                    <thead><tr><th>시각</th><th>기능</th><th>아낀 시간</th></tr></thead>
                    <tbody>${eventRows || emptyRow}</tbody>
                </table>
            </div>
        `;
    }

    async function openAdvancedSubscriptionStatus() {
        const modalOptions = {
            title: '계정 상태',
            maxWidth: '720px',
            bodyClass: 'advanced-account-status-body'
        };
        if (!verifiedAdvancedLicenseBundle) {
            showAdvancedUserMessageModal('고급 모드 계정 정보를 아직 확인하지 못했습니다.', modalOptions);
            return;
        }
        const summaryPayload = await fetchAdvancedTimeSavedSummary();
        showAdvancedUserMessageModal('', {
            ...modalOptions,
            html: buildAdvancedTimeSavedHtml(summaryPayload)
        });
    }
    if (advancedSaveSessionBtn) {
        advancedSaveSessionBtn.addEventListener('click', () => {
            saveCurrentStudySessionToQueue();
        });
    }
    if (manualDonationMemoCopyBtn) {
        manualDonationMemoCopyBtn.addEventListener('click', copyManualDonationMemo);
    }
    if (manualSubscriptionDonateLink) {
        manualSubscriptionDonateLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (!manualDonationDraft.copied) {
                updateManualDonationFlowState('후원 내용 복사 버튼을 눌러주세요.');
                return;
            }
            const donationUrl = remoteManualSubscriptionConfig.donationUrl || DEFAULT_MANUAL_SUBSCRIPTION_CONFIG.donationUrl;
            manualDonationDraft.donateOpened = true;
            saveManualDonationDraftForReturn(readManualSubscriptionFormFields(), manualDonationDraft);
            updateManualDonationFlowState(MANUAL_DONATION_READY_MESSAGE);
            window.open(donationUrl, '_blank', 'noopener,noreferrer');
        });
    }
    [
        manualSubscriptionPlanSelect,
        manualSubscriptionEmailInput,
        manualSubscriptionStartDateInput,
        manualSubscriptionPasswordInput,
        manualSubscriptionPasswordConfirmInput
    ].filter(Boolean).forEach((input) => {
        input.addEventListener('input', resetManualDonationDraftIfFormChanged);
        input.addEventListener('change', resetManualDonationDraftIfFormChanged);
    });
    restoreManualDonationDraftForReturn();
    updateManualDonationFlowState();
    if (manualSubscriptionLookupBtn) {
        manualSubscriptionLookupBtn.addEventListener('click', lookupManualSubscriptionRequest);
    }
    if (advancedStatusToggle) {
        advancedStatusToggle.addEventListener('click', openAdvancedSubscriptionStatus);
    }
    if (advancedRailCollapseBtn) {
        advancedRailCollapseBtn.addEventListener('click', () => {
            setAdvancedRailCollapsed(true);
        });
    }
    if (advancedRailRestoreBtn) {
        advancedRailRestoreBtn.addEventListener('click', () => {
            setAdvancedRailCollapsed(false);
        });
    }

    const openAdvancedToolsPopup = () => {
        const { width, height, left, top } = buildPopupWindowMetrics(remotePopupLayout.window);
        const popup = window.open(
            ADVANCED_POPUP_PATH,
            'skct_advanced_tools',
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
        );
        if (!popup) {
            alert('브라우저에서 팝업이 차단되어 고급 기능 창을 열 수 없습니다.');
            return;
        }
        popup.focus();
    };

    const settingsTitleTrigger = document.getElementById('settingsTitleTrigger');
    let advancedTapCount = 0;
    let advancedTapTimeout = null;
    if (settingsTitleTrigger) {
        settingsTitleTrigger.addEventListener('click', () => {
            advancedTapCount += 1;
            if (advancedTapTimeout) {
                clearTimeout(advancedTapTimeout);
            }
            advancedTapTimeout = window.setTimeout(() => {
                advancedTapCount = 0;
            }, ADVANCED_TRIGGER_TIMEOUT_MS);
            if (advancedTapCount >= ADVANCED_TRIGGER_TAP_COUNT) {
                advancedTapCount = 0;
                clearTimeout(advancedTapTimeout);
                advancedTapTimeout = null;
                openAdvancedToolsPopup();
            }
        });
    }

    window.SKCTAdvancedBridge = {
        isConfigReady() {
            return isAdvancedConfigReady;
        },
        async validateCredentialsDetailed(loginId, password) {
            return validateAdvancedCredentialsDetailed(loginId, password);
        },
        async validatePasswordDetailed(password) {
            return validateAdvancedCredentialsDetailed(advancedAccessIdInput?.value.trim() || '', password);
        },
        async validatePassword(password) {
            const result = await validateAdvancedCredentialsDetailed(advancedAccessIdInput?.value.trim() || '', password);
            return result.ok;
        },
        async applyLicenseFromRequest(requestId, requestPassword) {
            return hydrateAdvancedLicenseFromRequest(requestId, requestPassword);
        },
        async syncStoredLicense() {
            return syncStoredAdvancedLicenseState({ silent: true });
        },
        activateAdvancedSession() {
            const bundleToApply = pendingAdvancedActivationBundle || verifiedAdvancedLicenseBundle;
            if (bundleToApply) {
                writeStoredAdvancedLicenseBundle(bundleToApply);
                verifiedAdvancedLicenseBundle = bundleToApply;
            }
            pendingAdvancedActivationBundle = null;
            updateAdvancedAccessPanel();
            return {
                targetUrl: buildAdvancedLaunchUrl(),
                popupName: 'skct_popup_mode'
            };
        },
        clearStoredLicense() {
            clearStoredAdvancedLicenseBundle();
            setAdvancedModeState(false);
            removeAdvancedQueryParam();
            updateAdvancedAccessPanel();
            return true;
        },
        getAdvancedSnapshot() {
            return {
                license: verifiedAdvancedLicenseBundle?.payload || null,
                timer: {
                    configuredTotalMinutes: configTotalMins,
                    subjectMinutes: configSubjectMins,
                    breakMinutes: configBreakMins,
                    phaseTotalMinutes: Math.round(getConfiguredPhaseTotalSeconds() / 60),
                    effectiveTotalMinutes: Math.round(getEffectiveConfiguredTotalSeconds() / 60),
                    remainingSeconds: totalSeconds,
                    questionSpentSec,
                    currentPhaseIndex: currentPhaseIdx,
                    currentPhaseName: currentPhaseIdx < phases.length ? phases[currentPhaseIdx].name : '모든 시험 종료',
                    currentPhaseSeconds,
                    isRunning: timerIsRunning
                },
                question: {
                    currentKey: getCurrentQKey(),
                    currentIndex: omrState.currentGlobalIndex,
                    mode: omrState.mode
                }
            };
        },
        downloadDetailedStatsText() {
            downloadDetailedStatsText();
            return true;
        },
        buildDetailedStatsText() {
            return buildDetailedStatsText();
        }
        ,
        downloadStatRoundsCsv() {
            return downloadStatRoundsCsv();
        },
        importStatRoundsCsv(text) {
            return importStatRoundsCsv(text);
        }
    };

    if (advancedAccessSubmitBtn) {
        advancedAccessSubmitBtn.addEventListener('click', async () => {
            const loginIdentifier = advancedAccessIdInput?.value.trim() || '';
            const password = advancedAccessPasswordInput?.value || '';
            if (!isAdvancedConfigReady) {
                if (advancedAccessStatus) {
                    advancedAccessStatus.textContent = readSiteText('messages.advancedNeedConfig', '고급 라이선스 정보를 아직 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
                    advancedAccessStatus.style.color = '#b45309';
                }
                updateAdvancedAccessPanel();
                return;
            }
            if ((!loginIdentifier || !password) && verifiedAdvancedLicenseBundle) {
                if (advancedAccessStatus) {
                    advancedAccessStatus.textContent = readSiteText('messages.advancedOpening', '고급 버전 팝업을 여는 중입니다.');
                    advancedAccessStatus.style.color = '#0f766e';
                }
                await openAdvancedModeWindow();
                return;
            }
            const cooldownRemainingMs = getAdvancedCooldownRemainingMs();
            if (cooldownRemainingMs > 0) {
                if (advancedAccessStatus) {
                    advancedAccessStatus.textContent = readSiteText('messages.advancedRetryAfter', '{seconds}초 후에 다시 시도할 수 있습니다.', {
                        seconds: Math.ceil(cooldownRemainingMs / 1000)
                    });
                    advancedAccessStatus.style.color = '#b91c1c';
                }
                updateAdvancedAccessPanel();
                return;
            }
            if (advancedAccessStatus) {
                advancedAccessStatus.textContent = readSiteText('messages.advancedChecking', '로그인 ID 또는 신청 이메일과 비밀번호를 확인하고 있습니다...');
                advancedAccessStatus.style.color = '#64748b';
            }
            let licenseResult = null;
            try {
                licenseResult = await hydrateAdvancedLicenseFromCredentials(loginIdentifier, password);
            } catch (error) {
                if (advancedAccessStatus) {
                    advancedAccessStatus.textContent = error?.message || readSiteText('messages.advancedLookupError', '고급 계정 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                    advancedAccessStatus.style.color = '#b91c1c';
                }
                return;
            }
            if (!licenseResult.ok) {
                const failState = registerAdvancedPasswordFailure();
                if (advancedAccessStatus) {
                    const nextCooldownRemainingMs = Number.isFinite(failState.lockedUntil)
                        ? Math.max(0, failState.lockedUntil - Date.now())
                        : 0;
                    advancedAccessStatus.textContent = nextCooldownRemainingMs > 0
                        ? `ID 또는 이메일 / 비밀번호 오류가 누적되어 ${Math.ceil(nextCooldownRemainingMs / 1000)}초 동안 다시 시도할 수 없습니다.`
                        : licenseResult.reason === 'pending'
                            ? '아직 승인 전입니다. 승인 메일을 기다려 주세요.'
                            : licenseResult.reason === 'rejected'
                                ? '이 신청은 반려 상태입니다. 처리 메모를 확인해주세요.'
                                : licenseResult.reason === 'invalid_license'
                                    ? '승인된 라이선스를 검증하지 못했습니다. 관리자에게 다시 문의해주세요.'
                                    : licenseResult.reason === 'not_found'
                                        ? '해당 ID 또는 이메일로 조회되는 내역을 찾지 못했습니다.'
                                        : !password
                                            ? '비밀번호를 입력해주세요.'
                                            : !loginIdentifier
                                                ? '신청 이메일을 입력해주세요.'
                                                : 'ID 또는 이메일 / 비밀번호가 일치하지 않습니다.';
                    advancedAccessStatus.style.color = '#b91c1c';
                }
                if (!String(loginIdentifier || '').trim() && advancedAccessIdInput) {
                    advancedAccessIdInput.focus();
                    advancedAccessIdInput.select();
                } else if (advancedAccessPasswordInput) {
                    advancedAccessPasswordInput.focus();
                    advancedAccessPasswordInput.select();
                }
                updateAdvancedAccessPanel();
                return;
            }
            resetAdvancedFailState();
            if (advancedAccessStatus) {
                advancedAccessStatus.textContent = readSiteText('messages.advancedOpening', '고급 버전 팝업을 여는 중입니다.');
                advancedAccessStatus.style.color = '#0f766e';
            }
            await openAdvancedModeWindow();
        });
    }

    if (advancedAccessIdInput) {
        advancedAccessIdInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                advancedAccessSubmitBtn?.click();
            }
        });
    }
    if (advancedAccessPasswordInput) {
        advancedAccessPasswordInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                advancedAccessSubmitBtn?.click();
            }
        });
    }
    updateAdvancedAccessPanel();
    updateUtilityArchiveCardState();
    updateAdvancedModeStatusBar();

    // Modal & Help Controls
    function buildCenteredPopupFeatures(widthRatio = 0.8, heightRatio = 0.8) {
        const width = Math.max(420, Math.round(window.screen.availWidth * widthRatio));
        const height = Math.max(520, Math.round(window.screen.availHeight * heightRatio));
        const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
        const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
        return `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,directories=no,resizable=yes,scrollbars=yes`;
    }

    function openCenteredPopup(url, name, widthRatio = 0.8, heightRatio = 0.8) {
        const popup = window.open(url, name, buildCenteredPopupFeatures(widthRatio, heightRatio));
        if (!popup) {
            window.location.assign(url);
            return null;
        }
        popup.focus();
        return popup;
    }

    const openFrameModal = (modal, frame, url) => {
        if (!modal || !frame) {
            openCenteredPopup(url, 'skct_frame_fallback', 0.8, 0.8);
            return;
        }
        if (url && frame.getAttribute('src') !== url) {
            frame.setAttribute('src', url);
        }
        modal.classList.remove('hidden');
        notifyArchiveFrameImport();
    };

    const openStudyArchivePage = async () => {
        if (!isAdvancedMode) {
            utilityModal?.classList.add('hidden');
            advancedGuideModal?.classList.remove('hidden');
            return;
        }
        if (!latestArchiveFrameUrl || archiveFrame?.getAttribute('src') !== latestArchiveFrameUrl) {
            setAdvancedToolsStatus('기록 보관함을 준비하는 중입니다.');
            latestArchiveFrameUrl = await prewarmStudyArchiveFrame({ force: false });
        }
        setAdvancedToolsStatus('');
        openFrameModal(archiveFrameModal, archiveFrame, latestArchiveFrameUrl);
    };

    const openExtensionInfoPopup = () => {
        const extensionUrl = new URL('extension-info.html', window.location.href);
        extensionUrl.searchParams.set('popup', '1');
        latestExtensionFrameUrl = extensionUrl.toString();
        openFrameModal(extensionFrameModal, extensionFrame, latestExtensionFrameUrl);
    };
    if (archiveFramePopoutBtn) {
        archiveFramePopoutBtn.addEventListener('click', async () => {
            latestArchiveFrameUrl = await prepareArchiveLaunchUrl({ popup: true, force: true });
            if (archiveFrame) archiveFrame.setAttribute('src', latestArchiveFrameUrl);
            openCenteredPopup(latestArchiveFrameUrl, 'skct_study_archive', 0.8, 0.8);
        });
    }
    if (extensionFramePopoutBtn) {
        extensionFramePopoutBtn.addEventListener('click', () => {
            const targetUrl = latestExtensionFrameUrl || (() => {
                const extensionUrl = new URL('extension-info.html', window.location.href);
                extensionUrl.searchParams.set('popup', '1');
                return extensionUrl.toString();
            })();
            openCenteredPopup(targetUrl, 'skct_extension_info', 0.8, 0.8);
        });
    }
    if (utilityToggle && utilityModal) {
        utilityToggle.addEventListener('click', () => {
            updateUtilityArchiveCardState();
            utilityModal.classList.remove('hidden');
        });
    }
    document.querySelectorAll('.close-utility-before-open').forEach((button) => {
        button.addEventListener('click', () => {
            utilityModal?.classList.add('hidden');
        });
    });
    if (studyArchiveOpenBtn) {
        studyArchiveOpenBtn.addEventListener('click', () => {
            utilityModal?.classList.add('hidden');
            openStudyArchivePage();
        });
    }
    if (advancedModeArchiveBtn) {
        advancedModeArchiveBtn.addEventListener('click', () => {
            openStudyArchivePage();
        });
    }
    if (advancedArchiveOpenBtn) {
        advancedArchiveOpenBtn.addEventListener('click', () => {
            openStudyArchivePage();
        });
    }
    if (extensionInfoLink) {
        extensionInfoLink.addEventListener('click', (event) => {
            event.preventDefault();
            openExtensionInfoPopup();
        });
    }
    const openAdvancedFeatureGuide = () => {
        if (!isAdvancedMode) {
            openAdvancedEntryModal();
            return;
        }
        if (advancedToolsStatus) {
            advancedToolsStatus.textContent = '';
            advancedToolsStatus.classList.add('hidden');
        }
        advancedFeatureModal?.classList.remove('hidden');
    };
    if (advancedModeGuideBtn) {
        advancedModeGuideBtn.addEventListener('click', () => {
            openAdvancedFeatureGuide();
        });
    }
    if (advancedCoachGuideBtn) {
        advancedCoachGuideBtn.addEventListener('click', () => {
            openAdvancedFeatureGuide();
        });
    }
    document.getElementById('mockChatBtn')?.addEventListener('click', () => {
        openQuickInfoModal(
            '우측 채팅 버튼',
            '<div class="quick-info-card">실제 SKCT에 있는 버튼이며 SKCT에서는 감독관님과 채팅을 하는 버튼입니다.</div>'
        );
    });
    document.getElementById('mockQuestionBtn')?.addEventListener('click', () => {
        openQuickInfoModal(
            '우측 안내 버튼',
            '<div class="quick-info-card">실제 SKCT에 있는 버튼이며 SKCT 안내사항이 적혀있는 버튼입니다.</div>'
        );
    });

    const helpToggle = document.getElementById('helpToggle');
    const helpModal = document.getElementById('helpModal');
    const helpNoticeFold = document.getElementById('helpNoticeFold');
    const helpNoticeToggleBtn = document.getElementById('helpNoticeToggleBtn');
    const helpNoticeBody = document.getElementById('helpNoticeBody');
    if(helpToggle && helpModal) {
        helpToggle.addEventListener('click', () => helpModal.classList.remove('hidden'));
    }
    if (helpNoticeFold && helpNoticeToggleBtn && helpNoticeBody) {
        helpNoticeToggleBtn.addEventListener('click', () => {
            const isOpen = helpNoticeFold.classList.toggle('is-open');
            helpNoticeBody.classList.toggle('hidden', !isOpen);
            helpNoticeToggleBtn.setAttribute('aria-expanded', String(isOpen));
        });
    }
    if (helpAdvancedLinkBtn) {
        helpAdvancedLinkBtn.addEventListener('click', () => {
            helpModal?.classList.add('hidden');
            openAdvancedFeatureGuide();
        });
    }
    document.querySelectorAll('[data-context-help]').forEach((button) => {
        button.addEventListener('click', () => {
            openContextHelp(button.dataset.contextHelp);
        });
    });

    const donateToggle = document.getElementById('donateToggle');
    const donateModal = document.getElementById('donateModal');
    if (donateToggle && donateModal) {
        donateToggle.addEventListener('click', () => {
            donateModal.classList.remove('hidden');
        });
    }
    const donateConfirmBtn = document.getElementById('donateConfirmBtn');
    if (donateConfirmBtn) {
        donateConfirmBtn.addEventListener('click', () => {
            donateModal.classList.add('hidden');
            const targetUrl = donateConfirmBtn.dataset.href || DEFAULT_SUPPORT_CONFIG.buttonUrl;
            trackAnalyticsEvent('support_click', {
                source: 'donate_modal',
                target_type: 'external_link'
            });
            window.open(targetUrl, '_blank');
        });
    }
    const donateLaterBtn = document.getElementById('donateLaterBtn');
    if (donateLaterBtn) {
        donateLaterBtn.addEventListener('click', () => {
             donateModal.classList.add('hidden');
        });
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                modal.classList.add('hidden');
                if (modal.id === 'statsModal' && typeof window.stopPresencePolling === 'function') {
                    window.stopPresencePolling();
                }
            }
        });
    });

    // Developer Notice System - Firebase 기반 공지 렌더링 함수 (호출은 index.html에서 수행)

    function renderNotice(data) {
        const noticeContainer = document.getElementById('devNotice');
        const noticeFold = document.getElementById('helpNoticeFold');
        if (!noticeContainer) return;
        if (!data || !data.show) {
            noticeContainer.innerHTML = '';
            noticeFold?.classList.add('hidden');
            noticeFold?.classList.remove('is-open');
            const noticeBody = document.getElementById('helpNoticeBody');
            const noticeToggle = document.getElementById('helpNoticeToggleBtn');
            noticeBody?.classList.add('hidden');
            noticeToggle?.setAttribute('aria-expanded', 'false');
            return;
        }
        noticeFold?.classList.remove('hidden');

        const typeColors = {
            info: { bg: '#eff6ff', border: '#3b82f6', icon: '💡' },
            warning: { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️' },
            update: { bg: '#f0fdf4', border: '#22c55e', icon: '🆕' },
            event: { bg: '#fdf4ff', border: '#a855f7', icon: '🎉' }
        };
        const style = typeColors[data.type] || typeColors.info;

        const formattedTitle = formatInlineHtml(data.title || '공지');
        const formattedMessage = formatMultilineHtml(data.message || '');
        const formattedUpdated = escapeHtml(data.updated || '');

        noticeContainer.innerHTML = `
            <div style="background: ${style.bg}; border: 1px solid ${style.border}; border-left: 4px solid ${style.border}; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px;">
                <div style="font-weight: bold; color: #1e293b; margin-bottom: 4px;">${style.icon} ${formattedTitle}</div>
                <div style="color: #475569; line-height: 1.5;">${formattedMessage}</div>
                ${data.updated ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 6px; text-align: right;">📅 ${formattedUpdated}</div>` : ''}
            </div>
        `;
    }
    window.renderNotice = renderNotice;

    const noticeToggle = document.getElementById('noticeToggle');
    const noticeModal = document.getElementById('noticeModal');
    const noticeModalBody = document.getElementById('noticeModalBody');
    const noticeModalUpdated = document.getElementById('noticeModalUpdated');

    function getNoticeTypeStyle(type) {
        const typeColors = {
            info: { bg: '#eff6ff', border: '#3b82f6', icon: '💡', color: '#1d4ed8' },
            warning: { bg: '#fee2e2', border: '#fca5a5', icon: '!', color: '#111827' },
            update: { bg: '#f0fdf4', border: '#22c55e', icon: '🆕', color: '#166534' },
            event: { bg: '#fdf4ff', border: '#a855f7', icon: '🎉', color: '#7e22ce' }
        };
        return typeColors[type] || typeColors.info;
    }

    function renderSidebarNotice(data = {}) {
        if (!noticeToggle || !noticeModalBody || !noticeModalUpdated) return;
        const siteText = window.SKCTSiteTextConfig?.getCurrentConfig?.() || {};
        const modalText = siteText.noticeModal || {};
        const isActiveNotice = data.show === true;
        const normalized = {
            show: true,
            type: isActiveNotice ? 'warning' : 'normal',
            title: isActiveNotice ? (data.title || modalText.title || '운영 상태 공지') : '문제 없음',
            message: isActiveNotice ? (data.message || modalText.emptyBody || '현재 확인 중인 공지가 있습니다.') : '긴급 공지가 없습니다',
            updated: data.updated || ''
        };
        const style = normalized.type === 'normal'
            ? { bg: '#dcfce7', border: '#86efac', icon: '✓', color: '#111827' }
            : { bg: '#fee2e2', border: '#f87171', icon: '!', color: '#111827' };
        noticeToggle.classList.remove('hidden');
        noticeToggle.dataset.noticeType = normalized.type;
        noticeToggle.classList.toggle('notice-active', isActiveNotice);
        noticeToggle.style.setProperty('--shortcut-from', style.bg);
        noticeToggle.style.setProperty('--shortcut-to', style.bg);
        noticeToggle.style.setProperty('--shortcut-accent', style.border);
        noticeToggle.style.setProperty('--shortcut-text', '#111827');
        const iconEl = noticeToggle.querySelector('.notice-shortcut-icon');
        if (iconEl) iconEl.textContent = style.icon;
        noticeModalBody.style.background = style.bg;
        noticeModalBody.style.borderColor = style.border;
        noticeModalBody.style.color = style.color;
        noticeModalBody.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-weight:800; color:#111827;">
                <span style="display:inline-flex; width:18px; height:18px; align-items:center; justify-content:center; border-radius:999px; background:${style.border}; color:#111827; font-size:12px;">${style.icon}</span>
                <span>${formatInlineHtml(normalized.title)}</span>
            </div>
            <div>${formatMultilineHtml(normalized.message)}</div>
        `;
        noticeModalUpdated.textContent = normalized.updated
            ? `${modalText.updatedPrefix || '마지막 업데이트'}: ${normalized.updated}`
            : '';
    }
    window.renderSidebarNotice = renderSidebarNotice;
    if (window.__SKCT_PUBLIC_CONFIG) {
        renderSidebarNotice(window.__SKCT_PUBLIC_CONFIG.notice_sidebar || {});
    } else {
        renderSidebarNotice({});
    }

    if (noticeToggle && noticeModal) {
        noticeToggle.addEventListener('click', () => {
            noticeModal.classList.remove('hidden');
        });
    }

    // (hitscounter.dev 로직이 Firebase total_visits로 대체되어 완전히 제거됨)

    // Clicking the calculator surface should move keyboard focus to the calculator.
    const calcHistoryEl = document.getElementById('calcHistory');
    const focusCalculatorSurface = () => {
        if (!calculatorSectionEl) return;
        if (document.activeElement === notepad) {
            notepad.blur();
        }
        calculatorSectionEl.focus({ preventScroll: true });
    };
    if (calculatorSectionEl) {
        calculatorSectionEl.tabIndex = -1;
        calculatorSectionEl.addEventListener('mousedown', (e) => {
            if (!(e.target instanceof Element)) return;
            if (Date.now() < suppressCalculatorFocusUntil) return;
            if (e.target.closest('.calc-btn, input, textarea')) return;
            requestAnimationFrame(focusCalculatorSurface);
        });
        calculatorSectionEl.addEventListener('click', (e) => {
            if (!(e.target instanceof Element)) return;
            if (Date.now() < suppressCalculatorFocusUntil) return;
            if (e.target.closest('.calc-btn, input, textarea')) return;
            focusCalculatorSurface();
        });
    }
    if (calcHistoryEl) {
        calcHistoryEl.tabIndex = -1;
        calcHistoryEl.addEventListener('mousedown', () => {
            if (Date.now() < suppressCalculatorFocusUntil) return;
            requestAnimationFrame(focusCalculatorSurface);
        });
    }

    /* --- Window Popup Mode Logic --- */
    function launchPopupMode() {
        const popupUrl = window.location.href;
        const { width, height, left, top } = buildPopupWindowMetrics(remotePopupLayout.window);
        const popupParams = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,directories=no`;
        const newWin = window.open(popupUrl, 'skct_popup_mode', popupParams);

        if (!newWin) {
            alert("팝업 창이 차단되었습니다.\n브라우저 주소창의 팝업 차단 해제를 눌러 다시 시도해주세요.");
            return;
        }

        document.body.innerHTML = '<h2 style="padding: 20px; color: #64748b; text-align: center;">팝업 모드로 이동되었습니다.<br><br>이 창은 자동으로 닫히거나 무시하시면 됩니다.</h2>';
        setTimeout(() => { window.close(); }, 100);
    }

    const popupBtn = document.getElementById('popupBtn');
    if (popupBtn) popupBtn.addEventListener('click', launchPopupMode);

    if (isPopupMode) {
        if (popupBtn) popupBtn.style.display = 'none';
    }

});
