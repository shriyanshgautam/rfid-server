var express = require('express')
var moment = require('moment');
var bodyParser = require("body-parser");
var app = express()
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var scan_times = [];

var devices = [];

var groups = [];

var clients = [];

var RANGE_DURATION = 10;

app.use(bodyParser.urlencoded({ extended: true }));//true for parsing array in post
app.use(bodyParser.json());
app.use(express.static(__dirname + '/node_modules'));
app.set('view engine', 'ejs');

app.get('/', function (req, res) {
  //res.sendFile(__dirname + '/public/index.html');
  //res.send(req.body);
  res.render('index',{});
  console.log(req.body);
});

// 
app.get('/add_groups',function(req,res){
  //res.sendFile(__dirname + '/public/addgroups.html');
  res.render('addgroups',{groups:groups});
  console.log(req.body);
});

app.post('/add_group',function(req,res){
  console.log(req.body);
  var group = {group_name:req.body.group_name};
  group.users = [];
  for(var i=0;i<req.body.name.length;i++){
    var user = {name:req.body.name[i],id:req.body.id[i]};
    group.users.push(user);
  }

  groups.push(group);

  console.log(JSON.stringify(groups));
  res.redirect('/add_groups');
});


function find_scan(id){
  for(var index=0;index<scan_times.length;index++){
        if(scan_times[index].id==id)return true;
  }
 return false;
}

function add_scan(id,time,ip){
   var scan = {id:id,time:time,ip:ip};
   scan_times.push(scan);
}

function replace_scan(id,time,ip){
   for(var index=0;index<scan_times.length;index++){
        if(scan_times[index].id==id){
                scan_times[index].time = time;
                scan_times[index].ip = ip;
        }
  }

}

app.post('/read', function(req,res){
  res.send(req.body);
  var available = find_scan(req.body.id);
  if(available){
        replace_scan(req.body.id,moment().format(),req.body.device_ip);
  }else{
      add_scan(req.body.id,moment().format(),req.body.device_ip);
  }
   io.sockets.emit('messages','Read :'+req.body.id +' Time : '+ moment().format()+ ' IP : '+req.body.device_ip);
   console.log(req.body);
 });

 io.on('connection', function(client) {
     console.log('Client connected...');

     clients.push(client.id);
     client.on('join', function(data) {
         console.log(data);
         client.emit('messages','Hello from server');
     });
 });

 function check_device_exists(device_ip) {
   for (var i = 0; i < devices.length; i++) {
    if(devices[i].ip==device_ip)return true;
   }
   return false;
 }

 function add_device(device_ip){
    var device = {ip:device_ip,cards:[]};
    devices.push(device);
 }

 function update_card_in_device(ip,time,id){
    //TODO remove this card in any device
    for (var i = 0; i < devices.length; i++) {
        for (var j = 0; j < devices[i].cards.length; j++) {
          //if card exists in that device
          if(devices[i].cards[j].id==id){
            //remove it
                devices[i].cards.splice(j, 1);
          }
        }      
    }

    //updating card in required device
    for (var i = 0; i < devices.length; i++) {
      if(devices[i].ip==ip){
        //else add card
          var card = {id:id,time:time};
          devices[i].cards.push(card);
      }
   }
 }





 setInterval(function(){
     //io.sockets.emit('status',JSON.stringify(scan_times));
     
     //segeagagting cards by devices
     for (var i = 0; i<scan_times.length; i++) {
        if(!check_device_exists(scan_times[i].ip)){
            add_device(scan_times[i].ip);
        }
        //add card to device
        update_card_in_device(scan_times[i].ip,scan_times[i].time,scan_times[i].id)
     }

     //console.log(JSON.stringify(devices));

     var group_devices = [];
     //compare devices with groups
      for (var i = 0; i<groups.length; i++) {
        var users = groups[i].users;

        var group_device = {group_name:groups[i].group_name};
        group_device.devices = [];
       
        for (var j = 0; j < devices.length; j++) {
          var cards = devices[j].cards;
          var count_in_device = 0;

          console.log("yes");

          var device_in_group = {};
          device_in_group.ip = devices[j].ip;
          //group_device.group_name = groups[i].group_name;
          device_in_group.users = [];


          for (var k = 0; k < users.length; k++) {
            for (var l = 0; l < cards.length; l++) {
              if(users[k].id==cards[l].id){
                  

                  var difference = moment().diff(moment(cards[l].time));
                  var duration = moment.duration(difference).asSeconds();

                  var card_device = {id:users[k].id,time:cards[l].time,duration:duration};
                 

                device_in_group.users.push(card_device);
              }
            }
          }

          group_device.devices.push(device_in_group);


        }

        group_devices.push(group_device);

        


        //if no users in the deivce then false
        //if less thn half of users are in device then red
        //if more than half of users are in a device than that is yellow
        //if more all users are in device then green

        //for that group in that device
      }

      console.log(JSON.stringify(group_devices));
      io.sockets.emit('full_status',JSON.stringify(group_devices));
      //console.log(clients.length);
     /*var inrange_durations = [];
     var outrange_durations = [];
     var current = moment();
     for(var index=0;index<scan_times.length;index++){
         var difference = current.diff(moment(scan_times[index].time));
         var seconds = moment.duration(difference).asSeconds();
         var scan = {id:scan_times[index].id,duration:seconds};
         if(seconds>RANGE_DURATION){
                 outrange_durations.push(scan);
         }else{
                 inrange_durations.push(scan);
         }
         //durations.push(scan);
         io.sockets.emit('in_status',JSON.stringify(inrange_durations));
         io.sockets.emit('out_status',JSON.stringify(outrange_durations));
     }*/
 }, 10000);

 server.listen(3000,function(){
  console.log('Listening on Port : 3000');
 });
