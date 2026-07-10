import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithCustomToken,
    createUserWithEmailAndPassword,
    signOut,
    setPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, remove, update, get } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { getFirebaseWebConfig } from "./config/firebase-config.mjs";

const firebaseConfig = getFirebaseWebConfig();
const PUBLIC_BOOTSTRAP_API_URL = 'https://us-central1-skct-tool.cloudfunctions.net/skctSecureApi/public/bootstrap';
const SECURE_API_BASE_URL = 'https://us-central1-skct-tool.cloudfunctions.net/skctSecureApi';
const ADVANCED_LICENSE_STORAGE_KEY = 'skct_advanced_license_bundle';
const ADVANCED_STUDY_SESSION_QUEUE_KEY = 'skct_advanced_study_session_queue';
const ADVANCED_ARCHIVE_LAUNCH_STORAGE_KEY = 'skct_archive_launch';
const ADVANCED_ARCHIVE_LAUNCH_MAX_MS = 10 * 60 * 1000;
const DEFAULT_MANUAL_SUBSCRIPTION_CONFIG = {
    licensePublicKeyPem: ''
};
const STORAGE_TYPES = ['문제+AI 응답', '문제 원문', 'AI 응답', '복기 메모'];
const STORAGE_TYPE_LABELS = {
    '문제+AI 응답': '복기 메모+AI 응답',
    '문제 원문': '개인 복기 메모'
};
const toStorageTypeLabel = (value) => STORAGE_TYPE_LABELS[value] || String(value || '');
const SUBJECT_KEYWORDS = ['언어이해', '자료해석', '창의수리', '언어추리', '수열추리', '실행역량', '복합'];
const WRONG_NOTE_TAGS = ['계산실수', '조건누락', '시간부족', '선지비교실패', '찍음', '개념부족', '문제읽기실수', '다시풀기필요'];
const WRONG_NOTE_STATUS_LABELS = {
    open: '다시 풀기',
    reviewed: '복기함',
    resolved: '해결'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
let remoteManualSubscriptionConfig = DEFAULT_MANUAL_SUBSCRIPTION_CONFIG;
let remoteSiteTextConfig = window.SKCTSiteTextConfig?.normalizeSiteTextConfig?.({}) || {};
let verifiedAdvancedLicenseBundle = null;
let archiveAccessMode = 'blocked';
let archiveAutoToken = '';
let archiveAutoIdentity = '';
let archiveAccessDeniedReason = '';

const archiveUrlParams = new URLSearchParams(window.location.search);
document.body.classList.toggle('archive-popup-mode', archiveUrlParams.get('popup') === '1');

const state = {
    authMode: 'login',
    activeTab: 'sessions',
    items: [],
    sessions: [],
    wrongNotes: [],
    selectedId: '',
    editingId: '',
    tagFilters: new Set(),
    unsubscribe: null,
    unsubscribeSessions: null,
    unsubscribeWrongNotes: null,
    currentUser: null
};

let growthChart = null;

const accessGate = document.getElementById('archiveAccessGate');
const accessGateTitle = document.getElementById('archiveAccessGateTitle');
const accessGateBody = document.getElementById('archiveAccessGateBody');
const accessGateStatus = document.getElementById('archiveAccessGateStatus');
const accessGuideLink = document.getElementById('archiveAccessGuideLink');
const archiveHeroEyebrow = document.getElementById('archiveHeroEyebrow');
const archiveHeroTitle = document.getElementById('archiveHeroTitle');
const archiveHeroCopy = document.getElementById('archiveHeroCopy');
const archiveBackButton = document.getElementById('archiveBackButton');
const archivePopoutButton = document.getElementById('archivePopoutButton');
const authPanel = document.getElementById('archiveAuthPanel');
const workspace = document.getElementById('archiveWorkspace');
const authLoginTab = document.getElementById('authLoginTab');
const authRegisterTab = document.getElementById('authRegisterTab');
const authTitle = document.getElementById('authTitle');
const authDescription = document.getElementById('authDescription');
const authEmailLabel = document.getElementById('authEmailLabel');
const authPasswordLabel = document.getElementById('authPasswordLabel');
const authEmailInput = document.getElementById('authEmailInput');
const authPasswordInput = document.getElementById('authPasswordInput');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authStatus = document.getElementById('authStatus');
const archiveAuthFootnote = document.getElementById('archiveAuthFootnote');
const authLogoutBtn = document.getElementById('authLogoutBtn');
const currentUserBadge = document.getElementById('currentUserBadge');
const archiveLegacyImportBtn = document.getElementById('archiveLegacyImportBtn');
const archiveWorkspaceTitle = document.getElementById('archiveWorkspaceTitle');
const archiveWorkspaceCopy = document.getElementById('archiveWorkspaceCopy');
const archiveTabs = Array.from(document.querySelectorAll('[data-archive-tab]'));
const queuedSessionNotice = document.getElementById('queuedSessionNotice');
const queuedSessionStatus = document.getElementById('queuedSessionStatus');
const sessionCountBadge = document.getElementById('sessionCountBadge');
const sessionList = document.getElementById('sessionList');
const sessionListEmpty = document.getElementById('sessionListEmpty');
const archiveCsvExportBtn = document.getElementById('archiveCsvExportBtn');
const archiveNotionCopyBtn = document.getElementById('archiveNotionCopyBtn');
const archiveExportStatus = document.getElementById('archiveExportStatus');
const growthEmpty = document.getElementById('growthEmpty');
const growthSummary = document.getElementById('growthSummary');
const growthDiagnosis = document.getElementById('growthDiagnosis');
const sectionGrowthGrid = document.getElementById('sectionGrowthGrid');
const wrongTagRatioGrid = document.getElementById('wrongTagRatioGrid');
const growthChartCanvas = document.getElementById('growthChart');
const wrongStatusFilter = document.getElementById('wrongStatusFilter');
const wrongTagFilter = document.getElementById('wrongTagFilter');
const wrongNoteCountBadge = document.getElementById('wrongNoteCountBadge');
const wrongNoteList = document.getElementById('wrongNoteList');
const wrongNoteListEmpty = document.getElementById('wrongNoteListEmpty');
const entryFormTitle = document.getElementById('entryFormTitle');
const entryTitleInput = document.getElementById('entryTitleInput');
const entryOrganizerInput = document.getElementById('entryOrganizerInput');
const entryRoundInput = document.getElementById('entryRoundInput');
const entrySubjectInput = document.getElementById('entrySubjectInput');
const entryStorageTypeSelect = document.getElementById('entryStorageTypeSelect');
const entryProblemFormatInput = document.getElementById('entryProblemFormatInput');
const entryTagsInput = document.getElementById('entryTagsInput');
const entryRawTextInput = document.getElementById('entryRawTextInput');
const entryAiResponseInput = document.getElementById('entryAiResponseInput');
const autoTagPreview = document.getElementById('autoTagPreview');
const entrySaveBtn = document.getElementById('entrySaveBtn');
const entryDeleteBtn = document.getElementById('entryDeleteBtn');
const entryFormStatus = document.getElementById('entryFormStatus');
const entryFormResetBtn = document.getElementById('entryFormResetBtn');
const filterSearchInput = document.getElementById('filterSearchInput');
const filterSubjectSelect = document.getElementById('filterSubjectSelect');
const filterStorageTypeSelect = document.getElementById('filterStorageTypeSelect');
const filterRoundInput = document.getElementById('filterRoundInput');
const tagFilterList = document.getElementById('tagFilterList');
const clearTagFiltersBtn = document.getElementById('clearTagFiltersBtn');
const entryList = document.getElementById('entryList');
const entryListEmpty = document.getElementById('entryListEmpty');
const entryCountBadge = document.getElementById('entryCountBadge');
const detailEmpty = document.getElementById('detailEmpty');
const detailView = document.getElementById('detailView');
const detailTitle = document.getElementById('detailTitle');
const detailMeta = document.getElementById('detailMeta');
const detailTags = document.getElementById('detailTags');
const detailRawText = document.getElementById('detailRawText');
const detailAiResponse = document.getElementById('detailAiResponse');
const detailEditBtn = document.getElementById('detailEditBtn');

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function readSiteText(path, fallback = '', tokens = {}) {
    const api = window.SKCTSiteTextConfig;
    let value = api?.getValueByPath?.(remoteSiteTextConfig, path);
    if ((value == null || value === '') && api?.DEFAULT_SITE_TEXT_CONFIG) {
        value = api.getValueByPath(api.DEFAULT_SITE_TEXT_CONFIG, path);
    }
    const baseText = value == null || value === '' ? fallback : String(value);
    return baseText.replace(/\{([^{}]+)\}/g, (_, token) => (Object.prototype.hasOwnProperty.call(tokens, token) ? String(tokens[token]) : `{${token}}`));
}

function formatConfiguredHtml(value) {
    if (window.SKCTSiteTextConfig?.sanitizeHtml) {
        return window.SKCTSiteTextConfig.sanitizeHtml(value, { multiline: true });
    }
    return String(value ?? '');
}

function setElementText(element, value) {
    if (!element) return;
    element.textContent = value;
}

function setElementHtml(element, value) {
    if (!element) return;
    element.innerHTML = formatConfiguredHtml(value);
}

function applyArchiveStaticText() {
    document.title = readSiteText('archivePage.metaTitle', document.title);
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        metaDescription.setAttribute('content', readSiteText('archivePage.metaDescription', metaDescription.getAttribute('content') || ''));
    }
    setElementText(archiveHeroEyebrow, readSiteText('archivePage.heroEyebrow', 'Advanced Study Library'));
    setElementText(archiveHeroTitle, readSiteText('archivePage.heroTitle', '기록 보관함'));
    setElementHtml(archiveHeroCopy, readSiteText('archivePage.heroCopyHtml', '고급 모드 전용 보관함입니다. 채점한 회차 기록, 성장 그래프, 오답노트, 복기 메모를 계정별로 저장하고 다시 확인할 수 있습니다.'));
    setElementText(archiveBackButton, readSiteText('archivePage.backButton', '메인 연습 도구로 돌아가기'));
    setElementText(accessGateTitle, readSiteText('archivePage.gateTitle', '고급 모드 확인이 먼저 필요합니다'));
    setElementHtml(accessGateBody, readSiteText('archivePage.gateBodyHtml', '이 페이지는 <strong>고급 모드 전용</strong>입니다. 메인 화면의 <strong>고급 안내</strong>에서 승인된 신청 이메일 또는 로그인 ID로 라이선스를 먼저 확인한 뒤 다시 들어와 주세요.'));
    setElementText(accessGuideLink, readSiteText('archivePage.gateButton', '고급 안내로 돌아가기'));
    setElementText(authLoginTab, readSiteText('archivePage.authLoginTab', '로그인'));
    setElementText(authRegisterTab, readSiteText('archivePage.authRegisterTab', '회원가입'));
    setElementText(authEmailLabel, readSiteText('archivePage.authEmailLabel', '이메일'));
    setElementText(authPasswordLabel, readSiteText('archivePage.authPasswordLabel', '비밀번호'));
    if (authEmailInput) authEmailInput.placeholder = readSiteText('archivePage.authEmailPlaceholder', 'example@email.com');
    if (authPasswordInput) authPasswordInput.placeholder = readSiteText('archivePage.authPasswordPlaceholder', '비밀번호 6자 이상');
    setElementHtml(archiveAuthFootnote, readSiteText('archivePage.authFootnoteHtml', '세션은 브라우저를 닫으면 종료됩니다. 일반 모드에서는 이 페이지를 사용할 수 없고, 고급 라이선스 확인 후에만 로그인 화면이 열립니다.'));
    setElementText(archiveWorkspaceTitle, readSiteText('archivePage.workspaceTitle', '저장된 기록'));
    setElementHtml(archiveWorkspaceCopy, readSiteText('archivePage.workspaceCopyHtml', '고급 모드에서 저장한 회차 기록, 성장 그래프, 오답노트가 한곳에 모입니다.'));
    setElementText(authLogoutBtn, readSiteText('archivePage.logoutButton', '로그아웃'));
}

