"use strict";

var express = require('express');
var app = express();

app.use(express.static('public'));
app.use(express.static('../built/web'));

app.get('/', function (req, res) {
    res.redirect("/index.html")
});

app.listen(3232, function () {
});


// web socket server acting as a proxy for dev purposes
var WebSocket = require('faye-websocket'),
    http = require('http');

var clients = [];
var servers = [];
function startws(request, socket, body, sources, targets) {
    console.log('connection at ' + request.url);
    let ws = new WebSocket(request, socket, body);
    sources.push(ws);
    ws.on('message', function (event) {
        targets.forEach(function (tws) { tws.send(event.data); });
    });
    ws.on('close', function (event) {
        console.log('connection closed')
        sources.remove(ws)
        ws = null;
    });
    ws.on('error', function () {
        console.log('connection closed')
        sources.remove(ws);
        ws = null;
    })
}

var wsserver = http.createServer();
wsserver.on('upgrade', function (request, socket, body) {
    if (WebSocket.isWebSocket(request)) {
        /^\/client/i.test(request.url)
            ? startws(request, socket, body, clients, servers)
            : startws(request, socket, body, servers, clients);
    }
});

wsserver.listen(3000);