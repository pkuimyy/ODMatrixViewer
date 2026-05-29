// src/render/heatmap.js
import { state, subscribe } from '../state.js';
import { getCyberColor } from './color-utils.js';
import { gridContext, updateGridConfig, aggregateData } from './aggregator.js';

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

    function handleDataUpdate() {
        aggregateData();

        // 初始状态下且无底图时，热力图自适应居中缩放全景
        if (state.camera.zoom === 1 && state.mapDimensions.width === 0) {
            const rect = canvas.getBoundingClientRect();
            const fitZoom =
                Math.min(
                    rect.width / gridContext.WORLD_SIZE,
                    rect.height / gridContext.WORLD_SIZE
                ) * 0.9;
            state.camera = {
                x: (rect.width - gridContext.WORLD_SIZE * fitZoom) / 2,
                y: (rect.height - gridContext.WORLD_SIZE * fitZoom) / 2,
                zoom: fitZoom
            };
        }

        render();
    }

    let renderFrameId = null;

    function render() {
        if (renderFrameId) cancelAnimationFrame(renderFrameId);

        renderFrameId = requestAnimationFrame(() => {
            const { width: cvsW, height: cvsH } = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, cvsW, cvsH);

            const { COLS, ROWS, WORLD_SIZE, gridData, maxRef } = gridContext;

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

            // 视口裁剪裁剪裁剪优化 (Frustum Culling)
            const startCol = Math.max(0, Math.floor(screenLeft / cellW));
            const endCol = Math.min(COLS - 1, Math.ceil(screenRight / cellW));
            const startRow = Math.max(0, Math.floor(screenTop / cellH));
            const endRow = Math.min(ROWS - 1, Math.ceil(screenBottom / cellH));

            // 1. 绘制热力图网格数据
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    const val = gridData[row * COLS + col];
                    if (val > 0) {
                        ctx.fillStyle = getCyberColor(val, maxRef);
                        ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
                    }
                }
            }

            // 2. 绘制自适应虚网格线
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

            // 3. 绘制鼠标悬停框
            if (state.hoveredGrid) {
                const hCol = state.hoveredGrid.col;
                const hRow = state.hoveredGrid.row;
                ctx.strokeStyle = 'rgba(14, 165, 233, 0.5)';
                ctx.lineWidth = Math.max(1.5 / zoom, 1);
                ctx.strokeRect(hCol * cellW, hRow * cellH, cellW, cellH);
            }

            // 4. 绘制双击固定的单个聚焦网格
            if (state.focusedGrid) {
                const fCol = state.focusedGrid.col;
                const fRow = state.focusedGrid.row;
                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = Math.max(2 / zoom, 1);
                ctx.fillStyle = 'rgba(14, 165, 233, 0.4)';
                ctx.fillRect(fCol * cellW, fRow * cellH, cellW, cellH);
                ctx.strokeRect(fCol * cellW, fRow * cellH, cellW, cellH);
            }

            // 5. 绘制正在进行拖拽选择的临时框选区
            if (state.currentSelection) {
                const { startCol, startRow, endCol, endRow } = state.currentSelection;
                const sX = startCol * cellW;
                const sY = startRow * cellH;
                const sW = (endCol - startCol + 1) * cellW;
                const sH = (endRow - startRow + 1) * cellH;

                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = Math.max(2 / zoom, 1);
                ctx.setLineDash([6 / zoom, 4 / zoom]);
                ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';

                ctx.fillRect(sX, sY, sW, sH);
                ctx.strokeRect(sX, sY, sW, sH);
                ctx.setLineDash([]);
            }

            // 6. 绘制已被锁定的聚焦过滤区域
            if (state.focusedArea) {
                const { startCol, startRow, endCol, endRow } = state.focusedArea;
                const aX = startCol * cellW;
                const aY = startRow * cellH;
                const aW = (endCol - startCol + 1) * cellW;
                const aH = (endRow - startRow + 1) * cellH;

                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = Math.max(2.5 / zoom, 1.5);
                ctx.fillStyle = 'rgba(14, 165, 233, 0.4)';

                ctx.fillRect(aX, aY, aW, aH);
                ctx.strokeRect(aX, aY, aW, aH);
            }

            ctx.restore();
            renderFrameId = null;
        });
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // 状态变动事件单向数据流订阅
    subscribe('camera', render);
    subscribe('hoveredGrid', render);
    subscribe('currentSelection', render);

    [
        'timeSlice',
        'filters',
        'rawBatches',
        'mapDimensions',
        'focusedGrid',
        'focusedArea',
        'showAllDay'
    ].forEach((prop) => {
        subscribe(prop, handleDataUpdate);
    });

    subscribe('mapSizeTiles', () => {
        updateGridConfig();
        handleDataUpdate();
    });
    subscribe('gridSize', () => {
        updateGridConfig();
        handleDataUpdate();
    });

    updateGridConfig();
}