function setStatus(target, message = '', tone = 'muted') {
    if (!target) return;
    target.textContent = message;
    target.style.color = tone === 'error'
        ? '#b91c1c'
        : tone === 'success'
            ? '#0f766e'
            : '#475569';
}

function readJsonStorage(key, fallback) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        return parsed == null ? fallback : parsed;
    } catch (error) {
        return fallback;
    }
}

function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function readValidArchiveLaunchData() {
    const nonce = archiveUrlParams.get('archiveLaunch') || '';
    if (!nonce) return null;
    const launch = (() => {
        try {
            return JSON.parse(sessionStorage.getItem(ADVANCED_ARCHIVE_LAUNCH_STORAGE_KEY) || 'null');
        } catch (error) {
            return null;
        }
    })();
    if (!launch || launch.nonce !== nonce) return null;
    if (Date.now() - (Number(launch.createdAt) || 0) > ADVANCED_ARCHIVE_LAUNCH_MAX_MS) return null;
    return launch;
}

function hasValidArchiveLaunch() {
    return Boolean(readValidArchiveLaunchData());
}

async function postToSecureApi(path, payload) {
    const response = await fetch(`${SECURE_API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
        throw new Error(body?.errorMessage || body?.message || '요청을 처리하지 못했습니다.');
    }
    return body;
}

function safeFirebaseKey(value, fallback = `id_${Date.now().toString(36)}`) {
    const key = String(value || fallback)
        .trim()
        .replace(/[.#$/[\]]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 120);
    return key || fallback;
}

function formatPercent(value) {
    const num = Number(value);
    return Number.isFinite(num) ? `${Math.round(num * 10) / 10}%` : '-';
}

function formatDuration(ms) {
    const value = Number(ms) || 0;
    if (value <= 0) return '0초';
    const sec = Math.round(value / 1000);
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return min > 0 ? `${min}분 ${rest}초` : `${rest}초`;
}

function readQueuedStudySessions() {
    const queue = readJsonStorage(ADVANCED_STUDY_SESSION_QUEUE_KEY, []);
    return Array.isArray(queue) ? queue.filter(Boolean) : [];
}

function writeQueuedStudySessions(queue) {
    writeJsonStorage(ADVANCED_STUDY_SESSION_QUEUE_KEY, Array.isArray(queue) ? queue : []);
}

function normalizeWrongStatus(value) {
    return Object.prototype.hasOwnProperty.call(WRONG_NOTE_STATUS_LABELS, value) ? value : 'open';
}

function normalizeWrongTag(value) {
    const tag = String(value || '').trim();
    return WRONG_NOTE_TAGS.includes(tag) ? tag : '다시풀기필요';
}

function normalizeManualSubscriptionConfig(raw) {
    return {
        licensePublicKeyPem: String(raw?.licensePublicKeyPem || '').trim()
    };
}

function readStoredAdvancedLicenseBundle() {
    try {
        return JSON.parse(localStorage.getItem(ADVANCED_LICENSE_STORAGE_KEY) || 'null');
    } catch (error) {
        return null;
    }
}

function clearArchiveSubscription() {
    if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
    }
    if (state.unsubscribeSessions) {
        state.unsubscribeSessions();
        state.unsubscribeSessions = null;
    }
    if (state.unsubscribeWrongNotes) {
        state.unsubscribeWrongNotes();
        state.unsubscribeWrongNotes = null;
    }
}

function resetArchiveDataState() {
    state.items = [];
    state.sessions = [];
    state.wrongNotes = [];
    state.selectedId = '';
    state.editingId = '';
    state.tagFilters.clear();
    clearArchiveSubscription();
    renderSessions();
    renderGrowth();
    renderWrongNotes();
    renderFilterOptions();
    renderTagFilters();
    renderEntryList();
    renderDetail();
    resetForm();
}

async function verifyAdvancedLicenseBundle(bundle, options = {}) {
    const { allowExpired = false } = options;
    if (!bundle || !remoteManualSubscriptionConfig.licensePublicKeyPem || !window.SKCTSubscriptionCrypto?.verifyLicenseBundle) {
        return null;
    }
    try {
        const verified = await window.SKCTSubscriptionCrypto.verifyLicenseBundle(bundle, remoteManualSubscriptionConfig.licensePublicKeyPem);
        if (!verified) return null;
        const payloadStatus = String(bundle?.payload?.status || '').trim().toLowerCase();
        if (payloadStatus && payloadStatus !== 'active') {
            if (allowExpired && payloadStatus === 'expired') return { bundle, expired: true };
            return null;
        }
        const expiryTime = Date.parse(bundle?.payload?.expiresAt || '');
        if (Number.isFinite(expiryTime) && expiryTime < Date.now()) {
            return allowExpired ? { bundle, expired: true } : null;
        }
        return { bundle, expired: false };
    } catch (error) {
        return null;
    }
}

async function loadArchiveRemoteConfig() {
    try {
        const response = await fetch(PUBLIC_BOOTSTRAP_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ countVisit: false })
        });
        if (!response.ok) throw new Error('bootstrap failed');
        const payload = await response.json();
        const config = payload?.config || {};
        remoteManualSubscriptionConfig = normalizeManualSubscriptionConfig(config.manualSubscriptionConfig || {});
        if (window.SKCTSiteTextConfig?.normalizeSiteTextConfig) {
            remoteSiteTextConfig = window.SKCTSiteTextConfig.normalizeSiteTextConfig(config.siteTextConfig || {});
        }
    } catch (error) {
        remoteManualSubscriptionConfig = normalizeManualSubscriptionConfig({});
    }
    applyArchiveStaticText();
}

async function hydrateArchiveAdvancedAccess() {
    setStatus(accessGateStatus, readSiteText('messages.archiveAccessChecking', '이 브라우저의 고급 라이선스를 확인하는 중입니다.'));
    const launchData = readValidArchiveLaunchData();
    if (!launchData) {
        verifiedAdvancedLicenseBundle = null;
        archiveAccessMode = 'blocked';
        archiveAccessDeniedReason = '기록 보관함은 고급 모드 창에서 열었을 때만 접속할 수 있습니다.';
        setStatus(accessGateStatus, archiveAccessDeniedReason, 'error');
        return;
    }
    const storedBundle = readStoredAdvancedLicenseBundle();
    const verification = await verifyAdvancedLicenseBundle(storedBundle, { allowExpired: true });
    verifiedAdvancedLicenseBundle = verification?.bundle || null;
    archiveAccessMode = verification?.expired ? 'expired' : (verification?.bundle ? 'active' : 'blocked');
    archiveAccessDeniedReason = '';
    if (!verifiedAdvancedLicenseBundle && storedBundle) {
        localStorage.removeItem(ADVANCED_LICENSE_STORAGE_KEY);
    }
    if (verifiedAdvancedLicenseBundle) {
        try {
            let tokenResult = launchData.customToken
                ? {
                    customToken: launchData.customToken,
                    identity: launchData.identity || '',
                    readonly: launchData.readonly === true,
                    uid: launchData.uid || ''
                }
                : await postToSecureApi('/advanced/archive-token', {
                    licenseBundle: verifiedAdvancedLicenseBundle
                });
            archiveAutoToken = tokenResult.customToken || '';
            archiveAutoIdentity = tokenResult.identity || '';
            if (tokenResult.readonly) archiveAccessMode = 'expired';
            if (archiveAutoToken) {
                let credential = null;
                try {
                    credential = await signInWithCustomToken(auth, archiveAutoToken);
                } catch (tokenError) {
                    if (!launchData.customToken) throw tokenError;
                    tokenResult = await postToSecureApi('/advanced/archive-token', {
                        licenseBundle: verifiedAdvancedLicenseBundle
                    });
                    archiveAutoToken = tokenResult.customToken || '';
                    archiveAutoIdentity = tokenResult.identity || '';
                    if (tokenResult.readonly) archiveAccessMode = 'expired';
                    credential = await signInWithCustomToken(auth, archiveAutoToken);
                }
                state.currentUser = credential.user || auth.currentUser || null;
                setStatus(authStatus, tokenResult.readonly ? '이용권이 만료되어 읽기/내보내기 전용으로 열었습니다.' : '고급 계정으로 자동 로그인되었습니다.', tokenResult.readonly ? 'error' : 'success');
            }
        } catch (error) {
            archiveAutoToken = '';
            setStatus(authStatus, `자동 로그인에 실패했습니다. 아래에서 다시 로그인해 주세요. (${error?.code || error?.message || 'unknown'})`, 'error');
        }
    }
}

function syncArchiveAccessView() {
    const hasAdvancedAccess = Boolean(verifiedAdvancedLicenseBundle);
    const hasUser = Boolean(state.currentUser);
    const isExpiredAccess = archiveAccessMode === 'expired';
    accessGate?.classList.toggle('hidden', hasAdvancedAccess);
    authPanel?.classList.toggle('hidden', !hasAdvancedAccess || hasUser);
    workspace?.classList.toggle('hidden', !hasAdvancedAccess || !hasUser);
    document.body.classList.toggle('archive-readonly-mode', isExpiredAccess);

    if (!hasAdvancedAccess) {
        setStatus(accessGateStatus, archiveAccessDeniedReason || readSiteText('messages.archiveAccessDenied', '기록 보관함은 고급 모드 전용입니다. 메인 화면의 고급 안내에서 승인된 신청 이메일 또는 로그인 ID로 고급 모드를 먼저 열어주세요.'), 'error');
        resetArchiveDataState();
        return;
    }

    setStatus(accessGateStatus, '');
    if (!hasUser) {
        clearArchiveSubscription();
        archiveLegacyImportBtn?.classList.add('hidden');
        currentUserBadge.textContent = readSiteText('messages.archiveGuestLabel', '로그인이 필요합니다.');
        state.items = [];
        state.selectedId = '';
        state.tagFilters.clear();
        renderFilterOptions();
        renderTagFilters();
        renderEntryList();
        renderDetail();
        return;
    }

    const displayIdentity = archiveAutoIdentity || state.currentUser.email || readSiteText('messages.archiveGuestLabel', '로그인이 필요합니다.');
    currentUserBadge.textContent = `${displayIdentity} · ${isExpiredAccess ? '만료 이용권 · 읽기/내보내기 전용' : readSiteText('messages.archiveSessionSuffix', '세션 로그인')}`;
    archiveLegacyImportBtn?.classList.toggle('hidden', !archiveAutoToken || isExpiredAccess);
    if (isExpiredAccess) {
        setStatus(entryFormStatus, '이용권이 만료되어 새 저장과 수정은 막혀 있습니다. 기존 기록은 확인하고 내보낼 수 있습니다.', 'error');
    }
}

function switchArchiveTab(tab) {
    state.activeTab = tab || 'sessions';
    archiveTabs.forEach((button) => {
        button.classList.toggle('active', button.dataset.archiveTab === state.activeTab);
    });
    ['sessions', 'growth', 'wrongNotes', 'materials'].forEach((name) => {
        const panel = document.getElementById(`${name}TabPanel`);
        panel?.classList.toggle('hidden', name !== state.activeTab);
    });
    if (state.activeTab === 'growth') renderGrowth();
}

function getUserSessionsPath(uid = state.currentUser?.uid) {
    return `userStudyLibrary/${uid}/examSessions`;
}

function getUserWrongNotesPath(uid = state.currentUser?.uid) {
    return `userStudyLibrary/${uid}/wrongNotes`;
}

function normalizeSessionRecord(record) {
    const createdAt = Number(record?.createdAt) || Date.now();
    const clientId = safeFirebaseKey(record?.clientId || record?.id || `session_${createdAt}`);
    const total = record?.total || {};
    const meta = record?.meta && typeof record.meta === 'object' ? record.meta : {};
    return {
        schemaVersion: 1,
        ...record,
        clientId,
        createdAt,
        updatedAt: Date.now(),
        title: String(record?.title || `SKCT 연습 ${new Date(createdAt).toLocaleDateString('ko-KR')}`).slice(0, 80),
        meta: {
            practicedAt: String(meta.practicedAt || '').slice(0, 40),
            material: String(meta.material || '').slice(0, 40),
            roundLabel: String(meta.roundLabel || '').slice(0, 40)
        },
        total: {
            correct: Number(total.correct) || 0,
            attempted: Number(total.attempted) || 0,
            skipped: Number(total.skipped) || 0,
            unanswered: Number(total.unanswered) || 0,
            accuracyAttempted: Number(total.accuracyAttempted) || 0,
            accuracyOverall: Number(total.accuracyOverall) || 0
        },
        sections: Array.isArray(record?.sections) ? record.sections.slice(0, 20) : [],
        items: Array.isArray(record?.items) ? record.items.slice(0, 500) : []
    };
}

function formatSessionMeta(session) {
    const meta = session?.meta || {};
    const parts = [
        meta.material,
        meta.roundLabel,
        meta.practicedAt ? String(meta.practicedAt).replace('T', ' ') : ''
    ].map((item) => String(item || '').trim()).filter(Boolean);
    return parts.join(' · ');
}

function buildWrongNoteRecord(note, sessionId, sessionCreatedAt) {
    const createdAt = Number(note?.createdAt) || sessionCreatedAt || Date.now();
    return {
        schemaVersion: 1,
        sessionId,
        no: Number(note?.no) || 0,
        section: String(note?.section || '').slice(0, 40),
        sectionId: String(note?.sectionId || '').slice(0, 40),
        userAnswer: String(note?.userAnswer ?? '').slice(0, 20),
        correctAnswer: String(note?.correctAnswer ?? '').slice(0, 20),
        elapsedMs: Math.max(0, Number(note?.elapsedMs) || 0),
        reasonTag: normalizeWrongTag(note?.reasonTag),
        memo: String(note?.memo || '').slice(0, 400),
        status: normalizeWrongStatus(note?.status),
        createdAt,
        updatedAt: Date.now()
    };
}

async function importQueuedStudySessions() {
    if (!state.currentUser) return;
    if (archiveAccessMode === 'expired') {
        queuedSessionNotice?.classList.add('hidden');
        setStatus(queuedSessionStatus, '');
        return;
    }
    const queue = readQueuedStudySessions();
    queuedSessionNotice?.classList.toggle('hidden', queue.length === 0);
    if (!queue.length) {
        setStatus(queuedSessionStatus, '');
        return;
    }

    setStatus(queuedSessionStatus, `${queue.length}개 기록을 저장하는 중입니다...`);
    const failed = [];
    let savedCount = 0;
    for (const rawRecord of queue) {
        try {
            const session = normalizeSessionRecord(rawRecord);
            const sessionId = safeFirebaseKey(session.clientId);
            await set(ref(db, `${getUserSessionsPath()}/${sessionId}`), session);
            const notes = Array.isArray(rawRecord?.wrongNotes) ? rawRecord.wrongNotes : [];
            await Promise.all(notes.slice(0, 300).map((note) => {
                const noteRecord = buildWrongNoteRecord(note, sessionId, session.createdAt);
                const noteId = safeFirebaseKey(`${sessionId}_${noteRecord.no}_${noteRecord.sectionId || noteRecord.section}`);
                return set(ref(db, `${getUserWrongNotesPath()}/${noteId}`), noteRecord);
            }));
            savedCount += 1;
        } catch (error) {
            failed.push(rawRecord);
        }
    }
    writeQueuedStudySessions(failed);
    queuedSessionNotice?.classList.toggle('hidden', failed.length === 0);
    if (failed.length) {
        setStatus(queuedSessionStatus, `${savedCount}개 저장, ${failed.length}개는 다시 시도합니다.`, 'error');
    } else {
        setStatus(queuedSessionStatus, `${savedCount}개 기록이 서버에 저장되었습니다.`, 'success');
    }
}

function renderSessions() {
    const sessions = [...state.sessions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (sessionCountBadge) sessionCountBadge.textContent = `${sessions.length}회`;
    sessionListEmpty?.classList.toggle('hidden', sessions.length > 0);
    if (!sessionList) return;
    sessionList.innerHTML = sessions.map((session) => {
        const total = session.total || {};
        const sections = Array.isArray(session.sections) ? session.sections : [];
        const metaText = formatSessionMeta(session);
        const sectionHtml = sections.slice(0, 6).map((section) => `
            <span class="session-section-chip">${escapeHtml(section.name || '-')} ${formatPercent(section.accuracyOverall)}</span>
        `).join('');
        return `
            <article class="session-card">
                <div class="session-card-head">
                    <div>
                        <h4>${escapeHtml(session.title || 'SKCT 연습 기록')}</h4>
                        <p>${escapeHtml(formatDateTime(session.createdAt))}${metaText ? ` · ${escapeHtml(metaText)}` : ''}</p>
                    </div>
                    <div class="session-score">${formatPercent(total.accuracyOverall)}</div>
                </div>
                <div class="session-metrics">
                    <span>정답 ${escapeHtml(total.correct || 0)}</span>
                    <span>응답 ${escapeHtml(total.attempted || 0)}</span>
                    <span>건너뜀 ${escapeHtml(total.skipped || 0)}</span>
                    <span>미응답 ${escapeHtml(total.unanswered || 0)}</span>
                    <span>응답 기준 ${formatPercent(total.accuracyAttempted)}</span>
                </div>
                <div class="session-section-list">${sectionHtml || '<span class="session-section-chip muted">영역 기록 없음</span>'}</div>
            </article>
        `;
    }).join('');
}

function buildGrowthRows() {
    return [...state.sessions]
        .filter((session) => session?.total)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .map((session, index) => {
            const items = Array.isArray(session.items) ? session.items : [];
            const elapsedValues = items.map((item) => Number(item.elapsedMs) || 0).filter((ms) => ms > 0);
            const avgElapsed = elapsedValues.length
                ? Math.round(elapsedValues.reduce((sum, ms) => sum + ms, 0) / elapsedValues.length)
                : 0;
            return {
                label: `${index + 1}회`,
                date: new Date(session.createdAt || Date.now()).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
                overall: Number(session.total.accuracyOverall) || 0,
                attempted: Number(session.total.accuracyAttempted) || 0,
                avgElapsed,
                skipped: Number(session.total.skipped) || 0,
                unanswered: Number(session.total.unanswered) || 0
            };
        });
}

function renderGrowth() {
    const rows = buildGrowthRows();
    growthEmpty?.classList.toggle('hidden', rows.length > 0);
    if (growthSummary) {
        const latest = rows[rows.length - 1];
        growthSummary.innerHTML = latest ? `
            <div class="growth-stat"><strong>${formatPercent(latest.overall)}</strong><span>최근 전체 정답률</span></div>
            <div class="growth-stat"><strong>${formatPercent(latest.attempted)}</strong><span>최근 응답 기준</span></div>
            <div class="growth-stat"><strong>${formatDuration(latest.avgElapsed)}</strong><span>평균 문항 시간</span></div>
            <div class="growth-stat"><strong>${latest.skipped + latest.unanswered}</strong><span>건너뜀·미응답</span></div>
        ` : '';
    }
    renderGrowthDiagnosis(rows);
    if (growthChartCanvas && window.Chart) {
        if (growthChart) growthChart.destroy();
        if (rows.length) {
            growthChart = new window.Chart(growthChartCanvas, {
                type: 'line',
                data: {
                    labels: rows.map((row) => `${row.label} ${row.date}`),
                    datasets: [
                        {
                            label: '전체 정답률',
                            data: rows.map((row) => row.overall),
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.12)',
                            tension: 0.32
                        },
                        {
                            label: '응답 기준 정답률',
                            data: rows.map((row) => row.attempted),
                            borderColor: '#ea580c',
                            backgroundColor: 'rgba(234, 88, 12, 0.12)',
                            tension: 0.32
                        },
                        {
                            label: '건너뜀',
                            data: rows.map((row) => row.skipped),
                            borderColor: '#64748b',
                            backgroundColor: 'rgba(100, 116, 139, 0.12)',
                            borderDash: [5, 4],
                            yAxisID: 'count',
                            tension: 0.32
                        },
                        {
                            label: '미응답',
                            data: rows.map((row) => row.unanswered),
                            borderColor: '#0f766e',
                            backgroundColor: 'rgba(15, 118, 110, 0.12)',
                            borderDash: [2, 4],
                            yAxisID: 'count',
                            tension: 0.32
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                        y: { min: 0, max: 100, ticks: { callback: (value) => `${value}%` } },
                        count: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { precision: 0 } }
                    }
                }
            });
        }
    }
    renderSectionGrowth();
    renderWrongTagRatios();
}

function renderGrowthDiagnosis(rows) {
    if (!growthDiagnosis) return;
    const latest = rows[rows.length - 1];
    if (!latest) {
        growthDiagnosis.innerHTML = '';
        return;
    }
    const previous = rows[rows.length - 2];
    const latestSession = [...state.sessions]
        .filter((session) => session?.total)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .at(-1);
    const trend = previous ? Math.round((latest.overall - previous.overall) * 10) / 10 : null;
    const sections = Array.isArray(latestSession?.sections) ? latestSession.sections : [];
    const weakest = [...sections].sort((a, b) => (Number(a.accuracyOverall) || 0) - (Number(b.accuracyOverall) || 0))[0];
    const items = Array.isArray(latestSession?.items) ? latestSession.items : [];
    const elapsed = items.map((item) => Number(item.elapsedMs) || 0).filter((value) => value > 0);
    const avg = elapsed.length ? elapsed.reduce((sum, value) => sum + value, 0) / elapsed.length : 0;
    const slowCount = avg ? elapsed.filter((value) => value >= avg * 1.35).length : 0;
    const tagCounts = new Map();
    state.wrongNotes.forEach((note) => {
        const tag = normalizeWrongTag(note.reasonTag);
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
    const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const pressureCount = latest.skipped + latest.unanswered;
    const trendText = trend == null
        ? '다음 회차부터 변화 폭을 보여드립니다.'
        : trend === 0
            ? '직전 회차와 같은 정답률입니다.'
            : `직전 회차보다 ${Math.abs(trend)}%p ${trend > 0 ? '올랐습니다' : '낮아졌습니다'}.`;
    const focusText = weakest
        ? `${weakest.name || weakest.id || '취약 영역'} ${formatPercent(weakest.accuracyOverall)}부터 다시 보세요.`
        : '영역별 기록이 쌓이면 가장 낮은 영역을 알려드립니다.';
    const timeText = slowCount
        ? `평균보다 오래 걸린 문항이 ${slowCount}개입니다.`
        : pressureCount
            ? `건너뜀·미응답 ${pressureCount}개를 먼저 확인하세요.`
            : '두드러진 시간 지연 문항이 없습니다.';
    const reasonText = topTag
        ? `${topTag[0]} 태그가 ${topTag[1]}건으로 가장 많습니다.`
        : '오답 이유를 태그하면 반복되는 원인을 보여드립니다.';
    growthDiagnosis.innerHTML = `
        <article><span>이번 변화</span><strong>${escapeHtml(trendText)}</strong></article>
        <article><span>다음 집중 영역</span><strong>${escapeHtml(focusText)}</strong></article>
        <article><span>시간 사용</span><strong>${escapeHtml(timeText)}</strong></article>
        <article><span>반복 오답 원인</span><strong>${escapeHtml(reasonText)}</strong></article>
    `;
}

function renderSectionGrowth() {
    if (!sectionGrowthGrid) return;
    const sectionMap = new Map();
    state.sessions.forEach((session) => {
        (session.sections || []).forEach((section) => {
            const name = section.name || section.id || '영역';
            if (!sectionMap.has(name)) sectionMap.set(name, []);
            sectionMap.get(name).push(Number(section.accuracyOverall) || 0);
        });
    });
    const cards = Array.from(sectionMap.entries()).map(([name, values]) => {
        const latest = values[values.length - 1] || 0;
        const first = values[0] || 0;
        const diff = Math.round((latest - first) * 10) / 10;
        return `<div class="section-growth-card"><strong>${escapeHtml(name)}</strong><span>${formatPercent(latest)}</span><small>${diff >= 0 ? '+' : ''}${diff}%</small></div>`;
    });
    sectionGrowthGrid.innerHTML = cards.length ? cards.join('') : '<div class="empty-state">영역별 기록이 아직 없습니다.</div>';
}

function renderWrongTagRatios() {
    if (!wrongTagRatioGrid) return;
    const counts = new Map();
    state.wrongNotes.forEach((note) => {
        const tag = normalizeWrongTag(note.reasonTag);
        counts.set(tag, (counts.get(tag) || 0) + 1);
    });
    const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
    if (!total) {
        wrongTagRatioGrid.innerHTML = '<div class="empty-state">오답 태그가 쌓이면 어떤 유형이 많은지 여기서 바로 볼 수 있습니다.</div>';
        return;
    }
    const cards = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([tag, count]) => {
            const ratio = Math.round((count / total) * 1000) / 10;
            return `<div class="section-growth-card wrong-tag-ratio-card"><strong>${escapeHtml(tag)}</strong><span>${formatPercent(ratio)}</span><small>${count}건</small></div>`;
        });
    wrongTagRatioGrid.innerHTML = `<div class="growth-section-title">오답 태그 비율</div>${cards.join('')}`;
}

function getFilteredWrongNotes() {
    const status = wrongStatusFilter?.value || '';
    const tag = wrongTagFilter?.value || '';
    return state.wrongNotes
        .filter((note) => !status || normalizeWrongStatus(note.status) === status)
        .filter((note) => !tag || normalizeWrongTag(note.reasonTag) === tag)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function renderWrongTagFilter() {
    if (!wrongTagFilter) return;
    const current = wrongTagFilter.value;
    const tags = Array.from(new Set([...WRONG_NOTE_TAGS, ...state.wrongNotes.map((note) => normalizeWrongTag(note.reasonTag))]));
    wrongTagFilter.innerHTML = '<option value="">전체</option>' + tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
    if (current && tags.includes(current)) wrongTagFilter.value = current;
}

function renderWrongNotes() {
    renderWrongTagFilter();
    const notes = getFilteredWrongNotes();
    if (wrongNoteCountBadge) wrongNoteCountBadge.textContent = `${notes.length}건`;
    wrongNoteListEmpty?.classList.toggle('hidden', notes.length > 0);
    if (!wrongNoteList) return;
    wrongNoteList.innerHTML = notes.map((note) => `
        <article class="wrong-note-card" data-wrong-id="${escapeHtml(note.id)}">
            <div class="wrong-note-head">
                <div>
                    <strong>${escapeHtml(note.section || '영역 미지정')} ${escapeHtml(note.no || '-')}번</strong>
                    <span>${escapeHtml(formatDateTime(note.createdAt))}</span>
                </div>
                <select data-wrong-field="status">
                    ${Object.entries(WRONG_NOTE_STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${normalizeWrongStatus(note.status) === value ? 'selected' : ''}>${label}</option>`).join('')}
                </select>
            </div>
            <div class="wrong-note-meta">
                <span>내 답 ${escapeHtml(note.userAnswer || '-')}</span>
                <span>정답 ${escapeHtml(note.correctAnswer || '-')}</span>
                <span>${escapeHtml(formatDuration(note.elapsedMs))}</span>
            </div>
            <div class="wrong-note-edit-row">
                <select data-wrong-field="reasonTag">
                    ${WRONG_NOTE_TAGS.map((tag) => `<option value="${escapeHtml(tag)}" ${normalizeWrongTag(note.reasonTag) === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}
                </select>
                <input type="text" data-wrong-field="memo" value="${escapeHtml(note.memo || '')}" placeholder="복기 메모">
                <button type="button" data-wrong-action="save">저장</button>
            </div>
        </article>
    `).join('');
    wrongNoteList.querySelectorAll('[data-wrong-action="save"]').forEach((button) => {
        button.addEventListener('click', async () => {
            const card = button.closest('[data-wrong-id]');
            const id = card?.dataset.wrongId;
            if (!id || !state.currentUser) return;
            const payload = {
                status: normalizeWrongStatus(card.querySelector('[data-wrong-field="status"]')?.value),
                reasonTag: normalizeWrongTag(card.querySelector('[data-wrong-field="reasonTag"]')?.value),
                memo: String(card.querySelector('[data-wrong-field="memo"]')?.value || '').slice(0, 400),
                updatedAt: Date.now()
            };
            button.disabled = true;
            try {
                await update(ref(db, `${getUserWrongNotesPath()}/${id}`), payload);
            } finally {
                button.disabled = false;
            }
        });
    });
}

function csvCell(value) {
    const text = String(value ?? '').replace(/\r?\n/g, ' ');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(cells) {
    return cells.map(csvCell).join(',');
}

function markdownCell(value) {
    return String(value ?? '')
        .replace(/\r?\n/g, ' ')
        .replace(/\|/g, '/')
        .trim();
}

function buildArchiveRows() {
    const sessions = [...state.sessions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const wrongNotes = getFilteredWrongNotes();
    return { sessions, wrongNotes };
}

function getSessionAverageElapsed(session) {
    const items = Array.isArray(session?.items) ? session.items : [];
    const elapsedValues = items.map((item) => Number(item.elapsedMs) || 0).filter((ms) => ms > 0);
    return elapsedValues.length
        ? Math.round(elapsedValues.reduce((sum, ms) => sum + ms, 0) / elapsedValues.length)
        : 0;
}

function buildArchiveCsv() {
    const { sessions, wrongNotes } = buildArchiveRows();
    const lines = [
        '회차 기록',
        csvRow(['날짜', '풀이일시', '교재/자료', '회차', '제목', '전체 정답률', '응답 기준 정답률', '정답', '응답', '건너뜀', '미응답', '평균 문항 시간', '영역 요약'])
    ];
    sessions.forEach((session) => {
        const total = session.total || {};
        const sectionSummary = (session.sections || [])
            .map((section) => `${section.name || section.id || '영역'} ${formatPercent(section.accuracyOverall)}`)
            .join(' / ');
        lines.push(csvRow([
            formatDateTime(session.createdAt),
            session.meta?.practicedAt || '',
            session.meta?.material || '',
            session.meta?.roundLabel || '',
            session.title || 'SKCT 연습 기록',
            formatPercent(total.accuracyOverall),
            formatPercent(total.accuracyAttempted),
            total.correct || 0,
            total.attempted || 0,
            total.skipped || 0,
            total.unanswered || 0,
            formatDuration(getSessionAverageElapsed(session)),
            sectionSummary
        ]));
    });
    lines.push('', '오답노트', csvRow(['날짜', '영역', '문항', '내 답', '정답', '소요 시간', '상태', '태그', '메모']));
    wrongNotes.forEach((note) => {
        lines.push(csvRow([
            formatDateTime(note.createdAt),
            note.section || '',
            note.no || '',
            note.userAnswer || '',
            note.correctAnswer || '',
            formatDuration(note.elapsedMs),
            WRONG_NOTE_STATUS_LABELS[normalizeWrongStatus(note.status)] || '',
            normalizeWrongTag(note.reasonTag),
            note.memo || ''
        ]));
    });
    return lines.join('\n');
}

function buildArchiveMarkdown() {
    const { sessions, wrongNotes } = buildArchiveRows();
    const sessionRows = sessions.map((session) => {
        const total = session.total || {};
        return `| ${markdownCell(formatDateTime(session.createdAt))} | ${markdownCell(session.meta?.material || '-')} | ${markdownCell(session.meta?.roundLabel || '-')} | ${markdownCell(session.title || 'SKCT 연습 기록')} | ${markdownCell(formatPercent(total.accuracyOverall))} | ${markdownCell(formatPercent(total.accuracyAttempted))} | ${markdownCell(total.correct || 0)} | ${markdownCell(total.skipped || 0)} | ${markdownCell(total.unanswered || 0)} |`;
    });
    const wrongRows = wrongNotes.map((note) => `| ${markdownCell(formatDateTime(note.createdAt))} | ${markdownCell(note.section || '')} | ${markdownCell(note.no || '')} | ${markdownCell(note.userAnswer || '')} | ${markdownCell(note.correctAnswer || '')} | ${markdownCell(WRONG_NOTE_STATUS_LABELS[normalizeWrongStatus(note.status)] || '')} | ${markdownCell(normalizeWrongTag(note.reasonTag))} | ${markdownCell(note.memo || '')} |`);
    return [
        '# SKCT 기록 보관함',
        '',
        '## 회차 기록',
        '| 날짜 | 교재/자료 | 회차 | 제목 | 전체 정답률 | 응답 기준 | 정답 | 건너뜀 | 미응답 |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        sessionRows.join('\n') || '| - | - | - | 저장된 회차 기록 없음 | - | - | - | - | - |',
        '',
        '## 오답노트',
        '| 날짜 | 영역 | 문항 | 내 답 | 정답 | 상태 | 태그 | 메모 |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
        wrongRows.join('\n') || '| - | 저장된 오답 없음 | - | - | - | - | - | - |'
    ].join('\n');
}

function hasExportableArchiveData() {
    return state.sessions.length > 0 || state.wrongNotes.length > 0;
}

function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob(['\uFEFF' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
}

function exportArchiveCsv() {
    if (!hasExportableArchiveData()) {
        setStatus(archiveExportStatus, '내보낼 기록이 아직 없습니다.', 'error');
        return;
    }
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadTextFile(`skct-study-archive-${stamp}.csv`, buildArchiveCsv(), 'text/csv;charset=utf-8');
    setStatus(archiveExportStatus, '엑셀에서 열 수 있는 CSV 파일로 저장했습니다.', 'success');
}

async function copyArchiveNotionTable() {
    if (!hasExportableArchiveData()) {
        setStatus(archiveExportStatus, '복사할 기록이 아직 없습니다.', 'error');
        return;
    }
    try {
        await copyTextToClipboard(buildArchiveMarkdown());
        setStatus(archiveExportStatus, '노션에 붙여넣기 좋은 표 형식으로 복사했습니다.', 'success');
    } catch (error) {
        setStatus(archiveExportStatus, '복사에 실패했습니다. 브라우저 권한을 확인해주세요.', 'error');
    }
}

function formatDateTime(value) {
    if (!Number.isFinite(value)) return '-';
    return new Date(value).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function normalizeTagText(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function detectRound(text) {
    const match = String(text || '').match(/(\d{1,3})\s*회(?:차)?/);
    return match ? `${match[1]}회차` : '';
}

function detectDifficulty(text) {
    const source = String(text || '');
    if (/최상|매우 어려움|상/.test(source)) return '상';
    if (/하|쉬움|쉬운/.test(source)) return '하';
    if (/중/.test(source)) return '중';
    return '';
}

function detectSubject(text) {
    return SUBJECT_KEYWORDS.find((keyword) => String(text || '').includes(keyword)) || '';
}

function detectQuestionCount(text) {
    const matches = Array.from(String(text || '').matchAll(/(?:^|\n)\s*(\d{1,3})[\.\)]/g)).map((match) => Number(match[1]));
    if (!matches.length) return 0;
    return new Set(matches).size;
}

function buildAutoTags(values) {
    const source = `${values.title}\n${values.organizer}\n${values.roundLabel}\n${values.subject}\n${values.problemFormat}\n${values.rawText}\n${values.aiResponse}`;
    const tags = new Set();

    if (values.storageType) tags.add(toStorageTypeLabel(values.storageType));
    if (values.organizer) tags.add(values.organizer);
    if (values.subject) tags.add(values.subject);
    if (values.roundLabel) tags.add(values.roundLabel);
    if (values.problemFormat) tags.add(values.problemFormat);

    const detectedSubject = detectSubject(source);
    if (detectedSubject) tags.add(detectedSubject);

    const detectedRound = detectRound(source);
    if (detectedRound) tags.add(detectedRound);

    const difficulty = detectDifficulty(source);
    if (difficulty) tags.add(`난이도-${difficulty}`);

    const questionCount = detectQuestionCount(values.rawText);
    if (questionCount > 0) tags.add(`문항-${questionCount}`);

    return {
        autoTags: Array.from(tags),
        detectedDifficulty: difficulty,
        questionCount
    };
}

function collectFormValues() {
    return {
        title: entryTitleInput.value.trim(),
        organizer: entryOrganizerInput.value.trim(),
        roundLabel: entryRoundInput.value.trim(),
        subject: entrySubjectInput.value.trim(),
        storageType: entryStorageTypeSelect.value,
        problemFormat: entryProblemFormatInput.value.trim(),
        manualTags: normalizeTagText(entryTagsInput.value),
        rawText: entryRawTextInput.value.trim(),
        aiResponse: entryAiResponseInput.value.trim()
    };
}

function resetForm() {
    state.editingId = '';
    entryFormTitle.textContent = '새 자료 저장';
    entryTitleInput.value = '';
    entryOrganizerInput.value = '';
    entryRoundInput.value = '';
    entrySubjectInput.value = '';
    entryStorageTypeSelect.value = STORAGE_TYPES[0];
    entryProblemFormatInput.value = '';
    entryTagsInput.value = '';
    entryRawTextInput.value = '';
    entryAiResponseInput.value = '';
    entryDeleteBtn.classList.add('hidden');
    renderAutoTagPreview();
    setStatus(entryFormStatus, '');
}

function renderAutoTagPreview() {
    const values = collectFormValues();
    const { autoTags, detectedDifficulty, questionCount } = buildAutoTags(values);
    const chips = [...new Set([...values.manualTags, ...autoTags])];
    if (!chips.length) {
        autoTagPreview.innerHTML = '<span class="tag-chip muted">아직 자동 태그가 없습니다.</span>';
        return;
    }
    const extraInfo = [];
    if (detectedDifficulty) extraInfo.push(`난이도 ${detectedDifficulty}`);
    if (questionCount > 0) extraInfo.push(`문항 수 ${questionCount}`);
    autoTagPreview.innerHTML = chips.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('') +
        (extraInfo.length ? ` <span class="tag-chip">${escapeHtml(extraInfo.join(' · '))}</span>` : '');
}

function buildEntryPayload() {
    const values = collectFormValues();
    if (!values.title) throw new Error('자료 제목을 입력해주세요.');
    if (!values.rawText && !values.aiResponse) throw new Error('복기 메모 또는 AI 응답 중 하나는 입력해주세요.');

    const { autoTags, detectedDifficulty, questionCount } = buildAutoTags(values);
    const mergedTags = Array.from(new Set([...values.manualTags, ...autoTags]));
    const now = Date.now();
    const current = state.items.find((item) => item.id === state.editingId);

    return {
        ...values,
        autoTags,
        mergedTags,
        detectedDifficulty,
        questionCount,
        summary: (values.rawText || values.aiResponse).slice(0, 200),
        ownerEmail: state.currentUser?.email || '',
        createdAt: current?.createdAt || now,
        updatedAt: now
    };
}

function getUserItemsPath(uid = state.currentUser?.uid) {
    return `userStudyLibrary/${uid}/items`;
}

function describeAuthError(error, mode) {
    const code = String(error?.code || '');
    if (code === 'auth/invalid-credential') return readSiteText('messages.archiveAuthInvalidCredential', '이메일 또는 비밀번호를 다시 확인해주세요.');
    if (code === 'auth/email-already-in-use') return readSiteText('messages.archiveAuthEmailInUse', '이미 사용 중인 이메일입니다. 로그인으로 전환하거나 다른 이메일을 사용해주세요.');
    if (code === 'auth/weak-password') return readSiteText('messages.archiveAuthWeakPassword', '비밀번호는 6자 이상으로 설정해주세요.');
    if (code === 'auth/operation-not-allowed') return readSiteText('messages.archiveAuthOperationNotAllowed', '현재 Firebase에서 이메일/비밀번호 가입이 비활성화되어 있습니다. 관리자 설정을 확인해주세요.');
    if (mode === 'register') return readSiteText('messages.archiveAuthRegisterError', '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    return readSiteText('messages.archiveAuthLoginError', '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
}

function setAuthMode(mode) {
    state.authMode = mode;
    document.querySelectorAll('[data-auth-mode]').forEach((button) => {
        button.classList.toggle('active', button.dataset.authMode === mode);
    });
    authTitle.textContent = mode === 'register'
        ? readSiteText('archivePage.authRegisterTitle', '보관함 계정 만들기')
        : readSiteText('archivePage.authLoginTitle', '기록 보관함 로그인');
    authDescription.innerHTML = formatConfiguredHtml(
        mode === 'register'
            ? readSiteText('archivePage.authRegisterDescription', '처음이라면 이메일/비밀번호 계정을 만들고, 같은 계정으로만 내 자료를 읽고 수정할 수 있습니다.')
            : readSiteText('archivePage.authLoginDescription', '고급 모드가 확인된 뒤에는 자료보관함 전용 계정으로 로그인해야 자기 자료를 읽고 수정할 수 있습니다.')
    );
    authSubmitBtn.textContent = mode === 'register'
        ? readSiteText('archivePage.authRegisterButton', '회원가입 후 시작')
        : readSiteText('archivePage.authLoginButton', '로그인');
    authPasswordInput.setAttribute('autocomplete', mode === 'register' ? 'new-password' : 'current-password');
    setStatus(authStatus, '');
}

async function handleAuthSubmit() {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    if (!email || !password) {
        setStatus(authStatus, readSiteText('messages.archiveAuthRequired', '이메일과 비밀번호를 모두 입력해주세요.'), 'error');
        return;
    }
    authSubmitBtn.disabled = true;
    setStatus(
        authStatus,
        state.authMode === 'register'
            ? readSiteText('messages.archiveAuthRegistering', '계정을 만드는 중입니다...')
            : readSiteText('messages.archiveAuthLoggingIn', '로그인하는 중입니다...')
    );
    try {
        if (state.authMode === 'register') {
            await createUserWithEmailAndPassword(auth, email, password);
            setStatus(authStatus, readSiteText('messages.archiveAuthRegisterSuccess', '계정을 만들고 로그인했습니다. 이제 자료를 저장할 수 있습니다.'), 'success');
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            setStatus(authStatus, readSiteText('messages.archiveAuthLoginSuccess', '로그인했습니다.'), 'success');
        }
        authPasswordInput.value = '';
    } catch (error) {
        setStatus(authStatus, describeAuthError(error, state.authMode), 'error');
    } finally {
        authSubmitBtn.disabled = false;
    }
}

function getFilteredItems() {
    const search = filterSearchInput.value.trim().toLowerCase();
    const subject = filterSubjectSelect.value;
    const storageType = filterStorageTypeSelect.value;
    const roundKeyword = filterRoundInput.value.trim().toLowerCase();

    return state.items.filter((item) => {
        const haystack = `${item.title} ${item.organizer} ${item.roundLabel} ${item.subject} ${item.problemFormat} ${item.rawText} ${item.aiResponse} ${item.mergedTags?.join(' ') || ''}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        const matchesSubject = !subject || item.subject === subject;
        const matchesStorageType = !storageType || item.storageType === storageType;
        const matchesRound = !roundKeyword || String(item.roundLabel || '').toLowerCase().includes(roundKeyword);
        const matchesTags = !state.tagFilters.size || Array.from(state.tagFilters).every((tag) => item.mergedTags?.includes(tag));
        return matchesSearch && matchesSubject && matchesStorageType && matchesRound && matchesTags;
    });
}

function renderFilterOptions() {
    const subjectSet = new Set(SUBJECT_KEYWORDS);
    const storageTypeSet = new Set(STORAGE_TYPES);
    state.items.forEach((item) => {
        if (item.subject) subjectSet.add(item.subject);
        if (item.storageType) storageTypeSet.add(item.storageType);
    });

    const currentSubject = filterSubjectSelect.value;
    filterSubjectSelect.innerHTML = `<option value="">전체</option>${Array.from(subjectSet).filter(Boolean).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
    if (currentSubject && Array.from(filterSubjectSelect.options).some((option) => option.value === currentSubject)) {
        filterSubjectSelect.value = currentSubject;
    }

    const currentStorageType = filterStorageTypeSelect.value;
    filterStorageTypeSelect.innerHTML = `<option value="">전체</option>${Array.from(storageTypeSet).filter(Boolean).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(toStorageTypeLabel(value))}</option>`).join('')}`;
    if (currentStorageType && Array.from(filterStorageTypeSelect.options).some((option) => option.value === currentStorageType)) {
        filterStorageTypeSelect.value = currentStorageType;
    }
}

function renderTagFilters() {
    const tags = Array.from(new Set(state.items.flatMap((item) => item.mergedTags || []))).sort((a, b) => a.localeCompare(b, 'ko'));
    const validTagSet = new Set(tags);
    Array.from(state.tagFilters).forEach((tag) => {
        if (!validTagSet.has(tag)) {
            state.tagFilters.delete(tag);
        }
    });
    if (!tags.length) {
        tagFilterList.innerHTML = '<span class="tag-chip muted">태그가 생기면 여기에 체크 필터가 표시됩니다.</span>';
        return;
    }
    tagFilterList.innerHTML = tags.map((tag) => `
        <label class="tag-filter-pill">
            <input type="checkbox" value="${escapeHtml(tag)}" ${state.tagFilters.has(tag) ? 'checked' : ''}>
            <span>${escapeHtml(toStorageTypeLabel(tag))}</span>
        </label>
    `).join('');
    tagFilterList.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.addEventListener('change', () => {
            if (input.checked) {
                state.tagFilters.add(input.value);
            } else {
                state.tagFilters.delete(input.value);
            }
            renderEntryList();
        });
    });
}

