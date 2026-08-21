/**
 * Delivery Routes Management WebApp - Application Logic
 * Supports: Full CRUD, Dynamic Days & Routes Management, Store Selection & Batch Printing, 
 * Search, Sorting, Drag-and-drop Reordering, Print View, Cloudflare D1 Database & LocalStorage Dual-Mode
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

    // Print elements
    printRouteTitle: document.getElementById('print-route-title'),
    printDayTitle: document.getElementById('print-day-title'),
    printDateTime: document.getElementById('print-date-time'),
    printTotalCount: document.getElementById('print-total-count'),
    printTransferCount: document.getElementById('print-transfer-count'),
    printCashCount: document.getElementById('print-cash-count'),
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
        // Collect distinct days from items
        const daysInItems = Array.from(new Set(state.items.map(it => it.day).filter(Boolean)));
        state.days = daysInItems.length > 0 ? daysInItems : [...DEFAULT_DAYS];
      }

      if (storedRoutes) {
        state.routesByDay = JSON.parse(storedRoutes);
      } else {
        // Build routes from items & defaults
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

      // Ensure every day in state.days has an entry in state.routesByDay
      state.days.forEach(d => {
        if (!state.routesByDay[d] || !Array.isArray(state.routesByDay[d]) || state.routesByDay[d].length === 0) {
          state.routesByDay[d] = ['สาย 1'];
        }
      });

      // Ensure activeDay is valid
      if (state.activeDay !== 'all' && !state.days.includes(state.activeDay)) {
        state.activeDay = state.days[0] || 'all';
      }

      saveDaysAndRoutes();
    } catch (e) {
      console.error('Failed to load days/routes:', e);
      state.days = [...DEFAULT_DAYS];
      state.routesByDay = JSON.parse(JSON.stringify(DEFAULT_ROUTES_BY_DAY));
    }
  }

  function saveDaysAndRoutes() {
    try {
      localStorage.setItem(STORAGE_DAYS_KEY, JSON.stringify(state.days));
      localStorage.setItem(STORAGE_ROUTES_KEY, JSON.stringify(state.routesByDay));
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
          el.dataSourceBadge.textContent = 'Cloudflare D1 เชื่อมต่อแล้ว';
          el.dataSourceBadge.className = 'text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm';
          el.cfStatusText.textContent = 'เชื่อมต่อ Cloudflare D1 สำเร็จ';
          el.cfStatusText.className = 'text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white';
          el.cfStatusDesc.textContent = `ระบบกำลังทำงานผ่าน Cloudflare D1 SQL Database (${json.data.total} รายการบน Cloud)`;
          
          // Fetch latest items from Cloudflare D1
          const itemsRes = await fetch('/api/items');
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            if (itemsData.success && itemsData.data.length > 0) {
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
    el.dataSourceBadge.textContent = 'Local Mode (พร้อมใช้งาน)';
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
      // Union of all routes across all days
      const allRoutes = new Set();
      state.days.forEach(d => {
        (state.routesByDay[d] || []).forEach(r => allRoutes.add(r));
      });
      availableRoutes = Array.from(allRoutes);
    } else {
      availableRoutes = state.routesByDay[state.activeDay] || ['สาย 1'];
    }

    // Counts for each route in current day
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
      // Day filter
      if (state.activeDay !== 'all' && item.day !== state.activeDay) {
        return false;
      }
      // Route filter
      if (state.activeRoute !== 'all' && item.route_name !== state.activeRoute) {
        return false;
      }
      // Payment filter
      if (state.paymentFilter === 'transfer') {
        if (!item.remark || !item.remark.includes('โอน')) return false;
      } else if (state.paymentFilter === 'cash') {
        if (item.remark && item.remark.includes('โอน')) return false;
      }
      // Search query
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

    // Sorting
    const [sortField, sortOrder] = state.sortBy.split('-');
    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'sequence') {
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

    // Update table header details
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
    items.forEach((item, index) => {
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

          <!-- Route / Day info -->
          <td class="py-3 px-4 text-xs text-slate-500 hidden sm:table-cell whitespace-nowrap">
            <span class="font-medium text-slate-700">${item.day}</span> • <span>${item.route_name}</span>
          </td>

          <!-- Actions -->
          <td class="py-3 px-4 text-center action-buttons-col whitespace-nowrap">
            <div class="flex items-center justify-center gap-1">
              
              <!-- Move Up Button -->
              <button class="btn-move-up p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" data-id="${item.id}" title="เลื่อนขึ้น">
                <i data-lucide="chevron-up" class="w-4 h-4"></i>
              </button>

              <!-- Move Down Button -->
              <button class="btn-move-down p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" data-id="${item.id}" title="เลื่อนลง">
                <i data-lucide="chevron-down" class="w-4 h-4"></i>
              </button>

              <!-- Edit Button -->
              <button class="btn-edit-item p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" data-id="${item.id}" title="แก้ไขข้อมูล">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>

              <!-- Delete Button -->
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

    el.statCurrentCount.textContent = currentCount.toLocaleString();
    el.statTransferCount.textContent = transferCount.toLocaleString();
    el.statCashCount.textContent = cashCount.toLocaleString();
    el.statTotalSystem.textContent = state.items.length.toLocaleString();
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

    // Update row visual class directly for smooth response
    const row = el.tableBody.querySelector(`tr[data-id="${id}"]`);
    if (row) {
      if (checked) {
        row.classList.add('row-selected');
      } else {
        row.classList.remove('row-selected');
      }
    }

    updateSelectionUI();
  }

  function clearSelection() {
    state.selectedItemIds.clear();
    renderTable();
  }

  async function deleteSelectedItems() {
    const count = state.selectedItemIds.size;
    if (count === 0) return;

    if (!confirm(`คุณต้องการลบร้านค้าที่เลือกจำนวน ${count} รายการ ออกจากระบบใช่หรือไม่?`)) {
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
        console.error('Batch delete API failed:', err);
      }
    }

    saveLocalData();
    renderDayTabs();
    renderRoutePills();
    renderTable();
    updateStats();
    showToast(`ลบ ${count} ร้านค้าเรียบร้อยแล้ว`, 'info');
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
    // Populate select dropdown in modal
    let selectHtml = '';
    state.days.forEach(d => {
      selectHtml += `<option value="${d}" ${state.manageSelectedDay === d ? 'selected' : ''}>วัน${d}</option>`;
    });
    el.selectManageDay.innerHTML = selectHtml;

    // Render list of days
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
    el.daysManagerList.innerHTML = listHtml;
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
    el.routesManagerList.innerHTML = listHtml;
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

    saveDaysAndRoutes();
    state.manageSelectedDay = cleanName;
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

    saveDaysAndRoutes();
    saveLocalData();
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

    saveDaysAndRoutes();
    saveLocalData();
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
    saveDaysAndRoutes();
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

    saveDaysAndRoutes();
    saveLocalData();
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

    saveDaysAndRoutes();
    saveLocalData();
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
    const selectedDay = el.formDay.value || state.days[0];
    const routes = state.routesByDay[selectedDay] || ['สาย 1'];
    let routesHtml = '';
    routes.forEach(r => {
      routesHtml += `<option value="${r}">${r}</option>`;
    });
    el.formRoute.innerHTML = routesHtml;
  }

  // ==================== DRAG & DROP AND REORDERING ====================
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
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', state.draggedItemId);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetRow = e.target.closest('.draggable-row');
    if (targetRow && targetRow !== this) {
      targetRow.classList.add('drag-over');
    }
  }

  function handleDragLeave(e) {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    const targetId = Number(this.getAttribute('data-id'));
    if (!state.draggedItemId || state.draggedItemId === targetId) return;

    reorderItems(state.draggedItemId, targetId);
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    el.tableBody.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  }

  function reorderItems(draggedId, targetId) {
    const currentItems = getFilteredAndSortedItems();
    const fromIndex = currentItems.findIndex(it => it.id === draggedId);
    const toIndex = currentItems.findIndex(it => it.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [movedItem] = currentItems.splice(fromIndex, 1);
    currentItems.splice(toIndex, 0, movedItem);

    // Update sequence numbers (1-based)
    currentItems.forEach((it, idx) => {
      it.sequence = idx + 1;
      const globalItem = state.items.find(g => g.id === it.id);
      if (globalItem) {
        globalItem.sequence = idx + 1;
      }
    });

    state.hasUnsavedReorder = true;
    el.reorderSaveBanner.classList.remove('hidden');
    renderTable();
    showToast(`ย้าย "${movedItem.customer_name}" ไปลำดับที่ ${toIndex + 1} แล้ว`, 'info');
  }

  function moveItem(id, direction) {
    const currentItems = getFilteredAndSortedItems();
    const index = currentItems.findIndex(it => it.id === id);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const targetItem = currentItems[index - 1];
      reorderItems(id, targetItem.id);
    } else if (direction === 'down' && index < currentItems.length - 1) {
      const targetItem = currentItems[index + 1];
      reorderItems(id, targetItem.id);
    }
  }

  async function saveReorderToBackend() {
    const currentItems = getFilteredAndSortedItems();
    const payload = currentItems.map(it => ({ id: it.id, sequence: it.sequence }));

    saveLocalData();

    if (state.apiAvailable) {
      try {
        const res = await fetch('/api/items/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payload })
        });
        if (res.ok) {
          showToast('บันทึกลำดับสายส่งขึ้น Cloudflare D1 สำเร็จ!', 'success');
        } else {
          showToast('บันทึกลำดับลงในเครื่องแล้ว (D1 ยังไม่ได้บันทึก)', 'info');
        }
      } catch (err) {
        showToast('บันทึกลำดับลงในเครื่องแล้ว', 'info');
      }
    } else {
      showToast('บันทึกลำดับสายส่งลงในเครื่องแล้ว', 'success');
    }

    state.hasUnsavedReorder = false;
    el.reorderSaveBanner.classList.add('hidden');
  }

  // ==================== STORE CRUD OPERATIONS ====================
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
          remark
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
        remark
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
            if (resData.success && resData.data.id) {
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
    renderDayTabs();
    renderRoutePills();
    renderTable();
    updateStats();
    showToast(`ลบ "${item.customer_name}" เรียบร้อยแล้ว`, 'info');
  }

  // ==================== PRINT ROUTE SHEET ====================
  function prepareAndPrint() {
    if (state.selectedItemIds.size === 0) {
      showToast('⚠️ กรุณาติ๊กเลือกเครื่องหมายถูก (☑️) หน้าร้านค้าที่ต้องการพิมพ์ก่อน', 'error');
      return;
    }

    const currentItems = getFilteredAndSortedItems();
    let itemsToPrint = currentItems.filter(it => state.selectedItemIds.has(it.id));
    
    // If not in current filtered list, get from full items list
    if (itemsToPrint.length === 0) {
      itemsToPrint = state.items.filter(it => state.selectedItemIds.has(it.id));
    }

    if (itemsToPrint.length === 0) {
      showToast('ไม่พบรายการร้านค้าที่เลือกสำหรับพิมพ์', 'error');
      return;
    }

    // Set Header titles
    let dayLabel = state.activeDay === 'all' ? 'ทุกวัน' : `วัน${state.activeDay}`;
    let routeLabel = state.activeRoute === 'all' ? 'ทุกสายส่ง' : state.activeRoute;
    routeLabel += ` (เฉพาะร้านที่เลือก ${itemsToPrint.length} ร้าน)`;

    el.printDayTitle.textContent = dayLabel;
    el.printRouteTitle.textContent = routeLabel;
    
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    el.printDateTime.textContent = `${dateFormatted} ${timeFormatted} น.`;

    const transferCount = itemsToPrint.filter(it => it.remark && it.remark.includes('โอน')).length;
    const cashCount = itemsToPrint.length - transferCount;

    el.printTotalCount.textContent = itemsToPrint.length;
    el.printTransferCount.textContent = transferCount;
    el.printCashCount.textContent = cashCount;

    // Populate Print Table Rows
    let printRowsHtml = '';
    itemsToPrint.forEach((item, idx) => {
      const isTransfer = item.remark && item.remark.includes('โอน');
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
          <td style="text-align: center;"></td>
          <td style="text-align: center;">
            <div style="border: 1px solid #aaa; width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;"></div>
          </td>
        </tr>
      `;
    });

    el.printTableBody.innerHTML = printRowsHtml;

    // Trigger Print
    window.print();
  }

  // ==================== EXPORT & SEED TOOLS ====================
  function exportToExcel() {
    if (typeof XLSX === 'undefined') {
      showToast('กำลังโหลดโมดูล Excel กรุณาลองใหม่อีกครั้ง', 'error');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Group items by sheet_name
      const sheets = {};
      state.items.forEach(item => {
        const sName = item.sheet_name || `${item.day}${item.route_name.replace('สาย ', '').replace('สำรอง', 'สำรอง')}`;
        if (!sheets[sName]) sheets[sName] = [];
        sheets[sName].push({
          'ลำดับ': item.sequence,
          'รหัสลูกค้า': item.customer_code,
          'ชื่อร้านค้า': item.customer_name,
          'หมายเหตุ/ชำระ': item.remark || '',
          'วัน': item.day,
          'สายส่ง': item.route_name
        });
      });

      // Add each sheet
      Object.keys(sheets).forEach(sheetName => {
        const ws = XLSX.utils.json_to_sheet(sheets[sheetName]);
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
      });

      const fileName = `สายส่งสินค้า_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast(`ส่งออกไฟล์ ${fileName} เรียบร้อยแล้ว`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('เกิดข้อผิดพลาดในการส่งออก Excel', 'error');
    }
  }

  async function seedToCloudflare() {
    if (!confirm(`คุณต้องการอัปโหลดข้อมูลทั้งหมด ${state.items.length} รายการขึ้นสู่ Cloudflare D1 Database ใช่หรือไม่?`)) {
      return;
    }

    showToast('กำลังส่งข้อมูลขึ้น Cloudflare D1...', 'info');

    try {
      const res = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, items: state.items })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Seed ข้อมูลขึ้น Cloudflare D1 สำเร็จ (${data.count || state.items.length} รายการ)`, 'success');
        await checkCloudflareApi();
      } else {
        showToast(`ไม่สามารถเชื่อมต่อ D1: ${data.error || 'Binding DB ไม่ถูกต้อง'}`, 'error');
      }
    } catch (err) {
      showToast('ไม่สามารถเชื่อมต่อ API (ยังไม่ได้ deploy บน Cloudflare Pages)', 'error');
    }
  }

  function resetToDefault() {
    if (!confirm('คุณต้องการคืนค่าข้อมูลเริ่มต้น 1,148 รายการจากไฟล์ Excel ต้นฉบับใช่หรือไม่? การแก้ไขที่ยังไม่ได้สำรองจะถูกรีเซ็ต')) {
      return;
    }

    if (window.INITIAL_ROUTES_DATA) {
      state.items = JSON.parse(JSON.stringify(window.INITIAL_ROUTES_DATA));
      state.days = [...DEFAULT_DAYS];
      state.routesByDay = JSON.parse(JSON.stringify(DEFAULT_ROUTES_BY_DAY));
      saveLocalData();
      saveDaysAndRoutes();
      renderDayTabs();
      renderRoutePills();
      renderTable();
      updateStats();
      showToast('รีเซ็ตข้อมูลเริ่มต้น 1,148 ร้านค้าเรียบร้อยแล้ว', 'success');
      el.modalTools.classList.add('hidden');
    }
  }

  // ==================== EVENT LISTENERS ====================
  function bindEvents() {
    // Day tab click
    el.dayTabsContainer.addEventListener('click', e => {
      const btn = e.target.closest('.day-tab');
      if (!btn) return;
      state.activeDay = btn.getAttribute('data-day');
      // If switching to a day that doesn't have the current route, reset route to first available
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
      el.btnPrintSelected.addEventListener('click', () => prepareAndPrint(true));
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

    // Form day select change -> update routes dropdown
    if (el.formDay) {
      el.formDay.addEventListener('change', updateFormRouteOptions);
    }

    // Add Store Modal
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
    el.btnPrintRoute.addEventListener('click', prepareAndPrint);

    // Table delegated actions
    el.tableBody.addEventListener('click', e => {
      // Row checkbox
      const chk = e.target.closest('.row-select-chk');
      if (chk) {
        const id = Number(chk.getAttribute('data-id'));
        toggleSelectItem(id, chk.checked);
        return;
      }

      // Copy code button
      const copyBtn = e.target.closest('.btn-copy-code');
      if (copyBtn) {
        const code = copyBtn.getAttribute('data-code');
        navigator.clipboard.writeText(code).then(() => {
          showToast(`คัดลอกรหัส "${code}" แล้ว`, 'success');
        });
        return;
      }

      // Move Up
      const upBtn = e.target.closest('.btn-move-up');
      if (upBtn) {
        const id = Number(upBtn.getAttribute('data-id'));
        moveItem(id, 'up');
        return;
      }

      // Move Down
      const downBtn = e.target.closest('.btn-move-down');
      if (downBtn) {
        const id = Number(downBtn.getAttribute('data-id'));
        moveItem(id, 'down');
        return;
      }

      // Edit Item
      const editBtn = e.target.closest('.btn-edit-item');
      if (editBtn) {
        const id = Number(editBtn.getAttribute('data-id'));
        openEditModal(id);
        return;
      }

      // Delete Item
      const deleteBtn = e.target.closest('.btn-delete-item');
      if (deleteBtn) {
        const id = Number(deleteBtn.getAttribute('data-id'));
        deleteItem(id);
        return;
      }
    });

    // Close modals on Escape key or backdrop click
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeModal();
        el.modalTools.classList.add('hidden');
        if (el.modalManageRoutes) el.modalManageRoutes.classList.add('hidden');
      }
    });

    el.modalItem.addEventListener('click', e => {
      if (e.target === el.modalItem) closeModal();
    });

    el.modalTools.addEventListener('click', e => {
      if (e.target === el.modalTools) el.modalTools.classList.add('hidden');
    });

    if (el.modalManageRoutes) {
      el.modalManageRoutes.addEventListener('click', e => {
        if (e.target === el.modalManageRoutes) closeManageDaysRoutesModal();
      });
    }
  }

  // ==================== HELPER FUNCTIONS ====================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white',
      info: 'bg-slate-900 text-white'
    };
    const icons = {
      success: 'check-circle-2',
      error: 'alert-triangle',
      info: 'info'
    };

    toast.className = `${colors[type] || colors.info} px-4 py-3 rounded-xl shadow-lg text-xs font-medium flex items-center space-x-2 animate-fade-in pointer-events-auto`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || icons.info}" class="w-4 h-4"></i>
      <span>${escapeHtml(message)}</span>
    `;

    el.toastContainer.appendChild(toast);
    refreshIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function highlightSearch(text, query) {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-amber-200 text-slate-900 px-0.5 rounded">$1</mark>');
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // Launch on DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();
