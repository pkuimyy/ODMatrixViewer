// src/core/parser.worker.js
const BATCH_SIZE = 500000;
const FLOATS_PER_RECORD = 6; // 🚀 新增一列：Ox, Oy, Dx, Dy, Hour, ReasonId
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

// 💡 基于 Cities: Skylines 原生 TransferReason 枚举的精确分类
function parseReasonToCategory(raw) {
    if (raw === undefined || raw === null) return 3; // 默认为 Other

    const str = raw.toString().trim().toLowerCase();

    // 1. 文本匹配 (兼容用户自己导出的文本型 CSV 或多语言别名)
    if (str.match(/work|school|study|job|educat/)) return 0;
    if (str.match(/home|return|residen|family|single|partner/)) return 1;
    if (str.match(/shop|leisure|entertain|visit|tourist|nature|business/)) return 2;

    // 2. 底层枚举纯数字精确匹配 (CSL TransferReason Enum)
    const num = parseInt(str, 10);
    if (!isNaN(num)) {
        // 💼 Category 0: Work / School (通勤 / 上学)
        // Worker0(4) ~ Worker3(7), Student1(8) ~ Student3(10)
        if (num >= 4 && num <= 10) return 0;

        // 🏡 Category 1: Home / Resident (回家 / 居住)
        // Family0(20) ~ PartnerAdult(29), Single0B(47) ~ Single3B(50)
        if ((num >= 20 && num <= 29) || (num >= 47 && num <= 50)) return 1;

        // 🛒 Category 2: Shopping / Entertainment (商业 / 娱乐 / 观光)
        if (
            num === 30 || // Shopping
            num === 36 || // Entertainment
            (num >= 51 && num <= 60) || // ShoppingB-H(51-57), EntertainmentB-D(58-60)
            (num >= 88 && num <= 91) || // TouristA-D(88-91)
            (num >= 119 && num <= 126)  // BusinessA-D(119-122) (公园商业区观光), NatureA-D(123-126) (自然保护区观光)
        ) {
            return 2;
        }

        // 📦 Category 3: Other (其他物流/公共服务/特殊状态)
        // 包含 Garbage, Crime, Sick, Dead, Fire, 货物(Goods/Oil/Ore/Logs), 各类交通工具(Bus/Train/Taxi), 邮政(Mail), 工业DLC产品等...
        return 3;
    }

    return 3; 
}

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

            // 📌 解析 Reason
            const reasonId = parseReasonToCategory(parts[3]);

            // 📍 坐标提取：更新为新的列索引 (5: OriginX, 6: OriginZ, 7: DestX, 8: DestZ)
            buffer[bufferIndex++] = parseFloat(parts[5]); // Ox
            buffer[bufferIndex++] = parseFloat(parts[6]); // Oy
            buffer[bufferIndex++] = parseFloat(parts[7]); // Dx
            buffer[bufferIndex++] = parseFloat(parts[8]); // Dy
            buffer[bufferIndex++] = hour; // Hour
            buffer[bufferIndex++] = reasonId; // Reason

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
