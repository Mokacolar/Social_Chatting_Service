const express = require('express');
const prod = process.env.NODE_ENV === 'production';
const app = express();
const db = require('./models');
const path = require('path');
const userRouter = require('./routes/user');
const mainRouter = require('./routes/main');
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const port = prod ? process.env.port : 3000;

server.listen(port, () => {
    console.log(`포트 ${port} 번 연결됨.`);
})

//http=80
//    s=443
//local = 3000
app.get('/', (req, res) => {
    return res.sendFile(path.resolve(__dirname+"/views/chat.html"));
});

//db 설정
db.sequelize.sync({force : false})
    .then(() => {
        console.log('DB 연결');
    })
    .catch(err => {
        console.log(err);
    }) 

// 현재 online인 회원이 담기는 object 
let onlineUsers = []; 

//socket
io.on('connection', function (socket) {
    console.log(`소켓 연결 완료 포트 : ${port}`);

    //Join
    socket.on("join user", async function (data, cb) {
        var checked = await db.members.findOne({where : {userId : data.id}})
        if (checked) {
            cb({result: false, data: "이미 존재하는 회원입니다."});
            return false;
        } else {
            db.members.create({userId : data.id, password : data.pw})
            cb({result: true, data: "회원가입에 성공하였습니다."});
            return true;
        }
    });

    //Login
    socket.on("login user", async function (data, cb) {
        var checked = await db.members.findOne({where : {userId : data.id, password : data.pw}});
        if (checked) {
            onlineUsers[data.id] = {roomId: 0, socketId: socket.id};
            cb({result: true, data: "로그인에 성공하였습니다."});
        } else {
            cb({result: false, data: "등록된 회원이 없습니다. 회원가입을 진행해 주세요."});
            return false;
          }
    });

    socket.on('logout', function () {
        if (!socket.id) return;
        let id = getUserBySocketId(socket.id);
        let roomId = onlineUsers[id].roomId;
        delete onlineUsers[getUserBySocketId(socket.id)];
        updateUserList(roomId, 0, id);
    });

    socket.on('disconnect', function () {
        if (!socket.id) return;
        let id = getUserBySocketId(socket.id);
        if(id === undefined || id === null){
            return;
        }
        let roomId = onlineUsers[id].roomId || 0;
        delete onlineUsers[getUserBySocketId(socket.id)];
        updateUserList(roomId, 0, id);
    });

    function getUserBySocketId(id) {
        return Object.keys(onlineUsers).find(key => onlineUsers[key].socketId === id);
    }

    //join room
    socket.on('join room', function (data) {
        let id = getUserBySocketId(socket.id);
        console.log(onlineUsers);
        let prevRoomId = onlineUsers[id].roomId;
        let nextRoomId = data.roomId;
        socket.leave('room' + prevRoomId);
        socket.join('room' + nextRoomId);
        onlineUsers[id].roomId = data.roomId;
        console.log(`현재 ${nextRoomId}번 방에 있는 사람들 수: ${getUsersByRoomId(data.roomId).length}`);
        updateUserList(prevRoomId, nextRoomId, id);
    })

    //자신이 떠난 방과 자신이 새로 들어온 방에만 이벤트를 보내 userlist 를 업데이트하는 코드이다.
    //값이 0인것을 검사한 이유는 로그인이나, 로그아웃, disconnect 와 같은 경우는 떠난 방, 
    //들어온 방중 하나가 없다. 그래서 그 값을 0으로 처리해서 이 코드에서 검사를 해야 한다.

    function updateUserList(prev, next, id) {
        if (prev === next) {return;} //같은 방을 눌럿을 때 join, left 안뜨게 하기

        if (prev !== 0) {
            io.sockets.in('room' + prev).emit("userlist", getUsersByRoomId(prev));
            io.sockets.in('room' + prev).emit("lefted room", id);
        }
        if (next !== 0) {
            io.sockets.in('room' + next).emit("userlist", getUsersByRoomId(next));
            io.sockets.in('room' + next).emit("joined room", id);
        }
    }

    function getUsersByRoomId(roomId) {
        let userstemp = [];
        Object.keys(onlineUsers).forEach((el) => {
            if (onlineUsers[el].roomId === roomId) {
                userstemp.push({
                    socketId: onlineUsers[el].socketId,
                    name: el
                });
            }
        });
        return userstemp;
    }

    //msg 보내기
    socket.on("send message", function (data) {
        io.sockets.in('room' + data.roomId).emit('new message', {
            name: getUserBySocketId(socket.id),
            socketId: socket.id,
            msg: data.msg
        });
    });
});


