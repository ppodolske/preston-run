function buildFact(input){
  return {
    source_record_id:input.sourceRecordId,
    attachment_record_id:input.attachmentRecordId||null,
    fact_type:input.factType,
    fact_value:input.factValue,
    fact_schema_version:input.factSchemaVersion||1,
    parser_version:input.parserVersion,
    classification_confidence:input.classificationConfidence??null,
    extraction_confidence:input.extractionConfidence??null,
    entity_match_confidence:input.entityMatchConfidence??null,
    urgency_confidence:input.urgencyConfidence??null,
    is_current_candidate:true,
    supersedes_fact_id:input.supersedesFactId||null
  };
}
module.exports={buildFact};
