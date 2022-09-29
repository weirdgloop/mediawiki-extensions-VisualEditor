<?php
/**
 * Helper functions for contacting Parsoid/RESTBase from the action API.
 *
 * @file
 * @ingroup Extensions
 * @copyright 2011-2020 VisualEditor Team and others; see AUTHORS.txt
 * @license MIT
 */

namespace MediaWiki\Extension\VisualEditor;

use Language;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\RevisionRecord;
use Message;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Title;
use WebRequest;

trait ApiParsoidTrait {

	/**
	 * @var LoggerInterface
	 */
	private $logger = null;

	/**
	 * @return LoggerInterface
	 */
	protected function getLogger(): LoggerInterface {
		return $this->logger ?: new NullLogger();
	}

	/**
	 * @param LoggerInterface $logger
	 */
	protected function setLogger( LoggerInterface $logger ) {
		$this->logger = $logger;
	}

	/**
	 * Get the latest revision of a title
	 *
	 * @param Title $title Page title
	 * @return RevisionRecord A revision record
	 */
	protected function getLatestRevision( Title $title ): RevisionRecord {
		$revisionLookup = MediaWikiServices::getInstance()->getRevisionLookup();
		$latestRevision = $revisionLookup->getRevisionByTitle( $title );
		if ( $latestRevision !== null ) {
			return $latestRevision;
		}
		$this->dieWithError( 'apierror-visualeditor-latestnotfound', 'latestnotfound' );
	}

	/**
	 * Get a specific revision of a title
	 *
	 * If the oldid is ommitted or is 0, the latest revision will be fetched.
	 *
	 * If the oldid is invalid, an API error will be reported.
	 *
	 * @param Title|null $title Page title, not required if $oldid is used
	 * @param int|string|null $oldid Optional revision ID.
	 *  Should be an integer but will validate and convert user input strings.
	 * @return RevisionRecord A revision record
	 */
	protected function getValidRevision( Title $title = null, $oldid = null ): RevisionRecord {
		$revisionLookup = MediaWikiServices::getInstance()->getRevisionLookup();
		if ( $oldid === null || $oldid === 0 ) {
			return $this->getLatestRevision( $title );
		} else {
			$revisionRecord = $revisionLookup->getRevisionById( $oldid );
			if ( $revisionRecord ) {
				return $revisionRecord;
			}
		}
		$this->dieWithError( [ 'apierror-nosuchrevid', $oldid ], 'oldidnotfound' );
	}

	/**
	 * @param array $response
	 */
	private function forwardErrorsAndCacheHeaders( array $response ) {
		if ( !empty( $response['error'] ) ) {
			$this->dieWithError( $response['error'] );
		}

		// If response was received directly from Varnish, use the response
		// (RP) header to declare the cache hit and pass the data to the client.
		$headers = $response['headers'] ?? [];
		if ( isset( $headers['x-cache'] ) && strpos( $headers['x-cache'], 'hit' ) !== false ) {
			$this->getRequest()->response()->header( 'X-Cache: cached-response=true' );
		}
	}

	/**
	 * Request page HTML from RESTBase
	 *
	 * @param RevisionRecord $revision Page revision
	 * @return array The RESTBase server's response
	 */
	protected function requestRestbasePageHtml( RevisionRecord $revision ): array {
		$title = Title::newFromLinkTarget( $revision->getPageAsLinkTarget() );
		$lang = self::getPageLanguage( $title );

		$response = $this->getParsoidClient()->getPageHtml( $revision, $lang );

		$this->forwardErrorsAndCacheHeaders( $response );

		return $response;
	}

	/**
	 * Transform HTML to wikitext via Parsoid through RESTbase. Wrapper for ::postData().
	 *
	 * @param Title $title The title of the page
	 * @param string $html The HTML of the page to be transformed
	 * @param int|null $oldid What oldid revision, if any, to base the request from (default: `null`)
	 * @param string|null $etag The ETag to set in the HTTP request header
	 * @return array The RESTbase server's response, 'code', 'reason', 'headers' and 'body'
	 */
	protected function transformHTML(
		Title $title, string $html, int $oldid = null, string $etag = null
	): array {
		$lang = self::getPageLanguage( $title );

		$response = $this->getParsoidClient()->transformHTML( $title, $lang, $html, $oldid, $etag );

		$this->forwardErrorsAndCacheHeaders( $response );

		return $response;
	}

	/**
	 * Transform wikitext to HTML via Parsoid through RESTbase. Wrapper for ::postData().
	 *
	 * @param Title $title The title of the page to use as the parsing context
	 * @param string $wikitext The wikitext fragment to parse
	 * @param bool $bodyOnly Whether to provide only the contents of the `<body>` tag
	 * @param int|null $oldid What oldid revision, if any, to base the request from (default: `null`)
	 * @param bool $stash Whether to stash the result in the server-side cache (default: `false`)
	 * @return array The RESTbase server's response, 'code', 'reason', 'headers' and 'body'
	 */
	protected function transformWikitext(
		Title $title, string $wikitext, bool $bodyOnly, int $oldid = null, bool $stash = false
	): array {
		$lang = self::getPageLanguage( $title );

		$response = $this->getParsoidClient()->transformWikitext(
			$title,
			$lang,
			$wikitext,
			$bodyOnly,
			$oldid,
			$stash
		);

		$this->forwardErrorsAndCacheHeaders( $response );

		return $response;
	}

	/**
	 * Get the page language from a title, using the content language as fallback on special pages
	 *
	 * @param Title $title
	 * @return Language Content language
	 */
	public static function getPageLanguage( Title $title ): Language {
		if ( $title->isSpecial( 'CollabPad' ) ) {
			// Use the site language for CollabPad, as getPageLanguage just
			// returns the interface language for special pages.
			// TODO: Let the user change the document language on multi-lingual sites.
			return MediaWikiServices::getInstance()->getContentLanguage();
		} else {
			return $title->getPageLanguage();
		}
	}

	/**
	 * @see VisualEditorParsoidClientFactory
	 * @return ParsoidClient
	 */
	abstract protected function getParsoidClient(): ParsoidClient;

	/**
	 * @see ApiBase
	 * @param string|array|Message $msg See ApiErrorFormatter::addError()
	 * @param string|null $code See ApiErrorFormatter::addError()
	 * @param array|null $data See ApiErrorFormatter::addError()
	 * @param int|null $httpCode HTTP error code to use
	 * @return never
	 */
	abstract public function dieWithError( $msg, $code = null, $data = null, $httpCode = null );

	/**
	 * @see ContextSource
	 * @return WebRequest
	 */
	abstract public function getRequest();
}
