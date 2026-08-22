/**
 * Delivery Routes Management WebApp - Application Logic
 * Supports: Full CRUD, Dynamic Days & Routes Management, Store Selection & Batch Printing, 
 * Boxes & Amount tracking, Print Preview, Search, Sorting, Drag-and-drop Reordering, 
 * Cloudflare D1 Database & LocalStorage Dual-Mode
 */

(function () {
  'use strict';

  // --- Default Constants ---
  const DEFAULT_DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  
  const DEFAULT_ROUTES_BY_DAY = {
    'จันทร์': ['สาย 1', 'สาย 2', 'สาย 3', 'สาย 3 สำรอง'],
    'อังคาร': ['สาย 1', 'สาย 2', 'สาย 3'],
    'พุธ': ['สาย 1', 'สาย 2'],
    'พฤหัสบดี': ['สาย 1', 'สาย 2', 'สาย 3'],
    'ศุกร์': ['สาย 1', 'สาย 2', 'สาย 3'],
    'เสาร์': ['สาย 1', 'สาย 2', 'สาย 3'],
  };

  const STORAGE_KEY = 'delivery_routes_data_v1';
  const STORAGE_DAYS_KEY = 'delivery_days_v2';
  const STORAGE_ROUTES_KEY = 'delivery_routes_v2';

  // --- App State ---
  let state = {
    items: [],
    days: [...DEFAULT_DAYS],
    routesByDay: JSON.parse(JSON.stringify(DEFAULT_ROUTES_BY_DAY)),
    activeDay: 'จันทร์',
    activeRoute: 'สาย 1',
    manageSelectedDay: 'จันทร์',
    searchQuery: '',
    paymentFilter: 'all',
    sortBy: 'sequence-asc',
    reorderMode: false,
    hasUnsavedReorder: false,
    apiAvailable: false,
    draggedItemId: null,
    selectedItemIds: new Set()
  };

  // --- DOM Elements Cache ---
  const el = {
    dayTabsContainer: document.getElementById('day-tabs-container'),
    routePillsContainer: document.getElementById('route-pills-container'),
    tableBody: document.getElementById('table-body'),
    storesTable: document.getElementById('stores-table'),
    emptyState: document.getElementById('empty-state'),
    tableTitle: document.getElementById('table-title'),
    tableCountBadge: document.getElementById('table-count-badge'),
    chkSelectAll: document.getElementById('chk-select-all'),
    
    // Stats
    statCurrentCount: document.getElementById('stat-current-count'),
    statTransferCount: document.getElementById('stat-transfer-count'),
    statCashCount: document.getElementById('stat-cash-count'),
    statTotalSystem: document.getElementById('stat-total-system'),
    
    // Controls
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    paymentFilter: document.getElementById('payment-filter'),
    sortSelect: document.getElementById('sort-select'),
    btnToggleReorder: document.getElementById('btn-toggle-reorder'),
    reorderToggleText: document.getElementById('reorder-toggle-text'),
    reorderSaveBanner: document.getElementById('reorder-save-banner'),
    btnSaveReorder: document.getElementById('btn-save-reorder'),
    btnCancelReorder: document.getElementById('btn-cancel-reorder'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    
    // Actions
    btnAddItem: document.getElementById('btn-add-item'),
    btnPrintRoute: document.getElementById('btn-print-route'),
    btnExportExcel: document.getElementById('btn-export-excel'),
    btnOpenTools: document.getElementById('btn-open-tools'),
    btnManageDaysRoutes: document.getElementById('btn-manage-days-routes'),
    btnQuickAddRoute: document.getElementById('btn-quick-add-route'),
    dataSourceBadge: document.getElementById('data-source-badge'),

    // Selection Action Bar
    selectionActionBar: document.getElementById('selection-action-bar'),
    selectedCount: document.getElementById('selected-count'),
    printSelectedCount: document.getElementById('print-selected-count'),
    btnPrintSelected: document.getElementById('btn-print-selected'),
    btnDeleteSelected: document.getElementById('btn-delete-selected'),
    btnClearSelection: document.getElementById('btn-clear-selection'),

    // Modals
    modalItem: document.getElementById('modal-item'),
    modalTitle: document.getElementById('modal-title'),
    itemForm: document.getElementById('item-form'),
    formItemId: document.getElementById('form-item-id'),
    formDay: document.getElementById('form-day'),
    formRoute: document.getElementById('form-route'),
    formSequence: document.getElementById('form-sequence'),
    formCode: document.getElementById('form-code'),
    formName: document.getElementById('form-name'),
    formRemark: document.getElementById('form-remark'),
    formBoxes: document.getElementById('form-boxes'),
    formAmount: document.getElementById('form-amount'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelModal: document.getElementById('btn-cancel-modal'),

    // Manage Days & Routes Modal
    modalManageRoutes: document.getElementById('modal-manage-routes'),
    btnCloseManageRoutes: document.getElementById('btn-close-manage-routes'),
    btnDoneManageRoutes: document.getElementById('btn-done-manage-routes'),
    inputNewDay: document.getElementById('input-new-day'),
    btnAddDayAction: document.getElementById('btn-add-day-action'),
    daysManagerList: document.getElementById('days-manager-list'),
    selectManageDay: document.getElementById('select-manage-day'),
    inputNewRoute: document.getElementById('input-new-route'),
    btnAddRouteAction: document.getElementById('btn-add-route-action'),
    routesManagerList: document.getElementById('routes-manager-list'),

    // Tools Modal
    modalTools: document.getElementById('modal-tools'),
    btnCloseTools: document.getElementById('btn-close-tools'),
    btnPingCf: document.getElementById('btn-ping-cf'),
    btnSeedCf: document.getElementById('btn-seed-cf'),
    btnExportExcelModal: document.getElementById('btn-export-excel-modal'),
    btnResetDefault: document.getElementById('btn-reset-default'),
    cfStatusText: document.getElementById('cf-status-text'),
    cfStatusDesc: document.getElementById('cf-status-desc'),

    // Print Preview Modal
    modalPrintPreview: document.getElementById('modal-print-preview'),
    btnClosePreview: document.getElementById('btn-close-preview'),
    btnClosePreviewCancel: document.getElementById('btn-close-preview-cancel'),
    btnConfirmPrint: document.getElementById('btn-confirm-print'),
    previewCountBadge: document.getElementById('preview-count-badge'),
    previewStatStores: document.getElementById('preview-stat-stores'),
    previewStatBoxes: document.getElementById('preview-stat-boxes'),
    previewStatAmount: document.getElementById('preview-stat-amount'),
    previewStatTransfer: document.getElementById('preview-stat-transfer'),
    previewStatCash: document.getElementById('preview-stat-cash'),
    previewTableBody: document.getElementById('preview-table-body'),

    // Print elements
    printRouteTitle: document.getElementById('print-route-title'),
    printDayTitle: document.getElementById('print-day-title'),
    printDateTime: document.getElementById('print-date-time'),
    printTotalCount: document.getElementById('print-total-count'),
    printTransferCount: document.getElementById('print-transfer-count'),
    printCashCount: document.getElementById('print-cash-count'),
    printTotalBoxes: document.getElementById('print-total-boxes'),
    printTotalAmount: document.getElementById('print-total-amount'),
    printTableBody: document.getElementById('print-table-body'),

    toastContainer: document.getElementById('toast-container')
  };

  // ==================== INITIALIZATION ====================
  async function init() {
    loadLocalData();
    loadDaysAndRoutes();
    await checkCloudflareApi();
    renderDayTabs();
    renderRoutePills();
    renderTable();
    updateStats();
    updateSelectionUI();
    updateFormDayAndRouteOptions();
    bindEvents();
    refreshIcons();
  }

  function loadLocalData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        state.items = JSON.parse(stored);
      } else if (window.INITIAL_ROUTES_DATA && Array.isArray(window.INITIAL_ROUTES_DATA)) {
        state.items = JSON.parse(JSON.stringify(window.INITIAL_ROUTES_DATA));
        saveLocalData();
      }
    } catch (e) {
      console.error('Failed to load data:', e);
      if (window.INITIAL_ROUTES_DATA) {
        state.items = JSON.parse(JSON.stringify(window.INITIAL_ROUTES_DATA));
      }
    }
  }

  function saveLocalData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  }

  function loadDaysAndRoutes() {
    try {
      const storedDays = localStorage.getItem(STORAGE_DAYS_KEY);
      const storedRoutes = localStorage.getItem(STORAGE_ROUTES_KEY);

      if (storedDays) {
        state.days = JSON.parse(storedDays);
      } else {
        const daysInItems = Array.from(new Set(state.items.map(it => it.day).filter(Boolean)));
        state.days = daysInItems.length > 0 ? daysInItems : [...DEFAULT_DAYS];
      }

      if (storedRoutes) {
        state.routesByDay = JSON.parse(storedRoutes);
      } else {
        const routesObj = JSON.parse(JSON.stringify(DEFAULT_ROUTES_BY_DAY));
        state.items.forEach(it => {
          if (it.day && it.route_name) {
            if (!routesObj[it.day]) routesObj[it.day] = [];
            if (!routesObj[it.day].includes(it.route_name)) {
              routesObj[it.day].push(it.route_name);
            }
          }
        });
        state.routesByDay = routesObj;
      }

      // Ensure every day has an array of routes
      state.days.forEach(d => {
        if (!state.routesByDay[d] || !Array.isArray(state.routesByDay[d]) || state.routesByDay[d].length === 0) {
          state.routesByDay[d] = ['สาย 1'];
        }
      });

      // Ensure activeDay is valid
      if (state.activeDay !== 'all' && !state.days.includes(state.activeDay)) {
        state.activeDay = state.days[0] || 'all';
      }

      saveDaysAndRoutes(false);
    } catch (e) {
      console.error('Failed to load days/routes:', e);
      state.days = [...DEFAULT_DAYS];
      state.routesByDay = JSON.parse(JSON.stringify(DEFAULT_ROUTES_BY_DAY));
    }
  }

  function saveDaysAndRoutes(syncToCloud = true) {
    try {
      localStorage.setItem(STORAGE_DAYS_KEY, JSON.stringify(state.days));
      localStorage.setItem(STORAGE_ROUTES_KEY, JSON.stringify(state.routesByDay));

      if (syncToCloud && state.apiAvailable) {
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days: state.days, routesByDay: state.routesByDay })
        }).catch(err => console.warn('Cloud config sync error:', err));
      }
    } catch (e) {
      console.error('Failed to save days/routes:', e);
    }
  }

  async function checkCloudflareApi() {
    try {
      const res = await fetch('/api/stats', { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          state.apiAvailable = true;
          if (el.dataSourceBadge) {
            el.dataSourceBadge.textContent = 'Cloudflare D1 เชื่อมต่อแล้ว';
            el.dataSourceBadge.className = 'text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm';
          }
          if (el.cfStatusText) {
            el.cfStatusText.textContent = 'เชื่อมต่อ Cloudflare D1 สำเร็จ';
            el.cfStatusText.className = 'text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white';
          }
          if (el.cfStatusDesc) {
            el.cfStatusDesc.textContent = `ระบบกำลังทำงานผ่าน Cloudflare D1 SQL Database (${json.data.total} รายการบน Cloud)`;
          }

          // Fetch saved days and routes config from Cloudflare D1
          try {
            const cfgRes = await fetch('/api/config');
            if (cfgRes.ok) {
              const cfgData = await cfgRes.json();
              if (cfgData.success && cfgData.data && Array.isArray(cfgData.data.days)) {
                state.days = cfgData.data.days;
                state.routesByDay = cfgData.data.routesByDay || state.routesByDay;
                saveDaysAndRoutes(false);
              }
            }
          } catch (_) {}
          
          // Fetch latest items from Cloudflare D1
          const itemsRes = await fetch('/api/items');
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            if (itemsData.success && Array.isArray(itemsData.data) && itemsData.data.length > 0) {
              state.items = itemsData.data;
              saveLocalData();
              loadDaysAndRoutes();
            }
          }
          return;
        }
      }
    } catch (e) {
      // Local mode fallback
    }
    state.apiAvailable = false;
    if (el.dataSourceBadge) el.dataSourceBadge.textContent = 'Local Mode (พร้อมใช้งาน)';
  }

  // ==================== RENDERING LOGIC ====================
  function renderDayTabs() {
    const countsByDay = {};
    state.days.forEach(d => countsByDay[d] = 0);
    state.items.forEach(it => {
      if (countsByDay[it.day] !== undefined) countsByDay[it.day]++;
    });

    let html = `
      <button data-day="all" class="day-tab px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
        state.activeDay === 'all'
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }">
        ทั้งหมด <span class="ml-1 opacity-80 text-[11px]">(${state.items.length})</span>
      </button>
    `;

    state.days.forEach(day => {
      const active = state.activeDay === day;
      const count = countsByDay[day] || 0;
      html += `
        <button data-day="${day}" class="day-tab px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
          active
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }">
          วัน${day} <span class="ml-1 ${active ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'} px-1.5 py-0.2 rounded-full text-[10px]">${count}</span>
        </button>
      `;
    });

    el.dayTabsContainer.innerHTML = html;
  }

  function renderRoutePills() {
    let availableRoutes = [];
    if (state.activeDay === 'all') {
      const allRoutes = new Set();
      state.days.forEach(d => {
        (state.routesByDay[d] || []).forEach(r => allRoutes.add(r));
      });
      availableRoutes = Array.from(allRoutes);
    } else {
      availableRoutes = state.routesByDay[state.activeDay] || ['สาย 1'];
    }

    const routeCounts = {};
    availableRoutes.forEach(r => routeCounts[r] = 0);
    let totalInDay = 0;

    state.items.forEach(it => {
      if (state.activeDay === 'all' || it.day === state.activeDay) {
        totalInDay++;
        if (routeCounts[it.route_name] !== undefined) {
          routeCounts[it.route_name]++;
        }
      }
    });

    let html = `
      <button data-route="all" class="route-pill px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
        state.activeRoute === 'all'
          ? 'bg-slate-800 text-white shadow-xs font-semibold'
          : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
      }">
        ทุกสายส่ง <span class="ml-1 text-[10px] opacity-75">(${totalInDay})</span>
      </button>
    `;

    availableRoutes.forEach(route => {
      const active = state.activeRoute === route;
      const count = routeCounts[route] || 0;
      html += `
        <button data-route="${route}" class="route-pill px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
          active
            ? 'bg-slate-800 text-white shadow-xs font-semibold'
            : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
        }">
          📍 ${route} <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${active ? 'bg-slate-700 text-slate-200' : 'bg-slate-200/80 text-slate-600'}">${count}</span>
        </button>
      `;
    });

    el.routePillsContainer.innerHTML = html;
  }

  function getFilteredAndSortedItems() {
    let filtered = state.items.filter(item => {
      if (state.activeDay !== 'all' && item.day !== state.activeDay) {
        return false;
      }
      if (state.activeRoute !== 'all' && item.route_name !== state.activeRoute) {
        return false;
      }
      if (state.paymentFilter === 'transfer') {
        if (!item.remark || !item.remark.includes('โอน')) return false;
      } else if (state.paymentFilter === 'cash') {
        if (item.remark && item.remark.includes('โอน')) return false;
      }
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase().trim();
        const matchName = item.customer_name && item.customer_name.toLowerCase().includes(q);
        const matchCode = item.customer_code && String(item.customer_code).toLowerCase().includes(q);
        const matchRemark = item.remark && item.remark.toLowerCase().includes(q);
        const matchRoute = item.route_name && item.route_name.toLowerCase().includes(q);
        const matchDay = item.day && item.day.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchRemark && !matchRoute && !matchDay) {
          return false;
        }
      }
      return true;
    });

    const [sortField, sortOrder] = state.sortBy.split('-');
    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'sequence' || sortField === 'boxes' || sortField === 'amount') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (sortField === 'customer_code') {
        valA = String(valA || '');
        valB = String(valB || '');
        return sortOrder === 'asc' 
          ? valA.localeCompare(valB, undefined, { numeric: true }) 
          : valB.localeCompare(valA, undefined, { numeric: true });
      } else {
        valA = String(valA || '');
        valB = String(valB || '');
        return sortOrder === 'asc' 
          ? valA.localeCompare(valB, 'th') 
          : valB.localeCompare(valA, 'th');
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return filtered;
  }

  function renderTable() {
    const items = getFilteredAndSortedItems();

    let title = state.activeDay === 'all' ? 'ทุกวัน' : `วัน${state.activeDay}`;
    if (state.activeRoute !== 'all') {
      title += ` - ${state.activeRoute}`;
    } else {
      title += ' (ทุกสายส่ง)';
    }
    el.tableTitle.textContent = title;
    el.tableCountBadge.textContent = `${items.length} รายการ`;

    if (items.length === 0) {
      el.tableBody.innerHTML = '';
      el.emptyState.classList.remove('hidden');
      updateSelectionUI();
      return;
    }

    el.emptyState.classList.add('hidden');

    const isReorderActive = state.reorderMode && state.activeDay !== 'all' && state.activeRoute !== 'all';

    let html = '';
    items.forEach((item) => {
      const isSelected = state.selectedItemIds.has(item.id);
      const isTransfer = item.remark && item.remark.includes('โอน');
      const remarkBadge = isTransfer
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
             <i data-lucide="credit-card" class="w-3 h-3 mr-1"></i> โอน
           </span>`
        : item.remark
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
               ${escapeHtml(item.remark)}
             </span>`
          : `<span class="text-xs text-slate-300">-</span>`;

      const highlightedName = highlightSearch(escapeHtml(item.customer_name), state.searchQuery);
      const highlightedCode = highlightSearch(escapeHtml(item.customer_code), state.searchQuery);

      const boxesDisplay = item.boxes != null && item.boxes !== ''
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">📦 ${item.boxes}</span>`
        : `<span class="text-xs text-slate-300">-</span>`;

      const amountDisplay = item.amount != null && item.amount !== ''
        ? `<span class="font-semibold text-xs text-amber-700">฿${Number(item.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`
        : `<span class="text-xs text-slate-300">-</span>`;

      html += `
        <tr class="hover:bg-indigo-50/40 transition-colors ${isSelected ? 'row-selected' : ''} ${isReorderActive ? 'draggable-row' : ''}" 
            data-id="${item.id}" 
            data-seq="${item.sequence}"
            ${isReorderActive ? 'draggable="true"' : ''}>
          
          <!-- Selection Checkbox -->
          <td class="py-3 px-3 text-center chk-col">
            <input type="checkbox" class="custom-chk row-select-chk" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
          </td>

          <!-- Sequence / Handle -->
          <td class="py-3 px-4 text-center">
            ${isReorderActive 
              ? `<div class="flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-grab" title="ลากเพื่อย้ายลำดับ">
                   <i data-lucide="grip-vertical" class="w-4 h-4 mr-1"></i>
                   <span class="font-bold text-xs text-indigo-700">${item.sequence}</span>
                 </div>`
              : `<span class="inline-block w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs leading-6 text-center">
                   ${item.sequence}
                 </span>`
            }
          </td>

          <!-- Customer Code -->
          <td class="py-3 px-4 font-mono font-semibold text-xs text-slate-700 whitespace-nowrap">
            <button class="btn-copy-code inline-flex items-center gap-1 hover:text-indigo-600 transition-colors" data-code="${escapeHtml(item.customer_code)}" title="คลิกเพื่อคัดลอกรหัส">
              <span>${highlightedCode}</span>
              <i data-lucide="copy" class="w-3 h-3 opacity-40 hover:opacity-100"></i>
            </button>
          </td>

          <!-- Customer Name -->
          <td class="py-3 px-4 font-medium text-slate-900 text-sm">
            ${highlightedName}
          </td>

          <!-- Payment Remark -->
          <td class="py-3 px-4 text-center whitespace-nowrap">
            ${remarkBadge}
          </td>

          <!-- Boxes -->
          <td class="py-3 px-4 text-center whitespace-nowrap hidden md:table-cell">
            ${boxesDisplay}
          </td>

          <!-- Amount -->
          <td class="py-3 px-4 text-center whitespace-nowrap hidden md:table-cell">
            ${amountDisplay}
          </td>

          <!-- Route / Day info -->
          <td class="py-3 px-4 text-xs text-slate-500 hidden sm:table-cell whitespace-nowrap">
            <span class="font-medium text-slate-700">${item.day}</span> • <span>${item.route_name}</span>
          </td>

          <!-- Actions -->
          <td class="py-3 px-4 text-center action-buttons-col whitespace-nowrap">
            <div class="flex items-center justify-center gap-1">
              <button class="btn-move-up p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" data-id="${item.id}" title="เลื่อนขึ้น">
                <i data-lucide="chevron-up" class="w-4 h-4"></i>
              </button>
              <button class="btn-move-down p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" data-id="${item.id}" title="เลื่อนลง">
                <i data-lucide="chevron-down" class="w-4 h-4"></i>
              </button>
              <button class="btn-edit-item p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" data-id="${item.id}" title="แก้ไขข้อมูล">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button class="btn-delete-item p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" data-id="${item.id}" title="ลบร้านค้านี้">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>

        </tr>
      `;
    });

    el.tableBody.innerHTML = html;
    refreshIcons();
    updateSelectionUI();

    if (isReorderActive) {
      bindDragAndDropEvents();
    }
  }

  function updateStats() {
    const currentItems = getFilteredAndSortedItems();
    const currentCount = currentItems.length;
    const transferCount = currentItems.filter(it => it.remark && it.remark.includes('โอน')).length;
    const cashCount = currentCount - transferCount;

    if (el.statCurrentCount) el.statCurrentCount.textContent = currentCount.toLocaleString();
    if (el.statTransferCount) el.statTransferCount.textContent = transferCount.toLocaleString();
    if (el.statCashCount) el.statCashCount.textContent = cashCount.toLocaleString();
    if (el.statTotalSystem) el.statTotalSystem.textContent = state.items.length.toLocaleString();
  }

  // ==================== SELECTION & BATCH ACTIONS ====================
  function updateSelectionUI() {
    const visibleItems = getFilteredAndSortedItems();
    const count = state.selectedItemIds.size;

    if (el.selectedCount) el.selectedCount.textContent = count.toLocaleString();
    if (el.printSelectedCount) el.printSelectedCount.textContent = count.toLocaleString();

    // Show/Hide Floating Action Bar
    if (el.selectionActionBar) {
      if (count > 0) {
        el.selectionActionBar.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
        el.selectionActionBar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
      } else {
        el.selectionActionBar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        el.selectionActionBar.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
      }
    }

    // Master Checkbox State
    if (el.chkSelectAll) {
      if (visibleItems.length === 0) {
        el.chkSelectAll.checked = false;
        el.chkSelectAll.indeterminate = false;
      } else {
        const visibleSelectedCount = visibleItems.filter(it => state.selectedItemIds.has(it.id)).length;
        if (visibleSelectedCount === visibleItems.length) {
          el.chkSelectAll.checked = true;
          el.chkSelectAll.indeterminate = false;
        } else if (visibleSelectedCount > 0) {
          el.chkSelectAll.checked = false;
          el.chkSelectAll.indeterminate = true;
        } else {
          el.chkSelectAll.checked = false;
          el.chkSelectAll.indeterminate = false;
        }
      }
    }

    // Update Top Print Button Text & Style
    const topPrintText = document.getElementById('top-print-btn-text');
    if (topPrintText && el.btnPrintRoute) {
      if (count > 0) {
        topPrintText.textContent = `พิมพ์ใบส่งของ (${count} ร้าน)`;
        el.btnPrintRoute.className = 'bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-2 rounded-lg text-sm flex items-center gap-1.5 shadow-sm transition-all active:scale-95';
      } else {
        topPrintText.textContent = 'พิมพ์ใบส่งของ';
        el.btnPrintRoute.className = 'bg-indigo-700 hover:bg-indigo-600 text-white font-medium px-3.5 py-2 rounded-lg text-sm flex items-center gap-1.5 shadow-sm transition-all active:scale-95';
      }
    }
  }

  function toggleSelectAll(checked) {
    const visibleItems = getFilteredAndSortedItems();
    visibleItems.forEach(item => {
      if (checked) {
        state.selectedItemIds.add(item.id);
      } else {
        state.selectedItemIds.delete(item.id);
      }
    });
    renderTable();
  }

  function toggleSelectItem(id, checked) {
    if (checked) {
      state.selectedItemIds.add(id);
    } else {
      state.selectedItemIds.delete(id);
    }
    renderTable();
  }

  function clearSelection() {
    state.selectedItemIds.clear();
    renderTable();
    showToast('ล้างการเลือกทั้งหมดแล้ว', 'info');
  }

  async function deleteSelectedItems() {
    const count = state.selectedItemIds.size;
    if (count === 0) return;

    if (!confirm(`คุณต้องการลบร้านค้าที่เลือกไว้ทั้งหมด ${count} ร้านใช่หรือไม่?`)) {
      return;
    }

    const idsToDelete = Array.from(state.selectedItemIds);
    state.items = state.items.filter(it => !state.selectedItemIds.has(it.id));
    state.selectedItemIds.clear();

    if (state.apiAvailable) {
      try {
        await fetch('/api/items/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: idsToDelete })
        });
      } catch (err) {
        console.error('Batch delete error:', err);
      }
    }

    saveLocalData();
    renderTable();
    updateStats();
    showToast(`ลบ ${count} ร้านค้าเรียบร้อยแล้ว`, 'success');
  }

  // ==================== DAYS & ROUTES MANAGEMENT ====================
  function openManageDaysRoutesModal() {
    state.manageSelectedDay = state.activeDay !== 'all' ? state.activeDay : (state.days[0] || 'จันทร์');
    renderManageDaysList();
    renderManageRoutesList();
    el.modalManageRoutes.classList.remove('hidden');
    refreshIcons();
  }

  function closeManageDaysRoutesModal() {
    el.modalManageRoutes.classList.add('hidden');
    renderDayTabs();
    renderRoutePills();
    renderTable();
    updateStats();
    updateFormDayAndRouteOptions();
  }

  function renderManageDaysList() {
    let selectHtml = '';
    state.days.forEach(d => {
      selectHtml += `<option value="${d}" ${state.manageSelectedDay === d ? 'selected' : ''}>วัน${d}</option>`;
    });
    if (el.selectManageDay) el.selectManageDay.innerHTML = selectHtml;

    let listHtml = '';
    state.days.forEach(day => {
      const storeCount = state.items.filter(it => it.day === day).length;
      const routeCount = (state.routesByDay[day] || []).length;
      listHtml += `
        <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs hover:border-indigo-200 transition-colors">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
            <div>
              <span class="font-bold text-xs text-slate-800">วัน${escapeHtml(day)}</span>
              <span class="text-[10px] text-slate-400 block">${routeCount} สาย (${storeCount} ร้าน)</span>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button class="btn-rename-day p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" data-day="${escapeHtml(day)}" title="เปลี่ยนชื่อวัน">
              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            </button>
            <button class="btn-delete-day p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" data-day="${escapeHtml(day)}" title="ลบวัน">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    });
    if (el.daysManagerList) el.daysManagerList.innerHTML = listHtml;
    refreshIcons();
  }

  function renderManageRoutesList() {
    const day = state.manageSelectedDay;
    const routes = state.routesByDay[day] || [];

    let listHtml = '';
    if (routes.length === 0) {
      listHtml = `<div class="text-xs text-slate-400 text-center py-4">ยังไม่มีสายส่งในวันนี้</div>`;
    } else {
      routes.forEach(route => {
        const storeCount = state.items.filter(it => it.day === day && it.route_name === route).length;
        listHtml += `
          <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-slate-800">📍 ${escapeHtml(route)}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">${storeCount} ร้านค้า</span>
            </div>
            <div class="flex items-center gap-1">
              <button class="btn-rename-route p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" data-day="${escapeHtml(day)}" data-route="${escapeHtml(route)}" title="เปลี่ยนชื่อสายส่ง">
                <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
              </button>
              <button class="btn-delete-route p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" data-day="${escapeHtml(day)}" data-route="${escapeHtml(route)}" title="ลบสายส่ง">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `;
      });
    }
    if (el.routesManagerList) el.routesManagerList.innerHTML = listHtml;
    refreshIcons();
  }

  function addDay(dayName) {
    let cleanName = dayName.trim().replace(/^วัน/, '');
    if (!cleanName) {
      showToast('กรุณากรอกชื่อวัน', 'error');
      return;
    }
    if (state.days.includes(cleanName)) {
      showToast(`มีวัน "${cleanName}" อยู่ในระบบแล้ว`, 'error');
      return;
    }

    state.days.push(cleanName);
    if (!state.routesByDay[cleanName]) {
      state.routesByDay[cleanName] = ['สาย 1'];
    }

    state.manageSelectedDay = cleanName;
    saveDaysAndRoutes(true);
    renderDayTabs();
    renderRoutePills();
    renderTable();
    updateStats();
    renderManageDaysList();
    renderManageRoutesList();
    updateFormDayAndRouteOptions();
    showToast(`เพิ่มวัน "${cleanName}" เรียบร้อยแล้ว`, 'success');
  }

  async function renameDay(oldName) {
    const newNameRaw = prompt(`เปลี่ยนชื่อวัน "${oldName}" เป็น:`, oldName);
    if (newNameRaw === null) return;
    const newName = newNameRaw.trim().replace(/^วัน/, '');
    if (!newName || newName === oldName) return;

    if (state.days.includes(newName)) {
      showToast(`มีวัน "${newName}" อยู่แล้ว`, 'error');
      return;
    }

    const idx = state.days.indexOf(oldName);
    if (idx !== -1) {
      state.days[idx] = newName;
    }
    state.routesByDay[newName] = state.routesByDay[oldName] || ['สาย 1'];
    delete state.routesByDay[oldName];

    // Update matching items
    state.items.forEach(it => {
      if (it.day === oldName) {
        it.day = newName;
        it.sheet_name = `${newName}${it.route_name.replace('สาย ', '').replace('สำรอง', 'สำรอง')}`;
      }
    });

    if (state.activeDay === oldName) state.activeDay = newName;
    if (state.manageSelectedDay === oldName) state.manageSelectedDay = newName;

    if (state.apiAvailable) {
      try {
        await fetch('/api/days', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_day: oldName, new_day: newName })
        });
      } catch (err) {
        console.error('Rename day API error:', err);
      }
    }

    saveDaysAndRoutes(true);
    saveLocalData();
    renderDayTabs();
    renderRoutePills();
    renderTable();
    updateStats();
    renderManageDaysList();
    renderManageRoutesList();
    updateFormDayAndRouteOptions();
    showToast(`เปลี่ยนชื่อวันเป็น "${newName}" เรียบร้อยแล้ว`, 'success');
  }

  async function deleteDay(dayName) {
    const storesInDay = state.items.filter(it => it.day === dayName).length;
    let msg = `คุณต้องการลบวัน "${dayName}" ออกจากระบบใช่หรือไม่?`;
    if (storesInDay > 0) {
      msg = `⚠️ วัน "${dayName}" มีร้านค้าอยู่ทั้งหมด ${storesInDay} ร้านค้า!\nหากลบ ข้อมูลร้านค้าในวันนี้ทั้งหมดจะถูกลบด้วย คุณแน่ใจหรือไม่?`;
    }

    if (!confirm(msg)) return;

    state.days = state.days.filter(d => d !== dayName);
    delete state.routesByDay[dayName];
    state.items = state.items.filter(it => it.day !== dayName);

    if (state.days.length === 0) {
      state.days = ['จันทร์'];
      state.routesByDay['จันทร์'] = ['สาย 1'];
    }

    if (state.activeDay === dayName) state.activeDay = state.days[0] || 'all';
    state.manageSelectedDay = state.days[0] || 'จันทร์';

    if (state.apiAvailable) {
      try {
        await fetch(`/api/days?day=${encodeURIComponent(dayName)}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Delete day API error:', err);
      }
    }

    saveDaysAndRoutes(true);
    saveLocalData();
    renderDayTabs();
    renderRoutePills();
    renderTable();
    updateStats();
    renderManageDaysList();
    renderManageRoutesList();
    updateFormDayAndRouteOptions();
    showToast(`ลบวัน "${dayName}" เรียบร้อยแล้ว`, 'info');
  }

  function addRoute(dayName, routeName) {
    let cleanName = routeName.trim();
    if (!cleanName) {
      showToast('กรุณากรอกชื่อสายส่ง', 'error');
      return;
    }

    if (!state.routesByDay[dayName]) {
      state.routesByDay[dayName] = [];
    }

    if (state.routesByDay[dayName].includes(cleanName)) {
      showToast(`มีสายส่ง "${cleanName}" ในวัน${dayName} อยู่แล้ว`, 'error');
      return;
    }

    state.routesByDay[dayName].push(cleanName);
    saveDaysAndRoutes(true);
    renderRoutePills();
    renderTable();
    updateStats();
    renderManageRoutesList();
    updateFormDayAndRouteOptions();
    showToast(`เพิ่มสายส่ง "${cleanName}" ในวัน${dayName} แล้ว`, 'success');
  }

  async function renameRoute(dayName, oldRoute) {
    const newRouteRaw = prompt(`เปลี่ยนชื่อสายส่ง "${oldRoute}" (วัน${dayName}) เป็น:`, oldRoute);
    if (newRouteRaw === null) return;
    const newRoute = newRouteRaw.trim();
    if (!newRoute || newRoute === oldRoute) return;

    const routes = state.routesByDay[dayName] || [];
    if (routes.includes(newRoute)) {
      showToast(`มีสายส่ง "${newRoute}" ในวัน${dayName} อยู่แล้ว`, 'error');
      return;
    }

    const idx = routes.indexOf(oldRoute);
    if (idx !== -1) {
      routes[idx] = newRoute;
    }

    // Update matching items
    state.items.forEach(it => {
      if (it.day === dayName && it.route_name === oldRoute) {
        it.route_name = newRoute;
        it.sheet_name = `${dayName}${newRoute.replace('สาย ', '').replace('สำรอง', 'สำรอง')}`;
      }
    });

    if (state.activeRoute === oldRoute) state.activeRoute = newRoute;

    if (state.apiAvailable) {
      try {
        await fetch('/api/routes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day: dayName, old_route: oldRoute, new_route: newRoute })
        });
      } catch (err) {
        console.error('Rename route API error:', err);
      }
    }

    saveDaysAndRoutes(true);
    saveLocalData();
    renderRoutePills();
    renderTable();
    updateStats();
    renderManageRoutesList();
    updateFormDayAndRouteOptions();
    showToast(`เปลี่ยนชื่อสายส่งเป็น "${newRoute}" เรียบร้อยแล้ว`, 'success');
  }

  async function deleteRoute(dayName, routeName) {
    const storesInRoute = state.items.filter(it => it.day === dayName && it.route_name === routeName).length;
    let msg = `คุณต้องการลบสายส่ง "${routeName}" (วัน${dayName}) ใช่หรือไม่?`;
    if (storesInRoute > 0) {
      msg = `⚠️ สายส่ง "${routeName}" (วัน${dayName}) มีร้านค้าอยู่ทั้งหมด ${storesInRoute} ร้านค้า!\nหากลบ ข้อมูลร้านค้าในสายนี้ทั้งหมดจะถูกลบด้วย คุณแน่ใจหรือไม่?`;
    }

    if (!confirm(msg)) return;

    state.routesByDay[dayName] = (state.routesByDay[dayName] || []).filter(r => r !== routeName);
    if (state.routesByDay[dayName].length === 0) {
      state.routesByDay[dayName] = ['สาย 1'];
    }

    state.items = state.items.filter(it => !(it.day === dayName && it.route_name === routeName));

    if (state.activeRoute === routeName) {
      state.activeRoute = state.routesByDay[dayName][0] || 'all';
    }

    if (state.apiAvailable) {
      try {
        await fetch(`/api/routes?day=${encodeURIComponent(dayName)}&route_name=${encodeURIComponent(routeName)}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Delete route API error:', err);
      }
    }

    saveDaysAndRoutes(true);
    saveLocalData();
    renderRoutePills();
    renderTable();
    updateStats();
    renderManageRoutesList();
    updateFormDayAndRouteOptions();
    showToast(`ลบสายส่ง "${routeName}" เรียบร้อยแล้ว`, 'info');
  }

  function updateFormDayAndRouteOptions() {
    if (!el.formDay || !el.formRoute) return;

    const currentDay = el.formDay.value || state.activeDay || state.days[0];
    let daysHtml = '';
    state.days.forEach(d => {
      daysHtml += `<option value="${d}" ${d === currentDay ? 'selected' : ''}>วัน${d}</option>`;
    });
    el.formDay.innerHTML = daysHtml;

    updateFormRouteOptions();
  }

  function updateFormRouteOptions() {
    if (!el.formDay || !el.formRoute) return;
    const selDay = el.formDay.value;
    const routes = state.routesByDay[selDay] || ['สาย 1'];
    const currentRoute = el.formRoute.value;

    let routesHtml = '';
    routes.forEach(r => {
      routesHtml += `<option value="${r}" ${r === currentRoute ? 'selected' : ''}>${r}</option>`;
    });
    el.formRoute.innerHTML = routesHtml;
  }

  // ==================== DRAG & DROP REORDERING ====================
  function bindDragAndDropEvents() {
    const rows = el.tableBody.querySelectorAll('.draggable-row');
    rows.forEach(row => {
      row.addEventListener('dragstart', handleDragStart);
      row.addEventListener('dragover', handleDragOver);
      row.addEventListener('dragleave', handleDragLeave);
      row.addEventListener('drop', handleDrop);
      row.addEventListener('dragend', handleDragEnd);
    });
  }

  function handleDragStart(e) {
    state.draggedItemId = Number(this.getAttribute('data-id'));
    this.classList.add('opacity-50', 'bg-indigo-100');
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('border-t-2', 'border-indigo-600');
  }

  function handleDragLeave() {
    this.classList.remove('border-t-2', 'border-indigo-600');
  }

  function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('border-t-2', 'border-indigo-600');
    const targetId = Number(this.getAttribute('data-id'));
    if (state.draggedItemId === targetId) return;

    reorderItem(state.draggedItemId, targetId);
  }

  function handleDragEnd() {
    this.classList.remove('opacity-50', 'bg-indigo-100');
    const rows = el.tableBody.querySelectorAll('.draggable-row');
    rows.forEach(row => row.classList.remove('border-t-2', 'border-indigo-600'));
  }

  function reorderItem(sourceId, targetId) {
    const currentItems = getFilteredAndSortedItems();
    const srcIndex = currentItems.findIndex(it => it.id === sourceId);
    const tgtIndex = currentItems.findIndex(it => it.id === targetId);
    if (srcIndex === -1 || tgtIndex === -1) return;

    const [movedItem] = currentItems.splice(srcIndex, 1);
    currentItems.splice(tgtIndex, 0, movedItem);

    currentItems.forEach((item, index) => {
      item.sequence = index + 1;
      const globalItem = state.items.find(it => it.id === item.id);
      if (globalItem) {
        globalItem.sequence = index + 1;
      }
    });

    state.hasUnsavedReorder = true;
    el.reorderSaveBanner.classList.remove('hidden');

    saveLocalData();
    renderTable();
    updateStats();
  }

  function moveItemStep(id, direction) {
    const currentItems = getFilteredAndSortedItems();
    const idx = currentItems.findIndex(it => it.id === id);
    if (idx === -1) return;

    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= currentItems.length) return;

    const targetItem = currentItems[targetIdx];
    reorderItem(id, targetItem.id);
  }

  async function saveReorderToBackend() {
    if (!state.hasUnsavedReorder) return;

    saveLocalData();

    if (state.apiAvailable) {
      try {
        const reorderPayload = state.items.map(it => ({ id: it.id, sequence: it.sequence }));
        const res = await fetch('/api/items/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: reorderPayload })
        });
        if (res.ok) {
          showToast('บันทึกการจัดลำดับลงระบบเรียบร้อยแล้ว', 'success');
        } else {
          showToast('บันทึกในเครื่องแล้ว (คลาวด์ตอบสนองผิดพลาด)', 'info');
        }
      } catch (e) {
        showToast('บันทึกในเครื่องแล้ว (ออฟไลน์)', 'info');
      }
    } else {
      showToast('บันทึกลำดับในเบราว์เซอร์เรียบร้อยแล้ว', 'success');
    }

    state.hasUnsavedReorder = false;
    el.reorderSaveBanner.classList.add('hidden');
    renderTable();
    updateStats();
  }

  // ==================== MODAL FORM (ADD/EDIT) ====================
  function openAddModal() {
    el.modalTitle.innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 text-indigo-600"></i><span>เพิ่มร้านค้าใหม่</span>`;
    el.formItemId.value = '';
    
    updateFormDayAndRouteOptions();
    if (state.activeDay !== 'all') el.formDay.value = state.activeDay;
    updateFormRouteOptions();
    if (state.activeRoute !== 'all') el.formRoute.value = state.activeRoute;
    
    const countInRoute = state.items.filter(it => it.day === el.formDay.value && it.route_name === el.formRoute.value).length;
    el.formSequence.value = countInRoute + 1;
    
    el.formCode.value = '';
    el.formName.value = '';
    el.formRemark.value = '';
    el.formBoxes.value = '';
    el.formAmount.value = '';
    
    el.modalItem.classList.remove('hidden');
    refreshIcons();
    setTimeout(() => el.formCode.focus(), 50);
  }

  function openEditModal(id) {
    const item = state.items.find(it => it.id === id);
    if (!item) return;

    el.modalTitle.innerHTML = `<i data-lucide="edit-3" class="w-5 h-5 text-amber-600"></i><span>แก้ไขข้อมูลร้านค้า</span>`;
    el.formItemId.value = item.id;

    updateFormDayAndRouteOptions();
    el.formDay.value = item.day;
    updateFormRouteOptions();
    el.formRoute.value = item.route_name;
    
    el.formSequence.value = item.sequence;
    el.formCode.value = item.customer_code;
    el.formName.value = item.customer_name;
    el.formRemark.value = item.remark || '';
    el.formBoxes.value = item.boxes != null ? item.boxes : '';
    el.formAmount.value = item.amount != null ? item.amount : '';

    el.modalItem.classList.remove('hidden');
    refreshIcons();
    setTimeout(() => el.formName.focus(), 50);
  }

  function closeModal() {
    el.modalItem.classList.add('hidden');
    el.itemForm.reset();
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const id = el.formItemId.value ? Number(el.formItemId.value) : null;
    const day = el.formDay.value;
    const route_name = el.formRoute.value;
    const sequence = Number(el.formSequence.value) || 1;
    const customer_code = el.formCode.value.trim();
    const customer_name = el.formName.value.trim();
    const remark = el.formRemark.value.trim();
    const boxes = el.formBoxes.value !== '' ? Number(el.formBoxes.value) : null;
    const amount = el.formAmount.value !== '' ? parseFloat(el.formAmount.value) : null;
    const sheet_name = `${day}${route_name.replace('สาย ', '').replace('สำรอง', 'สำรอง')}`;

    if (!customer_name || !customer_code) {
      showToast('กรุณากรอกรหัสลูกค้าและชื่อร้านค้า', 'error');
      return;
    }

    if (id) {
      // UPDATE
      const itemIndex = state.items.findIndex(it => it.id === id);
      if (itemIndex !== -1) {
        state.items[itemIndex] = {
          ...state.items[itemIndex],
          day,
          route_name,
          sheet_name,
          sequence,
          customer_code,
          customer_name,
          remark,
          boxes,
          amount
        };

        if (state.apiAvailable) {
          try {
            await fetch(`/api/items/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(state.items[itemIndex])
            });
          } catch (err) {
            console.error('API update failed:', err);
          }
        }

        saveLocalData();
        showToast(`แก้ไขข้อมูล "${customer_name}" เรียบร้อยแล้ว`, 'success');
      }
    } else {
      // CREATE
      const nextId = state.items.length > 0 ? Math.max(...state.items.map(it => it.id || 0)) + 1 : 1;
      const newItem = {
        id: nextId,
        day,
        route_name,
        sheet_name,
        sequence,
        customer_code,
        customer_name,
        remark,
        boxes,
        amount
      };

      state.items.push(newItem);

      if (state.apiAvailable) {
        try {
          const res = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
          });
          if (res.ok) {
            const resData = await res.json();
            if (resData.success && resData.data && resData.data.id) {
              newItem.id = resData.data.id;
            }
          }
        } catch (err) {
          console.error('API create failed:', err);
        }
      }

      saveLocalData();
      showToast(`เพิ่มร้านค้า "${customer_name}" เรียบร้อยแล้ว`, 'success');
    }

    closeModal();
    renderDayTabs();
    renderRoutePills();
    renderTable();
    updateStats();
  }

  async function deleteItem(id) {
    const item = state.items.find(it => it.id === id);
    if (!item) return;

    if (!confirm(`คุณต้องการลบ "${item.customer_name}" (รหัส ${item.customer_code}) ออกจากสายส่งใช่หรือไม่?`)) {
      return;
    }

    state.items = state.items.filter(it => it.id !== id);
    state.selectedItemIds.delete(id);

    if (state.apiAvailable) {
      try {
        await fetch(`/api/items/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error('API delete failed:', err);
      }
    }

    saveLocalData();
    renderTable();
    updateStats();
    showToast(`ลบ "${item.customer_name}" เรียบร้อยแล้ว`, 'info');
  }

  // ==================== PRINT ROUTE SHEET & PREVIEW ====================
  function prepareAndPreview() {
    if (state.selectedItemIds.size === 0) {
      showToast('⚠️ กรุณาติ๊กเลือกเครื่องหมายถูก (☑️) หน้าร้านค้าที่ต้องการพิมพ์ก่อน', 'error');
      return;
    }

    const currentItems = getFilteredAndSortedItems();
    let itemsToPrint = currentItems.filter(it => state.selectedItemIds.has(it.id));
    
    if (itemsToPrint.length === 0) {
      itemsToPrint = state.items.filter(it => state.selectedItemIds.has(it.id));
    }

    if (itemsToPrint.length === 0) {
      showToast('ไม่พบรายการร้านค้าที่เลือกสำหรับพิมพ์', 'error');
      return;
    }

    // Calculate preview summary
    let totalBoxes = 0;
    let totalAmount = 0;
    let transferCount = 0;
    let cashCount = 0;

    let previewRowsHtml = '';
    itemsToPrint.forEach((item, idx) => {
      const isTransfer = item.remark && item.remark.includes('โอน');
      if (isTransfer) transferCount++; else cashCount++;

      const b = item.boxes != null && item.boxes !== '' ? Number(item.boxes) : 0;
      const a = item.amount != null && item.amount !== '' ? parseFloat(item.amount) : 0;
      totalBoxes += b;
      totalAmount += a;

      const paymentText = isTransfer ? 'โอน' : (item.remark || '-');

      previewRowsHtml += `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-2.5 px-3 text-center font-bold text-slate-600">${idx + 1}</td>
          <td class="py-2.5 px-3 font-mono font-bold text-slate-700 text-xs">${escapeHtml(item.customer_code)}</td>
          <td class="py-2.5 px-3 font-medium text-slate-900">
            ${escapeHtml(item.customer_name)}
            ${(state.activeRoute === 'all' || state.activeDay === 'all') ? `<span class="text-xs text-slate-400"> (${item.day} ${item.route_name})</span>` : ''}
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-block px-2 py-0.5 rounded text-xs ${isTransfer ? 'bg-purple-100 text-purple-700 font-semibold' : 'bg-slate-100 text-slate-600'}">
              ${escapeHtml(paymentText)}
            </span>
          </td>
          <td class="py-2.5 px-3 text-center font-bold text-emerald-700">
            ${b > 0 ? b : '-'}
          </td>
          <td class="py-2.5 px-3 text-right font-semibold text-amber-700">
            ${a > 0 ? '฿' + a.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
          </td>
        </tr>
      `;
    });

    if (el.previewCountBadge) el.previewCountBadge.textContent = `${itemsToPrint.length} ร้านค้า`;
    if (el.previewStatStores) el.previewStatStores.textContent = `${itemsToPrint.length} ร้าน`;
    if (el.previewStatBoxes) el.previewStatBoxes.textContent = `${totalBoxes} ลัง`;
    if (el.previewStatAmount) el.previewStatAmount.textContent = `฿${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (el.previewStatTransfer) el.previewStatTransfer.textContent = transferCount;
    if (el.previewStatCash) el.previewStatCash.textContent = cashCount;
    if (el.previewTableBody) el.previewTableBody.innerHTML = previewRowsHtml;

    if (el.modalPrintPreview) {
      el.modalPrintPreview.classList.remove('hidden');
      refreshIcons();
    }
  }

  function executeActualPrint() {
    if (el.modalPrintPreview) el.modalPrintPreview.classList.add('hidden');

    const currentItems = getFilteredAndSortedItems();
    let itemsToPrint = currentItems.filter(it => state.selectedItemIds.has(it.id));
    if (itemsToPrint.length === 0) {
      itemsToPrint = state.items.filter(it => state.selectedItemIds.has(it.id));
    }
    if (itemsToPrint.length === 0) return;

    let dayLabel = state.activeDay === 'all' ? 'ทุกวัน' : `วัน${state.activeDay}`;
    let routeLabel = state.activeRoute === 'all' ? 'ทุกสายส่ง' : state.activeRoute;
    routeLabel += ` (เฉพาะร้านที่เลือก ${itemsToPrint.length} ร้าน)`;

    if (el.printDayTitle) el.printDayTitle.textContent = dayLabel;
    if (el.printRouteTitle) el.printRouteTitle.textContent = routeLabel;
    
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    if (el.printDateTime) el.printDateTime.textContent = `${dateFormatted} ${timeFormatted} น.`;

    let totalBoxes = 0;
    let totalAmount = 0;
    let transferCount = 0;
    let cashCount = 0;

    let printRowsHtml = '';
    itemsToPrint.forEach((item, idx) => {
      const isTransfer = item.remark && item.remark.includes('โอน');
      if (isTransfer) transferCount++; else cashCount++;

      const b = item.boxes != null && item.boxes !== '' ? Number(item.boxes) : 0;
      const a = item.amount != null && item.amount !== '' ? parseFloat(item.amount) : 0;
      totalBoxes += b;
      totalAmount += a;

      const paymentText = isTransfer ? 'โอน' : (item.remark || '-');
      printRowsHtml += `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold;">${escapeHtml(item.customer_code)}</td>
          <td style="text-align: left; font-weight: 500;">
            ${escapeHtml(item.customer_name)}
            ${(state.activeRoute === 'all' || state.activeDay === 'all') ? `<span style="font-size: 8pt; color: #555;"> (${item.day} ${item.route_name})</span>` : ''}
          </td>
          <td style="text-align: center; font-weight: ${isTransfer ? 'bold' : 'normal'};">
            ${escapeHtml(paymentText)}
          </td>
          <td style="text-align: center; font-weight: bold;">
            ${b > 0 ? b : ''}
          </td>
          <td style="text-align: right; font-weight: 500;">
            ${a > 0 ? '฿' + a.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
          </td>
          <td style="text-align: center;">
            <div style="border: 1px solid #aaa; width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;"></div>
          </td>
        </tr>
      `;
    });

    if (el.printTotalCount) el.printTotalCount.textContent = itemsToPrint.length;
    if (el.printTransferCount) el.printTransferCount.textContent = transferCount;
    if (el.printCashCount) el.printCashCount.textContent = cashCount;
    if (el.printTotalBoxes) el.printTotalBoxes.textContent = totalBoxes;
    if (el.printTotalAmount) el.printTotalAmount.textContent = `฿${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (el.printTableBody) el.printTableBody.innerHTML = printRowsHtml;

    setTimeout(() => window.print(), 100);
  }

  // ==================== EXPORT & SEED TOOLS ====================
  function exportToExcel() {
    if (typeof XLSX === 'undefined') {
      showToast('กำลังโหลดโมดูล Excel กรุณาลองใหม่อีกครั้ง', 'error');
      return;
    }

    try {
      const itemsToExport = state.selectedItemIds.size > 0 
        ? state.items.filter(it => state.selectedItemIds.has(it.id))
        : getFilteredAndSortedItems();

      if (itemsToExport.length === 0) {
        showToast('ไม่มีข้อมูลสำหรับส่งออก', 'error');
        return;
      }

      const rows = itemsToExport.map((it, idx) => ({
        'ลำดับ': idx + 1,
        'วันจัดส่ง': it.day,
        'สายส่ง': it.route_name,
        'รหัสลูกค้า': it.customer_code,
        'ชื่อร้านค้า / ลูกค้า': it.customer_name,
        'การชำระเงิน': it.remark || '-',
        'จำนวนลัง': it.boxes != null ? it.boxes : '',
        'ยอดเงิน (บาท)': it.amount != null ? it.amount : ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'สายส่งสินค้า');

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const filename = `รายการสายส่ง_${state.activeDay}_${state.activeRoute}_${dateStr}.xlsx`;

      XLSX.writeFile(workbook, filename);
      showToast(`ส่งออกไฟล์ "${filename}" สำเร็จ`, 'success');
    } catch (e) {
      console.error('Export Excel failed:', e);
      showToast('เกิดข้อผิดพลาดในการส่งออก Excel', 'error');
    }
  }

  async function seedToCloudflare() {
    if (!state.apiAvailable) {
      showToast('ไม่สามารถเชื่อมต่อ Cloudflare D1 ได้ในขณะนี้', 'error');
      return;
    }

    if (!confirm(`คุณต้องการอัปโหลดข้อมูลทั้งหมด (${state.items.length} ร้านค้า) ขึ้น Cloudflare D1 SQL หรือไม่?`)) {
      return;
    }

    try {
      el.btnSeedCf.disabled = true;
      el.btnSeedCf.textContent = 'กำลังอัปโหลด...';

      const res = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: state.items, force: true })
      });

      if (res.ok) {
        const json = await res.json();
        showToast(`อัปโหลดขึ้น Cloudflare D1 สำเร็จ (${json.count} รายการ)`, 'success');
        await checkCloudflareApi();
        saveDaysAndRoutes(true);
      } else {
        showToast('อัปโหลดล้มเหลว กรุณาตรวจสอบการตั้งค่า D1', 'error');
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    } finally {
      el.btnSeedCf.disabled = false;
      el.btnSeedCf.textContent = 'อัปโหลดข้อมูลปัจจุบันขึ้น D1 (Seed)';
    }
  }

  function resetToDefault() {
    if (!confirm('คุณต้องการรีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?\n(ข้อมูลที่แก้ไขเองจะถูกแทนที่ด้วยข้อมูลตั้งต้น)')) {
      return;
    }

    if (window.INITIAL_ROUTES_DATA) {
      state.items = JSON.parse(JSON.stringify(window.INITIAL_ROUTES_DATA));
      state.days = [...DEFAULT_DAYS];
      state.routesByDay = JSON.parse(JSON.stringify(DEFAULT_ROUTES_BY_DAY));
      state.activeDay = 'จันทร์';
      state.activeRoute = 'สาย 1';
      state.selectedItemIds.clear();

      saveLocalData();
      saveDaysAndRoutes(true);
      renderDayTabs();
      renderRoutePills();
      renderTable();
      updateStats();
      updateSelectionUI();
      updateFormDayAndRouteOptions();
      showToast('รีเซ็ตข้อมูลเป็นค่าเริ่มต้นเรียบร้อยแล้ว', 'success');
    }
  }

  // ==================== EVENT BINDINGS ====================
  function bindEvents() {
    // Day tab click
    el.dayTabsContainer.addEventListener('click', e => {
      const btn = e.target.closest('.day-tab');
      if (!btn) return;
      state.activeDay = btn.getAttribute('data-day');
      if (state.activeDay !== 'all') {
        const available = state.routesByDay[state.activeDay] || ['สาย 1'];
        if (state.activeRoute !== 'all' && !available.includes(state.activeRoute)) {
          state.activeRoute = available[0];
        }
      }
      renderDayTabs();
      renderRoutePills();
      renderTable();
      updateStats();
    });

    // Route pill click
    el.routePillsContainer.addEventListener('click', e => {
      const btn = e.target.closest('.route-pill');
      if (!btn) return;
      state.activeRoute = btn.getAttribute('data-route');
      renderRoutePills();
      renderTable();
      updateStats();
    });

    // Search input
    el.searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      if (state.searchQuery) {
        el.btnClearSearch.classList.remove('hidden');
      } else {
        el.btnClearSearch.classList.add('hidden');
      }
      renderTable();
      updateStats();
    });

    el.btnClearSearch.addEventListener('click', () => {
      el.searchInput.value = '';
      state.searchQuery = '';
      el.btnClearSearch.classList.add('hidden');
      renderTable();
      updateStats();
      el.searchInput.focus();
    });

    // Payment filter
    el.paymentFilter.addEventListener('change', e => {
      state.paymentFilter = e.target.value;
      renderTable();
      updateStats();
    });

    // Sort select
    el.sortSelect.addEventListener('change', e => {
      state.sortBy = e.target.value;
      renderTable();
    });

    // Reorder mode toggle
    el.btnToggleReorder.addEventListener('click', () => {
      if (state.activeDay === 'all' || state.activeRoute === 'all') {
        showToast('กรุณาเลือกวันและสายส่งที่ต้องการ ก่อนจัดลำดับ', 'info');
        return;
      }
      state.reorderMode = !state.reorderMode;
      if (state.reorderMode) {
        el.btnToggleReorder.className = 'text-xs bg-indigo-600 text-white font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm';
        el.reorderToggleText.textContent = 'เสร็จสิ้นการจัดลำดับ';
        showToast('เปิดโหมดจัดลำดับ: ลากแถวเพื่อเปลี่ยนลำดับ หรือใช้ปุ่ม ⬆️ ⬇️', 'info');
      } else {
        el.btnToggleReorder.className = 'text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors';
        el.reorderToggleText.textContent = 'จัดลำดับสายส่ง';
      }
      renderTable();
    });

    el.btnSaveReorder.addEventListener('click', saveReorderToBackend);
    el.btnCancelReorder.addEventListener('click', () => {
      loadLocalData();
      state.hasUnsavedReorder = false;
      el.reorderSaveBanner.classList.add('hidden');
      renderTable();
      updateStats();
      showToast('ยกเลิกการเปลี่ยนแปลงลำดับแล้ว', 'info');
    });

    el.btnResetFilters.addEventListener('click', () => {
      state.searchQuery = '';
      el.searchInput.value = '';
      el.btnClearSearch.classList.add('hidden');
      state.paymentFilter = 'all';
      el.paymentFilter.value = 'all';
      state.activeDay = 'all';
      state.activeRoute = 'all';
      renderDayTabs();
      renderRoutePills();
      renderTable();
      updateStats();
    });

    // Select All Checkbox
    if (el.chkSelectAll) {
      el.chkSelectAll.addEventListener('change', e => {
        toggleSelectAll(e.target.checked);
      });
    }

    // Selection Action Bar Events
    if (el.btnPrintSelected) {
      el.btnPrintSelected.addEventListener('click', prepareAndPreview);
    }
    if (el.btnDeleteSelected) {
      el.btnDeleteSelected.addEventListener('click', deleteSelectedItems);
    }
    if (el.btnClearSelection) {
      el.btnClearSelection.addEventListener('click', clearSelection);
    }

    // Manage Days & Routes Modal
    if (el.btnManageDaysRoutes) {
      el.btnManageDaysRoutes.addEventListener('click', openManageDaysRoutesModal);
    }
    if (el.btnQuickAddRoute) {
      el.btnQuickAddRoute.addEventListener('click', () => {
        openManageDaysRoutesModal();
        setTimeout(() => el.inputNewRoute.focus(), 100);
      });
    }
    if (el.btnCloseManageRoutes) {
      el.btnCloseManageRoutes.addEventListener('click', closeManageDaysRoutesModal);
    }
    if (el.btnDoneManageRoutes) {
      el.btnDoneManageRoutes.addEventListener('click', closeManageDaysRoutesModal);
    }

    // Manage Days Actions
    if (el.btnAddDayAction) {
      el.btnAddDayAction.addEventListener('click', () => {
        addDay(el.inputNewDay.value);
        el.inputNewDay.value = '';
      });
    }
    if (el.inputNewDay) {
      el.inputNewDay.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addDay(el.inputNewDay.value);
          el.inputNewDay.value = '';
        }
      });
    }

    if (el.daysManagerList) {
      el.daysManagerList.addEventListener('click', e => {
        const renameBtn = e.target.closest('.btn-rename-day');
        if (renameBtn) {
          const day = renameBtn.getAttribute('data-day');
          renameDay(day);
          return;
        }
        const deleteBtn = e.target.closest('.btn-delete-day');
        if (deleteBtn) {
          const day = deleteBtn.getAttribute('data-day');
          deleteDay(day);
          return;
        }
      });
    }

    // Manage Routes Actions
    if (el.selectManageDay) {
      el.selectManageDay.addEventListener('change', e => {
        state.manageSelectedDay = e.target.value;
        renderManageRoutesList();
      });
    }

    if (el.btnAddRouteAction) {
      el.btnAddRouteAction.addEventListener('click', () => {
        addRoute(state.manageSelectedDay, el.inputNewRoute.value);
        el.inputNewRoute.value = '';
      });
    }
    if (el.inputNewRoute) {
      el.inputNewRoute.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addRoute(state.manageSelectedDay, el.inputNewRoute.value);
          el.inputNewRoute.value = '';
        }
      });
    }

    if (el.routesManagerList) {
      el.routesManagerList.addEventListener('click', e => {
        const renameBtn = e.target.closest('.btn-rename-route');
        if (renameBtn) {
          const day = renameBtn.getAttribute('data-day');
          const route = renameBtn.getAttribute('data-route');
          renameRoute(day, route);
          return;
        }
        const deleteBtn = e.target.closest('.btn-delete-route');
        if (deleteBtn) {
          const day = deleteBtn.getAttribute('data-day');
          const route = deleteBtn.getAttribute('data-route');
          deleteRoute(day, route);
          return;
        }
      });
    }

    // Form Dropdowns
    if (el.formDay) {
      el.formDay.addEventListener('change', updateFormRouteOptions);
    }

    // Add / Edit Modal Events
    el.btnAddItem.addEventListener('click', openAddModal);
    el.btnCloseModal.addEventListener('click', closeModal);
    el.btnCancelModal.addEventListener('click', closeModal);
    el.itemForm.addEventListener('submit', handleFormSubmit);

    // Tools & Cloudflare Modal
    el.btnOpenTools.addEventListener('click', () => {
      el.modalTools.classList.remove('hidden');
      refreshIcons();
    });
    el.btnCloseTools.addEventListener('click', () => el.modalTools.classList.add('hidden'));
    el.btnPingCf.addEventListener('click', checkCloudflareApi);
    el.btnSeedCf.addEventListener('click', seedToCloudflare);
    el.btnResetDefault.addEventListener('click', resetToDefault);
    el.btnExportExcelModal.addEventListener('click', exportToExcel);
    el.btnExportExcel.addEventListener('click', exportToExcel);

    // Print Button (Top bar)
    el.btnPrintRoute.addEventListener('click', prepareAndPreview);

    // Print Preview Modal Events
    if (el.btnClosePreview) {
      el.btnClosePreview.addEventListener('click', () => el.modalPrintPreview.classList.add('hidden'));
    }
    if (el.btnClosePreviewCancel) {
      el.btnClosePreviewCancel.addEventListener('click', () => el.modalPrintPreview.classList.add('hidden'));
    }
    if (el.btnConfirmPrint) {
      el.btnConfirmPrint.addEventListener('click', executeActualPrint);
    }

    // Table delegated actions
    el.tableBody.addEventListener('click', e => {
      const chk = e.target.closest('.row-select-chk');
      if (chk) {
        const id = Number(chk.getAttribute('data-id'));
        toggleSelectItem(id, chk.checked);
        return;
      }

      const copyBtn = e.target.closest('.btn-copy-code');
      if (copyBtn) {
        const code = copyBtn.getAttribute('data-code');
        navigator.clipboard.writeText(code).then(() => {
          showToast(`คัดลอกรหัส "${code}" แล้ว`, 'success');
        });
        return;
      }

      const moveUpBtn = e.target.closest('.btn-move-up');
      if (moveUpBtn) {
        const id = Number(moveUpBtn.getAttribute('data-id'));
        moveItemStep(id, -1);
        return;
      }

      const moveDownBtn = e.target.closest('.btn-move-down');
      if (moveDownBtn) {
        const id = Number(moveDownBtn.getAttribute('data-id'));
        moveItemStep(id, 1);
        return;
      }

      const editBtn = e.target.closest('.btn-edit-item');
      if (editBtn) {
        const id = Number(editBtn.getAttribute('data-id'));
        openEditModal(id);
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-item');
      if (deleteBtn) {
        const id = Number(deleteBtn.getAttribute('data-id'));
        deleteItem(id);
        return;
      }
    });

    // Close modals on outside click
    window.addEventListener('click', e => {
      if (e.target === el.modalItem) closeModal();
      if (e.target === el.modalTools) el.modalTools.classList.add('hidden');
      if (e.target === el.modalManageRoutes) closeManageDaysRoutesModal();
      if (e.target === el.modalPrintPreview) el.modalPrintPreview.classList.add('hidden');
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeModal();
        el.modalTools.classList.add('hidden');
        closeManageDaysRoutesModal();
        if (el.modalPrintPreview) el.modalPrintPreview.classList.add('hidden');
      }
    });
  }

  // ==================== UTILITY HELPERS ====================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white shadow-emerald-200',
      error: 'bg-rose-600 text-white shadow-rose-200',
      info: 'bg-slate-800 text-white shadow-slate-200'
    };

    toast.className = `flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.textContent = message;

    el.toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function highlightSearch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark class="bg-amber-200 text-amber-900 rounded-xs px-0.5">$1</mark>');
  }

  function escapeRegex(string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  function refreshIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  // --- Bootstrap ---
  document.addEventListener('DOMContentLoaded', init);

})();
