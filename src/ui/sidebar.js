import { state, subscribe } from '../state.js';

export function initSidebar(DOM) {
    // 底图上传
    DOM.mapUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (state.mapImageUrl) URL.revokeObjectURL(state.mapImageUrl);
            state.mapImageUrl = URL.createObjectURL(file);
        }
    });

    // 底图透明度
    DOM.opacitySlider.addEventListener('input', (e) => {
        state.mapOpacity = parseInt(e.target.value, 10);
    });

    // 响应状态变化更新 DOM
    subscribe('mapImageUrl', (url) => {
        DOM.mapLayer.src = url;
        DOM.mapLayer.style.display = 'block';
    });

    subscribe('mapOpacity', (opacity) => {
        DOM.opacityDisplay.textContent = `${opacity}%`;
        DOM.mapLayer.style.opacity = opacity / 100;
    });
}