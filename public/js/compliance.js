/* Do-Not-Contact list and List Cleaner tabs (Marketing page). Uses escapeHtml/showToast from app.js. */
(function () {
    const $ = (id) => document.getElementById(id);
    let cleanedCsv = '';
    let searchTimer;

    async function api(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
        return body;
    }

    function readFile(input) {
        const file = input?.files?.[0];
        return file ? file.text() : Promise.resolve('');
    }

    // ---------- Do-Not-Contact ----------

    async function loadDoNotContact() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            const params = new URLSearchParams({ limit: '200' });
            if ($('dncChannel')?.value) params.set('channel', $('dncChannel').value);
            if ($('dncSearch')?.value.trim()) params.set('q', $('dncSearch').value.trim());
            try {
                const { items, total } = await api(`/api/suppression?${params}`);
                $('dncSummary').textContent = total === 0
                    ? 'Nobody is on the list yet.'
                    : `${total} contact${total === 1 ? '' : 's'}${total > items.length ? `, showing the newest ${items.length}` : ''}`;
                $('dncTableBody').innerHTML = items.map(item => `
                    <tr>
                        <td style="font-family: monospace;">${escapeHtml(item.channel === 'phone' ? '+' + item.value : item.value)}</td>
                        <td>${item.channel === 'email' ? '📧 Email' : '📱 Phone'}</td>
                        <td>${escapeHtml(item.reason || '')}</td>
                        <td>${escapeHtml(item.source || '')}</td>
                        <td>${escapeHtml(new Date(item.created_at.replace(' ', 'T') + 'Z').toLocaleString())}</td>
                        <td><button class="btn btn-secondary btn-sm" type="button" data-remove="${item.id}">Remove</button></td>
                    </tr>`).join('');
            } catch (error) {
                $('dncSummary').textContent = error.message;
            }
        }, 150);
    }

    async function addDoNotContact() {
        const text = [$('dncInput').value, await readFile($('dncFile'))].filter(Boolean).join('\n');
        if (!text.trim()) {
            showToast('Enter at least one email or phone number', 'error');
            return;
        }
        try {
            const result = await api('/api/suppression', {
                method: 'POST',
                body: JSON.stringify({ text, reason: $('dncReason').value.trim() })
            });
            const parts = [`${result.added} added`];
            if (result.existing) parts.push(`${result.existing} already listed`);
            if (result.invalidCount) parts.push(`${result.invalidCount} not recognized (${result.invalid.slice(0, 3).map(escapeHtml).join(', ')}${result.invalidCount > 3 ? '…' : ''})`);
            $('dncAddResult').innerHTML = parts.join(' · ');
            $('dncInput').value = '';
            $('dncFile').value = '';
            showToast(`${result.added} contact${result.added === 1 ? '' : 's'} added to Do-Not-Contact`, 'success');
            loadDoNotContact();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    document.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-remove]');
        if (!button) return;
        button.disabled = true;
        try {
            await api(`/api/suppression/${button.dataset.remove}`, { method: 'DELETE' });
            showToast('Removed from Do-Not-Contact', 'success');
            loadDoNotContact();
        } catch (error) {
            button.disabled = false;
            showToast(error.message, 'error');
        }
    });

    // ---------- List Cleaner ----------

    async function runListCleaner() {
        const fileText = await readFile($('cleanerFile'));
        if (fileText) $('cleanerInput').value = fileText;
        const text = $('cleanerInput').value;
        if (!text.trim()) {
            showToast('Paste a list or choose a file first', 'error');
            return;
        }
        try {
            const result = await api('/api/tools/clean-list', {
                method: 'POST',
                body: JSON.stringify({
                    text,
                    removeInvalid: $('cleanerInvalid').checked,
                    removeDuplicates: $('cleanerDuplicates').checked,
                    removeSuppressed: $('cleanerSuppressed').checked
                })
            });
            cleanedCsv = result.csv;
            const { stats } = result;
            const tile = (label, value, color) => `
                <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${label}</div>
                    <div style="font-size: 1.4rem; font-weight: 700; ${color ? `color: ${color};` : ''}">${value}</div>
                </div>`;
            $('cleanerStats').innerHTML =
                tile('Input rows', stats.input) +
                tile('Invalid', stats.invalid, stats.invalid ? '#f59e0b' : '') +
                tile('Duplicates', stats.duplicates, stats.duplicates ? '#f59e0b' : '') +
                tile('Do-not-contact', stats.suppressed, stats.suppressed ? '#ef4444' : '') +
                tile('Clean rows', stats.output, '#22c55e');
            const detected = [result.detected.email && `email: “${result.detected.email}”`, result.detected.phone && `phone: “${result.detected.phone}”`].filter(Boolean);
            $('cleanerDetected').textContent = detected.length ? `Columns used: ${detected.join(', ')}` : 'No email or phone column found; only exact duplicate rows were removed.';
            $('cleanerPreviewHead').innerHTML = `<tr>${result.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
            $('cleanerPreviewBody').innerHTML = result.preview
                .map(row => `<tr>${result.columns.map(c => `<td>${escapeHtml(String(row[c] ?? ''))}</td>`).join('')}</tr>`)
                .join('') + (stats.output > result.preview.length ? `<tr><td colspan="${result.columns.length}" style="color: var(--text-muted);">…and ${stats.output - result.preview.length} more rows in the download</td></tr>` : '');
            $('cleanerResult').classList.remove('hidden');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    function downloadCleanedList() {
        if (!cleanedCsv) return;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([cleanedCsv], { type: 'text/csv;charset=utf-8' }));
        link.download = `clean-list-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    // Load the list whenever its tab is opened (also on a direct /marketing/dnc visit).
    const originalSwitch = window.switchMarketingTab;
    if (typeof originalSwitch === 'function') {
        window.switchMarketingTab = function (tabId, ...rest) {
            const result = originalSwitch.call(this, tabId, ...rest);
            if (tabId === 'dnc') loadDoNotContact();
            return result;
        };
    }
    document.addEventListener('DOMContentLoaded', () => {
        if (window.location.pathname.replace(/\/+$/, '') === '/marketing/dnc') loadDoNotContact();
    });

    window.loadDoNotContact = loadDoNotContact;
    window.addDoNotContact = addDoNotContact;
    window.runListCleaner = runListCleaner;
    window.downloadCleanedList = downloadCleanedList;
})();
