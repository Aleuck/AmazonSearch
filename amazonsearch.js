"use strict";

var phantom = require('phantom');

var defaultSettings = {
    base_uri: "http://www.amazon.com/",
    request_interval: 1800,
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
var queryDataCrawler = function () {
    var data = {};
    // the previous sibling of the "next page" button contains the last page number
    var next = document.getElementsByClassName("pagnRA")[0];
    if (!next) {
        return 1;
    }
    data.pageCount = parseInt(next.previousElementSibling.textContent, 10);
    data.qid = document.getElementsByName('qid')[0].value;
    return data;
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
        var h2, img;
        // result description
        h2 = rElement.getElementsByTagName("h2")[0];
        if (!h2) {
            return; // skip, empty cell
        }
        img = rElement.getElementsByClassName("s-access-image");
        if (img.length == 0) {
                console.log("'" + h2.textContent + "' has no img, skipping");
                return;
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
        numReviews: undefined,
        numAnswers: undefined
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
        details.numRatings5 = parseInt(ratingRows[0].lastElementChild.textContent.trim(), 10) || 0;
        details.numRatings4 = parseInt(ratingRows[1].lastElementChild.textContent.trim(), 10) || 0;
        details.numRatings3 = parseInt(ratingRows[2].lastElementChild.textContent.trim(), 10) || 0;
        details.numRatings2 = parseInt(ratingRows[3].lastElementChild.textContent.trim(), 10) || 0;
        details.numRatings1 = parseInt(ratingRows[4].lastElementChild.textContent.trim(), 10) || 0;
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
        k.forEach(function (key, index) {
            details[key] = v[index];
        });
    }
    detailsEl = document.getElementById('detail_bullets_id');
    if (detailsEl) {
        Array.prototype.forEach.call(detailsEl.getElementsByTagName("li"), function (el) {
            var trim = function (str) {
                return str.trim();
            };
            var prop = el.textContent.split(":").map(trim);
            details[prop[0]] = prop[1];
        });
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
        var querySummary = {
            keywords: keywords,
            sort: sort,
            uri: uri,
            qid: null
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
                        page.evaluate(queryDataCrawler, settings).then(function (queryData) {
                            var currentPage = 1,
                                openCurrentPage,
                                retryCurrentPage,
                                resultsFetcher,
                                num_fails = 0,
                                pageCount = queryData.pageCount,
                                qid = queryData.qid;
                            currentPage = 1;
                            console.log(pageCount + ' pages.');
                            result.date = new Date();
                            result.qid = qid;
                            querySummary.qid = qid;
                            uri = uri + '&qid=' + qid;
                            querySummary.uri = uri;
                            openCurrentPage = function () {
                                page.open(uri + '&page=' + currentPage).then(resultsFetcher, retryCurrentPage);
                            };
                            retryCurrentPage = function () {
                                var page_uri = uri + '&page=' + currentPage,
                                    wait_time;
                                num_fails += 1;
                                wait_time = settings.request_interval + (num_fails * 500);
                                console.log(`failed to load page ${currentPage} (${page_uri})`);
                                console.log(`retrying in ${(wait_time/1000).toFixed(1)} seconds...`);
                                setTimeout(openCurrentPage, wait_time);
                            }
                            resultsFetcher = function (status) {
                                if (status !== 'success') {
                                    retryCurrentPage();
                                    return;
                                }
                                num_fails = 0;
                                // take a screenshotresults
                                // NOT YET
                                var p = {};
                                var storeResults = function (p_data) {
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
                                            var currentResult, openCurrentResult, retryCurrentResult, detailsFetcher, num_fails = 0;
                                            currentResult = 0;
                                            openCurrentResult = function () {
                                                page.open(result.results[currentResult].uri).then(detailsFetcher, retryCurrentResult);
                                            };
                                            retryCurrentResult = function () {
                                                num_fails += 1;
                                                var wait_time = settings.request_interval + (num_fails * 500);
                                                console.log(`failed to load page of result #${currentResult+1} (${result.results[currentResult].uri})`);
                                                console.log(`retrying in ${(wait_time/1000).toFixed(1)} seconds...`);
                                                setTimeout(openCurrentResult, wait_time);
                                            };
                                            detailsFetcher = function (status) {
                                                if (status !== 'success') {
                                                    retryCurrentResult();
                                                    return;
                                                }
                                                console.log('ResultDetail: ' + (currentResult + 1) + '/' + result.results.length);
                                                page.evaluate(resultsDetailedDataCrawler).then(function (details) {
                                                    Object.keys(details).forEach(function (key) {
                                                        result.results[currentResult][key] = details[key];
                                                    });
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
                                }
                                result.pages.push(p);
                                p.date = new Date();
                                p.number = currentPage;
                                p.uri = uri + '&page=' + currentPage;
                                console.log('reading page...');
                                page.evaluate(resultsDataCrawler, settings).then(storeResults); // Promise
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
/* vim: sw=4:ts=4:sts=4:expandtab:autoindent:smartindent */
