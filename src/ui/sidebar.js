// src/ui/sidebar.js
import { state, subscribe } from '../state.js';

export function initSidebar(DOM) {
    // === 1. 底图控制 ===
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

    // === 2. 🚨 新增：时间与过滤器控制 ===
    DOM.timeSlider.addEventListener('input', (e) => {
        state.timeSlice = parseInt(e.target.value, 10);
    });

    DOM.filterContainer.addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            const type = e.target.value;
            // 浅拷贝触发 Proxy 更新
            state.filters = { ...state.filters, [type]: e.target.checked };
        }
    });

    // === 3. 状态订阅更新 UI ===
    subscribe('mapImageUrl', (url) => {
        DOM.mapLayer.src = url;
        DOM.mapLayer.style.display = 'block';
    });

    subscribe('mapOpacity', (opacity) => {
        DOM.opacityDisplay.textContent = `${opacity}%`;
        DOM.mapLayer.style.opacity = opacity / 100;
    });

    // 🚨 新增：更新时间文本
    subscribe('timeSlice', (newTime) => {
        DOM.timeDisplay.textContent = `${newTime.toString().padStart(2, '0')}:00`;
    });
}