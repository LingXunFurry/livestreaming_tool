import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {WebSocketServer} from 'ws';
import {createCollector} from '../server/collector.mjs';

test('一键采集通过本机控制和数据接口工作，停止后关闭自有连接', {timeout: 15000}, async () => {
  let config = {platform: 'bilibili', url: '', ws_forward_enable: true};
  const commands = [];
  const messages = [];
  const states = [];
  let dataConnections = 0;
  let dataSocket;
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.end(JSON.stringify(config));
  });
  const sockets = new WebSocketServer({noServer: true});
  server.on('upgrade', (request, socket, head) => sockets.handleUpgrade(request, socket, head, client => {
    if (request.url === '/ws/ui') client.on('message', raw => {
      const command = JSON.parse(raw.toString());
      commands.push(command.action);
      if (command.action === 'start') config = command.config;
    });
    if (request.url === '/ws/data') {
      dataConnections += 1;
      dataSocket = client;
      client.send(JSON.stringify({type: '弹幕', user: '本地模拟器', msg: '自动接入测试'}));
    }
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const collector = createCollector('bilibili', process.cwd(), raw => messages.push(JSON.parse(raw.toString())), () => states.push(collector.getState().state));
  try {
    await collector.start({roomAddress: '14041317', collector: {url: `ws://127.0.0.1:${port}/ws/data`, executable: '', autoStart: false}});
    await delay(50);
    assert.equal(collector.getState().state, 'CONNECTED');
    assert.equal(config.platform, 'bilibili');
    assert.equal(config.url, 'https://live.bilibili.com/14041317');
    assert.equal(config.ws_forward_enable, false);
    assert.equal(messages[0].msg, '自动接入测试');
    await collector.stop();
    await delay(50);
    assert.deepEqual(commands, ['start', 'stop']);
    assert.equal(collector.getState().state, 'STOPPED');
    assert.ok(states.includes('CONNECTING'));
    await collector.start({roomAddress: '14041317', collector: {url: `ws://127.0.0.1:${port}/ws/data`, executable: '', autoStart: false}});
    config = {...config, url: 'https://live.bilibili.com/999'};
    dataSocket.close();
    await delay(2500);
    assert.equal(dataConnections, 2);
    assert.equal(collector.getState().state, 'UNAVAILABLE');
    assert.match(collector.getState().error, /房间/);
  } finally {
    await collector.stop();
    for (const client of sockets.clients) client.terminate();
    await new Promise(resolve => sockets.close(resolve));
    await new Promise(resolve => server.close(resolve));
  }
});
