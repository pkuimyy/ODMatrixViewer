import defaultReasonConfig from './config/reasons.json'; // 引入前面创建的默认配置 JSON

const listeners = new Map();
const STORAGE_KEY = 'odmatrix_reason_config';
let initialConfig;

// 动态生成初始的 filters
const initialReasonFilters = {};
defaultReasonConfig.forEach((r) => {
    initialReasonFilters[r.id] = true;
});

try {
    const saved = localStorage.getItem(STORAGE_KEY);
    initialConfig = saved ? JSON.parse(saved) : defaultReasonConfig;
} catch (e) {
    initialConfig = defaultReasonConfig;
}

document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('json-editor');
    const btnSave = document.getElementById('btn-save');
    const btnReset = document.getElementById('btn-reset');

    // 1. 初始化读取
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const displayData = saved ? JSON.parse(saved) : defaultReasonConfig;
        editor.value = JSON.stringify(displayData, null, 4);
    } catch (e) {
        editor.value = JSON.stringify(defaultReasonConfig, null, 4);
    }

    // 2. 保存逻辑
    btnSave.addEventListener('click', () => {
        try {
            const parsedConfig = JSON.parse(editor.value);
            if (!Array.isArray(parsedConfig)) {
                throw new Error('Configuration must be a JSON array.');
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedConfig));
            alert('Configuration saved successfully!');

            // 保存后直接跳转回主页
            window.location.href = '/index.html';
        } catch (error) {
            alert('❌ Invalid JSON format:\n' + error.message);
        }
    });

    // 3. 恢复默认设置
    btnReset.addEventListener('click', () => {
        const confirmReset = confirm(
            'Are you sure you want to restore defaults? Custom mappings will be lost.'
        );
        if (confirmReset) {
            localStorage.removeItem(STORAGE_KEY);
            alert('Restored to defaults.');
            editor.value = JSON.stringify(defaultReasonConfig, null, 4);
        }
    });
});

const _state = {
    timeSlice: 12,
    showAllDay: false,
    filters: { O: true, D: true, reasons: initialReasonFilters },

    // 图层透明度控制
    mapOpacity: 60,
    heatmapOpacity: 100, // 新增：热力图图层透明度，默认 100%

    mapImageUrl: null,
    mapDimensions: { width: 0, height: 0 },
    camera: { x: 0, y: 0, zoom: 1 },
    rawBatches: [],

    // 🚀 新增配置项
    reasonConfig: initialConfig,

    // 地图与网格动态配置
    mapSizeTiles: 9,
    gridSize: 10, // 🚨 变更为：以 u 为单位，默认 10u (10u = 80m)

    // 🚀 新增：区域框选与悬停控制状态
    focusedArea: null, // 已锁定的框选区域 { startCol, startRow, endCol, endRow }
    currentSelection: null, // 正在拖拽中的临时区域 { startCol, startRow, endCol, endRow }
    hoveredGrid: null // 当前鼠标悬停的网格坐标 { col, row }
};

export const state = new Proxy(_state, {
    set(target, property, value) {
        if (target[property] !== value) {
            target[property] = value;
            if (listeners.has(property)) {
                listeners.get(property).forEach((callback) => callback(value, target));
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
