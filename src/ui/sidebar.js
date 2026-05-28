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
}