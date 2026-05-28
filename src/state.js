// src/state.js
const listeners = new Map();

const _state = {
    timeSlice: 12,
    filters: { O: true, D: true },

    // 新增：地图与相机状态
    mapOpacity: 60,
    mapImageUrl: null,
    mapDimensions: { width: 0, height: 0 }, // 新增：记录图片的自然宽高
    camera: { x: 0, y: 0, zoom: 1 },

    timeSlice: 12,
    filters: { O: true, D: true },

    // 新增：存放所有 Worker 传回来的 Float32Array 批次
    rawBatches: []

};

export const state = new Proxy(_state, {
    set(target, property, value) {
        if (target[property] !== value) {
            target[property] = value;
            if (listeners.has(property)) {
                listeners.get(property).forEach(callback => callback(value, target));
            }
        }
        return true;
    }
});

export function subscribe(property, callback) {
    if (!listeners.has(property)) {
        listeners.set(property, new Set());
    }
    listeners.get(property).add(callback);
}