function renderEntryList() {
    const filtered = getFilteredItems();
    if (!filtered.some((item) => item.id === state.selectedId)) {
        state.selectedId = filtered[0]?.id || '';
    }
    entryCountBadge.textContent = `${filtered.length}건`;
    entryListEmpty.classList.toggle('hidden', filtered.length > 0);
    entryList.innerHTML = filtered.map((item) => `
        <article class="entry-card ${item.id === state.selectedId ? 'active' : ''}" data-entry-id="${escapeHtml(item.id)}">
            <div class="entry-card-top">
                <div>
                    <h4 class="entry-card-title">${escapeHtml(item.title || '제목 없음')}</h4>
                    <div class="entry-card-meta">${escapeHtml(item.subject || '과목 미지정')} · ${escapeHtml(item.roundLabel || '회차 미지정')} · ${escapeHtml(toStorageTypeLabel(item.storageType) || '-')}</div>
                </div>
                <div class="entry-card-meta">${escapeHtml(formatDateTime(item.updatedAt))}</div>
            </div>
            <div class="tag-chip-wrap">
                ${(item.mergedTags || []).slice(0, 5).map((tag) => `<span class="tag-chip">${escapeHtml(toStorageTypeLabel(tag))}</span>`).join('')}
            </div>
            <p class="entry-card-summary">${escapeHtml(item.summary || '')}</p>
        </article>
    `).join('');

    entryList.querySelectorAll('[data-entry-id]').forEach((card) => {
        card.addEventListener('click', () => {
            state.selectedId = card.dataset.entryId;
            renderEntryList();
            renderDetail();
        });
    });
    renderDetail();
}

