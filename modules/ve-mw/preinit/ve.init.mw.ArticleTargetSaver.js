/*!
 * VisualEditor MediaWiki ArticleTargetSaver.
 *
 * @copyright 2011-2020 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

/**
 * Target saver.
 *
 * Light-weight saver.
 *
 * @class mw.libs.ve.targetSaver
 * @singleton
 */
( function () {
	mw.libs.ve = mw.libs.ve || {};

	mw.libs.ve.targetSaver = {
		/**
		 * Preload the library required for deflating so the user doesn't
		 * have to wait when postHtml is called.
		 */
		preloadDeflate: function () {
			mw.loader.load( 'mediawiki.deflate' );
		},

		/**
		 * Compress a string with deflate.
		 *
		 * @param {string} html HTML to deflate
		 * @return {jQuery.Promise} Promise resolved with deflated HTML
		 */
		deflate: function ( html ) {
			return mw.loader.using( 'mediawiki.deflate' ).then( function () {
				return mw.deflate( html );
			} );

		},

		/**
		 * Get HTML to send to Parsoid.
		 *
		 * If the document was generated from scratch (e.g. inside VisualEditor's converter), the
		 * source document can be passed in to transplant the head tag, as well as the attributes
		 * on the html and body tags.
		 *
		 * @param {HTMLDocument} newDoc Document generated by ve.dm.Converter. Will be modified.
		 * @param {HTMLDocument} [oldDoc] Old document to copy attributes from.
		 * @return {string} Full HTML document
		 */
		getHtml: function ( newDoc, oldDoc ) {
			var i, len;

			function copyAttributes( from, to ) {
				Array.prototype.forEach.call( from.attributes, function ( attr ) {
					to.setAttribute( attr.name, attr.value );
				} );
			}

			if ( oldDoc ) {
				// Copy the head from the old document
				for ( i = 0, len = oldDoc.head.childNodes.length; i < len; i++ ) {
					newDoc.head.appendChild( oldDoc.head.childNodes[ i ].cloneNode( true ) );
				}
				// Copy attributes from the old document for the html, head and body
				copyAttributes( oldDoc.documentElement, newDoc.documentElement );
				copyAttributes( oldDoc.head, newDoc.head );
				copyAttributes( oldDoc.body, newDoc.body );
			}

			// Filter out junk that may have been added by browser plugins
			$( newDoc )
				.find( [
					'script', // T54884, T65229, T96533, T103430
					'noscript', // T144891
					'object', // T65229
					'style:not( [ data-mw ] )', // T55252, but allow <style data-mw/> e.g. TemplateStyles T188143
					'embed', // T53521, T54791, T65121
					'a[href^="javascript:"]', // T200971
					'img[src^="data:"]', // T192392
					'div[id="myEventWatcherDiv"]', // T53423
					'div[id="sendToInstapaperResults"]', // T63776
					'div[id="kloutify"]', // T69006
					'div[id^="mittoHidden"]', // T70900
					'div.hon.certificateLink', // HON (T209619)
					'div.donut-container', // Web of Trust (T189148)
					'div.shield-container' // Web of Trust (T297862)
				].join( ',' ) )
				.remove();

			// data-mw-section-id is copied to headings by mw.libs.ve.unwrapParsoidSections
			// Remove these to avoid triggering selser.
			$( newDoc ).find( '[data-mw-section-id]:not( section )' ).removeAttr( 'data-mw-section-id' );

			// Add doctype manually
			// ve.serializeXhtml is loaded separately from utils.parsing
			// eslint-disable-next-line no-undef
			return '<!doctype html>' + ve.serializeXhtml( newDoc );
		},

		/**
		 * Serialize and deflate an HTML document
		 *
		 * @param {HTMLDocument} doc Document generated by ve.dm.Converter. Will be modified.
		 * @param {HTMLDocument} [oldDoc] Old document to copy attributes from.
		 * @return {jQuery.Promise} Promise resolved with deflated HTML
		 */
		deflateDoc: function ( doc, oldDoc ) {
			return this.deflate( this.getHtml( doc, oldDoc ) );
		},

		/**
		 * Post an HTML document to the API.
		 *
		 * Serializes the document to HTML, deflates it, then passes to #postHtml.
		 *
		 * @param {HTMLDocument} doc Document to save
		 * @param {Object} [extraData] Extra data to send to the API
		 * @param {Object} [options] Options
		 * @return {jQuery.Promise} Promise which resolves if the post was successful
		 */
		saveDoc: function ( doc, extraData, options ) {
			var saver = this;
			return this.deflateDoc( doc ).then( function ( html ) {
				return saver.postHtml(
					html,
					null,
					extraData,
					options
				);
			} );
		},

		/**
		 * Post wikitext to the API.
		 *
		 * By default uses action=visualeditoredit, paction=save.
		 *
		 * @param {string} wikitext Wikitext to post. Deflating is optional but recommended.
		 * @param {Object} [extraData] Extra data to send to the API
		 * @param {Object} [options] Options
		 * @param {mw.Api} [options.api] Api to use
		 * @param {Function} [options.now] Function returning current time in milliseconds for tracking, e.g. ve.now
		 * @param {Function} [options.track] Tracking function
		 * @param {string} [options.eventName] Event name for tracking
		 * @return {jQuery.Promise} Promise which resolves with API save data, or rejects with error details
		 */
		postWikitext: function ( wikitext, extraData, options ) {
			return this.postContent( $.extend( { wikitext: wikitext }, extraData ), options );
		},

		/**
		 * Post HTML to the API.
		 *
		 * By default uses action=visualeditoredit, paction=save.
		 *
		 * @param {string} html HTML to post. Deflating is optional but recommended.
		 *  Should be included for retries even if a cache key is provided.
		 * @param {string} [cacheKey] Optional cache key of HTML stashed on server.
		 * @param {Object} [extraData] Extra data to send to the API
		 * @param {Object} [options] Options
		 * @return {jQuery.Promise} Promise which resolves with API save data, or rejects with error details
		 */
		postHtml: function ( html, cacheKey, extraData, options ) {
			var data,
				saver = this;

			options = options || {};
			if ( cacheKey ) {
				data = $.extend( { cachekey: cacheKey }, extraData );
			} else {
				data = $.extend( { html: html }, extraData );
			}
			return this.postContent( data, options ).then(
				null,
				function ( code, response ) {
					// This cache key is evidently bad, clear it
					if ( options.onCacheKeyFail ) {
						options.onCacheKeyFail();
					}
					if ( code === 'badcachekey' ) {
						// If the cache key failed, try again without the cache key
						return saver.postHtml(
							html,
							null,
							extraData,
							options
						);
					}
					// Failed for some other reason - let caller handle it.
					return $.Deferred().reject( code, response ).promise();
				}
			);
		},

		/**
		 * Post content to the API, using mw.Api#postWithToken to retry automatically when encountering
		 * a 'badtoken' error.
		 *
		 * By default uses action=visualeditoredit, paction=save.
		 *
		 * @param {string} data Content data
		 * @param {Object} [options] Options
		 * @param {mw.Api} [options.api] Api to use
		 * @param {Function} [options.now] Function returning current time in milliseconds for tracking, e.g. ve.now
		 * @param {Function} [options.track] Tracking function
		 * @param {string} [options.eventName] Event name for tracking
		 * @return {jQuery.Promise} Promise which resolves with API save data, or rejects with error details
		 */
		postContent: function ( data, options ) {
			var request, api, start, action;

			options = options || {};
			api = options.api || new mw.Api();

			if ( options.now ) {
				start = options.now();
			}

			data = $.extend(
				{
					action: 'visualeditoredit',
					paction: 'save',
					format: 'json',
					formatversion: 2,
					errorformat: 'html',
					errorlang: mw.config.get( 'wgUserLanguage' ),
					errorsuselocal: true
				},
				data
			);

			action = data.action;

			request = api.postWithToken( 'csrf', data, { contentType: 'multipart/form-data' } );

			return request.then(
				function ( response, jqxhr ) {
					var eventData, fullEventName, error,
						responseData = response[ action ];

					// Log data about the request if eventName was set
					if ( options.track && options.eventName ) {
						eventData = {
							bytes: require( 'mediawiki.String' ).byteLength( jqxhr.responseText ),
							duration: options.now() - start
						};
						fullEventName = 'performance.system.' + options.eventName +
							( responseData.cachekey ? '.withCacheKey' : '.withoutCacheKey' );
						options.track( fullEventName, eventData );
					}

					if ( !responseData ) {
						error = {
							code: 'invalidresponse',
							html: mw.message( 'api-clientside-error-invalidresponse' ).parse()
						};
					} else if ( responseData.result !== 'success' ) {
						// This should only happen when saving an edit and getting a captcha from ConfirmEdit
						// extension (`data.result === 'error'`). It's a silly special case...
						return $.Deferred().reject( 'no-error-no-success', response ).promise();
					} else {
						// paction specific errors
						switch ( responseData.paction ) {
							case 'save':
							case 'serialize':
								if ( typeof responseData.content !== 'string' ) {
									error = {
										code: 'invalidcontent',
										html: mw.message( 'api-clientside-error-invalidresponse' ).parse()
									};
								}
								break;
							case 'diff':
								if ( typeof responseData.diff !== 'string' ) {
									error = {
										code: 'invalidcontent',
										html: mw.message( 'api-clientside-error-invalidresponse' ).parse()
									};
								}
								break;
						}
					}

					if ( error ) {
						// Use the same format as API errors
						return $.Deferred().reject( error.code, { errors: [ error ] } ).promise();
					}
					return responseData;
				},
				function ( code, response ) {
					var eventData, fullEventName,
						responseText = OO.getProp( response, 'xhr', 'responseText' );

					if ( responseText && options.track && options.eventName ) {
						eventData = {
							bytes: require( 'mediawiki.String' ).byteLength( responseText ),
							duration: options.now() - start
						};
						if ( code === 'badcachekey' ) {
							fullEventName = 'performance.system.' + options.eventName + '.badCacheKey';
						} else {
							fullEventName = 'performance.system.' + options.eventName + '.withoutCacheKey';
						}
						options.track( fullEventName, eventData );
					}
					return $.Deferred().reject( code, response ).promise();
				}
			);
		}
	};
}() );
