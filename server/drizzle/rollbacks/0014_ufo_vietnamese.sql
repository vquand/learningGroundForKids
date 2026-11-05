-- Disposable/local databases only. Removes Vietnamese dictionary entries.
DELETE FROM ufo_words WHERE language = 'vi';
ALTER TABLE ufo_words DROP CONSTRAINT ufo_words_word_valid;
ALTER TABLE ufo_words DROP CONSTRAINT ufo_words_language_valid;
DROP INDEX ufo_words_word_unique;
ALTER TABLE ufo_words DROP COLUMN language;
CREATE UNIQUE INDEX ufo_words_word_unique ON ufo_words(word);
ALTER TABLE ufo_words ADD CONSTRAINT ufo_words_word_valid CHECK (word ~ '^[A-Z]{2,18}$');
