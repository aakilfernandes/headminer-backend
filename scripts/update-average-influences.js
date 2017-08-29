const connection = require('../lib/connection')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const waterfall = require('promise-waterfall')

connection.query(`
  SELECT * FROM twitter_influencers WHERE is_ignored = 0;
`).then((influencers) => {

  const queries = []
  const values = []

  const getQueriesAndValues = influencers.map((influencer) => {
    return function getQueriesAndValues() {
      return connection.query(`
        SELECT urls.*, twitter_urls_influences.influence  FROM twitter_urls_influences, urls
        WHERE twitter_urls_influences.influencer_id = ?
          AND twitter_urls_influences.url_id = urls.id
        ORDER BY rand()
        LIMIT 1000
      `, [influencer.id]).then((results) => {
        console.log(influencer.id)
        let twitter_statuses_count = 0
        let influence = 0
        results.forEach((result) => {
          twitter_statuses_count += result.twitter_statuses_count
          influence += (result.twitter_statuses_count * result.influence)
        })

        queries.push(`UPDATE twitter_influencers SET average_influence = ? WHERE id = ?;`);
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