function renderDetail() {
    const item = state.items.find((entry) => entry.id === state.selectedId);
    detailEmpty.classList.toggle('hidden', Boolean(item));
    detailView.classList.toggle('hidden', !item);
    if (!item) return;

    detailTitle.textContent = item.title || '제목 없음';
    detailMeta.textContent = `${item.organizer || '주관사 미지정'} · ${item.subject || '과목 미지정'} · ${item.roundLabel || '회차 미지정'} · ${toStorageTypeLabel(item.storageType) || '-'} · 수정 ${formatDateTime(item.updatedAt)}`;
    detailTags.innerHTML = (item.mergedTags || []).length
        ? (item.mergedTags || []).map((tag) => `<span class="tag-chip">${escapeHtml(toStorageTypeLabel(tag))}</span>`).join('')
        : '<span class="tag-chip muted">태그 없음</span>';
    detailRawText.textContent = item.rawText || '저장된 개인 복기 메모가 없습니다.';
    detailAiResponse.textContent = item.aiResponse || '저장된 AI 응답이 없습니다.';
}

function populateFormFromItem(itemId) {
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) return;
    state.editingId = item.id;
    state.selectedId = item.id;
    entryFormTitle.textContent = '선택 자료 수정';
    entryTitleInput.value = item.title || '';
    entryOrganizerInput.value = item.organizer || '';
    entryRoundInput.value = item.roundLabel || '';
    entrySubjectInput.value = item.subject || '';
    entryStorageTypeSelect.value = item.storageType || STORAGE_TYPES[0];
    entryProblemFormatInput.value = item.problemFormat || '';
    entryTagsInput.value = (item.manualTags || []).join(', ');
    entryRawTextInput.value = item.rawText || '';
    entryAiResponseInput.value = item.aiResponse || '';
    entryDeleteBtn.classList.remove('hidden');
    renderAutoTagPreview();
    renderEntryList();
    setStatus(entryFormStatus, '선택 자료를 폼으로 불러왔습니다. 수정 후 다시 저장하세요.');
    entryTitleInput.focus();
}

