import { state } from './state.js'; // 引入以获取默认的兜底结构（供重置使用）

const STORAGE_KEY = 'odmatrix_reason_config';

document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('json-editor');
    const btnSave = document.getElementById('btn-save');
    const btnReset = document.getElementById('btn-reset');

    // 初始化：读取当前存储的数据并格式化显示
    try {
        const currentData = localStorage.getItem(STORAGE_KEY);
        // 如果 localStorage 中有数据则读取，否则读取 state 中的运行时数据
        const displayData = currentData ? JSON.parse(currentData) : state.reasonConfig;
        editor.value = JSON.stringify(displayData, null, 4);
    } catch (e) {
        editor.value = '[]';
    }

    // 保存逻辑
    btnSave.addEventListener('click', () => {
        try {
            const parsedConfig = JSON.parse(editor.value);
            if (!Array.isArray(parsedConfig)) {
                throw new Error('Root element must be a JSON array.');
            }

            // 存入 localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedConfig));

            // 提示用户并强制刷新回主页面
            alert('Configuration saved successfully. The application will now reload.');
            window.location.href = '/';
        } catch (error) {
            alert('❌ Invalid JSON format:\n' + error.message);
        }
    });

    // 恢复默认设置逻辑
    btnReset.addEventListener('click', () => {
        const confirmReset = confirm(
            'Are you sure you want to restore the default configuration? All custom mappings will be lost.'
        );
        if (confirmReset) {
            localStorage.removeItem(STORAGE_KEY);
            alert('Restored to defaults. The application will now reload.');
            window.location.href = '/';
        }
    });
});
