/*
  Surgical Engine: Matrix Named Range Search implementation.
  This implementation uses Google Sheets Named Ranges to search for data in a matrix.
*/

import {
	SupportedLayout,
	SurgicalBackend,
	SurgicalChangeset,
	SurgicalObject,
	SurgicalTemplate,
} from '../base/engine.js';

import StorageManager from '../../../src/parsing/storage-manager.js';

import { v4 as uuidv4 } from 'uuid';

class Prefixes {
	static universal = 'SURGICAL_ENGINE_MATRIX_';
	static object = this.universal + 'OBJECT_';
	static attribute = this.universal + 'ATTRIBUTE_';
	static layout = this.universal + 'LAYOUT';
	static ignore = this.universal + 'IGNORE_';
	static header = this.ignore + 'HEADER_';
	static generalIgnore = this.ignore + 'GENERAL_';
}

export default class MatrixBackend implements SurgicalBackend<MatrixBackend> {
	spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;

	initializeEngine(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet) {
		return this;
	}
	initializeSheet(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
		return this;
	}
	loadTemplate(template: SurgicalTemplate) {
		for (const id in template.objects) {
			const range = this.spreadsheet.getRange(template.objects[id]);
			this.spreadsheet.setNamedRange(Prefixes.object + id, range);
		}
		for (const attr in template.attributes) {
			const range = this.spreadsheet.getRange(template.objects[attr]);
			this.spreadsheet.setNamedRange(Prefixes.attribute + attr, range);
		}
		for (const sheetName in Object.keys(template.sheetLayouts)) {
			const sheet = this.spreadsheet.getSheetByName(sheetName);
			sheet.addDeveloperMetadata(
				Prefixes.layout,
				template.sheetLayouts[sheetName],
			);
		}

		for (const header in template.ignoredAreas.headers) {
			const id = uuidv4();
			const range = this.spreadsheet.getRange(header);
			const sheet = this.spreadsheet;
			sheet.setNamedRange(Prefixes.header + id, range);
		}
		for (const general in template.ignoredAreas.generalAreas) {
			const id = uuidv4();
			const range = this.spreadsheet.getRange(general);
			const sheet = this.spreadsheet;
			sheet.setNamedRange(Prefixes.generalIgnore + id, range);
		}

		return this;
	}

	getObject(id: string) {
		const objectNamedRange = this.spreadsheet.getRangeByName(
			Prefixes.object + id,
		);
		const sheet = objectNamedRange.getSheet();

		// get all attributes for that sheet
		const attributes = [];
		for (const range in sheet.getNamedRanges()) {
			if (range.startsWith(Prefixes.attribute)) {
				attributes.push(range);
			}
		}

		const object: Record<string, any> = {};

		for (const attribute in attributes) {
			const attrRange = this.spreadsheet.getRangeByName(attributes[attribute]);

			// intersect the objevtNamedRange with each attribute range and get the value, then put it into the object

			const attrColumn = attrRange.getColumn();
			const objRow = objectNamedRange.getRow();
			object[attribute] = sheet.getRange(objRow, attrColumn);
		}

		return {
			attributes: object,
			id,
		};
	}

	applyChangeset(changeset: SurgicalChangeset) {
		// for each new attribute add a named range at the specified position
		for (const newAttribute in changeset.create.attributes) {
			const currentChange = changeset.create.attributes[newAttribute];

			if (currentChange.position.range) {
				this.ingestNewRangeByNotation(
					currentChange.position.range,
					'ATTRIBUTE',
					newAttribute,
				);

				// otherwise add it at the specified offset from the end.
			} else if (currentChange.sheetName !== undefined) {
				const currentSheet = this.spreadsheet.getSheetByName(
					currentChange.sheetName,
				);

				const developerMetadata = currentSheet.getDeveloperMetadata();

				// get the layout of the sheet
				const layout = this.getSheetLayout(currentSheet);

				switch (currentChange.type) {
					case 'ingest':
						this.ingestNewRangeByOffset(
							currentSheet,
							'ATTRIBUTE',
							layout,
							currentChange.position.offset,
							newAttribute,
						);
					case 'append':
						switch (layout) {
							case 'vertical':
						}
				}
			}
		}

		for (const newObject in changeset.create.objects) {
			const currentChange = changeset.create.objects[newObject];
			if (currentChange.sheetName !== undefined) {
				const currentSheet = this.spreadsheet.getSheetByName(
					currentChange.sheetName,
				);

				// TODO: SPLIT THIS OUT INTO ITS OWN FUNCTION AND/OR METHOD
			}
		}
	}

