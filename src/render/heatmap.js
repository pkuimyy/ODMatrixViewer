// src/render/heatmap.js
import { state, subscribe } from '../state.js';

const WORLD_SIZE = 17280;             // CSL 坐标系域 (-8640 ~ +8640)
const HALF_WORLD = WORLD_SIZE / 2;
const GRID_RES = 20;                  // 20u 网格
const COLS = Math.ceil(WORLD_SIZE / GRID_RES); // 864
const ROWS = Math.ceil(WORLD_SIZE / GRID_RES); // 864

const gridData = new Int32Array(COLS * ROWS);
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

    function aggregateData() {
        gridData.fill(0);
        const batches = state.rawBatches;
        if (!batches || batches.length === 0) return;

        const timeSlice = state.timeSlice;
        const showO = state.filters.O;
        const showD = state.filters.D;

        let matchCount = 0; // 诊断变量

        for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            for (let i = 0; i < batch.length; i += 5) {
                // 筛选当前小时的数据
                // if (batch[i + 4] === timeSlice) {
                matchCount++;
                if (showO) {
                    const col = Math.floor((batch[i] + HALF_WORLD) / GRID_RES);
                    const row = Math.floor((batch[i + 1] + HALF_WORLD) / GRID_RES);
                    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
                        gridData[row * COLS + col]++;
                    }
                }
                if (showD) {
                    const col = Math.floor((batch[i + 2] + HALF_WORLD) / GRID_RES);
                    const row = Math.floor((batch[i + 3] + HALF_WORLD) / GRID_RES);
                    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
                        gridData[row * COLS + col]++;
                    }
                }
                // }
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

        // 🚨 打印日志：帮助排查这一小时内到底有没有拿到数据
        console.log(`[Renderer] 时间切片 ${timeSlice}:00 | 命中记录: ${matchCount} | 激活网格: ${activeValues.length} | 极值MaxRef: ${maxRef}`);

        // 🚨 修复核心：如果用户没有上传地图图片，我们要强制初始化一个全局相机视角
        if (state.camera.zoom === 1 && state.mapDimensions.width === 0) {
            const rect = canvas.getBoundingClientRect();
            // 让 17280 的虚拟世界刚好适配屏幕
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
        let ratio = Math.log(value + 1) / Math.log(maxRef + 1);
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

            // 🚨 修复核心：如果没传底图，强制使用 WORLD_SIZE 作为虚拟基准尺寸
            const imgW = state.mapDimensions.width || WORLD_SIZE;
            const imgH = state.mapDimensions.height || WORLD_SIZE;

            if (!imgW || !imgH) {
                renderFrameId = null;
                return;
            }

            const { x, y, zoom } = state.camera;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(zoom, zoom);

            const cellW = imgW / COLS;
            const cellH = imgH / ROWS;

            // 修复网格间隙算法，使其与缩放和图片分辨率自适应
            const gapThreshold = WORLD_SIZE / imgW * 2.5;
            const gapX = zoom > gapThreshold ? (cellW * 0.1) : 0;
            const gapY = zoom > gapThreshold ? (cellH * 0.1) : 0;
            const drawW = cellW - gapX;
            const drawH = cellH - gapY;

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
                        ctx.fillRect(
                            col * cellW + gapX / 2,
                            row * cellH + gapY / 2,
                            drawW,
                            drawH
                        );
                    }
                }
            }

            ctx.restore();
            renderFrameId = null;
        });
    }

    window.addEventListener('resize', () => { resizeCanvas(); });
    resizeCanvas();

    subscribe('camera', render);
    subscribe('timeSlice', aggregateData);
    subscribe('filters', aggregateData);
    subscribe('rawBatches', aggregateData);
    subscribe('mapDimensions', aggregateData);

    // ==========================================
    // 🕵️ 挂载全局诊断工具 (请在控制台调用)
    // ==========================================
    window.__DEBUG_EXPORT_HEATMAP__ = () => {
        // 1. 扫描聚合后的二维网格，找出有数据的格子
        const activeGrids = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const val = gridData[r * COLS + c];
                if (val > 0) {
                    activeGrids.push({ 
                        row: r, col: c, val: val,
                        // 反推这个格子对应的世界坐标系大概位置
                        worldX_approx: c * (WORLD_SIZE / COLS) - HALF_WORLD,
                        worldY_approx: r * (WORLD_SIZE / ROWS) - HALF_WORLD
                    });
                }
            }
        }

        // 2. 从 Worker 传回的 Float32Array 截取前 10 条原始点位
        const sampleRaw = [];
        if (state.rawBatches && state.rawBatches.length > 0) {
            const batch = state.rawBatches[0];
            for(let i = 0; i < Math.min(batch.length, 50); i += 5) {
                sampleRaw.push({
                    Ox: batch[i], Oy: batch[i+1],
                    Dx: batch[i+2], Dy: batch[i+3],
                    Hour: batch[i+4]
                });
            }
        }

        // 3. 打包当前相机和画布状态
        const debugPayload = {
            engineState: {
                maxRef: maxRef,
                camera: state.camera,
                mapDimensions: state.mapDimensions,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
            },
            dataStats: {
                totalActiveGrids: activeGrids.length,
                // 只看流量最高的前 10 个格子，防止日志太长
                topGrids: activeGrids.sort((a, b) => b.val - a.val).slice(0, 10)
            },
            rawSamples: sampleRaw
        };

        console.log("============= 🧰 ODMatrix 诊断报告 =============");
        console.log(JSON.stringify(debugPayload, null, 2));
        console.log("================================================");
        
        return "诊断报告已输出，请复制上方的 JSON 提供分析。";
    };
}