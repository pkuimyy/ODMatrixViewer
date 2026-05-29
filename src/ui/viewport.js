// src/ui/viewport.js
import { state, subscribe } from '../state.js';
import { clampCamera, getGridCoords } from '../utils/math.js';

export function initViewport(DOM) {
    DOM.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 当底图加载成功时计算自适应最佳视距
    DOM.mapLayer.addEventListener('load', () => {
        const natW = DOM.mapLayer.naturalWidth;
        const natH = DOM.mapLayer.naturalHeight;
        state.mapDimensions = { width: natW, height: natH };

        const rect = DOM.canvas.getBoundingClientRect();
        const scaleX = rect.width / natW;
        const scaleY = rect.height / natH;
        const initialZoom = Math.min(scaleX, scaleY) * 0.9;

        const initialX = (rect.width - natW * initialZoom) / 2;
        const initialY = (rect.height - natH * initialZoom) / 2;

        state.camera = { x: initialX, y: initialY, zoom: initialZoom };
        console.log('[System] Map loaded & autofitted. Natural:', natW, natH, 'Zoom:', initialZoom);
    });

    let isDragging = false;
    let isSelectingArea = false;
    let selectionStartGrid = null;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // 内部高频复用的换算网格包装器
    const getCoords = (clientX, clientY) => {
        return getGridCoords(
            clientX,
            clientY,
            DOM.canvas.getBoundingClientRect(),
            state.camera,
            state.mapSizeTiles,
            state.gridSize,
            state.mapDimensions
        );
    };

    DOM.canvas.addEventListener('mousedown', (e) => {
        // Shift + 按下鼠标左键 = 开启框选模式
        if (e.shiftKey) {
            const { col, row, totalCols, totalRows } = getCoords(e.clientX, e.clientY);
            if (col >= 0 && col < totalCols && row >= 0 && row < totalRows) {
                isSelectingArea = true;
                selectionStartGrid = { col, row };
                state.currentSelection = { startCol: col, startRow: row, endCol: col, endRow: row };
                DOM.canvas.style.cursor = 'crosshair';
            }
        } else {
            // 普通左键拖拽 = 平移画布
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            DOM.canvas.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        const { col, row, totalCols, totalRows } = getCoords(e.clientX, e.clientY);

        // 1. 全局网格 Hover 实时追踪
        if (col >= 0 && col < totalCols && row >= 0 && row < totalRows) {
            if (
                !state.hoveredGrid ||
                state.hoveredGrid.col !== col ||
                state.hoveredGrid.row !== row
            ) {
                state.hoveredGrid = { col, row };
            }
        } else {
            if (state.hoveredGrid !== null) state.hoveredGrid = null;
        }

        // 2. 框选拖拽状态联动
        if (isSelectingArea && selectionStartGrid) {
            const currentCol = Math.max(0, Math.min(totalCols - 1, col));
            const currentRow = Math.max(0, Math.min(totalRows - 1, row));

            state.currentSelection = {
                startCol: Math.min(selectionStartGrid.col, currentCol),
                startRow: Math.min(selectionStartGrid.row, currentRow),
                endCol: Math.max(selectionStartGrid.col, currentCol),
                endRow: Math.max(selectionStartGrid.row, currentRow)
            };
            return; // 拦截并阻塞平移
        }

        // 3. 常规画布平移
        if (!isDragging) return;
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        const { x, y, zoom } = state.camera;
        state.camera = clampCamera(
            x + deltaX,
            y + deltaY,
            zoom,
            DOM.canvas.getBoundingClientRect(),
            state.mapDimensions
        );
    });

    window.addEventListener('mouseup', () => {
        if (isSelectingArea) {
            isSelectingArea = false;
            if (state.currentSelection) {
                state.focusedArea = state.currentSelection; // 确认激活区域
                state.currentSelection = null;
                state.focusedGrid = null; // 与单选网格互斥
            }
        }

        isDragging = false;
        DOM.canvas.style.cursor = 'grab';
    });

    DOM.canvas.addEventListener(
        'wheel',
        (e) => {
            e.preventDefault();
            const { x, y, zoom } = state.camera;
            const zoomFactor = 1.1;
            const direction = e.deltaY > 0 ? -1 : 1;
            const newZoom = direction > 0 ? zoom * zoomFactor : zoom / zoomFactor;

            if (newZoom < 0.001 || newZoom > 100) return;

            const rect = DOM.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const worldX = (mouseX - x) / zoom;
            const worldY = (mouseY - y) / zoom;

            const newX = mouseX - worldX * newZoom;
            const newY = mouseY - worldY * newZoom;

            state.camera = clampCamera(newX, newY, newZoom, rect, state.mapDimensions);
        },
        { passive: false }
    );

    DOM.canvas.addEventListener('dblclick', (e) => {
        const { col, row, totalCols, totalRows } = getCoords(e.clientX, e.clientY);

        if (col >= 0 && col < totalCols && row >= 0 && row < totalRows) {
            state.focusedArea = null; // 清除区域互斥
            if (
                state.focusedGrid &&
                state.focusedGrid.col === col &&
                state.focusedGrid.row === row
            ) {
                state.focusedGrid = null;
            } else {
                state.focusedGrid = { col, row };
            }
        } else {
            state.focusedGrid = null;
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (state.focusedGrid) state.focusedGrid = null;
            if (state.focusedArea) state.focusedArea = null;
        }
    });

    subscribe('camera', (cam) => {
        DOM.mapLayer.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.zoom})`;
    });
}
