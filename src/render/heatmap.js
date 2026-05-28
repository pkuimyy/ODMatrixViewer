// src/render/heatmap.js
import { state, subscribe } from '../state.js';

export function initRenderer(DOM) {
    const canvas = DOM.canvas;
    const ctx = canvas.getContext('2d');

    // 处理高分屏模糊问题
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        // CSS 尺寸保持不变
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        // 基础缩放应用 dpr
        ctx.scale(dpr, dpr);
        render();
    }

    // ==========================================
    // 核心渲染主循环
    // ==========================================
    let renderFrameId = null;

    function render() {
        // 性能优化：避免在同一帧内多次调用 render
        if (renderFrameId) cancelAnimationFrame(renderFrameId);

        renderFrameId = requestAnimationFrame(() => {
            const { width, height } = canvas.getBoundingClientRect();

            // 1. 清空上一帧
            ctx.clearRect(0, 0, width, height);

            const batches = state.rawBatches;
            if (!batches || batches.length === 0) return;

            const { x, y, zoom } = state.camera;
            const timeSlice = state.timeSlice;
            const showO = state.filters.O;
            const showD = state.filters.D;

            // 2. 应用相机视图矩阵
            ctx.save();
            // 这里是性能关键：让底层 C++ 处理所有的坐标转换缩放，避免我们在 JS 里遍历计算
            ctx.translate(x, y);
            ctx.scale(zoom, zoom);

            // 3. 遍历数据并绘制
            // 我们的数据结构是：[Ox, Oy, Dx, Dy, Hour] (5个为一组)
            for (let b = 0; b < batches.length; b++) {
                const batch = batches[b];

                for (let i = 0; i < batch.length; i += 5) {
                    // 过滤时间切片 (batch[i+4] 是 Hour)
                    if (batch[i + 4] === timeSlice) {

                        // 绘制起点 (Origin) - 亮蓝色
                        if (showO) {
                            ctx.fillStyle = 'rgba(14, 165, 233, 0.6)';
                            // 参数: X, Y, 宽, 高 (在世界坐标系下，这里画一个 2x2 单位的方块)
                            ctx.fillRect(batch[i], batch[i + 1], 2, 2);
                        }

                        // 绘制终点 (Destination) - 亮橙色
                        if (showD) {
                            ctx.fillStyle = 'rgba(249, 115, 22, 0.6)';
                            ctx.fillRect(batch[i + 2], batch[i + 3], 2, 2);
                        }
                    }
                }
            }

            ctx.restore();
            renderFrameId = null;
        });
    }

    // ==========================================
    // 订阅状态机：只要以下状态改变，就触发重新渲染
    // ==========================================
    subscribe('camera', render);
    subscribe('timeSlice', render);
    subscribe('filters', render);
    subscribe('rawBatches', render); // 数据加载完毕后自动画出第一帧

    // 初始化视口尺寸
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
}