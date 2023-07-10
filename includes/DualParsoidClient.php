<?php

namespace MediaWiki\Extension\VisualEditor;

use Language;
use MediaWiki\Page\PageIdentity;
use MediaWiki\Permissions\Authority;
use MediaWiki\Revision\RevisionRecord;

/**
 * A decorator implementation of ParsoidClient that will delegate to the appropriate
 * implementation of ParsoidClient based on the incoming ETag.
 *
 * The purpose of this decorator is to ensure that VE sessions that loaded HTML from
 * one ParsoidClient implementation will use the same implementation when saving the HTML,
 * even when the preferred implementation was changed on the server while the editor was open.
 *
 * This avoids users losing edits at the time of the config change: if the HTML the user
 * submits when saving the page doesn't get handled by the same implementation that originally
 * provided the HTML for editing, the ETag will mismatch and the edit will fail.
 */
class DualParsoidClient implements ParsoidClient {

	/** @var VisualEditorParsoidClientFactory */
	private VisualEditorParsoidClientFactory $factory;

	/** @var Authority */
	private Authority $authority;

	/**
	 * @note Called by DiscussionTools, keep compatible!
	 *
	 * @param VisualEditorParsoidClientFactory $factory
	 * @param Authority $authority
	 */
	public function __construct(
		VisualEditorParsoidClientFactory $factory,
		Authority $authority
	) {
		$this->factory = $factory;
		$this->authority = $authority;
	}

	/**
	 * Inject information about what ParsoidClient implementation was used
	 * into the ETag header.
	 *
	 * @param array &$result
	 * @param ParsoidClient $client
	 */
	private static function injectMode( array &$result, ParsoidClient $client ) {
		$mode = 'direct';

		if ( isset( $result['headers']['etag'] ) ) {
			$etag = $result['headers']['etag'];

			// Inject $mode after double-quote
			$result['headers']['etag'] = preg_replace( '/^(W\/)?"(.*)"$/', '$1"' . $mode . ':$2"', $etag );
		}
	}

	/**
	 * Strip information about what ParsoidClient implementation to use from the ETag,
	 * restoring it to the original ETag originally emitted by that ParsoidClient.
	 *
	 * @param string $etag
	 *
	 * @return string
	 */
	private static function stripMode( string $etag ): string {
		// Remove any prefix between double-quote and colon
		return preg_replace( '/"(\w+):/', '"', $etag );
	}

	/**
	 * Create a DirectParsoidClient.
	 *
	 * @return ParsoidClient
	 */
	private function createParsoidClient(): ParsoidClient {
		return $this->factory->createParsoidClientInternal( $this->authority );
	}

	/**
	 * @inheritDoc
	 */
	public function getPageHtml( RevisionRecord $revision, ?Language $targetLanguage ): array {
		$client = $this->createParsoidClient();
		$result = $client->getPageHtml( $revision, $targetLanguage );

		self::injectMode( $result, $client );
		return $result;
	}

	/**
	 * @inheritDoc
	 */
	public function transformHTML(
		PageIdentity $page,
		Language $targetLanguage,
		string $html,
		?int $oldid,
		?string $etag
	): array {
		$client = $this->createParsoidClient();

		if ( $etag ) {
			$etag = self::stripMode( $etag );
		}

		$result = $client->transformHTML( $page, $targetLanguage, $html, $oldid, $etag );

		self::injectMode( $result, $client );
		return $result;
	}

	/**
	 * @inheritDoc
	 */
	public function transformWikitext(
		PageIdentity $page,
		Language $targetLanguage,
		string $wikitext,
		bool $bodyOnly,
		?int $oldid,
		bool $stash
	): array {
		$client = $this->createParsoidClient();
		$result = $client->transformWikitext( $page, $targetLanguage, $wikitext, $bodyOnly, $oldid, $stash );

		self::injectMode( $result, $client );
		return $result;
	}
}
