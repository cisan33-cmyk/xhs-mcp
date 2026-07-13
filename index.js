import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const APIHZ_ID = '10019015';
const APIHZ_KEY = '4eb9aa1aba89a2d17e0e55be8ffa22c4';

const TOOLS = [{
  name: 'parse_xiaohongshu',
  description: '解析小红书笔记链接，返回标题、正文和图片列表',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '小红书笔记链接' }
    },
    required: ['url']
  }
}];

async function handleRequest(body) {
  const { method, params, id } = body;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'xhs-mcp', version: '1.0.0' }
      }
    };
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }

  if (method === 'tools/call') {
    const url = params?.arguments?.url;
    if (!url) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '请提供小红书链接' }] } };
    }
    try {
      const apiUrl = `https://cn.apihz.cn/api/caiji/xiaohongshu.php?id=${APIHZ_ID}&key=${APIHZ_KEY}&url=${encodeURIComponent(url)}`;
      const resp = await fetch(apiUrl);
      const data = await resp.json();
      if (data.code !== 200) {
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `解析失败：${data.msg || '未知错误'}` }] } };
      }
      const imgs = (data.img || []).map((u, i) => `图片${i + 1}：${u}`).join('\n');
      const text = `标题：${data.title}\n\n正文：${data.content}\n\n图片列表：\n${imgs}`;
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
    } catch (e) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `请求出错：${e.message}` }] } };
    }
  }

  if (method === 'notifications/initialized') {
    return null;
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
}

// SSE endpoint
app.get('/mcp', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  req.on('close', () => res.end());
});

// POST endpoint for messages
app.post('/mcp', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  const result = await handleRequest(req.body);
  if (result) {
    res.json(result);
  } else {
    res.status(204).end();
  }
});

app.options('/mcp', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).end();
});

app.get('/', (_, res) => res.send('xhs-mcp running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`listening on ${PORT}`));
