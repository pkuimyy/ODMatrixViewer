// src/ui/sidebar.js
import { state, subscribe } from '../state.js';

export function initSidebar(DOM) {
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

    // 🚨 新增：热力图透明度事件
    const domHeatmapOpacitySlider = document.getElementById('heatmap-opacity-slider');
    const domHeatmapOpacityDisplay = document.getElementById('heatmap-opacity-display');
    domHeatmapOpacitySlider.addEventListener('input', (e) => {
        state.heatmapOpacity = parseInt(e.target.value, 10);
    });

    // === 2. 地图尺寸与网格控制 ===
    const domTilesSelect = document.getElementById('tiles-select');
    const domGridSlider = document.getElementById('grid-slider');
    const domGridDisplay = document.getElementById('grid-display');

    // 🚀 1. 获取新按钮 DOM
    const domBtnAllDay = document.getElementById('btn-all-day');

    // 🚀 2. 绑定点击事件，翻转状态
    domBtnAllDay.addEventListener('click', () => {
        state.showAllDay = !state.showAllDay;
    });

    // 🚀 3. 订阅状态变化，更新 UI
    subscribe('showAllDay', (isAllDay) => {
        if (isAllDay) {
            // 激活状态：变成深蓝色主按钮，并视觉上禁用滑块
            domBtnAllDay.classList.add('btn--primary');
            domBtnAllDay.textContent = '🌍 All Day View: Active';
            DOM.timeSlider.disabled = true;
            DOM.timeSlider.style.opacity = '0.4';
            DOM.timeSlider.style.cursor = 'not-allowed';
        } else {
            // 关闭状态：恢复默认外观
            domBtnAllDay.classList.remove('btn--primary');
            domBtnAllDay.textContent = '🌍 Show All Day (24h)';
            DOM.timeSlider.disabled = false;
            DOM.timeSlider.style.opacity = '1';
            DOM.timeSlider.style.cursor = 'pointer';
        }
    });

    // 下拉框 3选1
    domTilesSelect.addEventListener('change', (e) => {
        state.mapSizeTiles = parseInt(e.target.value, 10);
    });

    // 10u 到 100u 滑块
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

    // === 4. 状态订阅更新 UI ===
    subscribe('mapImageUrl', (url) => {
        DOM.mapLayer.src = url;
        DOM.mapLayer.style.display = 'block';
    });

    subscribe('mapOpacity', (opacity) => {
        DOM.opacityDisplay.textContent = `${opacity}%`;
        DOM.mapLayer.style.opacity = opacity / 100;
    });

    // 🚨 订阅热力图透明度，直接修改 Canvas 的 CSS opacity 属性（性能极高）
    subscribe('heatmapOpacity', (opacity) => {
        domHeatmapOpacityDisplay.textContent = `${opacity}%`;
        DOM.canvas.style.opacity = opacity / 100;
    });

    subscribe('gridSize', (val) => {
        // UI 显示换算：1u = 8m
        domGridDisplay.textContent = `${val}u (${val * 8}m)`;
    });

    subscribe('timeSlice', (newTime) => {
        DOM.timeDisplay.textContent = `${newTime.toString().padStart(2, '0')}:00`;
    });

    // 请找到原有的这一段并更新为：
    subscribe('focusedGrid', (grid) => {
        if (grid) {
            DOM.fileStatus.textContent = `📍 Focused: [${grid.col}, ${grid.row}] (Press Esc to clear)`;
            DOM.fileStatus.classList.replace('text--muted', 'text--accent');
        } else if (!state.focusedArea) { // 🚀 增加此判断：只有在区域聚集也为空时才重置文案
            DOM.fileStatus.textContent =
                state.rawBatches && state.rawBatches.length > 0
                    ? 'Data Ready (Global View)'
                    : 'Awaiting import...';
            DOM.fileStatus.classList.replace('text--accent', 'text--muted');
        }
    });

    // src/ui/sidebar.js 内部，追加在 initSidebar 函数的底部
    subscribe('focusedArea', (area) => {
        if (area) {
            // 🚨 更新提示文案，反映框选区域的左上角与右下角
            DOM.fileStatus.textContent = `📍 Area Focused: [${area.startCol},${area.startRow}] to [${area.endCol},${area.endRow}] (Press Esc to clear)`;
            DOM.fileStatus.classList.replace('text--muted', 'text--accent');
        } else if (!state.focusedGrid) {
            // 如果单格聚焦和区域聚焦都为空，才恢复全局提示
            DOM.fileStatus.textContent =
                state.rawBatches && state.rawBatches.length > 0
                    ? 'Data Ready (Global View)'
                    : 'Awaiting import...';
            DOM.fileStatus.classList.replace('text--accent', 'text--muted');
        }
    });
}
