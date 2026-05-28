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

        const focusedGrid = state.focusedGrid; // 提取焦点状态

        for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            for (let i = 0; i < batch.length; i += 5) {

                const oCol = Math.floor((batch[i] + HALF_WORLD) / GRID_RES);
                const oRow = Math.floor((HALF_WORLD - batch[i + 1]) / GRID_RES);
                const dCol = Math.floor((batch[i + 2] + HALF_WORLD) / GRID_RES);
                const dRow = Math.floor((HALF_WORLD - batch[i + 3]) / GRID_RES);

                const validO = oCol >= 0 && oCol < COLS && oRow >= 0 && oRow < ROWS;
                const validD = dCol >= 0 && dCol < COLS && dRow >= 0 && dRow < ROWS;

                if (!validO || !validD) continue; // 剔除越界脏数据

                if (focusedGrid) {
                    // 🎯 【焦点探查模式】
                    // 入度探查 (Inbound)：勾选 Origin(O) 时，如果市民的目的地(D)是当前网格，则画出他出发的起点(O)
                    if (showO && dCol === focusedGrid.col && dRow === focusedGrid.row) {
                        gridData[oRow * COLS + oCol]++;
                    }
                    // 出度探查 (Outbound)：勾选 Dest(D) 时，如果市民的起点(O)是当前网格，则画出他前往的终点(D)
                    if (showD && oCol === focusedGrid.col && oRow === focusedGrid.row) {
                        gridData[dRow * COLS + dCol]++;
                    }
                } else {
                    // 🌍 【全局宏观模式】
                    if (showO) gridData[oRow * COLS + oCol]++;
                    if (showD) gridData[dRow * COLS + dCol]++;
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
        } else {
            maxRef = 1; // 强制重置
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
                    }
                }
            }

            // 🚀 核心更新：绘制贯穿整个画布的虚线网格
            if (cellW * zoom > 5) {
                // 使用深色半透明，确保不喧宾夺主
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
                ctx.lineWidth = 1 / zoom; // 保持物理 1 像素粗细

                // 设置虚线：实线段和空白段在屏幕上各约 4 像素
                ctx.setLineDash([4 / zoom, 4 / zoom]);
                ctx.beginPath();

                // 向外围延伸 2 个格子，以表达地图外的城际边界流量
                const expandSize = 2;

                // 绘制垂直线 (列)
                for (let col = startCol; col <= endCol + 1; col++) {
                    ctx.moveTo(col * cellW, -expandSize * cellH);
                    ctx.lineTo(col * cellW, (ROWS + expandSize) * cellH);
                }

                // 绘制水平线 (行)
                for (let row = startRow; row <= endRow + 1; row++) {
                    ctx.moveTo(-expandSize * cellW, row * cellH);
                    ctx.lineTo((COLS + expandSize) * cellW, row * cellH);
                }

                ctx.stroke();
                // 🚨 务必恢复实线模式，否则后面的焦点高亮框也会变成虚线
                ctx.setLineDash([]);
            }

            // 🚀 焦点网格高亮 (原来这部分保留不变)
            if (state.focusedGrid) {
                const fCol = state.focusedGrid.col;
                const fRow = state.focusedGrid.row;
                // ... (保留原来的蓝色高亮代码) ...
            }

            // 🚀 在绘制完热力图后，高亮绘制用户选中的焦点网格
            if (state.focusedGrid) {
                const fCol = state.focusedGrid.col;
                const fRow = state.focusedGrid.row;

                // 使用天蓝色描边并加粗
                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = Math.max(2 / zoom, 1);

                // 内部填充微弱的蓝色半透明，使其在视觉上立刻脱颖而出
                ctx.fillStyle = 'rgba(14, 165, 233, 0.4)';
                ctx.fillRect(fCol * cellW, fRow * cellH, cellW, cellH);
                ctx.strokeRect(fCol * cellW, fRow * cellH, cellW, cellH);
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
    subscribe('focusedGrid', aggregateData);
}