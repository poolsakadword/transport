/**
 * Delivery Routes Management WebApp - Application Logic
 * Supports: Full CRUD, Search, Sorting, Drag-and-drop Reordering, Print View, Cloudflare D1 Database & LocalStorage Dual-Mode
 */

(function () {
  'use strict';

  // --- Constants & Day/Route Definitions ---
  const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  
  const ROUTES_BY_DAY = {
    'จันทร์': ['สาย 1', 'สาย 2', 'สาย 3', 'สาย 3 สำรอง'],
    'อังคาร': ['สาย 1', 'สาย 2', 'สาย 3'],
    'พุธ': ['สาย 1', 'สาย 2'],
    'พฤหัสบดี': ['สาย 1', 'สาย 2', 'สาย 3'],
    'ศุกร์': ['สาย 1', 'สาย 2', 'สาย 3'],
    'เสาร์': ['สาย 1', 'สาย 2', 'สาย 3'],
  };

  const STORAGE_KEY = 'delivery_routes_data_v1';

  // --- App State ---
  let state = {
    items: [],
    activeDay: 'จันทร์',
    activeRoute: 'สาย 1',
    searchQuery: '',
    paymentFilter: 'all',
    sortBy: 'sequence-asc',
    reorderMode: false,
    hasUnsavedReorder: false,
    apiAvailable: false,
    draggedItemId: null
  };

  // --- DOM Elements Cache ---
  const el = {
    dayTabsContainer: document.getElementById('day-tabs-container'),
    routePillsContainer: document.getElementById('route-pills-container'),
    tableBody: document.getElementById('table-body'),
    emptyState: document.getElementById('empty-state'),
    tableTitle: document.getElementById('table-title'),
    tableCountBadge: document.getElementById('table-count-badge'),
    
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
    dataSourceBadge: document.getElementById('data-source-badge'),

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
    await checkCloudflareApi();
    renderDayTabs();
    renderRoutePills();
    renderTable();
    updateStats();
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
    DAYS.forEach(d => countsByDay[d] = 0);
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

    DAYS.forEach(day => {
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
      availableRoutes = ['สาย 1', 'สาย 2', 'สาย 3', 'สาย 3 สำรอง'];
    } else {
      availableRoutes = ROUTES_BY_DAY[state.activeDay] || ['สาย 1', 'สาย 2', 'สาย 3'];
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
        // Natural sort for customer code
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
      return;
    }

    el.emptyState.classList.add('hidden');

    const isReorderActive = state.reorderMode && state.activeDay !== 'all' && state.activeRoute !== 'all';

    let html = '';
    items.forEach((item, index) => {
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
        <tr class="hover:bg-indigo-50/40 transition-colors ${isReorderActive ? 'draggable-row' : ''}" 
            data-id="${item.id}" 
            data-seq="${item.sequence}"
            ${isReorderActive ? 'draggable="true"' : ''}>
          
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

  // ==================== REORDERING & DRAG-AND-DROP ====================
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
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    return false;
  }

  function handleDragLeave() {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    this.classList.remove('drag-over');
    
    const targetId = Number(this.getAttribute('data-id'));
    const sourceId = state.draggedItemId;

    if (sourceId && targetId && sourceId !== targetId) {
      reorderItemsInRoute(sourceId, targetId);
    }
    return false;
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    const rows = el.tableBody.querySelectorAll('.draggable-row');
    rows.forEach(r => r.classList.remove('drag-over'));
  }

  function reorderItemsInRoute(sourceId, targetId) {
    // Get all items in current day + route sorted by current sequence
    const routeItems = state.items
      .filter(it => it.day === state.activeDay && it.route_name === state.activeRoute)
      .sort((a, b) => a.sequence - b.sequence);

    const sourceIndex = routeItems.findIndex(it => it.id === sourceId);
    const targetIndex = routeItems.findIndex(it => it.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    // Move source to target position
    const [moved] = routeItems.splice(sourceIndex, 1);
    routeItems.splice(targetIndex, 0, moved);

    // Re-assign sequence 1, 2, 3...
    routeItems.forEach((it, idx) => {
      it.sequence = idx + 1;
    });

    state.hasUnsavedReorder = true;
    el.reorderSaveBanner.classList.remove('hidden');
    saveLocalData();
    renderTable();
    updateStats();
    showToast('ปรับลำดับในสายเรียบร้อยแล้ว กดปุ่ม "บันทึกลำดับใหม่" เพื่อยืนยัน', 'info');
  }

  function moveItem(id, direction) {
    const currentItem = state.items.find(it => it.id === id);
    if (!currentItem) return;

    // Get items in same route
    const routeItems = state.items
      .filter(it => it.day === currentItem.day && it.route_name === currentItem.route_name)
      .sort((a, b) => a.sequence - b.sequence);

    const idx = routeItems.findIndex(it => it.id === id);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= routeItems.length) {
      showToast(direction === 'up' ? 'รายการนี้อยู่บนสุดแล้ว' : 'รายการนี้อยู่ล่างสุดแล้ว', 'info');
      return;
    }

    const targetItem = routeItems[targetIdx];
    // Swap sequences
    const tempSeq = currentItem.sequence;
    currentItem.sequence = targetItem.sequence;
    targetItem.sequence = tempSeq;

    state.hasUnsavedReorder = true;
    el.reorderSaveBanner.classList.remove('hidden');
    saveLocalData();
    renderTable();
    updateStats();
    showToast(`เลื่อน ${currentItem.customer_name} ${direction === 'up' ? 'ขึ้น' : 'ลง'} เรียบร้อยแล้ว`, 'success');
  }

  async function saveReorderToBackend() {
    if (!state.hasUnsavedReorder) return;

    const currentRouteItems = state.items
      .filter(it => it.day === state.activeDay && it.route_name === state.activeRoute)
      .map(it => ({ id: it.id, sequence: it.sequence }));

    if (state.apiAvailable) {
      try {
        const res = await fetch('/api/items/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: currentRouteItems })
        });
        if (res.ok) {
          showToast('บันทึกลำดับสายส่งขึ้น Cloudflare D1 สำเร็จ!', 'success');
        } else {
          showToast('บันทึกลงเครื่องเรียบร้อยแล้ว (ออฟไลน์)', 'info');
        }
      } catch (e) {
        showToast('บันทึกลงเครื่องเรียบร้อยแล้ว (ออฟไลน์)', 'info');
      }
    } else {
      showToast('บันทึกลำดับสายส่งเรียบร้อยแล้ว', 'success');
    }

    state.hasUnsavedReorder = false;
    el.reorderSaveBanner.classList.add('hidden');
    saveLocalData();
  }

  // ==================== CRUD OPERATIONS ====================
  function openAddModal() {
    el.modalTitle.innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 text-emerald-600"></i><span>เพิ่มร้านค้าใหม่</span>`;
    el.formItemId.value = '';
    el.formDay.value = state.activeDay !== 'all' ? state.activeDay : 'จันทร์';
    el.formRoute.value = state.activeRoute !== 'all' ? state.activeRoute : 'สาย 1';
    
    // Calculate next sequence for this day & route
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
    el.formDay.value = item.day;
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
    const currentItems = getFilteredAndSortedItems();
    if (currentItems.length === 0) {
      showToast('ไม่มีรายการในสายส่งที่เลือกสำหรับพิมพ์', 'error');
      return;
    }

    // Set Header titles
    el.printDayTitle.textContent = state.activeDay === 'all' ? 'ทุกวัน' : `วัน${state.activeDay}`;
    el.printRouteTitle.textContent = state.activeRoute === 'all' ? 'ทุกสายส่ง' : state.activeRoute;
    
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    el.printDateTime.textContent = `${dateFormatted} ${timeFormatted} น.`;

    const transferCount = currentItems.filter(it => it.remark && it.remark.includes('โอน')).length;
    const cashCount = currentItems.length - transferCount;

    el.printTotalCount.textContent = currentItems.length;
    el.printTransferCount.textContent = transferCount;
    el.printCashCount.textContent = cashCount;

    // Populate Print Table Rows
    let printRowsHtml = '';
    currentItems.forEach((item, idx) => {
      const isTransfer = item.remark && item.remark.includes('โอน');
      const paymentText = isTransfer ? 'โอน' : (item.remark || '-');
      printRowsHtml += `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold;">${escapeHtml(item.customer_code)}</td>
          <td style="text-align: left; font-weight: 500;">
            ${escapeHtml(item.customer_name)}
            ${state.activeRoute === 'all' ? `<span style="font-size: 8pt; color: #555;"> (${item.day} ${item.route_name})</span>` : ''}
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
    if (!confirm(`คุณต้องการอัปโหลดข้อมูลทั้ง 1,148 รายการขึ้นสู่ Cloudflare D1 Database ใช่หรือไม่?`)) {
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
      saveLocalData();
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
        const available = ROUTES_BY_DAY[state.activeDay] || ['สาย 1'];
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

    // Add Modal
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

    // Print Button
    el.btnPrintRoute.addEventListener('click', prepareAndPrint);

    // Table delegated actions
    el.tableBody.addEventListener('click', e => {
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
      }
    });

    el.modalItem.addEventListener('click', e => {
      if (e.target === el.modalItem) closeModal();
    });

    el.modalTools.addEventListener('click', e => {
      if (e.target === el.modalTools) el.modalTools.classList.add('hidden');
    });
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
