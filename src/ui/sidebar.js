// src/ui/sidebar.js
import { state, subscribe } from '../state.js';

export function initSidebar(DOM) {
    // === 提前获取所有需要的内部 DOM 节点 ===
    const domHeatmapOpacitySlider = document.getElementById('heatmap-opacity-slider');
    const domHeatmapOpacityDisplay = document.getElementById('heatmap-opacity-display');
    const domTilesSelect = document.getElementById('tiles-select');
    const domGridSlider = document.getElementById('grid-slider');
    const domGridDisplay = document.getElementById('grid-display');
    const domBtnAllDay = document.getElementById('btn-all-day');

    // 🚨 修复：强制将浏览器表单当前的实际值同步到全局 State
    state.mapSizeTiles = parseInt(domTilesSelect.value, 10);
    state.gridSize = parseInt(domGridSlider.value, 10);
    state.timeSlice = parseInt(DOM.timeSlider.value, 10);
    state.mapOpacity = parseInt(DOM.opacitySlider.value, 10);
    state.heatmapOpacity = parseInt(domHeatmapOpacitySlider.value, 10);

    // 主动初始化一遍侧边栏的文本显示
    DOM.opacityDisplay.textContent = `${state.mapOpacity}%`;
    domHeatmapOpacityDisplay.textContent = `${state.heatmapOpacity}%`;
    domGridDisplay.textContent = `${state.gridSize}u (${state.gridSize * 8}m)`;
    DOM.timeDisplay.textContent = `${state.timeSlice.toString().padStart(2, '0')}:00`;

    // === 1. 文件与图层控制 ===
    DOM.mapUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (state.mapImageUrl) URL.revokeObjectURL(state.mapImageUrl);
            state.mapImageUrl = URL.createObjectURL(file);
        }
    });

    DOM.opacitySlider.addEventListener('input', (e) => {
        state.mapOpacity = parseInt(e.target.value, 10);
    });

    domHeatmapOpacitySlider.addEventListener('input', (e) => {
        state.heatmapOpacity = parseInt(e.target.value, 10);
    });

    // === 2. 地图尺寸与网格控制 ===
    domBtnAllDay.addEventListener('click', () => {
        state.showAllDay = !state.showAllDay;
    });

    subscribe('showAllDay', (isAllDay) => {
        if (isAllDay) {
            domBtnAllDay.classList.add('btn--primary');
            domBtnAllDay.textContent = '🌍 All Day View: Active';
            DOM.timeSlider.disabled = true;
            DOM.timeSlider.style.opacity = '0.4';
            DOM.timeSlider.style.cursor = 'not-allowed';
        } else {
            domBtnAllDay.classList.remove('btn--primary');
            domBtnAllDay.textContent = '🌍 Show All Day (24h)';
            DOM.timeSlider.disabled = false;
            DOM.timeSlider.style.opacity = '1';
            DOM.timeSlider.style.cursor = 'pointer';
        }
    });

    domTilesSelect.addEventListener('change', (e) => {
        state.mapSizeTiles = parseInt(e.target.value, 10);
    });

    domGridSlider.addEventListener('input', (e) => {
        state.gridSize = parseInt(e.target.value, 10);
    });

    // === 3. 时间与过滤器 ===
    DOM.timeSlider.addEventListener('input', (e) => {
        state.timeSlice = parseInt(e.target.value, 10);
    });

    DOM.filterContainer.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            const type = e.target.value;
            state.filters = { ...state.filters, [type]: e.target.checked };
        }
    });

    DOM.reasonFilterContainer.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            const reasonId = parseInt(e.target.value, 10);
            state.filters = { 
                ...state.filters, 
                reasons: { 
                    ...state.filters.reasons, 
                    [reasonId]: e.target.checked 
                } 
            };
        }
    });

    // === 4. 状态订阅更新 UI ===
    subscribe('mapImageUrl', (url) => {
        DOM.mapLayer.src = url;
        DOM.mapLayer.style.display = 'block';
    });

    subscribe('mapOpacity', (opacity) => {
        DOM.opacityDisplay.textContent = `${opacity}%`;
        DOM.mapLayer.style.opacity = opacity / 100;
    });

    subscribe('heatmapOpacity', (opacity) => {
        domHeatmapOpacityDisplay.textContent = `${opacity}%`;
        DOM.canvas.style.opacity = opacity / 100;
    });

    subscribe('gridSize', (val) => {
        domGridDisplay.textContent = `${val}u (${val * 8}m)`;
    });

    subscribe('timeSlice', (newTime) => {
        DOM.timeDisplay.textContent = `${newTime.toString().padStart(2, '0')}:00`;
    });

    subscribe('focusedGrid', (grid) => {
        if (grid) {
            DOM.fileStatus.textContent = `📍 Focused: [${grid.col}, ${grid.row}] (Press Esc to clear)`;
            DOM.fileStatus.classList.replace('text--muted', 'text--accent');
        } else if (!state.focusedArea) {
            DOM.fileStatus.textContent =
                state.rawBatches && state.rawBatches.length > 0
                    ? 'Data Ready (Global View)'
                    : 'Awaiting import...';
            DOM.fileStatus.classList.replace('text--accent', 'text--muted');
        }
    });

    subscribe('focusedArea', (area) => {
        if (area) {
            DOM.fileStatus.textContent = `📍 Area Focused: [${area.startCol},${area.startRow}] to [${area.endCol},${area.endRow}] (Press Esc to clear)`;
            DOM.fileStatus.classList.replace('text--muted', 'text--accent');
        } else if (!state.focusedGrid) {
            DOM.fileStatus.textContent =
                state.rawBatches && state.rawBatches.length > 0
                    ? 'Data Ready (Global View)'
                    : 'Awaiting import...';
            DOM.fileStatus.classList.replace('text--accent', 'text--muted');
        }
    });
}
