module.exports = (sequelize, DataTypes) => {
    const members = sequelize.define('tbl_members', {
        userId : {
            type : DataTypes.STRING(40),
            allowNull : false,
            unique: true
        },
        password: {
            type: DataTypes.STRING(64),
            allowNull : false,
        }
        //createAt 으로 자동으로 생성
        
    })
    return members;
};