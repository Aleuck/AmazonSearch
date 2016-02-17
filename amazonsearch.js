/*
 |  AMAZON SEARCH CRAWLER
 |    Author: Alexandre Leuck
  ---------------------------- */

/* Usage example:
    var search = amazonSearch.create({base_uri: 'http://www.amazon.de', save_html: true});

    search("digitalkamera+slr", "review-rank", function (result) {
        console.dir(result);
    });
 */


// - relevancerank,
// - featured-rank,
// - price-asc-rank,
// - price-desc-rank,
// - review-rank,
// - date-desc-ran'

var amazonSearch = (function () {
    "use strict";
    var defaultSettings = {
        base_uri: "http://www.amazon.com/",
        request_interval: 500,
        save_html: false,
        window_size: {
            width: 1920,
            height: 1080
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
            // result description
            r.name = rElement.getElementsByTagName("h2")[0].textContent;
            // find result rating and if it is Prime or not.
            var possibleRatingEls = rElement.getElementsByClassName("a-icon-alt");
            if (possibleRatingEls.length > 0) {
                r.rating = parseInt(possibleRatingEls[possibleRatingEls.length - 1].textContent.split(' ')[0], 10);
                r.prime = possibleRatingEls[0].textContent.split(' ')[0] === 'Prime';
            } else {
                r.rating = "0";
            }
            r.url = rElement.getElementsByTagName("a")[0].href;
            if (settings.save_html) {
                r.html = rElement.outerHTML;
            }
            // TODO: gather more data
            results.push(r);
        });
        return results;
    };

    return {
        defaultSettings: defaultSettings,
        create: function (customSettings) {
            var settings = {};
            var props = Object.keys(customSettings);
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
                var uri = settings.base_uri + 's/?keywords=' + keywords + '&sort=' + sort;
                var webpage = require('webpage');
                var searchPage = webpage.create();
                var result = {
                    keywords: keywords,
                    sort: sort,
                    uri: uri,
                    pages: [],
                    results: []
                };
                searchPage.settings.userAgent = settings.user_agent;
                searchPage.viewportSize = settings.window_size;

                // for debugging
                searchPage.onConsoleMessage = function (msg) {
                    console.log("--> Page says: " + msg);
                };
                searchPage.onLoadFinished = function () {
                    console.log("-- finished loading --");
                };

                console.log("oppening: ", uri);

                searchPage.open(uri, function (status) {
                    var pageCount, currentPage, openCurrentPage, productsFetcher;
                    console.log("opened");
                    // lets find out how many pages of results we got
                    pageCount = searchPage.evaluate(pageCountCrawler, settings);
                    currentPage = 1;
                    openCurrentPage = function () {
                        searchPage.open(uri + '&page=' + currentPage, productsFetcher);
                    };
                    productsFetcher = function () {
                        // take a screenshot
                        searchPage.render('page_' + currentPage + '.png');

                        // gather data of each result in this page
                        var page = {};
                        page.number = currentPage;
                        page.uri = uri + '&page=' + currentPage;
                        page.results = searchPage.evaluate(resultsDataCrawler, settings);
                        // concat with all the products gathered from previous pages
                        result.results = result.results.concat(page.results);
                        if (settings.save_html) {
                            page.html = searchPage.evaluate(htmlCrawler);
                        }

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
                    setTimeout(openCurrentPage, settings.request_interval);
                });
            };
            search.settings = settings;
            return search;
        }
    };
}());

var search = amazonSearch.create({
    base_uri: 'http://www.amazon.de/',
    save_html: true
});

search('cuia', 'review-rank', function (result) {
    "use-strict";
    console.log("--- END ---");
});