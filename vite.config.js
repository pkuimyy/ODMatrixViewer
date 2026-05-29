import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                // 主应用入口
                main: resolve(__dirname, 'index.html'),
                // 独立的配置页入口
                settings: resolve(__dirname, 'settings.html')
            }
        }
    }
});