	private appendObject(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
		const range = this.findEmptySpace(sheet, 'after-content-end');
		const id = uuidv4();
		this.spreadsheet.setNamedRange(Prefixes.object + id, range);
		return sheet.getNamedRanges().find((r) => r.getName() === Prefixes.object + uuidv4());
	}

	private intersectObjectWithAttributes(object: string) {
		let range: GoogleAppsScript.Spreadsheet.Range;
		switch (typeof object) {
			case 'string':
				range = this.spreadsheet.getRangeByName(Prefixes.object + object);
		}
	}

	// UTILITY FUNCTIONS

	private ingestNewRangeByNotation(
		rangeStr: string,
		type: 'ATTRIBUTE' | 'OBJECT',
		id: string,
	) {
		const range = this.spreadsheet.getRange(rangeStr);

		this.spreadsheet.setNamedRange(
			(type === 'ATTRIBUTE' ? Prefixes.attribute : Prefixes.object) + id,
			range,
		);
	}

	private ingestNewRangeByOffset(
		sheet: GoogleAppsScript.Spreadsheet.Sheet,
		type: 'ATTRIBUTE' | 'OBJECT',
		layout: 'vertical' | 'horizontal',
		offset: number,
		id: string,
	) {
		switch (layout) {
			// if the layout of the sheet uses columns for objects and rows for attributes
			case 'vertical':
				const vRange = this.spreadsheet.getLastColumn() + offset + 1;
				this.spreadsheet.setNamedRange(
					(type === 'ATTRIBUTE' ? Prefixes.attribute : Prefixes.object) + id,
					sheet.getRange(vRange, 1, 1, sheet.getLastColumn()),
				);
				break;

			// if the layout of the sheet uses rows for objects and columns for attributes
			case 'horizontal':
				const hRange = this.spreadsheet.getLastRow() + offset + 1;
				this.spreadsheet.setNamedRange(
					(type === 'ATTRIBUTE' ? Prefixes.attribute : Prefixes.object) + id,
					sheet.getRange(1, hRange, sheet.getLastRow(), 1),
				);
		}
	}

	private getSheetLayout(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
		const layout = sheet
			.getDeveloperMetadata()
			.find((m) => m.getKey() === Prefixes.layout)
			.getValue();

		if (layout !== 'vertical' && layout !== 'horizontal') {
			throw new Error('Invalid layout');
		} else {
			return layout;
		}
	}

	/**
	 * Finds empty space in a sheet. If there is none, it will create a new row or column.
	 */
	private findEmptySpace(
		sheet: GoogleAppsScript.Spreadsheet.Sheet,
		tactic: 'first-available' | 'after-content-end',
	) {
		const layout = this.getSheetLayout(sheet);
		switch (layout) {
			case 'vertical':
				switch (tactic) {
					case 'first-available':
						// find the first empty column that isn't ignored
						for (let i = 1; i < sheet.getLastColumn(); i++) {
							const range = sheet.getRange(1, i, sheet.getLastRow(), 1);
							if (this.isRangeEmpty(range)) {
								return range;
							} else {
								continue;
							}
						}

					case 'after-content-end':
						// the fallthrough here is intentional, we want to find the first empty row that isn't ignored.

						// if there's an empty column after the last column, return that.
						if (
							sheet.getRange(
								1, // row
								sheet.getLastColumn() + 1, // column
								sheet.getLastRow(), // number of rows
								1, // number of columns
							)
						) {
							return sheet.getRange(
								1,
								sheet.getLastColumn() + 1,
								sheet.getLastRow(),
								1,
							);

							// otherwise, insert a new column and return that.
						} else {
							sheet.insertColumnAfter(sheet.getLastColumn());
							return sheet.getRange(
								1,
								sheet.getLastColumn() + 1,
								sheet.getLastRow(),
								1,
							);
						}
				}
			case 'horizontal':
				switch (tactic) {
					case 'first-available':
						// find the first empty column that isn't ignored. if it's not found, fall through and insert a new row.
						for (let i = 1; i < sheet.getLastRow(); i++) {
							const range = sheet.getRange(i, 1, 1, sheet.getLastColumn());
							if (this.isRangeEmpty(range)) {
								return range;
							} else {
								continue;
							}
						}
					case 'after-content-end':
						// the fallthrough here is intentional, we want to find the first empty row that isn't ignored.

						// if there's an empty column after the last column, return that.
						if (
							sheet.getRange(
								sheet.getLastRow() + 1,
								1,
								1,
								sheet.getLastColumn(),
							)
						) {
							return sheet.getRange(
								sheet.getLastRow() + 1,
								1,
								1,
								sheet.getLastColumn(),
							);

							// otherwise, insert a new column and return that.
						} else {
							sheet.insertRowAfter(sheet.getLastColumn());
							return sheet.getRange(
								sheet.getLastRow() + 1,
								1,
								1,
								sheet.getLastColumn(),
							);
						}
				}
		}
	}

