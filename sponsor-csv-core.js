(function () {
    const SUBSCRIPTION_PRIVATE_MESSAGE = 'SKCT 고급 구독 후원 내역이므로 나머지 내용은 비공개 처리 하였습니다. 고급 구독해주셔서 감사드립니다. 개발자 올림.';
    const GENERAL_DONATION_FALLBACK = '운영을 응원해 주셔서 감사합니다.';

    function parseCsvRows(csvText) {
        const rows = [];
        let row = [];
        let cell = '';
        let quoted = false;
        const text = String(csvText || '').replace(/^\uFEFF/, '');
        for (let i = 0; i < text.length; i += 1) {
            const char = text[i];
            const next = text[i + 1];
            if (char === '"') {
                if (quoted && next === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    quoted = !quoted;
                }
            } else if (char === ',' && !quoted) {
                row.push(cell.trim());
                cell = '';
            } else if ((char === '\n' || char === '\r') && !quoted) {
                if (char === '\r' && next === '\n') i += 1;
                row.push(cell.trim());
                if (row.some(Boolean)) rows.push(row);
                row = [];
                cell = '';
            } else {
                cell += char;
            }
        }
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        return rows;
    }

    function findColumn(headers, candidates, fallback) {
        const index = headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
        return index >= 0 ? index : fallback;
    }

    function maskName(rawName) {
        const name = String(rawName || '').trim();
        if (name.length === 2) return `${name[0]}*`;
        if (name.length > 2) return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`;
        return name || '익명';
    }

    function isSubscriptionDonationMessage(message) {
        const text = String(message || '');
        const hasRequestId = /\bREQ-[A-Z0-9]+-[A-Z0-9]+\b/i.test(text);
        const hasExplicitLegacyRequest = /(?:고급\s*(?:복기팩|모드|구독)|\d+일\s*이용권).{0,24}(?:신청|구독|결제|후원)/i.test(text);
        return hasRequestId || hasExplicitLegacyRequest;
    }

    function sanitizePublicDonationMessage(message) {
        const sanitized = String(message || '')
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[이메일 비공개]')
            .replace(/\bREQ-[A-Z0-9]+-[A-Z0-9]+\b/gi, '[신청번호 비공개]')
            .replace(/(?:https?:\/\/|www\.)\S+/gi, '[링크 비공개]')
            .replace(/(?<!\d)(?:01[016789])[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g, '[연락처 비공개]')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 240);
        return sanitized || GENERAL_DONATION_FALLBACK;
    }

    function parseToonationCSV(csvText) {
        const rows = parseCsvRows(csvText);
        if (rows.length < 2) return [];
        const headers = rows[0].map((value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ''));
        const dateIndex = findColumn(headers, ['일시', '날짜', '시간', 'date'], 0);
        const nameIndex = findColumn(headers, ['닉네임', '후원자', '이름', 'name'], 2);
        const amountIndex = findColumn(headers, ['금액', '캐시', 'amount'], 3);
        const messageIndex = findColumn(headers, ['메시지', '내용', 'message', 'comment'], 4);
        return rows.slice(1).map((parts) => {
            const date = String(parts[dateIndex] || '').trim().split(' ')[0];
            const rawMessage = String(parts[messageIndex] || '').trim();
            const subscription = isSubscriptionDonationMessage(rawMessage);
            const amount = parseInt(String(parts[amountIndex] || '').replace(/[^0-9]/g, ''), 10) || 0;
            return {
                date,
                account: '',
                name: maskName(parts[nameIndex]),
                amount: `${amount.toLocaleString('ko-KR')}원`,
                message: subscription ? SUBSCRIPTION_PRIVATE_MESSAGE : sanitizePublicDonationMessage(rawMessage),
                type: subscription ? 'subscription' : 'general'
            };
        }).filter((item) => item.date || item.name || item.amount !== '0원');
    }

    const api = { parseCsvRows, parseToonationCSV, isSubscriptionDonationMessage, sanitizePublicDonationMessage, SUBSCRIPTION_PRIVATE_MESSAGE };
    if (typeof window !== 'undefined') window.SKCTSponsorCsv = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
