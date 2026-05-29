import { state } from '../state.js';

export function getReasonColor(counts, maxRef) {
    let sum = 0;
    let maxC = -1;
    let dominantId = 0;

    // 🚀 动态适应任意维度的 counts 数组
    for (let i = 0; i < counts.length; i++) {
        const c = counts[i];
        sum += c;
        if (c > maxC) {
            maxC = c;
            dominantId = i;
        }
    }

    if (sum === 0) return null;

    // 🚀 从全局配置中读取当前主导类的颜色 (做防越界兜底)
    const config = state.reasonConfig.find((r) => r.id === dominantId) || state.reasonConfig[0];
    const [r, g, b] = config ? config.color : [128, 128, 128]; // 默认灰色兜底

    const safeMaxRef = Math.max(maxRef, 1);
    let ratio = Math.log(sum + 1) / Math.log(safeMaxRef + 1);
    ratio = Math.min(Math.max(ratio, 0), 1);

    const a = Math.min(0.15 + ratio * 0.8, 0.95);
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}
