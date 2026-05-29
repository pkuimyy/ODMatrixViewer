import { state, subscribe } from '../state.js';
// 🚨 修复：使用 Vite 推荐的 ?worker 后缀引入，彻底解决路径 404 和生产环境打包问题
import ParserWorker from './parser.worker.js?worker';

export function initDataPipeline(DOM) {
    const parserWorker = new ParserWorker();
    const dataBatches = [];

    // 🚀 1. 启动时立即向 Worker 发送当前的解析规则
    parserWorker.postMessage({ type: 'config', payload: state.reasonConfig });

    // 🚀 2. 监听全局配置变更，实时同步给 Worker
    subscribe('reasonConfig', (newConfig) => {
        parserWorker.postMessage({ type: 'config', payload: newConfig });
        console.log('[Pipeline] Worker syntax updated by new config.');
    });

    DOM.csvUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        DOM.fileStatus.textContent = 'Parsing...';
        DOM.fileStatus.classList.replace('text--muted', 'text--accent');

        dataBatches.length = 0;
        // 🚀 注意这里传递时包装 type
        parserWorker.postMessage({ type: 'parse', file });
    });

    // 接收 Worker 回传的数据
    parserWorker.onmessage = (e) => {
        const msg = e.data;

        if (msg.type === 'batch') {
            const floatArr = new Float32Array(msg.data);
            dataBatches.push(floatArr);

            DOM.fileStatus.textContent = `Imported ${msg.totalRows.toLocaleString()} rows...`;

            console.log(`[Parser] Received batch: ${msg.rowCount} rows`);
        } else if (msg.type === 'complete') {
            DOM.fileStatus.textContent = 'Data Ready';
            DOM.fileStatus.classList.replace('text--accent', 'text--muted');
            console.log('[Parser] Finished! Total batches:', dataBatches.length);

            // 使用扩展运算符创建全新引用，确保 state Proxy 能够监听到变动
            state.rawBatches = [...dataBatches];
        } else if (msg.type === 'error') {
            DOM.fileStatus.textContent = 'Parse Error';
            console.error('[Parser Error]', msg.error);
        }
    };
}
