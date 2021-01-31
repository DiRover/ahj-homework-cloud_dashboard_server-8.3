const http = require('http');
const Koa = require('koa');
const Router = require('koa-router');
const WS = require('ws');
const app = new Koa();
const { v4: uuidv4 } = require('uuid'); //Двоеточие показывает «что : куда идёт». В метод v4 объекта uuid сохраняется в переменную uuidv4
let instances = []

class Instance {
  constructor (id, status) {
    this.id = id;
    this.status = status;
  }
};

console.log('server is working');

app.use(async (ctx, next) => {
  ctx.body = 'server is working';
});

app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return await next();
  }

  const headers = { 'Access-Control-Allow-Origin': '*', };

  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
    }

    ctx.response.status = 204;
  }
});

const router = new Router();

router.get('/index', async (ctx) => {
  ctx.response.body = 'hello';
});

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback())
const wsServer = new WS.Server({ server });

wsServer.on('connection', (ws, req) => {
  ws.on('message', msg => {
    const requset = JSON.parse(msg);//парсим запрос
    const id = requset.id;//записываем id сервера относительно которого пришёл запрос
    console.log(requset);
    if (requset.type === 'get list') {
      console.log(instances); //отправляем список серверов
      const data = {type: 'list', list: instances};
      const response = JSON.stringify(data);
      ws.send(response);
    } else if (requset.type === 'create') {
      const id = uuidv4();//создаём сервер и уникальным id
      const instance = new Instance(id, 'Stopped');//новый сервер всегда остановлен
      instances.push(instance);//записываем в массив серверов
      const data = {type: 'server info', id: id, msg: 'Received \"Create command\"'};
      const response = JSON.stringify(data);//msg для сообщения в ворклог
      sendResponse(response);//отправляем всем пользовотелям инфу о new/start/stop/kill сервере
      setTimeout(() => {
        const data = {type: 'new instance', id: id, status: 'Stopped', msg: 'Created'};
        const response = JSON.stringify(data);
        sendResponse(response);//отправляем всем пользовотелям инфу о new/start/stop/kill сервере
      }, 3000);
    } else if (requset.type === 'play_arrow') {
      instances.forEach((instance) => {
        if (instance.id === id) {
          instance.status = 'Running'
        }
      });
      const data = {type: 'server info', id: id, msg: 'Received \"Start command\"'};
      const response = JSON.stringify(data);
      sendResponse(response);//отправляем всем пользовотелям инфу о new/start/stop/kill сервере
      setTimeout(() => {
        const data = {type: 'run', id: id, status: 'Running', msg: 'Started'};
        const response = JSON.stringify(data);
        sendResponse(response);//отправляем всем пользовотелям инфу о new/start/stop/kill сервере
      }, 3000);
    } else if (requset.type === 'pause') {
      instances.forEach((instance) => {
        if (instance.id === id) {
          instance.status = 'Stopped';
        }
      });
      const data = {type: 'server info', id: id, msg: 'Received \"Stop command\"'};
      const response = JSON.stringify(data);
      sendResponse(response);//отправляем всем пользовотелям инфу о new/start/stop/kill сервере
      setTimeout(() => {
        const data = {type: 'stop', id: id, status: 'Stopped', msg: 'Server stopped'};
        const response = JSON.stringify(data);
        sendResponse(response);//отправляем всем пользовотелям инфу о new/start/stop/kill сервере
      }, 3000)
    } else if (requset.type === 'clear') {
      instances = instances.filter(instance => instance.id !== id);
      const data = {type: 'server info', id: id, msg: 'Received \"Kill command\"'};
      const response = JSON.stringify(data);
      sendResponse(response);//отправляем всем пользовотелям инфу о new/start/stop/kill сервере
      setTimeout(() => {
        const data = {type: 'kill', id: id, status: 'Died', msg: 'Server deleted'};
        const response = JSON.stringify(data);
        sendResponse(response);
      }, 3000)
    };
  });
});

function sendResponse(response) { //функция для отправки сообщения всем пользователям
  [...wsServer.clients]
    .filter(channel => channel.readyState === WS.OPEN)
    .forEach(channel => {channel.send(response)});
}

server.listen(port);
