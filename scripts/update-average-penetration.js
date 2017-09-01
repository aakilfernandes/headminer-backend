const connection = require('../lib/connection')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const waterfall = require('promise-waterfall')

connection.query(`
  SELECT * FROM twitter_influencers WHERE is_ignored = 0;
`).then((influencers) => {

  const influencers_by_id = _.keyBy(influencers, 'id')
  const queries = []
  const values = []

  const getQueriesAndValues = influencers.map((influencer) => {
    return function getQueriesAndValues() {
      return connection.query(`
        SELECT articles.twitter_statuses_count, twitter_articles_influences.influence  FROM twitter_articles_influences, articles
        WHERE twitter_articles_influences.influencer_id = ?
          AND twitter_articles_influences.article_id = articles.id
        ORDER BY rand()
        LIMIT 1000
      `, [influencer.id]).then((results) => {
        let penetration = 0
        results.forEach((result) => {
          penetration += result.penetration
        })

        queries.push(`UPDATE twitter_influencers SET average_penetration = ? WHERE id = ?;`);
        values.push(influence / twitter_statuses_count, influencer.id)
      })
    }
  })
  return waterfall(getQueriesAndValues).then(() => {
    const query = queries.join('\r\n')
    return connection.query(query, values)
  })
}).finally(() => {
  connection.end()
})
