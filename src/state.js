// src/state.js
const listeners = new Map();

const _state = {
    timeSlice: 12,
    filters: { O: true, D: true },
    
    // 图层透明度控制
    mapOpacity: 60,
    heatmapOpacity: 100, // 新增：热力图图层透明度，默认 100%
    
    mapImageUrl: null,
    mapDimensions: { width: 0, height: 0 },
    camera: { x: 0, y: 0, zoom: 1 },
    rawBatches: [],

    // 地图与网格动态配置
    mapSizeTiles: 9, 
    gridSize: 10,    // 🚨 变更为：以 u 为单位，默认 10u (10u = 80m)
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