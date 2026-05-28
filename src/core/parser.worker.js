// src/core/parser.worker.js
const BATCH_SIZE = 500000;
const FLOATS_PER_RECORD = 5;
const TICKS_PER_HOUR = 36000000000n;

self.onmessage = async (e) => {
    const { file } = e.data;
    if (!file) return;

    try {
        await processFileUniversal(file);
        self.postMessage({ type: "complete" });
    } catch (err) {
        self.postMessage({ type: "error", error: err.message });
    }
};

// 🌟 跨浏览器兼容的流式读取方案 (Firefox / Safari 均完美支持)
async function processFileUniversal(file) {
    const chunkSize = 1024 * 1024 * 5; // 每次读取 5MB 块
    let offset = 0;
    let leftover = "";
    let isFirstLine = true;
    let totalRows = 0;

    let buffer = new Float32Array(BATCH_SIZE * FLOATS_PER_RECORD);
    let bufferIndex = 0;

    while (offset < file.size) {
        // 截取文件分块
        const chunk = file.slice(offset, offset + chunkSize);
        // Blob.text() 是所有现代浏览器都稳定支持的 API
        const text = await chunk.text();
        offset += chunkSize;

        const lines = (leftover + text).split("\n");
        leftover = lines.pop(); // 弹出最后一行不完整的，留给下个循环

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (isFirstLine) {
                isFirstLine = false;
                continue;
            }

            const parts = line.split(",");
            // 🚨 适配新格式，列数变成了 9
            if (parts.length < 9) continue;

            // 🕒 时间解析：将 0.0 ~ 1.0 映射到 0 ~ 23 小时
            const gameTimeOfDay = parseFloat(parts[1]);
            let hour = 12; // 默认防错回退值
            if (!isNaN(gameTimeOfDay)) {
                hour = Math.floor(gameTimeOfDay * 24) % 24;
            }

            // 📍 坐标提取：更新为新的列索引 (5: OriginX, 6: OriginZ, 7: DestX, 8: DestZ)
            buffer[bufferIndex++] = parseFloat(parts[5]); // Ox
            buffer[bufferIndex++] = parseFloat(parts[6]); // Oy
            buffer[bufferIndex++] = parseFloat(parts[7]); // Dx
            buffer[bufferIndex++] = parseFloat(parts[8]); // Dy
            buffer[bufferIndex++] = hour; // Hour

            totalRows++;

            totalRows++;

            // 缓冲区满，转移所有权并开辟新内存
            if (bufferIndex >= buffer.length) {
                self.postMessage(
                    {
                        type: "batch",
                        data: buffer.buffer,
                        rowCount: BATCH_SIZE,
                        totalRows: totalRows,
                    },
                    [buffer.buffer],
                );
                buffer = new Float32Array(BATCH_SIZE * FLOATS_PER_RECORD);
                bufferIndex = 0;
            }
        }
    }

    // 处理收尾数据
    if (bufferIndex > 0) {
        const finalBuffer = buffer.slice(0, bufferIndex);
        self.postMessage(
            {
                type: "batch",
                data: finalBuffer.buffer,
                rowCount: bufferIndex / FLOATS_PER_RECORD,
                totalRows: totalRows,
            },
            [finalBuffer.buffer],
        );
    }
}
