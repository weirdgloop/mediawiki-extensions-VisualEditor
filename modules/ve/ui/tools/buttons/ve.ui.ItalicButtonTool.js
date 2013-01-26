/*!
 * VisualEditor UserInterface ItalicButtonTool class.
 *
 * @copyright 2011-2012 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

/**
 * UserInterface italic button tool.
 *
 * @class
 * @extends ve.ui.AnnotationButtonTool
 * @constructor
 * @param {ve.ui.Toolbar} toolbar
 */
ve.ui.ItalicButtonTool = function VeUiItalicButtonTool( toolbar ) {
	// Parent constructor
	ve.ui.AnnotationButtonTool.call( this, toolbar );
};

/* Inheritance */

ve.inheritClass( ve.ui.ItalicButtonTool, ve.ui.AnnotationButtonTool );

/* Static Properties */

ve.ui.ItalicButtonTool.static.name = 'italic';

ve.ui.ItalicButtonTool.static.titleMessage = 'visualeditor-annotationbutton-italic-tooltip';

ve.ui.ItalicButtonTool.static.annotation = { 'name': 'textStyle/italic' };

/* Registration */

ve.ui.toolFactory.register( 'italic', ve.ui.ItalicButtonTool );

ve.commandRegistry.register(
	'italic', 'annotation', 'toggle', 'textStyle/italic'
);

ve.triggerRegistry.register(
	'italic', { 'mac': new ve.Trigger( 'cmd+i' ), 'pc': new ve.Trigger( 'ctrl+i' ) }
);
