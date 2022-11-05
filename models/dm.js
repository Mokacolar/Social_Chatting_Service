module.exports = (sequelize, DataTypes) => {
    const dm = sequelize.define('tbl_DM', {
        friend1 : {
            type : DataTypes.STRING(64),
            allowNull : false,
        },
        friend2: {
            type: DataTypes.STRING(64),
            allowNull : false,
        },
        key : {
            type: DataTypes.STRING(64),
            allowNull : false,
        }
        //createAt 으로 자동으로 생성
    })
    return dm;
};