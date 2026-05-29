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
    maxRef: 1,
    numReasons: 4 // 🚀 新增分类数
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

    // 🚀 动态读取当前的类别总数
    gridContext.numReasons = state.reasonConfig.length;
    gridContext.gridData = new Int32Array(
        gridContext.COLS * gridContext.ROWS * gridContext.numReasons
    );
    console.log(`[Aggregator] Grid Updated. Reasons dimension: ${gridContext.numReasons}`);
    aggregateData();
}

/**
 * 遍历海量原始二进制批次数据，根据过滤条件、时间切片、聚焦区域完成空间网格聚合
 */
export function aggregateData() {
    gridContext.gridData.fill(0);
    const batches = state.rawBatches;
    const { COLS, ROWS, HALF_WORLD, GRID_RES, numReasons } = gridContext;

    if (batches && batches.length > 0) {
        const {
            timeSlice,
            showAllDay,
            filters: { O: showO, D: showD, reasons: activeReasons },
            focusedGrid,
            focusedArea
        } = state;

        const inArea = (c, r, area) =>
            c >= area.startCol && c <= area.endCol && r >= area.startRow && r <= area.endRow;

        for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            // 🚀 步长更新为 6
            for (let i = 0; i < batch.length; i += 6) {
                const recordHour = batch[i + 4];
                const reasonId = batch[i + 5];

                if (!showAllDay && recordHour !== timeSlice) continue;
                // 🚀 如果该 reason 在界面上被关掉，直接跳过计算
                if (!activeReasons[reasonId]) continue;

                const oCol = Math.floor((batch[i] + HALF_WORLD) / GRID_RES);
                const oRow = Math.floor((HALF_WORLD - batch[i + 1]) / GRID_RES);
                const dCol = Math.floor((batch[i + 2] + HALF_WORLD) / GRID_RES);
                const dRow = Math.floor((HALF_WORLD - batch[i + 3]) / GRID_RES);

                const validO = oCol >= 0 && oCol < COLS && oRow >= 0 && oRow < ROWS;
                const validD = dCol >= 0 && dCol < COLS && dRow >= 0 && dRow < ROWS;

                if (!validO || !validD) continue;

                if (focusedGrid) {
                    if (showO && dCol === focusedGrid.col && dRow === focusedGrid.row)
                        gridContext.gridData[(oRow * COLS + oCol) * numReasons + reasonId]++;
                    if (showD && oCol === focusedGrid.col && oRow === focusedGrid.row)
                        gridContext.gridData[(dRow * COLS + dCol) * numReasons + reasonId]++;
                } else if (focusedArea) {
                    if (showO && inArea(dCol, dRow, focusedArea))
                        gridContext.gridData[(oRow * COLS + oCol) * numReasons + reasonId]++;
                    if (showD && inArea(oCol, oRow, focusedArea))
                        gridContext.gridData[(dRow * COLS + dCol) * numReasons + reasonId]++;
                } else {
                    if (showO) gridContext.gridData[(oRow * COLS + oCol) * numReasons + reasonId]++;
                    if (showD) gridContext.gridData[(dRow * COLS + dCol) * numReasons + reasonId]++;
                }
            }
        }

        // 计算 95% 分位数最大参考值，采用 4 个维度的总和
        const activeValues = [];
        for (let i = 0; i < gridContext.gridData.length; i += numReasons) {
            let sum = 0;
            for (let k = 0; k < numReasons; k++) {
                sum += gridContext.gridData[i + k];
            }
            if (sum > 0) activeValues.push(sum);
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
}
