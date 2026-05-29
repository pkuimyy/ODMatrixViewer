// src/render/heatmap.js
import { state, subscribe } from '../state.js';

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

    function updateGridConfig() {
        WORLD_SIZE = state.mapSizeTiles * 1920;
        HALF_WORLD = WORLD_SIZE / 2;
        GRID_RES = state.gridSize * 8;
        COLS = Math.ceil(WORLD_SIZE / GRID_RES);
        ROWS = Math.ceil(WORLD_SIZE / GRID_RES);

        gridData = new Int32Array(COLS * ROWS);
        console.log(`[Renderer] Grid Updated: ${COLS}x${ROWS}, Cell Size: ${state.gridSize}u`);
        aggregateData();
    }

    function aggregateData() {
        gridData.fill(0);
        const batches = state.rawBatches;

        // 🚨 修复逻辑：如果有数据才执行聚合，但千万不能提早 return 结束函数！
        if (batches && batches.length > 0) {
            const timeSlice = state.timeSlice;
            const showAllDay = state.showAllDay;
            const showO = state.filters.O;
            const showD = state.filters.D;
            const focusedGrid = state.focusedGrid;
            const focusedArea = state.focusedArea;

            const inArea = (c, r, area) => {
                return (
                    c >= area.startCol && c <= area.endCol && r >= area.startRow && r <= area.endRow
                );
            };

            for (let b = 0; b < batches.length; b++) {
                const batch = batches[b];
                for (let i = 0; i < batch.length; i += 5) {
                    const recordHour = batch[i + 4];
                    if (!showAllDay && recordHour !== timeSlice) continue;

                    const oCol = Math.floor((batch[i] + HALF_WORLD) / GRID_RES);
                    const oRow = Math.floor((HALF_WORLD - batch[i + 1]) / GRID_RES);
                    const dCol = Math.floor((batch[i + 2] + HALF_WORLD) / GRID_RES);
                    const dRow = Math.floor((HALF_WORLD - batch[i + 3]) / GRID_RES);

                    const validO = oCol >= 0 && oCol < COLS && oRow >= 0 && oRow < ROWS;
                    const validD = dCol >= 0 && dCol < COLS && dRow >= 0 && dRow < ROWS;

                    if (!validO || !validD) continue;

                    if (focusedGrid) {
                        if (showO && dCol === focusedGrid.col && dRow === focusedGrid.row)
                            gridData[oRow * COLS + oCol]++;
                        if (showD && oCol === focusedGrid.col && oRow === focusedGrid.row)
                            gridData[dRow * COLS + dCol]++;
                    } else if (focusedArea) {
                        if (showO && inArea(dCol, dRow, focusedArea))
                            gridData[oRow * COLS + oCol]++;
                        if (showD && inArea(oCol, oRow, focusedArea))
                            gridData[dRow * COLS + dCol]++;
                    } else {
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
                maxRef = 1;
            }
        } else {
            maxRef = 1; // 无数据时的默认值
        }

        if (maxRef < 1) maxRef = 1;

        // 🚨 无论有没有数据，只要是初始状态，就自适应画布，确保网格能完整显示在屏幕上！
        if (state.camera.zoom === 1 && state.mapDimensions.width === 0) {
            const rect = canvas.getBoundingClientRect();
            const fitZoom = Math.min(rect.width / WORLD_SIZE, rect.height / WORLD_SIZE) * 0.9;
            state.camera = {
                x: (rect.width - WORLD_SIZE * fitZoom) / 2,
                y: (rect.height - WORLD_SIZE * fitZoom) / 2,
                zoom: fitZoom
            };
        }

        render(); // 保证绘图函数一定会被调用
    }

    function getCyberColor(value) {
        const safeMaxRef = Math.max(maxRef, 1);
        let ratio = Math.log(value + 1) / Math.log(safeMaxRef + 1);
        if (isNaN(ratio) || !isFinite(ratio)) ratio = 0;
        ratio = Math.min(Math.max(ratio, 0), 1);

        const a = Math.min(0.15 + ratio * 0.75, 0.9);
        let r, g, b;

        if (ratio < 0.33) {
            const t = ratio / 0.33;
            r = 255;
            g = Math.floor(255 - t * 105);
            b = Math.floor(200 - t * 200);
        } else if (ratio < 0.66) {
            const t = (ratio - 0.33) / 0.33;
            r = Math.floor(255 - t * 75);
            g = Math.floor(150 - t * 150);
            b = 0;
        } else {
            const t = (ratio - 0.66) / 0.34;
            r = Math.floor(180 - t * 160);
            g = 0;
            b = Math.floor(t * 50);
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
            if (!imgW || !imgH) {
                renderFrameId = null;
                return;
            }

            const { x, y, zoom } = state.camera;
            if (isNaN(x) || isNaN(y) || isNaN(zoom) || zoom <= 0.001) {
                renderFrameId = null;
                return;
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
                        ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
                    }
                }
            }

            if (cellW * zoom > 5) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
                ctx.lineWidth = 1 / zoom;
                ctx.setLineDash([4 / zoom, 4 / zoom]);
                ctx.beginPath();
                const expandSize = 2;

                for (let col = startCol; col <= endCol + 1; col++) {
                    ctx.moveTo(col * cellW, -expandSize * cellH);
                    ctx.lineTo(col * cellW, (ROWS + expandSize) * cellH);
                }
                for (let row = startRow; row <= endRow + 1; row++) {
                    ctx.moveTo(-expandSize * cellW, row * cellH);
                    ctx.lineTo((COLS + expandSize) * cellW, row * cellH);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (state.hoveredGrid) {
                const hCol = state.hoveredGrid.col;
                const hRow = state.hoveredGrid.row;
                ctx.strokeStyle = 'rgba(14, 165, 233, 0.5)';
                ctx.lineWidth = Math.max(1.5 / zoom, 1);
                ctx.strokeRect(hCol * cellW, hRow * cellH, cellW, cellH);
            }

            if (state.focusedGrid) {
                const fCol = state.focusedGrid.col;
                const fRow = state.focusedGrid.row;
                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = Math.max(2 / zoom, 1);
                ctx.fillStyle = 'rgba(14, 165, 233, 0.4)';
                ctx.fillRect(fCol * cellW, fRow * cellH, cellW, cellH);
                ctx.strokeRect(fCol * cellW, fRow * cellH, cellW, cellH);
            }

            if (state.currentSelection) {
                const { startCol, startRow, endCol, endRow } = state.currentSelection;
                const sX = startCol * cellW;
                const sY = startRow * cellH;
                const sW = (endCol - startCol + 1) * cellW;
                const sH = (endRow - startRow + 1) * cellH;
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = Math.max(2 / zoom, 1);
                ctx.setLineDash([6 / zoom, 4 / zoom]);
                ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
                ctx.fillRect(sX, sY, sW, sH);
                ctx.strokeRect(sX, sY, sW, sH);
                ctx.setLineDash([]);
            }

            if (state.focusedArea) {
                const { startCol, startRow, endCol, endRow } = state.focusedArea;
                const aX = startCol * cellW;
                const aY = startRow * cellH;
                const aW = (endCol - startCol + 1) * cellW;
                const aH = (endRow - startRow + 1) * cellH;
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = Math.max(2.5 / zoom, 1.5);
                ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
                ctx.fillRect(aX, aY, aW, aH);
                ctx.strokeRect(aX, aY, aW, aH);
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
    subscribe('mapSizeTiles', updateGridConfig);
    subscribe('gridSize', updateGridConfig);
    subscribe('focusedGrid', aggregateData);
    subscribe('focusedArea', aggregateData);
    subscribe('hoveredGrid', render);
    subscribe('currentSelection', render);
    subscribe('showAllDay', aggregateData);

    // 🚀 在所有的订阅绑定完毕后，执行首次主动更新
    updateGridConfig();
}
