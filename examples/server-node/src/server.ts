import { createServer } from 'node:http';
import { createChatHandler, ChatHandlerError } from '@aicl/server';
import type { Message, StreamEvent } from '@aicl/core';

const PORT = Number(process.env['AICL_PORT'] ?? '5174');
const HOST = process.env['AICL_HOST'] ?? '127.0.0.1';

const chatHandler = createChatHandler(async function* chat(req) {
  const last = req.messages[req.messages.length - 1] as Message | undefined;
  const userText =
    last?.role === 'user'
      ? last.parts
          .map((part) => (part.type === 'text' ? part.text : ''))
          .join(' ')
          .trim()
      : 'Show the work';

  yield { type: 'message-start', id: crypto.randomUUID(), role: 'assistant' };
  yield { type: 'part-start', index: 0, part: { type: 'reasoning', text: `Thinking about: ${userText}.` } };
  yield { type: 'part-start', index: 1, part: { type: 'text', text: '' } };

  const body = `Edited two files. ${userText}. Checks passed.`;
  for (const word of body.split(/(\s+)/)) {
    if (req.signal.aborted) return;
    yield { type: 'part-delta', index: 1, delta: word };
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  yield {
    type: 'part-start',
    index: 2,
    part: { type: 'tool-call', toolCallId: crypto.randomUUID(), name: 'search', args: {}, status: 'running' },
  };
  yield {
    type: 'part-end',
    index: 2,
    part: {
      type: 'tool-call',
      toolCallId: 'demo',
      name: 'search',
      args: { q: userText },
      status: 'success',
    },
  };

  yield {
    type: 'part-start',
    index: 3,
    part: { type: 'artifact', artifactId: 'notes', kind: 'document', title: 'Server notes', version: 1 },
  };

  yield { type: 'message-end', finishReason: 'stop' };
});

const httpServer = createServer(async (req, res) => {
  if (req.method !== 'POST' || !req.url?.startsWith('/chat')) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', async () => {
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      res.statusCode = 400;
      res.end('invalid json');
      return;
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key.toLowerCase()] = value;
    }

    let response;
    try {
      response = await chatHandler(body, headers, req.signal);
    } catch (cause) {
      if (cause instanceof ChatHandlerError) {
        res.statusCode = cause.status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ message: cause.message, retryable: cause.retryable }));
        return;
      }
      res.statusCode = 500;
      res.end('internal error');
      return;
    }

    res.statusCode = 200;
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');

    try {
      for await (const frame of response.toSse()) {
        if (res.writableEnded) return;
        res.write(frame);
      }
    } finally {
      res.end();
    }
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`aicl-server-node listening on http://${HOST}:${PORT}`);
});
