// var winston = require('winston');
// var winstonDailyRotateFile = require('winston-daily-rotate-file');

exports.system = {
    app_mode: process.env.ENVIRONMENT,
    app_name: 'Quick Reponse',
    app_port: process.env.PORT,
    redis_url: process.env.REDIS_URL,
    session_maxage: 60 * 60 * 1000,
    shortid: require('shortid'),
    moment: require('moment'),
    momentz: require('moment-timezone'),
};

exports.common = {
    shortid: require('shortid'),
    moment: require('moment'),
    momentz: require('moment-timezone'),
    promise: require("bluebird")
};
// exports.logger = winston.createLogger({
//     transports: [
//         new winston.transports.Console({
//         	level: process.env.ENVIRONMENT === 'development' ? 'silly' : 'info'
//         }),
//         new winstonDailyRotateFile({
//             filename: '.log',
//             datePattern: 'dd-MM-yyyy.',
//             prepend: true,
//             level: process.env.ENVIRONMENT === 'development' ? 'debug' : 'info'
//         })
//     ],
//     exitOnError: false
// });