"use strict";
var amazonSearch = require('./amazonsearch');
var fs = require('fs');
var system = require('system');

// Lets search the german amazon!
var search = amazonSearch.create({
	base_uri: 'http://www.amazon.de/',
	save_html: false,
	request_interval: 1000
});

// Searching for "cuia" sorted by "review-rank"
search('cuia', 'review-rank', function (result) {
    try {
    	fs.write('results.json', JSON.stringify(result), 'w');
    } catch(e) {
        console.log(e);
    }
    phantom.exit();
});