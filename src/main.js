import { initViewport } from './ui/viewport.js';
import { initSidebar } from './ui/sidebar.js';
import { initDataPipeline } from './core/data-pipeline.js';
// 🚨 新增：引入渲染引擎
import { initRenderer } from './render/heatmap.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. 全局 DOM 缓存 (唯一一次查询)
    const DOM = {
        mapUpload: document.getElementById('map-upload'),
        opacitySlider: document.getElementById('opacity-slider'),
        opacityDisplay: document.getElementById('opacity-display'),
        mapLayer: document.getElementById('map-baselayer'),
        canvas: document.getElementById('heatmap-canvas'),
        csvUpload: document.getElementById('file-upload'),
        fileStatus: document.getElementById('file-status'),

        // 🚨 修复：补回漏掉的时间和过滤器 DOM 节点
        timeSlider: document.getElementById('time-slider'),
        timeDisplay: document.getElementById('time-display'),
        filterContainer: document.getElementById('filter-container')
    };

    // 2. 初始化各个子模块
    initSidebar(DOM);
    initViewport(DOM);
    initDataPipeline(DOM);
    // 🚨 新增：初始化渲染器
    initRenderer(DOM);

    console.log('[System] Application initialized.');
});
