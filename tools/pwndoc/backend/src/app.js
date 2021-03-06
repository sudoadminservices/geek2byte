var fs = require('fs');
var app = require('express')();
var https = require('https').Server({
  key: fs.readFileSync(__dirname+'/../ssl/server.key'),
  cert: fs.readFileSync(__dirname+'/../ssl/server.cert')
}, app);
var io = require('socket.io')(https);
var bodyParser = require('body-parser');

// Get configuration
var env = process.env.NODE_ENV || 'dev';
var config = require('./config.json')[env];
global.__basedir = __dirname;

// Database connection
var mongoose = require('mongoose');
// Use native promises
mongoose.Promise = global.Promise;

mongoose.connect(`mongodb://${config.database.server}:${config.database.port}/${config.database.name}`, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify: false});

// Models import
require('./models/user');
require('./models/audit');
require('./models/client');
require('./models/company');
require('./models/template');
require('./models/vulnerability');
require('./models/vulnerability-update');
require('./models/language');
require('./models/audit-type');
require('./models/vulnerability-type');
require('./models/resolution');
require('./models/vulnerability-category');
require('./models/custom-section');

// Socket IO configuration
var getSockets = function(room) {
  return Object.entries(io.sockets.adapter.rooms[room] === undefined ? {} : io.sockets.adapter.rooms[room].sockets)
  .filter(([id, status]) => status) // get status === true
  .map(([id]) => io.sockets.connected[id])
}

io.on('connection', (socket) => {
  socket.on('join', (data) => {
    console.log(`user ${data.username} joined room ${data.room}`)
    socket.username = data.username;
    do { socket.color = '#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6); } while (socket.color === "#77c84e")
    socket.join(data.room);
    io.to(data.room).emit('updateUsers');
  });
  socket.on('leave', (data) => {
    console.log(`user ${data.username} left room ${data.room}`)
    socket.leave(data.room, () => {
      io.to(data.room).emit('updateUsers');
    })
  })
  socket.on('updateUsers', (data) => {
    var userList = [...new Set(getSockets(data.room).map(s => {
      var user = {};
      user.username = s.username;
      user.color = s.color;
      user.menu = s.menu;
      if (s.finding) user.finding = s.finding; 
      if (s.section) user.section = s.section; 
      return user;
    }))];
    io.to(data.room).emit('roomUsers', userList);
  })
  socket.on('menu', (data) => {
    socket.menu = data.menu;
    (data.finding)? socket.finding = data.finding: delete socket.finding;
    (data.section)? socket.section = data.section: delete socket.section;
    io.to(data.room).emit('updateUsers');
  })
  socket.on('disconnect', () => {
    socket.broadcast.emit('updateUsers')
  })
});

// CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,PUT,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header('Access-Control-Expose-Headers', 'Content-Disposition')
  next();
});

app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({
  limit: '10mb',
  extended: false // do not need to take care about images, videos -> false: only strings
}));

// Routes import
require('./routes/user')(app);
require('./routes/audit')(app, io);
require('./routes/client')(app);
require('./routes/company')(app);
require('./routes/vulnerability')(app);
require('./routes/template')(app);
require('./routes/vulnerability')(app);
require('./routes/data')(app);

app.get("*", function(req, res) {
    res.status(404).json({"status": "error", "data": "Route undefined"});
})

// Start server

https.listen(config.port, config.host)

module.exports = app;
