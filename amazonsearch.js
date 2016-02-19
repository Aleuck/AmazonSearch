/*\ AMAZON SEARCH CRAWLER

Author: Alexandre Leuck

-------------------------------------------------
Valid sort options:
-------------------------------------------------

 - 'relevancerank';
 - 'featured-rank';
 - 'price-asc-rank';
 - 'price-desc-rank';
 - 'review-rank'; and
 - 'date-desc-rank'.

-------------------------------------------------
\*/

"use strict";
var defaultSettings = {
    base_uri: "http://www.amazon.com/",
    request_interval: 500,
    save_html: false,
    save_screenshots: false,
    window_size: {
        width: 1280,
        height: 720
    },
    user_agent: 'SpecialAgent'
};
var htmlCrawler = function () {
    return document.documentElement.outerHTML;
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
// function to crawl results' basic data from search results page
var resultsDataCrawler = function (settings) {
    var resultsDOM = document.getElementsByClassName("s-result-item");
    var results = [];
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
            r.rating = parseFloat(possibleRatingEls[possibleRatingEls.length - 1].textContent.split(' ')[0].replace(',','.'), 10) || 0;
            r.prime = possibleRatingEls[0].textContent.split(' ')[0] === 'Prime';
        } else {
            r.rating = 0;
            r.prime = false;
        }
        if (settings.save_html) {
            r.html = rElement.outerHTML;
        }
        var possiblePriceEl = rElement.getElementsByClassName('a-color-price');
        if (possiblePriceEl.length > 0) {
            r.price = parseFloat(possiblePriceEl[0].textContent.replace(/[a-zA-Z\ \t\n\r$€]/g, '').replace(',','.'),10) || null;
            console.log(r.price);
        }
        // TODO: gather more data
        results.push(r);
    });
    return results;
};
exports.defaultSettings = defaultSettings;
exports.create = function (customSettings) {
    var settings = {};
    var props = Object.keys(defaultSettings);
    var i;
    // get custom settings
    for (i = 0; i < props.length; i += 1) {
        if (customSettings.hasOwnProperty(props[i])) {
            settings[props[i]] = customSettings[props[i]];
        } else {
            settings[props[i]] = defaultSettings[props[i]];
        }
    }
    // amazon does not allow sort options if we identify ourselves as "phantomjs"
    var search = function (keywords, sort, callback) {
        keywords = keywords.split(/[\ \t\n\r]+/).map(encodeURIComponent).join('+');
        var uri = settings.base_uri + 's/ref=nb_sb_noss_2?keywords=' + keywords + '&sort=' + sort;
        var webpage = require('webpage');
        var searchPage = webpage.create();
        var result = {
            keywords: keywords,
            sort: sort,
            uri: uri,
            pages: [],
            results: [],
            settings: settings
        };
        searchPage.settings.userAgent = settings.user_agent;
        searchPage.viewportSize = settings.window_size;

        // for debugging
        searchPage.onConsoleMessage = function (msg) {
            console.log("--> Page says: " + msg);
        };
        // searchPage.onLoadFinished = function () {
        //     console.log("-- finished loading --");
        // };

        //console.log("oppening: ", uri);

        searchPage.open(uri, function (status) {
            var pageCount, currentPage, openCurrentPage, productsFetcher;
            if (status !== 'success') {
                throw new Error("Page couldn't be opened.");
            }
            result.date = new Date();
            // lets find out how many pages of results we got
            pageCount = searchPage.evaluate(pageCountCrawler, settings);
            currentPage = 1;
            openCurrentPage = function () {
                searchPage.open(uri + '&page=' + currentPage, productsFetcher);
            };
            productsFetcher = function () {
                // take a screenshot
                if (settings.save_screenshots) {
                    searchPage.render('page_' + currentPage + '.png');
                }

                // gather data of each result in this page
                var page = {};
                page.date = new Date();
                page.number = currentPage;
                page.uri = uri + '&page=' + currentPage;
                // get data from the results in this page
                page.results = searchPage.evaluate(resultsDataCrawler, settings);
                // concat with all the products gathered from previous pages
                result.results = result.results.concat(page.results);
                // do we want to save the html?
                if (settings.save_html) {
                    page.html = searchPage.evaluate(htmlCrawler);
                }
                // add page to the results
                result.pages.push(page);
                console.log('Pages read: ' + currentPage + '/' + pageCount);
                // move to next page, if needed
                if (currentPage < pageCount) {
                    currentPage += 1;
                    setTimeout(openCurrentPage, settings.request_interval);
                } else {
                    if (typeof callback === 'function') {
                        callback(result);
                    }
                }
            };
            console.log('Pages read: 0/' + pageCount);
            setTimeout(openCurrentPage, settings.request_interval);
        });
    };
    search.settings = settings;
    return search;
};
