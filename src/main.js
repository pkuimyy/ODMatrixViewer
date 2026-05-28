import { state, subscribe } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
  /**
   * 限制相机坐标，防止图片被拖出可视区域
   */
  // --- 2. 更稳健的边界约束算法 (防死锁) ---
  function clampCamera(newX, newY, newZoom) {
    if (state.mapDimensions.width === 0) return { x: newX, y: newY, zoom: newZoom };

    const rect = DOM.canvas.getBoundingClientRect();

    // ==========================================
    // 1. 限制最小缩放率 (防止图片缩成一个点)
    // ==========================================
    // 计算刚好能完整塞入屏幕的缩放比例
    const fitZoom = Math.min(
      rect.width / state.mapDimensions.width,
      rect.height / state.mapDimensions.height
    );
    // 最多只允许比“完整显示”再缩小一点点 (比如 0.8 倍)，保证占据大量视野
    const MIN_ZOOM = fitZoom * 0.8;
    const MAX_ZOOM = 50;

    // 强制截断缩放级别
    const clampedZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);

    // ==========================================
    // 2. 计算 10% 的保守拖动边界 (保证覆盖 90% 范围)
    // ==========================================
    const mapWidth = state.mapDimensions.width * clampedZoom;
    const mapHeight = state.mapDimensions.height * clampedZoom;

    // 动态留白：允许屏幕边缘露出 10% 的背景
    const padX = rect.width * 0.1;
    const padY = rect.height * 0.1;

    // X轴边界计算：
    // 当往左拖 (查看右侧) 时，图片右边缘 (x + mapW) 至少要到达屏幕右侧留白处 (rect.width - padX)
    let minX = (rect.width - padX) - mapWidth;
    // 当往右拖 (查看左侧) 时，图片左边缘 (x) 最多只能进入屏幕 padX 的距离
    let maxX = padX;

    // Y轴边界计算：
    let minY = (rect.height - padY) - mapHeight;
    let maxY = padY;

    // 健壮性处理：如果图片被缩小到比屏幕还小，minX 会大于 maxX
    // 使用 Math.min 和 Math.max 进行动态解包，防止死锁
    const finalMinX = Math.min(minX, maxX);
    const finalMaxX = Math.max(minX, maxX);
    const finalMinY = Math.min(minY, maxY);
    const finalMaxY = Math.max(minY, maxY);

    // 最终截断平移坐标
    const clampedX = Math.min(Math.max(newX, finalMinX), finalMaxX);
    const clampedY = Math.min(Math.max(newY, finalMinY), finalMaxY);

    return { x: clampedX, y: clampedY, zoom: clampedZoom };
  }

  const DOM = {
    // ... 原有 DOM 获取
    mapUpload: document.getElementById('map-upload'),
    opacitySlider: document.getElementById('opacity-slider'),
    opacityDisplay: document.getElementById('opacity-display'),
    mapLayer: document.getElementById('map-baselayer'),
    canvas: document.getElementById('heatmap-canvas'),
    csvUpload: document.getElementById('file-upload'),     // CSV 输入框
    pointsValue: document.getElementById('points-value'),  // 点位数显示
    fileStatus: document.getElementById('file-status')     // 状态文本
  };

  // 禁用 Canvas 区域的默认右键菜单
  DOM.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // 监听图片加载完成，获取物理尺寸
  // --- 1. 修复图片加载：自适应屏幕并居中 (Fit to Screen) ---
  DOM.mapLayer.addEventListener('load', () => {
    const natW = DOM.mapLayer.naturalWidth;
    const natH = DOM.mapLayer.naturalHeight;
    state.mapDimensions = { width: natW, height: natH };

    // 获取当前视口大小
    const rect = DOM.canvas.getBoundingClientRect();

    // 计算缩放比例：取宽高缩放比中较小的一个，确保图片能完整放入屏幕，再乘以 0.9 留出 10% 边距
    const scaleX = rect.width / natW;
    const scaleY = rect.height / natH;
    const initialZoom = Math.min(scaleX, scaleY) * 0.9;

    // 计算居中的起始坐标
    const initialX = (rect.width - (natW * initialZoom)) / 2;
    const initialY = (rect.height - (natH * initialZoom)) / 2;

    // 赋值给 state，直接触发居中且适应屏幕的显示
    state.camera = { x: initialX, y: initialY, zoom: initialZoom };

    console.log('[System] Map loaded & autofitted. Natural:', natW, natH, 'Zoom:', initialZoom);
  });

  // ==========================================
  // 1. 地图导入与滑块逻辑
  // ==========================================

  // 地图图片导入
  DOM.mapUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // 释放旧的 URL 避免内存泄漏
      if (state.mapImageUrl) URL.revokeObjectURL(state.mapImageUrl);

      const url = URL.createObjectURL(file);
      state.mapImageUrl = url; // 触发 state 变更
    }
  });

  // 透明度滑块
  DOM.opacitySlider.addEventListener('input', (e) => {
    state.mapOpacity = parseInt(e.target.value, 10);
  });

  subscribe('mapImageUrl', (url) => {
    DOM.mapLayer.src = url;
    DOM.mapLayer.style.display = 'block';

    // 图片加载后，重置相机状态
    state.camera = { x: 0, y: 0, zoom: 1 };
  });

  subscribe('mapOpacity', (opacity) => {
    DOM.opacityDisplay.textContent = `${opacity}%`;
    DOM.mapLayer.style.opacity = opacity / 100;
  });

  // ==========================================
  // 2. 鼠标交互核心：平移 (Pan) 与缩放 (Zoom)
  // ==========================================

  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // 鼠标按下：开始拖拽
  DOM.canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    DOM.canvas.style.cursor = 'grabbing';
  });

  // --- 修改：鼠标移动 (平移) ---
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    const { x, y, zoom } = state.camera;
    // 应用边界约束
    state.camera = clampCamera(x + deltaX, y + deltaY, zoom);
  });

  // 鼠标抬起：结束拖拽
  window.addEventListener('mouseup', () => {
    isDragging = false;
    DOM.canvas.style.cursor = 'grab';
  });

  // --- 修改：滚轮滚动 (缩放) ---
  // --- 修复：滚轮滚动 (缩放) ---
  DOM.canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); // 阻止页面默认滚动

    const { x, y, zoom } = state.camera;
    const zoomFactor = 1.1; // 缩放灵敏度
    const direction = e.deltaY > 0 ? -1 : 1;

    const newZoom = direction > 0 ? zoom * zoomFactor : zoom / zoomFactor;

    // 🚨 修复 Bug：将下限放宽到 0.001，防止高分辨率大图的极小初始缩放率被拦截
    if (newZoom < 0.001 || newZoom > 100) return;

    // 获取鼠标在 Canvas 视口内的相对坐标
    const rect = DOM.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 屏幕坐标 -> 世界坐标
    const worldX = (mouseX - x) / zoom;
    const worldY = (mouseY - y) / zoom;

    // 保证缩放中心点在鼠标位置
    const newX = mouseX - worldX * newZoom;
    const newY = mouseY - worldY * newZoom;

    // 应用边界约束并更新状态
    state.camera = clampCamera(newX, newY, newZoom);
  }, { passive: false });

  // 鼠标点击：计算并打印世界坐标 (为后续选中网格做准备)
  DOM.canvas.addEventListener('click', (e) => {
    // 忽略拖拽结束时的伪点击
    if (Math.abs(e.clientX - lastMouseX) > 2 || Math.abs(e.clientY - lastMouseY) > 2) return;

    const rect = DOM.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { x, y, zoom } = state.camera;

    // 屏幕坐标 (Screen) -> 世界坐标 (World)
    const worldX = (mouseX - x) / zoom;
    const worldY = (mouseY - y) / zoom;

    console.log(`[Interaction] Clicked World Coordinates: (${worldX.toFixed(2)}, ${worldY.toFixed(2)})`);
  });

  // ==========================================
  // 3. 视图同步
  // ==========================================

  // 监听相机变化，同步给底图 CSS Transform
  subscribe('camera', (cam) => {
    // 采用 3d 变换开启硬件加速
    DOM.mapLayer.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.zoom})`;

    // TODO: 调用后续的 Canvas.setTransform() 重新绘制数据热力层
    // renderHeatmap(); 
  });

  // ==========================================
  // 3. 数据管线：Web Worker CSV 流式解析
  // ==========================================
  
  // 实例化 Worker (Vite 支持直接 import.meta.url 的方式引入 worker)
  const parserWorker = new Worker(new URL('./core/parser.worker.js', import.meta.url), { type: 'module' });

  // 全局存储接收到的批次数据
  const dataBatches = [];

  // 监听 CSV 文件上传
  DOM.csvUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    DOM.fileStatus.textContent = 'Parsing...';
    DOM.fileStatus.classList.replace('text--muted', 'text--accent');
    
    // 清空旧数据
    dataBatches.length = 0; 
    
    // 将 File 对象移交给 Worker (File 对象支持结构化克隆，可以直接发送)
    parserWorker.postMessage({ file });
  });

  // 监听 Worker 发回的消息
  parserWorker.onmessage = (e) => {
    const msg = e.data;

    if (msg.type === 'batch') {
      // 接收转移过来的 ArrayBuffer 并恢复成 Float32Array
      const floatArr = new Float32Array(msg.data);
      dataBatches.push(floatArr);
      
      // 动态更新侧边栏的加载状态和点位数
      DOM.pointsValue.textContent = msg.totalRows.toLocaleString();
      DOM.fileStatus.textContent = `Imported ${msg.totalRows.toLocaleString()} rows...`;
      
      console.log(`[Parser] Received batch: ${msg.rowCount} rows`);
    } 
    else if (msg.type === 'complete') {
      DOM.fileStatus.textContent = 'Data Ready';
      DOM.fileStatus.classList.replace('text--accent', 'text--muted');
      console.log('[Parser] Finished! Total batches:', dataBatches.length);
      
      // TODO: 将 dataBatches 存入 state，并触发初次渲染
      // state.rawBatches = dataBatches;
    }
    else if (msg.type === 'error') {
      DOM.fileStatus.textContent = 'Parse Error';
      console.error('[Parser Error]', msg.error);
    }
  };
});