"use strict";

var phantom = require('phantom');

var defaultSettings = {
    base_uri: "http://www.amazon.com/",
    request_interval: 500,
    save_html: false,
    save_screenshots: false,
    window_size: {
        width: 1024,
        height: 768
    },
    detailed: false,
    user_agent: 'SpecialAgent'
};

// function to crawl the number of result pages from document
var pageCountCrawler = function () {
    // the previous sibling of the "next page" button contains the last page number
    var next = document.getElementsByClassName("pagnRA")[0];
    if (!next) {
        return 1;
    }
    return parseInt(next.previousElementSibling.textContent, 10);
};
// function to crawl results' basic dadetailedta from search results page
var resultsDataCrawler = function (settings) {
    var resultsDOM = document.getElementsByClassName("s-result-item");
    var page = {
        results: [],
        html: undefined
    };
    Array.prototype.forEach.call(resultsDOM, function (rElement) {
        var r = {};
        var h2;
        // result description
        h2 = rElement.getElementsByTagName("h2")[0];
        if (!h2) {
            return; // skip, empty cell
        }
        r.name = h2.textContent;
        r.uri = rElement.getElementsByTagName("a")[0].href;
        // find result rating and if it is Prime or not.
        var possibleRatingEls = rElement.getElementsByClassName("a-icon-alt");
        if (possibleRatingEls.length > 0) {
            r.rating = parseFloat(possibleRatingEls[possibleRatingEls.length - 1].textContent.split(' ')[0].replace(',', '.'), 10) || 0;
            r.prime = possibleRatingEls[0].textContent.split(' ')[0] === 'Prime';
        } else {
            r.rating = 0;
            r.prime = false;
        }
        var possiblePriceEl = rElement.getElementsByClassName('a-color-price');
        if (possiblePriceEl.length > 0) {
            r.price = parseFloat(possiblePriceEl[0].textContent.replace(/[a-zA-Z\ \t\n\r$€]/g, '').replace(',', '.'), 10) || null;
        }
        page.results.push(r);
        if (settings.save_html) {
            page.html = document.documentElement.outerHTML;
        }
    });
    return page;
};
var resultsDetailedDataCrawler = function (settings) {
    var details = {
        numReviews: 0,
        numAnswers: 0
    };
    var detailsEl = document.getElementById('prodDetails');
    var numReviewsEl = document.getElementById('acrCustomerReviewText');
    var numAnswersEl = document.getElementById('ask_feature_div');
    var histogramEl = document.getElementById('histogramTable');
    if (numReviewsEl) {
        details.numReviews = parseInt(numReviewsEl.textContent.trim(), 10);
    }
    if (numAnswersEl) {
        numAnswersEl = numAnswersEl.getElementsByClassName('askATFLink')[0];
        if (numAnswersEl) {
            details.numAnswers = parseInt(numAnswersEl.textContent.trim(), 10);
        }
    }
    if (histogramEl) {
        var ratingRows = histogramEl.getElementsByTagName('tr');
        details.numRatings5 = parseInt(ratingRows[0].lastElementChild.textContent.trim(), 10);
        details.numRatings4 = parseInt(ratingRows[1].lastElementChild.textContent.trim(), 10);
        details.numRatings3 = parseInt(ratingRows[2].lastElementChild.textContent.trim(), 10);
        details.numRatings2 = parseInt(ratingRows[3].lastElementChild.textContent.trim(), 10);
        details.numRatings1 = parseInt(ratingRows[4].lastElementChild.textContent.trim(), 10);
    }
    if (detailsEl) {
        var tdEls, k, v;
        tdEls = detailsEl.getElementsByTagName('td');
        k = Array.prototype.filter.call(tdEls, function (e) {
            return e.classList.contains('label');
        }).map(function (e) {
            return e.textContent.trim();
        });
        v = Array.prototype.filter.call(tdEls, function (e) {
            return e.classList.contains('value');
        }).map(function (e) {
            return e.textContent.trim();
        });
        details.ASIN = v[k.indexOf('ASIN')];
        details.dateFirstAvailable = v[k.indexOf('Date First Available')];
    }
    return details;
};

