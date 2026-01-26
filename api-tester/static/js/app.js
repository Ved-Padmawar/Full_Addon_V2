// Global state
let endpointsConfig = {};
let currentToken = null;
let currentResponse = null;
let currentTab = 'raw';

// Load endpoints configuration on page load
async function loadEndpointsConfig() {
    try {
        const response = await axios.get('/api/endpoints');
        endpointsConfig = response.data;
        populateEndpointDropdown();
    } catch (error) {
        console.error('Error loading endpoints config:', error);
    }
}

// Populate endpoint dropdown with actual endpoints
function populateEndpointDropdown() {
    const select = document.getElementById('endpointSelect');
    select.innerHTML = '<option value="">Select endpoint...</option>';

    Object.keys(endpointsConfig).forEach(key => {
        const config = endpointsConfig[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `GET /v1/${config.api_name}`;
        select.appendChild(option);
    });
}

// Update endpoint configuration when endpoint changes
function onEndpointChange() {
    const endpoint = document.getElementById('endpointSelect').value;
    if (!endpoint) {
        disablePagination();
        disableTimePeriod();
        return;
    }

    const config = endpointsConfig[endpoint];
    if (!config) return;

    // Update pagination
    if (config.supports_pagination) {
        enablePagination();
    } else {
        disablePagination();
    }

    // Update time period
    if (config.supports_time_period) {
        enableTimePeriod(config.default_period);
    } else {
        disableTimePeriod();
    }
}

function enablePagination() {
    const toggle = document.getElementById('paginationToggle');
    const pageInput = document.getElementById('pageNo');
    const sizeInput = document.getElementById('pageSize');

    toggle.checked = true;
    toggle.disabled = false;
    pageInput.disabled = false;
    sizeInput.disabled = false;
    pageInput.parentElement.parentElement.classList.remove('opacity-50', 'pointer-events-none');
}

function disablePagination() {
    const toggle = document.getElementById('paginationToggle');
    const pageInput = document.getElementById('pageNo');
    const sizeInput = document.getElementById('pageSize');

    toggle.checked = false;
    toggle.disabled = true;
    pageInput.disabled = true;
    sizeInput.disabled = true;
    pageInput.parentElement.parentElement.classList.add('opacity-50', 'pointer-events-none');
}

function enableTimePeriod(defaultPeriod) {
    const toggle = document.getElementById('timePeriodToggle');
    const input = document.getElementById('periodDays');

    toggle.checked = true;
    toggle.disabled = false;
    input.disabled = false;
    input.value = defaultPeriod || '30';
    input.parentElement.parentElement.classList.remove('opacity-50', 'pointer-events-none');
}

function disableTimePeriod() {
    const toggle = document.getElementById('timePeriodToggle');
    const input = document.getElementById('periodDays');

    toggle.checked = false;
    toggle.disabled = true;
    input.disabled = true;
    input.parentElement.parentElement.classList.add('opacity-50', 'pointer-events-none');
}

// Authenticate and generate token
async function authenticate() {
    const workspaceId = document.getElementById('workspaceId').value.trim();
    const clientId = document.getElementById('clientId').value.trim();
    const clientSecret = document.getElementById('clientSecret').value.trim();
    const environment = document.getElementById('environmentSelect').value;

    if (!workspaceId || !clientId || !clientSecret) {
        showError('Please fill in all credential fields');
        return;
    }

    showConnectionStatus('connecting');

    try {
        const response = await axios.post('/api/generate-token', {
            workspace_id: workspaceId,
            client_id: clientId,
            client_secret: clientSecret,
            environment: environment
        });

        currentToken = response.data.token;
        showConnectionStatus('connected');
        saveToLocalStorage();
    } catch (error) {
        // Clear token on auth failure
        currentToken = null;
        showConnectionStatus('error');

        // Parse error message from API
        let errorMsg = 'Authentication failed';
        if (error.response?.data?.detail) {
            try {
                const detail = JSON.parse(error.response.data.detail);
                errorMsg = detail.message || errorMsg;
            } catch {
                errorMsg = error.response.data.detail;
            }
        } else if (error.message) {
            errorMsg = error.message;
        }

        showError(errorMsg);
        saveToLocalStorage(); // Save to clear cached token
    }
}

// Execute API request
async function executeRequest() {
    const endpoint = document.getElementById('endpointSelect').value;
    const workspaceId = document.getElementById('workspaceId').value.trim();
    const clientId = document.getElementById('clientId').value.trim();
    const clientSecret = document.getElementById('clientSecret').value.trim();
    const environment = document.getElementById('environmentSelect').value;

    if (!workspaceId || !clientId || !clientSecret) {
        showError('Please fill in all credential fields');
        return;
    }

    if (!endpoint) {
        showError('Please select an endpoint');
        return;
    }

    showLoading();

    const config = endpointsConfig[endpoint];
    const endpointRequest = {
        endpoint: endpoint
    };

    // Add pagination if enabled
    if (config.supports_pagination && document.getElementById('paginationToggle').checked) {
        endpointRequest.page_size = parseInt(document.getElementById('pageSize').value);
        endpointRequest.page_no = parseInt(document.getElementById('pageNo').value);
    }

    // Add time period if enabled
    if (config.supports_time_period && document.getElementById('timePeriodToggle').checked) {
        endpointRequest.period = parseInt(document.getElementById('periodDays').value);
    }

    const startTime = performance.now();

    try {
        const response = await axios.post('/api/fetch-endpoint', {
            credentials: {
                workspace_id: workspaceId,
                client_id: clientId,
                client_secret: clientSecret,
                environment: environment
            },
            endpoint_request: endpointRequest
        });

        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        if (response.data.success) {
            currentResponse = response.data.data;
            displayResponse(currentResponse, duration);
        } else {
            const errorMsg = response.data.error || 'Unknown error occurred';
            showError(errorMsg);
        }
    } catch (error) {
        const errorMsg = error.response?.data?.detail || error.message || 'Request failed';
        showError(errorMsg);
    }
}

function displayResponse(data, duration) {
    // Update stats
    const statusCode = data.statusCode || 200;
    const totalRecords = data.totalRecords || 0;
    const dataSize = new Blob([JSON.stringify(data)]).size;
    const sizeKB = (dataSize / 1024).toFixed(2);

    document.getElementById('statusCode').textContent = statusCode + ' OK';
    document.getElementById('responseTime').textContent = duration + 'ms';
    document.getElementById('responseSize').textContent = sizeKB + ' KB';

    // Format and display JSON with syntax highlighting
    const formatted = syntaxHighlight(JSON.stringify(data, null, 2));
    document.getElementById('jsonOutput').innerHTML = formatted;

    // Update line numbers
    const lines = JSON.stringify(data, null, 2).split('\n').length;
    updateLineNumbers(lines);

    hideLoading();
}

function syntaxHighlight(json) {
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'syntax-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'syntax-key';
            } else {
                cls = 'syntax-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'syntax-boolean';
        } else if (/null/.test(match)) {
            cls = 'syntax-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function updateLineNumbers(count) {
    const container = document.getElementById('lineNumbers');
    container.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        const span = document.createElement('span');
        span.textContent = i;
        container.appendChild(span);
    }
}