	private isRangeEmpty(range: GoogleAppsScript.Spreadsheet.Range) {
		const sheet = range.getSheet();
		if (!this.isRangeIgnored(sheet, range)) {
			const cells = this.create1dIterableRange(range);
			for (const cell of cells) {
				// if the value is ignored, no matter what the content is it should continue. otherwise, if the value is there, immediately return false, and at the end if all values are ignored or empty, return true
				if (this.isRangeIgnored(sheet, cell)) {
					continue;
				} else if (cell.getValue()) {
					return false;
				}
			}
			return true;
		}
	}

	/**
	 * Creates a one-dimensional set of cell ranges from a full 1D range.
	 */
	private *create1dIterableRange(range: GoogleAppsScript.Spreadsheet.Range) {
		switch (true) {
			// split a one dimensional range into multiple ranges, one per cell

			// HORIZONTAL
			case range.getHeight() === 1 && range.getWidth() > 1:
				for (let i = 1; i < range.getWidth(); i++) {
					yield range.getCell(1, i);
				}
				break;

			// VERTICAL
			case range.getHeight() > 1 && range.getWidth() === 1:
				for (let i = 1; i < range.getHeight(); i++) {
					yield range.getCell(i, 1);
				}
				break;

			// SQUARE LIL' BUD :)
			case range.getHeight() === 1 && range.getWidth() === 1:
				yield range.getCell(1, 1);
				break;

			// too big
			case range.getHeight() > 1 && range.getWidth() > 1:
				// TODO: standardize these error codes in the app error format
				throw new Error(
					'The input range used for iteration appears to be 2D. Please only use a one-dimensional range.',
				);

			// idek what happens to get you here... you clearly didn't follow the typescript types, idk how to help you.
			default:
				throw new Error(
					'The input range used for iteration is an in incorrect format. Please use a one-dimensional range, conforming to the TypeScript type GoogleAppsScript.Spreadsheet.Range.',
				);
		}
	}

	private isRangeIgnored(
		sheet: GoogleAppsScript.Spreadsheet.Sheet,
		range: GoogleAppsScript.Spreadsheet.Range,
	) {
		sheet
			.getNamedRanges()
			.filter(
				// filter out any named ranges that don't start with SURGICAL_ENGINE_MATRIX_IGNORE
				(namedRange: GoogleAppsScript.Spreadsheet.NamedRange) => {
					namedRange.getName().startsWith(Prefixes.ignore);
				},
			)

			// for every named range that starts with SURGICAL_ENGINE_MATRIX_IGNORE_
			.forEach((ignoreZone: GoogleAppsScript.Spreadsheet.NamedRange) => {
				// if the range is the ignore zone
				if (ignoreZone.getRange().getA1Notation() === range.getA1Notation())
					return true;

				// check if the range is contained in an ignore zone.

				// Get the bounds of each range
				const rangeStartRow = range.getRow();
				const rangeStartCol = range.getColumn();
				const rangeEndRow = rangeStartRow + range.getHeight() - 1;
				const rangeEndCol = rangeStartCol + range.getWidth() - 1;

				const ignoreZoneStartRow = ignoreZone.getRange().getRow();
				const ignoreZoneStartCol = ignoreZone.getRange().getColumn();
				const ignoreZoneEndRow =
					ignoreZoneStartRow + ignoreZone.getRange().getHeight() - 1;
				const ignoreZoneEndCol =
					ignoreZoneStartCol + ignoreZone.getRange().getWidth() - 1;

				// Check if range is completely within ignore zone
				if (
					rangeStartRow >= ignoreZoneStartRow &&
					rangeEndRow <= ignoreZoneEndRow &&
					rangeStartCol >= ignoreZoneStartCol &&
					rangeEndCol <= ignoreZoneEndCol
				)
					return true;
			});
		return false;
	}

	supportedLayouts = [
		SupportedLayout.headerRows,
		SupportedLayout.headerColumns,
		SupportedLayout.horizontalObjects,
		SupportedLayout.verticalObjects,
	];
}
