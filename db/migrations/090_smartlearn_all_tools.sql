-- ML-399: SmartLearn is one switch for every tool it works in (Theory, Pitch, Tempo), and is written
-- "SmartLearn". The feature key stays theory_smart_learn (it's in feature_access and in the code);
-- only the name and description shown in Admin change. No new tables: Pitch and Tempo keep their
-- weights in theory_question_weights, under "ear:<level>:<note>" and "tap:<level>:<band>".

UPDATE features
SET name = 'SmartLearn',
    description = 'SmartLearn (ML-269, ML-399): remembers what each person gets wrong or hesitates on and brings it back sooner and more often - Theory questions, Pitch notes and Tempo speeds. Off = plain rounds with no memory. Intended for the paid tier.'
WHERE feature_key = 'theory_smart_learn';
