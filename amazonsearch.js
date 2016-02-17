"use strict";

/* 
 |  AMAZON SEARCH CRAWLER
 |    Author: Alexandre Leuck 
  ---------------------------- */

// Possible sort options:
// - relevancerank,
// - featured-rank,
// - price-asc-rank,
// - price-desc-rank,
// - review-rank,
// - date-desc-ran'

// amazomSearch(keywords, sort, callback(products))
var amazonSearch = function (keywords, sort, callback) {
	var webpage = require('webpage');
	var searchPage = webpage.create();
		searchPage.viewportSize = {
		width: 1920,
		height: 1080
	}
	// amazon does not allow sort options if we identify ourselves as "phantomjs"
	searchPage.settings.userAgent = 'SpecialAgent';
	var url = 'http://www.amazon.de/s/?keywords=' + keywords + '&sort=' + sort;
	//var url = 'http://www.amazon.de/s/ref=sr_st_review-rank?__mk_de_DE=ÅMÅZÕÑ&keywords=' + keywords + '&sort=' + sort;
	console.log("oppening: ", url);
	searchPage.onConsoleMessage = function(msg) {
		console.log("--> Page says: " + msg);
	}
	searchPage.onLoadFinished = function() {
        console.log("-- finished loading --");
    };
	searchPage.open(url, function (status) {
		console.log("opened");
		//Page is loaded!
		searchPage.render('amazon.png');

		// lets find out how many pages of results we got
		var pageCount = searchPage.evaluate(function () {
			// the previous sibling of the "next page" button contains the last page number
			var next = document.getElementsByClassName("pagnRA")[0];
			if (!next) {
				return 1;
			}
			return parseInt(next.previousElementSibling.textContent, 10);
		})
		console.log(pageCount);

		// assume we have at least one page, even if there is no results
		var currentPage = 1;
		var products = [];
		
		// this will execute on each page after they load, to gather product data
		var productsFetcher = function () {
			// take a screenshot
			searchPage.render('page_' + currentPage + '.png');

			// gather data of each product in this page
			var pageProducts = searchPage.evaluate(function () {
				var productsElements = document.getElementsByClassName("s-result-item");
				var products = Array.prototype.map.call(productsElements, function (pElement) {
					var p = {};
					// product description
					p.name = pElement.getElementsByTagName("h2")[0].textContent;
					// find product rating and if it is prime or not.
					var possibleRatingEls = pElement.getElementsByClassName("a-icon-alt");
					if (possibleRatingEls.length > 0) {
						p.rating = parseInt(possibleRatingEls[possibleRatingEls.length-1].textContent.split(' ')[0], 10);
						p.prime = possibleRatingEls[0].textContent.split(' ')[0] === 'Prime';
					} else {
						p.rating = "0";
					}
					p.url = r.getElementsByTagName("a")[0].href;
					// TODO: gather more data
					return p;
				});
				return products;
			});
			// concat with all the products gathered from previous pages
			products = products.concat(pageProducts);

			// move to next page, if needed
			if (currentPage < pageCount) {
				currentPage += 1;
				setTimeout(openCurrentPage, 500);
			} else {
				callback(products);
				//phantom.exit();
			}
		};

		// open the current page
		var openCurrentPage = function () {
			searchPage.open(url + '&page=' + currentPage, productsFetcher);
		};

		// start gathering the data
		setTimeout(openCurrentPage, 500);
	});
}


amazonSearch("cuia", "review-rank");