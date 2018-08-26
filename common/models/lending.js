'use strict';
const app = require('../../server/server')
module.exports = function (Lending) {
    Lending.sendEmail = () =>
        new Promise((resolve, reject) => {
            Lending.app.models.Email.send({
                to: "toankd1994@gmail.com",
                from: "asio.lending@gmail.com",
                subject: "Lending",
                text: 'my text',
                html: 'my <em>html</em>'
            })
                .then(mail => {
                    console.log("mail sent ", mail);
                    resolve("success");
                })
                .catch(err => {
                    reject(err)
                })

        })
};
