(function (sm) {
    // https://github.com/DVLP/localStorageDB
    // @ts-ignore
    !function () { var s, c, e = "undefined" != typeof window ? window : {}, t = e.indexedDB || e.mozIndexedDB || e.webkitIndexedDB || e.msIndexedDB; "undefined" == typeof window || t ? ((t = t.open("ldb", 1)).onsuccess = function (e) { s = this.result; }, t.onerror = function (e) { console.error("indexedDB request error"), console.log(e); }, t = { get: (c = { ready: !(t.onupgradeneeded = function (e) { s = null, e.target.result.createObjectStore("s", { keyPath: "k" }).transaction.oncomplete = function (e) { s = e.target.db; }; }), get: function (e, t) { s ? s.transaction("s").objectStore("s").get(e).onsuccess = function (e) { e = e.target.result && e.target.result.v || null; t(e); } : setTimeout(function () { c.get(e, t); }, 50); }, set: function (t, n, o) { if (s) {
                let e = s.transaction("s", "readwrite");
                e.oncomplete = function (e) { "Function" === {}.toString.call(o).slice(8, -1) && o(); }, e.objectStore("s").put({ k: t, v: n }), e.commit();
            }
            else
                setTimeout(function () { c.set(t, n, o); }, 50); }, delete: function (e, t) { s ? s.transaction("s", "readwrite").objectStore("s").delete(e).onsuccess = function (e) { t && t(); } : setTimeout(function () { c.delete(e, t); }, 50); }, list: function (t) { s ? s.transaction("s").objectStore("s").getAllKeys().onsuccess = function (e) { e = e.target.result || null; t(e); } : setTimeout(function () { c.list(t); }, 50); }, getAll: function (t) { s ? s.transaction("s").objectStore("s").getAll().onsuccess = function (e) { e = e.target.result || null; t(e); } : setTimeout(function () { c.getAll(t); }, 50); }, clear: function (t) { s ? s.transaction("s", "readwrite").objectStore("s").clear().onsuccess = function (e) { t && t(); } : setTimeout(function () { c.clear(t); }, 50); } }).get, set: c.set, delete: c.delete, list: c.list, getAll: c.getAll, clear: c.clear }, sm.ldb = t, "undefined" != typeof module && (module.exports = t)) : console.error("indexDB not supported"); }();

    const app = gradioApp();
	const SM_VERSION = '1.0.0';
    const looselyEqualUIValues = new Set([null, undefined, "", "None"]);
    const entriesPerPage = 25;
    const modalEntriesPerPage = 100;
    const initialEntrySlotCount = entriesPerPage;
    const previewImageMaxSize = 100;
    const updateEntriesDebounceMs = 150;
    const updateStorageDebounceMs = 600;
    const uiSettingsStorageKey = 'sd-webui-state-manager-ui-settings';
    const entryFilterStorageKey = 'sd-webui-state-manager-entry-filter';
    const previewObserverRootMargin = '120px';
    const validSorts = new Set(['newest', 'oldest', 'name', 'type', 'manual']);
    const validPanelTabs = new Set(['favourites', 'settings']);
    const validDateFormats = new Set(['ddmmyyyy', 'mmddyyyy']);
    const loadedPreviewUrls = new Set();
    let entryEventListenerAbortController = new AbortController();
    let updateEntriesDebounceHandle = null;
    let updateStorageDebounceHandle = null;
    let autoSaveTimerHandle = null;

    sm.lastHeadImage = null;
    sm.quickMenuSelectedStateKey = null;
    sm.hasAppliedStartupConfig = false;
    sm.activePanelTab = 'favourites';

    sm.uiSettings = {
        smallViewEntriesPerPage: entriesPerPage,
        collapseSmallViewAccordion: false,
        showSmallViewPagination: false,
        showEntryFooter: false,
        dateFormat: 'ddmmyyyy',
        defaultSort: 'newest',
        rememberFilters: false,
        showConfigNamesOnCards: true,
        alwaysShowConfigTypeBadge: false,
        defaultOpenTab: 'favourites',
        hideSearchByDefault: false,
        startupConfigStateKey: '',
        autoSaveActiveConfig: false,
        autoSaveActiveConfigIntervalMinutes: 5
    };

    sm.loadedEntryFilter = null;

    sm.getNormalisedSortValue = function (value) {
        return validSorts.has(`${value}`) ? `${value}` : 'newest';
    };
    sm.getNormalisedPanelTabValue = function (value) {
        return validPanelTabs.has(`${value}`) ? `${value}` : 'favourites';
    };
    sm.getNormalisedDateFormatValue = function (value) {
        return validDateFormats.has(`${value}`) ? `${value}` : 'ddmmyyyy';
    };
    sm.getDefaultEntryFilter = function () {
        return {
            types: ['txt2img', 'img2img'],
            query: '',
            sort: sm.getNormalisedSortValue(sm.uiSettings.defaultSort)
        };
    };
    sm.getNormalisedUISettings = function (settings) {
        const normalised = {
            smallViewEntriesPerPage: entriesPerPage,
            collapseSmallViewAccordion: false,
            showSmallViewPagination: false,
            showEntryFooter: false,
            dateFormat: 'ddmmyyyy',
            defaultSort: 'newest',
            rememberFilters: false,
            showConfigNamesOnCards: true,
            alwaysShowConfigTypeBadge: false,
            defaultOpenTab: 'favourites',
            hideSearchByDefault: false,
            startupConfigStateKey: '',
            autoSaveActiveConfig: false,
            autoSaveActiveConfigIntervalMinutes: 5
        };
        if (!settings || typeof settings !== 'object') {
            return normalised;
        }
        normalised.smallViewEntriesPerPage = Math.max(1,
            Number.parseInt(`${settings.smallViewEntriesPerPage ?? settings.historySmallViewEntriesPerPage ?? ''}`) || entriesPerPage);
        normalised.collapseSmallViewAccordion = Boolean(settings.collapseSmallViewAccordion);
        normalised.showSmallViewPagination = Boolean(settings.showSmallViewPagination);
        normalised.showEntryFooter = Boolean(settings.showEntryFooter);
        normalised.dateFormat = sm.getNormalisedDateFormatValue(settings.dateFormat);
        normalised.defaultSort = sm.getNormalisedSortValue(settings.defaultSort);
        normalised.rememberFilters = Boolean(settings.rememberFilters);
        normalised.showConfigNamesOnCards = settings.hasOwnProperty('showConfigNamesOnCards') ? Boolean(settings.showConfigNamesOnCards) : true;
        normalised.alwaysShowConfigTypeBadge = Boolean(settings.alwaysShowConfigTypeBadge);
        normalised.defaultOpenTab = sm.getNormalisedPanelTabValue(settings.defaultOpenTab);
        normalised.hideSearchByDefault = Boolean(settings.hideSearchByDefault);
        normalised.startupConfigStateKey = `${settings.startupConfigStateKey ?? ''}`;
        normalised.autoSaveActiveConfig = Boolean(settings.autoSaveActiveConfig);
        normalised.autoSaveActiveConfigIntervalMinutes = Math.max(1,
            Number.parseInt(`${settings.autoSaveActiveConfigIntervalMinutes ?? ''}`) || 5);
        return normalised;
    };
    sm.getNormalisedStoredEntryFilter = function (filter) {
        if (!filter || typeof filter !== 'object') return null;
        const types = Array.isArray(filter.types) ? filter.types.filter(t => t == 'txt2img' || t == 'img2img') : ['txt2img', 'img2img'];
        return {
            types: types.length > 0 ? types : ['txt2img', 'img2img'],
            query: `${filter.query ?? ''}`,
            sort: sm.getNormalisedSortValue(filter.sort)
        };
    };
    sm.collectSearchableEntryText = function (value, visited = new Set()) {
        if (value === null || value === undefined) return '';
        const valueType = typeof value;
        if (valueType == 'string' || valueType == 'number' || valueType == 'boolean') return `${value}`.toLowerCase();
        if (Array.isArray(value)) {
            return value.map(item => sm.collectSearchableEntryText(item, visited)).filter(text => text.length > 0).join(' ');
        }
        if (valueType == 'object') {
            if (visited.has(value)) return '';
            visited.add(value);
            const pieces = [];
            for (const [key, child] of Object.entries(value)) {
                const lowerKey = `${key}`.toLowerCase();
                if (lowerKey == 'preview' || lowerKey == 'image' || lowerKey == 'thumbnail' || lowerKey == 'blob' || lowerKey == 'datauri') continue;
                pieces.push(lowerKey);
                const childText = sm.collectSearchableEntryText(child, visited);
                if (childText.length > 0) pieces.push(childText);
            }
            visited.delete(value);
            return pieces.join(' ').trim();
        }
        return '';
    };

    sm.syncEntryFilterControls = function () {
        if (!sm.panelContainer) return;
        const searchInput = sm.panelContainer.querySelector('.sd-webui-sm-entry-header .search-row input');
        const txt2imgCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-filter-txt2img');
        const img2imgCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-filter-img2img');
        const sortSelect = sm.panelContainer.querySelector('#sd-webui-sm-sort');
        if (searchInput) searchInput.value = sm.entryFilter.query;
        if (txt2imgCheckbox) txt2imgCheckbox.checked = sm.entryFilter.types.indexOf('txt2img') > -1;
        if (img2imgCheckbox) img2imgCheckbox.checked = sm.entryFilter.types.indexOf('img2img') > -1;
        if (sortSelect) sortSelect.value = sm.getNormalisedSortValue(sm.entryFilter.sort);
    };
    sm.syncUISettingsControls = function () {
        if (!sm.panelContainer) return;
        const smallViewEntriesInput = sm.panelContainer.querySelector('#sd-webui-sm-settings-small-view-entries');
        const showSmallViewPaginationCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-show-small-view-pagination');
        const showEntryFooterCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-show-entry-footer');
        const dateFormatSelect = sm.panelContainer.querySelector('#sd-webui-sm-settings-date-format');
        const defaultSortSelect = sm.panelContainer.querySelector('#sd-webui-sm-settings-default-sort');
        const rememberFiltersCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-remember-filters');
        const showConfigNamesCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-show-config-names');
        const showConfigTypeBadgeCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-show-config-type-badge');
        const hideSearchByDefaultCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-hide-search');
        const autoSaveActiveCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-auto-save-active');
        const autoSaveIntervalInput = sm.panelContainer.querySelector('#sd-webui-sm-settings-auto-save-interval');
        if (smallViewEntriesInput) smallViewEntriesInput.value = `${Math.max(1, Number(sm.uiSettings.smallViewEntriesPerPage) || entriesPerPage)}`;
        if (showSmallViewPaginationCheckbox) showSmallViewPaginationCheckbox.checked = Boolean(sm.uiSettings.showSmallViewPagination);
        if (showEntryFooterCheckbox) showEntryFooterCheckbox.checked = Boolean(sm.uiSettings.showEntryFooter);
        if (dateFormatSelect) dateFormatSelect.value = sm.getNormalisedDateFormatValue(sm.uiSettings.dateFormat);
        if (defaultSortSelect) defaultSortSelect.value = sm.getNormalisedSortValue(sm.uiSettings.defaultSort);
        if (rememberFiltersCheckbox) rememberFiltersCheckbox.checked = Boolean(sm.uiSettings.rememberFilters);
        if (showConfigNamesCheckbox) showConfigNamesCheckbox.checked = Boolean(sm.uiSettings.showConfigNamesOnCards);
        if (showConfigTypeBadgeCheckbox) showConfigTypeBadgeCheckbox.checked = Boolean(sm.uiSettings.alwaysShowConfigTypeBadge);
        if (hideSearchByDefaultCheckbox) hideSearchByDefaultCheckbox.checked = Boolean(sm.uiSettings.hideSearchByDefault);
        if (autoSaveActiveCheckbox) autoSaveActiveCheckbox.checked = Boolean(sm.uiSettings.autoSaveActiveConfig);
        if (autoSaveIntervalInput) autoSaveIntervalInput.value = `${sm.uiSettings.autoSaveActiveConfigIntervalMinutes}`;
        sm.syncStartupConfigSettingsControls?.();
    };
    sm.saveUISettings = function () {
        sm.ldb.set(uiSettingsStorageKey, sm.getNormalisedUISettings(sm.uiSettings));
    };
    sm.persistEntryFilterIfEnabled = function () {
        if (!sm.uiSettings.rememberFilters) {
            sm.ldb.delete(entryFilterStorageKey);
            return;
        }
        sm.ldb.set(entryFilterStorageKey, {
            types: [...sm.entryFilter.types],
            query: sm.entryFilter.query,
            sort: sm.getNormalisedSortValue(sm.entryFilter.sort)
        });
    };
    sm.getSavedConfigsForStartupSelection = function () {
        if (!sm.memoryStorage?.entries?.data) return [];
        const orderedStateKeys = sm.ensureFavouritesOrder?.() || [];
        const savedConfigs = [];
        const seenStateKeys = new Set();
        for (const stateKey of orderedStateKeys) {
            const key = `${stateKey ?? ''}`;
            if (key.length == 0 || seenStateKeys.has(key)) continue;
            const state = sm.memoryStorage.entries.data[key];
            if (!state) continue;
            savedConfigs.push(state);
            seenStateKeys.add(key);
        }
        for (const stateKey of Object.keys(sm.memoryStorage.entries.data)) {
            const key = `${stateKey ?? ''}`;
            if (key.length == 0 || seenStateKeys.has(key)) continue;
            const state = sm.memoryStorage.entries.data[key];
            if (!state) continue;
            savedConfigs.push(state);
            seenStateKeys.add(key);
        }
        return savedConfigs;
    };
    sm.syncStartupConfigSettingsControls = function () {
        const startupConfigSelect = sm.panelContainer?.querySelector('#sd-webui-sm-settings-startup-config');
        if (!startupConfigSelect) return;
        const startupConfigStateKey = `${sm.uiSettings.startupConfigStateKey ?? ''}`;
        const savedConfigs = sm.getSavedConfigsForStartupSelection?.() || [];
        let hasSelectedConfig = false;
        startupConfigSelect.innerHTML = '';
        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.innerText = 'None';
        startupConfigSelect.appendChild(noneOption);
        for (const state of savedConfigs) {
            const stateKey = `${state.createdAt ?? ''}`;
            if (stateKey.length == 0) continue;
            const name = `${state.name ?? ''}`.trim();
            const fallbackDate = new Date(Number(state.createdAt ?? Date.now())).toISOString().replace('T', ' ').replace(/\.\d+Z/, '');
            const option = document.createElement('option');
            option.value = stateKey;
            option.innerText = name.length > 0 ? name : `Profile ${fallbackDate}`;
            startupConfigSelect.appendChild(option);
            if (stateKey == startupConfigStateKey) hasSelectedConfig = true;
        }
        if (startupConfigStateKey.length > 0 && !hasSelectedConfig) {
            sm.uiSettings.startupConfigStateKey = '';
            sm.saveUISettings();
        }
        startupConfigSelect.value = hasSelectedConfig ? startupConfigStateKey : '';
        startupConfigSelect.disabled = savedConfigs.length == 0;
    };
    sm.syncSearchRowVisibility = function () {
        const searchRow = sm.panelContainer?.querySelector('.sd-webui-sm-entry-toolbar-row.search-row');
        if (!searchRow) return;
        searchRow.style.display = sm.uiSettings.hideSearchByDefault ? 'none' : '';
    };
    sm.syncEntryFooterVisibility = function () {
        const entryContainer = sm.panelContainer?.querySelector('.sd-webui-sm-entry-container');
        if (!entryContainer) return;
        entryContainer.dataset['showEntryFooter'] = `${Boolean(sm.uiSettings.showEntryFooter)}`;
    };
    sm.syncConfigCardNameVisibility = function () {
        const entryContainer = sm.panelContainer?.querySelector('.sd-webui-sm-entry-container');
        if (!entryContainer) return;
        entryContainer.dataset['showConfigNames'] = `${Boolean(sm.uiSettings.showConfigNamesOnCards)}`;
    };
    sm.syncConfigTypeBadgeVisibility = function () {
        const entryContainer = sm.panelContainer?.querySelector('.sd-webui-sm-entry-container');
        if (!entryContainer) return;
        entryContainer.dataset['showConfigTypeBadge'] = `${Boolean(sm.uiSettings.alwaysShowConfigTypeBadge)}`;
    };

    sm.getFavouritesStateKeysNewestFirst = function () {
        if (!sm.memoryStorage?.entries?.data) return [];
        return Object.keys(sm.memoryStorage.entries.data)
            .sort((a, b) => (Number(sm.memoryStorage.entries.data[b]?.createdAt ?? b) || 0) - (Number(sm.memoryStorage.entries.data[a]?.createdAt ?? a) || 0));
    };
    sm.getNormalisedFavouritesOrder = function (order) {
        const favouriteKeys = sm.getFavouritesStateKeysNewestFirst();
        const favouriteKeySet = new Set(favouriteKeys);
        const normalised = [];
        if (Array.isArray(order)) {
            for (const candidate of order) {
                const key = `${candidate ?? ''}`;
                if (key.length == 0 || !favouriteKeySet.has(key) || normalised.indexOf(key) > -1) continue;
                normalised.push(key);
                favouriteKeySet.delete(key);
            }
        }
        for (const key of favouriteKeys) {
            if (favouriteKeySet.has(key)) normalised.push(key);
        }
        return normalised;
    };
    sm.ensureFavouritesOrder = function () {
        if (!sm.memoryStorage) return [];
        sm.memoryStorage.favouritesOrder = sm.getNormalisedFavouritesOrder(sm.memoryStorage.favouritesOrder);
        return [...sm.memoryStorage.favouritesOrder];
    };
    sm.appendFavouritesOrderKey = function (stateKey) {
        const key = `${stateKey ?? ''}`;
        if (key.length == 0 || !sm.memoryStorage) return;
        const currentOrder = sm.ensureFavouritesOrder();
        if (currentOrder.indexOf(key) > -1) return;
        currentOrder.push(key);
        sm.memoryStorage.favouritesOrder = currentOrder;
    };
    sm.removeFavouritesOrderKey = function (stateKey) {
        const key = `${stateKey ?? ''}`;
        if (key.length == 0 || !sm.memoryStorage) return;
        sm.memoryStorage.favouritesOrder = sm.ensureFavouritesOrder().filter((candidate) => candidate != key);
    };
    sm.getActiveFavouritesOrder = function () {
        if (sm.configReorderState?.active) {
            return sm.getNormalisedFavouritesOrder(sm.configReorderState.workingOrder);
        }
        return sm.ensureFavouritesOrder();
    };
    sm.getSelectedConfigStateKey = function () {
        if (sm.selection.entries.length != 1) return null;
        const selectedEntry = (sm.selection.entries[0] || null);
        const selectedStateKey = `${selectedEntry?.data?.createdAt ?? ''}`;
        if (selectedStateKey.length == 0) return null;
        if (!sm.memoryStorage?.entries?.data?.[selectedStateKey]) return null;
        return selectedStateKey;
    };
    sm.getQuickConfigMenuStates = function () {
        if (!sm.memoryStorage?.entries?.data) return [];
        const orderedStateKeys = sm.getActiveFavouritesOrder?.() || sm.ensureFavouritesOrder?.() || [];
        return orderedStateKeys
            .map((stateKey) => sm.memoryStorage.entries.data[stateKey])
            .filter((state) => Boolean(state));
    };
    sm.syncQuickConfigApplyButtonState = function () {
        const applyButton = (sm.quickConfigApplyButton || null);
        if (!applyButton) return;
        const isModal = Boolean(sm.panelContainer?.classList.contains('sd-webui-sm-modal-panel'));
        if (isModal) {
            applyButton.classList.add('sd-webui-sm-hidden');
            applyButton.disabled = true;
            return;
        }
        const selectedStateKey = `${sm.quickMenuSelectedStateKey ?? ''}`;
        const hasSelection = selectedStateKey.length > 0 && Boolean(sm.memoryStorage?.entries?.data?.[selectedStateKey]);
        const shouldShow = Boolean(sm.uiSettings.collapseSmallViewAccordion && hasSelection);
        applyButton.classList.toggle('sd-webui-sm-hidden', !shouldShow);
        applyButton.disabled = !hasSelection;
    };
    sm.syncQuickConfigMenuSelectionState = function () {
        const container = (sm.quickConfigMenuContainer || null);
        if (!container) return;
        const selectedStateKey = `${sm.quickMenuSelectedStateKey ?? ''}`;
        const quickConfigButtons = container.querySelectorAll('.sd-webui-sm-quick-config-item');
        for (const button of Array.from(quickConfigButtons)) {
            button.classList.toggle('active', `${button.dataset['stateKey'] ?? ''}` == selectedStateKey);
        }
        sm.syncQuickConfigApplyButtonState?.();
    };
    sm.ensureQuickConfigHoverTooltip = function () {
        let tooltip = (sm.quickConfigHoverTooltip || null);
        if (!tooltip) {
            tooltip = sm.createElementWithClassList('div', 'sd-webui-sm-quick-config-tooltip');
            tooltip.setAttribute('role', 'tooltip');
            tooltip.style.display = 'none';
            document.body.appendChild(tooltip);
            sm.quickConfigHoverTooltip = tooltip;
        }
        return tooltip;
    };
    sm.hideQuickConfigHoverTooltip = function () {
        const tooltip = (sm.quickConfigHoverTooltip || null);
        if (!tooltip) return;
        tooltip.style.display = 'none';
    };
    sm.showQuickConfigHoverTooltip = function (label, anchorElement) {
        const value = `${label ?? ''}`.trim();
        if (value.length == 0 || !anchorElement || !anchorElement.isConnected) {
            sm.hideQuickConfigHoverTooltip?.();
            return;
        }
        const tooltip = sm.ensureQuickConfigHoverTooltip();
        tooltip.textContent = value;
        tooltip.style.display = 'block';
        const viewportPadding = 4;
        const offsetY = 6;
        const anchorRect = anchorElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = anchorRect.left + ((anchorRect.width - tooltipRect.width) / 2);
        let top = anchorRect.top - tooltipRect.height - offsetY;
        if (top < viewportPadding) top = anchorRect.bottom + offsetY;
        left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));
        top = Math.max(viewportPadding, Math.min(top, window.innerHeight - tooltipRect.height - viewportPadding));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    };
    sm.syncModalQuickControlsState = function () {
        const isModal = Boolean(sm.panelContainer?.classList.contains('sd-webui-sm-modal-panel'));
        const quickSaveButton = (sm.quickSettingSaveButton || null);
        const quickApplyButton = (sm.quickConfigApplyButton || null);
        const quickMenuContainer = (sm.quickConfigMenuContainer || null);
        const accordionToggleButton = (sm.smallViewAccordionToggleButton || null);
        if (quickSaveButton) quickSaveButton.classList.toggle('sd-webui-sm-hidden', isModal);
        if (sm.navTitle) sm.navTitle.style.display = isModal ? 'none' : '';
        if (isModal && quickMenuContainer) quickMenuContainer.style.display = 'none';
        if (isModal && quickApplyButton) {
            quickApplyButton.classList.add('sd-webui-sm-hidden');
            quickApplyButton.disabled = true;
        }
        if (isModal) sm.hideQuickConfigHoverTooltip?.();
        if (accordionToggleButton) {
            accordionToggleButton.classList.toggle('sd-webui-sm-hidden', isModal);
            accordionToggleButton.disabled = isModal;
        }
    };
    sm.applyQuickSelectedConfig = function () {
        const selectedStateKey = `${sm.quickMenuSelectedStateKey ?? ''}`;
        const targetState = sm.memoryStorage?.entries?.data?.[selectedStateKey];
        if (!targetState) { sm.syncQuickConfigApplyButtonState?.(); return; }
        sm.applyAll(targetState);
        sm.quickMenuSelectedStateKey = null;
        sm.renderQuickConfigMenu?.();
        sm.syncQuickConfigApplyButtonState?.();
    };
    sm.renderQuickConfigMenu = function () {
        const container = (sm.quickConfigMenuContainer || null);
        const navControlButtons = (container?.parentElement || null);
        if (!container) return;
        const showQuickMenu = Boolean(sm.uiSettings.collapseSmallViewAccordion && !sm.panelContainer?.classList.contains('sd-webui-sm-modal-panel'));
        container.style.display = showQuickMenu ? 'flex' : 'none';
        if (!showQuickMenu) {
            sm.hideQuickConfigHoverTooltip?.();
            sm.syncQuickConfigApplyButtonState?.();
            return;
        }
        container.innerHTML = '';
        const quickConfigs = sm.getQuickConfigMenuStates();
        const quickConfigKeys = new Set(quickConfigs.map((state) => `${state.createdAt ?? ''}`));
        if (`${sm.quickMenuSelectedStateKey ?? ''}`.length > 0 && !quickConfigKeys.has(`${sm.quickMenuSelectedStateKey}`)) {
            sm.quickMenuSelectedStateKey = null;
        }
        for (const state of quickConfigs) {
            const button = sm.createElementWithClassList('button', 'sd-webui-sm-quick-config-item');
            const stateKey = `${state.createdAt ?? ''}`;
            const name = `${state.name ?? ''}`.trim();
            const fallbackDate = new Date(Number(state.createdAt ?? Date.now())).toISOString().replace('T', ' ').replace(/\.\d+Z/, '');
            button.type = 'button';
            button.title = name.length > 0 ? name : `Profile ${fallbackDate}`;
            button.setAttribute('aria-label', button.title);
            button.dataset['stateKey'] = stateKey;
            button.style.backgroundImage = state.preview ? `url("${state.preview}")` : '';
            button.classList.toggle('active', `${sm.quickMenuSelectedStateKey ?? ''}` == stateKey);
            const selectQuickConfig = (event) => {
                event.preventDefault();
                event.stopPropagation();
                sm.hideQuickConfigHoverTooltip?.();
                sm.quickMenuSelectedStateKey = stateKey;
                sm.syncQuickConfigMenuSelectionState?.();
            };
            button.addEventListener('pointerdown', selectQuickConfig);
            button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); });
            button.addEventListener('keydown', (event) => {
                if (event.key == 'Enter' || event.key == ' ') selectQuickConfig(event);
            });
            button.addEventListener('mouseenter', () => sm.showQuickConfigHoverTooltip?.(`${button.title ?? ''}`, button));
            button.addEventListener('focus', () => sm.showQuickConfigHoverTooltip?.(`${button.title ?? ''}`, button));
            button.addEventListener('mouseleave', () => sm.hideQuickConfigHoverTooltip?.());
            button.addEventListener('blur', () => sm.hideQuickConfigHoverTooltip?.());
            container.appendChild(button);
        }
        sm.syncQuickConfigApplyButtonState?.();
    };
    sm.syncSmallViewAccordionState = function () {
        const entryContainer = sm.panelContainer?.querySelector('.sd-webui-sm-entry-container');
        const inspector = sm.inspector || null;
        const settingsPanel = sm.panelContainer?.querySelector('.sd-webui-sm-settings-panel');
        const isModal = Boolean(sm.panelContainer?.classList.contains('sd-webui-sm-modal-panel'));
        const isCollapsed = !isModal && Boolean(sm.uiSettings.collapseSmallViewAccordion);
        const showSettings = sm.activePanelTab == 'settings';
        if (sm.sidePanel) sm.sidePanel.classList.toggle('sd-webui-sm-small-view-collapsed', isCollapsed);
        if (entryContainer) entryContainer.style.display = (showSettings || isCollapsed) ? 'none' : '';
        if (inspector) inspector.style.display = (showSettings || isCollapsed) ? 'none' : '';
        if (settingsPanel) settingsPanel.style.display = (!isCollapsed && showSettings) ? 'block' : 'none';
        const panelTabButtons = sm.panelTabButtons || {};
        for (const tabName in panelTabButtons) {
            panelTabButtons[tabName].style.display = isCollapsed ? 'none' : '';
        }
        const toggleButton = (sm.smallViewAccordionToggleButton || null);
        if (toggleButton) {
            toggleButton.classList.toggle('open', !isCollapsed);
            toggleButton.title = isCollapsed ? 'Expand small view' : 'Collapse small view';
            toggleButton.setAttribute('aria-expanded', `${!isCollapsed}`);
        }
        sm.renderQuickConfigMenu?.();
        sm.syncQuickConfigApplyButtonState?.();
    };
    sm.applyDefaultOpenTab = function () {
        const defaultOpenTab = sm.getNormalisedPanelTabValue(sm.uiSettings.defaultOpenTab);
        sm.activePanelTab = defaultOpenTab;
        sm.syncEntryFilterControls?.();
        sm.syncPanelTabButtons?.();
        sm.syncPanelTabVisibility?.();
    };
    sm.applyLoadedPreferences = function () {
        const defaults = sm.getDefaultEntryFilter();
        const rememberedFilter = sm.uiSettings.rememberFilters ? sm.getNormalisedStoredEntryFilter(sm.loadedEntryFilter) : null;
        sm.entryFilter.types = [...(rememberedFilter?.types ?? defaults.types)];
        sm.entryFilter.query = rememberedFilter?.query ?? defaults.query;
        sm.entryFilter.sort = rememberedFilter?.sort ?? defaults.sort;
        sm.applyDefaultOpenTab();
        sm.syncUISettingsControls();
        sm.syncEntryFilterControls();
        sm.syncPanelTabButtons?.();
        sm.syncPanelTabVisibility?.();
        sm.syncSearchRowVisibility?.();
        sm.syncEntryFooterVisibility?.();
        sm.syncConfigCardNameVisibility?.();
        sm.syncConfigTypeBadgeVisibility?.();
        sm.syncSmallViewAccordionState?.();
        sm.syncPaginationInteractionState?.();
        if (sm.panelContainer) sm.queueEntriesUpdate(0);
        sm.restartAutoSaveTimer?.();
    };
    sm.loadPreferences = function () {
        sm.ldb.get(uiSettingsStorageKey, uiSettings => {
            sm.uiSettings = sm.getNormalisedUISettings(uiSettings);
            if (!sm.uiSettings.rememberFilters) {
                sm.loadedEntryFilter = null;
                sm.ldb.delete(entryFilterStorageKey);
                sm.applyLoadedPreferences();
                return;
            }
            sm.ldb.get(entryFilterStorageKey, entryFilter => {
                sm.loadedEntryFilter = sm.getNormalisedStoredEntryFilter(entryFilter);
                sm.applyLoadedPreferences();
            });
        });
    };
    sm.entryFilter = {
        ...sm.getDefaultEntryFilter(),
        matches: function (data) {
            const f = sm.entryFilter;
            if (!Array.isArray(data?.groups) || data.groups.length === 0) return false;
            if (f.types.indexOf(data.type) === -1) return false;
            if (f.query == '') return true;
            const queries = f.query.toLowerCase().split(/, */);
            const quickSettings = (data.quickSettings && typeof data.quickSettings === 'object') ? data.quickSettings : {};
            const checkpointName = `${quickSettings['Stable Diffusion checkpoint'] ?? quickSettings['sd_model_checkpoint'] ?? ''}`.toLowerCase();
            const prompt = `${data.generationSettings?.prompt ?? ''}`.toLowerCase();
            const negativePrompt = `${data.generationSettings?.negativePrompt ?? ''}`.toLowerCase();
            const name = `${data.name ?? ''}`.toLowerCase();
            const searchText = sm.collectSearchableEntryText(data);
            return queries.every(q =>
                checkpointName.indexOf(q) > -1 ||
                prompt.indexOf(q) > -1 ||
                negativePrompt.indexOf(q) > -1 ||
                name.indexOf(q) > -1 ||
                searchText.indexOf(q) > -1
            );
        }
    };
    sm.loadPreferences();
    sm.currentPage = 0;

    sm.queueEntriesUpdate = function (delayMs = 0) {
        if (updateEntriesDebounceHandle != null) {
            clearTimeout(updateEntriesDebounceHandle);
            updateEntriesDebounceHandle = null;
        }
        if (delayMs <= 0) { sm.updateEntries(); return; }
        updateEntriesDebounceHandle = window.setTimeout(() => {
            updateEntriesDebounceHandle = null;
            sm.updateEntries();
        }, delayMs);
    };

    sm.saveActiveProfileChanges = async function () {
        if (sm.selection.entries.length != 1) return;
        const entry = sm.selection.entries[0];
        const entryStateKey = `${entry.data.createdAt ?? ''}`;
        let updatedState = null;
        try {
            updatedState = await sm.getCurrentState(entry.data.type);
        } catch (e) {
            sm.utils.logResponseError("[State Manager] Failed to collect current UI state", e);
            return;
        }
        if (!updatedState || typeof updatedState !== 'object') return;
        const existingName = `${entry.data.name ?? ''}`.trim();
        if (existingName.length > 0) updatedState.name = existingName;
        else delete updatedState.name;
        updatedState.groups = ['favourites'];
        updatedState.createdAt = entry.data.createdAt;
        if (!updatedState.preview && entry.data.preview) {
			updatedState.preview = entry.data.preview;
		}
		sm.memoryStorage.entries.data[entryStateKey] = updatedState;
		entry.data = updatedState;
        sm.updateStorage();
        sm.updateEntryIndicators(entry);
        sm.updateEntries();
        sm.updateInspector();
    };

    sm.restartAutoSaveTimer = function () {
        if (autoSaveTimerHandle != null) {
            clearInterval(autoSaveTimerHandle);
            autoSaveTimerHandle = null;
        }
        if (!sm.uiSettings.autoSaveActiveConfig) return;
        const minutes = Math.max(1, Number(sm.uiSettings.autoSaveActiveConfigIntervalMinutes) || 5);
        autoSaveTimerHandle = setInterval(() => sm.autoSaveActiveConfig(), minutes * 60 * 1000);
    };
    sm.autoSaveActiveConfig = async function () {
		try {
			const generationType = sm.utils.getCurrentGenerationTypeFromUI();
			if (generationType == null) return;

			// Delete any existing autosave profile
			for (const key of Object.keys(sm.memoryStorage.entries.data)) {
				const state = sm.memoryStorage.entries.data[key];
				if (`${state?.name ?? ''}`.startsWith('Autosaved ')) {
					sm.removeFavouritesOrderKey?.(`${key}`);
					delete sm.memoryStorage.entries.data[key];
				}
			}
			sm.memoryStorage.entries.updateKeys();

			// Create the new autosave profile
			const fresh = await sm.getCurrentState(generationType);
			const now = new Date();
			const pad = (n) => `${n}`.padStart(2, '0');
			const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
			fresh.name = `Autosaved ${stamp}`;
			fresh.groups = ['favourites'];
			fresh.createdAt = Date.now();
			while (sm.memoryStorage.entries.data.hasOwnProperty(`${fresh.createdAt}`)) {
				fresh.createdAt++;
			}

			// Reuse the icon of whatever profile was selected, if any
			const selected = sm.selection?.entries?.[0];
			const selectedPreview = selected?.data?.preview;
			if (!fresh.preview && selectedPreview) fresh.preview = selectedPreview;

			sm.memoryStorage.entries.data[fresh.createdAt] = fresh;
			sm.memoryStorage.entries.updateKeys();
			sm.appendFavouritesOrderKey?.(`${fresh.createdAt}`);

			await sm.updateStorage();
			sm.updateEntries();
		} catch (e) {
			sm.utils.logResponseError("[State Manager] Auto-save failed", e);
		}
	};

    sm.getEntriesPerPage = function () {
        if (sm.getMode() == 'modal') return modalEntriesPerPage;
        if (sm.isSmallViewMode()) {
            return Math.max(1, Number.parseInt(`${sm.uiSettings.smallViewEntriesPerPage ?? ''}`) || entriesPerPage);
        }
        return entriesPerPage;
    };
    sm.ensurePreviewObserver = function (root) {
        if (sm.previewObserver || typeof IntersectionObserver === 'undefined') return;
        sm.previewObserver = new IntersectionObserver((entries) => {
            for (const observerEntry of entries) {
                if (!observerEntry.isIntersecting) continue;
                const targetEntry = observerEntry.target;
                sm.previewObserver?.unobserve(targetEntry);
                const previewSrc = `${targetEntry.dataset['previewSrc'] ?? ''}`;
                if (previewSrc.length == 0) continue;
                sm.applyEntryPreview(targetEntry, previewSrc);
            }
        }, { root, rootMargin: previewObserverRootMargin });
    };
    sm.clearEntryPreview = function (entry) {
        sm.previewObserver?.unobserve(entry);
        delete entry.dataset['previewSrc'];
        delete entry.dataset['previewLoaded'];
        entry.style.backgroundImage = '';
    };
    sm.applyEntryPreview = function (entry, previewSrc) {
        const applyIfCurrent = () => {
            if (`${entry.dataset['previewSrc'] ?? ''}` !== previewSrc) return;
            entry.style.backgroundImage = `url("${previewSrc}")`;
            entry.dataset['previewLoaded'] = previewSrc;
            loadedPreviewUrls.add(previewSrc);
        };
        if (loadedPreviewUrls.has(previewSrc)) { applyIfCurrent(); return; }
        const preloadedImage = new Image();
        preloadedImage.onload = applyIfCurrent;
        preloadedImage.onerror = applyIfCurrent;
        preloadedImage.src = previewSrc;
    };
    sm.queueEntryPreview = function (entry, previewSrc) {
        entry.dataset['previewSrc'] = previewSrc;
        if (`${entry.dataset['previewLoaded'] ?? ''}` === previewSrc) {
            entry.style.backgroundImage = `url("${previewSrc}")`;
            return;
        }
        entry.style.backgroundImage = '';
        if (previewSrc.length == 0) return;
        if (typeof IntersectionObserver === 'undefined') { sm.applyEntryPreview(entry, previewSrc); return; }
        const entriesRoot = entry.closest('.sd-webui-sm-entries') || sm.panelContainer?.querySelector('.sd-webui-sm-entries');
        if (!entriesRoot) { sm.applyEntryPreview(entry, previewSrc); return; }
        sm.ensurePreviewObserver(entriesRoot);
        sm.previewObserver?.observe(entry);
    };
    sm.syncModalOverlayState = function () {
		const isModalOpen = Boolean(sm.panelContainer?.classList.contains('sd-webui-sm-modal-panel') && sm.panelContainer?.classList.contains('open'));
		document.body.classList.toggle('sd-webui-sm-modal-open', isModalOpen);
	};
    sm.getSavedUiPreviewImagePath = function () {
        if (typeof sm.savedUiPreviewImagePath === 'string' && sm.savedUiPreviewImagePath.length > 0) {
            return sm.savedUiPreviewImagePath;
        }
        const scriptSource = Array
            .from(document.querySelectorAll('script[src]'))
            .map((script) => `${script.src ?? ''}`)
            .find((src) => /\/javascript\/[^/]*statemanager[^/]*\.js(?:\?|$)/i.test(src));
        if (scriptSource) {
            sm.savedUiPreviewImagePath = scriptSource.replace(/\/javascript\/[^/?#]+\.js(?:[?#].*)?$/i, '/resources/icon-saved-ui.webp');
            return sm.savedUiPreviewImagePath;
        }
        const stackMatch = new Error().stack?.match((/(http(.)+)\/javascript\/[^/]+\.js/));
        if (stackMatch) {
            sm.savedUiPreviewImagePath = `${stackMatch[1]}/resources/icon-saved-ui.webp`;
            return sm.savedUiPreviewImagePath;
        }
        return null;
    };

    sm.injectUI = function () {
        // @ts-ignore
        const svelteClassFromSelector = selector => Array.from(Array.from(app.querySelectorAll(selector)).find(el => Array.from(el.classList).flat().find(cls => cls.startsWith('svelte-'))).classList).find(cls => cls.startsWith('svelte-'));
        sm.svelteClasses = {
            button: svelteClassFromSelector('.lg.secondary.gradio-button.tool'),
            tab: svelteClassFromSelector('#tabs'),
            checkbox: svelteClassFromSelector('input[type=checkbox]'),
            prompt: svelteClassFromSelector('#txt2img_prompt label')
        };
        const defaultQuickSettingSaveButtonText = '💾 Save New';
        const quickSettingSaveButton = sm.createElementWithInnerTextAndClassList('button', defaultQuickSettingSaveButtonText, 'sd-webui-sm-nav-save-button', 'sd-webui-sm-nav-save-current-config-button', 'secondary', 'gradio-button', sm.svelteClasses.button);
        quickSettingSaveButton.id = 'sd-webui-sm-quicksettings-button-save';
        quickSettingSaveButton.title = "Save current UI settings as a new profile";
        sm.quickSettingSaveButton = quickSettingSaveButton;
        const showQuickSettingSaveButtonResult = (success) => {
            quickSettingSaveButton.innerText = success ? 'Saved' : 'Save Failed';
            quickSettingSaveButton.classList.toggle('sd-webui-sm-shake', !success);
            setTimeout(() => {
                quickSettingSaveButton.innerText = defaultQuickSettingSaveButtonText;
                quickSettingSaveButton.classList.remove('sd-webui-sm-shake');
            }, 1600);
        };
        quickSettingSaveButton.addEventListener('click', async () => {
            const generationType = sm.utils.getCurrentGenerationTypeFromUI();
            if (generationType == null) { showQuickSettingSaveButtonResult(false); return; }
            const defaultName = "Profile " + new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, '');
            const entered = prompt("Name this profile:", defaultName);
            if (entered == null) return;
            try {
                const currentState = await sm.getCurrentState(generationType);
                currentState.name = entered.trim() || defaultName;
                const savedUiPreviewPath = sm.getSavedUiPreviewImagePath();
                if (savedUiPreviewPath) currentState.preview = savedUiPreviewPath;
                sm.saveState(currentState, 'favourites');
                showQuickSettingSaveButtonResult(true);
                sm.updateEntries();
            } catch (e) {
                console.error("[State Manager] Save failed:", e);
                showQuickSettingSaveButtonResult(false);
            }
        });
        sm.panelContainer = sm.createElementWithClassList('div', 'sd-webui-sm-panel-container');
        const panel = sm.createElementWithClassList('div', 'sd-webui-sm-side-panel');
        sm.sidePanel = panel;

        const nav = sm.createElementWithClassList('div', 'sd-webui-sm-navigation');
        sm.inspector = sm.createElementWithClassList('div', 'sd-webui-sm-inspector');
        const navTabs = sm.createElementWithClassList('div', 'tabs', 'gradio-tabs', sm.svelteClasses.tab);
        let settingsPanel = null;
        let navControlButtons = null;
        const panelTabButtons = {};

        const setActivePanelTab = (tab) => {
            sm.activePanelTab = tab;
            sm.syncPanelTabButtons?.();
            sm.syncPanelTabVisibility?.();
            sm.queueEntriesUpdate(updateEntriesDebounceMs);
        };
        function createNavTab(label, tab, isSelected) {
            const button = sm.createElementWithInnerTextAndClassList('button', label, sm.svelteClasses.tab);
            button.dataset['smTab'] = tab;
            panelTabButtons[tab] = button;
            if (isSelected) button.classList.add('selected');
            navTabs.appendChild(button);
            button.addEventListener('click', () => setActivePanelTab(tab));
        }
        createNavTab('Profiles', 'favourites', true);
        createNavTab('Settings', 'settings');
        sm.panelTabButtons = panelTabButtons;

		navControlButtons = sm.createElementWithClassList('div', 'sd-webui-sm-control');
		const navTitle = sm.createElementWithInnerTextAndClassList('div', '🔸Profile Manager🔸', 'sd-webui-sm-title');
		const navTitleVersion = sm.createElementWithInnerTextAndClassList('span', `v${SM_VERSION}`, 'sd-webui-sm-title-version');
		navTitle.appendChild(navTitleVersion);
		nav.appendChild(navTitle);
		sm.navTitle = navTitle;
        const quickConfigMenuContainer = sm.createElementWithClassList('div', 'sd-webui-sm-quick-config-menu');
        sm.quickConfigMenuContainer = quickConfigMenuContainer;
        const quickConfigApplyButton = sm.createElementWithInnerTextAndClassList('button', 'Apply', 'sd-webui-sm-nav-save-button', 'sd-webui-sm-nav-apply-config-button', 'lg', 'secondary', 'gradio-button', sm.svelteClasses.button);
        quickConfigApplyButton.disabled = true;
        quickConfigApplyButton.classList.add('sd-webui-sm-hidden');
        quickConfigApplyButton.addEventListener('click', () => sm.applyQuickSelectedConfig?.());
        sm.quickConfigApplyButton = quickConfigApplyButton;
        navControlButtons.appendChild(quickConfigApplyButton);
        navControlButtons.appendChild(quickSettingSaveButton);
        const navButtonMode = sm.createElementWithClassList('button', 'sd-webui-sm-inspector-mode');
        navControlButtons.appendChild(navButtonMode);
        const navButtonSmallViewAccordion = sm.createElementWithClassList('button', 'sd-webui-sm-small-view-accordion-toggle', 'gradio-accordion');
        navButtonSmallViewAccordion.appendChild(sm.createElementWithInnerTextAndClassList('span', '▼', 'foldout'));
        sm.smallViewAccordionToggleButton = navButtonSmallViewAccordion;
        navControlButtons.appendChild(navButtonSmallViewAccordion);
        navButtonMode.addEventListener('click', () => {
            panel.classList.remove('sd-webui-sm-side-panel-folded');
            sm.panelContainer.classList.add('sd-webui-sm-modal-panel');
            sm.mountPanelContainer();
            sm.syncModalOverlayState();
            sm.updateInspector();
        });
        navButtonSmallViewAccordion.addEventListener('click', () => {
            if (sm.panelContainer.classList.contains('sd-webui-sm-modal-panel')) return;
            sm.uiSettings.collapseSmallViewAccordion = !Boolean(sm.uiSettings.collapseSmallViewAccordion);
            sm.saveUISettings();
            sm.syncSmallViewAccordionState?.();
            sm.syncPaginationInteractionState?.();
            sm.queueEntriesUpdate(0);
        });
        panel.addEventListener('click', e => e.stopPropagation());
        sm.panelContainer.addEventListener('click', () => {
            if (sm.panelContainer.classList.contains('sd-webui-sm-modal-panel')) {
                sm.panelContainer.classList.remove('sd-webui-sm-modal-panel');
                sm.mountPanelContainer();
                sm.syncModalOverlayState();
                sm.updateInspector();
            }
        });
        const navButtonClose = sm.createElementWithInnerTextAndClassList('button', '✖', 'sd-webui-sm-modal-close-button');
        navControlButtons.appendChild(navButtonClose);
        navButtonClose.addEventListener('click', () => {
            if (!sm.panelContainer.classList.contains('sd-webui-sm-modal-panel')) return;
            sm.panelContainer.classList.remove('sd-webui-sm-modal-panel');
            sm.mountPanelContainer();
            sm.syncModalOverlayState();
            sm.updateInspector();
        });
        nav.appendChild(navTabs);
		nav.appendChild(navControlButtons);
		nav.appendChild(quickConfigMenuContainer);

        const entryContainer = sm.createElementWithClassList('div', 'sd-webui-sm-entry-container');
        const entryHeader = sm.createElementWithClassList('div', 'sd-webui-sm-entry-header');
        const searchRow = sm.createElementWithClassList('div', 'sd-webui-sm-entry-toolbar-row', 'search-row');
        const filterRow = sm.createElementWithClassList('div', 'sd-webui-sm-entry-toolbar-row', 'filter-row');
        const search = sm.createElementWithClassList('input');
        search.type = 'text';
        search.placeholder = "Filter by name, tokens, model or sampler";
        search.value = sm.entryFilter.query;
        const searchChangeCallback = (debounce = true) => {
            sm.entryFilter.query = search.value;
            if (!debounce) sm.persistEntryFilterIfEnabled();
            sm.queueEntriesUpdate(debounce ? updateEntriesDebounceMs : 0);
        };
        search.addEventListener('input', searchChangeCallback);
        search.addEventListener('change', () => searchChangeCallback(false));
        searchRow.appendChild(sm.createElementWithInnerTextAndClassList('span', '🔍', 'sd-webui-sm-icon'));
        searchRow.appendChild(search);

        const entryFooter = sm.createElementWithClassList('div', 'sd-webui-sm-entry-footer');
        sm.pageButtonNavigation = sm.createElementWithClassList('div', 'button-navigation');
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '❮❮', 'jump-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '❮', 'jump-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '8', 'number-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '9', 'number-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '10', 'number-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '11', 'number-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '12', 'number-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '❯', 'jump-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '❯❯', 'jump-button'));
        sm.pageButtonNavigation.childNodes[0].addEventListener('click', () => sm.goToPage(0));
        sm.pageButtonNavigation.childNodes[1].addEventListener('click', () => sm.goToPage(Math.max(sm.currentPage - 1, 0)));
        const textNavigation = sm.createElementWithClassList('div', 'text-navigation');
        textNavigation.appendChild(sm.createElementWithInnerTextAndClassList('span', 'Page'));
        sm.pageNumberInput = document.createElement('input');
        sm.pageNumberInput.type = 'number';
        sm.pageNumberInput.min = 1;
        sm.pageNumberInput.max = 999;
        sm.pageNumberInput.value = 1;
        sm.pageNumberInput.required = true;
        textNavigation.appendChild(sm.pageNumberInput);
        sm.maxPageNumberLabel = sm.createElementWithInnerTextAndClassList('span', 'of 1');
        textNavigation.appendChild(sm.maxPageNumberLabel);
        const handlePageInput = () => {
            sm.goToPage(Math.min(Math.max(sm.pageNumberInput.value.replaceAll(/[^\d]/g, '') - 1, sm.pageNumberInput.min), sm.pageNumberInput.max) || 0);
        };
        sm.pageNumberInput.addEventListener('change', handlePageInput);
        sm.pageNumberInput.addEventListener('blur', handlePageInput);
        entryFooter.appendChild(sm.pageButtonNavigation);
        entryFooter.appendChild(textNavigation);

        function createFilterToggle(type) {
            return sm.createPillToggle(type, { title: `Show ${type} entries` }, `sd-webui-sm-filter-${type}`, sm.entryFilter.types.indexOf(type) > -1, (isOn) => {
                const typeIndex = sm.entryFilter.types.indexOf(type);
                if (isOn && typeIndex == -1) sm.entryFilter.types.push(type);
                else if (!isOn && typeIndex > -1) sm.entryFilter.types.splice(typeIndex, 1);
                sm.persistEntryFilterIfEnabled();
                sm.queueEntriesUpdate(updateEntriesDebounceMs);
            }, false);
        }
        filterRow.appendChild(createFilterToggle('txt2img'));
        filterRow.appendChild(createFilterToggle('img2img'));

        const sortLabel = sm.createElementWithInnerTextAndClassList('label', 'Sort');
        sortLabel.htmlFor = 'sd-webui-sm-sort';
        const sortSelect = document.createElement('select');
        sortSelect.id = 'sd-webui-sm-sort';
        sortSelect.classList.add('sd-webui-sm-sort');
        sortSelect.innerHTML = `
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
        `;
        sortSelect.value = sm.entryFilter.sort;
        sortSelect.title = 'Sort profiles';
        sortSelect.addEventListener('change', () => {
            sm.entryFilter.sort = sortSelect.value;
            sm.persistEntryFilterIfEnabled();
            sm.queueEntriesUpdate(updateEntriesDebounceMs);
        });

        const reorderContainer = sm.createElementWithClassList('div', 'sd-webui-sm-reorder-container');
        const reorderToggleButton = sm.createElementWithInnerTextAndClassList('button', 'Reorder', 'sd-webui-sm-reorder-button');
        const reorderMoveLeftButton = sm.createElementWithInnerTextAndClassList('button', '←', 'sd-webui-sm-reorder-button');
        const reorderMoveRightButton = sm.createElementWithInnerTextAndClassList('button', '→', 'sd-webui-sm-reorder-button');
        const reorderSaveButton = sm.createElementWithInnerTextAndClassList('button', 'Save Order', 'sd-webui-sm-reorder-button');
        const reorderCancelButton = sm.createElementWithInnerTextAndClassList('button', 'Cancel', 'sd-webui-sm-reorder-button');
        reorderContainer.appendChild(reorderToggleButton);
        reorderContainer.appendChild(reorderMoveLeftButton);
        reorderContainer.appendChild(reorderMoveRightButton);
        reorderContainer.appendChild(reorderSaveButton);
        reorderContainer.appendChild(reorderCancelButton);
        filterRow.appendChild(reorderContainer);

        const sortContainer = sm.createElementWithClassList('div', 'sd-webui-sm-sort-container');
        sortContainer.appendChild(sortLabel);
        sortContainer.appendChild(sortSelect);
        filterRow.appendChild(sortContainer);

        sm.configReorderState = sm.configReorderState || { active: false, originalOrder: [], workingOrder: [], hasChanges: false, previousSort: sm.entryFilter.sort };
        const areStringArraysEqual = (a, b) => a.length == b.length && a.every((value, index) => value == b[index]);
        sm.enterConfigReorderMode = function () {
            if (sm.configReorderState?.active) return;
            const baseOrder = sm.ensureFavouritesOrder();
            sm.configReorderState = { active: true, originalOrder: [...baseOrder], workingOrder: [...baseOrder], hasChanges: false, previousSort: sm.entryFilter.sort };
            sm.syncConfigReorderControlsState?.();
            sm.queueEntriesUpdate(0);
        };
        sm.moveSelectedConfigOrder = function (direction) {
            if (!sm.configReorderState?.active) return;
            const selectedStateKey = sm.getSelectedConfigStateKey?.();
            if (!selectedStateKey) { sm.syncConfigReorderControlsState?.(); return; }
            const workingOrder = sm.getNormalisedFavouritesOrder(sm.configReorderState.workingOrder);
            const currentIndex = workingOrder.indexOf(selectedStateKey);
            const targetIndex = currentIndex + direction;
            if (currentIndex < 0 || targetIndex < 0 || targetIndex >= workingOrder.length) { sm.syncConfigReorderControlsState?.(); return; }
            [workingOrder[currentIndex], workingOrder[targetIndex]] = [workingOrder[targetIndex], workingOrder[currentIndex]];
            sm.configReorderState.workingOrder = workingOrder;
            sm.configReorderState.hasChanges = !areStringArraysEqual(workingOrder, sm.configReorderState.originalOrder || []);
            sm.syncConfigReorderControlsState?.();
            sm.queueEntriesUpdate(0);
        };
        sm.saveConfigReorderChanges = function () {
            if (!sm.configReorderState?.active) return;
            sm.memoryStorage.favouritesOrder = sm.getNormalisedFavouritesOrder(sm.configReorderState.workingOrder);
            sm.configReorderState = { active: false, originalOrder: [], workingOrder: [], hasChanges: false, previousSort: sm.entryFilter.sort };
            sm.updateStorage();
            sm.syncConfigReorderControlsState?.();
            sm.queueEntriesUpdate(0);
        };
        sm.cancelConfigReorderChanges = function () {
            if (!sm.configReorderState?.active) return;
            sm.entryFilter.sort = sm.getNormalisedSortValue(sm.configReorderState.previousSort);
            sm.persistEntryFilterIfEnabled();
            sm.syncEntryFilterControls();
            sm.configReorderState = { active: false, originalOrder: [], workingOrder: [], hasChanges: false, previousSort: sm.entryFilter.sort };
            sm.syncConfigReorderControlsState?.();
            sm.queueEntriesUpdate(0);
        };
        sm.syncConfigReorderControlsState = function () {
            const isActive = Boolean(sm.configReorderState?.active);
            const selectedStateKey = isActive ? sm.getSelectedConfigStateKey?.() : null;
            const workingOrder = sm.getNormalisedFavouritesOrder(sm.configReorderState?.workingOrder || []);
            const selectedIndex = selectedStateKey ? workingOrder.indexOf(selectedStateKey) : -1;
            const isSingleSelection = Boolean(selectedStateKey && selectedIndex > -1);
            const canMoveLeft = isSingleSelection && selectedIndex > 0;
            const canMoveRight = isSingleSelection && selectedIndex < workingOrder.length - 1;
            const hasChanges = Boolean(isActive && sm.configReorderState?.hasChanges);
            reorderContainer.style.display = 'inline-flex';
            sortContainer.style.display = 'inline-flex';
            reorderContainer.classList.toggle('active', isActive);
            reorderToggleButton.classList.toggle('active', isActive);
            reorderToggleButton.innerText = isActive ? 'Reordering...' : 'Reorder';
            sortSelect.disabled = isActive;
            for (const button of [reorderMoveLeftButton, reorderMoveRightButton, reorderSaveButton, reorderCancelButton]) {
                button.classList.toggle('sd-webui-sm-hidden', !isActive);
            }
            reorderMoveLeftButton.disabled = !canMoveLeft;
            reorderMoveRightButton.disabled = !canMoveRight;
            reorderSaveButton.disabled = !hasChanges;
            reorderCancelButton.disabled = !isActive;
        };
        reorderToggleButton.addEventListener('click', () => sm.enterConfigReorderMode?.());
        reorderMoveLeftButton.addEventListener('click', () => sm.moveSelectedConfigOrder?.(-1));
        reorderMoveRightButton.addEventListener('click', () => sm.moveSelectedConfigOrder?.(1));
        reorderSaveButton.addEventListener('click', () => sm.saveConfigReorderChanges?.());
        reorderCancelButton.addEventListener('click', () => sm.cancelConfigReorderChanges?.());
        sm.syncConfigReorderControlsState?.();

        entryHeader.appendChild(searchRow);
        entryHeader.appendChild(filterRow);

        const entries = sm.createElementWithClassList('div', 'sd-webui-sm-entries');
        entryContainer.appendChild(entryHeader);
        entryContainer.appendChild(entries);
        entryContainer.appendChild(entryFooter);

        settingsPanel = sm.createElementWithClassList('div', 'sd-webui-sm-settings-panel');
        const settingsTitle = sm.createElementWithInnerTextAndClassList('h2', 'Settings', 'sd-webui-sm-settings-title');
        settingsPanel.appendChild(settingsTitle);
        const settingsList = sm.createElementWithClassList('div', 'sd-webui-sm-settings-list');
        settingsPanel.appendChild(settingsList);
        const createSettingsRow = (labelText, descriptionText, controlElement) => {
            const row = sm.createElementWithClassList('div', 'sd-webui-sm-settings-row');
            const labelContainer = sm.createElementWithClassList('div', 'sd-webui-sm-settings-label-container');
            const label = sm.createElementWithInnerTextAndClassList('label', labelText, 'sd-webui-sm-settings-label');
            const description = sm.createElementWithInnerTextAndClassList('div', descriptionText, 'sd-webui-sm-settings-description');
            labelContainer.appendChild(label);
            labelContainer.appendChild(description);
            row.appendChild(labelContainer);
            row.appendChild(controlElement);
            return row;
        };

        const settingsStartupConfig = document.createElement('select');
        settingsStartupConfig.id = 'sd-webui-sm-settings-startup-config';
        settingsStartupConfig.classList.add('sd-webui-sm-sort');
        settingsStartupConfig.addEventListener('change', () => {
            sm.uiSettings.startupConfigStateKey = `${settingsStartupConfig.value ?? ''}`;
            sm.saveUISettings();
            sm.syncStartupConfigSettingsControls?.();
        });
        settingsList.appendChild(createSettingsRow('Startup Profile', 'Profile to apply automatically on startup. Select None to disable.', settingsStartupConfig));

        const settingsAutoSaveActive = document.createElement('input');
        settingsAutoSaveActive.id = 'sd-webui-sm-settings-auto-save-active';
        settingsAutoSaveActive.type = 'checkbox';
        settingsAutoSaveActive.classList.add(sm.svelteClasses.checkbox);
        settingsAutoSaveActive.addEventListener('change', () => {
            sm.uiSettings.autoSaveActiveConfig = settingsAutoSaveActive.checked;
            sm.saveUISettings();
            sm.restartAutoSaveTimer();
        });
        settingsList.appendChild(createSettingsRow('Auto-save Active Profile', 'Periodically create/overwrite an "autosave" profile with the live UI state.', settingsAutoSaveActive));

        const settingsAutoSaveInterval = document.createElement('input');
        settingsAutoSaveInterval.id = 'sd-webui-sm-settings-auto-save-interval';
        settingsAutoSaveInterval.type = 'number';
        settingsAutoSaveInterval.min = '1';
        settingsAutoSaveInterval.max = '1440';
        settingsAutoSaveInterval.step = '1';
        settingsAutoSaveInterval.classList.add('sd-webui-sm-settings-small-view-entries-input');
        settingsAutoSaveInterval.addEventListener('change', () => {
            const v = Math.max(1, Number.parseInt(settingsAutoSaveInterval.value) || 5);
            settingsAutoSaveInterval.value = `${v}`;
            sm.uiSettings.autoSaveActiveConfigIntervalMinutes = v;
            sm.saveUISettings();
            sm.restartAutoSaveTimer();
        });
        settingsList.appendChild(createSettingsRow('Auto-save Interval (minutes)', 'How often to overwrite the active profile.', settingsAutoSaveInterval));

        const settingsSmallViewEntries = document.createElement('input');
        settingsSmallViewEntries.id = 'sd-webui-sm-settings-small-view-entries';
        settingsSmallViewEntries.type = 'number';
        settingsSmallViewEntries.min = '1';
        settingsSmallViewEntries.max = '500';
        settingsSmallViewEntries.step = '1';
        settingsSmallViewEntries.classList.add('sd-webui-sm-settings-small-view-entries-input');
        settingsSmallViewEntries.addEventListener('change', () => {
            const value = Math.max(1, Number.parseInt(settingsSmallViewEntries.value) || entriesPerPage);
            settingsSmallViewEntries.value = `${value}`;
            sm.uiSettings.smallViewEntriesPerPage = value;
            sm.saveUISettings();
            if (sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination) {
                sm.currentPage = 0;
                sm.pageNumberInput.value = 1;
            }
            sm.queueEntriesUpdate(0);
        });
        settingsList.appendChild(createSettingsRow('Small View Entries', 'Number of profiles shown in small view.', settingsSmallViewEntries));

        const settingsShowSmallViewPagination = document.createElement('input');
        settingsShowSmallViewPagination.id = 'sd-webui-sm-settings-show-small-view-pagination';
        settingsShowSmallViewPagination.type = 'checkbox';
        settingsShowSmallViewPagination.classList.add(sm.svelteClasses.checkbox);
        settingsShowSmallViewPagination.addEventListener('change', () => {
            sm.uiSettings.showSmallViewPagination = settingsShowSmallViewPagination.checked;
            sm.saveUISettings();
            if (sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination) {
                sm.currentPage = 0;
                sm.pageNumberInput.value = 1;
            }
            sm.syncPaginationInteractionState();
            sm.queueEntriesUpdate(0);
        });
        settingsList.appendChild(createSettingsRow('Show Small View Pagination', 'Display page controls in small view.', settingsShowSmallViewPagination));

        const settingsShowEntryFooter = document.createElement('input');
        settingsShowEntryFooter.id = 'sd-webui-sm-settings-show-entry-footer';
        settingsShowEntryFooter.type = 'checkbox';
        settingsShowEntryFooter.classList.add(sm.svelteClasses.checkbox);
        settingsShowEntryFooter.addEventListener('change', () => {
            sm.uiSettings.showEntryFooter = settingsShowEntryFooter.checked;
            sm.saveUISettings();
            sm.syncEntryFooterVisibility?.();
        });
        settingsList.appendChild(createSettingsRow('Display Creation Time in Entries', 'Show date/time footer on profile cards.', settingsShowEntryFooter));

        const settingsDateFormat = document.createElement('select');
        settingsDateFormat.id = 'sd-webui-sm-settings-date-format';
        settingsDateFormat.classList.add('sd-webui-sm-sort');
        settingsDateFormat.innerHTML = `
            <option value="ddmmyyyy">DD/MM/YYYY</option>
            <option value="mmddyyyy">MM/DD/YYYY</option>
        `;
        settingsDateFormat.addEventListener('change', () => {
            sm.uiSettings.dateFormat = sm.getNormalisedDateFormatValue(settingsDateFormat.value);
            settingsDateFormat.value = sm.uiSettings.dateFormat;
            sm.saveUISettings();
            sm.queueEntriesUpdate(0);
        });
        settingsList.appendChild(createSettingsRow('Date Format', 'Date format used in profile card timestamps.', settingsDateFormat));

        const settingsDefaultSort = document.createElement('select');
        settingsDefaultSort.id = 'sd-webui-sm-settings-default-sort';
        settingsDefaultSort.classList.add('sd-webui-sm-sort');
        settingsDefaultSort.innerHTML = `
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
        `;
        settingsDefaultSort.addEventListener('change', () => {
            sm.uiSettings.defaultSort = sm.getNormalisedSortValue(settingsDefaultSort.value);
            settingsDefaultSort.value = sm.uiSettings.defaultSort;
            sm.saveUISettings();
            if (!sm.uiSettings.rememberFilters) {
                sm.entryFilter.sort = sm.uiSettings.defaultSort;
                sm.syncEntryFilterControls();
                sm.queueEntriesUpdate(updateEntriesDebounceMs);
            }
        });
        settingsList.appendChild(createSettingsRow('Default Sort', 'Sort mode used when filters are not remembered.', settingsDefaultSort));

        const settingsHideSearchByDefault = document.createElement('input');
        settingsHideSearchByDefault.id = 'sd-webui-sm-settings-hide-search';
        settingsHideSearchByDefault.type = 'checkbox';
        settingsHideSearchByDefault.classList.add(sm.svelteClasses.checkbox);
        settingsHideSearchByDefault.addEventListener('change', () => {
            sm.uiSettings.hideSearchByDefault = settingsHideSearchByDefault.checked;
            sm.saveUISettings();
            sm.syncSearchRowVisibility();
        });
        settingsList.appendChild(createSettingsRow('Hide Search Bar By Default', 'Hide the filter/search row in the Profiles view.', settingsHideSearchByDefault));

        const settingsRememberFilters = document.createElement('input');
        settingsRememberFilters.id = 'sd-webui-sm-settings-remember-filters';
        settingsRememberFilters.type = 'checkbox';
        settingsRememberFilters.classList.add(sm.svelteClasses.checkbox);
        settingsRememberFilters.addEventListener('change', () => {
            sm.uiSettings.rememberFilters = settingsRememberFilters.checked;
            sm.saveUISettings();
            if (sm.uiSettings.rememberFilters) sm.persistEntryFilterIfEnabled();
            else sm.ldb.delete(entryFilterStorageKey);
        });
        settingsList.appendChild(createSettingsRow('Remember Last-Used Filters', 'Persist filter/search selections between sessions.', settingsRememberFilters));

        const settingsShowConfigNames = document.createElement('input');
        settingsShowConfigNames.id = 'sd-webui-sm-settings-show-config-names';
        settingsShowConfigNames.type = 'checkbox';
        settingsShowConfigNames.classList.add(sm.svelteClasses.checkbox);
        settingsShowConfigNames.addEventListener('change', () => {
            sm.uiSettings.showConfigNamesOnCards = settingsShowConfigNames.checked;
            sm.saveUISettings();
            sm.syncConfigCardNameVisibility?.();
        });
        settingsList.appendChild(createSettingsRow('Show Profile Names on Cards', 'Display profile names on saved-profile cards.', settingsShowConfigNames));

        const settingsShowConfigTypeBadge = document.createElement('input');
        settingsShowConfigTypeBadge.id = 'sd-webui-sm-settings-show-config-type-badge';
        settingsShowConfigTypeBadge.type = 'checkbox';
        settingsShowConfigTypeBadge.classList.add(sm.svelteClasses.checkbox);
        settingsShowConfigTypeBadge.addEventListener('change', () => {
            sm.uiSettings.alwaysShowConfigTypeBadge = settingsShowConfigTypeBadge.checked;
            sm.saveUISettings();
            sm.syncConfigTypeBadgeVisibility?.();
        });
        settingsList.appendChild(createSettingsRow('Always Show Profile Type Badge', 'Always show txt2img/img2img type on profile cards.', settingsShowConfigTypeBadge));

        const settingsDefaultOpenTab = document.createElement('select');
        settingsDefaultOpenTab.id = 'sd-webui-sm-settings-default-open-tab';
        settingsDefaultOpenTab.classList.add('sd-webui-sm-sort');
        settingsDefaultOpenTab.innerHTML = `
            <option value="favourites">Profiles</option>
            <option value="settings">Settings</option>
        `;
        settingsDefaultOpenTab.addEventListener('change', () => {
            sm.uiSettings.defaultOpenTab = sm.getNormalisedPanelTabValue(settingsDefaultOpenTab.value);
            settingsDefaultOpenTab.value = sm.uiSettings.defaultOpenTab;
            sm.saveUISettings();
        });
        settingsList.appendChild(createSettingsRow('Default Open Tab', 'Tab to open when showing the panel.', settingsDefaultOpenTab));

        sm.syncPanelTabButtons = function () {
            for (const tabName in panelTabButtons) {
                panelTabButtons[tabName].classList.toggle('selected', sm.activePanelTab == tabName);
            }
        };
        sm.syncPanelTabVisibility = function () {
            const showSettings = sm.activePanelTab == 'settings';
            sm.inspector.style.display = showSettings ? 'none' : '';
            settingsPanel.style.display = showSettings ? 'block' : 'none';
            sm.syncSmallViewAccordionState?.();
            sm.syncConfigCardNameVisibility?.();
            sm.syncConfigTypeBadgeVisibility?.();
            sm.syncConfigReorderControlsState?.();
        };
        sm.syncPanelTabButtons();

        const createEntrySlot = () => {
            const entry = sm.createElementWithClassList('button', 'sd-webui-sm-entry');
            entry.style.display = 'none';
            const content = sm.createElementWithClassList('div', 'sd-webui-sm-entry-main');
            content.appendChild(sm.createElementWithClassList('div', 'type'));
            content.appendChild(sm.createElementWithClassList('div', 'config-name'));
            entry.appendChild(content);
            const gearButton = sm.createElementWithClassList('div', 'sd-webui-sm-entry-gear');
            gearButton.innerText = '⚙';
            gearButton.title = 'Profile actions';
            gearButton.tabIndex = 0;
            gearButton.setAttribute('role', 'button');
            entry.appendChild(gearButton);
            const footer = sm.createElementWithClassList('div', 'footer');
            footer.appendChild(sm.createElementWithClassList('div', 'date'));
            footer.appendChild(sm.createElementWithClassList('div', 'time'));
            content.appendChild(footer);
            return entry;
        };
        sm.ensureEntrySlotCount = function (targetEntries, minCount) {
            while (targetEntries.childNodes.length < minCount) {
                targetEntries.appendChild(createEntrySlot());
            }
        };
        sm.ensureEntrySlotCount(entries, initialEntrySlotCount);

        const previewFileInput = document.createElement('input');
        previewFileInput.type = 'file';
        previewFileInput.accept = 'image/*';
        previewFileInput.style.display = 'none';
        entryContainer.appendChild(previewFileInput);

        const entryGearMenu = sm.createElementWithClassList('div', 'sd-webui-sm-entry-gear-menu');
        const changePreviewAction = sm.createElementWithInnerTextAndClassList('button', 'Change Preview...', 'sd-webui-sm-entry-gear-menu-action');
        entryGearMenu.appendChild(changePreviewAction);
        entryContainer.appendChild(entryGearMenu);
        let activeGearMenuEntry = null;
        let pendingPreviewStateKey = '';
        const closeEntryGearMenu = () => {
            activeGearMenuEntry = null;
            entryGearMenu.style.display = 'none';
            entryGearMenu.dataset['open'] = 'false';
        };
        const openEntryGearMenu = (entry, triggerElement) => {
            activeGearMenuEntry = entry;
            entryGearMenu.dataset['open'] = 'true';
            entryGearMenu.style.display = 'block';
            entryGearMenu.style.left = '0px';
            entryGearMenu.style.top = '0px';
            entryGearMenu.style.visibility = 'hidden';
            const menuPadding = 8;
            const triggerBounds = triggerElement.getBoundingClientRect();
            const menuBounds = entryGearMenu.getBoundingClientRect();
            const maxLeft = window.innerWidth - menuBounds.width - menuPadding;
            const maxTop = window.innerHeight - menuBounds.height - menuPadding;
            const left = Math.min(Math.max(triggerBounds.right - menuBounds.width, menuPadding), Math.max(menuPadding, maxLeft));
            const top = Math.min(Math.max(triggerBounds.bottom + 4, menuPadding), Math.max(menuPadding, maxTop));
            entryGearMenu.style.left = `${left}px`;
            entryGearMenu.style.top = `${top}px`;
            entryGearMenu.style.visibility = 'visible';
        };
        sm.closeEntryGearMenu = closeEntryGearMenu;
        changePreviewAction.addEventListener('click', () => {
            if (!activeGearMenuEntry || !activeGearMenuEntry.data) { closeEntryGearMenu(); return; }
            const stateKey = `${activeGearMenuEntry.data.createdAt ?? ''}`;
            const targetState = sm.memoryStorage.entries.data[stateKey];
            if (!targetState) { closeEntryGearMenu(); return; }
            pendingPreviewStateKey = stateKey;
            closeEntryGearMenu();
            previewFileInput.value = '';
            previewFileInput.click();
        });
        previewFileInput.addEventListener('change', async () => {
            const selectedFile = previewFileInput.files?.[0];
            const targetState = sm.memoryStorage.entries.data[pendingPreviewStateKey];
            pendingPreviewStateKey = '';
            if (!selectedFile || !targetState) return;
            const previewData = await sm.createPreviewImageDataFromFile(selectedFile);
            if (!previewData) { alert('Failed to read preview image.'); return; }
            targetState.preview = previewData;
            sm.updateStorage();
            sm.queueEntriesUpdate(0);
        });

        const getEntryFromEvent = (event) => {
            if (!(event.target instanceof Element)) return null;
            const entry = event.target.closest('.sd-webui-sm-entry');
            if (!entry || !entry.data || entry.style.display == 'none') return null;
            return entry;
        };

        entries.addEventListener('click', (event) => {
            if (!(event.target instanceof Element)) return;
            const gearButton = event.target.closest('.sd-webui-sm-entry-gear');
            if (gearButton) {
                event.preventDefault();
                event.stopPropagation();
                const entry = gearButton.closest('.sd-webui-sm-entry');
                if (!entry || !entry.data || entry.style.display == 'none') { closeEntryGearMenu(); return; }
                if (entryGearMenu.dataset['open'] == 'true' && activeGearMenuEntry == entry) closeEntryGearMenu();
                else openEntryGearMenu(entry, gearButton);
                return;
            }
            closeEntryGearMenu();
            const entry = getEntryFromEvent(event);
            if (!entry) return;
            if (event.shiftKey) sm.selection.select(entry, 'range');
            else if (event.ctrlKey || event.metaKey) sm.selection.select(entry, 'add');
            else sm.selection.select(entry, 'single');
        });
        entries.addEventListener('dblclick', (event) => {
            const entry = getEntryFromEvent(event);
            if (!entry) return;
            sm.applyAll(entry.data);
        });
        entries.addEventListener('keydown', (event) => {
            if (event.key != 'Enter' && event.key != ' ') return;
            if (!(event.target instanceof Element)) return;
            const gearButton = event.target.closest('.sd-webui-sm-entry-gear');
            if (!gearButton) return;
            event.preventDefault();
            event.stopPropagation();
            gearButton.click();
        });
        document.addEventListener('mousedown', (event) => {
            if (entryGearMenu.dataset['open'] != 'true') return;
            if (!(event.target instanceof Element)) return;
            if (event.target.closest('.sd-webui-sm-entry-gear') || event.target.closest('.sd-webui-sm-entry-gear-menu')) return;
            closeEntryGearMenu();
        });

        panel.appendChild(nav);
        panel.appendChild(entryContainer);
        panel.appendChild(sm.inspector);
        panel.appendChild(settingsPanel);
        sm.panelContainer.appendChild(panel);
        sm.mountPanelContainer();
        sm.panelContainer.classList.add('open');
        sm.syncModalOverlayState();

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') sm.closeEntryGearMenu?.();
            if (event.key !== 'Escape' || !sm.panelContainer.classList.contains('sd-webui-sm-modal-panel')) return;
            sm.panelContainer.classList.remove('sd-webui-sm-modal-panel');
            sm.mountPanelContainer();
            sm.syncModalOverlayState();
            sm.updateInspector();
            event.preventDefault();
        });
        const handleSmallViewModeChange = () => {
            sm.syncPaginationInteractionState();
            if (sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination && sm.currentPage !== 0) {
                sm.currentPage = 0;
                sm.pageNumberInput.value = 1;
            }
            sm.updateEntries();
        };
        window.addEventListener('resize', handleSmallViewModeChange);

        sm.applyLoadedPreferences();
        requestAnimationFrame(() => { setTimeout(() => sm.queueEntriesUpdate?.(0), 0); });
    };

    sm.createPillToggle = function (label, htmlProperties, checkboxId, isOn, onchange, immediatelyCallOnChange) {
        const container = sm.createElementWithClassList('div', 'sd-webui-sm-pill-toggle');
        for (const propName in htmlProperties) container[propName] = htmlProperties[propName];
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isOn;
        checkbox.id = checkboxId;
        const labelElement = document.createElement('label');
        labelElement.htmlFor = checkbox.id;
        labelElement.innerText = label;
        container.appendChild(checkbox);
        container.appendChild(labelElement);
        checkbox.addEventListener('change', () => onchange(checkbox.checked));
        if (immediatelyCallOnChange) onchange(checkbox.checked);
        return container;
    };
    sm.toggle = function () {
        if (!sm.utils.getCurrentGenerationTypeFromUI()) return;
        sm.mountPanelContainer();
        const panelContainer = app.querySelector('.sd-webui-sm-panel-container');
        panelContainer.classList.toggle('open');
        if (panelContainer.classList.contains('open')) {
            sm.applyDefaultOpenTab();
            sm.queueEntriesUpdate(0);
        }
        sm.syncModalOverlayState();
    };
    sm.mountPanelContainer = function () {
        if (!sm.panelContainer) return;
        const clearHostContainClass = () => {
            for (const hostContain of Array.from(app.querySelectorAll('.contain.sd-webui-sm-host-contain'))) {
                hostContain.classList.remove('sd-webui-sm-host-contain');
            }
        };
        const markHostContainClass = (element) => {
            if (!(element instanceof Element)) return;
            const hostContain = element.closest('.contain');
            if (!hostContain) return;
            clearHostContainClass();
            hostContain.classList.add('sd-webui-sm-host-contain');
        };
        const generationType = sm.utils.getCurrentGenerationTypeFromUI();
        const isGenerationTab = generationType == 'txt2img' || generationType == 'img2img';
        if (!isGenerationTab) {
            clearHostContainClass();
            sm.panelContainer.style.display = 'none';
            if (sm.panelContainer.classList.contains('sd-webui-sm-modal-panel')) {
                sm.panelContainer.classList.remove('sd-webui-sm-modal-panel');
                sm.syncModalOverlayState();
            }
            return;
        }
        sm.panelContainer.style.removeProperty('display');
        const isModal = sm.panelContainer.classList.contains('sd-webui-sm-modal-panel');
        const isSmallViewMode = sm.isSmallViewMode();
        const shouldResetPage = isSmallViewMode && !sm.uiSettings.showSmallViewPagination && sm.currentPage !== 0;
        sm.syncPaginationInteractionState();
        if (shouldResetPage && sm.pageNumberInput) {
            sm.currentPage = 0;
            sm.pageNumberInput.value = 1;
            sm.queueEntriesUpdate(0);
        }
        sm.syncSmallViewAccordionState?.();
        sm.syncModalQuickControlsState?.();
        sm.syncQuickConfigApplyButtonState?.();
        const contain = app.querySelector('.contain');
        if (isModal) {
            clearHostContainClass();
            if (contain && sm.panelContainer.parentNode != contain) contain.appendChild(sm.panelContainer);
            return;
        }
        const resultsPanel = app.querySelector(`#${generationType}_results_panel`);
        if (resultsPanel) {
            if (resultsPanel.nextElementSibling != sm.panelContainer) {
                resultsPanel.insertAdjacentElement('afterend', sm.panelContainer);
            }
            markHostContainClass(sm.panelContainer);
            return;
        }
        const fallbackContainer = app.querySelector('.contain');
        if (fallbackContainer && sm.panelContainer.parentNode != fallbackContainer) {
            fallbackContainer.appendChild(sm.panelContainer);
        }
        markHostContainClass(sm.panelContainer);
    };
    sm.getMode = function () {
        return sm.panelContainer.classList.contains('sd-webui-sm-modal-panel') ? 'modal' : 'docked';
    };
    sm.isSmallViewMode = function () {
        const entries = sm.panelContainer?.querySelector('.sd-webui-sm-entries');
        if (!entries) return false;
        return window.getComputedStyle(entries).display != 'grid';
    };
    sm.syncEntryViewModeState = function () {
        const entryContainer = sm.panelContainer?.querySelector('.sd-webui-sm-entry-container');
        if (!entryContainer) return;
        entryContainer.classList.toggle('sd-webui-sm-entry-container-small-view', sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination);
    };
    sm.syncPaginationInteractionState = function () {
        if (!sm.pageButtonNavigation || !sm.pageNumberInput) return;
        const disablePagination = sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination;
        sm.syncEntryViewModeState();
        sm.pageButtonNavigation.classList.toggle('disabled', disablePagination);
        for (const button of sm.pageButtonNavigation.querySelectorAll('button')) {
            button.disabled = disablePagination;
        }
        sm.pageNumberInput.disabled = disablePagination;
    };
    sm.goToPage = function (page) {
        if (sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination) {
            sm.currentPage = 0;
            sm.pageNumberInput.value = 1;
            return;
        }
        sm.currentPage = page;
        sm.pageNumberInput.value = page + 1;
        sm.updateEntries();
    };

    sm.updateEntries = function () {
        if (!sm.storageReady) {
            sm.updateEntriesWhenStorageReady = true;
            return;
        }
        sm.syncStartupConfigSettingsControls?.();
        sm.closeEntryGearMenu?.();
        entryEventListenerAbortController.abort();
        entryEventListenerAbortController = new AbortController();
        sm.syncPaginationInteractionState();
        const currentEntriesPerPage = sm.getEntriesPerPage();
        const entries = sm.panelContainer.querySelector('.sd-webui-sm-entries');
        if (!entries) return;
        sm.ensureEntrySlotCount(entries, currentEntriesPerPage);

        const filteredEntries = Object.entries(sm.memoryStorage.entries.data).filter(([stateKey, stateData]) => sm.entryFilter.matches(stateData));
        const sortBy = sm.entryFilter.sort;
        const manualOrder = sm.getActiveFavouritesOrder?.() || [];
        const manualOrderIndexes = new Map(manualOrder.map((stateKey, index) => [stateKey, index]));
        filteredEntries.sort((a, b) => {
            const aState = a[1];
            const bState = b[1];
            const aKey = `${a[0] ?? ''}`;
            const bKey = `${b[0] ?? ''}`;
            if (sortBy == 'manual') {
                const aIndex = manualOrderIndexes.has(aKey) ? manualOrderIndexes.get(aKey) : Number.MAX_SAFE_INTEGER;
                const bIndex = manualOrderIndexes.has(bKey) ? manualOrderIndexes.get(bKey) : Number.MAX_SAFE_INTEGER;
                if (aIndex != bIndex) return aIndex - bIndex;
                return (Number(bState.createdAt ?? b[0]) || 0) - (Number(aState.createdAt ?? a[0]) || 0);
            }
            switch (sortBy) {
                case 'oldest':
                    return (Number(aState.createdAt ?? a[0]) || 0) - (Number(bState.createdAt ?? b[0]) || 0);
                case 'name':
                    return `${aState.name ?? ''}`.localeCompare(`${bState.name ?? ''}`) || (Number(bState.createdAt ?? b[0]) || 0) - (Number(aState.createdAt ?? a[0]) || 0);
                case 'type':
                    return `${aState.type ?? ''}`.localeCompare(`${bState.type ?? ''}`) || (Number(bState.createdAt ?? b[0]) || 0) - (Number(aState.createdAt ?? a[0]) || 0);
                case 'newest':
                default:
                    return (Number(bState.createdAt ?? b[0]) || 0) - (Number(aState.createdAt ?? a[0]) || 0);
            }
        });

        const filteredKeys = filteredEntries.map(([key]) => key);
        const numPages = Math.max(Math.ceil(filteredKeys.length / currentEntriesPerPage), 1);
        sm.pageNumberInput.max = numPages;
        sm.maxPageNumberLabel.innerText = `of ${numPages}`;
        if (sm.currentPage >= numPages) {
            sm.currentPage = numPages - 1;
            sm.pageNumberInput.value = numPages;
        }
        const endPagesCorrection = Math.max(3 - (numPages - sm.currentPage), 0);
        const pageButtonStart = Math.max(sm.currentPage - 2 - endPagesCorrection, 0);
        for (let i = 0; i < 5; i++) {
            const pageButton = sm.pageButtonNavigation.childNodes[2 + i];
            const pageNumber = pageButtonStart + i;
            if (pageNumber < numPages) {
                pageButton.innerText = pageNumber + 1;
                pageButton.style.display = 'inline-block';
                pageButton.classList.toggle('active', pageNumber == sm.currentPage);
                pageButton.addEventListener('click', () => sm.goToPage(pageNumber), { signal: entryEventListenerAbortController.signal });
            } else {
                pageButton.style.display = 'none';
            }
        }
        sm.pageButtonNavigation.childNodes[7].addEventListener('click', () => sm.goToPage(Math.min(sm.currentPage + 1, numPages)), { signal: entryEventListenerAbortController.signal });
        sm.pageButtonNavigation.childNodes[8].addEventListener('click', () => sm.goToPage(numPages), { signal: entryEventListenerAbortController.signal });

        const dataPageOffset = sm.currentPage * currentEntriesPerPage;
        const numEntries = Math.min(currentEntriesPerPage, filteredKeys.length - dataPageOffset);
        for (let i = 0; i < numEntries; i++) {
            const data = sm.memoryStorage.entries.data[filteredKeys[dataPageOffset + i]];
            const entry = entries.childNodes[i];
            const entryStateKey = `${data.createdAt ?? ''}`;
            entry.data = data;
            sm.queueEntryPreview(entry, `${data.preview ?? ''}`);
            entry.style.display = 'inherit';
            entry.classList.toggle('active', sm.selection.selectedStateKeys.has(entryStateKey));
            const creationDate = new Date(data.createdAt);
            const configName = `${data.name ?? ''}`.trim();
            const day = creationDate.getDate().toString().padStart(2, '0');
            const month = (creationDate.getMonth() + 1).toString().padStart(2, '0');
            const year = creationDate.getFullYear().toString().padStart(2, '0');
            const hours = creationDate.getHours().toString().padStart(2, '0');
            const minutes = creationDate.getMinutes().toString().padStart(2, '0');
            const fullDateText = sm.getNormalisedDateFormatValue(sm.uiSettings.dateFormat) == 'mmddyyyy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
            const fullTimeText = `${hours}:${minutes}`;
            const fullTimestamp = `${fullDateText} ${fullTimeText}`;
            const dateElement = entry.querySelector('.date');
            const timeElement = entry.querySelector('.time');
            const typeElement = entry.querySelector('.type');
            typeElement.innerText = `${data.type == 'txt2img' ? '🖋' : '🖼️'} ${data.type}`;
            entry.querySelector('.config-name').innerText = configName;
            entry.querySelector('.config-name').title = configName;
            entry.classList.toggle('has-config-name', configName.length > 0);
            dateElement.innerText = fullDateText;
            timeElement.innerText = fullTimeText;
            dateElement.title = fullTimestamp;
            timeElement.title = fullTimestamp;
            sm.updateEntryIndicators(entry);
        }
        for (let i = numEntries; i < entries.childNodes.length; i++) {
            const hiddenEntry = entries.childNodes[i];
            hiddenEntry.classList.remove('active');
            hiddenEntry.style.display = 'none';
            sm.clearEntryPreview(hiddenEntry);
        }
        sm.selection.entries = Array.from(entries.childNodes).filter((entry) => entry.style.display != 'none' && entry.classList.contains('active'));
        sm.renderQuickConfigMenu?.();
        sm.syncConfigReorderControlsState?.();
    };
    sm.updateEntryIndicators = function (entry) {
        entry.classList.toggle('configured', entry.data.hasOwnProperty('name') && entry.data.name != undefined && entry.data.name.length > 0);
    };
    sm.clearSelection = function (updateInspector = true) {
        if (!sm.selection) return;
        for (const selectedEntry of (sm.selection.entries || [])) selectedEntry?.classList?.remove('active');
        sm.selection.entries = [];
        sm.selection.selectedStateKeys?.clear?.();
        sm.selection.rangeSelectStart = null;
        sm.selection.undoableRangeSelectionAmount = 0;
        if (updateInspector) {
            sm.updateInspector();
            sm.syncConfigReorderControlsState?.();
        }
    };

    sm.updateInspector = function () {
        sm.inspector.innerHTML = '';
        if (sm.selection.entries.length == 0) return;
        if (sm.selection.entries.length > 1) {
            const deleteButton = sm.createElementWithInnerTextAndClassList('button', `🗑 Delete ${sm.selection.entries.length} selected profiles`, 'sd-webui-sm-inspector-wide-button', 'sd-webui-sm-inspector-load-button');
            deleteButton.addEventListener('click', () => {
                const deleted = sm.deleteStates(true, ...sm.selection.entries.map(e => e.data.createdAt));
                if (!deleted) return;
                sm.clearSelection(false);
                sm.updateEntries();
                sm.updateInspector();
            });
            sm.inspector.appendChild(deleteButton);
            return;
        }
        const entry = sm.selection.entries[0];
        const metaContainer = sm.createElementWithClassList('div', 'category', 'meta-container');

        const renameButton = sm.createElementWithInnerTextAndClassList('button', 'Rename', 'sd-webui-sm-inspector-load-button');
        renameButton.title = 'Rename this profile';
        renameButton.addEventListener('click', () => {
            const currentName = `${entry.data.name ?? ''}`;
            const entered = prompt('Rename profile:', currentName);
            if (entered == null) return;
            const newName = entered.trim();
            if (newName.length == 0 || newName == currentName) return;
            entry.data.name = newName;
            sm.updateStorage();
            sm.updateEntries();
            sm.updateInspector();
        });

        const overwriteButton = sm.createElementWithInnerTextAndClassList('button', 'Overwrite', 'sd-webui-sm-inspector-load-button');
        overwriteButton.title = 'Overwrite this profile with the current UI settings';
        overwriteButton.addEventListener('click', () => sm.saveActiveProfileChanges());

        const applyButton = sm.createElementWithInnerTextAndClassList('button', 'Apply', 'sd-webui-sm-inspector-load-button');
        applyButton.title = 'Apply this profile to the current UI';
        applyButton.addEventListener('click', () => sm.applyAll(entry.data));

        const deleteButton = sm.createElementWithInnerTextAndClassList('button', '🗑', 'sd-webui-sm-inspector-delete-button');
        deleteButton.title = 'Delete this profile';
        deleteButton.addEventListener('click', () => {
            const deleted = sm.deleteStates(true, entry.data.createdAt);
            if (!deleted) return;
            sm.clearSelection(false);
            sm.updateEntries();
            sm.updateInspector();
        });

        metaContainer.appendChild(renameButton);
        metaContainer.appendChild(overwriteButton);
        metaContainer.appendChild(applyButton);
        metaContainer.appendChild(deleteButton);
        sm.inspector.appendChild(metaContainer);
    };

    sm.applyComponentSettings = function (settings) {
        for (let componentPath of Object.keys(settings)) {
            const settingPathInfo = sm.utils.getSettingPathInfo(componentPath);
            const resolvedBasePath = sm.resolveComponentPath(settingPathInfo.basePath);
            const componentData = sm.componentMap[resolvedBasePath];
            if (!componentData) {
                console.warn(`[State Manager] Could not apply component path ${settingPathInfo.basePath}`);
                continue;
            }
            sm.setMappedComponentEntryValue(componentData.entries[settingPathInfo.index], settings[componentPath]);
        }
    };
    sm.getGalleryPreviews = function () {
        return gradioApp().querySelectorAll('div[id^="tab_"] div[id$="_results"] .thumbnail-item > img');
    };
    sm.getCurrentState = async function (type) {
        if (!sm.memoryStorage?.currentDefault) throw new Error("UI defaults not loaded yet");
        return {
            saveVersion: sm.version,
            type: type,
            defaults: sm.memoryStorage.currentDefault.hash,
            quickSettings: await sm.getQuickSettings(),
            componentSettings: sm.getComponentSettings(type, true),
            preview: sm.createPreviewImageData()
        };
    };
    sm.saveState = function (state, group) {
        state.createdAt = Date.now();
        state.groups = ['favourites'];
        sm.memoryStorage.entries.data[state.createdAt] = state;
        sm.memoryStorage.entries.updateKeys();
        sm.appendFavouritesOrderKey?.(`${state.createdAt}`);
        sm.updateStorage();
    };
    sm.deleteStates = function (requireConfirmation, ...stateKeys) {
        const shouldDelete = !requireConfirmation || confirm(`Delete ${stateKeys.length} item${stateKeys.length == 1 ? '' : 's'}? This action cannot be undone.`);
        if (!shouldDelete) return false;
        for (const key of stateKeys) {
            sm.removeFavouritesOrderKey?.(`${key ?? ''}`);
            delete sm.memoryStorage.entries.data[key];
        }
        sm.memoryStorage.entries.updateKeys();
        sm.updateStorage();
        return true;
    };
    sm.getSettingLabelFromPath = function (settingPath) {
        const settingPathInfo = sm.utils.getSettingPathInfo(`${settingPath ?? ''}`);
        const pathParts = settingPathInfo.basePath.split('/');
        return `${pathParts[pathParts.length - 1] ?? ''}`.trim();
    };
    sm.resolveComponentPath = function (settingPath) {
        const basePath = sm.utils.getSettingPathInfo(`${settingPath ?? ''}`).basePath;
        const candidates = [basePath];
        const appendCandidate = (path) => { if (path && candidates.indexOf(path) == -1) candidates.push(path); };
        const explicitAliases = {
            'txt2img/Sampling method': ['customscript/sampler.py/txt2img/Sampling Method'],
            'txt2img/Sampling Method': ['customscript/sampler.py/txt2img/Sampling Method'],
            'txt2img/Sampling steps': ['customscript/sampler.py/txt2img/Sampling Steps'],
            'txt2img/Sampling Steps': ['customscript/sampler.py/txt2img/Sampling Steps'],
            'txt2img/Schedule type': ['customscript/sampler.py/txt2img/Schedule Type'],
            'txt2img/Schedule Type': ['customscript/sampler.py/txt2img/Schedule Type'],
            'img2img/Sampling method': ['customscript/sampler.py/img2img/Sampling Method'],
            'img2img/Sampling Method': ['customscript/sampler.py/img2img/Sampling Method'],
            'img2img/Sampling steps': ['customscript/sampler.py/img2img/Sampling Steps'],
            'img2img/Sampling Steps': ['customscript/sampler.py/img2img/Sampling Steps'],
            'img2img/Schedule type': ['customscript/sampler.py/img2img/Schedule Type'],
            'img2img/Schedule Type': ['customscript/sampler.py/img2img/Schedule Type'],
            'txt2img/Hires CFG Scale': ['txt2img/Hires CFG scale'],
            'txt2img/Hires Distilled CFG Scale': ['txt2img/Hires Distilled CFG scale'],
            'img2img/Hires CFG Scale': ['img2img/Hires CFG scale'],
            'img2img/Hires Distilled CFG Scale': ['img2img/Hires Distilled CFG scale']
        };
        for (const alias of (explicitAliases[basePath] || [])) appendCandidate(alias);
        for (const candidate of candidates) {
            if (sm.componentMap.hasOwnProperty(candidate)) return candidate;
            const lowerCandidate = candidate.toLowerCase();
            for (const mappedPath of Object.keys(sm.componentMap)) {
                if (mappedPath.toLowerCase() == lowerCandidate) return mappedPath;
            }
        }
        return basePath;
    };
    sm.findElementBySelectorOrFallback = function (settingPath) {
        const selector = sm.forgeNeoSelectorMap?.[settingPath];
        if (selector) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return sm.findUiConfigFallbackInput(settingPath);
    };
    sm.findUiConfigFallbackInput = function (settingPath) {
        const settingPathInfo = sm.utils.getSettingPathInfo(`${settingPath ?? ''}`);
        const pathParts = settingPathInfo.basePath.split('/');
        const generationType = `${pathParts[0] ?? ''}`;
        if (generationType != 'txt2img' && generationType != 'img2img') return null;
        const labelText = sm.getSettingLabelFromPath(settingPathInfo.basePath);
        if (!labelText) return null;
        const tabContainer = app.getElementById(`tab_${generationType}`) || app.querySelector(`#${generationType}`);
        if (!tabContainer) return null;
        const targetLabel = labelText.replace(/\s+/g, ' ').trim().replace(/:$/, '').toLowerCase();
        const labelCandidates = tabContainer.querySelectorAll('label, .block-title, .name, .label');
        for (const labelNode of labelCandidates) {
            const candidateText = `${labelNode.textContent ?? ''}`.replace(/\s+/g, ' ').trim().replace(/:$/, '').toLowerCase();
            if (candidateText != targetLabel) continue;
            const container = labelNode.closest('.gradio-row, .form, .block, .wrap, .gr-box, .gr-panel') || labelNode.parentElement;
            if (!container) continue;
            const primaryInput = container.querySelector('input[type="number"], textarea, select, input[type="text"], input[type="range"], input[type="checkbox"]');
            if (primaryInput) return primaryInput;
        }
        return null;
    };
    sm.getMappedComponentEntryValue = function (entry) {
        if (!entry) return undefined;
        const resolveValue = (el) => {
            if (!el) return undefined;
            if (el instanceof HTMLInputElement) {
                if (el.type == 'checkbox') return el.checked;
                if (el.type == 'number' || el.type == 'range') {
                    const v = Number(el.value);
                    return Number.isNaN(v) ? el.value : v;
                }
                return el.value;
            }
            if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return el.value;
            return undefined;
        };
        if (entry.source == 'ui-config') {
            const element = sm.findElementBySelectorOrFallback(entry.path);
            if (!element) return undefined;
            const direct = resolveValue(element);
            if (direct !== undefined) return direct;
            const nested = element.querySelector?.('textarea, input[type="text"], input[type="number"], input[type="range"], select, input[type="checkbox"]');
            return resolveValue(nested);
        }
        const componentValue = entry.component?.props?.value;
        if (componentValue !== undefined) return componentValue;
        const instanceContextValue = entry.component?.instance?.$$?.ctx?.[0];
        if (instanceContextValue !== undefined) return instanceContextValue;
        const element = entry.element;
        const direct = resolveValue(element);
        if (direct !== undefined) return direct;
        const nestedInput = element?.querySelector?.('textarea, input[type="text"], input[type="number"], input[type="range"], select, input[type="checkbox"]');
        return resolveValue(nestedInput);
    };
    sm.setMappedComponentEntryValue = function (entry, value) {
        if (!entry) return;
        if (entry.source == 'ui-config') {
            let element = sm.findElementBySelectorOrFallback(entry.path);
            if (!element) { console.warn(`[State Manager] Could not find element for ${entry.path}`); return; }
            const isWritable = (el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
            if (!isWritable(element)) {
                const nested = element.querySelector?.('input, select, textarea');
                if (nested) element = nested;
            }
            if (element instanceof HTMLInputElement) {
                if (element.type == 'checkbox') element.checked = Boolean(value);
                else element.value = `${value ?? ''}`;
            } else if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
                element.value = `${value ?? ''}`;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
        entry.component.props.value = value;
        entry.component.instance.$set({ value: entry.component.props.value });
        const e = new Event('change', { bubbles: true });
        Object.defineProperty(e, 'target', { value: entry.element });
        entry.element.dispatchEvent(e);
    };

    sm.fetchForgeNeoSelectors = async function () {
        return sm.api.get("forgeneomap")
            .then(response => {
                if (!sm.utils.isValidResponse(response)) { sm.forgeNeoSelectorMap = {}; return; }
                sm.forgeNeoSelectorMap = response;
            })
            .catch(e => { console.warn("[State Manager] Failed to fetch Forge Neo selector map:", e); sm.forgeNeoSelectorMap = {}; });
    };

    sm.buildComponentMap = async function () {
        return sm.api.get("componentids")
            .then(response => {
                if (!sm.utils.isValidResponse(response)) return Promise.reject(response);
                sm.componentMap = {};
                const components = gradio_config.components || [];
                const componentsById = new Map();
                const componentsByElemId = new Map();
                for (const component of components) {
                    componentsById.set(component.id, component);
                    if (component.props.elem_id) componentsByElemId.set(component.props.elem_id, component);
                }
                for (const path in response) {
                    const responseData = response[path];
                    const source = (typeof responseData === 'object' && responseData) ? `${responseData.source ?? 'gradio'}` : 'gradio';
                    const componentId = (typeof responseData === 'object' && responseData) ? responseData.id : responseData;
                    const pathParts = path.split('/');
                    if (pathParts[pathParts.length - 1] != 'value') continue;
                    const basePath = pathParts.slice(0, pathParts.length - 1).join('/');
                    if (source == 'ui-config') {
                        if (!sm.componentMap.hasOwnProperty(basePath)) {
                            sm.componentMap[basePath] = { entries: [{ source: 'ui-config', path: basePath }] };
                        }
                        continue;
                    }
                    const component = componentsById.get(componentId);
                    if (!component) continue;
                    let data = { entries: [{ source: 'gradio', path: basePath, component: component, element: app.getElementById(component.props.elem_id || `component-${component.id}`) }] };
                    if (component.props.elem_id?.indexOf('controlnet_ControlNet-0_') > -1) {
                        for (let i = 1; i < 3; i++) {
                            const unitElemId = component.props.elem_id.replace('ControlNet-0_', `ControlNet-${i}_`);
                            const unitComponent = componentsByElemId.get(unitElemId);
                            if (!unitComponent) continue;
                            data.entries.push({ source: 'gradio', path: basePath, component: unitComponent, element: app.getElementById(unitElemId) });
                        }
                    }
                    sm.componentMap[basePath] = data;
                }
                const inputAccordions = document.querySelectorAll('#tab_txt2img .input-accordion, #tab_img2img .input-accordion');
                for (const accordion of inputAccordions) {
                    const component = componentsByElemId.get(accordion.id);
                    const checkbox = accordion.parentElement.querySelector(`#${accordion.id}-checkbox`);
                    const visibleCheckbox = accordion.parentElement.querySelector(`#${accordion.id}-visible-checkbox`);
                    if (!component || !checkbox || !visibleCheckbox) continue;
                    let data = sm.componentMap[`${accordion.id.split('_')[0]}/${component.label}`];
                    if (!data) {
                        data = { entries: [{ source: 'gradio', path: `${accordion.id.split('_')[0]}/${component.label}`, component: component, element: checkbox }] };
                        switch (accordion.id) {
                            case 'txt2img_enable': sm.componentMap['customscript/refiner.py/txt2img/Refiner'] = data; break;
                            case 'img2img_enable': sm.componentMap['customscript/refiner.py/img2img/Refiner'] = data; break;
                        }
                    }
                    data.onChange = () => { visibleCheckbox.checked = data.entries[0].element.checked; };
                }
                for (const component of components) {
                    if (!component.props.elem_id?.startsWith('setting_')) continue;
                    let data = { entries: [{ source: 'gradio', path: component.props.elem_id.substring(8), component: component, element: app.getElementById(component.props.elem_id) }] };
                    sm.componentMap[component.props.elem_id.substring(8)] = data;
                }
                const SAMPLER_ALIASES = {
                    'txt2img_sampling': 'customscript/sampler.py/txt2img/Sampling Method',
                    'txt2img_steps': 'customscript/sampler.py/txt2img/Sampling Steps',
                    'txt2img_scheduler': 'customscript/sampler.py/txt2img/Schedule Type',
                    'img2img_sampling': 'customscript/sampler.py/img2img/Sampling Method',
                    'img2img_steps': 'customscript/sampler.py/img2img/Sampling Steps',
                    'img2img_scheduler': 'customscript/sampler.py/img2img/Schedule Type',
                };
                for (const elemId in SAMPLER_ALIASES) {
                    const c = components.find(x => x.props?.elem_id === elemId);
                    if (!c) continue;
                    const alias = SAMPLER_ALIASES[elemId];
                    sm.componentMap[alias] = { entries: [{ source: 'gradio', path: alias, component: c, element: app.getElementById(elemId) }] };
                }
            })
            .catch(e => sm.utils.logResponseError("[State Manager] Getting component IDs failed with error", e));
    };
    sm.getFromStorage = async function () {
        return sm.api.get("savelocation")
            .then(response => {
                if (!sm.utils.isValidResponse(response, 'location')) return Promise.reject(response);
                if (response.location == 'File') return sm.getFileStorage();
                return sm.getLocalStorage();
            })
            .then(sm.processStorageData)
            .catch(e => sm.utils.logResponseError("[State Manager] Getting storage failed with error", e));
    };
    sm.processStorageData = async function (storedData) {
        if (sm.utils.isEmptyObject(storedData) || storedData == "") return { defaults: {}, favouritesOrder: [], entries: {} };
        if (storedData instanceof Uint8Array) {
            const decompressed = await sm.utils.decompress(storedData);
            return JSON.parse(decompressed) || { defaults: {}, favouritesOrder: [], entries: {} };
        }
        if (typeof storedData === 'string') return JSON.parse(storedData) || { defaults: {}, favouritesOrder: [], entries: {} };
        return storedData;
    };
    sm.getLocalStorage = async function () {
        return new Promise(function (resolve, _reject) {
            sm.ldb.get('sd-webui-state-manager-data', storedData => {
                if (storedData == null || storedData == '[]' || storedData == '') storedData = {};
                resolve(storedData);
            });
        });
    };
    sm.getFileStorage = async function () {
        return sm.api.get("filedata")
            .then(response => {
                if (!sm.utils.isValidResponse(response, 'data')) return Promise.reject(response);
                return response.data || { defaults: {}, favouritesOrder: [], entries: {} };
            })
            .catch(e => sm.utils.logResponseError("[State Manager] Getting file storage failed with error", e));
    };
    sm.updateStorage = function () {
        if (updateStorageDebounceHandle != null) {
            clearTimeout(updateStorageDebounceHandle);
            updateStorageDebounceHandle = null;
        }
        return sm.api.get("savelocation")
            .then(response => {
                if (!sm.utils.isValidResponse(response, 'location')) return Promise.reject(response);
                return response.location == 'File' ? sm.updateFileStorage() : sm.updateLocalStorage();
            })
            .catch(e => sm.utils.logResponseError("[State Manager] Updating storage failed with error", e));
    };
    sm.updateLocalStorage = async function () {
        const compressedData = await sm.getCompressedMemoryStorage();
        sm.ldb.set('sd-webui-state-manager-data', compressedData);
    };
    sm.updateFileStorage = async function () {
        const payload = JSON.stringify({
            defaults: sm.memoryStorage.savedDefaults,
            favouritesOrder: sm.memoryStorage.favouritesOrder,
            entries: sm.memoryStorage.entries.data
        });
        return sm.api.post("save", { contents: payload })
            .catch(e => sm.utils.logResponseError("[State Manager] Saving to file storage failed with error", e));
    };
    sm.getCompressedMemoryStorage = async function () {
        return sm.utils.compress(JSON.stringify({
            defaults: sm.memoryStorage.savedDefaults,
            favouritesOrder: sm.memoryStorage.favouritesOrder,
            entries: sm.memoryStorage.entries.data
        }));
    };
    sm.initMemoryStorage = async function (storedData) {
        if (!storedData || typeof storedData !== 'object' || !storedData.hasOwnProperty('defaults')) {
            sm.memoryStorage = {
                currentDefault: null,
                savedDefaults: {},
                favouritesOrder: [],
                entries: { data: {}, orderedKeys: [], updateKeys: function () { } }
            };
            sm.storageReady = true;
            return;
        }
        sm.memoryStorage = {
            currentDefault: null,
            savedDefaults: storedData.defaults || {},
            favouritesOrder: [],
            entries: {
                data: storedData.entries || {},
                orderedKeys: [],
                updateKeys: function () {
                    sm.memoryStorage.entries.orderedKeys = Object.keys(sm.memoryStorage.entries.data);
                    sm.memoryStorage.entries.orderedKeys.sort().reverse();
                }
            }
        };
        sm.memoryStorage.entries.updateKeys();
        sm.memoryStorage.favouritesOrder = sm.getNormalisedFavouritesOrder(storedData.favouritesOrder);
        return sm.api.get("uidefaults")
            .then(response => {
                if (!sm.utils.isValidResponse(response, 'hash', 'contents')) return Promise.reject(response);
                let contents = {};
                for (const path of Object.keys(response.contents)) {
                    const pathParts = path.split('/');
                    if (pathParts[pathParts.length - 1] != 'value') continue;
                    contents[pathParts.slice(0, pathParts.length - 1).join('/')] = response.contents[path];
                }
                const currentDefault = { hash: response.hash, contents: contents };
                sm.memoryStorage.currentDefault = currentDefault;
                sm.memoryStorage.savedDefaults[currentDefault.hash] = contents;
                sm.storageReady = true;
            })
            .catch(e => { sm.utils.logResponseError("[State Manager] Getting UI defaults failed with error", e); sm.storageReady = true; });
    };
    sm.clearData = function (location) {
        sm.api.get("savelocation")
            .then(response => {
                if (!sm.utils.isValidResponse(response, 'location', 'saveFile')) return Promise.reject(response);
                const sources = ["this browser's Indexed DB", `the shared ${response.saveFile} file`];
                if (!confirm(`Warning! You are about to delete ALL entries from ${sources[location == 'Browser\'s Indexed DB' ? 0 : 1]}. This operation can not be undone! Are you sure you wish to continue?`)) return;
                function ensureMemoryStorageIsSynced() {
                    if (response.location == location) { sm.initMemoryStorage({}); sm.updateEntries(); }
                }
                if (location == 'File') {
                    sm.updateFileStorage([])
                        .then(() => { sm.api.post("showmodal", { type: 'info', contents: `${response.saveFile} has been cleared` }); ensureMemoryStorageIsSynced(); })
                        .catch(e => sm.utils.logResponseError("[State Manager] Clearing File entries failed with error", e));
                } else {
                    sm.updateLocalStorage([]);
                    sm.api.post("showmodal", { type: 'info', contents: "IDB has been cleared" });
                    ensureMemoryStorageIsSynced();
                }
            })
            .catch(e => sm.utils.logResponseError("[State Manager] Getting save file name failed with error", e));
    };
    sm.applyAll = function (state) {
        const quickSettings = (state.quickSettings && typeof state.quickSettings === 'object') ? state.quickSettings : {};
        sm.applyQuickParameters(quickSettings);
        const savedComponentDefaults = sm.memoryStorage.savedDefaults[state.defaults];
        let mergedComponentSettings = (state.componentSettings && typeof state.componentSettings === 'object') ? state.componentSettings : {};
        for (const settingPath in savedComponentDefaults) {
            if (settingPath.indexOf(state.type) == -1) continue;
            if (!mergedComponentSettings.hasOwnProperty(settingPath)) {
                if (!sm.componentMap.hasOwnProperty(settingPath)) continue;
                const value = savedComponentDefaults[settingPath];
                const mappedComponents = sm.componentMap[settingPath].entries;
                for (let i = 0; i < mappedComponents.length; i++) {
                    if (!sm.utils.areLooselyEqualValue(value, sm.getMappedComponentEntryValue(mappedComponents[i]))) {
                        mergedComponentSettings[mappedComponents.length == 1 ? settingPath : `${settingPath}/${i}`] = value;
                    }
                }
            }
        }
        sm.applyComponentSettings(mergedComponentSettings);
    };
    sm.applyStartupConfigIfEnabled = function () {
        if (sm.hasAppliedStartupConfig) return;
        sm.hasAppliedStartupConfig = true;
        const startupConfigStateKey = `${sm.uiSettings.startupConfigStateKey ?? ''}`;
        if (startupConfigStateKey.length == 0) return;
        const startupConfig = sm.memoryStorage?.entries?.data?.[startupConfigStateKey];
        if (!startupConfig) {
            sm.uiSettings.startupConfigStateKey = '';
            sm.saveUISettings();
            sm.syncStartupConfigSettingsControls?.();
            return;
        }
        sm.applyAll(startupConfig);
    };
    sm.getQuickSettings = async function () {
        return sm.api.get("quicksettings")
            .then(response => {
                if (!sm.utils.isValidResponse(response, 'settings')) return Promise.reject(response);
                return response.settings;
            })
            .catch(e => sm.utils.logResponseError("[State Manager] Getting quicksettings failed with error", e));
    };
    sm.applyQuickParameters = async function (values, ...filter) {
        if (!values || typeof values !== 'object') values = {};
        if (filter.length > 0) values = sm.utils.getFilteredObject(values, ...filter);
        return sm.api.post("quicksettings", { contents: JSON.stringify(values) })
            .then(response => {
                if (!sm.utils.isValidResponse(response, 'success') || !response.success) return Promise.reject(response);
                sm.applyComponentSettings(values);
            })
            .catch(e => sm.utils.logResponseError("[State Manager] Applying quicksettings failed with error", e));
    };
    sm.getComponentSettings = function (type, changedOnly = true) {
        let settings = {};
        for (const componentPath of Object.keys(sm.memoryStorage.currentDefault.contents)) {
            const resolvedComponentPath = sm.resolveComponentPath(componentPath);
            const componentData = sm.componentMap[resolvedComponentPath];
            if (!componentData) continue;
            const reType = new RegExp(`(^|\/)${type}/`);
            if (reType.test(componentPath)) {
                for (let i = 0; i < componentData.entries.length; i++) {
                    const finalComponentPath = componentData.entries.length == 1 ? componentPath : `${componentPath}/${i}`;
                    const currentValue = sm.getMappedComponentEntryValue(componentData.entries[i]);
                    if (!changedOnly || (sm.memoryStorage.currentDefault.contents[finalComponentPath] != currentValue)) {
                        settings[finalComponentPath] = currentValue;
                    }
                }
            }
        }
        return settings;
    };
    sm.createPreviewImageData = function () {
        if (!sm.lastHeadImage) return null;
        const galleryPreviews = sm.getGalleryPreviews();
        const image = (galleryPreviews.length > 1 && galleryPreviews[0].src.includes("grids/")) ? galleryPreviews[1] : galleryPreviews[0];
        if (!image) return null;
        const scale = previewImageMaxSize / Math.max(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = image.naturalWidth * scale;
        canvas.height = image.naturalHeight * scale;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const webpDataURI = canvas.toDataURL('image/webp', 0.9);
        return webpDataURI.startsWith('data:image/webp') ? webpDataURI : canvas.toDataURL();
    };
    sm.createPreviewImageDataFromSource = function (imageSource) {
        return new Promise(resolve => {
            if (!imageSource || imageSource.length == 0) { resolve(null); return; }
            const image = new Image();
            image.onload = () => {
                const scale = previewImageMaxSize / Math.max(image.naturalWidth, image.naturalHeight);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(null); return; }
                canvas.width = image.naturalWidth * scale;
                canvas.height = image.naturalHeight * scale;
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                const webpDataURI = canvas.toDataURL('image/webp', 0.9);
                resolve(webpDataURI.startsWith('data:image/webp') ? webpDataURI : canvas.toDataURL());
            };
            image.onerror = () => resolve(null);
            image.src = imageSource;
        });
    };
    sm.createPreviewImageDataFromFile = function (file) {
        return new Promise(resolve => {
            const fileReader = new FileReader();
            fileReader.onload = async () => { resolve(await sm.createPreviewImageDataFromSource(`${fileReader.result ?? ''}`)); };
            fileReader.onerror = () => resolve(null);
            fileReader.readAsDataURL(file);
        });
    };
    sm.createElementWithClassList = function (tagName, ...classes) {
        const element = document.createElement(tagName);
        for (const className of classes) element.classList.add(className);
        return element;
    };
    sm.createElementWithInnerTextAndClassList = function (tagName, innerText, ...classes) {
        const element = sm.createElementWithClassList(tagName, ...classes);
        element.innerText = innerText;
        return element;
    };
    sm.checkHeadImage = function () {
        sm.mountPanelContainer();
        const galleryPreviews = sm.getGalleryPreviews();
        if (galleryPreviews == null) return;
        const headImage = galleryPreviews[0]?.src;
        if (headImage == null || headImage == sm.lastHeadImage) return;
        sm.lastHeadImage = headImage;
    };
    sm.api = {
        get: endpoint => fetch(`${gradio_config.root}/statemanager/${endpoint}`).then(response => {
            if (response.ok) return response.json();
            return Promise.reject(response);
        }),
        post: (endpoint, payload) => fetch(`${gradio_config.root}/statemanager/${endpoint}`, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': "application/json" },
            body: JSON.stringify(payload)
        }).then(response => {
            if (response.ok) return response.json();
            return Promise.reject(response);
        })
    };
    sm.utils = {
        getCurrentGenerationTypeFromUI: () => {
            if (uiCurrentTab.innerText == 'txt2img' || uiCurrentTab.innerText == 'img2img') return uiCurrentTab.innerText;
            if (app.getElementById("tab_txt2img").style.display == 'block') return 'txt2img';
            else if (app.getElementById("tab_img2img").style.display == 'block') return 'img2img';
            return null;
        },
        areLooselyEqualValue: (...values) => {
            const qualifiesForLooseComparison = looselyEqualUIValues.has(values[0]);
            return values.reduce((isEqual, value) => isEqual && (value == values[0] || sm.utils.isDeepEqual(value, values[0]) || (qualifiesForLooseComparison && looselyEqualUIValues.has(value))), true);
        },
        isDeepEqual: (object1, object2) => {
            if (!object1 || !object2) return false;
            const objKeys1 = Object.keys(object1);
            const objKeys2 = Object.keys(object2);
            if (objKeys1.length !== objKeys2.length) return false;
            for (let key of objKeys1) {
                const value1 = object1[key];
                const value2 = object2[key];
                const isObjects = sm.utils.isObject(value1) && sm.utils.isObject(value2);
                if ((isObjects && !sm.utils.isDeepEqual(value1, value2)) || (!isObjects && value1 !== value2)) return false;
            }
            return true;
        },
        isObject: object => object != null && typeof object === "object",
        isEmptyObject: object => sm.utils.isObject(object) && Object.keys(object).length == 0,
        isValidResponse: (response, ...requiredProperties) => response && !sm.utils.isEmptyObject(response) && requiredProperties.every(p => response.hasOwnProperty(p)),
        logResponseError: async function (baseMessage, e) {
            let err = "[No error received]";
            let errType = "unknown type";
            if (typeof e == 'string') { errType = "string"; err = e; }
            else if (e instanceof Response) { errType = "Response object"; err = await e.text(); }
            else { err = e; }
            console.error(`${baseMessage}: (${errType} error) ${err}`);
        },
        getSettingPathInfo: function (settingPath) {
            const index = Number(settingPath.match(/\/(\d+)$/)?.[1] || 0);
            return { basePath: settingPath.replace(/\/\d+$/, ''), index: index };
        },
        getFilteredObject: function (values, ...filter) {
            if (filter.length > 0) {
                values = Object.keys(values).reduce((newValues, path) => {
                    if (filter.indexOf(path) > -1) newValues[path] = values[path];
                    return newValues;
                }, {});
            }
            return values;
        },
        compress: async function (str) {
            const stream = new Blob([str]).stream();
            const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
            const chunks = [];
            const reader = compressedStream.getReader();
            await reader.read().then(function processChunk({ done, value }) {
                if (done) return;
                chunks.push(value);
                return reader.read().then(processChunk);
            });
            return await sm.utils.concatUint8Arrays(chunks);
        },
        decompress: async function (compressedBytes) {
            const stream = new Blob([compressedBytes]).stream();
            const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
            const chunks = [];
            const reader = decompressedStream.getReader();
            await reader.read().then(function processChunk({ done, value }) {
                if (done) return;
                chunks.push(value);
                return reader.read().then(processChunk);
            });
            const stringBytes = await sm.utils.concatUint8Arrays(chunks);
            return new TextDecoder().decode(stringBytes);
        },
        concatUint8Arrays: async function (uint8arrays) {
            const blob = new Blob(uint8arrays);
            const buffer = await blob.arrayBuffer();
            return new Uint8Array(buffer);
        }
    };
    sm.init = async function () {
        sm.version = SM_VERSION;
		const versionPromise = sm.api.get("version")
			.then(response => {
				if (!sm.utils.isValidResponse(response, 'version')) return Promise.reject(response);
				sm.serverVersion = response.version;
			})
			.catch(e => sm.utils.logResponseError("[State Manager] Getting version failed with error", e));
        const storagePromise = sm.getFromStorage()
            .then(async (storedData) => {
                await sm.initMemoryStorage(storedData);
                if (sm.hasOwnProperty('updateEntriesWhenStorageReady')) sm.updateEntries();
            })
            .catch(e => sm.utils.logResponseError("[State Manager] Could not get data from storage", e));
        const componentMapPromise = sm.buildComponentMap();
        const forgeNeoSelectorsPromise = sm.fetchForgeNeoSelectors();
        await Promise.all([versionPromise, storagePromise]);
        sm.injectUI();
        await componentMapPromise;
        await forgeNeoSelectorsPromise;
		console.info(`[State Manager] v${sm.version}`);
        sm.applyStartupConfigIfEnabled?.();
    };
    onUiLoaded(sm.init);
    onAfterUiUpdate(sm.checkHeadImage);
})(window.stateManager = window.stateManager || {
    componentMap: {},
    forgeNeoSelectorMap: {},
    storageReady: false,
    memoryStorage: {
        currentDefault: null,
        savedDefaults: null,
        favouritesOrder: [],
        entries: { data: {}, orderedKeys: [], updateKeys: () => { } }
    },
    selection: {
        rangeSelectStart: null,
        entries: [],
        selectedStateKeys: new Set(),
        undoableRangeSelectionAmount: 0,
        select: function (entry, type) {
            const getStateKey = (targetEntry) => `${targetEntry?.data?.createdAt ?? ''}`;
            const addStateKey = (targetEntry) => { const key = getStateKey(targetEntry); if (key.length > 0) this.selectedStateKeys.add(key); };
            const deleteStateKey = (targetEntry) => { const key = getStateKey(targetEntry); if (key.length > 0) this.selectedStateKeys.delete(key); };
            this.selectedStateKeys = this.selectedStateKeys || new Set();
            switch (type) {
                case 'single':
                    for (let e of this.entries) e.classList.remove('active');
                    this.selectedStateKeys.clear();
                    addStateKey(entry);
                    this.rangeSelectStart = entry;
                    this.entries = [entry];
                    this.undoableRangeSelectionAmount = 0;
                    entry.classList.add('active');
                    break;
                case 'add':
                    this.rangeSelectStart = entry;
                    this.undoableRangeSelectionAmount = 0;
                    entry.classList.toggle('active');
                    if (entry.classList.contains('active')) {
                        if (this.entries.indexOf(entry) == -1) this.entries.push(entry);
                        addStateKey(entry);
                    } else {
                        const entryIndex = this.entries.indexOf(entry);
                        if (entryIndex > -1) this.entries.splice(entryIndex, 1);
                        deleteStateKey(entry);
                    }
                    break;
                case 'range':
                    if (this.rangeSelectStart == null) { this.select(entry, 'single'); return; }
                    const unselectedEntries = this.entries.splice(this.entries.length - this.undoableRangeSelectionAmount, this.undoableRangeSelectionAmount);
                    for (let i = 0; i < unselectedEntries.length; i++) {
                        unselectedEntries[i].classList.remove('active');
                        deleteStateKey(unselectedEntries[i]);
                    }
                    if (entry == this.rangeSelectStart) return;
                    let rangeStartIndex = Array.prototype.indexOf.call(this.rangeSelectStart.parentNode.children, this.rangeSelectStart);
                    let rangeEndIndex = Array.prototype.indexOf.call(entry.parentNode.children, entry);
                    const selectEntryFn = (index) => {
                        const rangeEntry = entry.parentNode.childNodes[index];
                        this.entries.push(rangeEntry);
                        rangeEntry.classList.add('active');
                        addStateKey(rangeEntry);
                    };
                    if (rangeStartIndex < rangeEndIndex) {
                        for (let i = rangeStartIndex + 1; i <= rangeEndIndex; i++) selectEntryFn(i);
                        this.undoableRangeSelectionAmount = rangeEndIndex - rangeStartIndex;
                    } else {
                        for (let i = rangeStartIndex - 1; i >= rangeEndIndex; i--) selectEntryFn(i);
                        this.undoableRangeSelectionAmount = rangeStartIndex - rangeEndIndex;
                    }
                    break;
            }
            window.stateManager.updateInspector();
            window.stateManager.syncConfigReorderControlsState?.();
        }
    }
});