function copyToClipboard() {
    if (!currentResponse) return;
    const json = JSON.stringify(currentResponse, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        // Show feedback
        const btn = document.querySelector('[title="Copy to Clipboard"]');
        const icon = btn.querySelector('.material-symbols-outlined');
        icon.textContent = 'done';
        setTimeout(() => {
            icon.textContent = 'content_copy';
        }, 2000);
    });
}

function copyToken() {
    if (!currentToken) {
        showError('No token available. Please authenticate first.');
        return;
    }

    navigator.clipboard.writeText(currentToken).then(() => {
        // Show feedback
        const btn = document.querySelector('[title="Copy Token"]');
        const icon = btn.querySelector('.material-symbols-outlined');
        const originalIcon = icon.textContent;
        icon.textContent = 'done';
        setTimeout(() => {
            icon.textContent = originalIcon;
        }, 2000);
    }).catch(err => {
        showError('Failed to copy token to clipboard');
    });
}

function downloadJSON() {
    if (!currentResponse) return;
    const json = JSON.stringify(currentResponse, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'response.json';
    a.click();
    URL.revokeObjectURL(url);
}

function showConnectionStatus(status) {
    const statusDiv = document.getElementById('connectionStatus');
    const icon = statusDiv.querySelector('.material-symbols-outlined');
    const text = statusDiv.querySelector('p');

    statusDiv.classList.remove('bg-green-500/10', 'border-green-500/20', 'bg-yellow-500/10', 'border-yellow-500/20', 'bg-red-500/10', 'border-red-500/20');
    icon.classList.remove('text-green-500', 'text-yellow-500', 'text-red-500');

    if (status === 'connected') {
        statusDiv.classList.add('bg-green-500/10', 'border-green-500/20');
        icon.classList.add('text-green-500');
        icon.textContent = 'check_circle';
        text.textContent = 'CONNECTED';
        text.classList.remove('text-yellow-500', 'text-red-500');
        text.classList.add('text-green-500');
    } else if (status === 'connecting') {
        statusDiv.classList.add('bg-yellow-500/10', 'border-yellow-500/20');
        icon.classList.add('text-yellow-500');
        icon.textContent = 'pending';
        text.textContent = 'CONNECTING';
        text.classList.remove('text-green-500', 'text-red-500');
        text.classList.add('text-yellow-500');
    } else {
        statusDiv.classList.add('bg-red-500/10', 'border-red-500/20');
        icon.classList.add('text-red-500');
        icon.textContent = 'error';
        text.textContent = 'ERROR';
        text.classList.remove('text-green-500', 'text-yellow-500');
        text.classList.add('text-red-500');
    }
}

function showLoading() {
    const output = document.getElementById('jsonOutput');
    output.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p class="text-text-secondary">Executing request...</p>
        </div>
    `;

    // Update status bar
    document.getElementById('statusCode').textContent = '---';
    document.getElementById('responseTime').textContent = '---';
    document.getElementById('responseSize').textContent = '---';
}

function hideLoading() {
    // Loading state cleared by displayResponse or showError
}

function showError(message) {
    const output = document.getElementById('jsonOutput');
    output.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12">
            <span class="material-symbols-outlined text-red-400 text-6xl mb-4">error</span>
            <p class="text-red-400 font-semibold mb-2">Request Failed</p>
            <p class="text-text-secondary text-sm text-center max-w-md">${message}</p>
        </div>
    `;

    // Update status bar to show error
    document.getElementById('statusCode').innerHTML = '<span class="text-red-400">ERROR</span>';
    document.getElementById('responseTime').textContent = '---';
    document.getElementById('responseSize').textContent = '---';
}

function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    const tabs = ['tabRawJson', 'tabSchema', 'tabMetadata'];
    tabs.forEach(tabId => {
        const btn = document.getElementById(tabId);
        if ((tab === 'raw' && tabId === 'tabRawJson') ||
            (tab === 'schema' && tabId === 'tabSchema') ||
            (tab === 'metadata' && tabId === 'tabMetadata')) {
            btn.classList.remove('text-text-secondary', 'border-transparent', 'hover:bg-[#192233]/30');
            btn.classList.add('text-white', 'border-primary', 'bg-[#192233]/50');
        } else {
            btn.classList.remove('text-white', 'border-primary', 'bg-[#192233]/50');
            btn.classList.add('text-text-secondary', 'border-transparent', 'hover:bg-[#192233]/30');
        }
    });

    // Update content
    const output = document.getElementById('jsonOutput');
    if (!currentResponse) {
        output.innerHTML = '<span class="text-text-secondary/50">// No data available</span>';
        return;
    }

    if (tab === 'raw') {
        const formatted = syntaxHighlight(JSON.stringify(currentResponse, null, 2));
        output.innerHTML = formatted;
    } else if (tab === 'schema') {
        const schema = extractSchema(currentResponse);
        const formatted = syntaxHighlight(JSON.stringify(schema, null, 2));
        output.innerHTML = formatted;
    } else if (tab === 'metadata') {
        const metadata = extractMetadata(currentResponse);
        const formatted = syntaxHighlight(JSON.stringify(metadata, null, 2));
        output.innerHTML = formatted;
    }

    // Update line numbers
    const lines = output.textContent.split('\n').length;
    updateLineNumbers(lines);
}

