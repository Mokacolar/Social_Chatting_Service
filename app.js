const express = require('express');
const prod = process.env.NODE_ENV === 'production';
const app = express();
const db = require('./models');
const path = require('path');
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { Sequelize, where } = require('sequelize');
const io = new Server(server);
const port = prod ? process.env.PORT : 3000;

server.listen(port, () => {
    console.log(`포트 ${port} 번 연결됨.`);
})

//http=80
//https=443
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
        if(!isNaN(data.id)){
            cb({result: false, data: "ID는 영문만 입력해 주세요. 숫자는 사용이 안됩니다."});
            return false;
        }
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
            if(onlineUsers[data.id]){
                cb({result: false, data: "이미 로그인한 사용자 입니다."});
                return false;
            }
            onlineUsers[data.id] = {roomId: 0, socketId: socket.id};
            cb({result: true, data: "로그인에 성공하였습니다."});
        } else {
            cb({result: false, data: "등록된 회원이 없습니다. 회원가입을 진행해 주세요."});
            return false;
          }
        console.log(onlineUsers);
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
        console.log(onlineUsers);
        updateUserList(prevRoomId, nextRoomId, id);
    })

    //자신이 떠난 방과 자신이 새로 들어온 방에만 이벤트를 보내 userlist 를 업데이트하는 코드이다.
    //값이 0인것을 검사한 이유는 로그인이나, 로그아웃, disconnect 와 같은 경우는 떠난 방, 
    //들어온 방중 하나가 없다. 그래서 그 값을 0으로 처리해서 이 코드에서 검사를 해야 한다.

    function updateUserList(prev, next, id) {
        console.log("updateUserList__next Room Id:"+next);
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

    socket.on("send memberlist", async (socketId) => {
        //현재 접속한 id 찾기
        let nowUserId = getUserBySocketId(socketId);

        //친구 수 update => friends 수신함에서 수락 눌렀을 시 친구 수 update가 일어나게 바꾸면 된다.
        let friendList = await getFriendListByUserId(nowUserId);

        //nowUserId와 친구인 member는 idx를 포함해서 emit하기
        let memberlist = await getAllMemberListWithoutMe(nowUserId);
        friendList = getFriendListFromMemberList(memberlist,friendList);
        memberlist = getExcludingFriendListFromMemberList(memberlist,friendList);
        socket.emit("memberlist", memberlist, friendList);
    });

    //nowUserId인 사람 뺴고 user 출력
    async function getAllMemberListWithoutMe(nowUserId) {
        let memberlist = await db.members.findAll(
            {where :
            { 
                userId :
                {
                    [Sequelize.Op.ne] : nowUserId
                }
            }
        });
        return JSON.parse(JSON.stringify(memberlist));
    }

    async function getFriendListByUserId(userId) {
        let friendList = await db.friends.findAll(
            {where : {friend2 : userId}}
        );
        return JSON.parse(JSON.stringify(friendList));
    }

    async function updateFriendsCountByUserId(userId, count) {
        await db.members.update(
            {friendsCount : count},
            {where : {userId : userId}}
        )
    }
    
    function getCountElementFromJSON(json){
        let count = 0;
        json.forEach((el) =>{
            count++;
        })
        return count;
    }

    socket.on('send req', async (recId, sendSocId) => {
        let senderUserId = getUserBySocketId(sendSocId);
        let receiverUserId = await getUserIdById(recId);
        var isFriend = await db.friends.findOne({where : {friend1 : senderUserId, friend2 : receiverUserId}});
        if(!isFriend){
            await db.inbox.findOrCreate({
                where : {receiver : receiverUserId, sender : senderUserId},
                default : {receiver : receiverUserId, sender : senderUserId}
            });
        }
    })

    socket.on('sender inbox', async (socketId) => {
        //socketId에 담긴 userId 받아오기
        let receiverUserId =  getUserBySocketId(socketId);
        //그 userId의 inbox 목록 받아오기
        let reqList= await getRequestByUserId(receiverUserId);
        //front에 inbox 목록 뿌려주기
        socket.emit('receive inbox', reqList);
    });

    socket.on('sender friendList', async (socketId) => {
        let nowUserId = getUserBySocketId(socketId);
        let friendList = await getFriendListByUserId(nowUserId);
        let memberList = await getAllMemberListWithoutMe(nowUserId);
        let result = getFriendListFromMemberList(memberList, friendList);
        socket.emit('receive friendList', result);
    });

    //수락 버튼을 눌렀을 시
    //친구관계 생성하고
    //inbox 내용 삭제
    //친구 수 업데이트
    socket.on('accept friend', async (receiverUserId ,senderUserId) => {
        let senUserId  = senderUserId;
        let recUserId = receiverUserId;
        var isFriend = await db.friends.findOne({where : {friend1 : senderUserId, friend2 : receiverUserId}})
        if(!isFriend){
            await db.friends.create({friend1 : recUserId, friend2 : senUserId});
            await db.friends.create({friend1 : senUserId, friend2 : recUserId});
            await db.inbox.destroy({where: {receiver : senUserId, sender : recUserId}})
                .then((result) => {
                    if (result === 0) throw new Error('D0');
                })
                .catch((err) => {
                    err.massage === 'D0'? true : false;
                });
            await db.inbox.destroy({where: {receiver : recUserId, sender : senUserId}})
                .then((result) => {
                    if (result === 0) throw new Error('D0');
                })
                .catch((err) => {
                    err.massage === 'D0'? true : false;
                });

            var friendList = await getFriendListByUserId(recUserId);
            var count = getCountElementFromJSON(friendList);
            await updateFriendsCountByUserId(recUserId, count);

            friendList = await getFriendListByUserId(senUserId);
            count = getCountElementFromJSON(friendList);
            await updateFriendsCountByUserId(senUserId, count);
        }
    });

    //거절 버튼을 눌렀을 시
    //indbox 내용삭제
    socket.on('reject friend', async(receiverUserId, senderUserId) => {
        let senUserId  = senderUserId;
        let recUserId = receiverUserId;
        await db.inbox.destroy({where: {receiver : senUserId, sender : recUserId}})
            .then((result) => {
             if (result === 0) throw new Error('D0');
            })
            .catch((err) => {
                err.massage === 'D0'? true : false;
            });
        await db.inbox.destroy({where: {receiver : recUserId, sender : senUserId}})
            .then((result) => {
                if (result === 0) throw new Error('D0');
            })
            .catch((err) => {
                err.massage === 'D0'? true : false;
            });
    });

    //친구 삭제
    socket.on('del friend', async (friendId, nowUserSocketId) => {
        let nowUserId = getUserBySocketId(nowUserSocketId);
        let friendUserId = await getUserIdById(friendId);
        await db.friends.destroy({where: {friend1 : nowUserId, friend2 : friendUserId}});
        await db.friends.destroy({where: {friend1 : friendUserId, friend2 : nowUserId}});
    });

    //친구 DM
    
    function getFriendListFromMemberList (memberList, friendList) {
        let result = [];
        friendList.forEach((friend) => {
            result.push(memberList.find(member => 
                member.userId === friend.friend1
            ))}
        );
        return result;
    }

    function getExcludingFriendListFromMemberList (memberList, friendList) {
        let result = memberList.filter((el) => !friendList.includes(el));
        return result;
    }

    async function getRequestByUserId(receiverUserId) {
        let result = await db.inbox.findAll({
            where : {
                receiver : receiverUserId
            }
        });
        return JSON.parse(JSON.stringify(result));
    }

    async function getUserIdById(id) {
        let user = await db.members.findOne(
            {
                where : {
                    id : id
                }
            }
        );
        return JSON.parse(JSON.stringify(user)).userId;
    }

    //방 key만들고 입장
    socket.on('make DM room', async function (nowUserSocketId, friendUserId) {
        //나의 socketId를 해싱한 값의 방을 나와 친구가 사용하는 방으로 설정
        let nowUserId = getUserBySocketId(nowUserSocketId);
        let prevRoomId = onlineUsers[nowUserId].roomId;
        let nextRoomId = hashing(nowUserSocketId);
        const [dm, created] = await db.dm.findOrCreate({
            where : { 
                [Sequelize.Op.or] : [
                    {friend1 : nowUserId, friend2 : friendUserId},
                    {friend1 : friendUserId, friend2 : nowUserId} 
                ]
            },
            defaults : { friend1: nowUserId, friend2 : friendUserId, key : nextRoomId}
        })

        if (!created){
            const findKey = await db.dm.findOne({where : {
                [Sequelize.Op.or] : [
                    {friend1 : nowUserId, friend2 : friendUserId},
                    {friend1 : friendUserId, friend2 : nowUserId} 
                ]
            }});
            nextRoomId = findKey.key;
        }
        //입장
        socket.leave('room' + prevRoomId);
        socket.join('room' + nextRoomId);
        onlineUsers[nowUserId].roomId = nextRoomId;
        console.log(`DM ${nextRoomId}번 방에 있는 사람들 수: ${getUsersByRoomId(nextRoomId).length}`);
        console.log(onlineUsers);
        socket.emit('DM roomId', nextRoomId);
        io.sockets.in('room' + nextRoomId).emit("joined DM room", nowUserId);
    })

    socket.on("send DM message", function (data) {
        console.log("send DM message");
        console.log(data);
        io.sockets.in('room' + data.roomId).emit('new DM message', {
            name: getUserBySocketId(socket.id),
            socketId: socket.id,
            msg: data.msg
        });
    });

    function hashing(value) {
        let hash = 0;
        let n = value.length;
        r = 1;
        for (let i = 0; i < n; i++){
            hash += (value.charCodeAt(i) - 96) * r
            hash %= 1234567891;
            r *= 31
            r %= 1234567891;
        }
        return hash;
    }
});