async function saveEntry() {
    if (!state.currentUser) {
        setStatus(entryFormStatus, '먼저 로그인해주세요.', 'error');
        return;
    }
    if (archiveAccessMode === 'expired') {
        setStatus(entryFormStatus, '이용권이 만료되어 새 저장과 수정은 할 수 없습니다. 기존 기록은 내보낼 수 있습니다.', 'error');
        return;
    }
    entrySaveBtn.disabled = true;
    setStatus(entryFormStatus, '자료를 저장하는 중입니다...');
    try {
        const payload = buildEntryPayload();
        const basePath = getUserItemsPath();
        const entryId = state.editingId || push(ref(db, basePath)).key;
        await set(ref(db, `${basePath}/${entryId}`), payload);
        state.selectedId = entryId;
        state.editingId = entryId;
        entryDeleteBtn.classList.remove('hidden');
        setStatus(entryFormStatus, '자료를 저장했습니다.', 'success');
    } catch (error) {
        setStatus(entryFormStatus, error.message || '자료 저장 중 오류가 발생했습니다.', 'error');
    } finally {
        entrySaveBtn.disabled = false;
    }
}

async function deleteEditingEntry() {
    if (!state.currentUser || !state.editingId) return;
    if (archiveAccessMode === 'expired') {
        setStatus(entryFormStatus, '이용권이 만료되어 삭제는 할 수 없습니다. 기존 기록은 내보낼 수 있습니다.', 'error');
        return;
    }
    const confirmed = window.confirm('현재 선택한 자료를 삭제할까요? 이 작업은 되돌릴 수 없습니다.');
    if (!confirmed) return;
    entryDeleteBtn.disabled = true;
    setStatus(entryFormStatus, '자료를 삭제하는 중입니다...');
    try {
        await remove(ref(db, `${getUserItemsPath()}/${state.editingId}`));
        setStatus(entryFormStatus, '자료를 삭제했습니다.', 'success');
        resetForm();
    } catch (error) {
        setStatus(entryFormStatus, error.message || '자료 삭제 중 오류가 발생했습니다.', 'error');
    } finally {
        entryDeleteBtn.disabled = false;
    }
}

