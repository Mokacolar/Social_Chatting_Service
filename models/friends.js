module.exports = (sequelize, DataTypes) => {
    const friends = sequelize.define('tbl_friends', {
        friend1 : {
            type : DataTypes.STRING(40),
            allowNull : false,
        },
        friend2: {
            type: DataTypes.STRING(40),
            allowNull : false,
        }
        //createAt 으로 자동으로 생성
    })
    return friends;
};
