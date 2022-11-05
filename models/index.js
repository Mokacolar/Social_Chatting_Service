const Sequelize = require("sequelize");
// 환경변수, 실제 배포할 때는 'production'으로 바꿔야한다.
const env = process.env.NODE_ENV || 'development'; 
// config
const config = require(__dirname + '/../config/config.js')[env]; 
// db 객체 생성
const db = {}; 

const sequelize = new Sequelize(config.database, config.username, config.password, config);

db.members = require('./members')(sequelize, Sequelize);
db.friends = require('./friends')(sequelize, Sequelize);
db.inbox = require('./inbox')(sequelize, Sequelize);
db.dm= require('./dm')(sequelize, Sequelize);

//관계 설정
Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