function subscribeUserItems(uid) {
    if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
    }
    state.unsubscribe = onValue(ref(db, getUserItemsPath(uid)), (snapshot) => {
        const nextItems = [];
        snapshot.forEach((child) => {
            nextItems.push({ id: child.key, ...child.val() });
        });
        nextItems.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        state.items = nextItems;
        renderFilterOptions();
        renderTagFilters();
        renderEntryList();
    });
}

function subscribeUserSessions(uid) {
    if (state.unsubscribeSessions) {
        state.unsubscribeSessions();
        state.unsubscribeSessions = null;
    }
    state.unsubscribeSessions = onValue(ref(db, getUserSessionsPath(uid)), (snapshot) => {
        const sessions = [];
        snapshot.forEach((child) => {
            sessions.push({ id: child.key, ...child.val() });
        });
        state.sessions = sessions;
        renderSessions();
        renderGrowth();
    });
}

function subscribeUserWrongNotes(uid) {
    if (state.unsubscribeWrongNotes) {
        state.unsubscribeWrongNotes();
        state.unsubscribeWrongNotes = null;
    }
    state.unsubscribeWrongNotes = onValue(ref(db, getUserWrongNotesPath(uid)), (snapshot) => {
        const notes = [];
        snapshot.forEach((child) => {
            notes.push({ id: child.key, ...child.val() });
        });
        state.wrongNotes = notes;
        renderWrongNotes();
        if (state.activeTab === 'growth') renderGrowth();
    });
}

