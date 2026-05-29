// src/render/aggregator.js
import { state } from '../state.js';

// 统一管理渲染所需的网格状态上下文
export const gridContext = {
    WORLD_SIZE: 17280,
    HALF_WORLD: 17280 / 2,
    GRID_RES: 80,
    COLS: 0,
    ROWS: 0,
    gridData: new Int32Array(0),
    maxRef: 1
};

/**
 * 当地图尺寸(Tiles)或网格密度(gridSize)改变时，更新行列配置并重新初始化网格容器
 */
export function updateGridConfig() {
    gridContext.WORLD_SIZE = state.mapSizeTiles * 1920;
    gridContext.HALF_WORLD = gridContext.WORLD_SIZE / 2;
    gridContext.GRID_RES = state.gridSize * 8;
    gridContext.COLS = Math.ceil(gridContext.WORLD_SIZE / gridContext.GRID_RES);
    gridContext.ROWS = Math.ceil(gridContext.WORLD_SIZE / gridContext.GRID_RES);

    gridContext.gridData = new Int32Array(gridContext.COLS * gridContext.ROWS);
    console.log(
        `[Aggregator] Grid Updated: ${gridContext.COLS}x${gridContext.ROWS}, Cell Size: ${state.gridSize}u`
    );
    aggregateData();
}

/**
 * 遍历海量原始二进制批次数据，根据过滤条件、时间切片、聚焦区域完成空间网格聚合
 */
export function aggregateData() {
    gridContext.gridData.fill(0);
    const batches = state.rawBatches;
    const { COLS, ROWS, HALF_WORLD, GRID_RES } = gridContext;

    if (batches && batches.length > 0) {
        const timeSlice = state.timeSlice;
        const showAllDay = state.showAllDay;
        const showO = state.filters.O;
        const showD = state.filters.D;
        const focusedGrid = state.focusedGrid;
        const focusedArea = state.focusedArea;

        const inArea = (c, r, area) => {
            return c >= area.startCol && c <= area.endCol && r >= area.startRow && r <= area.endRow;
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
                        gridContext.gridData[oRow * COLS + oCol]++;
                    if (showD && oCol === focusedGrid.col && oRow === focusedGrid.row)
                        gridContext.gridData[dRow * COLS + dCol]++;
                } else if (focusedArea) {
                    if (showO && inArea(dCol, dRow, focusedArea))
                        gridContext.gridData[oRow * COLS + oCol]++;
                    if (showD && inArea(oCol, oRow, focusedArea))
                        gridContext.gridData[dRow * COLS + dCol]++;
                } else {
                    if (showO) gridContext.gridData[oRow * COLS + oCol]++;
                    if (showD) gridContext.gridData[dRow * COLS + dCol]++;
                }
            }
        }

        // 动态计算 95% 分位数，避免极端密集点破坏整体热力图的色彩区分度
        const activeValues = [];
        for (let i = 0; i < gridContext.gridData.length; i++) {
            if (gridContext.gridData[i] > 0) activeValues.push(gridContext.gridData[i]);
        }

        if (activeValues.length > 0) {
            activeValues.sort((a, b) => a - b);
            gridContext.maxRef = activeValues[Math.floor(activeValues.length * 0.95)];
        } else {
            gridContext.maxRef = 1;
        }
    } else {
        gridContext.maxRef = 1;
    }

    if (gridContext.maxRef < 1) gridContext.maxRef = 1;
}
