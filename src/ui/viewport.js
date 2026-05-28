import { state, subscribe } from '../state.js';

export function initViewport(DOM) {
    // ==========================================
    // 边界约束算法
    // ==========================================
    function clampCamera(newX, newY, newZoom) {
        if (state.mapDimensions.width === 0) return { x: newX, y: newY, zoom: newZoom };

        const rect = DOM.canvas.getBoundingClientRect();

        const fitZoom = Math.min(
            rect.width / state.mapDimensions.width,
            rect.height / state.mapDimensions.height
        );
        const MIN_ZOOM = fitZoom * 0.8;
        const MAX_ZOOM = 50;
        const clampedZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);

        const mapWidth = state.mapDimensions.width * clampedZoom;
        const mapHeight = state.mapDimensions.height * clampedZoom;

        const padX = rect.width * 0.1;
        const padY = rect.height * 0.1;

        let minX = (rect.width - padX) - mapWidth;
        let maxX = padX;
        let minY = (rect.height - padY) - mapHeight;
        let maxY = padY;

        const finalMinX = Math.min(minX, maxX);
        const finalMaxX = Math.max(minX, maxX);
        const finalMinY = Math.min(minY, maxY);
        const finalMaxY = Math.max(minY, maxY);

        const clampedX = Math.min(Math.max(newX, finalMinX), finalMaxX);
        const clampedY = Math.min(Math.max(newY, finalMinY), finalMaxY);

        return { x: clampedX, y: clampedY, zoom: clampedZoom };
    }

    // ==========================================
    // 视图基础设置
    // ==========================================
    DOM.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    DOM.mapLayer.addEventListener('load', () => {
        const natW = DOM.mapLayer.naturalWidth;
        const natH = DOM.mapLayer.naturalHeight;
        state.mapDimensions = { width: natW, height: natH };

        const rect = DOM.canvas.getBoundingClientRect();
        const scaleX = rect.width / natW;
        const scaleY = rect.height / natH;
        const initialZoom = Math.min(scaleX, scaleY) * 0.9;

        const initialX = (rect.width - (natW * initialZoom)) / 2;
        const initialY = (rect.height - (natH * initialZoom)) / 2;

        state.camera = { x: initialX, y: initialY, zoom: initialZoom };
        console.log('[System] Map loaded & autofitted. Natural:', natW, natH, 'Zoom:', initialZoom);
    });

    // ==========================================
    // 鼠标交互事件 (Pan & Zoom)
    // ==========================================
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    DOM.canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        DOM.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        const { x, y, zoom } = state.camera;
        state.camera = clampCamera(x + deltaX, y + deltaY, zoom);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        DOM.canvas.style.cursor = 'grab';
    });

    DOM.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const { x, y, zoom } = state.camera;
        const zoomFactor = 1.1;
        const direction = e.deltaY > 0 ? -1 : 1;
        const newZoom = direction > 0 ? zoom * zoomFactor : zoom / zoomFactor;

        if (newZoom < 0.001 || newZoom > 100) return;

        const rect = DOM.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;

        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;

        state.camera = clampCamera(newX, newY, newZoom);
    }, { passive: false });

    DOM.canvas.addEventListener('click', (e) => {
        if (Math.abs(e.clientX - lastMouseX) > 2 || Math.abs(e.clientY - lastMouseY) > 2) return;
        const rect = DOM.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const { x, y, zoom } = state.camera;

        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;
        console.log(`[Interaction] Clicked World Coordinates: (${worldX.toFixed(2)}, ${worldY.toFixed(2)})`);
    });

    // ==========================================
    // 视图同步订阅
    // ==========================================
    subscribe('camera', (cam) => {
        DOM.mapLayer.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.zoom})`;
        // TODO: renderHeatmap(); 
    });
}