async function handleLogout() {
    await signOut(auth);
}

async function importLegacyArchiveAccount() {
    if (!archiveAutoToken || !state.currentUser) {
        setStatus(archiveExportStatus, '고급 자동 로그인 상태에서만 기존 계정을 가져올 수 있습니다.', 'error');
        return;
    }
    const legacyEmail = window.prompt('기존 보관함 계정 이메일을 입력해 주세요.');
    if (!legacyEmail) return;
    const legacyPassword = window.prompt('기존 보관함 계정 비밀번호를 입력해 주세요.');
    if (!legacyPassword) return;

    const targetUid = state.currentUser.uid;
    setStatus(archiveExportStatus, '기존 계정 데이터를 확인하는 중입니다...');
    try {
        const legacyCredential = await signInWithEmailAndPassword(auth, legacyEmail.trim(), legacyPassword);
        const legacyUid = legacyCredential.user.uid;
        if (legacyUid === targetUid) {
            await signInWithCustomToken(auth, archiveAutoToken);
            setStatus(archiveExportStatus, '이미 같은 보관함 계정입니다.', 'success');
            return;
        }
        const legacySnap = await get(ref(db, `userStudyLibrary/${legacyUid}`));
        const legacyData = legacySnap.val() || {};
        await signInWithCustomToken(auth, archiveAutoToken);
        const targetSnap = await get(ref(db, `userStudyLibrary/${targetUid}`));
        const targetData = targetSnap.val() || {};
        const updates = {};
        let copied = 0;
        ['items', 'examSessions', 'wrongNotes'].forEach((bucket) => {
            Object.entries(legacyData[bucket] || {}).forEach(([id, value]) => {
                if (!targetData[bucket] || !Object.prototype.hasOwnProperty.call(targetData[bucket], id)) {
                    updates[`userStudyLibrary/${targetUid}/${bucket}/${id}`] = value;
                    copied += 1;
                }
            });
        });
        if (!copied) {
            setStatus(archiveExportStatus, '새로 가져올 기존 기록이 없습니다.', 'success');
            return;
        }
        await update(ref(db), updates);
        setStatus(archiveExportStatus, `기존 보관함에서 ${copied}개 기록을 가져왔습니다.`, 'success');
    } catch (error) {
        try {
            if (archiveAutoToken) await signInWithCustomToken(auth, archiveAutoToken);
        } catch (restoreError) {
            // 복구 실패 시 onAuthStateChanged가 로그인 패널을 표시한다.
        }
        setStatus(archiveExportStatus, error?.message || '기존 계정 가져오기에 실패했습니다.', 'error');
    }
}

