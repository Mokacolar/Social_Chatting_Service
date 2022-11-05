module.exports = (sequelize, DataTypes) => {
    const inbox = sequelize.define('tbl_inbox', {
        receiver : {
            type : DataTypes.STRING(64),
            allowNull : false,
        },
        sender : {
            type: DataTypes.STRING(64),
            allowNull : false,
        }
        //createAt 으로 자동으로 생성
    })
    return inbox;
};