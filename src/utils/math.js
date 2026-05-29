// src/utils/math.js

/**
 * 相机坐标以及缩放约束算法（防止地图被无限制拖拽出边界）
 */
export function clampCamera(newX, newY, newZoom, canvasRect, mapDimensions) {
    if (mapDimensions.width === 0) return { x: newX, y: newY, zoom: newZoom };

    const fitZoom = Math.min(
        canvasRect.width / mapDimensions.width,
        canvasRect.height / mapDimensions.height
    );
    const MIN_ZOOM = fitZoom * 0.8;
    const MAX_ZOOM = 50;
    const clampedZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);

    const mapWidth = mapDimensions.width * clampedZoom;
    const mapHeight = mapDimensions.height * clampedZoom;

    const padX = canvasRect.width * 0.1;
    const padY = canvasRect.height * 0.1;

    let minX = canvasRect.width - padX - mapWidth;
    let maxX = padX;
    let minY = canvasRect.height - padY - mapHeight;
    let maxY = padY;

    const finalMinX = Math.min(minX, maxX);
    const finalMaxX = Math.max(minX, maxX);
    const finalMinY = Math.min(minY, maxY);
    const finalMaxY = Math.max(minY, maxY);

    const clampedX = Math.min(Math.max(newX, finalMinX), finalMaxX);
    const clampedY = Math.min(Math.max(newY, finalMinY), finalMaxY);

    return { x: clampedX, y: clampedY, zoom: clampedZoom };
}

/**
 * 屏幕鼠标空间坐标轴向世界网格行列索引转换算法
 */
export function getGridCoords(
    clientX,
    clientY,
    canvasRect,
    camera,
    mapSizeTiles,
    gridSize,
    mapDimensions
) {
    const mouseX = clientX - canvasRect.left;
    const mouseY = clientY - canvasRect.top;
    const { x, y, zoom } = camera;

    const worldX = (mouseX - x) / zoom;
    const worldY = (mouseY - y) / zoom;

    const WORLD_SIZE = mapSizeTiles * 1920;
    const GRID_RES = gridSize * 8;
    const COLS = Math.ceil(WORLD_SIZE / GRID_RES);
    const ROWS = Math.ceil(WORLD_SIZE / GRID_RES);

    const imgW = mapDimensions.width || WORLD_SIZE;
    const imgH = mapDimensions.height || WORLD_SIZE;
    const cellW = imgW / COLS;
    const cellH = imgH / ROWS;

    const col = Math.floor(worldX / cellW);
    const row = Math.floor(worldY / cellH);

    return { col, row, totalCols: COLS, totalRows: ROWS };
}
