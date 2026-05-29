// src/render/color-utils.js

const REASON_COLORS = [
    [2, 132, 199], // 0: Work (Sky Blue)
    [22, 163, 74], // 1: Home (Green)
    [234, 88, 12], // 2: Leisure (Orange)
    [147, 51, 234] // 3: Other (Purple)
];

/**
 * 在灰白底图环境下：决定当前网格格子的混合色彩。
 * - Hue: 由当前格子数量占比最高的目的决定 (Dominant Component)
 * - Depth/Alpha: 依据 4 种目的的总热力值计算透明度 (值越大越不透明)
 */
export function getReasonColor(counts, maxRef) {
    let sum = 0;
    let maxC = -1;
    let dominantId = 0;

    for (let i = 0; i < 4; i++) {
        const c = counts[i];
        sum += c;
        if (c > maxC) {
            maxC = c;
            dominantId = i;
        }
    }

    if (sum === 0) return null;

    const [r, g, b] = REASON_COLORS[dominantId];

    const safeMaxRef = Math.max(maxRef, 1);
    let ratio = Math.log(sum + 1) / Math.log(safeMaxRef + 1);
    ratio = Math.min(Math.max(ratio, 0), 1);

    // Alpha 深度映射：最低保持 15% 透明度防止看不清，最大 95% (近似实心)
    const a = Math.min(0.15 + ratio * 0.8, 0.95);

    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}
