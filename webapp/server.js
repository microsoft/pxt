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
