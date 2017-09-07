const mysqlQuery = require('../lib/mysqlQuery')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const waterfall = require('promise-waterfall')
const stats = require('stats-lite')

mysqlQuery(`
  SELECT * FROM twitter_influencers WHERE is_ignored = 0;
`).then((influencers) => {

  const queries = []
  const values = []

  const getQueriesAndValues = influencers.map((influencer) => {
    return function getQueriesAndValues() {
      return mysqlQuery(`
        SELECT articles.*, twitter_articles_influences.influence  FROM twitter_articles_influences, articles
        WHERE twitter_articles_influences.influencer_id = ?
          AND twitter_articles_influences.article_id = articles.id
          AND articles.twitter_statuses_count != 0
        ORDER BY rand()
        LIMIT 1000
      `, [influencer.id]).then((results) => {

        let twitter_statuses_count = 0
        let influence = 0
        let influence_pts_wstdev_numerator = 0
        let nonzero_influences_count = 0

        results.forEach((result) => {
          twitter_statuses_count += result.twitter_statuses_count
          influence += result.influence
        })

        const influence_pts_average = influence / twitter_statuses_count

        results.forEach((result) => {
          const influence_pts = result.influence / result.twitter_statuses_count
          influence_pts_wstdev_numerator += (
            result.twitter_statuses_count * (
              Math.pow(influence_pts - influence_pts_average, 2)
            )
          )
          if (result.influence > 0) {
            nonzero_influences_count += 1
          }
        })

        if (nonzero_influences_count <= 1) {
          return
        }

        const influence_pts_wstdev = Math.pow(
          influence_pts_average / (
            influence * ((nonzero_influences_count - 1) / nonzero_influences_count)
          )
        , .5)

        queries.push(`
          UPDATE twitter_influencers
          SET influence_pts_average = ?, influence_pts_wstdev = ?
          WHERE id = ?;
        `)
        values.push(influence_pts_average, influence_pts_wstdev, influencer.id)
      })
    }
  })
  return waterfall(getQueriesAndValues).then(() => {
    const query = queries.join('\r\n')
    return mysqlQuery(query, values)
  })
}).finally(() => {
  process.exit()
})