function extractSchema(data) {
    const schema = {
        type: Array.isArray(data) ? 'array' : typeof data,
        structure: {}
    };

    if (data && typeof data === 'object') {
        if (data.headers) {
            schema.structure.headers = Object.keys(data.headers).length + ' columns';
        }
        if (data.data && Array.isArray(data.data)) {
            schema.structure.records = data.data.length;
            if (data.data.length > 0) {
                schema.structure.fields = Object.keys(data.data[0]);
            }
        }
        if (data.totalRecords !== undefined) {
            schema.structure.totalRecords = data.totalRecords;
        }
    }

    return schema;
}

function extractMetadata(data) {
    const metadata = {
        timestamp: new Date().toISOString(),
        dataType: Array.isArray(data) ? 'array' : typeof data,
        sizeBytes: new Blob([JSON.stringify(data)]).size
    };

    if (data && typeof data === 'object') {
        if (data.startRecord !== undefined) metadata.startRecord = data.startRecord;
        if (data.endRecord !== undefined) metadata.endRecord = data.endRecord;
        if (data.totalRecords !== undefined) metadata.totalRecords = data.totalRecords;

        metadata.topLevelKeys = Object.keys(data);

        if (data.data && Array.isArray(data.data)) {
            metadata.recordCount = data.data.length;
        }
    }

    return metadata;
}

