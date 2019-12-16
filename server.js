"use strict";

var express = require("express");
var MongoClient = require("mongodb");
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var cors = require("cors");
var dns = require("dns");
var url = require("url");
var app = express();

// Basic Configuration
var port = process.env.PORT || 3000;

process.env.DB =
  "mongodb://admin:ThePassword.@cluster0-shard-00-00-hulqw.mongodb.net:27017,cluster0-shard-00-01-hulqw.mongodb.net:27017,cluster0-shard-00-02-hulqw.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin&retryWrites=true&w=majority";
/** this project needs a db !! **/

// mongoose.connect(process.env.MONGOLAB_URI);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here

app.use("/public", express.static(process.cwd() + "/public"));

app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

function getShortURL() {
  return new Promise((resolve, reject) => {
    MongoClient.connect(process.env.DB, (err, db) => {
      db.collection("urlCollection").count((err, count) => {
        if (err) return reject(err);
        return resolve({ short: count + 1 });
      });
      db.close();
    });
  });
}

function alreadyShortened(url) {
  return new Promise((resolve, reject) => {
    MongoClient.connect(process.env.DB, (err, db) => {
      db.collection("urlCollection").findOne({ ogURL: url }, (err, docs) => {
        if (err) return reject(err);
        else if (docs === null) return resolve({ shortened: false });
        return resolve({ shortened: true, og: docs.ogURL, sh: docs.shortURL });
      });
      db.close();
    });
  });
}

function dnsCheck(url) {
  return new Promise((resolve, reject) => {
    let host = new URL(url).host;
    dns.lookup(host, err => {
      if (err) return resolve({ isValid: false });
      return resolve({ isValid: true });
    });
  });
}

function shortenUrl(url, short) {
  return new Promise((resolve, reject) => {
    MongoClient.connect(process.env.DB, (err, db) => {
      db.collection("urlCollection").insertOne(
        {
          ogURL: url,
          shortURL: short
        },
        (err, docs) => {
          if (err) return reject(err);
          return resolve({ original_url: url, short_url: short });
        }
      );
      db.close();
    });
  });
}

app.post("/api/shorturl/new", (req, res) => {
  let url = req.body.url;

  dnsCheck(url)
    .then(data => {
      if (data.isValid) {
        alreadyShortened(url).then(data => {
          if (data.shortened) {
            return res.json({ original_url: data.og, short_url: data.sh });
          } else {
            getShortURL().then(data => {
              shortenUrl(url, data.short).then(data => res.json(data));
            });
          }
        });
      }
    })
    .catch(() => {
      res.json({ error: "invalid_url" });
    });
});

app.get("/api/shorturl/:shortUrl", function(req, res) { 
  let sh = parseInt(req.params.shortUrl);
  console.log(sh);
  MongoClient.connect(process.env.DB, (err,db) => {
    db.collection('urlCollection').findOne({shortURL:sh}, (err,docs) => {
      console.log(docs);
      if(err) return console.error(err);
      else if(docs === null) return res.json({error:"invalid_url"});
      else
        return res.status(301).redirect(docs.ogURL);
    })
  });
  
  //return res.status(301).redirect('https://freecodecamp.org');
});


app.listen(port, function() {
  console.log("Node.js listening ...");
});
