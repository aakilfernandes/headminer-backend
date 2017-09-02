const connection = require('../lib/connection')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const waterfall = require('promise-waterfall')
const stats = require('stats-lite')

connection.query(`
  SELECT * FROM twitter_influencers WHERE is_ignored = 0;
`).then((influencers) => {

  const queries = []
  const values = []

  const getQueriesAndValues = influencers.map((influencer) => {
    return function getQueriesAndValues() {
      return connection.query(`
        SELECT articles.*, twitter_articles_influences.influence  FROM twitter_articles_influences, articles
        WHERE twitter_articles_influences.influencer_id = ?
          AND twitter_articles_influences.article_id = articles.id
        ORDER BY rand()
        LIMIT 1000
      `, [influencer.id]).then((results) => {

        let twitter_statuses_count = 0
        let influence = 0

        const influence_ptss = []

        results.forEach((result) => {
          twitter_statuses_count += result.twitter_statuses_count
          influence += result.influence
          const influence_pts = result.influence / result.twitter_statuses_count
          const _influence_ptss = _.fill(new Array(result.influence), influence_pts)
          influence_ptss.push(..._influence_ptss)
        })

        const influence_pts_average = influence / twitter_statuses_count
        const influence_pts_variance = stats.variance(influence_ptss)

        queries.push(`
          UPDATE twitter_influencers
          SET influence_pts_average = ?, influence_pts_stdev = ?
          WHERE id = ?;
        `)
        values.push(influence_pts_average, influence_pts_variance, influencer.id)
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
