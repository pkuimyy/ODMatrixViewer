// src/render/heatmap.js
import { state, subscribe } from '../state.js';

// 改为 let，使其可以被动态更新
let WORLD_SIZE = 17280;
let HALF_WORLD = WORLD_SIZE / 2;
let GRID_RES = 80;
let COLS = Math.ceil(WORLD_SIZE / GRID_RES);
let ROWS = Math.ceil(WORLD_SIZE / GRID_RES);

let gridData = new Int32Array(COLS * ROWS);
let maxRef = 1;

export function initRenderer(DOM) {
    const canvas = DOM.canvas;
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.scale(dpr, dpr);
        render();
    }

    // 🚀 新增：当用户调节地图大小或网格精度时，重新分配内存
    function updateGridConfig() {
        WORLD_SIZE = state.mapSizeTiles * 1920;
        HALF_WORLD = WORLD_SIZE / 2;

        // 🚨 换算逻辑：用户设定的 10u，在坐标系计算时其实是 80m
        GRID_RES = state.gridSize * 8;

        COLS = Math.ceil(WORLD_SIZE / GRID_RES);
        ROWS = Math.ceil(WORLD_SIZE / GRID_RES);

        gridData = new Int32Array(COLS * ROWS);
        console.log(`[Renderer] Grid Updated: ${COLS}x${ROWS}, Cell Size: ${state.gridSize}u (${GRID_RES}m)`);
        aggregateData();
    }

    function aggregateData() {
        gridData.fill(0);
        const batches = state.rawBatches;
        if (!batches || batches.length === 0) return;

        const timeSlice = state.timeSlice;
        const showO = state.filters.O;
        const showD = state.filters.D;

        for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            for (let i = 0; i < batch.length; i += 5) {
                // TODO: 测试完毕后记得把时间过滤 if(batch[i+4] === timeSlice) 加回来
                if (showO) {
                    const col = Math.floor((batch[i] + HALF_WORLD) / GRID_RES);
                    // 🚀 核心修复：CSL 的 Z轴向上，Canvas 的 Y轴向下。此处将 Z 翻转映射为 Y
                    const row = Math.floor((HALF_WORLD - batch[i + 1]) / GRID_RES);
                    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
                        gridData[row * COLS + col]++;
                    }
                }
                if (showD) {
                    const col = Math.floor((batch[i + 2] + HALF_WORLD) / GRID_RES);
                    // 🚀 核心修复
                    const row = Math.floor((HALF_WORLD - batch[i + 3]) / GRID_RES);
                    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
                        gridData[row * COLS + col]++;
                    }
                }
            }
        }

        const activeValues = [];
        for (let i = 0; i < gridData.length; i++) {
            if (gridData[i] > 0) activeValues.push(gridData[i]);
        }

        if (activeValues.length > 0) {
            activeValues.sort((a, b) => a - b);
            maxRef = activeValues[Math.floor(activeValues.length * 0.95)];
        }
        if (maxRef < 1) maxRef = 1;

        if (state.camera.zoom === 1 && state.mapDimensions.width === 0) {
            const rect = canvas.getBoundingClientRect();
            const fitZoom = Math.min(rect.width / WORLD_SIZE, rect.height / WORLD_SIZE) * 0.9;
            state.camera = {
                x: (rect.width - WORLD_SIZE * fitZoom) / 2,
                y: (rect.height - WORLD_SIZE * fitZoom) / 2,
                zoom: fitZoom
            };
        }

        render();
    }

    function getCyberColor(value) {
        const safeMaxRef = Math.max(maxRef, 1);
        let ratio = Math.log(value + 1) / Math.log(safeMaxRef + 1);
        if (isNaN(ratio) || !isFinite(ratio)) ratio = 0;
        ratio = Math.min(Math.max(ratio, 0), 1);

        const a = Math.min(0.2 + ratio * 0.7, 0.85);
        let r, g, b;

        if (ratio < 0.5) {
            const t = ratio / 0.5;
            r = Math.floor(t * 180);
            g = Math.floor(50 + t * 50);
            b = 255;
        } else {
            const t = (ratio - 0.5) / 0.5;
            r = Math.floor(180 + t * 75);
            g = Math.floor(100 + t * 155);
            b = Math.floor(255 - t * 255);
        }
        return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    }

    let renderFrameId = null;

    function render() {
        if (renderFrameId) cancelAnimationFrame(renderFrameId);

        renderFrameId = requestAnimationFrame(() => {
            const { width: cvsW, height: cvsH } = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, cvsW, cvsH);

            const imgW = state.mapDimensions.width || WORLD_SIZE;
            const imgH = state.mapDimensions.height || WORLD_SIZE;
            if (!imgW || !imgH) { renderFrameId = null; return; }

            const { x, y, zoom } = state.camera;
            if (isNaN(x) || isNaN(y) || isNaN(zoom) || zoom <= 0.001) {
                renderFrameId = null; return;
            }

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(zoom, zoom);

            const cellW = imgW / COLS;
            const cellH = imgH / ROWS;

            const invZoom = 1 / zoom;
            const screenLeft = -x * invZoom;
            const screenTop = -y * invZoom;
            const screenRight = screenLeft + cvsW * invZoom;
            const screenBottom = screenTop + cvsH * invZoom;

            const startCol = Math.max(0, Math.floor(screenLeft / cellW));
            const endCol = Math.min(COLS - 1, Math.ceil(screenRight / cellW));
            const startRow = Math.max(0, Math.floor(screenTop / cellH));
            const endRow = Math.min(ROWS - 1, Math.ceil(screenBottom / cellH));

            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    const val = gridData[row * COLS + col];
                    if (val > 0) {
                        ctx.fillStyle = getCyberColor(val);
                        // 画实心矩形
                        ctx.fillRect(col * cellW, row * cellH, cellW, cellH);

                        // 仅当缩放倍数够大（网格视觉尺寸大于 5px 时）才绘制线框，防止密集时白线糊成一片
                        // 🚨 修改点：显式绘制网格，使用深色半透明（如黑色 40%），让霓虹色块被深色边界包裹
                        if (cellW * zoom > 5) {
                            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                            ctx.lineWidth = 1 / zoom; // 保持物理 1 像素粗细
                            ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);
                        }
                    }
                }
            }

            ctx.restore();
            renderFrameId = null;
        });
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    subscribe('camera', render);
    subscribe('timeSlice', aggregateData);
    subscribe('filters', aggregateData);
    subscribe('rawBatches', aggregateData);
    subscribe('mapDimensions', aggregateData);

    // 监听新增的尺寸配置变化
    subscribe('mapSizeTiles', updateGridConfig);
    subscribe('gridSize', updateGridConfig);
}