exports.defaultSettings = defaultSettings;
exports.create = function (customSettings) {
    var settings = {};
    var props = Object.keys(defaultSettings);
    var i;
    customSettings = customSettings || {};
    // get custom settings
    for (i = 0; i < props.length; i += 1) {
        if (customSettings.hasOwnProperty(props[i])) {
            settings[props[i]] = customSettings[props[i]];
        } else {
            settings[props[i]] = defaultSettings[props[i]];
        }
    }
    var search = function (keywords, sort, callback) {
        keywords = keywords.split(/[\ \t\n\r]+/).map(encodeURIComponent).join('+');
        var uri = settings.base_uri + 's/ref=nb_sb_noss_2?language=en_GB&keywords=' + keywords + '&sort=' + sort;
        var result = {
            keywords: keywords,
            sort: sort,
            uri: uri,
            pages: [],
            results: [],
            settings: Object.create(settings)
        };
        phantom.create().then(function (ph) {
            ph.createPage().then(function (page) {
                var userAgentPromise = page.setting('userAgent', settings.user_agent);
                var viewportSizePromise = page.property('viewportSize', settings.window_size);
                var onConsoleMessagePromise = page.property('onConsoleMessage', function (msg) {
                    console.log("--> Page says: " + msg);
                });
                Promise.all([userAgentPromise, viewportSizePromise, onConsoleMessagePromise]).then(function () {
                    page.open(uri).then(function (status) {
                        if (status !== 'success') {
                            //reject(new Error("Page couldn't be opened."));
                            throw new Error("Page couldn't be opened.");
                        }
                        page.evaluate(pageCountCrawler, settings).then(function (pageCount) {
                            var currentPage, openCurrentPage, resultsFetcher;
                            currentPage = 1;
                            console.log(pageCount + ' pages.');
                            result.date = new Date();
                            openCurrentPage = function () {
                                page.open(uri + '&page=' + currentPage).then(resultsFetcher);
                            };
                            resultsFetcher = function (status) {
                                if (status !== 'success') {
                                    throw new Error("Page couldn't be opened.");
                                }
                                // take a screenshotresults
                                // NOT YET
                                var p = {};
                                result.pages.push(p);
                                p.date = new Date();
                                p.number = currentPage;
                                p.uri = uri + '&page=' + currentPage;
                                console.log('reading page...');
                                page.evaluate(resultsDataCrawler, settings).then(function (p_data) {
                                    p.results = p_data.results;
                                    p.html = p_data.html;
                                    result.results = result.results.concat(p_data.results);
                                    console.log('Pages read: ' + currentPage + '/' + pageCount);
                                    page.render('page_' + ('00' + currentPage).slice(-3) + '.pdf');
                                    if (currentPage < pageCount) {
                                        currentPage += 1;
                                        setTimeout(openCurrentPage, settings.request_interval);
                                    } else {
                                        if (settings.detailed) {
                                            // detailed
                                            var currentResult, openCurrentResult, detailsFetcher;
                                            currentResult = 0;
                                            openCurrentResult = function () {
                                                page.open(result.results[currentResult].uri).then(detailsFetcher);
                                            };
                                            detailsFetcher = function (status) {
                                                console.log('ResultDetail: ' + (currentResult + 1) + '/' + result.results.length);
                                                page.evaluate(resultsDetailedDataCrawler).then(function (details) {
                                                    result.results[currentResult].ASIN = details.ASIN;
                                                    result.results[currentResult].dateFirstAvailable = details.dateFirstAvailable;
                                                    result.results[currentResult].numReviews = details.numReviews;
                                                    result.results[currentResult].numAnswers = details.numAnswers;
                                                    result.results[currentResult].numRatings5 = details.numRatings5;
                                                    result.results[currentResult].numRatings4 = details.numRatings4;
                                                    result.results[currentResult].numRatings3 = details.numRatings3;
                                                    result.results[currentResult].numRatings2 = details.numRatings2;
                                                    result.results[currentResult].numRatings1 = details.numRatings1;
                                                    currentResult += 1;
                                                    if (currentResult < result.results.length) {
                                                        page.stop();
                                                        setTimeout(openCurrentResult, settings.request_interval);
                                                    } else {
                                                        console.log('callback');
                                                        callback(result);
                                                        //ph.exit();
                                                    }
                                                });
                                            };
                                            setTimeout(openCurrentResult, settings.request_interval);
                                        } else {
                                            console.log('callback');
                                            callback(result);
                                            //ph.exit();
                                        }
                                    } // else
                                }); // Promise
                            }; // resultsFetcher
                            setTimeout(openCurrentPage, settings.request_interval);
                        });
                    });
                });
            });
        });
    };
    return search;
};
