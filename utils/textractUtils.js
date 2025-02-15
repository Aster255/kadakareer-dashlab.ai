const result = require("../test_documents/MFOWS-Annex_G-Psychological_Evaluation Form_Pg1.json")
const result2 = require("../test_documents/MFOWS-Annex_G-Psychological_Evaluation Form_Pg2.json")

const extractAllRowIDs = (tableBlock) => {
	let result = []
	if (tableBlock.BlockType === "TABLE") {
		const relationships = tableBlock.Relationships

		relationships.forEach((relationship) => {
			if (relationship.Type === "CHILD") {
				const childIDs = relationship.Ids
				const table = []
				let row = []
				
				let counter = 1
				for (let i = 0; i < childIDs.length; i++) {
					row.push(childIDs[i])

					if (counter >= 8) {
						counter = 1
						table.push(row)
						row = []
					} else {
						counter++
					}
				}
				result = table
			}
		})
		return result
	} else {
		console.error("Please input Blocktype of 'TABLE'")
	}
}

const extractLines = (textractResult) => {
    const AWSBlockResults = textractResult.Blocks;
    const lines = []

    AWSBlockResults.forEach((block) => {
        
        if (block.BlockType === "LINE") {
            lines.push(block.Text)
        }
    })

    return lines
}

// Extracts all extracted key-values pairs from a form, e.g [[SURNAME, MAKAPAGAL]]
const extractKeyValuePairs = (textractResult) => {
	const AWSBlockResults = textractResult.Blocks;
	const keyValuePairs = []; // store results

	// Iterate to all blocks
	for (let i = 0; i < AWSBlockResults.length; i++) {
		const block = AWSBlockResults[i];
		// find key_value_sets
		if (block.BlockType === "KEY_VALUE_SET") {
			const keyValueSetBlock = block;

			// check if it found keys
			if (keyValueSetBlock.EntityTypes[0] === "KEY") {
				const keyBlock = block;

				// Iterate for all types of relationships
				let keyWords = [];
				let valueWords = [];

				for (let j = 0; j < keyBlock.Relationships?.length; j++) {
					const keyBlockRelationship = keyBlock.Relationships[j];

					// Creating A key Name
					if (keyBlockRelationship.Type === "CHILD") {
						keyBlockRelationship.Ids.forEach((keyBlockID) => {
							const wordBlock = AWSBlockResults.find((block) => {
								return block.Id === keyBlockID;
							});

							keyWords.push(wordBlock.Text);
						});
					}

					// Creating A value
					if (keyBlockRelationship.Type === "VALUE") {
						keyBlockRelationship.Ids.forEach((valueBlockID) => {
							// finding the value block
							const valueBlock = AWSBlockResults.find((block) => {
								return block.Id === valueBlockID;
							});

							// loop through each relationships
							valueBlock.Relationships?.forEach(
								(relationship) => {
									if (relationship.Type === "CHILD") {

										for (k = 0; k < relationship.Ids.length; k++) {
											const valueBlockID = relationship.Ids[k]
											const valueBlockWord =
												AWSBlockResults.find(
													(block) => {
														return (
															block.Id === valueBlockID
														);
													}
												);

											let valueResult;
											if (valueBlockWord.BlockType === "SELECTION_ELEMENT") {
												valueResult = valueBlockWord.SelectionStatus;
												valueWords.push(valueResult);
												break
												
											} else {
												valueResult = valueBlockWord.Text;
												valueWords.push(valueResult);
											}
										}
									}
								}
							);
						});
					}
				}
				const keyWordResult = keyWords.join("_").toUpperCase().replace(/:/g, '');
				const valueWordResult = valueWords.join(" ");
				keyValuePairs.push([keyWordResult, valueWordResult]);
			}
		}
	}

    return keyValuePairs
};

// Returns all extracted key-value pairs from the tables, e.g [{page: 1, keyValuePairs: [[ASSERTIVENESS, 5]]}]
const getTableValues = (textractResult) => {
	const tableKeyValuePairs = []

	const tableBlocks = []
	textractResult.Blocks.forEach(block => {
		if (block.BlockType === "TABLE") {
			tableBlocks.push(block)
		}
	})

	tableBlocks.forEach((tableBlock, index) => {
		const rowIDs = extractAllRowIDs(tableBlock)
		const keyValuePairs = []
	
		rowIDs.forEach((row) => {
			const cellBlockForField = textractResult.Blocks.find((block) => {
				return block.Id === row[0]
			})

			let fieldName = []
			cellBlockForField.Relationships?.forEach(relationship => {
				if (relationship.Type === "CHILD") {
					relationship.Ids.forEach(IDs => {
						const wordBlock = textractResult.Blocks.find((block) => {
							return block.Id === IDs
						})

						if (wordBlock.BlockType === "WORD") {
							const word = wordBlock.Text
							fieldName.push(word)
							isField = true
						}
						
					})
				}
			})
			fieldName = fieldName.join("_").toUpperCase()

			if (cellBlockForField.ColumnIndex === 1) {
				let value;
				for (let i = 1; i < row.length; i++) {
					const cell = textractResult.Blocks.find((block) => {
						return block.Id === row[i] 
					})

					cell.Relationships?.forEach(relationship => {
						if (relationship.Type === "CHILD") {
							relationship.Ids.forEach((id) => {
								const selectionCell = textractResult.Blocks.find((block) => {
									return block.Id === id
								})

								if (selectionCell.BlockType === "SELECTION_ELEMENT" && selectionCell.SelectionStatus === "SELECTED") {
									value = i
								}
							})
						}
					})
				}

				keyValuePairs.push([fieldName, value])
			}
		})
		tableKeyValuePairs.push({
			table: index + 1,
			keyValuePairs
		}) 
	})

	return tableKeyValuePairs
}

const sendRequestToTextractClient = async (documentBuffers, AnalyzeDocumentCommand, client) => {
    const textractResult = []

	for (let i=0; i < documentBuffers.length; i++) {
		const documentBuffer = documentBuffers[i]

		const command = new AnalyzeDocumentCommand({
			Document: {
			  Bytes: documentBuffer,
			},
			FeatureTypes: ["TABLES", "FORMS", "SIGNATURES", "LAYOUT"],
		  });
	  
		const result = await client.send(command)
		textractResult.push(result)
	}

    return textractResult
}


module.exports = {
    extractLines,
    extractKeyValuePairs,
	getTableValues,
	extractAllRowIDs,
	sendRequestToTextractClient
}