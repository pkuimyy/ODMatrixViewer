// src/ui/viewport.js
import { state, subscribe } from '../state.js';

export function initViewport(DOM) {
    // ==========================================
    // 边界约束算法
    // ==========================================
    function clampCamera(newX, newY, newZoom) {
        if (state.mapDimensions.width === 0) return { x: newX, y: newY, zoom: newZoom };

        const rect = DOM.canvas.getBoundingClientRect();

        const fitZoom = Math.min(
            rect.width / state.mapDimensions.width,
            rect.height / state.mapDimensions.height
        );
        const MIN_ZOOM = fitZoom * 0.8;
        const MAX_ZOOM = 50;
        const clampedZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);

        const mapWidth = state.mapDimensions.width * clampedZoom;
        const mapHeight = state.mapDimensions.height * clampedZoom;

        const padX = rect.width * 0.1;
        const padY = rect.height * 0.1;

        let minX = rect.width - padX - mapWidth;
        let maxX = padX;
        let minY = rect.height - padY - mapHeight;
        let maxY = padY;

        const finalMinX = Math.min(minX, maxX);
        const finalMaxX = Math.max(minX, maxX);
        const finalMinY = Math.min(minY, maxY);
        const finalMaxY = Math.max(minY, maxY);

        const clampedX = Math.min(Math.max(newX, finalMinX), finalMaxX);
        const clampedY = Math.min(Math.max(newY, finalMinY), finalMaxY);

        return { x: clampedX, y: clampedY, zoom: clampedZoom };
    }

    // 🚀 新增辅助函数：将屏幕鼠标坐标换算为网格行列坐标(col, row)
    function getGridCoords(clientX, clientY) {
        const rect = DOM.canvas.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;
        const { x, y, zoom } = state.camera;

        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;

        const WORLD_SIZE = state.mapSizeTiles * 1920;
        const GRID_RES = state.gridSize * 8;
        const COLS = Math.ceil(WORLD_SIZE / GRID_RES);
        const ROWS = Math.ceil(WORLD_SIZE / GRID_RES);

        const imgW = state.mapDimensions.width || WORLD_SIZE;
        const imgH = state.mapDimensions.height || WORLD_SIZE;
        const cellW = imgW / COLS;
        const cellH = imgH / ROWS;

        const col = Math.floor(worldX / cellW);
        const row = Math.floor(worldY / cellH);

        return { col, row, totalCols: COLS, totalRows: ROWS };
    }

    // ==========================================
    // 视图基础设置
    // ==========================================
    DOM.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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

    // ==========================================
    // 鼠标交互事件 (Pan, Hover & Area Selection)
    // ==========================================
    let isDragging = false;
    let isSelectingArea = false; // 🚀 新增：是否正在进行框选
    let selectionStartGrid = null; // 🚀 新增：框选起点网格
    let lastMouseX = 0;
    let lastMouseY = 0;

    DOM.canvas.addEventListener('mousedown', (e) => {
        // 🚀 核心逻辑区分：如果按住了 Shift 键，则触发框选逻辑
        if (e.shiftKey) {
            const { col, row, totalCols, totalRows } = getGridCoords(e.clientX, e.clientY);
            if (col >= 0 && col < totalCols && row >= 0 && row < totalRows) {
                isSelectingArea = true;
                selectionStartGrid = { col, row };
                state.currentSelection = { startCol: col, startRow: row, endCol: col, endRow: row };
                DOM.canvas.style.cursor = 'crosshair'; // 框选时变成十字光标
            }
        } else {
            // 普通左键拖拽：平移地图
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            DOM.canvas.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        const { col, row, totalCols, totalRows } = getGridCoords(e.clientX, e.clientY);

        // ✨ 功能一：实时计算并更新鼠标悬停高亮的网格
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

        // ✨ 功能二：处理正在框选的拖拽过程
        if (isSelectingArea && selectionStartGrid) {
            // 限制网格不越界
            const currentCol = Math.max(0, Math.min(totalCols - 1, col));
            const currentRow = Math.max(0, Math.min(totalRows - 1, row));

            // 根据“总是从左上角开始、到右下角结束”的几何要求，用 Math.min/max 确保数据顺序
            state.currentSelection = {
                startCol: Math.min(selectionStartGrid.col, currentCol),
                startRow: Math.min(selectionStartGrid.row, currentRow),
                endCol: Math.max(selectionStartGrid.col, currentCol),
                endRow: Math.max(selectionStartGrid.row, currentRow)
            };
            return; // 框选时拦截平移逻辑
        }

        // 原平移逻辑
        if (!isDragging) return;
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        const { x, y, zoom } = state.camera;
        state.camera = clampCamera(x + deltaX, y + deltaY, zoom);
    });

    window.addEventListener('mouseup', () => {
        // 🚀 框选结束，锁定区域
        if (isSelectingArea) {
            isSelectingArea = false;
            if (state.currentSelection) {
                state.focusedArea = state.currentSelection; // 激活区域探查
                state.currentSelection = null; // 清除临时状态
                state.focusedGrid = null; // 与单网格聚焦互斥
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

            state.camera = clampCamera(newX, newY, newZoom);
        },
        { passive: false }
    );

    // 双击聚焦单网格（保持原样，但增加清除区域聚焦的互斥）
    DOM.canvas.addEventListener('dblclick', (e) => {
        const { col, row, totalCols, totalRows } = getGridCoords(e.clientX, e.clientY);

        if (col >= 0 && col < totalCols && row >= 0 && row < totalRows) {
            state.focusedArea = null; // 互斥清空区域
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

    // 全局退出模式（支持 Esc 同时清除单网格和区域框选）
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (state.focusedGrid) state.focusedGrid = null;
            if (state.focusedArea) state.focusedArea = null;
        }
    });

    // 视图同步订阅
    subscribe('camera', (cam) => {
        DOM.mapLayer.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.zoom})`;
    });
}