// LocalStorage functions
function saveToLocalStorage() {
    const data = {
        workspaceId: document.getElementById('workspaceId').value,
        clientId: document.getElementById('clientId').value,
        clientSecret: document.getElementById('clientSecret').value,
        environment: document.getElementById('environmentSelect').value,
        endpoint: document.getElementById('endpointSelect').value,
        pageSize: document.getElementById('pageSize').value,
        pageNo: document.getElementById('pageNo').value,
        periodDays: document.getElementById('periodDays').value,
        token: currentToken
    };
    localStorage.setItem('zotokApiTester', JSON.stringify(data));
}

function clearStorage() {
    showConfirmDialog(
        'Clear All Data?',
        'Are you sure you want to clear all saved data and reset the page? This action cannot be undone.',
        () => {
            localStorage.removeItem('zotokApiTester');
            location.reload();
        }
    );
}

function showConfirmDialog(title, message, onConfirm) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center';
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    };

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'bg-[#192233] border border-border-dark rounded-lg p-6 max-w-md mx-4 shadow-2xl';
    dialog.innerHTML = `
        <div class="flex items-start gap-4 mb-4">
            <span class="material-symbols-outlined text-yellow-400 text-3xl">warning</span>
            <div class="flex-1">
                <h3 class="text-white font-semibold text-lg mb-2">${title}</h3>
                <p class="text-text-secondary text-sm">${message}</p>
            </div>
        </div>
        <div class="flex gap-3 justify-end">
            <button id="cancelBtn" class="px-4 py-2 bg-[#111722] hover:bg-[#1a2332] border border-border-dark rounded-md text-white text-sm font-medium transition-colors">
                Cancel
            </button>
            <button id="confirmBtn" class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white text-sm font-medium transition-colors">
                Clear All Data
            </button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Handle buttons
    dialog.querySelector('#cancelBtn').onclick = () => {
        document.body.removeChild(overlay);
    };
    dialog.querySelector('#confirmBtn').onclick = () => {
        document.body.removeChild(overlay);
        onConfirm();
    };
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('zotokApiTester');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.workspaceId) document.getElementById('workspaceId').value = data.workspaceId;
            if (data.clientId) document.getElementById('clientId').value = data.clientId;
            if (data.clientSecret) document.getElementById('clientSecret').value = data.clientSecret;
            if (data.environment) document.getElementById('environmentSelect').value = data.environment;
            if (data.endpoint) {
                // Wait for endpoints to load first
                setTimeout(() => {
                    document.getElementById('endpointSelect').value = data.endpoint;
                    onEndpointChange();
                }, 100);
            }
            if (data.pageSize) document.getElementById('pageSize').value = data.pageSize;
            if (data.pageNo) document.getElementById('pageNo').value = data.pageNo;
            if (data.periodDays) document.getElementById('periodDays').value = data.periodDays;
            if (data.token) {
                currentToken = data.token;
                showConnectionStatus('connected');
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }
}

// Auto-save on input change
function setupAutoSave() {
    const inputs = [
        'workspaceId', 'clientId', 'clientSecret', 'environmentSelect',
        'endpointSelect', 'pageSize', 'pageNo', 'periodDays'
    ];

    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', saveToLocalStorage);
            element.addEventListener('input', saveToLocalStorage);
        }
    });
}

// Initialize
(async function() {
    await loadEndpointsConfig();
    loadFromLocalStorage();
    setupAutoSave();
})();
