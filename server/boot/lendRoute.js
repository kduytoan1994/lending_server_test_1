'use strict'
module.exports = (app) => {
    const CommonResponse = require('../util/CommonResponse')
    const lend = app.models.lending;
    const loan = app.models.loan;
    const pack = app.models.pack;
    const interest = app.models.interest;
    const Q = require('q');
    const util = require('../util/Utils')
    const constant = require('../constant')
    const investor = app.models.investor;
    const AccessToken = app.models.AccessToken;

    app.post('/api/lend/submitLend', (req, res) => {
        var idLoan;
        var listPackage = req.body.list_chosen_package;
        var promises = [];
        var total = 0;
        var access_token = req.body.token;
        var loanTemp, lendTemp;
        AccessToken.findOne({ id: access_token }, (err, token) => {
            if (err || (token == null)) {
                var response = new CommonResponse("error", "", err)
                console.log("response", response)
                res.json(response)
            }
            else {
                for (var i = 0; i < listPackage.length; i++) {
                    promises.push(pack.findById(listPackage[i])
                        .then(pack => {
                            total += pack.amount;
                            idLoan = pack.loanId
                            pack.status = 1;
                            pack.save(err => {
                                if (err) {
                                    var response = new CommonResponse("error", "", err)
                                    console.log("response", response)
                                    res.json(response)
                                }
                            })
                        })
                        .catch(err => {
                            console.log(err)
                        })
                    )
                }
                Q.all(promises)
                    .then(() => {
                        return loan.findOne({ id: idLoan })
                    })
                    .then(loan => {
                        loan.called += total;
                        //gọi đủ vốn , chuyển loan status =1 
                        if (loan.called == loan.amount) {
                            loan.status = 1;
                        }
                        return loan.save();
                    })
                    .then(loan => {
                        loanTemp = loan;
                        var statusLend = 0;
                        if (loan.status == 1) {
                            statusLend = 1;
                        }
                        return lend.create({
                            investorId: token.userId,
                            amount: total,
                            start_time: loanTemp.start_time,
                            loanId: idLoan,
                            status: statusLend
                        })
                    })
                    .then(lend => {
                        lendTemp = lend;
                        return util.chageMoney(lendTemp.id, constant.ID_SYSTEM, total)
                    })
                    .then(result => {
                        if (result != 'success') {
                            var response = new CommonResponse("error", "", "cannot exchange money")
                            console.log("response", response)
                            res.json(response)
                            return;
                        }
                        let rate;
                        var money = loanTemp.amount;
                        if (money < 30) {
                            rate = 0.02;
                        } else if (money < 80) {
                            rate = 0.05
                        } else {
                            rate = 0.15
                        }

                        let promisesInterest = [];
                        var range_time = loanTemp.range_time;
                        for (var j = 1; j < range_time; j++) {
                            let day;
                            promisesInterest.push(
                                dayAfterSomeMonth(lendTemp.start_time, j)
                                    .then(result => {
                                        day = result.result;
                                        return interest.create({
                                            order: j,
                                            date: day,
                                            money: (total * rate) + total / range_time,
                                            rate: rate,
                                            loanId: loanTemp.id,
                                            lendingId: lendTemp.id,
                                            status: 0
                                        })
                                    })
                                    .catch(err => {
                                        var response = new CommonResponse("error", "", err)
                                        console.log("response", response)
                                        res.json(response)
                                    })
                            )
                        }
                        return Q.push(promisesInterest);
                    })
                    .then(() => {
                        var data = lendTemp;
                        var response = new CommonResponse("success", "", data)
                        console.log("response", response)
                        res.json(response)
                    })
                    .catch(err => {
                        var response = new CommonResponse("error", "", err)
                        console.log("response", response)
                        res.json(response)
                    })
            }
        })

    })
    app.get('/total/:total', (req, res) => {
        var total = req.params.total;
        res.json(calculateReceiveMoney(total, 10, 3))
    })

    var dayAfterSomeMonth = (day, range_time) =>
        new Promise((resolve, reject) => {
            var dayTemp = day.split('/');
            var year = parseInt(dayTemp[2]);
            var month = parseInt(dayTemp[1]);
            var date = parseInt(dayTemp[0]);
            var monthTemp = month + range_time;
            var monthResult, yearResult;
            if (monthTemp < 10) {
                monthResult = '0' + monthTemp
                yearResult = year + '';
            } else if (monthTemp <= 12) {
                monthResult = monthTemp + '';
                yearResult = year + '';
            } else if (monthTemp < 22) {
                monthResult = '0' + (monthTemp - 12).toString();
                yearResult = (year + 1).toString();
            } else {
                monthResult = monthTemp + '';
                yearResult = (year + 1) + ''
            }
            var result = date + '/' + monthResult + '/' + yearResult
            console.log('result', result)
            resolve({ result: result })
        })
    app.post('/sendmail', (req, res) => {
        lend.sendEmail()
            .then(mail => {
                res.json(mail)
            })
            .catch(err => {
                res.json(err)
            })
    })
}