function openArchiveAsSeparateWindow() {
    const nonce = archiveUrlParams.get('archiveLaunch') || '';
    if (nonce) {
        try {
            const existing = readValidArchiveLaunchData() || {};
            sessionStorage.setItem(ADVANCED_ARCHIVE_LAUNCH_STORAGE_KEY, JSON.stringify({
                ...existing,
                nonce,
                createdAt: Date.now()
            }));
        } catch (error) {
            // noop
        }
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('popup');
    const popup = window.open(url.toString(), 'skct_study_archive_full', 'menubar=yes,toolbar=yes,location=yes,status=yes,resizable=yes,scrollbars=yes');
    if (popup) popup.focus();
}

async function init() {
    await setPersistence(auth, browserSessionPersistence);
    await loadArchiveRemoteConfig();
    setAuthMode('login');
    await hydrateArchiveAdvancedAccess();

    document.querySelectorAll('[data-auth-mode]').forEach((button) => {
        button.addEventListener('click', () => setAuthMode(button.dataset.authMode));
    });

    authSubmitBtn.addEventListener('click', handleAuthSubmit);
    authPasswordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAuthSubmit();
        }
    });
    authLogoutBtn.addEventListener('click', handleLogout);
    archiveLegacyImportBtn?.addEventListener('click', importLegacyArchiveAccount);
    archivePopoutButton?.addEventListener('click', openArchiveAsSeparateWindow);

    [entryTitleInput, entryOrganizerInput, entryRoundInput, entrySubjectInput, entryProblemFormatInput, entryTagsInput, entryRawTextInput, entryAiResponseInput].forEach((element) => {
        element.addEventListener('input', renderAutoTagPreview);
    });
    entryStorageTypeSelect.addEventListener('change', renderAutoTagPreview);
    entrySaveBtn.addEventListener('click', saveEntry);
    entryDeleteBtn.addEventListener('click', deleteEditingEntry);
    entryFormResetBtn.addEventListener('click', resetForm);
    detailEditBtn.addEventListener('click', () => populateFormFromItem(state.selectedId));
    archiveTabs.forEach((button) => {
        button.addEventListener('click', () => switchArchiveTab(button.dataset.archiveTab));
    });
    [wrongStatusFilter, wrongTagFilter].filter(Boolean).forEach((element) => {
        element.addEventListener('change', renderWrongNotes);
    });
    archiveCsvExportBtn?.addEventListener('click', exportArchiveCsv);
    archiveNotionCopyBtn?.addEventListener('click', copyArchiveNotionTable);
    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data && typeof event.data === 'object' ? event.data : null;
        if (data?.type === 'skct:archive-import-queue') {
            void importQueuedStudySessions();
        }
    });

    [filterSearchInput, filterSubjectSelect, filterStorageTypeSelect, filterRoundInput].forEach((element) => {
        element.addEventListener('input', renderEntryList);
        element.addEventListener('change', renderEntryList);
    });
    clearTagFiltersBtn.addEventListener('click', () => {
        state.tagFilters.clear();
        renderTagFilters();
        renderEntryList();
    });

    renderFilterOptions();
    renderAutoTagPreview();
    switchArchiveTab('sessions');
    syncArchiveAccessView();

    onAuthStateChanged(auth, (user) => {
        state.currentUser = user;
        if (!user) {
            resetArchiveDataState();
            currentUserBadge.textContent = readSiteText('messages.archiveGuestLabel', '로그인이 필요합니다.');
            syncArchiveAccessView();
            return;
        }
        if (verifiedAdvancedLicenseBundle) {
            subscribeUserItems(user.uid);
            subscribeUserSessions(user.uid);
            subscribeUserWrongNotes(user.uid);
            resetForm();
            void importQueuedStudySessions();
        } else {
            clearArchiveSubscription();
        }
        syncArchiveAccessView();
    });
}

void init();
