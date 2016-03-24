"use strict";
process.on('uncaughtException', (err) => {
    console.log(`Caught exception: ${err}`);
});

process.on('unhandledRejection', (reason, p) => {
    console.log("Unhandled Rejection at: Promise ", p, " reason: ", reason);
    // application specific logging, throwing an error, or other logic here
});
var child_process = require('child_process');
var amazonSearch = require('./amazonsearch');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var fs = require('fs');
// Lets search the german amazon!
var search = amazonSearch.create({
    base_uri: 'http://www.amazon.de/',
    save_html: true,
    request_interval: 1300,
    detailed: true
});


if (process.argv.length === 2) {
    console.log("please specify the search string");
}
var keywords = process.argv.slice(2).join(' ');
//  handy+h%C3%BClle
console.log(`Searching amazon for '${keywords}':`);
// Searching for "cuia" sorted by "review-rank"
search(keywords, 'review-rank', (result) => {
    console.log("READY!");
    var outputName = (new Date(result.date)).toISOString().replace(/:/g, '-') + `.k.${result.keywords}.s.${result.sort}`;
    console.log('outputName');
    
    fs.writeFile(`${outputName}.json`, JSON.stringify(result), (err) => {
        if (err) {
            return console.log(err);
        }
        console.log('file saved.');
    });
    child_process.execSync(`pdfunite page_* ${outputName}.pdf`);
    child_process.execSync('rm page_*');
    var url = 'mongodb://localhost:27017/amazonSearch';
    MongoClient.connect(url, function(err, db) {
        var inserts = 0;
        assert.equal(null, err);
        console.log('connected to mongodb');
        var collection = db.collection(result.keywords);
        result.results.forEach(function (r, i, a) {
			r.resultNum = i + 1;
            collection.insert(r, function (err, res) {
                assert.equal(null, err);
                inserts += 1;
                if (inserts === a.length) {
                    inserts = 0;
                    collection = db.collection(result.keywords + '_pages');
                    result.pages.forEach((p, i, a) => {
                        collection.insert(p, (err, res) => {
                            assert.equal(null, err);
                            inserts += 1;
                            if (inserts === a.length) {
                                process.exit();
                            }
                        });
                    });
                }
            });
        });
        //collection.insert(result, function (err, result) {
        //    assert.equal(null, err);
        //    process.exit();
        //});
    });
});
