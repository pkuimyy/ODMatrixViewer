import { state } from '../state.js';
// 🚨 修复：使用 Vite 推荐的 ?worker 后缀引入，彻底解决路径 404 和生产环境打包问题
import ParserWorker from './parser.worker.js?worker';

export function initDataPipeline(DOM) {
  // 实例化 Worker
  const parserWorker = new ParserWorker();
  
  const dataBatches = [];

  // 监听上传事件，移交 Worker
  DOM.csvUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    DOM.fileStatus.textContent = 'Parsing...';
    DOM.fileStatus.classList.replace('text--muted', 'text--accent');
    
    dataBatches.length = 0; 
    parserWorker.postMessage({ file });
  });

  // 接收 Worker 回传的数据
  parserWorker.onmessage = (e) => {
    const msg = e.data;

    if (msg.type === 'batch') {
      const floatArr = new Float32Array(msg.data);
      dataBatches.push(floatArr);
      
      DOM.pointsValue.textContent = msg.totalRows.toLocaleString();
      DOM.fileStatus.textContent = `Imported ${msg.totalRows.toLocaleString()} rows...`;
      
      console.log(`[Parser] Received batch: ${msg.rowCount} rows`);
    } 
    else if (msg.type === 'complete') {
      DOM.fileStatus.textContent = 'Data Ready';
      DOM.fileStatus.classList.replace('text--accent', 'text--muted');
      console.log('[Parser] Finished! Total batches:', dataBatches.length);
      
      // 🚨 解除注释：将数据挂载到全局状态，这会触发渲染引擎的监听
      state.rawBatches = dataBatches;
    }
    else if (msg.type === 'error') {
      DOM.fileStatus.textContent = 'Parse Error';
      console.error('[Parser Error]', msg.error);
    }
  };
}