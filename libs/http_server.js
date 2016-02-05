'use strict';
var express = require('express'),
    Controller = require("../controllers");
var sassMiddleware = require('node-sass-middleware');
var path = require('path');
var body_parser = require('body-parser');
var HttpError = require('../error/http_error');
var ErrorHandler = require('errorhandler');
var cookieParser = require('cookie-parser');
var fasad = require('../middlewares/fasad');

var app = express();

class Server {

    constructor(port, host) {
        this.port =  port;
        this.host = host;
    }

    init() {
        app.locals.pretty = true;
        app.set('view engine', 'jade');
        app.use(require("../middlewares/sendHttpError"));
        app.use(cookieParser('secret'));
        app.use(body_parser.urlencoded({
            extended: true
        }));
        app.use(body_parser.json());

        app.use(sassMiddleware({
            src: path.join(__dirname, '../public/sass'),
            dest: path.join(__dirname, '../public/css'),
            indentedSyntax: true,
            outputStyle: 'compressed',
            prefix: '/css'
        }));
        app.use(express.static('public'));


        app.use('/verify', function(req,res,next) {
            fasad.checkToken(req.query.token, function(err) {
                if (err) return next(err);
                res.cookie('token', req.query.token, { maxAge: 10e+10 });
                res.render('verify');
            });
        });


        app.use('/auth',function(req,res,next) {
            fasad.auth(req.body, function(err,token) {
               if (err) return next(HttpError.ConvertError(err));
                res.cookie('token',token.data, { maxAge: 10e+10 });
                res.end();
            });
        });

        app.use('/logout', function(req,res,next) {
            res.clearCookie('token');
            res.redirect('main');
        });

        app.use('/company', function(req,res,next) {
            var token = req.cookies.token;
            fasad.checkToken(token, function(err,companyInfo) {
                fasad.getStocks(token, function(err,stocks) {
                    if (err) return next(err);
                    fasad.getCountStocksPerDate(token, (err,stats)=> {
                        if (err) return next(err);
                        fasad.getNumberOfSubsribitions(token, function(err,users) {
                            if (err) return next(err);
                            fasad.getCategories((err,categories)=> {
                                if (err) return next(err);
                                res.render('company',{
                                    company: companyInfo,
                                    stocks: stocks.data,
                                    stats: stats,
                                    users: users,
                                    categories: categories.data
                                });
                            })

                        });
                    });
                });
            });
        });

        app.use('/stockinfo/:id', function(req,res,next) {
            var data = {id: req.params.id,
                        token: req.cookies.token};
            fasad.getStockInfo(data,(err,stockInfo)=> {
                if (err) return next(err);
                fasad.getStatsForStock(data, (err,stats)=> {
                    fasad.getCategories((err,categories)=> {
                        if (err) return next(err);
                        res.render('stock', {
                            stock: stockInfo.data,
                            stats: stats,
                            categories: categories.data

                        });
                    });

                });
            });
        });

        app.get('/resend/:id', function(req,res) {
            res.render('resend',{
                id: req.params.id
            })
        });

        app.use('/', function(req,res) {
            fasad.getCategories((err,categories)=> {
                if (err) return next(err);
                res.render('main', {
                    categories: categories.data
                });
            });

        });



        app.use(function(err,req,res,next) {
            console.log("error");
            if (typeof err == "number")
            {
                err = new HttpError(err);
            }
            if (err instanceof HttpError)
            {
                res.sendHttpError(err);
            }
            else {
                if (app.get('env')=="development")
                {
                    ErrorHandler()(err, req, res, next);
                }
                else {
                    console.log(err);
                    err = new HttpError(500);
                    res.sendHttpError(err);
                }
            }
        });
    }

    run() {
        this.init();
        app.listen(this.port, () => {
            console.log("Сервер запущен");
        });
    }
}

module.exports = Server;