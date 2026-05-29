// src/render/color-utils.js

/**
 * 根据网格的计数值和最大参考值计算赛博风格的渐变颜色
 * @param {number} value - 当前网格的聚合计数值
 * @param {number} maxRef - 95% 分位数最大参考值
 * @returns {string} rgba 颜色字符串
 */
export function getCyberColor(value, maxRef) {
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
