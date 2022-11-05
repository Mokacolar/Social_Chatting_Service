module.exports = (sequelize, DataTypes) => {
    const members = sequelize.define('tbl_members', {
        userId : {
            type : DataTypes.STRING(64),
            allowNull : false,
            unique: true
        },
        password: {
            type: DataTypes.STRING(64),
            allowNull : false,
        },
        friendsCount: {
            type: DataTypes.BIGINT(64),
            default : 0
        }
        //createAt 으로 자동으로 생성
        
    });
    return members;
};