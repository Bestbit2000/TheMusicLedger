-- ML-412: the tools on Home are called "favourite tools" now (Home's heading is "My favourite tools", the
-- All tools page says "Choose favourite tools"). The limit that says how many keeps its key (home_tools -
-- as accounts.home_tools does), only the name and description Admin -> Feature access shows change.
UPDATE feature_limits
   SET name = 'Favourite tools',
       description = 'How many favourite tools a player can have. They show on Home (My favourite tools) and are chosen on the All tools page. Every four is another row.'
 WHERE limit_key = 'home_tools';
