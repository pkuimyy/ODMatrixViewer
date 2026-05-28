// src/core/parser.worker.js

// 每批次发送给主线程的数据量（50万条）
const BATCH_SIZE = 500000;
// 每个记录提取 5 个浮点数: [OriginX, OriginZ, DestX, DestZ, Hour]
const FLOATS_PER_RECORD = 5; 

// C# Ticks 转换为小时的除数 (1小时 = 36,000,000,000 ticks)
const TICKS_PER_HOUR = 36000000000n;

self.onmessage = async (e) => {
  const { file } = e.data;
  if (!file) return;

  try {
    await processStreamingCSV(file);
    self.postMessage({ type: 'complete' });
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message });
  }
};

async function processStreamingCSV(file) {
  // 使用原生 Stream API 读取文件，防止大文件一次性撑爆内存
  const stream = file.stream().pipeThrough(new TextDecoderStream());
  const reader = stream.getReader();

  let leftover = '';
  let isFirstLine = true;
  let totalRows = 0;

  // 预分配内存，避免垃圾回收 (GC) 停顿
  let buffer = new Float32Array(BATCH_SIZE * FLOATS_PER_RECORD);
  let bufferIndex = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // 将上一个 chunk 截断的半行拼接到当前 chunk 头部
    const text = leftover + value;
    const lines = text.split('\n');

    // 最后一行往往是不完整的，弹出来留给下一个 chunk
    leftover = lines.pop();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (isFirstLine) {
        isFirstLine = false;
        continue; // 跳过表头
      }

      // 按逗号分割。这里为了极致性能，并没有使用复杂的正则
      // 假设结构永远是: Time, CitizenId, Reason, Type, Ox, Oz, Dx, Dz
      const parts = line.split(',');
      if (parts.length < 8) continue;

      // 解析时间戳得到 0-23 的小时
      // 注意：JS 处理 18 位大整数会丢失精度，必须用 BigInt 转换
      const ticks = BigInt(parts[0]);
      const hour = Number((ticks / TICKS_PER_HOUR) % 24n);

      // 解析坐标 (注意：取 Z 作为 2D 画布的 Y)
      const ox = parseFloat(parts[4]);
      const oy = parseFloat(parts[5]); 
      const dx = parseFloat(parts[6]);
      const dy = parseFloat(parts[7]);

      // 压入扁平化数组
      buffer[bufferIndex++] = ox;
      buffer[bufferIndex++] = oy;
      buffer[bufferIndex++] = dx;
      buffer[bufferIndex++] = dy;
      buffer[bufferIndex++] = hour;
      
      totalRows++;

      // 如果缓冲区满了，立即转移 (Transfer) 给主线程
      if (bufferIndex >= buffer.length) {
        self.postMessage({
          type: 'batch',
          data: buffer.buffer, 
          rowCount: BATCH_SIZE,
          totalRows: totalRows
        }, [buffer.buffer]); // 🚨 核心魔法：所有权转移，零拷贝！

        // 重新分配新的内存块
        buffer = new Float32Array(BATCH_SIZE * FLOATS_PER_RECORD);
        bufferIndex = 0;
      }
    }
  }

  // 处理最后剩余的数据
  if (bufferIndex > 0) {
    const finalBuffer = buffer.slice(0, bufferIndex);
    self.postMessage({
      type: 'batch',
      data: finalBuffer.buffer,
      rowCount: bufferIndex / FLOATS_PER_RECORD,
      totalRows: totalRows
    }, [finalBuffer.buffer]);
  }
}