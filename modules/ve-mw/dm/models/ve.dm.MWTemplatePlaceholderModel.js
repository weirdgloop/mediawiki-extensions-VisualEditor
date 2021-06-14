/*!
 * VisualEditor DataModel MWTemplatePlaceholderModel class.
 *
 * @copyright 2011-2020 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

/**
 * Represents a not yet realized template invocation as long as the user is still searching for a
 * template name. Meant to be an item in a {@see ve.dm.MWTransclusionModel}.
 *
 * @class
 * @extends ve.dm.MWTransclusionPartModel
 *
 * @constructor
 * @param {ve.dm.MWTransclusionModel} transclusion
 */
ve.dm.MWTemplatePlaceholderModel = function VeDmMWTemplatePlaceholderModel() {
	// Parent constructor
	ve.dm.MWTemplatePlaceholderModel.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.dm.MWTemplatePlaceholderModel, ve.dm.MWTransclusionPartModel );

/* Methods */

/**
 * @inheritDoc
 */
ve.dm.MWTemplatePlaceholderModel.prototype.isEmpty = function () {
	return true;
};
